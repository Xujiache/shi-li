/**
 * 跟进记录接口封装。
 * 后端路径：/follow-ups
 * 列表 unwrap：{list,...} → {items,...}；详情 unwrap：{follow_up} → 对象本身。
 */
import { http } from './http'

export interface FollowUpListQuery {
  customer_id?: number | string
  page?: number
  page_size?: number
  type?: string
  result?: string
  from?: string
  to?: string
  [k: string]: any
}

export async function list(params?: FollowUpListQuery) {
  const r: any = await http.get<any>('/follow-ups', params)
  return {
    items: r?.list || r?.items || [],
    total: r?.total || 0,
    page: r?.page || 1,
    page_size: r?.page_size || 20
  }
}

export async function detail(id: number | string) {
  const r: any = await http.get<any>(`/follow-ups/${id}`)
  return r?.follow_up || r || null
}

export function create(data: any) {
  return http.post<any>('/follow-ups', data)
}

export async function update(id: number | string, patch: any) {
  const r: any = await http.put<any>(`/follow-ups/${id}`, patch)
  return r?.follow_up || r || null
}

export function remove(id: number | string) {
  return http.del<any>(`/follow-ups/${id}`)
}

export function share(id: number | string, target_employee_id: number) {
  return http.post<{ success: boolean; target_employee_id: number }>(
    `/follow-ups/${id}/share`,
    { target_employee_id }
  )
}
