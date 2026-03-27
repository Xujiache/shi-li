const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { hashPassword, comparePassword } = require('../utils/bcrypt')
const { normalizePagination } = require('../utils/helpers')

/**
 * 根据手机号查管理员。
 */
async function findAdminByPhone(phone) {
  return queryOne('SELECT * FROM admins WHERE phone = ? LIMIT 1', [phone])
}

/**
 * 根据ID查管理员。
 */
async function findAdminById(id) {
  return queryOne('SELECT * FROM admins WHERE id = ? LIMIT 1', [id])
}

/**
 * 管理员手机号密码登录。
 */
async function adminLogin(phone, password) {
  const admin = await findAdminByPhone(phone)
  if (!admin) {
    throw createAppError('账号不存在', StatusCodes.NOT_FOUND)
  }
  if (!admin.active) {
    throw createAppError('该账号已被禁用', StatusCodes.FORBIDDEN)
  }
  const matched = await comparePassword(password, admin.password_hash)
  if (!matched) {
    throw createAppError('手机号或密码错误', StatusCodes.UNAUTHORIZED)
  }
  await execute('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id])
  return findAdminById(admin.id)
}

/**
 * 安全化管理员对象（去敏感字段）。
 */
function safeAdmin(row) {
  if (!row) return null
  return {
    id: row.id,
    _id: String(row.id),
    phone: row.phone || '',
    display_name: row.display_name || '',
    role: row.role || 'admin',
    is_admin: true,
    active: Boolean(row.active),
    last_login_at: row.last_login_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 构建管理员 JWT payload。
 */
function buildAdminTokenPayload(admin) {
  return {
    id: Number(admin.id),
    phone: admin.phone || '',
    display_name: admin.display_name || '',
    role: admin.role || 'admin',
    is_admin: true
  }
}

/**
 * 分页列出管理员。
 */
async function listAdmins(params) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('(phone LIKE ? OR display_name LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`)
  }
  if (params.role) {
    conditions.push('role = ?')
    values.push(params.role)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM admins ${whereClause}`, values)
  const rows = await query(
    `SELECT * FROM admins ${whereClause} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeAdmin),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取管理员详情。
 */
async function getAdminDetail(id) {
  const admin = await findAdminById(id)
  if (!admin) throw createAppError('管理员不存在', StatusCodes.NOT_FOUND)
  return safeAdmin(admin)
}

/**
 * 创建管理员。
 */
async function createAdmin(payload) {
  const phone = String(payload.phone || '').trim()
  if (!phone) throw createAppError('手机号不能为空', StatusCodes.BAD_REQUEST)
  if (!payload.password || payload.password.length < 6) {
    throw createAppError('密码不能少于6位', StatusCodes.BAD_REQUEST)
  }

  const existing = await findAdminByPhone(phone)
  if (existing) throw createAppError('手机号已存在', StatusCodes.CONFLICT)

  const passwordHash = await hashPassword(String(payload.password))
  const result = await execute(
    `INSERT INTO admins (phone, password_hash, display_name, role, active) VALUES (?, ?, ?, ?, ?)`,
    [phone, passwordHash, payload.display_name || phone, payload.role || 'admin', 1]
  )

  return getAdminDetail(result.insertId)
}

/**
 * 更新管理员。
 */
async function updateAdmin(id, patch) {
  const current = await findAdminById(id)
  if (!current) throw createAppError('管理员不存在', StatusCodes.NOT_FOUND)

  const updates = []
  const params = []

  if (patch.phone !== undefined) {
    const phone = String(patch.phone).trim()
    if (!phone) throw createAppError('手机号不能为空', StatusCodes.BAD_REQUEST)
    const existing = await queryOne('SELECT id FROM admins WHERE phone = ? AND id <> ? LIMIT 1', [phone, id])
    if (existing) throw createAppError('手机号已存在', StatusCodes.CONFLICT)
    updates.push('phone = ?')
    params.push(phone)
  }

  if (patch.password) {
    if (patch.password.length < 6) throw createAppError('密码不能少于6位', StatusCodes.BAD_REQUEST)
    updates.push('password_hash = ?')
    params.push(await hashPassword(String(patch.password)))
  }

  if (patch.display_name !== undefined) {
    updates.push('display_name = ?')
    params.push(String(patch.display_name || '').trim())
  }

  if (patch.role !== undefined) {
    updates.push('role = ?')
    params.push(patch.role)
  }

  if (patch.active !== undefined) {
    updates.push('active = ?')
    params.push(patch.active ? 1 : 0)
  }

  if (updates.length === 0) return getAdminDetail(id)

  params.push(id)
  await execute(`UPDATE admins SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
  return getAdminDetail(id)
}

/**
 * 删除管理员。
 */
async function deleteAdmin(id) {
  const admin = await findAdminById(id)
  if (!admin) throw createAppError('管理员不存在', StatusCodes.NOT_FOUND)
  if (admin.role === 'super_admin') {
    // 检查是否为最后一个超管
    const countRow = await queryOne("SELECT COUNT(*) AS c FROM admins WHERE role = 'super_admin'")
    if (countRow && Number(countRow.c) <= 1) {
      throw createAppError('不能删除最后一个超级管理员', StatusCodes.FORBIDDEN)
    }
  }
  await execute('DELETE FROM admins WHERE id = ?', [id])
}

module.exports = {
  findAdminByPhone,
  findAdminById,
  adminLogin,
  safeAdmin,
  buildAdminTokenPayload,
  listAdmins,
  getAdminDetail,
  createAdmin,
  updateAdmin,
  deleteAdmin
}
