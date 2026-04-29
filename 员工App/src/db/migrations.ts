/**
 * 极简版本控制 + 迁移执行器。
 *
 * 设计：
 *   - schema_version 表只存一行，记录当前版本号
 *   - v1 即跑全部 INIT_SQLS（CREATE TABLE IF NOT EXISTS 是幂等的）
 *   - 后续若加列，按 v2/v3 增量补 SQL；不要回滚
 *
 * runMigrations 不抛错，由调用方处理（见 db/index.ts initDb）
 */
import { INIT_SQLS, SCHEMA_VERSION } from './schema'

export type ExecuteSqlFn = (sql: string, params?: any[]) => Promise<void>
export type SelectSqlFn = (sql: string, params?: any[]) => Promise<any[]>

/**
 * 读当前版本（无表 / 无行均视为 0）。
 */
async function getCurrentVersion(execute: ExecuteSqlFn, select: SelectSqlFn): Promise<number> {
  await execute(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)
  try {
    const rows = await select(`SELECT version FROM schema_version LIMIT 1`)
    if (rows && rows.length > 0) {
      const v = Number(rows[0].version)
      return isNaN(v) ? 0 : v
    }
  } catch (e) {
    return 0
  }
  return 0
}

async function setVersion(execute: ExecuteSqlFn, version: number): Promise<void> {
  await execute(`DELETE FROM schema_version`)
  await execute(`INSERT INTO schema_version (version) VALUES (?)`, [version])
}

/**
 * 跑全部需要的迁移。幂等。
 */
export async function runMigrations(execute: ExecuteSqlFn, select: SelectSqlFn): Promise<void> {
  const current = await getCurrentVersion(execute, select)
  if (current >= SCHEMA_VERSION) return

  // v0 → v1：跑 INIT_SQLS
  if (current < 1) {
    for (const sql of INIT_SQLS) {
      await execute(sql)
    }
  }

  // 未来：if (current < 2) { for (const sql of V2_SQLS) await execute(sql) }

  await setVersion(execute, SCHEMA_VERSION)
}
