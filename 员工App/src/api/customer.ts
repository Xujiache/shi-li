/**
 * 客户档案相关接口封装。
 * 路径不含 /api/v1/employee 前缀（http.ts 自动加）。
 *
 * 后端响应包装：
 *   list  → {list, total, page, page_size}    api 层 unwrap → {items, total, page, page_size}
 *   detail → {customer}                        api 层 unwrap → customer 对象本身
 *   search → {list: []}                        api 层 unwrap → 数组
 *   listAttachments → {list: []}               api 层 unwrap → 数组
 *   create → {customer, status, server_id}     api 层保留原状（调用点用 result.status 判 duplicate）
 *   update → {customer}                        api 层 unwrap → customer 对象
 *   addAttachment → {attachment}               api 层 unwrap → attachment
 */
import { http } from './http'

export interface CustomerListQuery {
  q?: string
  status?: string
  level?: string
  page?: number
  page_size?: number
  sort?: string
  [k: string]: any
}

export async function list(params?: CustomerListQuery) {
  const r: any = await http.get<any>('/customers', params)
  return {
    items: r?.list || r?.items || [],
    total: r?.total || 0,
    page: r?.page || 1,
    page_size: r?.page_size || 20
  }
}

export async function detail(id: number | string) {
  const r: any = await http.get<any>(`/customers/${id}`)
  return r?.customer || r || null
}

export function create(data: any) {
  // 保留 {customer, status, server_id} 整体，调用点判 status==='duplicate'
  return http.post<any>('/customers', data)
}

export async function update(id: number | string, patch: any) {
  const r: any = await http.put<any>(`/customers/${id}`, patch)
  return r?.customer || r || null
}

/** 软删 */
export function remove(id: number | string) {
  return http.del<any>(`/customers/${id}`)
}

export async function search(q: string) {
  const r: any = await http.get<any>('/customers/search', { q })
  return r?.list || r?.items || (Array.isArray(r) ? r : [])
}

export async function setReminder(
  id: number | string,
  body: { next_follow_up_at?: string | null; next_follow_up_text?: string; remind_at?: string | null; remark?: string }
) {
  // 兼容旧字段命名 remind_at / remark
  const payload: any = {
    next_follow_up_at: body.next_follow_up_at ?? body.remind_at ?? null,
    next_follow_up_text: body.next_follow_up_text ?? body.remark ?? ''
  }
  const r: any = await http.put<any>(`/customers/${id}/reminder`, payload)
  return r?.customer || r || null
}

export async function listAttachments(id: number | string) {
  const r: any = await http.get<any>(`/customers/${id}/attachments`)
  return r?.list || r?.items || (Array.isArray(r) ? r : [])
}

export async function linkedChildren(id: number | string) {
  const r: any = await http.get<any>(`/customers/${id}/linked-children`)
  return r?.list || r?.items || (Array.isArray(r) ? r : [])
}

export async function addAttachment(
  id: number | string,
  body: { upload_id: number; file_type?: 'image' | 'document'; url?: string; name?: string; type?: string; size?: number }
) {
  // 后端只认 upload_id + file_type；前端可能传 url/name 等，兼容做映射
  const payload: any = {
    upload_id: body.upload_id,
    file_type: body.file_type || 'image'
  }
  const r: any = await http.post<any>(`/customers/${id}/attachments`, payload)
  return r?.attachment || r || null
}

export function deleteAttachment(id: number | string, aid: number | string) {
  return http.del<any>(`/customers/${id}/attachments/${aid}`)
}
