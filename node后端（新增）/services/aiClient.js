/**
 * OpenAI 兼容 chat completion 封装。
 * 实际指向 aizhiwen.top（OpenAI 兼容代理）。
 *
 * 调用约定：
 *   POST {AI_API_BASE}/v1/chat/completions
 *   Headers: Authorization: Bearer {AI_API_KEY}
 *   Body: { model, messages, max_tokens?, temperature? }
 *   Response: { choices: [{ message: { content } }], usage: { total_tokens, ... } }
 */
const { StatusCodes } = require('http-status-codes')
const { createAppError } = require('../utils/appError')
const config = require('../config')
const logger = require('../utils/logger')
const { execute, queryOne } = require('../utils/db')

/**
 * 每日 token 配额检查 + 累加。
 * @param {{type?:'admin'|'employee'|'system', id?:number}} actor
 */
async function checkAndIncrementQuota(actor, tokensUsed) {
  const type = actor && actor.type ? actor.type : 'system'
  const id = actor && actor.id ? Number(actor.id) : 0
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const limit = type === 'admin'
    ? config.ai.dailyTokenLimitAdmin
    : type === 'employee'
      ? config.ai.dailyTokenLimitEmployee
      : Number.MAX_SAFE_INTEGER // system 不限

  if (limit <= 0) return // 0 或负数 = 关闭限额

  // 先查当前用量
  const row = await queryOne(
    'SELECT tokens_used FROM ai_usage_daily WHERE actor_type = ? AND actor_id = ? AND day_key = ? LIMIT 1',
    [type, id, today]
  )
  const used = row ? Number(row.tokens_used || 0) : 0
  if (used >= limit) {
    const e = createAppError(`今日 AI token 用量已达上限（${used}/${limit}），请明日再用或联系管理员调整额度`, 429)
    e.aiCode = 'ai_daily_quota_exceeded'
    throw e
  }

  // 累加（upsert）
  await execute(
    `INSERT INTO ai_usage_daily (actor_type, actor_id, day_key, tokens_used, call_count)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       tokens_used = tokens_used + VALUES(tokens_used),
       call_count = call_count + 1`,
    [type, id, today, Math.max(0, Number(tokensUsed) || 0)]
  )
}

/**
 * 调 chat/completions，返回 { content, usage, raw }。
 * @param {{model:string, messages:Array<{role:string,content:string}>, max_tokens?:number, temperature?:number}} input
 * @returns {Promise<{content:string, usage?:Record<string,number>, raw:any}>}
 */
/**
 * 把日志/错误信息中的 API key 脱敏，避免泄露到日志文件 / 异常向前端透传。
 */
function maskKey(s) {
  if (!s) return s
  const k = config.ai.apiKey || ''
  if (!k) return s
  return String(s).split(k).join('***')
}

/**
 * 按 HTTP status 把上游错误归类为对运维有意义的错误码。
 */
function classifyHttpError(status, bodyText) {
  if (status === 401 || status === 403) {
    return { code: 'ai_auth_failed', userMsg: 'AI 凭证无效或已失效，请联系管理员' }
  }
  if (status === 429) {
    return { code: 'ai_rate_limited', userMsg: 'AI 服务限流，请稍后重试' }
  }
  if (status >= 500) {
    return { code: 'ai_upstream_5xx', userMsg: 'AI 服务暂时不可用，请稍后重试' }
  }
  if (status === 400) {
    return { code: 'ai_bad_request', userMsg: 'AI 请求参数错误（可能 prompt 过长）' }
  }
  return { code: 'ai_http_' + status, userMsg: `AI 服务返回 HTTP ${status}` }
}

async function chatCompletion(input) {
  if (!config.ai.base || !config.ai.apiKey) {
    throw createAppError('AI 服务未配置（缺少 AI_API_BASE / AI_API_KEY）', StatusCodes.INTERNAL_SERVER_ERROR)
  }

  // 配额检查（在请求前先查，避免大请求耗费上游）。actor 由 caller 注入。
  if (input.actor) {
    await checkAndIncrementQuota(input.actor, 0) // 先查不加，调用后再加真实 tokens
  }

  const url = config.ai.base.replace(/\/$/, '') + '/v1/chat/completions'
  const body = {
    model: input.model || config.ai.defaultModel,
    messages: input.messages || [],
    max_tokens: input.max_tokens || 600,
    temperature: input.temperature == null ? 0.7 : input.temperature
  }

  let resp
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.ai.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.ai.timeoutMs)
    })
  } catch (err) {
    const msg = err && err.name === 'TimeoutError'
      ? `AI 调用超时（>${config.ai.timeoutMs}ms）`
      : 'AI 服务网络异常'
    logger.error('AI fetch failed: ' + maskKey(err && err.message))
    const e = createAppError(msg, StatusCodes.BAD_GATEWAY)
    e.aiCode = err && err.name === 'TimeoutError' ? 'ai_timeout' : 'ai_network'
    throw e
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    const cls = classifyHttpError(resp.status, text)
    logger.error(`AI HTTP ${resp.status} [${cls.code}]: ${maskKey(text).slice(0, 200)}`)
    const e = createAppError(cls.userMsg, StatusCodes.BAD_GATEWAY)
    e.aiCode = cls.code
    e.aiStatus = resp.status
    throw e
  }

  let json
  try {
    json = await resp.json()
  } catch (err) {
    const e = createAppError('AI 服务响应非 JSON', StatusCodes.BAD_GATEWAY)
    e.aiCode = 'ai_invalid_response'
    throw e
  }

  const content = json && json.choices && json.choices[0]
    && json.choices[0].message && json.choices[0].message.content
  if (!content) {
    const e = createAppError('AI 返回内容为空', StatusCodes.BAD_GATEWAY)
    e.aiCode = 'ai_empty_content'
    throw e
  }

  // 调用成功后累加配额（best-effort，失败不影响业务返回）
  if (input.actor) {
    const totalTokens = (json.usage && json.usage.total_tokens) || 0
    try {
      await checkAndIncrementQuota(input.actor, totalTokens)
    } catch (err) {
      // 累加失败只记日志，不影响响应（已经从上游拿到 content）
      if (err.aiCode !== 'ai_daily_quota_exceeded') {
        logger.warn('ai_usage_daily increment failed: ' + (err && err.message))
      }
    }
  }

  return {
    content: String(content).trim(),
    usage: json.usage || null,
    raw: json
  }
}

module.exports = {
  chatCompletion
}
