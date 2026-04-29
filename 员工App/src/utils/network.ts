/**
 * 网络探测 + 状态变化订阅。
 *
 * isReallyOnline：
 *   1) uni.getNetworkType 看链路类型（none → false）
 *   2) GET /health（节流：30s 内最多一次；timeout 3s）
 *   3) 任一失败均视为离线
 *
 * onNetworkChange：
 *   uni.onNetworkStatusChange 在某些环境会重复触发（同状态多次回调），
 *   这里包装去重，仅当 isConnected 实际变化时回调一次。
 *
 * 节流状态在模块级，跨调用共享。
 */

// #ifdef H5
const HEALTH_URL = '/api/v1/health'
// #endif
// #ifdef APP-PLUS
const HEALTH_URL = 'https://api.gmxd.asia/api/v1/health'
// #endif
// #ifdef MP-WEIXIN
const HEALTH_URL = 'https://api.gmxd.asia/api/v1/health'
// #endif

const HEALTH_TIMEOUT = 3000
const HEALTH_THROTTLE_MS = 30 * 1000

let lastProbeAt = 0
let lastProbeOnline = false

/**
 * 真探活：链路 + 健康端点。
 * 节流：30s 内复用上次结果。
 */
export async function isReallyOnline(): Promise<boolean> {
  const t = Date.now()
  if (t - lastProbeAt < HEALTH_THROTTLE_MS) {
    return lastProbeOnline
  }
  lastProbeAt = t

  // 1) 链路探测
  const linkOk = await new Promise<boolean>((resolve) => {
    try {
      uni.getNetworkType({
        success: (r: any) => resolve(r && r.networkType !== 'none'),
        fail: () => resolve(false)
      })
    } catch (e) {
      resolve(false)
    }
  })
  if (!linkOk) {
    lastProbeOnline = false
    return false
  }

  // 2) 健康端点（不带 token，仅看链路通断）
  const healthy = await new Promise<boolean>((resolve) => {
    try {
      uni.request({
        url: HEALTH_URL,
        method: 'GET',
        timeout: HEALTH_TIMEOUT,
        success: (r: any) => resolve(r && r.statusCode >= 200 && r.statusCode < 500),
        fail: () => resolve(false)
      })
    } catch (e) {
      resolve(false)
    }
  })

  lastProbeOnline = healthy
  return healthy
}

let lastConnected: boolean | null = null
const subscribers: Array<(online: boolean) => void> = []
let bound = false

/**
 * 订阅网络状态变化。包装去重：只有 isConnected 实际翻转时才回调。
 * 返回取消订阅函数。
 */
export function onNetworkChange(cb: (online: boolean) => void): () => void {
  subscribers.push(cb)
  if (!bound) {
    bound = true
    try {
      uni.onNetworkStatusChange((res: any) => {
        const cur = !!res.isConnected
        if (lastConnected === cur) return // 去重
        lastConnected = cur
        // 网络状态翻转时也清空节流，强制下次 isReallyOnline 重新探测
        lastProbeAt = 0
        for (const fn of subscribers) {
          try {
            fn(cur)
          } catch (e) {
            console.warn('[network] subscriber threw', e)
          }
        }
      })
    } catch (e) {
      console.warn('[network] onNetworkStatusChange not available', e)
    }
  }
  return () => {
    const i = subscribers.indexOf(cb)
    if (i >= 0) subscribers.splice(i, 1)
  }
}

/**
 * 仅给测试 / debug 用：清节流缓存。
 */
export function _resetNetworkProbe() {
  lastProbeAt = 0
  lastProbeOnline = false
}
