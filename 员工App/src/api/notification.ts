/**
 * 站内通知接口封装。
 * 后端路径：/notifications，标已读/全部已读统一 PUT。
 * 列表 unwrap：{list,...} → {items,...}；未读数 unwrap：{unread:N} → {count:N, unread:N}（双字段）。
 */
import { http } from './http'

export async function list(params?: { page?: number; page_size?: number; only_unread?: boolean }) {
  const r: any = await http.get<any>('/notifications', params)
  return {
    items: r?.list || r?.items || [],
    total: r?.total || 0,
    page: r?.page || 1,
    page_size: r?.page_size || 20
  }
}

export async function unreadCount() {
  const r: any = await http.get<any>('/notifications/unread-count')
  const n = Number(r?.unread ?? r?.count ?? 0) || 0
  return { count: n, unread: n }
}

export function markRead(id: number | string) {
  return http.put<any>(`/notifications/${id}/read`, {})
}

export function markAllRead() {
  return http.put<any>('/notifications/read-all', {})
}

export function clearRead() {
  return http.del<any>('/notifications/read')
}
