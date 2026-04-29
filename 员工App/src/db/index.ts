/**
 * DB 统一入口。
 *
 * 用法：
 *   import { initDb, repo } from '@/db'
 *   await initDb({ employee_id })
 *   await repo.customers.upsert(actor, row)
 */
import { isOfflineCapable } from './platform'
import { sqlite } from './sqlite'
import { runMigrations } from './migrations'

export * from './platform'
export * from './schema'
export { sqlite }
export { repo, default as repoDefault } from './repo'
export type { Actor, PendingOpRow } from './repo'

let inited = false

/**
 * 启动初始化：打开 db、跑 migrations。幂等。
 *
 * H5 / MP（!isOfflineCapable）→ 直接返回，留给 in-memory fallback。
 *
 * 不抛错给页面：失败时 console.error 但不 throw（避免阻塞登录流程）。
 */
export async function initDb(): Promise<void> {
  if (inited) return
  if (!isOfflineCapable()) {
    inited = true
    return
  }
  try {
    await sqlite.openDb()
    await runMigrations(
      (sql, params) => sqlite.executeSql(sql, params),
      (sql, params) => sqlite.selectSql(sql, params)
    )
    inited = true
  } catch (e) {
    console.error('[db] initDb failed', e)
    // 不 rethrow；保留 inited=false 让下次调用重试
  }
}

/**
 * 仅给测试 / 切账号用：把 init 标志重置（不删数据）。
 */
export function _resetInited() {
  inited = false
}
