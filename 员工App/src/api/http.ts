/**
 * 员工 App HTTP 封装。
 * - H5：相对路径 /api/v1/employee（dev 走 vite proxy；生产走 Nginx 同站）
 * - APK：绝对 URL https://api.gmxd.asia/api/v1/employee
 * 拦截器统一处理：token 注入、40104 跳改密页、40101/40103 清登录态、网络异常 toast。
 */
import { useAuthStore } from '@/stores/auth'

// #ifdef H5
const BASE_URL = '/api/v1/employee'
// #endif
// #ifdef APP-PLUS
const BASE_URL = 'https://api.gmxd.asia/api/v1/employee'
// #endif
// #ifdef MP-WEIXIN
const BASE_URL = 'https://api.gmxd.asia/api/v1/employee'
// #endif

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp?: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  query?: Record<string, any>
  header?: Record<string, string>
  hideError?: boolean
  timeout?: number
}

function buildUrl(path: string, query?: Record<string, any>): string {
  let url = BASE_URL + path
  if (query) {
    const qs = Object.keys(query)
      .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
      .join('&')
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
  }
  return url
}

/**
 * 防止改密页 dead loop：当前页是 change-password 时不再 redirect。
 */
function isOnChangePasswordPage(): boolean {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1] as any
    const route: string = cur?.route || cur?.$page?.fullPath || ''
    return /login\/change-password/.test(route)
  } catch {
    return false
  }
}

/**
 * 业务码处理。返回 true 表示已处理（拦截后续抛错）。
 */
function handleBusinessCode(code: number, message: string): boolean {
  const auth = useAuthStore()
  if (code === 40104) {
    if (!isOnChangePasswordPage()) {
      uni.showToast({ title: '请先修改初始密码', icon: 'none' })
      uni.redirectTo({ url: '/pages/login/change-password' })
    }
    return true
  }
  if (code === 401 || code === 40101 || code === 40103) {
    auth.clear()
    uni.showToast({ title: message || '登录失效，请重新登录', icon: 'none' })
    setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 800)
    return true
  }
  if (code === 40102) {
    // 异地登录二次验证
    uni.redirectTo({ url: '/pages/login/verify' })
    return true
  }
  return false
}

export function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = useAuthStore()
  const url = buildUrl(path, options.query)
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.header || {})
  }
  if (auth.token) {
    header.Authorization = `Bearer ${auth.token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      header,
      timeout: options.timeout || 15000,
      success: (res) => {
        if (res.statusCode >= 500) {
          if (!options.hideError) uni.showToast({ title: '服务器错误', icon: 'none' })
          return reject(new Error(`服务器错误 ${res.statusCode}`))
        }
        const body = res.data as ApiResponse<T>
        if (!body || typeof body !== 'object') {
          return reject(new Error('响应格式异常'))
        }
        if (handleBusinessCode(body.code, body.message)) {
          return reject(new Error(body.message))
        }
        if (body.code >= 200 && body.code < 300) {
          return resolve(body.data)
        }
        if (!options.hideError) {
          uni.showToast({ title: body.message || '请求失败', icon: 'none' })
        }
        const err: any = new Error(body.message || '请求失败')
        err.code = body.code
        err.data = body.data
        reject(err)
      },
      fail: (err) => {
        if (!options.hideError) {
          uni.showToast({ title: '网络异常，请重试', icon: 'none' })
        }
        reject(err)
      }
    })
  })
}

export const http = {
  get<T = any>(path: string, query?: any, opts?: RequestOptions) {
    return request<T>(path, { ...opts, method: 'GET', query })
  },
  post<T = any>(path: string, data?: any, opts?: RequestOptions) {
    return request<T>(path, { ...opts, method: 'POST', data })
  },
  put<T = any>(path: string, data?: any, opts?: RequestOptions) {
    return request<T>(path, { ...opts, method: 'PUT', data })
  },
  del<T = any>(path: string, query?: any, opts?: RequestOptions) {
    return request<T>(path, { ...opts, method: 'DELETE', query })
  }
}

export { BASE_URL }
