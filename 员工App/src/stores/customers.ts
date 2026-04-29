import { defineStore } from 'pinia'
import * as customerApi from '@/api/customer'
import { repo } from '@/db'
import { isOfflineCapable } from '@/db/platform'
import { isReallyOnline } from '@/utils/network'
import { v4 as uuidv4 } from '@/utils/uuid'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

export interface CustomerFilters {
  q: string
  status: string
  level: string
}

/**
 * 取出当前 actor。currentActor 是 sync 启动时记下的；
 * 万一未初始化则退回 auth.employee.id（兜底）。
 */
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

/**
 * 当前能否走在线路径：APP-离线能力存在时再做 isReallyOnline 探活；
 * 不具备离线能力（H5/MP）的环境永远视为在线（保留旧行为）。
 */
async function shouldUseOffline(): Promise<boolean> {
  if (!isOfflineCapable()) return false
  try {
    const online = await isReallyOnline()
    return !online
  } catch (e) {
    return true // 探活异常按离线处理
  }
}

export const useCustomersStore = defineStore('customers', {
  state: () => ({
    list: [] as any[],
    total: 0 as number,
    page: 1 as number,
    page_size: 20 as number,
    loading: false as boolean,
    finished: false as boolean,
    filters: { q: '', status: '', level: '' } as CustomerFilters
  }),
  actions: {
    setFilters(patch: Partial<CustomerFilters>) {
      this.filters = { ...this.filters, ...patch }
    },
    /** 重新加载第一页（在线时合并本地未同步条目） */
    async refresh() {
      if (this.loading) return
      this.loading = true
      try {
        const offline = await shouldUseOffline()
        const actor = getActor()
        if (offline) {
          // 离线：直接读本地
          if (actor) {
            const local = await repo.customers.list(actor)
            this.list = (local || []).map((r) => ({ ...r, __pending: !r.server_id }))
            this.total = this.list.length
          } else {
            this.list = []
            this.total = 0
          }
          this.page = 1
          this.finished = true
          return
        }
        const data = await customerApi.list({
          page: 1,
          page_size: this.page_size,
          q: this.filters.q || undefined,
          status: this.filters.status || undefined,
          level: this.filters.level || undefined
        })
        const serverList = (data?.items || []) as any[]
        // 合并本地 dirty / 未提交
        let pendingLocal: any[] = []
        if (actor && isOfflineCapable()) {
          try {
            const all = await repo.customers.list(actor)
            pendingLocal = (all || [])
              .filter((r) => !r.server_id)
              .map((r) => ({ ...r, id: r.client_uuid, display_name: r.name || r.display_name, __pending: true }))
          } catch (e) { /* */ }
        }
        this.list = [...pendingLocal, ...serverList]
        this.total = (data?.total || 0) + pendingLocal.length
        this.page = 1
        this.finished = serverList.length >= (data?.total || 0)
      } finally {
        this.loading = false
      }
    },
    /** 加载下一页 */
    async loadMore() {
      if (this.loading || this.finished) return
      this.loading = true
      try {
        const offline = await shouldUseOffline()
        if (offline) { this.finished = true; return }
        const next = this.page + 1
        const data = await customerApi.list({
          page: next,
          page_size: this.page_size,
          q: this.filters.q || undefined,
          status: this.filters.status || undefined,
          level: this.filters.level || undefined
        })
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
     * 创建客户：在线直调 API；离线写本地 + 入队 pending_op。
     * @returns { id?, client_uuid, status: 'ok'|'queued' }
     */
    async createCustomer(payload: any, opts?: { uuid?: string }) {
      const client_uuid = opts?.uuid || payload?.client_uuid || uuidv4()
      const offline = await shouldUseOffline()
      const actor = getActor()
      const body = { ...payload, client_uuid }

      if (!offline) {
        // 在线
        const res: any = await customerApi.create(body)
        const created = res?.customer || res
        if (created) this.list = [created, ...this.list]
        return { id: created?.id || res?.server_id, client_uuid, status: 'ok' as const }
      }

      // 离线
      if (!actor) throw new Error('未登录，无法离线创建')
      await repo.customers.upsert(actor, {
        client_uuid,
        name: body.display_name || body.name || '',
        phone: body.phone || '',
        gender: body.gender || '',
        age: body.age || null,
        level: body.level || '',
        status: body.status || '',
        source: body.source || '',
        next_follow_up_at: body.next_follow_up_at || '',
        next_follow_up_text: body.next_follow_up_text || '',
        remark: body.remark || '',
        extra: body,
        dirty: 1
      })
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'customer',
        op: 'create',
        payload: body
      })
      try { useSyncStore().kick('user_action') } catch (e) { /* */ }
      // 加入本地列表头
      this.list = [{
        id: client_uuid,
        client_uuid,
        display_name: body.display_name || body.name || '',
        phone: body.phone || '',
        status: body.status || '',
        level: body.level || '',
        __pending: true
      }, ...this.list]
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
      return { client_uuid, status: 'queued' as const }
    },
    /**
     * 更新客户：在线直调 update；离线写本地 + 入队。
     */
    async updateCustomer(id: number | string, patch: any, opts?: { client_uuid?: string; base_version?: string }) {
      const offline = await shouldUseOffline()
      const actor = getActor()

      if (!offline) {
        const r = await customerApi.update(id, patch)
        if (r) this.updateInList(id, r)
        return { id, status: 'ok' as const }
      }

      if (!actor) throw new Error('未登录，无法离线更新')
      const client_uuid = opts?.client_uuid || (patch && patch.client_uuid) || uuidv4()
      // 注意：仅记录 pending_op，不强行 upsert（id 是 server_id，本地不一定有）
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'customer',
        op: 'update',
        server_id: typeof id === 'string' ? Number(id) || null : id,
        base_version: opts?.base_version || patch?.base_version,
        payload: { ...patch, id }
      })
      try { useSyncStore().kick('user_action') } catch (e) { /* */ }
      this.updateInList(id, { ...patch, __pending: true })
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
      return { id, client_uuid, status: 'queued' as const }
    },
    /**
     * 删除：仅在线（PRD 7.6）。离线时 toast 提示。
     */
    async deleteCustomer(id: number | string) {
      const offline = await shouldUseOffline()
      if (offline) {
        uni.showToast({ title: '请连网后再删除', icon: 'none' })
        return { id, status: 'rejected' as const }
      }
      await customerApi.remove(id)
      this.removeFromList(id)
      return { id, status: 'ok' as const }
    },
    /**
     * 设置/编辑提醒。可离线。
     */
    async setReminder(id: number | string, body: any, opts?: { client_uuid?: string; base_version?: string }) {
      const offline = await shouldUseOffline()
      const actor = getActor()

      if (!offline) {
        const r = await customerApi.setReminder(id, body)
        if (r) this.updateInList(id, r)
        return { id, status: 'ok' as const }
      }

      if (!actor) throw new Error('未登录，无法离线设置提醒')
      const client_uuid = opts?.client_uuid || uuidv4()
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'customer',
        op: 'update',
        server_id: typeof id === 'string' ? Number(id) || null : id,
        base_version: opts?.base_version,
        payload: {
          id,
          next_follow_up_at: body.next_follow_up_at ?? body.remind_at ?? null,
          next_follow_up_text: body.next_follow_up_text ?? body.remark ?? ''
        }
      })
      try { useSyncStore().kick('user_action') } catch (e) { /* */ }
      this.updateInList(id, {
        next_follow_up_at: body.next_follow_up_at ?? body.remind_at ?? null,
        next_follow_up_text: body.next_follow_up_text ?? body.remark ?? '',
        __pending: true
      })
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
      return { id, client_uuid, status: 'queued' as const }
    },
    /** 列表内局部更新某条 */
    updateInList(id: number | string, patch: any) {
      const idx = this.list.findIndex((c) => String(c?.id) === String(id))
      if (idx >= 0) this.list[idx] = { ...this.list[idx], ...patch }
    },
    /** 列表内移除某条 */
    removeFromList(id: number | string) {
      const idx = this.list.findIndex((c) => String(c?.id) === String(id))
      if (idx >= 0) {
        this.list.splice(idx, 1)
        this.total = Math.max(0, this.total - 1)
      }
    },
    /** 重置全部状态（切换账号时用） */
    reset() {
      this.list = []
      this.total = 0
      this.page = 1
      this.loading = false
      this.finished = false
      this.filters = { q: '', status: '', level: '' }
    }
  }
})
