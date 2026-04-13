const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, safeJsonParse, safeJsonStringify, toBoolean } = require('../utils/helpers')

const TERMS_CONFIG_KEY = 'terms_and_privacy'
const PROFILE_FIELD_CONFIG_KEY = 'profile_field_config'
const VALID_FIELD_TYPES = ['text', 'number', 'select', 'multi_select', 'date', 'textarea', 'readonly']

const DEFAULT_PROFILE_FIELD_CONFIG = {
  sections: [
    {
      key: 'vision', label: '视力检查', enabled: true, sort_order: 1,
      fields: [
        { key: 'vision_r', label: '右眼裸眼视力', type: 'number', placeholder: '如：4.8', options: [], enabled: true, required: false, sort_order: 1 },
        { key: 'vision_l', label: '左眼裸眼视力', type: 'number', placeholder: '如：5.0', options: [], enabled: true, required: false, sort_order: 2 },
        { key: 'vision_both', label: '双眼裸眼视力', type: 'number', placeholder: '如：5.0', options: [], enabled: true, required: false, sort_order: 3 },
        { key: 'refraction_r_detail', label: '右眼屈光度', type: 'text', placeholder: 'S/C/A', options: [], enabled: true, required: false, sort_order: 4 },
        { key: 'refraction_l_detail', label: '左眼屈光度', type: 'text', placeholder: 'S/C/A', options: [], enabled: true, required: false, sort_order: 5 },
        { key: 'curvature_r', label: '右眼曲率', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 6 },
        { key: 'curvature_l', label: '左眼曲率', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 7 },
        { key: 'axial_length_r', label: '右眼眼轴长度', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 8 },
        { key: 'axial_length_l', label: '左眼眼轴长度', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 9 }
      ]
    },
    {
      key: 'diagnosis', label: '视光诊断', enabled: true, sort_order: 2,
      fields: [
        { key: 'diagnosis_vision', label: '视力诊断', type: 'select', placeholder: '请选择', options: ['正常', '不正常'], enabled: true, required: false, sort_order: 1 },
        { key: 'diagnosis_refraction', label: '屈光诊断', type: 'multi_select', placeholder: '', options: ['正常', '近视', '散光', '弱视', '原始储备低'], enabled: true, required: false, sort_order: 2 },
        { key: 'diagnosis_axial', label: '眼轴诊断', type: 'select', placeholder: '请选择', options: ['正常', '眼轴长', '眼轴短'], enabled: true, required: false, sort_order: 3 },
        { key: 'diagnosis_curvature', label: '曲率诊断', type: 'select', placeholder: '请选择', options: ['正常', '曲率陡', '曲率平'], enabled: true, required: false, sort_order: 4 },
        { key: 'diagnosis_axial_ratio', label: '眼轴/曲率比', type: 'select', placeholder: '请选择', options: ['3.0', '＞3.1', '＞3.3'], enabled: true, required: false, sort_order: 5 },
        { key: 'management_plan', label: '管理方案', type: 'textarea', placeholder: '', options: [], enabled: true, required: false, sort_order: 6, readonly: true },
        { key: 'optometrist_name', label: '验光师', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 7, readonly: true },
        { key: 'exam_date', label: '检查日期', type: 'date', placeholder: '请选择日期', options: [], enabled: true, required: false, sort_order: 8, readonly: true }
      ]
    },
    {
      key: 'tcm', label: '中医体质评估', enabled: true, sort_order: 3,
      fields: [
        { key: 'tcm_symptoms', label: '中医症状评估', type: 'multi_select', placeholder: '', options: ['眼干易疲劳', '视物昏花', '夜视力差', '腰酸腿软', '睡眠差多梦', '乏力注意力差', '面色少华', '舌质淡/少苔', '脉细弱'], enabled: true, required: false, sort_order: 1 },
        { key: 'tcm_symptom_other', label: '其他症状', type: 'text', placeholder: '如有请填写', options: [], enabled: true, required: false, sort_order: 2 },
        { key: 'tcm_syndrome_types', label: '中医辨证分型', type: 'multi_select', placeholder: '', options: ['肝肾亏虚证', '肾精不足证', '肝血不足证', '脾气虚弱证', '心脾两虚证'], enabled: true, required: false, sort_order: 3 },
        { key: 'tcm_syndrome_other', label: '其他辨证', type: 'text', placeholder: '如有请填写', options: [], enabled: true, required: false, sort_order: 4 },
        { key: 'risk_level', label: '风险等级', type: 'select', placeholder: '请选择风险等级', options: ['低危', '中危', '高危（眼轴快涨型）'], enabled: true, required: false, sort_order: 5 },
        { key: 'treatment_plans', label: '治疗方案', type: 'multi_select', placeholder: '', options: ['补肾填精固轴', '养肝血明目', '健脾益气升清', '综合干预（中药+外治+训练）'], enabled: true, required: false, sort_order: 6 },
        { key: 'treatment_other', label: '其他治疗方案', type: 'text', placeholder: '如有请填写', options: [], enabled: true, required: false, sort_order: 7 },
        { key: 'doctor_name', label: '医师', type: 'text', placeholder: '', options: [], enabled: true, required: false, sort_order: 8, readonly: true }
      ]
    }
  ]
}

/**
 * 规范化轮播图对象。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeBanner(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    image_url: row.image_url || '',
    title: row.title || '',
    sub_title: row.sub_title || '',
    order: row.sort_order || 1,
    active: row.active !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 获取轮播图列表。
 * @param {{page?: unknown, page_size?: unknown, active?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listBanners(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.active !== undefined && params.active !== '') {
    conditions.push('active = ?')
    values.push(toBoolean(params.active, true) ? 1 : 0)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM banners ${whereClause}`, values)
  const rows = await query(
    `
      SELECT *
      FROM banners
      ${whereClause}
      ORDER BY sort_order ASC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )
  return {
    list: rows.map(normalizeBanner),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取移动端可见轮播图。
 * @returns {Promise<Array<Record<string, any>>>} 轮播图列表。
 */
async function listActiveBanners() {
  const rows = await query('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order ASC, id DESC')
  return rows.map(normalizeBanner)
}

/**
 * 获取轮播图详情。
 * @param {number|string} id 轮播图 ID。
 * @returns {Promise<Record<string, any>>} 详情对象。
 */
async function getBannerDetail(id) {
  const row = await queryOne('SELECT * FROM banners WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('轮播图不存在', StatusCodes.NOT_FOUND)
  return normalizeBanner(row)
}

/**
 * 创建轮播图。
 * @param {{image_url: string, title?: string, sub_title?: string, order?: number, active?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建对象。
 */
async function createBanner(payload) {
  const imageUrl = String(payload.image_url || '').trim()
  if (!imageUrl) throw createAppError('轮播图图片不能为空', StatusCodes.BAD_REQUEST)

  const result = await execute(
    `
      INSERT INTO banners (image_url, title, sub_title, sort_order, active)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      imageUrl,
      String(payload.title || '').trim(),
      String(payload.sub_title || '').trim(),
      Number(payload.order || 1),
      payload.active === undefined ? 1 : payload.active ? 1 : 0
    ]
  )
  return getBannerDetail(result.insertId)
}

/**
 * 更新轮播图。
 * @param {number|string} id 轮播图 ID。
 * @param {{image_url?: string, title?: string, sub_title?: string, order?: number, active?: boolean}} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的对象。
 */
async function updateBanner(id, patch) {
  const current = await getBannerDetail(id)
  await execute(
    `
      UPDATE banners
      SET image_url = ?, title = ?, sub_title = ?, sort_order = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      patch.image_url !== undefined ? String(patch.image_url || '').trim() : current.image_url,
      patch.title !== undefined ? String(patch.title || '').trim() : current.title,
      patch.sub_title !== undefined ? String(patch.sub_title || '').trim() : current.sub_title,
      patch.order !== undefined ? Number(patch.order || 1) : current.order,
      patch.active === undefined ? (current.active ? 1 : 0) : patch.active ? 1 : 0,
      id
    ]
  )
  return getBannerDetail(id)
}

/**
 * 删除轮播图。
 * @param {number|string} id 轮播图 ID。
 * @returns {Promise<void>}
 */
async function deleteBanner(id) {
  await execute('DELETE FROM banners WHERE id = ?', [id])
}

/**
 * 获取协议与隐私配置。
 * @returns {Promise<Record<string, string>>} 协议配置对象。
 */
async function getTermsConfig() {
  const row = await queryOne('SELECT config_value FROM system_configs WHERE config_key = ? LIMIT 1', [TERMS_CONFIG_KEY])
  return safeJsonParse(row ? row.config_value : null, {
    user_agreement: '',
    privacy_policy: '',
    child_privacy_policy: '',
    third_party_share_list: ''
  })
}

/**
 * 更新协议与隐私配置。
 * @param {{user_agreement?: string, privacy_policy?: string, child_privacy_policy?: string, third_party_share_list?: string}} patch 更新字段。
 * @returns {Promise<Record<string, string>>} 更新后的协议配置。
 */
async function updateTermsConfig(patch) {
  const current = await getTermsConfig()
  const next = {
    user_agreement: patch.user_agreement !== undefined ? String(patch.user_agreement || '') : current.user_agreement,
    privacy_policy: patch.privacy_policy !== undefined ? String(patch.privacy_policy || '') : current.privacy_policy,
    child_privacy_policy:
      patch.child_privacy_policy !== undefined ? String(patch.child_privacy_policy || '') : current.child_privacy_policy,
    third_party_share_list:
      patch.third_party_share_list !== undefined
        ? String(patch.third_party_share_list || '')
        : current.third_party_share_list
  }

  const existing = await queryOne('SELECT id FROM system_configs WHERE config_key = ? LIMIT 1', [TERMS_CONFIG_KEY])
  if (existing) {
    await execute('UPDATE system_configs SET config_value = ?, updated_at = NOW() WHERE id = ?', [
      safeJsonStringify(next),
      existing.id
    ])
  } else {
    await execute('INSERT INTO system_configs (config_key, config_value) VALUES (?, ?)', [
      TERMS_CONFIG_KEY,
      safeJsonStringify(next)
    ])
  }

  return next
}

/**
 * 记录前端埋点事件。
 * @param {{userId?: number|string|null, visitorKey?: string, type?: string, page?: string, name?: string}} payload 埋点参数。
 * @returns {Promise<void>}
 */
async function trackEvent(payload) {
  const now = Date.now()
  const visitorKey = String(payload.visitorKey || payload.userId || 'anonymous')
  const eventType = String(payload.type || 'page_view')
  const pagePath = String(payload.page || '')
  const eventName = String(payload.name || '')

  await execute(
    `
      INSERT INTO analytics_events (user_id, visitor_key, event_type, event_name, page_path, created_at_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [payload.userId || null, visitorKey, eventType, eventName, pagePath, now]
  )

  const existing = await queryOne('SELECT id FROM analytics_visitors WHERE visitor_key = ? LIMIT 1', [visitorKey])
  if (existing) {
    await execute(
      'UPDATE analytics_visitors SET user_id = ?, last_seen_ms = ?, last_page = ?, updated_at = NOW() WHERE id = ?',
      [payload.userId || null, now, pagePath || eventName, existing.id]
    )
  } else {
    await execute(
      'INSERT INTO analytics_visitors (user_id, visitor_key, last_seen_ms, last_page) VALUES (?, ?, ?, ?)',
      [payload.userId || null, visitorKey, now, pagePath || eventName]
    )
  }
}

async function getProfileFieldConfig() {
  const row = await queryOne(
    'SELECT config_value FROM system_configs WHERE config_key = ? LIMIT 1',
    [PROFILE_FIELD_CONFIG_KEY]
  )
  return safeJsonParse(row ? row.config_value : null, DEFAULT_PROFILE_FIELD_CONFIG)
}

async function updateProfileFieldConfig(config) {
  if (!config || !Array.isArray(config.sections)) {
    throw createAppError('配置格式不正确', StatusCodes.BAD_REQUEST)
  }

  const sanitized = {
    sections: config.sections.map((section) => ({
      key: String(section.key || ''),
      label: String(section.label || ''),
      enabled: section.enabled !== false,
      sort_order: Number(section.sort_order || 0),
      fields: Array.isArray(section.fields)
        ? section.fields.map((f) => {
            const fieldType = VALID_FIELD_TYPES.includes(f.type) ? f.type : 'text'
            const options = Array.isArray(f.options) ? f.options.map((o) => String(o || '').trim()).filter(Boolean) : []
            return {
              key: String(f.key || ''),
              label: String(f.label || ''),
              type: fieldType,
              options,
              placeholder: String(f.placeholder || ''),
              enabled: f.enabled !== false,
              required: f.readonly ? false : f.required === true,
              sort_order: Number(f.sort_order || 0),
              ...(f.readonly ? { readonly: true } : {})
            }
          })
        : []
    }))
  }

  const existing = await queryOne(
    'SELECT id FROM system_configs WHERE config_key = ? LIMIT 1',
    [PROFILE_FIELD_CONFIG_KEY]
  )
  if (existing) {
    await execute(
      'UPDATE system_configs SET config_value = ?, updated_at = NOW() WHERE id = ?',
      [safeJsonStringify(sanitized), existing.id]
    )
  } else {
    await execute(
      'INSERT INTO system_configs (config_key, config_value) VALUES (?, ?)',
      [PROFILE_FIELD_CONFIG_KEY, safeJsonStringify(sanitized)]
    )
  }

  return sanitized
}

module.exports = {
  normalizeBanner,
  listBanners,
  listActiveBanners,
  getBannerDetail,
  createBanner,
  updateBanner,
  deleteBanner,
  getTermsConfig,
  updateTermsConfig,
  getProfileFieldConfig,
  updateProfileFieldConfig,
  trackEvent
}
