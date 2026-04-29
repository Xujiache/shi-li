const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { hashPassword, comparePassword } = require('../utils/bcrypt')
const { normalizePagination } = require('../utils/helpers')
const { generateToken, USER_TYPES } = require('../utils/jwt')
const config = require('../config')
const logger = require('../utils/logger')

/**
 * 内存级登录失败计数器（v1 简化）。key 为 phone+ip 维度。
 * @type {Map<string,{count:number, firstAt:number}>}
 */
const loginFailMap = new Map()

/**
 * 计算 SHA-256 token hash（与 middlewares/employeeAuth.hashToken 保持一致，不直接 require 中间件）。
 * @param {string} token JWT 原文。
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

/**
 * 校验密码强度：≥8 位，含字母与数字。
 * @param {string} password
 * @returns {boolean}
 */
function isStrongPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 8) return false
  return /[a-zA-Z]/.test(password) && /\d/.test(password)
}

/**
 * 计算 JWT 过期时长（秒）。
 * @returns {number}
 */
function tokenExpiresInSeconds() {
  const cfg = config.jwt.employeeExpiresIn || '7d'
  const match = String(cfg).match(/^(\d+)([smhd])?$/i)
  if (!match) return 7 * 24 * 3600
  const n = Number(match[1])
  const unit = (match[2] || 's').toLowerCase()
  const map = { s: 1, m: 60, h: 3600, d: 86400 }
  return n * (map[unit] || 1)
}

/**
 * 安全员工对象（不含 password_hash）。
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function safeEmployee(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    phone: row.phone || '',
    display_name: row.display_name || '',
    avatar_url: row.avatar_url || '',
    role: row.role || 'staff',
    department_id: row.department_id != null ? Number(row.department_id) : null,
    department_name: row.department_name || '',
    position: row.position || '',
    active: Boolean(row.active),
    must_change_password: Boolean(row.must_change_password),
    last_login_at: row.last_login_at || null,
    last_login_ip: row.last_login_ip || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 构建员工 JWT payload。
 * @param {Record<string, any>} employee
 * @returns {Record<string, any>}
 */
function buildEmployeeTokenPayload(employee) {
  return {
    id: Number(employee.id),
    phone: employee.phone || '',
    display_name: employee.display_name || '',
    role: employee.role || 'staff',
    department_id: employee.department_id != null ? Number(employee.department_id) : null
  }
}

/**
 * 按手机号查员工。
 * @param {string} phone
 * @returns {Promise<Record<string, any>|null>}
 */
async function findEmployeeByPhone(phone) {
  return queryOne('SELECT * FROM employees WHERE phone = ? LIMIT 1', [phone])
}

/**
 * 按 ID 查员工。
 * @param {number|string} id
 * @returns {Promise<Record<string, any>|null>}
 */
async function findEmployeeById(id) {
  return queryOne('SELECT * FROM employees WHERE id = ? LIMIT 1', [id])
}

/**
 * 内部：生成 token 与 session（写入 employee_sessions 表）。
 * 单设备模式下先 revoked 旧 session。
 * @param {Record<string, any>} employee
 * @param {{device_id?:string, device_info?:string, ip_addr?:string}} ctx
 * @returns {Promise<{token:string, expires_in:number}>}
 */
async function issueSession(employee, ctx = {}) {
  const expiresIn = tokenExpiresInSeconds()
  const token = generateToken(buildEmployeeTokenPayload(employee), USER_TYPES.EMPLOYEE)
  const tokenH = hashToken(token)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  await withTransaction(async (conn) => {
    if (config.employee.singleDevice) {
      await conn.execute(
        'UPDATE employee_sessions SET revoked = 1 WHERE employee_id = ? AND revoked = 0',
        [employee.id]
      )
    }
    await conn.execute(
      `INSERT INTO employee_sessions (employee_id, device_id, device_info, ip_addr, token_hash, expires_at, revoked)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        employee.id,
        String(ctx.device_id || 'unknown').slice(0, 64),
        String(ctx.device_info || '').slice(0, 255),
        ctx.ip_addr || null,
        tokenH,
        expiresAt
      ]
    )
    await conn.execute(
      'UPDATE employees SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [ctx.ip_addr || null, employee.id]
    )
  })

  return { token, expires_in: expiresIn }
}

/**
 * 员工登录（手机号 + 密码）。
 * @param {{phone:string, password:string, device_id?:string, device_info?:string, ip_addr?:string}} input
 * @returns {Promise<{token:string, expires_in:number, employee:Record<string,any>, must_change_password:boolean}>}
 */
async function employeeLogin(input = {}) {
  const phone = String(input.phone || '').trim()
  const password = String(input.password || '')
  if (!phone || !password) {
    throw createAppError('手机号和密码不能为空', StatusCodes.BAD_REQUEST)
  }

  // 失败次数限制（phone+ip 维度）
  const lockKey = `${phone}|${input.ip_addr || 'unknown'}`
  const lockMs = config.employee.loginFailLockMinutes * 60 * 1000
  const threshold = config.employee.loginFailThreshold
  const rec = loginFailMap.get(lockKey)
  if (rec && rec.count >= threshold && Date.now() - rec.firstAt < lockMs) {
    throw createAppError('登录失败次数过多，请稍后再试', 429)
  }
  if (rec && Date.now() - rec.firstAt >= lockMs) {
    loginFailMap.delete(lockKey)
  }

  const employee = await findEmployeeByPhone(phone)
  if (!employee) {
    bumpFail(lockKey)
    throw createAppError('账号不存在', StatusCodes.NOT_FOUND)
  }
  if (!employee.active) {
    throw createAppError('该账号已被禁用', StatusCodes.FORBIDDEN)
  }
  const matched = await comparePassword(password, employee.password_hash)
  if (!matched) {
    bumpFail(lockKey)
    throw createAppError('手机号或密码错误', StatusCodes.UNAUTHORIZED)
  }
  loginFailMap.delete(lockKey)

  const session = await issueSession(employee, input)
  const fresh = await findEmployeeById(employee.id)

  return {
    token: session.token,
    expires_in: session.expires_in,
    employee: safeEmployee(fresh),
    must_change_password: Boolean(fresh.must_change_password)
  }
}

/**
 * 内部：登录失败计数 +1。
 * @param {string} key
 */
function bumpFail(key) {
  const rec = loginFailMap.get(key)
  if (!rec) {
    loginFailMap.set(key, { count: 1, firstAt: Date.now() })
  } else {
    rec.count += 1
  }
}

/**
 * 异地登录验证码校验（v1 占位实现，未配置短信服务则放行）。
 * @param {string} phone
 * @param {string} code
 * @returns {Promise<{token:string, expires_in:number, employee:Record<string,any>}>}
 */
async function verifyLoginCode(phone, code) {
  const phoneStr = String(phone || '').trim()
  const codeStr = String(code || '').trim()
  if (!phoneStr || !codeStr) {
    throw createAppError('参数不完整', StatusCodes.BAD_REQUEST)
  }

  const employee = await findEmployeeByPhone(phoneStr)
  if (!employee) throw createAppError('账号不存在', StatusCodes.NOT_FOUND)
  if (!employee.active) throw createAppError('该账号已被禁用', StatusCodes.FORBIDDEN)

  // 短信未配置，v1 放行（占位）
  if (!config.sms.provider) {
    logger.info('SMS provider 未配置，verifyLoginCode 走占位放行流程')
  }

  const session = await issueSession(employee, {})
  return {
    token: session.token,
    expires_in: session.expires_in,
    employee: safeEmployee(await findEmployeeById(employee.id))
  }
}

/**
 * 重发异地登录验证码。
 * 后端目前未接短信网关时，返回 sms_enabled=false 让前端展示真实状态。
 * @param {string} phone
 * @returns {Promise<{sms_enabled:boolean, message:string}>}
 */
async function resendVerifyCode(phone) {
  const phoneStr = String(phone || '').trim()
  if (!/^1\d{10}$/.test(phoneStr)) {
    throw createAppError('手机号格式不正确', StatusCodes.BAD_REQUEST)
  }
  const employee = await findEmployeeByPhone(phoneStr)
  if (!employee) {
    // 不暴露账号是否存在，统一返回未启用文案
    return { sms_enabled: false, message: '短信网关未配置' }
  }
  if (!config.sms.provider) {
    return {
      sms_enabled: false,
      message: '短信网关未配置，请直接使用密码登录或联系管理员'
    }
  }
  // SMS_ENABLED 时由真实网关下发；当前为 stub
  // TODO（v1.1）：接入阿里云 / 腾讯云 SMS 后填入真实下发逻辑
  logger.info(`resendVerifyCode 触发（provider=${config.sms.provider}），但目前 stub 未发送`)
  return {
    sms_enabled: true,
    message: '验证码已下发，请注意查收（60 秒内有效）'
  }
}

/**
 * 修改密码（首登强制）。
 * @param {number|string} employeeId
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<{success:true}>}
 */
async function changePassword(employeeId, oldPassword, newPassword) {
  if (!isStrongPassword(newPassword)) {
    throw createAppError('新密码至少 8 位，且需含字母和数字', StatusCodes.BAD_REQUEST)
  }
  const employee = await findEmployeeById(employeeId)
  if (!employee) throw createAppError('账号不存在', StatusCodes.NOT_FOUND)

  const matched = await comparePassword(String(oldPassword || ''), employee.password_hash)
  if (!matched) throw createAppError('原密码错误', StatusCodes.UNAUTHORIZED)

  const newHash = await hashPassword(String(newPassword))
  await execute(
    'UPDATE employees SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?',
    [newHash, employeeId]
  )
  return { success: true }
}

/**
 * 注销：标记 session revoked。
 * @param {number|string} employeeId
 * @param {string} token
 * @returns {Promise<{success:true}>}
 */
async function logoutEmployee(employeeId, token) {
  if (!token) {
    await execute(
      'UPDATE employee_sessions SET revoked = 1 WHERE employee_id = ? AND revoked = 0',
      [employeeId]
    )
  } else {
    await execute(
      'UPDATE employee_sessions SET revoked = 1 WHERE employee_id = ? AND token_hash = ?',
      [employeeId, hashToken(token)]
    )
  }
  return { success: true }
}

/**
 * 分页员工列表（admin 用）。
 * @param {{q?:string, role?:string, department_id?:any, active?:any, page?:any, page_size?:any}} params
 * @returns {Promise<{list:any[], total:number, page:number, page_size:number}>}
 */
async function listEmployees(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('(e.phone LIKE ? OR e.display_name LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`)
  }
  if (params.role) {
    conditions.push('e.role = ?')
    values.push(params.role)
  }
  if (params.department_id !== undefined && params.department_id !== '') {
    conditions.push('e.department_id = ?')
    values.push(Number(params.department_id))
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('e.active = ?')
    values.push(params.active === '0' || params.active === 0 || params.active === false ? 0 : 1)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM employees e ${whereClause}`, values)
  const rows = await query(
    `SELECT e.*, d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     ${whereClause}
     ORDER BY e.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeEmployee),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 员工详情。
 * @param {number|string} id
 * @returns {Promise<Record<string, any>>}
 */
async function getEmployeeDetail(id) {
  const row = await queryOne(
    `SELECT e.*, d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = ? LIMIT 1`,
    [id]
  )
  if (!row) throw createAppError('员工不存在', StatusCodes.NOT_FOUND)
  return safeEmployee(row)
}

/**
 * 创建员工（admin 用）。
 * @param {{phone:string, password?:string, display_name?:string, role?:string, department_id?:number, position?:string}} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createEmployee(payload = {}) {
  const phone = String(payload.phone || '').trim()
  if (!phone) throw createAppError('手机号不能为空', StatusCodes.BAD_REQUEST)

  const existing = await findEmployeeByPhone(phone)
  if (existing) throw createAppError('手机号已存在', StatusCodes.CONFLICT)

  const rawPassword = payload.password ? String(payload.password) : config.employee.defaultPassword
  if (!rawPassword || rawPassword.length < 6) {
    throw createAppError('密码不能少于 6 位', StatusCodes.BAD_REQUEST)
  }
  const passwordHash = await hashPassword(rawPassword)

  const role = payload.role === 'manager' ? 'manager' : 'staff'
  const departmentId = payload.department_id != null ? Number(payload.department_id) : null
  const result = await execute(
    `INSERT INTO employees (phone, password_hash, display_name, role, department_id, position, active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
    [
      phone,
      passwordHash,
      String(payload.display_name || phone),
      role,
      departmentId,
      String(payload.position || '')
    ]
  )
  return getEmployeeDetail(result.insertId)
}

/**
 * 更新员工（不允许直接改 password，需走 reset 接口）。
 * @param {number|string} id
 * @param {Record<string, any>} patch
 * @returns {Promise<Record<string, any>>}
 */
async function updateEmployee(id, patch = {}) {
  const current = await findEmployeeById(id)
  if (!current) throw createAppError('员工不存在', StatusCodes.NOT_FOUND)

  const updates = []
  const values = []

  if (patch.phone !== undefined) {
    const phone = String(patch.phone || '').trim()
    if (!phone) throw createAppError('手机号不能为空', StatusCodes.BAD_REQUEST)
    const dup = await queryOne('SELECT id FROM employees WHERE phone = ? AND id <> ? LIMIT 1', [phone, id])
    if (dup) throw createAppError('手机号已存在', StatusCodes.CONFLICT)
    updates.push('phone = ?')
    values.push(phone)
  }
  if (patch.display_name !== undefined) {
    updates.push('display_name = ?')
    values.push(String(patch.display_name || ''))
  }
  if (patch.avatar_url !== undefined) {
    updates.push('avatar_url = ?')
    values.push(String(patch.avatar_url || ''))
  }
  if (patch.role !== undefined) {
    if (!['staff', 'manager'].includes(patch.role)) {
      throw createAppError('role 非法', StatusCodes.BAD_REQUEST)
    }
    updates.push('role = ?')
    values.push(patch.role)
  }
  if (patch.department_id !== undefined) {
    updates.push('department_id = ?')
    values.push(patch.department_id == null ? null : Number(patch.department_id))
  }
  if (patch.position !== undefined) {
    updates.push('position = ?')
    values.push(String(patch.position || ''))
  }
  if (patch.active !== undefined) {
    updates.push('active = ?')
    values.push(patch.active ? 1 : 0)
  }
  if (updates.length === 0) return getEmployeeDetail(id)

  values.push(id)
  await execute(`UPDATE employees SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)
  return getEmployeeDetail(id)
}

/**
 * 启停员工（停用时一并撤销所有 active session）。
 * @param {number|string} id
 * @param {boolean} active
 * @returns {Promise<Record<string, any>>}
 */
async function setEmployeeActive(id, active) {
  const current = await findEmployeeById(id)
  if (!current) throw createAppError('员工不存在', StatusCodes.NOT_FOUND)

  await withTransaction(async (conn) => {
    await conn.execute('UPDATE employees SET active = ?, updated_at = NOW() WHERE id = ?', [active ? 1 : 0, id])
    if (!active) {
      await conn.execute(
        'UPDATE employee_sessions SET revoked = 1 WHERE employee_id = ? AND revoked = 0',
        [id]
      )
    }
  })
  return getEmployeeDetail(id)
}

/**
 * 重置员工密码（默认值 = config.employee.defaultPassword）。
 * @param {number|string} id
 * @param {string} [newPassword]
 * @returns {Promise<{password:string}>}
 */
async function resetEmployeePassword(id, newPassword) {
  const current = await findEmployeeById(id)
  if (!current) throw createAppError('员工不存在', StatusCodes.NOT_FOUND)

  const raw = newPassword ? String(newPassword) : config.employee.defaultPassword
  if (raw.length < 6) throw createAppError('密码不能少于 6 位', StatusCodes.BAD_REQUEST)

  const hash = await hashPassword(raw)
  await execute(
    'UPDATE employees SET password_hash = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?',
    [hash, id]
  )
  // 同时把所有 session 撤销
  await execute('UPDATE employee_sessions SET revoked = 1 WHERE employee_id = ? AND revoked = 0', [id])
  return { password: raw }
}

/**
 * 删除员工（硬删，前置校验是否被 customer / follow_ups / customer_transfers 引用）。
 * @param {number|string} id
 * @returns {Promise<void>}
 */
async function deleteEmployee(id) {
  const current = await findEmployeeById(id)
  if (!current) throw createAppError('员工不存在', StatusCodes.NOT_FOUND)

  const c1 = await queryOne('SELECT COUNT(*) AS c FROM customers WHERE assigned_employee_id = ? AND active = 1', [id])
  if (c1 && Number(c1.c) > 0) {
    throw createAppError('该员工仍有名下客户，请先转移客户', StatusCodes.CONFLICT)
  }
  const c2 = await queryOne('SELECT COUNT(*) AS c FROM follow_ups WHERE employee_id = ?', [id])
  if (c2 && Number(c2.c) > 0) {
    throw createAppError('该员工有跟进记录，无法删除（请改为停用）', StatusCodes.CONFLICT)
  }
  const c3 = await queryOne(
    'SELECT COUNT(*) AS c FROM customer_transfers WHERE from_employee_id = ? OR to_employee_id = ?',
    [id, id]
  )
  if (c3 && Number(c3.c) > 0) {
    throw createAppError('该员工有转出记录，无法删除（请改为停用）', StatusCodes.CONFLICT)
  }

  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM employee_sessions WHERE employee_id = ?', [id])
    await conn.execute('DELETE FROM employees WHERE id = ?', [id])
  })
}

module.exports = {
  findEmployeeByPhone,
  findEmployeeById,
  employeeLogin,
  verifyLoginCode,
  resendVerifyCode,
  changePassword,
  logoutEmployee,
  listEmployees,
  getEmployeeDetail,
  createEmployee,
  updateEmployee,
  setEmployeeActive,
  resetEmployeePassword,
  deleteEmployee,
  safeEmployee,
  buildEmployeeTokenPayload
}
