/**
 * 孩子档案分析（人工 / AI）服务。
 *
 * 模式：
 *   - human：只展示最新一条人工分析；AI 不调用
 *   - ai：拉最新 AI 分析；过期或不存在则触发 GPT 生成（few-shot 模仿历史人工范例）
 *
 * 配置存 system_configs.ai_analysis_config（与 profile_field_config 同表）。
 */
const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { safeJsonParse, safeJsonStringify } = require('../utils/helpers')
const config = require('../config')
const logger = require('../utils/logger')
const { chatCompletion } = require('./aiClient')

const CONFIG_KEY = 'ai_analysis_config'

const DEFAULT_CONFIG = {
  mode: 'human',
  model: config.ai.defaultModel || 'gpt-4o-mini',
  few_shot_count: 5,
  system_prompt:
    '你是一名儿童视力健康顾问。请根据下方孩子档案数据，写一段 200-400 字的中文分析报告，重点关注视力变化、屈光、中医证型、风险等级，给出 3-5 条具体建议。语气专业而温和，避免使用 markdown 标题，分段自然。',
  stale_hours: 24
}

const DEFAULT_CORRECTION_BASE_OPTIONS = Object.freeze([
  { code: 'data_mismatch', label: '与孩子档案数据不一致', source: 'base' },
  { code: 'missing_key_points', label: '遗漏了关键信息', source: 'base' },
  { code: 'vision_interpretation', label: '视力/屈光/眼轴解读不准确', source: 'base' },
  { code: 'tcm_or_risk', label: '中医证型或风险判断需修正', source: 'base' },
  { code: 'advice_not_specific', label: '建议不够具体可执行', source: 'base' },
  { code: 'structure_expression', label: '结构或表达需要调整', source: 'base' },
  { code: 'tone_not_fit', label: '语气不够合适', source: 'base' },
  { code: 'logic_consistency', label: '结论前后逻辑不够一致', source: 'base' }
])

/** 读取当前 AI 分析配置（缺失时返回默认）。 */
async function getConfig() {
  const row = await queryOne(
    'SELECT config_value FROM system_configs WHERE config_key = ? LIMIT 1',
    [CONFIG_KEY]
  )
  const parsed = safeJsonParse(row ? row.config_value : null, null)
  return Object.assign({}, DEFAULT_CONFIG, parsed || {})
}

/** 更新 AI 分析配置。从 human → ai 时自动触发批量生成。 */
async function setConfig(patch = {}) {
  const cur = await getConfig()
  const next = {
    mode: patch.mode === 'ai' ? 'ai' : 'human',
    model: String(patch.model || cur.model || DEFAULT_CONFIG.model).slice(0, 64),
    few_shot_count: Math.max(0, Math.min(20, Number(patch.few_shot_count != null ? patch.few_shot_count : cur.few_shot_count))),
    system_prompt: String(patch.system_prompt || cur.system_prompt || DEFAULT_CONFIG.system_prompt).slice(0, 4000),
    stale_hours: Math.max(1, Math.min(720, Number(patch.stale_hours != null ? patch.stale_hours : cur.stale_hours)))
  }
  const existing = await queryOne(
    'SELECT id FROM system_configs WHERE config_key = ? LIMIT 1',
    [CONFIG_KEY]
  )
  if (existing) {
    await execute(
      'UPDATE system_configs SET config_value = ?, updated_at = NOW() WHERE id = ?',
      [safeJsonStringify(next), existing.id]
    )
  } else {
    await execute(
      'INSERT INTO system_configs (config_key, config_value) VALUES (?, ?)',
      [CONFIG_KEY, safeJsonStringify(next)]
    )
  }

  if (cur.mode !== 'ai' && next.mode === 'ai') {
    setImmediate(() => {
      bulkGenerateAiAnalyses({ trigger: 'mode_switch' }).catch((err) => {
        logger.warn('bulkGenerateAiAnalyses(mode_switch) failed: ' + (err && err.message))
      })
    })
  }
  return next
}

// ============ 批量生成 AI 分析 ============

const bulkState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  trigger: null,
  total: 0,
  done: 0,
  ok: 0,
  failed: 0,
  errors: []
}

function getBulkStatus() {
  return { ...bulkState, errors: bulkState.errors.slice(-10) }
}

async function pickChildrenNeedingAi(limit = 1000) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000))
  const rows = await query(
    `SELECT c.id
     FROM children c
     LEFT JOIN child_ai_analysis a
       ON a.child_id = c.id AND a.active = 1
     WHERE c.active = 1 AND a.id IS NULL
     ORDER BY c.id ASC
     LIMIT ${safeLimit}`
  )
  return rows.map((r) => Number(r.id))
}

/**
 * 批量给「无任何 active 分析」的孩子生成 AI 报告。
 *  - in-flight 锁：同时只跑一次
 *  - 限速：每个孩子之间默认 sleep 1.5s
 *  - 单孩子失败不中断整体
 */
async function bulkGenerateAiAnalyses(opts = {}) {
  if (bulkState.running) {
    return { status: 'already_running', state: getBulkStatus() }
  }
  if (!config.ai.base || !config.ai.apiKey) {
    return { status: 'ai_not_configured' }
  }

  const intervalMs = Math.max(0, Math.min(Number(opts.interval_ms) || 1500, 30000))
  const limit = Math.max(1, Math.min(Number(opts.limit) || 1000, 5000))
  const childIds = await pickChildrenNeedingAi(limit)

  Object.assign(bulkState, {
    running: true,
    startedAt: new Date(),
    finishedAt: null,
    trigger: opts.trigger || 'manual',
    total: childIds.length,
    done: 0,
    ok: 0,
    failed: 0,
    errors: []
  })
  logger.info(`bulkGenerateAiAnalyses 启动 trigger=${bulkState.trigger} total=${childIds.length}`)

  ;(async () => {
    for (const cid of childIds) {
      try {
        await generateAiAnalysis(cid)
        bulkState.ok += 1
      } catch (err) {
        bulkState.failed += 1
        bulkState.errors.push({
          child_id: cid,
          message: String((err && err.message) || err).slice(0, 300)
        })
        logger.warn(`bulk gen child ${cid} failed: ${err && err.message}`)
      }
      bulkState.done += 1
      if (intervalMs > 0 && bulkState.done < childIds.length) {
        await new Promise((r) => setTimeout(r, intervalMs))
      }
    }
    bulkState.running = false
    bulkState.finishedAt = new Date()
    logger.info(`bulkGenerateAiAnalyses 完成 ok=${bulkState.ok} failed=${bulkState.failed}`)
  })().catch((err) => {
    bulkState.running = false
    bulkState.finishedAt = new Date()
    logger.error('bulkGenerateAiAnalyses crashed: ' + (err && err.stack || err))
  })

  return { status: 'started', total: childIds.length }
}

/** 安全输出一条分析记录。 */
function safeAnalysis(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    child_id: Number(row.child_id),
    source: row.source,
    content: row.content || '',
    model: row.model || null,
    prompt_meta: row.prompt_meta && typeof row.prompt_meta === 'object'
      ? row.prompt_meta
      : safeJsonParse(row.prompt_meta, null),
    tokens_used: row.tokens_used != null ? Number(row.tokens_used) : null,
    created_by_employee_id: row.created_by_employee_id != null ? Number(row.created_by_employee_id) : null,
    created_by_admin_id: row.created_by_admin_id != null ? Number(row.created_by_admin_id) : null,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function getBaseCorrectionOptions() {
  return DEFAULT_CORRECTION_BASE_OPTIONS.map((item) => ({ ...item }))
}

function normalizeCorrectionOption(item, fallbackSource = 'base', index = 0) {
  const labelRaw = typeof item === 'string'
    ? item
    : item && typeof item === 'object'
      ? (item.label || item.text || item.title || '')
      : ''
  const label = String(labelRaw || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!label) return null

  const codeRaw = item && typeof item === 'object' && (item.code || item.key)
    ? String(item.code || item.key)
    : `opt_${index + 1}`
  const sourceRaw = item && typeof item === 'object' && item.source
    ? String(item.source)
    : fallbackSource
  const safeSource = ['base', 'ai', 'selected', 'custom'].includes(sourceRaw) ? sourceRaw : fallbackSource
  const code = String(codeRaw || `opt_${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || `opt_${index + 1}`

  return {
    code,
    label,
    source: safeSource
  }
}

function uniqueCorrectionOptions(items, fallbackSource = 'base', limit = 8) {
  const out = []
  const seen = new Set()
  for (let index = 0; index < (Array.isArray(items) ? items.length : 0); index += 1) {
    const normalized = normalizeCorrectionOption(items[index], fallbackSource, index)
    if (!normalized) continue
    const key = `${normalized.source}:${normalized.code}:${normalized.label.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= limit) break
  }
  return out
}

function safeCorrection(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    child_id: Number(row.child_id),
    original_analysis_id: Number(row.original_analysis_id),
    corrected_analysis_id: Number(row.corrected_analysis_id),
    question_prompt: row.question_prompt || '',
    question_summary: row.question_summary || '',
    generated_options: uniqueCorrectionOptions(safeJsonParse(row.generated_options, []), 'ai', 12),
    selected_options: uniqueCorrectionOptions(safeJsonParse(row.selected_options, []), 'selected', 12),
    custom_reason: row.custom_reason || '',
    created_by_employee_id: row.created_by_employee_id != null ? Number(row.created_by_employee_id) : null,
    created_by_admin_id: row.created_by_admin_id != null ? Number(row.created_by_admin_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function extractJsonObject(text) {
  if (!text) return null
  const direct = safeJsonParse(text, null)
  if (direct && typeof direct === 'object') return direct
  const raw = String(text)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return safeJsonParse(raw.slice(start, end + 1), null)
}

function normalizeComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildCorrectionPromptFallback() {
  return {
    prompt: '你主要为什么修改这份 AI 分析？',
    summary: '请勾选本次修订最主要的原因；如果选项不够，请补充填写。',
    base_options: getBaseCorrectionOptions(),
    suggested_options: []
  }
}

/** 列出某孩子的全部分析（按时间倒序，含 active=0）。 */
async function listAnalysesByChild(childId, opts = {}) {
  const cid = Number(childId)
  if (!cid) return []
  const onlyActive = opts.onlyActive !== false
  const where = onlyActive ? 'child_id = ? AND active = 1' : 'child_id = ?'
  const rows = await query(
    `SELECT * FROM child_ai_analysis WHERE ${where} ORDER BY id DESC LIMIT 50`,
    [cid]
  )
  return rows.map(safeAnalysis)
}

/** 拿某孩子最新 active 分析（任意来源）。 */
async function getLatestActiveByChild(childId) {
  const row = await queryOne(
    `SELECT * FROM child_ai_analysis WHERE child_id = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
    [Number(childId)]
  )
  return safeAnalysis(row)
}

/** 拿最新 active 人工分析。 */
async function getLatestActiveHumanByChild(childId) {
  const row = await queryOne(
    `SELECT * FROM child_ai_analysis WHERE child_id = ? AND active = 1 AND source = 'human' ORDER BY id DESC LIMIT 1`,
    [Number(childId)]
  )
  return safeAnalysis(row)
}

/** 拿最新 active AI 分析。 */
async function getLatestActiveAiByChild(childId) {
  const row = await queryOne(
    `SELECT * FROM child_ai_analysis WHERE child_id = ? AND active = 1 AND source = 'ai' ORDER BY id DESC LIMIT 1`,
    [Number(childId)]
  )
  return safeAnalysis(row)
}

/** 拿“未过期”的 active AI 分析。 */
async function getFreshActiveAiByChild(childId, staleHours) {
  const cid = Number(childId)
  const hours = Math.max(1, Math.min(720, Number(staleHours || 24)))
  const row = await queryOne(
    `SELECT a.* FROM child_ai_analysis a
     INNER JOIN children c ON c.id = a.child_id
     WHERE a.child_id = ? AND a.active = 1 AND a.source = 'ai'
       AND a.created_at >= NOW() - INTERVAL ${hours} HOUR
       AND a.created_at >= c.updated_at
     ORDER BY a.id DESC LIMIT 1`,
    [cid]
  )
  return safeAnalysis(row)
}

function validateHumanAnalysisPayload(childId, content) {
  const cid = Number(childId)
  const text = String(content || '').trim()
  if (!cid) throw createAppError('child_id 必填', StatusCodes.BAD_REQUEST)
  if (!text) throw createAppError('分析内容不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (text.length > 5000) throw createAppError('分析内容过长（最多 5000 字）', StatusCodes.UNPROCESSABLE_ENTITY)
  return { cid, text }
}

async function insertHumanAnalysisRecord(connection, { child_id, content, employee_id, admin_id, prompt_meta = null }) {
  const promptMetaValue = prompt_meta ? safeJsonStringify(prompt_meta) : null
  const [result] = await connection.execute(
    `INSERT INTO child_ai_analysis (child_id, source, content, model, prompt_meta, created_by_employee_id, created_by_admin_id)
     VALUES (?, 'human', ?, NULL, ?, ?, ?)`,
    [Number(child_id), String(content || '').trim(), promptMetaValue, employee_id || null, admin_id || null]
  )
  const [rows] = await connection.execute('SELECT * FROM child_ai_analysis WHERE id = ?', [result.insertId])
  return safeAnalysis(Array.isArray(rows) ? rows[0] : null)
}

/** 写一条人工分析。写完触发风格包蒸馏。 */
async function createHumanAnalysis({ child_id, content, employee_id, admin_id, prompt_meta = null }) {
  const { cid, text } = validateHumanAnalysisPayload(child_id, content)
  const analysis = await withTransaction(async (connection) => {
    return insertHumanAnalysisRecord(connection, {
      child_id: cid,
      content: text,
      employee_id,
      admin_id,
      prompt_meta
    })
  })

  try { maybeRegenerateStylePackAsync() } catch (_) {}
  return analysis
}

/** 软删一条分析。 */
async function deactivateAnalysis(id) {
  const aid = Number(id)
  if (!aid) throw createAppError('id 必填', StatusCodes.BAD_REQUEST)
  await execute('UPDATE child_ai_analysis SET active = 0 WHERE id = ?', [aid])
  return { success: true, id: aid }
}

// ============ Style Pack（风格知识包）============

/** 取当前 active 风格包；不存在返回 null。 */
async function getActiveStylePack() {
  const row = await queryOne(
    'SELECT * FROM ai_style_pack WHERE active = 1 ORDER BY id DESC LIMIT 1'
  )
  if (!row) return null
  return {
    id: Number(row.id),
    version: Number(row.version),
    based_on_count: Number(row.based_on_count),
    based_on_max_human_id: row.based_on_max_human_id != null ? Number(row.based_on_max_human_id) : null,
    content: row.content || '',
    model: row.model || null,
    tokens_used: row.tokens_used != null ? Number(row.tokens_used) : null,
    active: Boolean(row.active),
    created_at: row.created_at
  }
}

/** 列历史风格包（最多 20 条）。 */
async function listStylePacks() {
  const rows = await query(
    'SELECT * FROM ai_style_pack ORDER BY version DESC LIMIT 20'
  )
  return rows.map((row) => ({
    id: Number(row.id),
    version: Number(row.version),
    based_on_count: Number(row.based_on_count),
    based_on_max_human_id: row.based_on_max_human_id != null ? Number(row.based_on_max_human_id) : null,
    content: row.content || '',
    model: row.model || null,
    tokens_used: row.tokens_used != null ? Number(row.tokens_used) : null,
    active: Boolean(row.active),
    created_at: row.created_at
  }))
}

/** 从所有 active 人工分析里蒸馏风格指南。 */
async function distillStylePackContent(model) {
  const rows = await query(
    `SELECT id, content FROM child_ai_analysis
     WHERE active = 1 AND source = 'human'
     ORDER BY id DESC LIMIT 50`,
    []
  )
  if (rows.length < 3) {
    throw createAppError('人工分析不足 3 条，无需提炼风格包', StatusCodes.UNPROCESSABLE_ENTITY)
  }
  const examples = rows.slice().reverse()
  const exampleBlock = examples
    .map((row, index) => `【范例 ${index + 1}】（id=${row.id}）\n${row.content}`)
    .join('\n\n')

  const correctionDistillationNotes = await buildCorrectionDistillationNotes(50)

  const messages = [
    {
      role: 'system',
      content:
        '你是 NLP 风格分析专家。请阅读多条专家撰写的儿童视力健康分析报告，提炼出一份“风格指南”，用于让另一位 AI 模仿该风格写新报告。\n\n' +
        '输出要求（500-1000 字中文）：\n' +
        '1. 段落结构（开头/中段/结尾各侧重什么）\n' +
        '2. 用词偏好（专业术语 vs 口语化的边界）\n' +
        '3. 数据呈现方式（视力 / 屈光 / 眼轴 / 中医证型如何描述）\n' +
        '4. 结论与建议的写法（是否分点、深浅程度、是否给量化数据）\n' +
        '5. 整体语气与温度\n' +
        '6. 结合修订反馈总结最该避免的问题与最该强化的表达\n\n' +
        '不要复述原文，只总结通用规则；不要使用 markdown 标题，分自然段输出。'
    },
    { role: 'user', content: '以下是 ' + examples.length + ' 条专家分析报告：\n\n' + exampleBlock + (correctionDistillationNotes ? ('\n\n最近修订反馈：\n' + correctionDistillationNotes) : '') }
  ]


  const result = await chatCompletion({
    model: model || (await getConfig()).model,
    messages,
    max_tokens: 1200,
    temperature: 0.3,
    actor: { type: 'system', id: 0 } // 风格包蒸馏归为 system 配额（不限）
  })
  return {
    content: result.content,
    based_on_count: rows.length,
    based_on_max_human_id: Number(rows[0].id),
    tokens_used: result.usage && result.usage.total_tokens != null ? Number(result.usage.total_tokens) : null
  }
}

/** 强制提炼一次新风格包。 */
async function regenerateStylePack(opts = {}) {
  const cfg = await getConfig()
  const distilled = await distillStylePackContent(opts.model || cfg.model)
  const lastRow = await queryOne('SELECT version FROM ai_style_pack ORDER BY version DESC LIMIT 1')
  const nextVersion = (lastRow && Number(lastRow.version) || 0) + 1
  await execute('UPDATE ai_style_pack SET active = 0 WHERE active = 1')
  const ins = await execute(
    `INSERT INTO ai_style_pack (version, based_on_count, based_on_max_human_id, content, model, tokens_used, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      nextVersion,
      distilled.based_on_count,
      distilled.based_on_max_human_id,
      distilled.content,
      opts.model || cfg.model,
      distilled.tokens_used
    ]
  )
  logger.info(`ai_style_pack v${nextVersion} 蒸馏成功，基于 ${distilled.based_on_count} 条人工分析`)
  const row = await queryOne('SELECT * FROM ai_style_pack WHERE id = ?', [ins.insertId])
  return {
    id: Number(row.id),
    version: Number(row.version),
    based_on_count: Number(row.based_on_count),
    based_on_max_human_id: row.based_on_max_human_id != null ? Number(row.based_on_max_human_id) : null,
    content: row.content,
    model: row.model,
    tokens_used: row.tokens_used != null ? Number(row.tokens_used) : null,
    active: true,
    created_at: row.created_at
  }
}

let lastDistillAttemptAt = 0
let distillInFlight = false
const DISTILL_DEBOUNCE_MS = 60 * 60 * 1000  // 1 小时（避免频繁触发烧 token，最多每天 24 次）

function maybeRegenerateStylePackAsync() {
  const now = Date.now()
  if (distillInFlight) return
  if (now - lastDistillAttemptAt < DISTILL_DEBOUNCE_MS) return
  lastDistillAttemptAt = now
  distillInFlight = true
  ;(async () => {
    try {
      const lastPack = await getActiveStylePack()
      const lastHuman = await queryOne(
        `SELECT id FROM child_ai_analysis WHERE active = 1 AND source = 'human' ORDER BY id DESC LIMIT 1`
      )
      if (!lastHuman) return
      if (lastPack && Number(lastHuman.id) <= Number(lastPack.based_on_max_human_id || 0)) return
      await regenerateStylePack()
    } catch (err) {
      logger.warn('maybeRegenerateStylePack failed: ' + (err && err.message))
    } finally {
      distillInFlight = false
    }
  })().catch(() => {})
}

/** 把 children 行裁剪成传给 GPT 的脱敏摘要。 */
function buildChildSummary(child) {
  if (!child) return {}
  const safeKeys = [
    'name', 'gender', 'dob', 'age', 'school', 'grade_name', 'class_name',
    'height', 'weight',
    'vision_l', 'vision_r', 'vision_both',
    'refraction_l', 'refraction_r', 'refraction_l_detail', 'refraction_r_detail',
    'curvature_l', 'curvature_r',
    'axial_length_l', 'axial_length_r',
    'symptoms', 'symptom_other', 'additional_note',
    'tongue_shape', 'tongue_color', 'tongue_coating',
    'face_color', 'lip_color', 'hair',
    'tcm_symptoms_json', 'tcm_symptom_other',
    'tcm_syndrome_types', 'tcm_syndrome_other',
    'risk_level', 'treatment_plans', 'treatment_other',
    'diagnosis_json', 'management_plan',
    'optometrist_name', 'doctor_name', 'exam_date'
  ]
  const out = {}
  for (const key of safeKeys) {
    const value = child[key]
    if (value == null || value === '') continue
    out[key] = value
  }
  return out
}

/** 拉 few-shot 历史人工分析。 */
async function loadFewShotExamples(limit) {
  if (limit <= 0) return []
  const rows = await query(
    `SELECT a.id, a.content, a.child_id,
            c.name, c.gender, c.dob, c.age, c.school, c.grade_name, c.class_name,
            c.vision_l, c.vision_r, c.vision_both, c.refraction_l, c.refraction_r,
            c.tongue_color, c.tongue_coating, c.face_color,
            c.tcm_syndrome_types, c.risk_level, c.treatment_plans,
            c.diagnosis_json, c.management_plan
     FROM child_ai_analysis a
     INNER JOIN children c ON c.id = a.child_id
     WHERE a.active = 1 AND a.source = 'human'
     ORDER BY a.id DESC
     LIMIT ${Number(limit)}`,
    []
  )
  return rows.map((row) => ({
    content: row.content,
    child_summary: buildChildSummary(row)
  }))
}

const generationLocks = new Map()

/** 调 GPT 生成 AI 分析并落库。 */
async function generateAiAnalysis(childId, opts = {}) {
  const cid = Number(childId)
  if (!cid) throw createAppError('child_id 必填', StatusCodes.BAD_REQUEST)

  if (generationLocks.has(cid)) {
    return generationLocks.get(cid)
  }
  const promise = (async () => {
    try {
      return await doGenerateAiAnalysis(cid, opts)
    } finally {
      generationLocks.delete(cid)
    }
  })()
  generationLocks.set(cid, promise)
  return promise
}

async function doGenerateAiAnalysis(cid, opts = {}) {
  const child = await queryOne('SELECT * FROM children WHERE id = ? LIMIT 1', [cid])
  if (!child) throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)

  const cfg = await getConfig()
  const childSummary = buildChildSummary(child)
  const correctionLearningNotes = await buildCorrectionLearningNotes(20)
  const stylePack = await getActiveStylePack()
  let promptMode = 'cold_start'
  let examplesUsed = 0
  let stylePackVersion = null

  const messages = []

  if (stylePack && stylePack.content) {
    promptMode = 'style_pack'
    stylePackVersion = stylePack.version
    messages.push({
      role: 'system',
      content:
        cfg.system_prompt +
        '\n\n## 风格指南（基于 ' + stylePack.based_on_count + ' 条专家人工分析蒸馏，版本 v' + stylePack.version + '）\n' +
        stylePack.content +
        (correctionLearningNotes ? ('\n\n' + correctionLearningNotes) : '') +
        '\n\n请严格按上述风格指南撰写。'
    })
  } else {
    const examples = await loadFewShotExamples(Math.max(cfg.few_shot_count, 3))
    examplesUsed = examples.length
    promptMode = examples.length > 0 ? 'few_shot' : 'cold_start'
    messages.push({
      role: 'system',
      content: cfg.system_prompt + (examples.length > 0
        ? '\n\n下面是过往专家分析示例，请模仿其风格和深度。'
        : '\n\n（尚无历史范例，请按专业风格自由发挥。）') +
        (correctionLearningNotes ? ('\n\n' + correctionLearningNotes) : '')
    })
    for (const example of examples) {
      messages.push({ role: 'user', content: '孩子档案：\n' + JSON.stringify(example.child_summary, null, 2) })
      messages.push({ role: 'assistant', content: example.content })
    }
  }

  messages.push({
    role: 'user',
    content: '现在请为下面这个孩子写一份分析：\n' + JSON.stringify(childSummary, null, 2)
  })

  let result
  try {
    // 谁触发的：admin 手动 generate / employee 浏览 / system 批量
    const actor = opts.actor_admin_id
      ? { type: 'admin', id: Number(opts.actor_admin_id) }
      : opts.actor_employee_id
        ? { type: 'employee', id: Number(opts.actor_employee_id) }
        : { type: 'system', id: 0 }
    result = await chatCompletion({
      model: cfg.model,
      messages,
      max_tokens: 600,
      temperature: 0.7,
      actor
    })
  } catch (err) {
    logger.warn('generateAiAnalysis failed for child ' + cid + ': ' + (err && err.message))
    throw err
  }

  const insert = await execute(
    `INSERT INTO child_ai_analysis (child_id, source, content, model, prompt_meta, tokens_used, created_by_admin_id)
     VALUES (?, 'ai', ?, ?, ?, ?, ?)`,
    [
      cid,
      result.content,
      cfg.model,
      safeJsonStringify({
        prompt_mode: promptMode,
        style_pack_version: stylePackVersion,
        few_shot_count: examplesUsed,
        system_prompt_len: (cfg.system_prompt || '').length
      }),
      result.usage && result.usage.total_tokens != null ? Number(result.usage.total_tokens) : null,
      opts.actor_admin_id || null
    ]
  )
  const row = await queryOne('SELECT * FROM child_ai_analysis WHERE id = ?', [insert.insertId])
  return safeAnalysis(row)
}

/** 根据原始 AI 与修订稿，实时生成追问提示与候选项。 */
async function generateCorrectionPrompt({ child_id, analysis_id, edited_content, employee_id, admin_id }) {
  const opts = { actor_employee_id: employee_id, actor_admin_id: admin_id }
  const cid = Number(child_id)
  const aid = Number(analysis_id)
  const edited = String(edited_content || '').trim()
  if (!cid || !aid) throw createAppError('参数不完整', StatusCodes.BAD_REQUEST)
  if (!edited) throw createAppError('修订内容不能为空', StatusCodes.UNPROCESSABLE_ENTITY)

  const original = await queryOne('SELECT * FROM child_ai_analysis WHERE id = ? LIMIT 1', [aid])
  if (!original || Number(original.child_id) !== cid) {
    throw createAppError('原始 AI 分析不存在', StatusCodes.NOT_FOUND)
  }
  if (original.source !== 'ai') {
    throw createAppError('仅支持修订 AI 生成的分析', StatusCodes.UNPROCESSABLE_ENTITY)
  }

  const fallback = buildCorrectionPromptFallback()
  if (!config.ai.base || !config.ai.apiKey) {
    return fallback
  }

  const child = await queryOne('SELECT * FROM children WHERE id = ? LIMIT 1', [cid])
  const childSummary = buildChildSummary(child)

  const messages = [
    {
      role: 'system',
      content:
        '你是儿童视力分析质检助手。你会收到一份原始 AI 报告和一份员工修订后的版本。' +
        '请输出一个 JSON 对象，用于继续追问员工“为什么这样修改”，帮助优化后续蒸馏风格包和分析准确性。\n\n' +
        '只允许输出 JSON，不要输出 markdown，不要解释。格式如下：\n' +
        '{"prompt":"...","summary":"...","options":["...","..."]}\n\n' +
        '要求：\n' +
        '1. prompt 是 12-30 字中文问句，聚焦本次主要改动原因。\n' +
        '2. summary 是 20-80 字中文总结，概括这次改动重点。\n' +
        '3. options 提供 3-5 个简短可勾选短语，尽量具体，不要和通用标签重复，不要带序号。\n' +
        '4. 如果改动主要是补充数据、修正结论、调整建议或语气，请体现这些重点。'
    },
    {
      role: 'user',
      content:
        '孩子档案摘要：\n' + JSON.stringify(childSummary, null, 2) +
        '\n\n原始 AI 报告：\n' + String(original.content || '').slice(0, 1600) +
        '\n\n员工修订版：\n' + edited.slice(0, 1600)
    }
  ]

  try {
    const result = await chatCompletion({
      model: (await getConfig()).model,
      messages,
      max_tokens: 320,
      temperature: 0.4,
      actor: opts && opts.actor_employee_id
        ? { type: 'employee', id: Number(opts.actor_employee_id) }
        : opts && opts.actor_admin_id
          ? { type: 'admin', id: Number(opts.actor_admin_id) }
          : { type: 'system', id: 0 }
    })
    const parsed = extractJsonObject(result.content)
    if (!parsed || typeof parsed !== 'object') {
      return fallback
    }

    const prompt = String(parsed.prompt || fallback.prompt).trim().slice(0, 80) || fallback.prompt
    const summary = String(parsed.summary || fallback.summary).trim().slice(0, 200) || fallback.summary
    const baseOptions = fallback.base_options
    const baseLabels = new Set(baseOptions.map((item) => item.label.toLowerCase()))
    const suggestedOptions = uniqueCorrectionOptions(Array.isArray(parsed.options) ? parsed.options : [], 'ai', 5)
      .filter((item) => !baseLabels.has(item.label.toLowerCase()))

    return {
      prompt,
      summary,
      base_options: baseOptions,
      suggested_options: suggestedOptions
    }
  } catch (err) {
    logger.warn('generateCorrectionPrompt failed: ' + (err && err.message))
    return fallback
  }
}

/** 保存员工对 AI 报告的修订与原因反馈。 */
async function createAnalysisCorrection({
  child_id,
  analysis_id,
  edited_content,
  selected_options,
  custom_reason,
  question_prompt,
  question_summary,
  generated_options,
  employee_id,
  admin_id
}) {
  const cid = Number(child_id)
  const aid = Number(analysis_id)
  const edited = String(edited_content || '').trim()
  if (!cid || !aid) throw createAppError('参数不完整', StatusCodes.BAD_REQUEST)
  if (!edited) throw createAppError('修订内容不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (edited.length > 5000) throw createAppError('修订内容过长（最多 5000 字）', StatusCodes.UNPROCESSABLE_ENTITY)

  const selected = uniqueCorrectionOptions(selected_options, 'selected', 12)
  const generated = uniqueCorrectionOptions(generated_options, 'ai', 12)
  const prompt = String(question_prompt || '').trim().slice(0, 120)
  const summary = String(question_summary || '').trim().slice(0, 300)
  const custom = String(custom_reason || '').trim().slice(0, 1000)

  if (!selected.length && !custom) {
    throw createAppError('请至少选择一个修改原因或填写补充说明', StatusCodes.UNPROCESSABLE_ENTITY)
  }

  const result = await withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT * FROM child_ai_analysis WHERE id = ? LIMIT 1',
      [aid]
    )
    const original = Array.isArray(rows) ? rows[0] : null
    if (!original || Number(original.child_id) !== cid) {
      throw createAppError('原始 AI 分析不存在', StatusCodes.NOT_FOUND)
    }
    if (original.source !== 'ai') {
      throw createAppError('仅支持修订 AI 生成的分析', StatusCodes.UNPROCESSABLE_ENTITY)
    }
    if (normalizeComparableText(original.content) === normalizeComparableText(edited)) {
      throw createAppError('请先修改 AI 报告内容后再提交', StatusCodes.UNPROCESSABLE_ENTITY)
    }

    const analysis = await insertHumanAnalysisRecord(connection, {
      child_id: cid,
      content: edited,
      employee_id,
      admin_id,
      prompt_meta: {
        analysis_kind: 'ai_correction',
        corrected_from_analysis_id: aid,
        correction_reason_count: selected.length,
        has_custom_reason: Boolean(custom),
        question_prompt: prompt || null
      }
    })

    const [insertResult] = await connection.execute(
      `INSERT INTO ai_analysis_corrections (
        child_id,
        original_analysis_id,
        corrected_analysis_id,
        original_content,
        corrected_content,
        question_prompt,
        question_summary,
        generated_options,
        selected_options,
        custom_reason,
        created_by_employee_id,
        created_by_admin_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cid,
        aid,
        analysis.id,
        String(original.content || ''),
        edited,
        prompt || null,
        summary || null,
        generated.length ? safeJsonStringify(generated) : null,
        selected.length ? safeJsonStringify(selected) : null,
        custom || null,
        employee_id || null,
        admin_id || null
      ]
    )

    const [correctionRows] = await connection.execute(
      'SELECT * FROM ai_analysis_corrections WHERE id = ?',
      [insertResult.insertId]
    )

    return {
      original_analysis: safeAnalysis(original),
      analysis,
      correction: safeCorrection(Array.isArray(correctionRows) ? correctionRows[0] : null)
    }
  })

  try { maybeRegenerateStylePackAsync() } catch (_) {}
  return result
}

async function listCorrections(params = {}) {
  const page = Math.max(Number.parseInt(params.page || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(Number.parseInt(params.page_size || '20', 10) || 20, 1), 100)
  const offset = (page - 1) * pageSize
  const conditions = []
  const values = []

  if (params.child_id) {
    conditions.push('c.child_id = ?')
    values.push(Number(params.child_id))
  }
  if (params.source_employee_id) {
    conditions.push('c.created_by_employee_id = ?')
    values.push(Number(params.source_employee_id))
  }
  if (params.analysis_id) {
    conditions.push('(c.original_analysis_id = ? OR c.corrected_analysis_id = ?)')
    values.push(Number(params.analysis_id), Number(params.analysis_id))
  }
  if (params.keyword) {
    conditions.push('(ch.name LIKE ? OR c.corrected_content LIKE ? OR c.custom_reason LIKE ? OR c.question_summary LIKE ?)')
    const kw = `%${String(params.keyword).trim()}%`
    values.push(kw, kw, kw, kw)
  }
  if (params.reason_code) {
    conditions.push('JSON_SEARCH(COALESCE(c.selected_options, JSON_ARRAY()), "one", ?, NULL, "$[*].code") IS NOT NULL')
    values.push(String(params.reason_code))
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total
     FROM ai_analysis_corrections c
     LEFT JOIN children ch ON ch.id = c.child_id
     ${whereClause}`,
    values
  )

  const rows = await query(
    `SELECT c.*, ch.name AS child_name, ch.school, ch.grade_name,
            e.display_name AS employee_name, e.phone AS employee_phone,
            oa.model AS original_model,
            oa.created_at AS original_created_at,
            oa.content AS original_ai_content,
            ca.content AS corrected_analysis_content,
            ca.created_at AS corrected_created_at
     FROM ai_analysis_corrections c
     LEFT JOIN children ch ON ch.id = c.child_id
     LEFT JOIN employees e ON e.id = c.created_by_employee_id
     LEFT JOIN child_ai_analysis oa ON oa.id = c.original_analysis_id
     LEFT JOIN child_ai_analysis ca ON ca.id = c.corrected_analysis_id
     ${whereClause}
     ORDER BY c.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  const list = rows.map((row) => ({
    ...safeCorrection(row),
    child_name: row.child_name || '',
    school: row.school || '',
    grade_name: row.grade_name || '',
    employee_name: row.employee_name || '',
    employee_phone: row.employee_phone || '',
    original_model: row.original_model || '',
    original_created_at: row.original_created_at || null,
    corrected_created_at: row.corrected_created_at || null,
    original_content: row.original_content || row.original_ai_content || '',
    corrected_content: row.corrected_content || row.corrected_analysis_content || ''
  }))

  return {
    list,
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

async function getCorrectionReasonStats() {
  const rows = await query(
    `SELECT selected_options, custom_reason
     FROM ai_analysis_corrections
     ORDER BY id DESC
     LIMIT 500`,
    []
  )

  const reasonMap = new Map()
  let customReasonCount = 0
  for (const row of rows) {
    const selected = uniqueCorrectionOptions(safeJsonParse(row.selected_options, []), 'selected', 20)
    for (const item of selected) {
      const key = `${item.code || item.label}`
      const current = reasonMap.get(key) || { code: item.code || '', label: item.label, count: 0 }
      current.count += 1
      reasonMap.set(key, current)
    }
    if (String(row.custom_reason || '').trim()) {
      customReasonCount += 1
    }
  }

  return {
    list: Array.from(reasonMap.values()).sort((a, b) => b.count - a.count),
    custom_reason_count: customReasonCount,
    sample_size: rows.length
  }
}

async function buildCorrectionLearningNotes(limit = 20) {
  const rows = await query(
    `SELECT question_summary, custom_reason, selected_options
     FROM ai_analysis_corrections
     ORDER BY id DESC
     LIMIT ${Math.max(1, Math.min(Number(limit) || 20, 100))}`,
    []
  )
  if (!rows.length) return ''

  const segments = []
  for (const row of rows) {
    const selected = uniqueCorrectionOptions(safeJsonParse(row.selected_options, []), 'selected', 6)
    const tags = selected.map((item) => item.label).filter(Boolean)
    const summary = String(row.question_summary || '').trim()
    const custom = String(row.custom_reason || '').trim()
    const line = [
      summary ? `修改摘要：${summary}` : '',
      tags.length ? `高频原因：${tags.join('、')}` : '',
      custom ? `员工补充：${custom}` : ''
    ].filter(Boolean).join('；')
    if (line) segments.push(`- ${line}`)
  }
  if (!segments.length) return ''
  return '## 最近修订反馈\n' + segments.join('\n')
}

async function buildCorrectionDistillationNotes(limit = 50) {
  const rows = await query(
    `SELECT question_summary, custom_reason, selected_options
     FROM ai_analysis_corrections
     ORDER BY id DESC
     LIMIT ${Math.max(1, Math.min(Number(limit) || 50, 200))}`,
    []
  )
  if (!rows.length) return ''

  const reasonCounts = new Map()
  const customSamples = []
  for (const row of rows) {
    const selected = uniqueCorrectionOptions(safeJsonParse(row.selected_options, []), 'selected', 8)
    for (const item of selected) {
      const key = item.label
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1)
    }
    const custom = String(row.custom_reason || '').trim()
    if (custom) customSamples.push(custom)
  }

  const topReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => `${label}（${count}次）`)

  const parts = []
  if (topReasons.length) parts.push('高频修订原因：' + topReasons.join('；'))
  if (customSamples.length) parts.push('员工补充样例：' + customSamples.slice(0, 5).join(' / '))
  if (!parts.length) return ''
  return parts.join('\n')
}

async function getLatestCorrectionAnalysisForAi(analysisId) {
  const row = await queryOne(
    `SELECT a.*
     FROM ai_analysis_corrections c
     INNER JOIN child_ai_analysis a ON a.id = c.corrected_analysis_id
     WHERE c.original_analysis_id = ? AND a.active = 1
     ORDER BY c.id DESC LIMIT 1`,
    [Number(analysisId)]
  )
  return safeAnalysis(row)
}

/** 员工端优先显示最近一次 AI 修订版；否则回退到常规 current。
 *  AI 模式下 allow_generate=true：员工首次打开档案自动触发 GPT 生成；
 *  - stale_hours 缓存 + generationLocks 防重复
 *  - actor=employee：受每日 token 配额保护（单员工上限）
 */
async function getEmployeeDisplayAnalysis(childId, opts = {}) {
  const current = await getDisplayAnalysis(childId, {
    allow_generate: true,
    actor_employee_id: opts.employee_id
  })
  if (!current || current.source !== 'ai') return current
  return (await getLatestCorrectionAnalysisForAi(current.id)) || current
}

/** 后台仪表盘用：聚合 AI 分析体系的关键指标。 */
async function getOverviewStats() {
  const [
    humanActiveRow,
    aiActiveRow,
    humanTotalRow,
    aiTotalRow,
    aiTokenRow,
    correctionRow,
    childWithAnalysisRow,
    activePackRow,
    packCountRow,
    last7Row
  ] = await Promise.all([
    queryOne(`SELECT COUNT(*) AS n FROM child_ai_analysis WHERE active = 1 AND source = 'human'`),
    queryOne(`SELECT COUNT(*) AS n FROM child_ai_analysis WHERE active = 1 AND source = 'ai'`),
    queryOne(`SELECT COUNT(*) AS n FROM child_ai_analysis WHERE source = 'human'`),
    queryOne(`SELECT COUNT(*) AS n FROM child_ai_analysis WHERE source = 'ai'`),
    queryOne(`SELECT COALESCE(SUM(tokens_used), 0) AS n FROM child_ai_analysis WHERE source = 'ai' AND tokens_used IS NOT NULL`),
    queryOne(`SELECT COUNT(*) AS n FROM ai_analysis_corrections`),
    queryOne(`SELECT COUNT(DISTINCT child_id) AS n FROM child_ai_analysis WHERE active = 1`),
    queryOne(`SELECT version, based_on_count, created_at FROM ai_style_pack WHERE active = 1 ORDER BY id DESC LIMIT 1`),
    queryOne(`SELECT COUNT(*) AS n FROM ai_style_pack`),
    queryOne(`SELECT
                SUM(CASE WHEN source = 'ai' AND created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS ai_recent,
                SUM(CASE WHEN source = 'human' AND created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS human_recent,
                COALESCE(SUM(CASE WHEN source = 'ai' AND created_at >= NOW() - INTERVAL 7 DAY THEN tokens_used ELSE 0 END), 0) AS tokens_recent
              FROM child_ai_analysis`)
  ])

  return {
    analyses: {
      human_active: Number(humanActiveRow ? humanActiveRow.n : 0),
      ai_active: Number(aiActiveRow ? aiActiveRow.n : 0),
      human_total: Number(humanTotalRow ? humanTotalRow.n : 0),
      ai_total: Number(aiTotalRow ? aiTotalRow.n : 0),
      tokens_total: Number(aiTokenRow ? aiTokenRow.n : 0),
      children_with_analysis: Number(childWithAnalysisRow ? childWithAnalysisRow.n : 0)
    },
    corrections: {
      total: Number(correctionRow ? correctionRow.n : 0)
    },
    style_pack: {
      active_version: activePackRow ? Number(activePackRow.version) : null,
      based_on_count: activePackRow ? Number(activePackRow.based_on_count) : 0,
      created_at: activePackRow ? activePackRow.created_at : null,
      total_versions: Number(packCountRow ? packCountRow.n : 0)
    },
    recent_7d: {
      ai_count: Number(last7Row && last7Row.ai_recent ? last7Row.ai_recent : 0),
      human_count: Number(last7Row && last7Row.human_recent ? last7Row.human_recent : 0),
      tokens_used: Number(last7Row && last7Row.tokens_recent ? last7Row.tokens_recent : 0)
    }
  }
}

/** 按当前 mode 拿展示分析。 */
async function getDisplayAnalysis(childId, opts = {}) {
  const cfg = await getConfig()
  if (cfg.mode === 'human') {
    return getLatestActiveHumanByChild(childId)
  }
  const fresh = await getFreshActiveAiByChild(childId, cfg.stale_hours)
  if (fresh) return fresh
  if (opts.allow_generate === false) {
    return (await getLatestActiveAiByChild(childId)) || (await getLatestActiveHumanByChild(childId))
  }
  try {
    return await generateAiAnalysis(childId, {
      actor_employee_id: opts.actor_employee_id,
      actor_admin_id: opts.actor_admin_id
    })
  } catch (err) {
    return (await getLatestActiveAiByChild(childId)) || (await getLatestActiveHumanByChild(childId))
  }
}

module.exports = {
  CONFIG_KEY,
  DEFAULT_CONFIG,
  DEFAULT_CORRECTION_BASE_OPTIONS,
  getConfig,
  setConfig,
  listAnalysesByChild,
  getLatestActiveByChild,
  getLatestActiveHumanByChild,
  getLatestActiveAiByChild,
  getFreshActiveAiByChild,
  createHumanAnalysis,
  deactivateAnalysis,
  generateAiAnalysis,
  generateCorrectionPrompt,
  createAnalysisCorrection,
  listCorrections,
  getCorrectionReasonStats,
  getEmployeeDisplayAnalysis,
  getDisplayAnalysis,
  getOverviewStats,
  bulkGenerateAiAnalyses,
  getBulkStatus,
  safeAnalysis,
  safeCorrection,
  getActiveStylePack,
  listStylePacks,
  regenerateStylePack,
  maybeRegenerateStylePackAsync
}
