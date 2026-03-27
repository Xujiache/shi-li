const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, toBoolean, parseGradeInfo } = require('../utils/helpers')

/**
 * 规范化学校班级字典记录。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeSchoolClass(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    school: row.school || '',
    grade_name: row.grade_name || '',
    class_name: row.class_name || '',
    active: row.active !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 获取后台学校班级列表。
 * @param {{q?: string, active?: unknown, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listSchoolClasses(params) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('(school LIKE ? OR grade_name LIKE ? OR class_name LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('active = ?')
    values.push(toBoolean(params.active, true) ? 1 : 0)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM school_classes ${whereClause}`, values)
  const rows = await query(
    `
      SELECT *
      FROM school_classes
      ${whereClause}
      ORDER BY school ASC, class_name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: rows.map(normalizeSchoolClass),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取学校班级详情。
 * @param {number|string} id 主键 ID。
 * @returns {Promise<Record<string, any>>} 详情对象。
 */
async function getSchoolClassDetail(id) {
  const row = await queryOne('SELECT * FROM school_classes WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('学校/班级记录不存在', StatusCodes.NOT_FOUND)
  return normalizeSchoolClass(row)
}

/**
 * 创建学校班级字典项。
 * @param {{school: string, class_name: string, grade_name?: string, active?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建对象。
 */
async function createSchoolClass(payload) {
  const school = String(payload.school || '').trim()
  const className = String(payload.class_name || '').trim()
  const gradeName = String(payload.grade_name || '').trim() || parseGradeInfo(className).grade_name || ''
  if (!school || !className) {
    throw createAppError('学校和班级不能为空', StatusCodes.BAD_REQUEST)
  }

  const existing = await queryOne(
    'SELECT id FROM school_classes WHERE school = ? AND class_name = ? LIMIT 1',
    [school, className]
  )
  if (existing) {
    throw createAppError('已存在相同学校/班级', StatusCodes.CONFLICT)
  }

  const result = await execute(
    'INSERT INTO school_classes (school, grade_name, class_name, active) VALUES (?, ?, ?, ?)',
    [school, gradeName, className, payload.active === undefined ? 1 : payload.active ? 1 : 0]
  )
  return getSchoolClassDetail(result.insertId)
}

/**
 * 更新学校班级字典项。
 * @param {number|string} id 主键 ID。
 * @param {{school?: string, grade_name?: string, class_name?: string, active?: boolean}} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的对象。
 */
async function updateSchoolClass(id, patch) {
  const current = await getSchoolClassDetail(id)
  const school = patch.school !== undefined ? String(patch.school || '').trim() : current.school
  const className = patch.class_name !== undefined ? String(patch.class_name || '').trim() : current.class_name
  const gradeName =
    patch.grade_name !== undefined
      ? String(patch.grade_name || '').trim() || parseGradeInfo(className).grade_name || ''
      : current.grade_name || parseGradeInfo(className).grade_name || ''

  if (!school || !className) {
    throw createAppError('学校和班级不能为空', StatusCodes.BAD_REQUEST)
  }

  const existing = await queryOne(
    'SELECT id FROM school_classes WHERE school = ? AND class_name = ? AND id <> ? LIMIT 1',
    [school, className, id]
  )
  if (existing) {
    throw createAppError('已存在相同学校/班级', StatusCodes.CONFLICT)
  }

  await execute(
    `
      UPDATE school_classes
      SET school = ?, grade_name = ?, class_name = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [school, gradeName, className, patch.active === undefined ? (current.active ? 1 : 0) : patch.active ? 1 : 0, id]
  )
  return getSchoolClassDetail(id)
}

/**
 * 删除学校班级字典项。
 * @param {number|string} id 主键 ID。
 * @returns {Promise<void>}
 */
async function deleteSchoolClass(id) {
  await execute('DELETE FROM school_classes WHERE id = ?', [id])
}

module.exports = {
  normalizeSchoolClass,
  listSchoolClasses,
  getSchoolClassDetail,
  createSchoolClass,
  updateSchoolClass,
  deleteSchoolClass
}
