const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { generateNumericCode, normalizePagination } = require('../utils/helpers')

/**
 * 规范化用户数据结构，保持与前端字段语义一致。
 * @param {Record<string, any>} row 数据库原始用户记录。
 * @returns {Record<string, any>} 规范化后的用户对象。
 */
function normalizeUser(row) {
  if (!row) return null
  return {
    id: row.id,
    _id: String(row.id),
    phone: row.phone || '',
    display_name: row.display_name || '',
    avatar_url: row.avatar_url || '',
    avatar_file_id: row.avatar_url || '',
    user_no: row.user_no || '',
    is_admin: Boolean(row.is_admin),
    active: row.active !== 0,
    deleted: Boolean(row.deleted),
    wechat_openid: row.wechat_openid || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at || null
  }
}

/**
 * 获取一组用户对应的代表性孩子信息，用于头像/昵称回退展示。
 * 规则：按孩子 `updated_at` 倒序取每个用户最新的一条。
 * @param {Array<number|string>} userIds 用户 ID 列表。
 * @returns {Promise<Map<number, {name: string, avatar_url: string}>>} 用户到孩子展示信息映射。
 */
async function getLatestChildPresentationMap(userIds) {
  const ids = Array.from(new Set((userIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
  const childMap = new Map()
  if (ids.length === 0) return childMap

  const placeholders = ids.map(() => '?').join(', ')
  const rows = await query(
    `
      SELECT user_id, name, avatar_url, updated_at, id
      FROM children
      WHERE user_id IN (${placeholders})
      ORDER BY user_id ASC, updated_at DESC, id DESC
    `,
    ids
  )

  for (const row of rows) {
    const userId = Number(row.user_id)
    if (!childMap.has(userId)) {
      childMap.set(userId, {
        name: row.name || '',
        avatar_url: row.avatar_url || ''
      })
    }
  }
  return childMap
}

/**
 * 将用户头像/昵称按业务规则回退到关联孩子信息。
 * @param {Record<string, any>} row 数据库原始用户记录。
 * @param {{name?: string, avatar_url?: string}|undefined} childPresentation 代表性孩子信息。
 * @returns {Record<string, any>} 处理后的用户记录。
 */
function applyUserPresentationFallback(row, childPresentation) {
  if (!row) return row
  const next = { ...row }
  const childName = childPresentation && childPresentation.name ? String(childPresentation.name).trim() : ''
  const childAvatar = childPresentation && childPresentation.avatar_url ? String(childPresentation.avatar_url).trim() : ''
  const displayName = next.display_name ? String(next.display_name).trim() : ''
  const phone = next.phone ? String(next.phone).trim() : ''
  const avatarUrl = next.avatar_url ? String(next.avatar_url).trim() : ''

  // 历史逻辑中“个人中心”显示的是孩子姓名/头像，因此当用户昵称为空或等于手机号时，回退为孩子信息。
  if ((!displayName || displayName === phone) && childName) {
    next.display_name = childName
  }

  if (!avatarUrl && childAvatar) {
    next.avatar_url = childAvatar
  }

  return next
}

/**
 * 生成唯一用户编号。
 * @returns {Promise<string>} 唯一 8 位数字用户编号。
 */
async function generateUniqueUserNo() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const next = generateNumericCode(8)
    const existing = await queryOne('SELECT id FROM users WHERE user_no = ?', [next])
    if (!existing) return next
  }
  throw createAppError('生成用户编号失败', StatusCodes.INTERNAL_SERVER_ERROR)
}

/**
 * 根据手机号查询用户。
 * @param {string} phone 手机号。
 * @returns {Promise<Record<string, any>|null>} 用户记录。
 */
async function findUserByPhone(phone) {
  return queryOne('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone])
}

/**
 * 根据用户 ID 查询用户。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<Record<string, any>|null>} 用户记录。
 */
async function findUserById(userId) {
  return queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId])
}

/**
 * 根据微信 openid 查询用户。
 * @param {string} openid 微信 openid。
 * @returns {Promise<Record<string, any>|null>} 用户记录。
 */
async function findUserByOpenid(openid) {
  return queryOne('SELECT * FROM users WHERE wechat_openid = ? LIMIT 1', [openid])
}

/**
 * 校验用户是否可登录。
 * @param {Record<string, any>|null} user 用户记录。
 * @returns {void}
 */
function ensureLoginableUser(user) {
  if (!user || user.deleted) {
    throw createAppError('账号不存在', StatusCodes.NOT_FOUND)
  }
  if (!user.active) {
    throw createAppError('该账号已被禁用，请联系管理员', StatusCodes.FORBIDDEN)
  }
}

/**
 * 标记用户最近登录时间。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<void>}
 */
async function touchLastLogin(userId) {
  await execute('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?', [userId])
}

/**
 * 创建用户。
 * @param {{phone?: string, passwordHash?: string, displayName?: string, avatarUrl?: string, wechatOpenid?: string, isAdmin?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建用户。
 */
async function createUser(payload) {
  const phone = payload.phone ? String(payload.phone).trim() : null
  if (phone) {
    const existingPhone = await findUserByPhone(phone)
    if (existingPhone && !existingPhone.deleted) {
      throw createAppError('手机号已注册', StatusCodes.CONFLICT)
    }
  }

  if (payload.wechatOpenid) {
    const existingOpenid = await findUserByOpenid(payload.wechatOpenid)
    if (existingOpenid) {
      return existingOpenid
    }
  }

  const userNo = await generateUniqueUserNo()
  const result = await execute(
    `
      INSERT INTO users (
        phone, password_hash, display_name, avatar_url, user_no, wechat_openid, is_admin, active, deleted, last_login_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())
    `,
    [
      phone,
      payload.passwordHash || null,
      payload.displayName || phone || '微信用户',
      payload.avatarUrl || '',
      userNo,
      payload.wechatOpenid || null,
      payload.isAdmin ? 1 : 0
    ]
  )

  return findUserById(result.insertId)
}

/**
 * 获取用于令牌签发的用户信息。
 * @param {Record<string, any>} user 用户记录。
 * @returns {{id: number, phone: string, is_admin: boolean, user_no: string, display_name: string}} 令牌载荷。
 */
function buildTokenPayload(user) {
  return {
    id: Number(user.id),
    phone: user.phone || '',
    is_admin: Boolean(user.is_admin),
    user_no: user.user_no || '',
    display_name: user.display_name || ''
  }
}

/**
 * 获取移动端展示用个人资料。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<Record<string, any>>} 个人资料。
 */
async function getUserProfile(userId) {
  const user = await findUserById(userId)
  ensureLoginableUser(user)
  const childMap = await getLatestChildPresentationMap([user.id])
  const normalized = normalizeUser(applyUserPresentationFallback(user, childMap.get(Number(user.id))))
  return {
    user_id: normalized._id,
    user_no: normalized.user_no,
    display_name: normalized.display_name,
    avatar_url: normalized.avatar_url,
    avatar_file_id: normalized.avatar_file_id,
    phone: normalized.phone,
    is_admin: normalized.is_admin
  }
}

/**
 * 更新移动端用户资料。
 * @param {number|string} userId 用户 ID。
 * @param {{display_name?: string, avatar_url?: string, avatar_file_id?: string, user_no?: string}} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的资料。
 */
async function updateUserProfile(userId, patch) {
  const current = await findUserById(userId)
  ensureLoginableUser(current)

  const updates = []
  const params = []

  if (patch.display_name !== undefined) {
    updates.push('display_name = ?')
    params.push(String(patch.display_name || '').trim())
  }

  const avatarUrl = patch.avatar_url !== undefined ? patch.avatar_url : patch.avatar_file_id
  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?')
    params.push(String(avatarUrl || '').trim())
  }

  if (patch.user_no !== undefined && String(patch.user_no).trim()) {
    const userNo = String(patch.user_no).trim()
    if (!/^\d{8}$/.test(userNo)) {
      throw createAppError('用户编号格式错误', StatusCodes.BAD_REQUEST)
    }
    if (current.user_no && current.user_no !== userNo) {
      throw createAppError('用户编号已绑定，不允许修改', StatusCodes.BAD_REQUEST)
    }
    const existing = await queryOne('SELECT id FROM users WHERE user_no = ? AND id <> ? LIMIT 1', [userNo, userId])
    if (existing) {
      throw createAppError('用户编号已被占用', StatusCodes.CONFLICT)
    }
    updates.push('user_no = ?')
    params.push(userNo)
  }

  if (updates.length === 0) {
    return getUserProfile(userId)
  }

  params.push(userId)
  await execute(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
  return getUserProfile(userId)
}

/**
 * 获取后台用户列表。
 * @param {{q?: string, page?: unknown, page_size?: unknown}} params 查询条件。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listUsers(params) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = ['deleted = 0']
  const values = []

  if (params.q) {
    conditions.push('(phone LIKE ? OR display_name LIKE ? OR user_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM users ${whereClause}`, values)
  const rows = await query(
    `
      SELECT *
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  const childMap = await getLatestChildPresentationMap(rows.map((row) => row.id))

  return {
    list: rows.map((row) => normalizeUser(applyUserPresentationFallback(row, childMap.get(Number(row.id))))),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取后台用户详情。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<Record<string, any>>} 用户详情。
 */
async function getUserDetail(userId) {
  const user = await findUserById(userId)
  if (!user || user.deleted) {
    throw createAppError('用户不存在', StatusCodes.NOT_FOUND)
  }
  const childMap = await getLatestChildPresentationMap([user.id])
  return normalizeUser(applyUserPresentationFallback(user, childMap.get(Number(user.id))))
}

/**
 * 由后台创建用户。
 * @param {{phone: string, passwordHash: string, display_name?: string, avatar_url?: string, is_admin?: boolean, active?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建用户。
 */
async function createUserByAdmin(payload) {
  const created = await createUser({
    phone: payload.phone,
    passwordHash: payload.passwordHash,
    displayName: payload.display_name || payload.phone,
    avatarUrl: payload.avatar_url || '',
    isAdmin: Boolean(payload.is_admin)
  })

  if (payload.active === false) {
    await execute('UPDATE users SET active = 0 WHERE id = ?', [created.id])
  }

  return getUserDetail(created.id)
}

/**
 * 由后台更新用户。
 * @param {number|string} userId 用户 ID。
 * @param {{phone?: string, password_hash?: string, display_name?: string, avatar_url?: string, active?: boolean}} patch 更新参数。
 * @returns {Promise<Record<string, any>>} 更新后的用户信息。
 */
async function updateUserByAdmin(userId, patch) {
  const current = await findUserById(userId)
  if (!current || current.deleted) {
    throw createAppError('用户不存在', StatusCodes.NOT_FOUND)
  }

  const updates = []
  const params = []

  if (patch.phone !== undefined) {
    const phone = String(patch.phone || '').trim()
    if (!phone) throw createAppError('手机号不能为空', StatusCodes.BAD_REQUEST)
    const existing = await queryOne('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [phone, userId])
    if (existing) throw createAppError('手机号已存在', StatusCodes.CONFLICT)
    updates.push('phone = ?')
    params.push(phone)
  }

  if (patch.password_hash !== undefined) {
    updates.push('password_hash = ?')
    params.push(patch.password_hash)
  }

  if (patch.display_name !== undefined) {
    updates.push('display_name = ?')
    params.push(String(patch.display_name || '').trim())
  }

  if (patch.avatar_url !== undefined) {
    updates.push('avatar_url = ?')
    params.push(String(patch.avatar_url || '').trim())
  }

  if (patch.active !== undefined) {
    updates.push('active = ?')
    params.push(patch.active ? 1 : 0)
  }

  if (updates.length === 0) return getUserDetail(userId)

  params.push(userId)
  await execute(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
  return getUserDetail(userId)
}

/**
 * 软删除用户。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<void>}
 */
async function deleteUser(userId) {
  await execute('UPDATE users SET deleted = 1, updated_at = NOW() WHERE id = ?', [userId])
}

/**
 * 设定用户管理员状态。
 * @param {number|string} userId 用户 ID。
 * @param {boolean} isAdmin 是否管理员。
 * @returns {Promise<void>}
 */
async function setAdmin(userId, isAdmin) {
  await execute('UPDATE users SET is_admin = ?, updated_at = NOW() WHERE id = ?', [isAdmin ? 1 : 0, userId])
}

module.exports = {
  normalizeUser,
  findUserByPhone,
  findUserById,
  findUserByOpenid,
  ensureLoginableUser,
  touchLastLogin,
  createUser,
  buildTokenPayload,
  getUserProfile,
  updateUserProfile,
  listUsers,
  getUserDetail,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUser,
  setAdmin
}
