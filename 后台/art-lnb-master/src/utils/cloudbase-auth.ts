/**
 * CloudBase 匿名登录，获取 access_token（用于 HTTP API 网关 Bearer 认证）
 * 兼容 @cloudbase/js-sdk 2.x（signInAnonymously + getAccessToken）与 1.x（anonymousAuthProvider）
 * 环境 ID 来自 VITE_CLOUDBASE_ENV，若未配置则从 VITE_CLOUDBASE_HTTP_URL 中解析
 */
import cloudbase from '@cloudbase/js-sdk'

function getEnvId(): string {
  const env = import.meta.env.VITE_CLOUDBASE_ENV as string | undefined
  if (env) return env
  const url = import.meta.env.VITE_CLOUDBASE_HTTP_URL as string | undefined
  if (!url) return ''
  try {
    const host = new URL(url).hostname
    // 1) https://<envId>.api.tcloudbasegateway.com
    if (host.endsWith('.api.tcloudbasegateway.com')) {
      return host.split('.')[0] || ''
    }
    // 2) https://<envId>-<appId>.<region>.app.tcloudbase.com
    if (host.endsWith('.app.tcloudbase.com')) {
      const firstLabel = host.split('.')[0] || ''
      return firstLabel.replace(/-\d+$/, '')
    }
  } catch {
    // ignore
  }
  return ''
}

let app: ReturnType<typeof cloudbase.init> | null = null
let accessTokenCache = ''

export function getCloudbaseApp(): ReturnType<typeof cloudbase.init> {
  const envId = getEnvId()
  if (!envId) {
    throw new Error('未配置 VITE_CLOUDBASE_ENV 或 VITE_CLOUDBASE_HTTP_URL，无法初始化 CloudBase')
  }
  if (!app) {
    app = cloudbase.init({ env: envId })
  }
  return app
}

export async function getCloudbaseAccessToken(): Promise<string> {
  if (accessTokenCache) return accessTokenCache
  const envId = getEnvId()
  if (!envId) {
    throw new Error('未配置 VITE_CLOUDBASE_ENV 或 VITE_CLOUDBASE_HTTP_URL，无法获取 CloudBase access_token')
  }
  if (!app) app = cloudbase.init({ env: envId })
  const auth = app.auth && typeof app.auth === 'function' ? app.auth() : (app as { auth: unknown }).auth
  if (!auth) {
    throw new Error('CloudBase auth 未就绪，请确认已正确引入 @cloudbase/js-sdk')
  }

  // 匿名登录：2.x 为 signInAnonymously()，1.x 为 anonymousAuthProvider().signIn()
  if (typeof (auth as { signInAnonymously?: () => Promise<unknown> }).signInAnonymously === 'function') {
    await (auth as { signInAnonymously: () => Promise<unknown> }).signInAnonymously()
  } else if (
    (auth as { anonymousAuthProvider?: () => { signIn: () => Promise<unknown> } }).anonymousAuthProvider &&
    typeof (auth as { anonymousAuthProvider: () => { signIn: () => Promise<unknown> } }).anonymousAuthProvider().signIn === 'function'
  ) {
    await (auth as { anonymousAuthProvider: () => { signIn: () => Promise<unknown> } }).anonymousAuthProvider().signIn()
  } else {
    throw new Error('当前 CloudBase SDK 不支持匿名登录，请使用 @cloudbase/js-sdk@2.x 并确保为 Web 构建')
  }

  // 获取 accessToken：2.x 为 async getAccessToken() => { accessToken }，1.x 为 sync getAccessToken() => { accessToken }
  let accessToken: string | undefined
  const getToken = (auth as { getAccessToken: () => Promise<{ accessToken?: string }> | { accessToken?: string } }).getAccessToken
  if (typeof getToken !== 'function') {
    throw new Error('获取 CloudBase accessToken 失败，请确认控制台已开启匿名登录')
  }
  const tokenRes = await Promise.resolve(getToken.call(auth))
  accessToken = tokenRes?.accessToken

  if (!accessToken) {
    throw new Error('获取 CloudBase accessToken 失败，请确认控制台已开启匿名登录')
  }
  accessTokenCache = accessToken
  return accessTokenCache
}
