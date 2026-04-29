import { defineStore } from 'pinia'
import { useSyncStore } from '@/stores/sync'

const TOKEN_KEY = 'emp_token'
const EMPLOYEE_KEY = 'emp_profile'

export interface EmployeeProfile {
  id: number
  phone: string
  display_name: string
  role: 'staff' | 'manager'
  department_id: number | null
  active: boolean
  must_change_password: boolean
  avatar_url?: string
  position?: string
  last_login_at?: string | null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    expiresIn: 0 as number,
    employee: null as EmployeeProfile | null
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isManager: (s) => s.employee?.role === 'manager',
    isStaff: (s) => s.employee?.role === 'staff',
    mustChangePassword: (s) => !!s.employee?.must_change_password
  },
  actions: {
    /** App.vue onLaunch 调用：从 storage 读 token + profile，并在未登录时跳登录页。 */
    bootstrap() {
      try {
        const t = uni.getStorageSync(TOKEN_KEY)
        const p = uni.getStorageSync(EMPLOYEE_KEY)
        if (t) this.token = String(t)
        if (p) this.employee = (typeof p === 'string' ? JSON.parse(p) : p) as EmployeeProfile
      } catch (e) {
        console.warn('[auth] bootstrap failed', e)
      }
      if (!this.token) {
        // 异步跳登录（不要 await，UniApp onLaunch 是同步钩子）
        setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 0)
      } else if (this.employee?.must_change_password) {
        setTimeout(() => uni.redirectTo({ url: '/pages/login/change-password' }), 0)
      } else if (this.token && this.employee?.id) {
        // 已登录 → 启动 sync 引擎并 kick 一次（异步，不阻塞 bootstrap）
        try {
          const sync = useSyncStore()
          const actor = { employee_id: this.employee.id }
          sync.init(actor).then(() => sync.kick('login')).catch(() => undefined)
        } catch (e) {
          // pinia 未就绪时静默
        }
      }
    },
    setToken(token: string, expiresIn = 0) {
      this.token = token
      this.expiresIn = expiresIn
      uni.setStorageSync(TOKEN_KEY, token)
    },
    setEmployee(p: EmployeeProfile) {
      this.employee = p
      uni.setStorageSync(EMPLOYEE_KEY, JSON.stringify(p))
    },
    /** 仅本地清状态，不调后端（后端调用走 api/employee.logout）
     *  注意：**不删 pending_op**——队列按 owner_employee_id 隔离，
     *  下次同账号登录会自动接续；切到不同账号也只显示自己的。
     */
    clear() {
      this.token = ''
      this.expiresIn = 0
      this.employee = null
      uni.removeStorageSync(TOKEN_KEY)
      uni.removeStorageSync(EMPLOYEE_KEY)
      try {
        useSyncStore().reset()
      } catch (e) {
        // pinia 未就绪时静默
      }
    }
  }
})
