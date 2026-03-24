/**
 * 微信云开发 admin_manager 直连封装（HTTP API 网关）
 * 请求体：{ action, data }，响应：{ success, msg?, ... }
 * Bearer 认证：优先使用 VITE_CLOUDBASE_PUBLISHABLE_KEY（推荐，避免 403），否则匿名登录获取 access_token。
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { getCloudbaseAccessToken } from '@/utils/cloudbase-auth'

const BASE_URL = (import.meta.env.VITE_CLOUDBASE_HTTP_URL || '').trim()
const PUBLISHABLE_KEY = import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY as string | undefined

export interface CloudBaseRequest {
  action: string
  data: Record<string, unknown>
}

export interface CloudBaseListResponse<T = unknown> {
  success: boolean
  msg?: string
  list?: T[]
  page?: number
  page_size?: number
  total?: number
}

export interface CloudBaseResponse<T = unknown> {
  success: boolean
  msg?: string
  [key: string]: unknown
}

/**
 * 调用 admin_manager 云函数（POST JSON body）
 * @param action 云函数 action
 * @param data 请求数据（除 admin_login 外需包含 token）
 * @returns 成功时返回完整响应对象；失败时抛出并提示 msg
 */
export async function cloudbasePost<T = unknown>(
  action: string,
  data: Record<string, unknown> = {}
): Promise<T & { success: true }> {
  if (!BASE_URL) {
    const msg = '未配置 VITE_CLOUDBASE_HTTP_URL，请在 .env 中设置云函数网关地址'
    ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  }

  const rawKey = typeof PUBLISHABLE_KEY === 'string' ? PUBLISHABLE_KEY.trim() : ''
  let accessToken = rawKey
  if (!accessToken) {
    try {
      accessToken = await getCloudbaseAccessToken()
    } catch {
      // 若控制台已开启「公网访问」，则可不带 Authorization 直接调用；此处不强制失败
      accessToken = ''
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const res = await axios.request<CloudBaseResponse & T>({
      method: 'POST',
      url: BASE_URL,
      timeout: 15000,
      headers,
      data: { action, data }
    })

    const body = res.data
    if (body?.success !== true) {
      const msg = (body?.msg as string) || '请求失败'
      ElMessage.error(msg)
      return Promise.reject(new Error(msg))
    }

    if (import.meta.env.DEV && action.endsWith('_list')) {
      const list = (body as Record<string, unknown>)?.list
      const total = (body as Record<string, unknown>)?.total
      const len = Array.isArray(list) ? list.length : undefined
      // eslint-disable-next-line no-console
      console.debug(`[cloudbasePost] ${action}`, { len, total, body })
    }

    return body as T & { success: true }
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) throw err

    const status = err.response?.status
    const resp = err.response?.data as Record<string, unknown> | undefined
    const code = resp?.code as string | undefined
    const msg = (resp?.msg as string) || (resp?.message as string) || err.message
    const detail = code ? `[${code}] ${msg}` : msg

    if (status === 403) {
      ElMessage.error(`网关拒绝访问 (403)：${detail}`)
      return Promise.reject(new Error(detail))
    }

    ElMessage.error(`请求失败${status ? ` (${status})` : ''}：${detail}`)
    return Promise.reject(new Error(detail))
  }
}
