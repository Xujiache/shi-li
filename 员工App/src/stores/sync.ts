/**
 * 同步引擎核心状态机（Pinia store）。
 *
 * 关键设计（Plan B 报告锁定）：
 *   - 单 boolean 不够：op 取出时 status pending → processing + lock_token
 *   - 启动时把残留 processing 重置为 pending（崩溃恢复）
 *   - 退避用 next_retry_at 字段而非 setTimeout 链
 *   - retry_count 持久化（重启不归零）
 *   - 冲突 op 不阻塞其他 op：单条 conflict 标 status='conflict' 继续
 *   - 附件懒上传两阶段：先 attachment_upload，再业务 op
 *   - sync 批次按依赖排序：attachment_upload → customer.create → follow_up.create → 其余 update/delete
 *   - 5 个时机统一调 kick(reason)：app launch / login / network online / 30s poll / 用户手动
 *   - 并发：syncing 标志 + dirty 再次触发；不允许两个 processOnce 并跑
 *   - 错误处理：内部 try/catch，不抛错给页面
 *
 * State：
 *   state: idle | syncing | failed
 *   pendingCount / conflictCount / lastSyncAt / lastError
 */
import { defineStore } from 'pinia'
import { repo, type Actor } from '@/db'
import { submitBatch, SYNC_BATCH_MAX, type SyncOp, type SyncResult } from '@/api/sync'
import { isReallyOnline } from '@/utils/network'
import { nextRetryAt, MAX_RETRY } from '@/utils/retry'
import { uploadImage } from '@/api/upload'
import { v4 as uuidv4 } from '@/utils/uuid'

export type SyncState = 'idle' | 'syncing' | 'failed'

interface SyncStoreState {
  state: SyncState
  pendingCount: number
  conflictCount: number
  lastSyncAt: number
  lastError: string
  /** 当前登录员工（init 时记下；登出后保留以便 refresh count 仍按上次 owner） */
  currentActor: Actor | null
  /** 内部：在跑期间又被 kick → 标 dirty 让本轮收尾后再跑一次 */
  dirty: boolean
  /** 30s 轮询 timer id */
  pollTimer: any
}

const POLL_INTERVAL_MS = 30 * 1000

/**
 * 排序权重：先附件，再业务 create，最后 update/delete。
 * 同权重内按 id ASC（保持 FIFO）。
 */
function opPriority(row: any): number {
  if (row.type === 'attachment_upload') return 0
  const op = String(row.op || '').toLowerCase()
  if (op === 'create') {
    if (row.type === 'customer') return 1
    if (row.type === 'follow_up') return 2
    return 3
  }
  return 4
}

function sortOps(rows: any[]): any[] {
  return rows.slice().sort((a, b) => {
    const pa = opPriority(a)
    const pb = opPriority(b)
    if (pa !== pb) return pa - pb
    return (a.id || 0) - (b.id || 0)
  })
}

/**
 * 把 payload 中 attachments（client_uuid 数组）替换为已上传的 server_id 数组。
 * 未上传成功的占位会被剔除（避免脏数据）。
 */
async function resolveAttachments(actor: Actor, payload: any): Promise<any> {
  if (!payload || typeof payload !== 'object') return payload
  if (!Array.isArray(payload.attachments) || payload.attachments.length === 0) return payload
  const resolved: any[] = []
  for (const item of payload.attachments) {
    // 已是数字 server_id（来自服务端拉取）→ 透传
    if (typeof item === 'number') {
      resolved.push({ upload_id: item })
      continue
    }
    // 字符串：当 client_uuid 处理
    if (typeof item === 'string') {
      const att = await repo.attachments.getByClientUuid(actor, item)
      if (att && att.status === 'ok' && att.server_id) {
        resolved.push({ upload_id: att.server_id, file_type: att.ref_type === 'follow_up' ? 'image' : 'image' })
      }
      // 未上传成功 → 跳过（业务 op 不应该等附件，引擎已用排序保证附件先 ok）
      continue
    }
    // 对象：含 upload_id 透传，含 client_uuid 解析
    if (item && typeof item === 'object') {
      if (item.upload_id) {
        resolved.push(item)
        continue
      }
      if (item.client_uuid) {
        const att = await repo.attachments.getByClientUuid(actor, item.client_uuid)
        if (att && att.status === 'ok' && att.server_id) {
          resolved.push({ ...item, upload_id: att.server_id })
        }
      }
    }
  }
  return { ...payload, attachments: resolved }
}

export const useSyncStore = defineStore('sync', {
  state: (): SyncStoreState => ({
    state: 'idle',
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: 0,
    lastError: '',
    currentActor: null,
    dirty: false,
    pollTimer: null
  }),

  getters: {
    isSyncing: (s) => s.state === 'syncing',
    hasPending: (s) => s.pendingCount > 0,
    hasConflict: (s) => s.conflictCount > 0
  },

  actions: {
    /**
     * 启动时调（auth.bootstrap 后 + login 后）。
     * 把残留 processing 重置为 pending；刷新计数。
     */
    async init(actor: Actor) {
      this.currentActor = { employee_id: actor.employee_id }
      try {
        await repo.pendingOp.resetProcessing(this.currentActor)
      } catch (e) {
        console.warn('[sync.init] resetProcessing failed', e)
      }
      await this.refreshCounts(this.currentActor)
      // 启动 30s 轮询（仅 1 次）
      if (!this.pollTimer) {
        this.pollTimer = setInterval(() => {
          this.kick('poll')
        }, POLL_INTERVAL_MS)
      }
    },

    /**
     * 5 个时机统一入口：app launch / login / network online / 30s poll / 用户手动。
     * 并发：当前在跑则只标 dirty；本轮收尾后再触发一次。
     */
    kick(_reason: string = 'manual') {
      if (!this.currentActor) return
      if (this.state === 'syncing') {
        this.dirty = true
        return
      }
      // 异步触发，不 await（避免堵塞调用方）
      this.processOnce().catch((e) => {
        console.warn('[sync.kick] processOnce threw', e)
      })
    },

    /**
     * 处理一轮：取 N 条 pending → 排序 → 拆 attachment / 批量 → 写回结果。
     * 失败容错：单条失败不影响其他；整轮失败不抛给调用方。
     */
    async processOnce() {
      if (!this.currentActor) return
      if (this.state === 'syncing') {
        this.dirty = true
        return
      }
      this.state = 'syncing'
      this.dirty = false

      const actor = this.currentActor
      try {
        // 网络探活：完全离线就什么也不做（保留 pending 等下次）
        const online = await isReallyOnline()
        if (!online) {
          this.state = 'idle'
          return
        }

        const rows = await repo.pendingOp.takePending(actor, SYNC_BATCH_MAX * 2) // 多取一些便于排序后取头部
        if (!rows || rows.length === 0) {
          this.state = 'idle'
          this.lastSyncAt = Date.now()
          await this.refreshCounts(actor)
          return
        }

        const sorted = sortOps(rows)

        // 1) 处理 attachment_upload（逐条，独立请求）
        const businessOps: any[] = []
        for (const row of sorted) {
          if (row.type === 'attachment_upload') {
            await this.handleAttachmentOp(actor, row)
          } else {
            businessOps.push(row)
            if (businessOps.length >= SYNC_BATCH_MAX) break
          }
        }

        // 2) 批量提交业务 op
        if (businessOps.length > 0) {
          await this.handleBusinessBatch(actor, businessOps)
        }

        this.lastSyncAt = Date.now()
        this.state = 'idle'
        await this.refreshCounts(actor)
      } catch (e: any) {
        this.state = 'failed'
        this.lastError = (e && e.message) ? e.message : String(e || 'sync error')
        console.warn('[sync.processOnce] failed', e)
      }

      // 本轮中又被 kick → 立刻再跑一次
      if (this.dirty) {
        this.dirty = false
        // 微任务延迟，避免栈深
        Promise.resolve().then(() => this.kick('dirty'))
      }
    },

    /**
     * 处理单条 attachment_upload op。
     */
    async handleAttachmentOp(actor: Actor, row: any) {
      const lockToken = uuidv4()
      const claimed = await repo.pendingOp.markProcessing(row.id, lockToken)
      if (!claimed) return // 已被另一进程拿走（理论不会发生，除非异常）

      try {
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {})
        const localPath = payload.local_path
        if (!localPath) {
          await repo.pendingOp.markDeadLetter(row.id, 'attachment missing local_path')
          return
        }

        const r = await uploadImage(localPath)
        const serverId = (r as any)?.id || (r as any)?.upload_id || 0
        const serverUrl = (r as any)?.url || ''

        // 写 attachment 表（client_uuid 与 pending_op.client_uuid 同值）
        await repo.attachments.setUploaded(actor, row.client_uuid, Number(serverId) || 0, serverUrl)
        await repo.pendingOp.markOk(row.id)
      } catch (e: any) {
        const errMsg = e && e.message ? e.message : String(e || 'upload failed')
        const newRetry = (row.retry_count || 0) + 1
        if (newRetry >= MAX_RETRY) {
          await repo.pendingOp.markDeadLetter(row.id, errMsg)
          await repo.attachments.setFailed(actor, row.client_uuid, errMsg, newRetry)
        } else {
          await repo.pendingOp.markFailed(row.id, errMsg, nextRetryAt(newRetry), newRetry)
          await repo.attachments.setFailed(actor, row.client_uuid, errMsg, newRetry)
        }
      }
    },

    /**
     * 批量处理业务 op：一次 /sync/batch 调用，按 result 写回。
     */
    async handleBusinessBatch(actor: Actor, rows: any[]) {
      // claim：把每条都标 processing（带 lock_token）
      const claimed: any[] = []
      for (const row of rows) {
        const lockToken = uuidv4()
        const ok = await repo.pendingOp.markProcessing(row.id, lockToken)
        if (ok) claimed.push({ ...row, lock_token: lockToken })
      }
      if (claimed.length === 0) return

      // 构造 SyncOp envelope：解析 attachments 占位、解析 customer_uuid → server_id 映射
      const ops: SyncOp[] = []
      for (const row of claimed) {
        let payload = row.payload
        try {
          payload = typeof payload === 'string' ? JSON.parse(payload || '{}') : (payload || {})
        } catch (e) {
          payload = {}
        }
        // attachments 占位替换
        payload = await resolveAttachments(actor, payload)
        // customer_uuid → customer_id（follow_up 提交时需要 customer_id）
        if (row.type === 'follow_up' && payload && payload.customer_uuid && !payload.customer_id) {
          const c = await repo.customers.getByClientUuid(actor, payload.customer_uuid)
          if (c && c.server_id) payload.customer_id = c.server_id
        }

        ops.push({
          op: row.op,
          type: row.type,
          client_uuid: row.client_uuid,
          base_version: row.base_version || undefined,
          server_id: row.server_id || undefined,
          payload
        })
      }

      let results: SyncResult[] = []
      try {
        const r = await submitBatch(ops)
        results = r.results || []
      } catch (e: any) {
        // 整批网络/服务器错误：把 claimed 全部回滚为 pending（带退避）
        const errMsg = e && e.message ? e.message : String(e || 'network')
        for (const row of claimed) {
          const newRetry = (row.retry_count || 0) + 1
          if (newRetry >= MAX_RETRY) {
            await repo.pendingOp.markDeadLetter(row.id, errMsg)
          } else {
            await repo.pendingOp.markFailed(row.id, errMsg, nextRetryAt(newRetry), newRetry)
          }
        }
        this.lastError = errMsg
        return
      }

      // 按 client_uuid 索引 results
      const byUuid = new Map<string, SyncResult>()
      for (const r of results) {
        if (r && r.client_uuid) byUuid.set(r.client_uuid, r)
      }

      // 写回每条
      for (const row of claimed) {
        const r = byUuid.get(row.client_uuid)
        if (!r) {
          // 服务端没返回该 op 的结果（不应该发生）→ 标失败重试
          const newRetry = (row.retry_count || 0) + 1
          if (newRetry >= MAX_RETRY) {
            await repo.pendingOp.markDeadLetter(row.id, 'no result from server')
          } else {
            await repo.pendingOp.markFailed(row.id, 'no result from server', nextRetryAt(newRetry), newRetry)
          }
          continue
        }
        await this.applyResult(actor, row, r)
      }
    },

    /**
     * 把单条 SyncResult 写回本地：更新 server_id / 标 ok / conflict / dead_letter。
     */
    async applyResult(actor: Actor, row: any, r: SyncResult) {
      const status = r.status
      if (status === 'ok' || status === 'duplicate') {
        // 反向映射：仅更新 server_id 列，不改外键
        if (r.server_id) {
          if (row.type === 'customer') {
            await repo.customers.setServerId(actor, row.client_uuid, r.server_id)
          } else if (row.type === 'follow_up') {
            await repo.followUps.setServerId(actor, row.client_uuid, r.server_id)
          }
        }
        await repo.pendingOp.markOk(row.id)
        return
      }

      if (status === 'conflict') {
        await repo.pendingOp.markConflict(row.id, {
          current_payload: r.current_payload,
          current_version: r.current_version,
          errors: r.errors
        })
        return
      }

      if (status === 'validation_failed' || status === 'forbidden' || status === 'not_found') {
        // 客户端 bug 类错误，重试也无意义 → 直接 dead_letter
        await repo.pendingOp.markDeadLetter(row.id, (r.errors && r.errors.join('; ')) || status)
        return
      }

      // 其他（'error' 等）→ 退避重试
      const errMsg = (r.errors && r.errors.join('; ')) || 'server error'
      const newRetry = (row.retry_count || 0) + 1
      if (newRetry >= MAX_RETRY) {
        await repo.pendingOp.markDeadLetter(row.id, errMsg)
      } else {
        await repo.pendingOp.markFailed(row.id, errMsg, nextRetryAt(newRetry), newRetry)
      }
    },

    /**
     * 用户手动重试单条 dead_letter。
     */
    async retryDeadLetter(opId: number) {
      try {
        await repo.pendingOp.resetForRetry(opId)
        if (this.currentActor) await this.refreshCounts(this.currentActor)
        this.kick('manual_retry')
      } catch (e) {
        console.warn('[sync.retryDeadLetter] failed', e)
      }
    },

    /**
     * 用户手动删除单条（不再重试）。
     */
    async dropDeadLetter(opId: number) {
      try {
        await repo.pendingOp.deleteById(opId)
        if (this.currentActor) await this.refreshCounts(this.currentActor)
      } catch (e) {
        console.warn('[sync.dropDeadLetter] failed', e)
      }
    },

    /**
     * 切账号场景：清空当前员工所有 pending（不影响其他员工）。
     * 注意：auth.clear() **不**调这个；显式调用才清。
     */
    async clearAll(actor: Actor) {
      try {
        await repo.pendingOp.clearByOwner(actor)
        await this.refreshCounts(actor)
      } catch (e) {
        console.warn('[sync.clearAll] failed', e)
      }
    },

    /**
     * 刷新 pendingCount / conflictCount。UI 用。
     */
    async refreshCounts(actor: Actor) {
      try {
        const pending = await repo.pendingOp.countByOwner(actor) // pending + processing
        const conflict = await repo.pendingOp.countByOwner(actor, 'conflict')
        this.pendingCount = pending
        this.conflictCount = conflict
      } catch (e) {
        // 静默
      }
    },

    /**
     * 登出 / store reset 调；**不删 pending_op**。
     */
    reset() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      this.state = 'idle'
      this.pendingCount = 0
      this.conflictCount = 0
      this.lastSyncAt = 0
      this.lastError = ''
      this.currentActor = null
      this.dirty = false
    }
  }
})
