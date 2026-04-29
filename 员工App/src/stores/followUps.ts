/**
 * 跟进记录 store：单一入口判 online/offline。
 * 与 customers store 一致风格：
 *   - createFollowUp / updateFollowUp 走在线或离线 + pending_op
 *   - deleteFollowUp 仅在线（与 customers.delete 同策略）
 *   - 附件懒上传：把 attachments_local_paths 在 store 内部转成 attachment client_uuid 数组
 */
import { defineStore } from 'pinia'
import * as followUpApi from '@/api/followUp'
import { repo } from '@/db'
import { isOfflineCapable } from '@/db/platform'
import { isReallyOnline } from '@/utils/network'
import { v4 as uuidv4 } from '@/utils/uuid'
import { uploadImageDeferred } from '@/api/uploadDeferred'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

export interface FollowUpFilters {
  customer_id?: number | string
  type?: string
  result?: string
  q?: string
  start_date?: string
  end_date?: string
}

function getActor(): { employee_id: number } | null {
  try {
    const sync = useSyncStore()
    if (sync.currentActor && sync.currentActor.employee_id) return sync.currentActor
  } catch (e) { /* */ }
  try {
    const auth = useAuthStore()
    if (auth.employee && auth.employee.id) return { employee_id: auth.employee.id }
  } catch (e) { /* */ }
  return null
}

async function shouldUseOffline(): Promise<boolean> {
  if (!isOfflineCapable()) return false
  try {
    const online = await isReallyOnline()
    return !online
  } catch (e) {
    return true
  }
}

export const useFollowUpsStore = defineStore('followUps', {
  state: () => ({
    list: [] as any[],
    total: 0 as number,
    page: 1 as number,
    page_size: 20 as number,
    loading: false as boolean,
    finished: false as boolean,
    filters: {} as FollowUpFilters
  }),
  actions: {
    setFilters(patch: Partial<FollowUpFilters>) {
      this.filters = { ...this.filters, ...patch }
    },
    async refresh(filters?: FollowUpFilters) {
      if (filters) this.filters = { ...this.filters, ...filters }
      if (this.loading) return
      this.loading = true
      try {
        const offline = await shouldUseOffline()
        const actor = getActor()
        if (offline) {
          if (actor) {
            const local = await repo.followUps.list(
              actor,
              this.filters.customer_id ? { customer_uuid: String(this.filters.customer_id) } : undefined
            )
            this.list = (local || []).map((r) => ({ ...r, id: r.client_uuid, __pending: !r.server_id }))
            this.total = this.list.length
          } else {
            this.list = []
            this.total = 0
          }
          this.page = 1
          this.finished = true
          return
        }
        const data = await followUpApi.list({
          page: 1,
          page_size: this.page_size,
          customer_id: this.filters.customer_id,
          type: this.filters.type,
          result: this.filters.result,
          q: (this.filters as any).q,
          start_date: (this.filters as any).start_date,
          end_date: (this.filters as any).end_date
        } as any)
        this.list = (data?.items || []) as any[]
        this.total = data?.total || 0
        this.page = 1
        this.finished = this.list.length >= this.total
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      if (this.loading || this.finished) return
      this.loading = true
      try {
        const offline = await shouldUseOffline()
        if (offline) { this.finished = true; return }
        const next = this.page + 1
        const data = await followUpApi.list({
          page: next,
          page_size: this.page_size,
          customer_id: this.filters.customer_id,
          type: this.filters.type,
          result: this.filters.result,
          q: (this.filters as any).q,
          start_date: (this.filters as any).start_date,
          end_date: (this.filters as any).end_date
        } as any)
        const items = (data?.items || []) as any[]
        this.list = this.list.concat(items)
        this.total = data?.total || this.total
        this.page = next
        this.finished = this.list.length >= this.total
      } finally {
        this.loading = false
      }
    },
    /**
     * 创建跟进。payload 内可传：
     *   - attachments: [{url,name,...}]（在线已上传）
     *   - attachments_local_paths: string[]（待上传 local path）
     * 离线时 local paths 通过 uploadImageDeferred 转为 attachment client_uuid 占位。
     */
    async createFollowUp(payload: any, opts?: { uuid?: string }) {
      const client_uuid = opts?.uuid || payload?.client_uuid || uuidv4()
      const offline = await shouldUseOffline()
      const actor = getActor()

      const localPaths: string[] = Array.isArray(payload?.attachments_local_paths)
        ? payload.attachments_local_paths.slice()
        : []
      const body: any = { ...payload, client_uuid }
      delete body.attachments_local_paths

      if (!offline) {
        // 在线：localPaths 留给页面或上层处理（页面在选图时已通过 uploadImage 上传过 → attachments 直接传服务端 url 数组）
        // 兼容情况：若仍有 localPaths（H5 等），简单用 deferred 流程提交
        if (localPaths.length > 0 && actor) {
          const ids: string[] = []
          for (const fp of localPaths) {
            const aid = uploadImageDeferred(actor, {
              localPath: fp, refClientUuid: client_uuid, refType: 'follow_up'
            })
            ids.push(aid)
          }
          body.attachments = (body.attachments || []).concat(ids)
        }
        const res: any = await followUpApi.create(body)
        const created = res?.follow_up || res
        if (created) this.list = [created, ...this.list]
        return { id: created?.id || res?.server_id, client_uuid, status: 'ok' as const }
      }

      if (!actor) throw new Error('未登录，无法离线创建跟进')

      // 离线：把 local paths 入 attachment 队列，并在 payload.attachments 用 client_uuid 占位
      const attachmentUuids: string[] = []
      for (const fp of localPaths) {
        const aid = uploadImageDeferred(actor, {
          localPath: fp, refClientUuid: client_uuid, refType: 'follow_up'
        })
        attachmentUuids.push(aid)
      }
      const finalPayload: any = {
        ...body,
        attachments: [
          ...(Array.isArray(body.attachments) ? body.attachments : []),
          ...attachmentUuids
        ]
      }

      // 写本地 follow_up（按 customer_id 反查 customer_uuid 不一定有，先存 customer_id）
      let customer_uuid = ''
      let customer_server_id: number | null = null
      if (finalPayload.customer_id) {
        if (typeof finalPayload.customer_id === 'string' && /^[0-9a-f-]{36}$/i.test(finalPayload.customer_id)) {
          customer_uuid = finalPayload.customer_id
        } else {
          customer_server_id = Number(finalPayload.customer_id) || null
        }
      }

      await repo.followUps.upsert(actor, {
        client_uuid,
        customer_uuid,
        customer_server_id,
        type: finalPayload.type || '',
        result: finalPayload.result || '',
        content: finalPayload.content || '',
        next_follow_up_at: finalPayload.next_follow_up_at || '',
        attachments: finalPayload.attachments,
        extra: finalPayload,
        dirty: 1
      })
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'follow_up',
        op: 'create',
        payload: finalPayload
      })
      try { useSyncStore().kick('user_action') } catch (e) { /* */ }
      this.list = [{
        id: client_uuid,
        client_uuid,
        type: finalPayload.type,
        result: finalPayload.result,
        content: finalPayload.content,
        customer_id: finalPayload.customer_id,
        next_follow_up_at: finalPayload.next_follow_up_at,
        attachments: finalPayload.attachments,
        __pending: true
      }, ...this.list]
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
      return { client_uuid, status: 'queued' as const }
    },
    async updateFollowUp(id: number | string, patch: any, opts?: { client_uuid?: string; base_version?: string }) {
      const offline = await shouldUseOffline()
      const actor = getActor()

      if (!offline) {
        const r = await followUpApi.update(id, patch)
        if (r) {
          const idx = this.list.findIndex((x) => String(x?.id) === String(id))
          if (idx >= 0) this.list[idx] = { ...this.list[idx], ...r }
        }
        return { id, status: 'ok' as const }
      }

      if (!actor) throw new Error('未登录，无法离线更新跟进')
      const client_uuid = opts?.client_uuid || uuidv4()
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'follow_up',
        op: 'update',
        server_id: typeof id === 'string' ? Number(id) || null : id,
        base_version: opts?.base_version,
        payload: { ...patch, id }
      })
      try { useSyncStore().kick('user_action') } catch (e) { /* */ }
      const idx = this.list.findIndex((x) => String(x?.id) === String(id))
      if (idx >= 0) this.list[idx] = { ...this.list[idx], ...patch, __pending: true }
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
      return { id, client_uuid, status: 'queued' as const }
    },
    /** 跟进删除仅在线（与 customers 同策略） */
    async deleteFollowUp(id: number | string) {
      const offline = await shouldUseOffline()
      if (offline) {
        uni.showToast({ title: '请连网后再删除', icon: 'none' })
        return { id, status: 'rejected' as const }
      }
      await followUpApi.remove(id)
      const idx = this.list.findIndex((x) => String(x?.id) === String(id))
      if (idx >= 0) this.list.splice(idx, 1)
      this.total = Math.max(0, this.total - 1)
      return { id, status: 'ok' as const }
    },
    reset() {
      this.list = []
      this.total = 0
      this.page = 1
      this.loading = false
      this.finished = false
      this.filters = {}
    }
  }
})
