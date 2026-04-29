const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination } = require('../utils/helpers')

/**
 * 规范化部门输出。
 * @param {Record<string, any>|null} row 数据库行。
 * @returns {Record<string, any>|null} 部门对象。
 */
function safeDepartment(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    name: row.name || '',
    parent_id: row.parent_id != null ? Number(row.parent_id) : null,
    manager_id: row.manager_id != null ? Number(row.manager_id) : null,
    sort_order: row.sort_order != null ? Number(row.sort_order) : 0,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 检查 departments 表里是否有 sort_order 字段（DDL 兼容性）。
 * @returns {Promise<boolean>}
 */
async function hasSortOrderColumn() {
  const row = await queryOne(
    `SELECT COUNT(*) AS c
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'departments' AND column_name = 'sort_order'`
  )
  return row && Number(row.c) > 0
}

/**
 * 分页列出部门。
 * @param {{q?:string, active?:any, page?:any, page_size?:any}} params 查询参数。
 * @returns {Promise<{list:any[], total:number, page:number, page_size:number}>}
 */
async function listDepartments(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('name LIKE ?')
    values.push(`%${params.q}%`)
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('active = ?')
    values.push(params.active === '0' || params.active === 0 || params.active === false ? 0 : 1)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM departments ${whereClause}`, values)
  const rows = await query(
    `SELECT * FROM departments ${whereClause} ORDER BY id ASC LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeDepartment),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 部门详情。
 * @param {number|string} id 部门 ID。
 * @returns {Promise<Record<string, any>>}
 */
async function getDepartmentDetail(id) {
  const row = await queryOne('SELECT * FROM departments WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('部门不存在', StatusCodes.NOT_FOUND)
  return safeDepartment(row)
}

/**
 * 创建部门。
 * @param {{name:string, parent_id?:number, manager_id?:number, sort_order?:number}} payload 部门字段。
 * @returns {Promise<Record<string, any>>}
 */
async function createDepartment(payload = {}) {
  const name = String(payload.name || '').trim()
  if (!name) throw createAppError('部门名称不能为空', StatusCodes.BAD_REQUEST)

  const parentId = payload.parent_id != null ? Number(payload.parent_id) : null
  const managerId = payload.manager_id != null ? Number(payload.manager_id) : null
  const sortOrder = Number(payload.sort_order || 0)

  const hasSort = await hasSortOrderColumn()
  let result
  if (hasSort) {
    result = await execute(
      `INSERT INTO departments (name, parent_id, manager_id, sort_order, active) VALUES (?, ?, ?, ?, 1)`,
      [name, parentId, managerId, sortOrder]
    )
  } else {
    result = await execute(
      `INSERT INTO departments (name, parent_id, manager_id, active) VALUES (?, ?, ?, 1)`,
      [name, parentId, managerId]
    )
  }
  return getDepartmentDetail(result.insertId)
}

/**
 * 更新部门。
 * @param {number|string} id 部门 ID。
 * @param {Record<string, any>} patch 更新字段。
 * @returns {Promise<Record<string, any>>}
 */
async function updateDepartment(id, patch = {}) {
  const current = await queryOne('SELECT * FROM departments WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('部门不存在', StatusCodes.NOT_FOUND)

  const updates = []
  const values = []

  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim()
    if (!name) throw createAppError('部门名称不能为空', StatusCodes.BAD_REQUEST)
    updates.push('name = ?')
    values.push(name)
  }
  if (patch.parent_id !== undefined) {
    updates.push('parent_id = ?')
    values.push(patch.parent_id == null ? null : Number(patch.parent_id))
  }
  if (patch.manager_id !== undefined) {
    updates.push('manager_id = ?')
    values.push(patch.manager_id == null ? null : Number(patch.manager_id))
  }
  if (patch.sort_order !== undefined) {
    const hasSort = await hasSortOrderColumn()
    if (hasSort) {
      updates.push('sort_order = ?')
      values.push(Number(patch.sort_order || 0))
    }
  }
  if (patch.active !== undefined) {
    updates.push('active = ?')
    values.push(patch.active ? 1 : 0)
  }

  if (updates.length === 0) return getDepartmentDetail(id)

  values.push(id)
  await execute(`UPDATE departments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)
  return getDepartmentDetail(id)
}

/**
 * 删除部门（硬删，id=1 默认部门禁删）。
 * @param {number|string} id 部门 ID。
 * @returns {Promise<void>}
 */
async function deleteDepartment(id) {
  const numId = Number(id)
  if (numId === 1) throw createAppError('默认部门不可删除', StatusCodes.FORBIDDEN)
  const current = await queryOne('SELECT id FROM departments WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('部门不存在', StatusCodes.NOT_FOUND)

  const refRow = await queryOne('SELECT COUNT(*) AS c FROM employees WHERE department_id = ?', [id])
  if (refRow && Number(refRow.c) > 0) {
    throw createAppError('该部门下仍有员工，请先转移员工或停用部门', StatusCodes.CONFLICT)
  }

  await execute('DELETE FROM departments WHERE id = ?', [id])
}

module.exports = {
  listDepartments,
  getDepartmentDetail,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  safeDepartment
}
