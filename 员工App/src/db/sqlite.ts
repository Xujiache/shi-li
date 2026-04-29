/**
 * plus.sqlite 串行包装（APP-PLUS only）。
 *
 * 关键风险点（Plan B）：
 *   1. plus.sqlite 并发 lock 极易触发 → 必须串行：每条 SQL `await prev`
 *   2. uni.createSQLDatabase 在 H5 不可用，APP 端也不存在；统一用 plus.sqlite
 *   3. callback 风格转 Promise；fail 时统一 reject Error 对象
 *   4. 事务用一次 transaction（plus.sqlite 没有原生 BEGIN…COMMIT 暴露），
 *      但 executeBatch 提供按数组顺序串行执行 + 全失败回滚的近似语义
 *      （plus.sqlite 没暴露事务 API，落到 BEGIN/COMMIT 显式 SQL）
 *
 * H5 / MP：导出 `OFFLINE_DISABLED` throw 桩；不允许直接调用。
 */
import { getDbAlias, getDbPath } from './platform'

export const OFFLINE_DISABLED_ERR = 'OFFLINE_DISABLED'

let dbOpened = false
// 串行队列：每个 SQL 调用都 await prev，保证顺序
let queueTail: Promise<any> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queueTail.then(task, task)
  // 即使前一个失败，链不能断，所以两个 handler 都用 task；
  // 但要避免本次失败传染到 tail：tail 永远 resolve
  queueTail = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

/**
 * 打开数据库。幂等。
 */
export function openDb(): Promise<void> {
  // #ifdef APP-PLUS
  return enqueue(
    () =>
      new Promise<void>((resolve, reject) => {
        if (dbOpened) {
          // plus.sqlite.isOpenDatabase 也可二次校验
          try {
            // @ts-ignore
            if (plus.sqlite.isOpenDatabase({ name: getDbAlias(), path: getDbPath() })) {
              return resolve()
            }
          } catch (e) {
            // 继续打开
          }
        }
        // @ts-ignore
        plus.sqlite.openDatabase({
          name: getDbAlias(),
          path: getDbPath(),
          success: () => {
            dbOpened = true
            resolve()
          },
          fail: (e: any) => {
            const err = new Error(`[sqlite] openDatabase fail: ${e && e.message ? e.message : JSON.stringify(e)}`)
            reject(err)
          }
        })
      })
  )
  // #endif
  // #ifndef APP-PLUS
  return Promise.reject(new Error(OFFLINE_DISABLED_ERR))
  // #endif
}

/**
 * 简易参数绑定：plus.sqlite 不支持 ? 占位，需要拼字符串。
 * 这里做最小转义：null/undefined → NULL；number → 字面量；
 * 其他统一转 string + 单引号转义。
 *
 * 注意：调用方传参必须是 trusted（不要拼用户原始输入到 SQL，
 * 业务字段存进去的是 JSON.stringify 后的 TEXT，已经被引号包裹）。
 */
function bindParams(sql: string, params?: any[]): string {
  if (!params || params.length === 0) return sql
  let i = 0
  return sql.replace(/\?/g, () => {
    if (i >= params.length) return '?'
    const v = params[i++]
    if (v === null || v === undefined) return 'NULL'
    if (typeof v === 'number' && !isNaN(v) && isFinite(v)) return String(v)
    if (typeof v === 'boolean') return v ? '1' : '0'
    // SQLite 字符串字面量转义：
    //   '   → ''      （单引号双写，SQL 标准）
    //   \   → \\      （防止反斜杠在某些 SQLite 编译版本被解释）
    //   \0  → 删除    （NULL 字节会截断 C string，必须移除）
    //   控制字符 \n \r \t 在 SQLite TEXT 中直接保留（无需转义）
    const s = String(v)
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '')
      .replace(/'/g, "''")
    return `'${s}'`
  })
}

/**
 * 执行写 SQL（INSERT/UPDATE/DELETE/CREATE/DROP）。
 */
export function executeSql(sql: string, params?: any[]): Promise<void> {
  // #ifdef APP-PLUS
  return enqueue(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!dbOpened) {
          return reject(new Error('[sqlite] db not opened'))
        }
        const finalSql = bindParams(sql, params)
        // @ts-ignore
        plus.sqlite.executeSql({
          name: getDbAlias(),
          sql: finalSql,
          success: () => resolve(),
          fail: (e: any) => {
            const err = new Error(`[sqlite] executeSql fail: ${e && e.message ? e.message : JSON.stringify(e)} | SQL=${finalSql}`)
            reject(err)
          }
        })
      })
  )
  // #endif
  // #ifndef APP-PLUS
  return Promise.reject(new Error(OFFLINE_DISABLED_ERR))
  // #endif
}

/**
 * 执行查询 SQL。返回行数组（每行是对象）。
 */
export function selectSql(sql: string, params?: any[]): Promise<any[]> {
  // #ifdef APP-PLUS
  return enqueue(
    () =>
      new Promise<any[]>((resolve, reject) => {
        if (!dbOpened) {
          return reject(new Error('[sqlite] db not opened'))
        }
        const finalSql = bindParams(sql, params)
        // @ts-ignore
        plus.sqlite.selectSql({
          name: getDbAlias(),
          sql: finalSql,
          success: (rows: any) => resolve(Array.isArray(rows) ? rows : []),
          fail: (e: any) => {
            const err = new Error(`[sqlite] selectSql fail: ${e && e.message ? e.message : JSON.stringify(e)} | SQL=${finalSql}`)
            reject(err)
          }
        })
      })
  )
  // #endif
  // #ifndef APP-PLUS
  return Promise.reject(new Error(OFFLINE_DISABLED_ERR))
  // #endif
}

/**
 * 批量执行（事务）。plus.sqlite 接受 sql 数组形式 → 内部一次 transaction。
 *
 * 用途：
 *   - INIT 表（虽然每条都幂等，批量更快）
 *   - 同步引擎处理结果时一次性写多张表
 */
export function executeBatch(sqls: string[]): Promise<void> {
  // #ifdef APP-PLUS
  return enqueue(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!dbOpened) {
          return reject(new Error('[sqlite] db not opened'))
        }
        if (!sqls || sqls.length === 0) return resolve()
        // @ts-ignore
        plus.sqlite.executeSql({
          name: getDbAlias(),
          sql: sqls,
          success: () => resolve(),
          fail: (e: any) => {
            const err = new Error(`[sqlite] executeBatch fail: ${e && e.message ? e.message : JSON.stringify(e)}`)
            reject(err)
          }
        })
      })
  )
  // #endif
  // #ifndef APP-PLUS
  return Promise.reject(new Error(OFFLINE_DISABLED_ERR))
  // #endif
}

/**
 * 关闭数据库（一般不调；切账号场景由 db/index.ts 统一处理）。
 */
export function closeDb(): Promise<void> {
  // #ifdef APP-PLUS
  return enqueue(
    () =>
      new Promise<void>((resolve) => {
        // @ts-ignore
        plus.sqlite.closeDatabase({
          name: getDbAlias(),
          success: () => {
            dbOpened = false
            resolve()
          },
          fail: () => {
            dbOpened = false
            resolve()
          }
        })
      })
  )
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve()
  // #endif
}

/**
 * 暴露给 migrations.ts 用的 bound 函数。
 */
export const sqlite = {
  openDb,
  executeSql,
  selectSql,
  executeBatch,
  closeDb
}
