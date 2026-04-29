/**
 * 客户转出申请接口封装。
 * 后端路由前缀：/customer-transfers
 * 列表接口在 api 层把后端 {list, total, page, page_size} rename 成 {items, total, page, page_size}（前端约定 items）。
 */
import { http } from './http'
import { repo, type Actor } from '@/db'
import { isOfflineCapable } from '@/db/platform'
import { isReallyOnline } from '@/utils/network'
import { v4 as uuidv4 } from '@/utils/uuid'
import { useSyncStore } from '@/stores/sync'

export interface TransferSubmit {
  customer_id: number | string
  reason: string
  client_uuid?: string
}

function unwrapList(r: any) {
  if (!r) return { items: [], total: 0, page: 1, page_size: 20 }
  return {
    items: r.list || r.items || [],
    total: r.total || 0,
    page: r.page || 1,
    page_size: r.page_size || 20
  }
}

export async function submit(data: TransferSubmit) {
  return http.post<any>('/customer-transfers', data)
}

/**
 * 离线感知提交：在线直调 submit；离线写 pending_op + kick sync。
 * 调用方传 actor（来自 auth/sync），避免在 api 层引入 store 依赖循环。
 * 返回 { status: 'ok' | 'queued', client_uuid }。
 */
export async function submitOffline(actor: Actor, data: TransferSubmit) {
  const client_uuid = data.client_uuid || uuidv4()
  let offline = false
  if (isOfflineCapable()) {
    try { offline = !(await isReallyOnline()) } catch (e) { offline = true }
  }
  const body = { ...data, client_uuid }
  if (!offline) {
    const r = await submit(body)
    return { status: 'ok' as const, client_uuid, raw: r }
  }
  await repo.pendingOp.add(actor, {
    owner_employee_id: actor.employee_id,
    client_uuid,
    type: 'customer_transfer',
    op: 'create',
    payload: body
  })
  try { useSyncStore().kick('user_action') } catch (e) { /* */ }
  return { status: 'queued' as const, client_uuid }
}

export async function mine(params?: { status?: string; page?: number; page_size?: number }) {
  const r = await http.get<any>('/customer-transfers/mine', params)
  return unwrapList(r)
}

export async function pending(params?: { page?: number; page_size?: number }) {
  const r = await http.get<any>('/customer-transfers/pending', params)
  return unwrapList(r)
}

export function approve(
  id: number | string,
  body: { to_employee_id: number | string; approval_remark?: string; client_uuid?: string }
) {
  return http.put<any>(`/customer-transfers/${id}/approve`, body)
}

export function reject(id: number | string, body: { approval_remark: string; client_uuid?: string }) {
  return http.put<any>(`/customer-transfers/${id}/reject`, body)
}
