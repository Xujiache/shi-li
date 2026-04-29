/**
 * 角色守卫工具。
 */
import { useAuthStore } from '@/stores/auth'

/** 是否经理角色 */
export function isManager(auth?: ReturnType<typeof useAuthStore>): boolean {
  const a = auth || useAuthStore()
  return a.employee?.role === 'manager'
}

/** 经理校验，否则 toast 并返回 false。用于页面/按钮入口拦截。 */
export function requireManager(): boolean {
  if (isManager()) return true
  uni.showToast({ title: '仅经理可操作', icon: 'none' })
  return false
}
