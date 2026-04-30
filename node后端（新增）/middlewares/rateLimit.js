/**
 * 限速中间件工厂。
 *   - aiChatLimiter：单 admin 30 条/分钟（聊天）
 *   - aiCorrectionLimiter：单 employee 10 次/分钟（修订追问 prompt）
 *   - publicTrackLimiter：未鉴权埋点接口，单 IP 60 次/分钟
 *   - bulkGenerateLimiter：单 admin 5 次/小时
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

// v8 要求自定义 keyGenerator 在没有 user 时用 ipKeyGenerator(req, res) 兼容 IPv6
function userKey(req, res) {
  if (req.user && req.user.id) return `${req.user.type || 'u'}_${req.user.id}`
  return ipKeyGenerator(req, res)
}

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: 'AI 聊天频率过高，请稍后再试' }
})

const aiCorrectionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: 'AI 追问频率过高，请稍后再试' }
})

const aiBulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: userKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '批量生成频率过高（每小时最多 5 次）' }
})

const publicTrackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁' }
})

module.exports = {
  aiChatLimiter,
  aiCorrectionLimiter,
  aiBulkLimiter,
  publicTrackLimiter
}
