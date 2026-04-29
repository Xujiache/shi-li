/**
 * 退避重试策略。
 *
 * 退避表（毫秒）：
 *   retry_count = 0 → 立即（首次失败后等 1s）
 *   retry_count = 1 → 5s
 *   retry_count = 2 → 30s
 *   retry_count = 3 → 5min
 *   retry_count >= 4 → 5min（封顶）
 *
 * 超过 MAX_RETRY 次后由调用方改用 markDeadLetter（人工重试）。
 *
 * 用绝对时间戳（next_retry_at）而非 setTimeout 链：进程被杀也能恢复。
 */

export const MAX_RETRY = 5

const BACKOFF_MS = [1000, 5000, 30 * 1000, 5 * 60 * 1000, 5 * 60 * 1000]

/**
 * 计算下次重试的绝对时间戳（ms）。
 * @param retryCount 当前已重试次数（0 表示首次失败）
 */
export function nextRetryAt(retryCount: number): number {
  const idx = Math.min(Math.max(retryCount, 0), BACKOFF_MS.length - 1)
  return Date.now() + BACKOFF_MS[idx]
}
