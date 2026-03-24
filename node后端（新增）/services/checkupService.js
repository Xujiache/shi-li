const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, safeJsonParse, safeJsonStringify, toBoolean, formatDateOnly } = require('../utils/helpers')
const { findChildById, ensureChildOwnership } = require('./childService')

/**
 * 规范化检测记录对象。
 * @param {Record<string, any>} row 数据库记录。
 * @returns {Record<string, any>} 规范化后的检测记录。
 */
function normalizeCheckupRecord(row) {
  if (!row) return null
  const dateValue = formatDateOnly(row.checkup_date)
  return {
    _id: String(row.id),
    id: row.id,
    child_id: String(row.child_id),
    date: dateValue,
    height: row.height,
    weight: row.weight,
    tongue_shape: row.tongue_shape || '',
    tongue_color: row.tongue_color || '',
    tongue_coating: row.tongue_coating || '',
    vision_l: row.vision_l || '',
    vision_r: row.vision_r || '',
    vision_both: row.vision_both || '',
    refraction_l: safeJsonParse(row.refraction_l_json, {}),
    refraction_r: safeJsonParse(row.refraction_r_json, {}),
    diagnosis: safeJsonParse(row.diagnosis_json, {}),
    conclusion: row.conclusion || '',
    active: row.active !== 0,
    child_name: row.child_name || '',
    school: row.school || '',
    class_name: row.class_name || '',
    parent_phone: row.parent_phone || '',
    child_no: row.child_no || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化检测记录写入字段。
 * @param {Record<string, any>} payload 输入数据。
 * @returns {Record<string, any>} 可写入对象。
 */
function normalizeCheckupPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  if (!source.child_id) throw createAppError('缺少孩子 ID', StatusCodes.BAD_REQUEST)
  if (!source.date) throw createAppError('缺少检测日期', StatusCodes.BAD_REQUEST)

  return {
    child_id: Number(source.child_id),
    date: String(source.date).trim(),
    height: source.height === '' || source.height === null || source.height === undefined ? null : Number(source.height),
    weight: source.weight === '' || source.weight === null || source.weight === undefined ? null : Number(source.weight),
    tongue_shape: String(source.tongue_shape || '').trim(),
    tongue_color: String(source.tongue_color || '').trim(),
    tongue_coating: String(source.tongue_coating || '').trim(),
    vision_l: String(source.vision_l || '').trim(),
    vision_r: String(source.vision_r || '').trim(),
    vision_both: String(source.vision_both || '').trim(),
    refraction_l_json: safeJsonStringify(source.refraction_l || {}),
    refraction_r_json: safeJsonStringify(source.refraction_r || {}),
    diagnosis_json: safeJsonStringify(source.diagnosis || {}),
    conclusion: String(source.conclusion || '').trim(),
    active: source.active === undefined ? 1 : toBoolean(source.active, true) ? 1 : 0
  }
}

/**
 * 获取检测记录详情。
 * @param {number|string} id 记录 ID。
 * @returns {Promise<Record<string, any>>} 检测记录。
 */
async function getCheckupRecordDetail(id) {
  const row = await queryOne(
    `
      SELECT r.*, c.name AS child_name, c.school, c.class_name, c.parent_phone, c.child_no
      FROM checkup_records r
      LEFT JOIN children c ON c.id = r.child_id
      WHERE r.id = ?
      LIMIT 1
    `,
    [id]
  )
  if (!row) throw createAppError('检测记录不存在', StatusCodes.NOT_FOUND)
  return normalizeCheckupRecord(row)
}

/**
 * 获取当前用户可访问的检测记录详情。
 * @param {number|string} userId 用户 ID。
 * @param {number|string} recordId 记录 ID。
 * @returns {Promise<Record<string, any>>} 检测记录。
 */
async function getCheckupRecordDetailForUser(userId, recordId) {
  const record = await getCheckupRecordDetail(recordId)
  const child = await findChildById(record.child_id)
  ensureChildOwnership(child, userId)
  return record
}

/**
 * 获取当前用户孩子的检测记录列表。
 * @param {number|string} userId 用户 ID。
 * @param {number|string} childId 孩子 ID。
 * @returns {Promise<Array<Record<string, any>>>} 检测记录列表。
 */
async function listCheckupRecordsByChild(userId, childId) {
  const child = await findChildById(childId)
  ensureChildOwnership(child, userId)
  const rows = await query(
    `
      SELECT r.*, c.name AS child_name, c.school, c.class_name, c.parent_phone, c.child_no
      FROM checkup_records r
      LEFT JOIN children c ON c.id = r.child_id
      WHERE r.child_id = ?
      ORDER BY r.checkup_date DESC, r.id DESC
    `,
    [childId]
  )
  return rows.map(normalizeCheckupRecord)
}

/**
 * 创建检测记录。
 * @param {number|string} userId 用户 ID。
 * @param {Record<string, any>} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建记录。
 */
async function createCheckupRecord(userId, payload) {
  const next = normalizeCheckupPayload(payload)
  const child = await findChildById(next.child_id)
  ensureChildOwnership(child, userId)
  const result = await execute(
    `
      INSERT INTO checkup_records (
        child_id, checkup_date, height, weight, tongue_shape, tongue_color, tongue_coating,
        vision_l, vision_r, vision_both, refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      next.child_id,
      next.date,
      next.height,
      next.weight,
      next.tongue_shape,
      next.tongue_color,
      next.tongue_coating,
      next.vision_l,
      next.vision_r,
      next.vision_both,
      next.refraction_l_json,
      next.refraction_r_json,
      next.diagnosis_json,
      next.conclusion,
      next.active
    ]
  )
  return getCheckupRecordDetail(result.insertId)
}

/**
 * 更新检测记录。
 * @param {number|string} userId 用户 ID。
 * @param {number|string} recordId 记录 ID。
 * @param {Record<string, any>} payload 更新参数。
 * @returns {Promise<Record<string, any>>} 更新后的记录。
 */
async function updateCheckupRecord(userId, recordId, payload) {
  const current = await getCheckupRecordDetail(recordId)
  const child = await findChildById(current.child_id)
  ensureChildOwnership(child, userId)
  const next = normalizeCheckupPayload({
    ...current,
    ...payload,
    child_id: current.child_id
  })

  await execute(
    `
      UPDATE checkup_records
      SET checkup_date = ?, height = ?, weight = ?, tongue_shape = ?, tongue_color = ?, tongue_coating = ?,
          vision_l = ?, vision_r = ?, vision_both = ?, refraction_l_json = ?, refraction_r_json = ?,
          diagnosis_json = ?, conclusion = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      next.date,
      next.height,
      next.weight,
      next.tongue_shape,
      next.tongue_color,
      next.tongue_coating,
      next.vision_l,
      next.vision_r,
      next.vision_both,
      next.refraction_l_json,
      next.refraction_r_json,
      next.diagnosis_json,
      next.conclusion,
      next.active,
      recordId
    ]
  )
  return getCheckupRecordDetail(recordId)
}

/**
 * 获取后台检测记录列表。
 * @param {{child_id?: string|number, q?: string, school?: string, class_name?: string, date_from?: string, date_to?: string, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listCheckupRecordsForAdmin(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.child_id) {
    conditions.push('r.child_id = ?')
    values.push(params.child_id)
  }
  if (params.q) {
    conditions.push('(c.name LIKE ? OR c.parent_phone LIKE ? OR c.child_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.school) {
    conditions.push('c.school = ?')
    values.push(params.school)
  }
  if (params.class_name) {
    conditions.push('c.class_name = ?')
    values.push(params.class_name)
  }
  if (params.date_from) {
    conditions.push('r.checkup_date >= ?')
    values.push(params.date_from)
  }
  if (params.date_to) {
    conditions.push('r.checkup_date <= ?')
    values.push(params.date_to)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(
    `
      SELECT COUNT(*) AS total
      FROM checkup_records r
      LEFT JOIN children c ON c.id = r.child_id
      ${whereClause}
    `,
    values
  )
  const rows = await query(
    `
      SELECT r.*, c.name AS child_name, c.school, c.class_name, c.parent_phone, c.child_no
      FROM checkup_records r
      LEFT JOIN children c ON c.id = r.child_id
      ${whereClause}
      ORDER BY r.checkup_date DESC, r.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: rows.map(normalizeCheckupRecord),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 由后台创建检测记录。
 * @param {Record<string, any>} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建记录。
 */
async function createCheckupRecordByAdmin(payload) {
  const next = normalizeCheckupPayload(payload)
  const child = await findChildById(next.child_id)
  if (!child) throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)
  const result = await execute(
    `
      INSERT INTO checkup_records (
        child_id, checkup_date, height, weight, tongue_shape, tongue_color, tongue_coating,
        vision_l, vision_r, vision_both, refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      next.child_id,
      next.date,
      next.height,
      next.weight,
      next.tongue_shape,
      next.tongue_color,
      next.tongue_coating,
      next.vision_l,
      next.vision_r,
      next.vision_both,
      next.refraction_l_json,
      next.refraction_r_json,
      next.diagnosis_json,
      next.conclusion,
      next.active
    ]
  )
  return getCheckupRecordDetail(result.insertId)
}

/**
 * 由后台更新检测记录。
 * @param {number|string} recordId 记录 ID。
 * @param {Record<string, any>} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的记录。
 */
async function updateCheckupRecordByAdmin(recordId, patch) {
  const current = await getCheckupRecordDetail(recordId)
  const next = normalizeCheckupPayload({
    ...current,
    ...patch,
    child_id: current.child_id
  })

  await execute(
    `
      UPDATE checkup_records
      SET checkup_date = ?, height = ?, weight = ?, tongue_shape = ?, tongue_color = ?, tongue_coating = ?,
          vision_l = ?, vision_r = ?, vision_both = ?, refraction_l_json = ?, refraction_r_json = ?,
          diagnosis_json = ?, conclusion = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      next.date,
      next.height,
      next.weight,
      next.tongue_shape,
      next.tongue_color,
      next.tongue_coating,
      next.vision_l,
      next.vision_r,
      next.vision_both,
      next.refraction_l_json,
      next.refraction_r_json,
      next.diagnosis_json,
      next.conclusion,
      next.active,
      recordId
    ]
  )
  return getCheckupRecordDetail(recordId)
}

/**
 * 删除检测记录。
 * @param {number|string} recordId 记录 ID。
 * @returns {Promise<void>}
 */
async function deleteCheckupRecord(recordId) {
  await execute('DELETE FROM checkup_records WHERE id = ?', [recordId])
}

module.exports = {
  normalizeCheckupRecord,
  getCheckupRecordDetail,
  getCheckupRecordDetailForUser,
  listCheckupRecordsByChild,
  createCheckupRecord,
  updateCheckupRecord,
  listCheckupRecordsForAdmin,
  createCheckupRecordByAdmin,
  updateCheckupRecordByAdmin,
  deleteCheckupRecord
}
