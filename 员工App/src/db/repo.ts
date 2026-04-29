/**
 * 本地数据访问层：CRUD 抽象。
 *
 * 同时提供：
 *   - APP-PLUS 走 sqlite.ts 持久化
 *   - H5 / MP 走 in-memory Map fallback（reload 即丢，仅供编译通过 + UI 调试）
 *
 * 重要约定：
 *   - 所有方法第一参数都接收 `actor: { employee_id }`，按 owner_employee_id 隔离
 *   - 业务表主键统一是 client_uuid，不要把外键替换成 server_id
 *   - server_id 反向映射时只更新 server_id 列（参见 setServerId）
 *   - retry_count / next_retry_at / last_error 等都持久化，重启不丢
 */
import { executeSql, selectSql } from './sqlite'
import { isOfflineCapable } from './platform'

export interface Actor {
  employee_id: number
}

const now = (): number => Date.now()

// ============================================================================
// in-memory fallback（H5 / MP 用；APP-PLUS 永远不进这里）
// ============================================================================
const mem = {
  customers: new Map<string, any>(), // client_uuid → row
  followUps: new Map<string, any>(),
  notifications: new Map<number, any>(), // server_id → row
  pendingOps: [] as any[], // 顺序敏感
  pendingOpSeq: 1,
  attachments: new Map<string, any>()
}

function memFilterByOwner<T extends { owner_employee_id?: number }>(items: T[], ownerId: number): T[] {
  return items.filter((r) => r.owner_employee_id === ownerId)
}

// ============================================================================
// customers
// ============================================================================
export const customersRepo = {
  /**
   * upsert：按 client_uuid。dirty 默认置 1（调用方可 row.dirty=0 表示来自服务端拉取的干净数据）。
   */
  async upsert(actor: Actor, row: any): Promise<void> {
    if (!row || !row.client_uuid) throw new Error('[repo.customers.upsert] missing client_uuid')
    const r = {
      client_uuid: String(row.client_uuid),
      server_id: row.server_id || null,
      owner_employee_id: actor.employee_id,
      name: row.name || '',
      phone: row.phone || '',
      gender: row.gender || '',
      age: row.age || null,
      level: row.level || '',
      status: row.status || '',
      source: row.source || '',
      department_id: row.department_id || null,
      next_follow_up_at: row.next_follow_up_at || '',
      next_follow_up_text: row.next_follow_up_text || '',
      remark: row.remark || '',
      extra_json: row.extra_json || (row.extra ? JSON.stringify(row.extra) : ''),
      base_version: row.base_version || '',
      dirty: row.dirty == null ? 1 : (row.dirty ? 1 : 0),
      deleted: row.deleted ? 1 : 0,
      created_at: row.created_at || now(),
      updated_at: now()
    }
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `INSERT OR REPLACE INTO local_customers
        (client_uuid, server_id, owner_employee_id, name, phone, gender, age, level, status, source,
         department_id, next_follow_up_at, next_follow_up_text, remark, extra_json, base_version,
         dirty, deleted, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r.client_uuid, r.server_id, r.owner_employee_id, r.name, r.phone, r.gender, r.age,
          r.level, r.status, r.source, r.department_id, r.next_follow_up_at, r.next_follow_up_text,
          r.remark, r.extra_json, r.base_version, r.dirty, r.deleted, r.created_at, r.updated_at
        ]
      )
      // #endif
    } else {
      mem.customers.set(r.client_uuid, r)
    }
  },

  async list(actor: Actor, _filter?: any): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      return await selectSql(
        `SELECT * FROM local_customers WHERE owner_employee_id=? AND deleted=0 ORDER BY updated_at DESC`,
        [actor.employee_id]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    return memFilterByOwner(Array.from(mem.customers.values()), actor.employee_id).filter((r) => !r.deleted)
  },

  async getByClientUuid(actor: Actor, uuid: string): Promise<any | null> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const rows = await selectSql(
        `SELECT * FROM local_customers WHERE owner_employee_id=? AND client_uuid=? LIMIT 1`,
        [actor.employee_id, uuid]
      )
      return rows && rows.length > 0 ? rows[0] : null
      // #endif
      // #ifndef APP-PLUS
      return null
      // #endif
    }
    const r = mem.customers.get(uuid)
    return r && r.owner_employee_id === actor.employee_id ? r : null
  },

  /**
   * sync ok / duplicate 时**只更新 server_id 列**，不改外键。
   */
  async setServerId(actor: Actor, uuid: string, server_id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_customers SET server_id=?, dirty=0, updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [server_id, now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.customers.get(uuid)
      if (r && r.owner_employee_id === actor.employee_id) {
        r.server_id = server_id
        r.dirty = 0
        r.updated_at = now()
      }
    }
  },

  async removeByClientUuid(actor: Actor, uuid: string): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_customers SET deleted=1, dirty=1, updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.customers.get(uuid)
      if (r && r.owner_employee_id === actor.employee_id) {
        r.deleted = 1
        r.dirty = 1
        r.updated_at = now()
      }
    }
  }
}

// ============================================================================
// followUps
// ============================================================================
export const followUpsRepo = {
  async upsert(actor: Actor, row: any): Promise<void> {
    if (!row || !row.client_uuid) throw new Error('[repo.followUps.upsert] missing client_uuid')
    const r = {
      client_uuid: String(row.client_uuid),
      server_id: row.server_id || null,
      owner_employee_id: actor.employee_id,
      customer_uuid: row.customer_uuid || '',
      customer_server_id: row.customer_server_id || null,
      type: row.type || '',
      result: row.result || '',
      content: row.content || '',
      next_follow_up_at: row.next_follow_up_at || '',
      attachments_json: row.attachments_json || (row.attachments ? JSON.stringify(row.attachments) : ''),
      extra_json: row.extra_json || (row.extra ? JSON.stringify(row.extra) : ''),
      base_version: row.base_version || '',
      dirty: row.dirty == null ? 1 : (row.dirty ? 1 : 0),
      deleted: row.deleted ? 1 : 0,
      created_at: row.created_at || now(),
      updated_at: now()
    }
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `INSERT OR REPLACE INTO local_follow_ups
        (client_uuid, server_id, owner_employee_id, customer_uuid, customer_server_id, type, result,
         content, next_follow_up_at, attachments_json, extra_json, base_version, dirty, deleted,
         created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r.client_uuid, r.server_id, r.owner_employee_id, r.customer_uuid, r.customer_server_id,
          r.type, r.result, r.content, r.next_follow_up_at, r.attachments_json, r.extra_json,
          r.base_version, r.dirty, r.deleted, r.created_at, r.updated_at
        ]
      )
      // #endif
    } else {
      mem.followUps.set(r.client_uuid, r)
    }
  },

  async list(actor: Actor, filter?: { customer_uuid?: string }): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      if (filter && filter.customer_uuid) {
        return await selectSql(
          `SELECT * FROM local_follow_ups WHERE owner_employee_id=? AND customer_uuid=? AND deleted=0 ORDER BY created_at DESC`,
          [actor.employee_id, filter.customer_uuid]
        )
      }
      return await selectSql(
        `SELECT * FROM local_follow_ups WHERE owner_employee_id=? AND deleted=0 ORDER BY created_at DESC`,
        [actor.employee_id]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    let arr = memFilterByOwner(Array.from(mem.followUps.values()), actor.employee_id).filter((r) => !r.deleted)
    if (filter && filter.customer_uuid) arr = arr.filter((r) => r.customer_uuid === filter.customer_uuid)
    return arr
  },

  async getByClientUuid(actor: Actor, uuid: string): Promise<any | null> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const rows = await selectSql(
        `SELECT * FROM local_follow_ups WHERE owner_employee_id=? AND client_uuid=? LIMIT 1`,
        [actor.employee_id, uuid]
      )
      return rows && rows.length > 0 ? rows[0] : null
      // #endif
      // #ifndef APP-PLUS
      return null
      // #endif
    }
    const r = mem.followUps.get(uuid)
    return r && r.owner_employee_id === actor.employee_id ? r : null
  },

  async setServerId(actor: Actor, uuid: string, server_id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_follow_ups SET server_id=?, dirty=0, updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [server_id, now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.followUps.get(uuid)
      if (r && r.owner_employee_id === actor.employee_id) {
        r.server_id = server_id
        r.dirty = 0
        r.updated_at = now()
      }
    }
  },

  async removeByClientUuid(actor: Actor, uuid: string): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_follow_ups SET deleted=1, dirty=1, updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.followUps.get(uuid)
      if (r && r.owner_employee_id === actor.employee_id) {
        r.deleted = 1
        r.dirty = 1
        r.updated_at = now()
      }
    }
  }
}

// ============================================================================
// notifications（缓存最近 200 条）
// ============================================================================
export const notificationsRepo = {
  async upsertMany(actor: Actor, rows: any[]): Promise<void> {
    if (!rows || rows.length === 0) return
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      for (const row of rows) {
        if (!row || !row.id) continue
        await executeSql(
          `INSERT OR REPLACE INTO local_notifications
          (server_id, owner_employee_id, title, body, type, is_read, payload_json, created_at)
          VALUES (?,?,?,?,?,?,?,?)`,
          [
            Number(row.id),
            actor.employee_id,
            row.title || '',
            row.body || row.content || '',
            row.type || '',
            row.is_read ? 1 : 0,
            row.payload ? JSON.stringify(row.payload) : '',
            row.created_at ? new Date(row.created_at).getTime() : now()
          ]
        )
      }
      // 仅保留最新 200 条（按 created_at 降序）
      await executeSql(
        `DELETE FROM local_notifications WHERE owner_employee_id=? AND server_id NOT IN
         (SELECT server_id FROM local_notifications WHERE owner_employee_id=? ORDER BY created_at DESC LIMIT 200)`,
        [actor.employee_id, actor.employee_id]
      )
      // #endif
    } else {
      for (const row of rows) {
        if (!row || !row.id) continue
        mem.notifications.set(Number(row.id), {
          server_id: Number(row.id),
          owner_employee_id: actor.employee_id,
          ...row
        })
      }
    }
  },

  async listRecent(actor: Actor, limit = 50): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      return await selectSql(
        `SELECT * FROM local_notifications WHERE owner_employee_id=? ORDER BY created_at DESC LIMIT ?`,
        [actor.employee_id, limit]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    return memFilterByOwner(Array.from(mem.notifications.values()), actor.employee_id)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit)
  },

  async setRead(actor: Actor, server_id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_notifications SET is_read=1 WHERE owner_employee_id=? AND server_id=?`,
        [actor.employee_id, server_id]
      )
      // #endif
    } else {
      const r = mem.notifications.get(server_id)
      if (r && r.owner_employee_id === actor.employee_id) r.is_read = 1
    }
  }
}

// ============================================================================
// pendingOp：核心同步队列
// ============================================================================
export interface PendingOpRow {
  id?: number
  owner_employee_id: number
  client_uuid: string
  type: string
  op: string
  payload?: any
  base_version?: string
  server_id?: number | null
  status?: string
  retry_count?: number
  next_retry_at?: number
  last_error?: string
  lock_token?: string
  created_at?: number
  updated_at?: number
}

export const pendingOpRepo = {
  /**
   * 入队。client_uuid UNIQUE，重复入队 → INSERT OR IGNORE 静默丢弃（提交锁）。
   */
  async add(actor: Actor, op: PendingOpRow): Promise<void> {
    const r = {
      owner_employee_id: actor.employee_id,
      client_uuid: op.client_uuid,
      type: op.type,
      op: op.op,
      payload: op.payload != null ? (typeof op.payload === 'string' ? op.payload : JSON.stringify(op.payload)) : '',
      base_version: op.base_version || '',
      server_id: op.server_id || null,
      status: op.status || 'pending',
      retry_count: op.retry_count || 0,
      next_retry_at: op.next_retry_at || 0,
      last_error: op.last_error || '',
      lock_token: '',
      created_at: now(),
      updated_at: now()
    }
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `INSERT OR IGNORE INTO pending_op
        (owner_employee_id, client_uuid, type, op, payload, base_version, server_id, status,
         retry_count, next_retry_at, last_error, lock_token, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r.owner_employee_id, r.client_uuid, r.type, r.op, r.payload, r.base_version,
          r.server_id, r.status, r.retry_count, r.next_retry_at, r.last_error, r.lock_token,
          r.created_at, r.updated_at
        ]
      )
      // #endif
    } else {
      // 提交锁：去重
      if (mem.pendingOps.find((x) => x.client_uuid === r.client_uuid)) return
      mem.pendingOps.push({ id: mem.pendingOpSeq++, ...r })
    }
  },

  /**
   * 取 N 条 pending（next_retry_at <= now）。
   * 不做并发控制——调用方在拿到后立刻 markProcessing。
   */
  async takePending(actor: Actor, limit = 20): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const t = now()
      return await selectSql(
        `SELECT * FROM pending_op
         WHERE owner_employee_id=? AND status='pending' AND next_retry_at<=?
         ORDER BY id ASC LIMIT ?`,
        [actor.employee_id, t, limit]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    const t = now()
    return mem.pendingOps
      .filter((r) => r.owner_employee_id === actor.employee_id && r.status === 'pending' && (r.next_retry_at || 0) <= t)
      .slice(0, limit)
  },

  /**
   * pending → processing。带 lock_token，防止重复处理。
   * 返回成功与否（受影响行数）。
   */
  async markProcessing(id: number, lock_token: string): Promise<boolean> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      // 用条件 UPDATE 实现 CAS（status 必须仍是 pending）
      await executeSql(
        `UPDATE pending_op SET status='processing', lock_token=?, updated_at=? WHERE id=? AND status='pending'`,
        [lock_token, now(), id]
      )
      // 验证是否成功（重新查）
      const rows = await selectSql(`SELECT lock_token, status FROM pending_op WHERE id=?`, [id])
      if (!rows || rows.length === 0) return false
      return rows[0].status === 'processing' && rows[0].lock_token === lock_token
      // #endif
      // #ifndef APP-PLUS
      return false
      // #endif
    }
    const r = mem.pendingOps.find((x) => x.id === id)
    if (!r || r.status !== 'pending') return false
    r.status = 'processing'
    r.lock_token = lock_token
    r.updated_at = now()
    return true
  },

  async markOk(id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='ok', last_error='', updated_at=? WHERE id=?`,
        [now(), id]
      )
      // 也可直接删除已 ok 的 op，保留历史更利于排查
      // #endif
    } else {
      const r = mem.pendingOps.find((x) => x.id === id)
      if (r) {
        r.status = 'ok'
        r.last_error = ''
        r.updated_at = now()
      }
    }
  },

  /**
   * 失败：递增 retry_count，写 next_retry_at；超过 MAX_RETRY 由调用方改用 markDeadLetter。
   */
  async markFailed(id: number, err: string, nextRetryAt: number, retryCount: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='pending', last_error=?, retry_count=?, next_retry_at=?, lock_token='', updated_at=? WHERE id=?`,
        [err, retryCount, nextRetryAt, now(), id]
      )
      // #endif
    } else {
      const r = mem.pendingOps.find((x) => x.id === id)
      if (r) {
        r.status = 'pending'
        r.last_error = err
        r.retry_count = retryCount
        r.next_retry_at = nextRetryAt
        r.lock_token = ''
        r.updated_at = now()
      }
    }
  },

  async markDeadLetter(id: number, err: string): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='dead_letter', last_error=?, lock_token='', updated_at=? WHERE id=?`,
        [err, now(), id]
      )
      // #endif
    } else {
      const r = mem.pendingOps.find((x) => x.id === id)
      if (r) {
        r.status = 'dead_letter'
        r.last_error = err
        r.lock_token = ''
        r.updated_at = now()
      }
    }
  },

  /**
   * 冲突：单条 op 标 conflict，引擎继续处理其他 op。
   * current 是服务端最新状态（payload + version），UI 用来 diff。
   */
  async markConflict(id: number, current: any): Promise<void> {
    const data = current ? JSON.stringify(current) : ''
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='conflict', last_error=?, lock_token='', updated_at=? WHERE id=?`,
        [data, now(), id]
      )
      // #endif
    } else {
      const r = mem.pendingOps.find((x) => x.id === id)
      if (r) {
        r.status = 'conflict'
        r.last_error = data
        r.lock_token = ''
        r.updated_at = now()
      }
    }
  },

  /**
   * 启动时把残留 processing → pending（崩溃恢复）。
   */
  async resetProcessing(actor: Actor): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='pending', lock_token='', updated_at=? WHERE owner_employee_id=? AND status='processing'`,
        [now(), actor.employee_id]
      )
      // #endif
    } else {
      mem.pendingOps
        .filter((r) => r.owner_employee_id === actor.employee_id && r.status === 'processing')
        .forEach((r) => {
          r.status = 'pending'
          r.lock_token = ''
        })
    }
  },

  async countByOwner(actor: Actor, status?: string): Promise<number> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const sql = status
        ? `SELECT COUNT(*) AS c FROM pending_op WHERE owner_employee_id=? AND status=?`
        : `SELECT COUNT(*) AS c FROM pending_op WHERE owner_employee_id=? AND status IN ('pending','processing')`
      const params = status ? [actor.employee_id, status] : [actor.employee_id]
      const rows = await selectSql(sql, params)
      return rows && rows[0] ? Number(rows[0].c || 0) : 0
      // #endif
      // #ifndef APP-PLUS
      return 0
      // #endif
    }
    const arr = mem.pendingOps.filter((r) => r.owner_employee_id === actor.employee_id)
    if (status) return arr.filter((r) => r.status === status).length
    return arr.filter((r) => r.status === 'pending' || r.status === 'processing').length
  },

  async listAll(actor: Actor): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      return await selectSql(
        `SELECT * FROM pending_op WHERE owner_employee_id=? ORDER BY id ASC`,
        [actor.employee_id]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    return mem.pendingOps.filter((r) => r.owner_employee_id === actor.employee_id).slice()
  },

  async getById(id: number): Promise<any | null> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const rows = await selectSql(`SELECT * FROM pending_op WHERE id=? LIMIT 1`, [id])
      return rows && rows.length > 0 ? rows[0] : null
      // #endif
      // #ifndef APP-PLUS
      return null
      // #endif
    }
    return mem.pendingOps.find((r) => r.id === id) || null
  },

  async deleteById(id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(`DELETE FROM pending_op WHERE id=?`, [id])
      // #endif
    } else {
      const idx = mem.pendingOps.findIndex((r) => r.id === id)
      if (idx >= 0) mem.pendingOps.splice(idx, 1)
    }
  },

  /**
   * 切账号：清空当前账号 pending（仅当显式调用 clearAll）。
   * 注意 auth.clear() **不**调这个。
   */
  async clearByOwner(actor: Actor): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(`DELETE FROM pending_op WHERE owner_employee_id=?`, [actor.employee_id])
      // #endif
    } else {
      mem.pendingOps = mem.pendingOps.filter((r) => r.owner_employee_id !== actor.employee_id)
    }
  },

  /**
   * 把 retry/failed 状态重置为 pending，立即可被 takePending 取出。
   */
  async resetForRetry(id: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE pending_op SET status='pending', next_retry_at=0, last_error='', lock_token='', updated_at=? WHERE id=?`,
        [now(), id]
      )
      // #endif
    } else {
      const r = mem.pendingOps.find((x) => x.id === id)
      if (r) {
        r.status = 'pending'
        r.next_retry_at = 0
        r.last_error = ''
        r.lock_token = ''
        r.updated_at = now()
      }
    }
  }
}

// ============================================================================
// attachments
// ============================================================================
export const attachmentsRepo = {
  async add(actor: Actor, row: any): Promise<void> {
    if (!row || !row.client_uuid) throw new Error('[repo.attachments.add] missing client_uuid')
    const r = {
      client_uuid: row.client_uuid,
      owner_employee_id: actor.employee_id,
      local_path: row.local_path || '',
      server_id: row.server_id || null,
      server_url: row.server_url || '',
      ref_type: row.ref_type || '',
      ref_client_uuid: row.ref_client_uuid || '',
      status: row.status || 'pending',
      retry_count: row.retry_count || 0,
      last_error: row.last_error || '',
      created_at: now(),
      updated_at: now()
    }
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `INSERT OR REPLACE INTO local_attachment
        (client_uuid, owner_employee_id, local_path, server_id, server_url, ref_type, ref_client_uuid,
         status, retry_count, last_error, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r.client_uuid, r.owner_employee_id, r.local_path, r.server_id, r.server_url, r.ref_type,
          r.ref_client_uuid, r.status, r.retry_count, r.last_error, r.created_at, r.updated_at
        ]
      )
      // #endif
    } else {
      mem.attachments.set(r.client_uuid, r)
    }
  },

  async setUploaded(actor: Actor, uuid: string, server_id: number, server_url: string): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_attachment SET status='ok', server_id=?, server_url=?, last_error='', updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [server_id, server_url, now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.attachments.get(uuid)
      if (r) {
        r.status = 'ok'
        r.server_id = server_id
        r.server_url = server_url
        r.last_error = ''
        r.updated_at = now()
      }
    }
  },

  async setFailed(actor: Actor, uuid: string, err: string, retryCount: number): Promise<void> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      await executeSql(
        `UPDATE local_attachment SET status='failed', last_error=?, retry_count=?, updated_at=? WHERE owner_employee_id=? AND client_uuid=?`,
        [err, retryCount, now(), actor.employee_id, uuid]
      )
      // #endif
    } else {
      const r = mem.attachments.get(uuid)
      if (r) {
        r.status = 'failed'
        r.last_error = err
        r.retry_count = retryCount
        r.updated_at = now()
      }
    }
  },

  async listPending(actor: Actor): Promise<any[]> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      return await selectSql(
        `SELECT * FROM local_attachment WHERE owner_employee_id=? AND status IN ('pending','failed') ORDER BY created_at ASC`,
        [actor.employee_id]
      )
      // #endif
      // #ifndef APP-PLUS
      return []
      // #endif
    }
    return Array.from(mem.attachments.values()).filter(
      (r) => r.owner_employee_id === actor.employee_id && (r.status === 'pending' || r.status === 'failed')
    )
  },

  async getByClientUuid(actor: Actor, uuid: string): Promise<any | null> {
    if (isOfflineCapable()) {
      // #ifdef APP-PLUS
      const rows = await selectSql(
        `SELECT * FROM local_attachment WHERE owner_employee_id=? AND client_uuid=? LIMIT 1`,
        [actor.employee_id, uuid]
      )
      return rows && rows.length > 0 ? rows[0] : null
      // #endif
      // #ifndef APP-PLUS
      return null
      // #endif
    }
    const r = mem.attachments.get(uuid)
    return r && r.owner_employee_id === actor.employee_id ? r : null
  }
}

// ============================================================================
// 统一导出
// ============================================================================
export const repo = {
  customers: customersRepo,
  followUps: followUpsRepo,
  notifications: notificationsRepo,
  pendingOp: pendingOpRepo,
  attachments: attachmentsRepo
}

export default repo
