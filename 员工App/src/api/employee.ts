/**
 * Auth / Me / Dashboard / Team / Announcements / Tags 相关接口封装。
 */
import { http } from './http'
import type { EmployeeProfile } from '@/stores/auth'

export interface LoginResponse {
  token: string
  expires_in: number
  must_change_password?: boolean
  employee: EmployeeProfile
}

export function login(data: { phone: string; password: string; device_id?: string; device_info?: string }) {
  return http.post<LoginResponse>('/auth/login', data)
}

export function verifyCode(data: { phone: string; code: string }) {
  return http.post<LoginResponse>('/auth/verify-code', data)
}

export function resendVerifyCode(data: { phone: string }) {
  return http.post<{ sms_enabled: boolean; message: string }>('/auth/resend-verify-code', data)
}

export function changePassword(data: { old_password: string; new_password: string }) {
  return http.post<{ token?: string }>('/auth/change-password', data)
}

export function logout() {
  return http.post('/auth/logout', {})
}

/**
 * 后端响应包装：
 *   /me      → {employee:{...}}        api 层 unwrap → employee 对象
 *   /me PUT  → {employee:{...}}        同上
 *   /team/members / /announcements / /customer-tags → {list:[...]} 或裸数组   unwrap → 数组
 *   /dashboard/me / /dashboard/stats   后端返扁平对象，无需 unwrap
 */

export async function getMe() {
  const r: any = await http.get<any>('/me')
  return (r?.employee || r) as EmployeeProfile
}

export async function updateMe(patch: Partial<EmployeeProfile>) {
  const r: any = await http.put<any>('/me', patch)
  return (r?.employee || r) as EmployeeProfile
}

export interface DashboardSummary {
  customers_total: number
  customers_new_this_month: number
  follow_ups_this_month: number
  customers_pending_follow_up: number
}

export function getDashboard() {
  return http.get<DashboardSummary>('/dashboard/me')
}

export function getStats(range: 'week' | 'month' | 'quarter' = 'month') {
  return http.get<any>('/dashboard/stats', { range })
}

export async function getTeamMembers() {
  const r: any = await http.get<any>('/team/members')
  return (r?.list || r?.items || (Array.isArray(r) ? r : [])) as any[]
}

export async function getAnnouncements() {
  const r: any = await http.get<any>('/announcements')
  return (r?.list || r?.items || (Array.isArray(r) ? r : [])) as any[]
}

export async function getCustomerTags() {
  const r: any = await http.get<any>('/customer-tags')
  return (r?.list || r?.items || (Array.isArray(r) ? r : [])) as any[]
}
