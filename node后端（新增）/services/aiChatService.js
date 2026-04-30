/**
 * 管理员 AI 对话服务（长上下文）。
 *
 * 设计要点：
 *   - 对话和消息都是该管理员私有（admin_id 隔离）。
 *   - 发送一条消息：把同一会话里之前所有消息按时间顺序加载，连同新消息一起发给 AI。
 *   - 上下文长度安全阀：按字符数粗略截断，保留 system + 最近的消息，避免触发上游 context_length_exceeded。
 *   - 不对内容做任何业务过滤（这就是用户要的"像 DeepSeek/豆包"的体验）。
 */
const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const config = require('../config')
const logger = require('../utils/logger')
const { chatCompletion } = require('./aiClient')

const DEFAULT_MODEL = () => config.ai.defaultModel || 'gpt-4o-mini'

// 粗略限：让大模型自己处理上下文窗口；这里只兜底防止极端情况把整个 DB 灌进去
const CONTEXT_CHAR_LIMIT = 60000         // ~20k tokens 上限（按 1 token ≈ 3 char 估算）
const MAX_MESSAGE_LEN = 8000             // 单条消息最长 8k 字
const MAX_TITLE_LEN = 60
const MAX_SYSTEM_PROMPT_LEN = 8000

function safeConversation(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    admin_id: Number(row.admin_id),
    title: row.title || '新对话',
    model: row.model || '',
    system_prompt: row.system_prompt || '',
    message_count: Number(row.message_count || 0),
    total_tokens: Number(row.total_tokens || 0),
    archived: Boolean(row.archived),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function safeMessage(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    conversation_id: Number(row.conversation_id),
    role: row.role,
    content: row.content || '',
    model: row.model || null,
    prompt_tokens: row.prompt_tokens != null ? Number(row.prompt_tokens) : null,
    completion_tokens: row.completion_tokens != null ? Number(row.completion_tokens) : null,
    total_tokens: row.total_tokens != null ? Number(row.total_tokens) : null,
    created_at: row.created_at
  }
}

async function ensureConversationOwned(adminId, conversationId) {
  const aid = Number(adminId)
  const cid = Number(conversationId)
  if (!aid || !cid) throw createAppError('参数不完整', StatusCodes.BAD_REQUEST)
  const row = await queryOne('SELECT * FROM ai_chat_conversations WHERE id = ? LIMIT 1', [cid])
  if (!row) throw createAppError('对话不存在', StatusCodes.NOT_FOUND)
  if (Number(row.admin_id) !== aid) throw createAppError('无权访问该对话', StatusCodes.FORBIDDEN)
  return row
}

async function listConversations(adminId, params = {}) {
  const aid = Number(adminId)
  if (!aid) return { list: [] }
  const showArchived = params.archived === '1' || params.archived === 1 || params.archived === true
  const rows = await query(
    `SELECT * FROM ai_chat_conversations
     WHERE admin_id = ? AND archived = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 200`,
    [aid, showArchived ? 1 : 0]
  )
  return { list: rows.map(safeConversation) }
}

async function createConversation(adminId, payload = {}) {
  const aid = Number(adminId)
  if (!aid) throw createAppError('身份信息缺失', StatusCodes.UNAUTHORIZED)
  const title = String(payload.title || '新对话').trim().slice(0, MAX_TITLE_LEN) || '新对话'
  const model = String(payload.model || DEFAULT_MODEL()).trim().slice(0, 64)
  const systemPrompt = String(payload.system_prompt || '').slice(0, MAX_SYSTEM_PROMPT_LEN)

  const result = await execute(
    `INSERT INTO ai_chat_conversations (admin_id, title, model, system_prompt) VALUES (?, ?, ?, ?)`,
    [aid, title, model, systemPrompt || null]
  )
  const row = await queryOne('SELECT * FROM ai_chat_conversations WHERE id = ?', [result.insertId])
  return safeConversation(row)
}

async function updateConversation(adminId, conversationId, patch = {}) {
  const conv = await ensureConversationOwned(adminId, conversationId)
  const fields = []
  const values = []
  if (patch.title !== undefined) {
    const next = String(patch.title || '').trim().slice(0, MAX_TITLE_LEN) || '新对话'
    fields.push('title = ?'); values.push(next)
  }
  if (patch.model !== undefined) {
    fields.push('model = ?'); values.push(String(patch.model || '').trim().slice(0, 64))
  }
  if (patch.system_prompt !== undefined) {
    const next = String(patch.system_prompt || '').slice(0, MAX_SYSTEM_PROMPT_LEN)
    fields.push('system_prompt = ?'); values.push(next || null)
  }
  if (patch.archived !== undefined) {
    fields.push('archived = ?'); values.push(patch.archived ? 1 : 0)
  }
  if (!fields.length) return safeConversation(conv)
  values.push(conv.id)
  await execute(`UPDATE ai_chat_conversations SET ${fields.join(', ')} WHERE id = ?`, values)
  const row = await queryOne('SELECT * FROM ai_chat_conversations WHERE id = ?', [conv.id])
  return safeConversation(row)
}

async function deleteConversation(adminId, conversationId) {
  const conv = await ensureConversationOwned(adminId, conversationId)
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM ai_chat_messages WHERE conversation_id = ?', [conv.id])
    await connection.execute('DELETE FROM ai_chat_conversations WHERE id = ?', [conv.id])
  })
  return { success: true, id: Number(conv.id) }
}

async function listMessages(adminId, conversationId) {
  const conv = await ensureConversationOwned(adminId, conversationId)
  const rows = await query(
    'SELECT * FROM ai_chat_messages WHERE conversation_id = ? ORDER BY id ASC',
    [conv.id]
  )
  return {
    conversation: safeConversation(conv),
    list: rows.map(safeMessage)
  }
}

/**
 * 取最近若干条消息构造成 OpenAI messages 数组，整体字符数不超过 CONTEXT_CHAR_LIMIT。
 * 永远保留 system_prompt（如果有）；从尾部往前累加直到超出预算就停。
 */
function buildContextMessages(systemPrompt, history, newUserContent) {
  const out = []
  let budget = CONTEXT_CHAR_LIMIT
  if (systemPrompt) {
    const sys = String(systemPrompt).slice(0, MAX_SYSTEM_PROMPT_LEN)
    out.push({ role: 'system', content: sys })
    budget -= sys.length
  }
  // 反向累加历史
  const tail = []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i]
    const c = String(m.content || '')
    if (!c) continue
    if (c.length + 8 > budget) break
    tail.unshift({ role: m.role, content: c })
    budget -= c.length + 8
  }
  out.push(...tail)
  out.push({ role: 'user', content: newUserContent })
  return out
}

async function sendMessage(adminId, conversationId, userContent) {
  const conv = await ensureConversationOwned(adminId, conversationId)
  const text = String(userContent || '').trim()
  if (!text) throw createAppError('消息内容不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (text.length > MAX_MESSAGE_LEN) {
    throw createAppError(`消息过长（最多 ${MAX_MESSAGE_LEN} 字，避免 token 浪费）`, StatusCodes.UNPROCESSABLE_ENTITY)
  }
  if (!config.ai.base || !config.ai.apiKey) {
    throw createAppError('AI 服务未配置（缺少 AI_API_BASE / AI_API_KEY）', StatusCodes.INTERNAL_SERVER_ERROR)
  }

  // 1) 写入 user 消息
  const userInsert = await execute(
    `INSERT INTO ai_chat_messages (conversation_id, role, content) VALUES (?, 'user', ?)`,
    [conv.id, text]
  )

  // 2) 拉历史（不含刚插入的 user 也行，因为我们在 buildContextMessages 里把 newUserContent 单独追加）
  const historyRows = await query(
    `SELECT role, content FROM ai_chat_messages
     WHERE conversation_id = ? AND id < ?
     ORDER BY id ASC`,
    [conv.id, userInsert.insertId]
  )

  const messages = buildContextMessages(conv.system_prompt, historyRows, text)
  const model = conv.model || DEFAULT_MODEL()

  // 3) 调上游
  let aiResult
  try {
    aiResult = await chatCompletion({
      model,
      messages,
      max_tokens: 1500,
      temperature: 0.7,
      actor: { type: 'admin', id: Number(adminId) }
    })
  } catch (err) {
    // 上游失败把刚写入的 user 消息保留（用户可点重发），抛出可读错误
    logger.warn(`aiChatService.sendMessage failed: ${err && err.message}`)
    throw err
  }

  const usage = aiResult.usage || {}
  const promptTokens = usage.prompt_tokens != null ? Number(usage.prompt_tokens) : null
  const completionTokens = usage.completion_tokens != null ? Number(usage.completion_tokens) : null
  const totalTokens = usage.total_tokens != null ? Number(usage.total_tokens) : null

  // 4) 写入 assistant 消息 + 更新会话计数
  const assistantInsert = await execute(
    `INSERT INTO ai_chat_messages
       (conversation_id, role, content, model, prompt_tokens, completion_tokens, total_tokens)
     VALUES (?, 'assistant', ?, ?, ?, ?, ?)`,
    [conv.id, aiResult.content, model, promptTokens, completionTokens, totalTokens]
  )

  // 自动用首轮 user 内容当标题（仅当当前还是默认"新对话"）
  const isFirstTurn = (Number(conv.message_count) || 0) === 0
  const nextTitle = (isFirstTurn && (!conv.title || conv.title === '新对话'))
    ? text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LEN) || conv.title
    : conv.title

  await execute(
    `UPDATE ai_chat_conversations
       SET message_count = message_count + 2,
           total_tokens = total_tokens + ?,
           title = ?
     WHERE id = ?`,
    [Number(totalTokens || 0), nextTitle, conv.id]
  )

  const userRow = await queryOne('SELECT * FROM ai_chat_messages WHERE id = ?', [userInsert.insertId])
  const assistantRow = await queryOne('SELECT * FROM ai_chat_messages WHERE id = ?', [assistantInsert.insertId])
  const finalConv = await queryOne('SELECT * FROM ai_chat_conversations WHERE id = ?', [conv.id])

  return {
    conversation: safeConversation(finalConv),
    user_message: safeMessage(userRow),
    assistant_message: safeMessage(assistantRow)
  }
}

async function clearMessages(adminId, conversationId) {
  const conv = await ensureConversationOwned(adminId, conversationId)
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM ai_chat_messages WHERE conversation_id = ?', [conv.id])
    await connection.execute(
      'UPDATE ai_chat_conversations SET message_count = 0, total_tokens = 0 WHERE id = ?',
      [conv.id]
    )
  })
  const row = await queryOne('SELECT * FROM ai_chat_conversations WHERE id = ?', [conv.id])
  return safeConversation(row)
}

module.exports = {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  listMessages,
  sendMessage,
  clearMessages
}
