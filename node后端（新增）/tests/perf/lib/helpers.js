/**
 * 压测脚本通用辅助：登录、首登改密、找/建客户、SQL 清理。
 *
 * SQL 清理走 `mysql` 命令行 + DB_PASS env，避免引入 mysql2 直连
 * 也避免占用 vision-server 的连接池。
 */
const { execFileSync } = require('child_process')
const { httpRequest } = require('./runner')

const STAFF_PHONE = '13900000001'
const STAFF_PASSWORD = 'Init@2025'
const ADMIN_PHONE = '13800138000'
const ADMIN_PASSWORD = 'Admin@123456'

const DB_USER = process.env.DB_USER || 'vision_user'
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_NAME = process.env.DB_NAME || 'vision_management'
const DB_PASS = process.env.DB_PASS || process.env.DB_PASSWORD || '0b75df4ed3170c3b45d68094ba19900f'

function mysqlExec(sql) {
  const out = execFileSync(
    'mysql',
    ['-u' + DB_USER, '-p' + DB_PASS, '-h' + DB_HOST, '-N', '-B', DB_NAME, '-e', sql],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return out.toString('utf8').trim()
}

async function adminLogin() {
  const r = await httpRequest({
    method: 'POST',
    path: '/api/v1/admin/auth/login',
    body: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD }
  })
  if (!r.json || r.json.code !== 200) {
    throw new Error('admin login failed: ' + r.body)
  }
  return r.json.data.token
}

async function resetStaffPassword(adminToken, staffId = 1) {
  const r = await httpRequest({
    method: 'PUT',
    path: `/api/v1/admin/employees/${staffId}/reset-password`,
    headers: { Authorization: 'Bearer ' + adminToken },
    body: { password: STAFF_PASSWORD }
  })
  if (!r.json || r.json.code !== 200) {
    throw new Error('reset password failed: ' + r.body)
  }
}

/**
 * 用 staff 账号登录（不处理 must_change_password）。
 * @returns {Promise<{token:string, must_change_password:boolean, employee:any}>}
 */
async function staffLoginRaw(deviceSuffix = 'perf') {
  const r = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/auth/login',
    body: {
      phone: STAFF_PHONE,
      password: STAFF_PASSWORD,
      device_id: 'perf-' + deviceSuffix + '-' + Date.now(),
      device_info: 'perf-bench'
    }
  })
  if (!r.json || r.json.code !== 200) {
    throw new Error('staff login failed: ' + r.body)
  }
  return r.json.data
}

/**
 * 走完首登改密流程，拿到一枚可调业务接口的 token。
 *  1. reset 回 Init@2025（admin）
 *  2. staff login -> token1（must_change_password=true）
 *  3. 用 token1 调 change-password，改到 Init@2025#temp
 *  4. 重新登录拿 token2（must_change_password=false）
 *  5. 把临时密码再 reset 回 Init@2025（admin），保证后续脚本可复用 Init@2025
 *     —— 注意这一步会撤销 token2 的 session，所以需要在使用完毕后再调用 finalize
 *  返回 { token, finalize() } 供调用方在压测结束后清理。
 */
async function getStaffWorkingToken() {
  const adminToken = await adminLogin()
  await resetStaffPassword(adminToken, 1)

  const login1 = await staffLoginRaw('init')
  if (login1.must_change_password) {
    const tempPwd = 'PerfTmp@2025'
    const r = await httpRequest({
      method: 'POST',
      path: '/api/v1/employee/auth/change-password',
      headers: { Authorization: 'Bearer ' + login1.token },
      body: { old_password: STAFF_PASSWORD, new_password: tempPwd }
    })
    if (!r.json || r.json.code !== 200) {
      throw new Error('change-password failed: ' + r.body)
    }
    // 用临时密码重新登录拿干净 token
    const r2 = await httpRequest({
      method: 'POST',
      path: '/api/v1/employee/auth/login',
      body: {
        phone: STAFF_PHONE,
        password: tempPwd,
        device_id: 'perf-work-' + Date.now(),
        device_info: 'perf-bench'
      }
    })
    if (!r2.json || r2.json.code !== 200) {
      throw new Error('staff re-login failed: ' + r2.body)
    }
    return {
      token: r2.json.data.token,
      employee: r2.json.data.employee,
      finalize: async () => {
        // 把密码再 reset 回 Init@2025（管理员操作，会作废 token）
        const t = await adminLogin()
        await resetStaffPassword(t, 1)
      }
    }
  }
  // 已经不需要改密
  return {
    token: login1.token,
    employee: login1.employee,
    finalize: async () => {
      const t = await adminLogin()
      await resetStaffPassword(t, 1)
    }
  }
}

/**
 * 找一个 staff 拥有的 customer_id（用于 follow_up 压测）。
 */
async function ensureStaffCustomerId(token) {
  const r = await httpRequest({
    method: 'GET',
    path: '/api/v1/employee/customers?page=1&page_size=1',
    headers: { Authorization: 'Bearer ' + token }
  })
  if (!r.json || r.json.code !== 200) {
    throw new Error('list customers failed: ' + r.body)
  }
  const list = (r.json.data && (r.json.data.list || r.json.data.items)) || []
  if (list.length > 0) return list[0].id
  // 没客户就建一个
  const c = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/customers',
    headers: { Authorization: 'Bearer ' + token },
    body: {
      display_name: 'Perf 压测客户',
      phone: '139' + String(Date.now()).slice(-8),
      client_uuid: 'perf-customer-' + Date.now()
    }
  })
  if (!c.json || c.json.code !== 200) {
    throw new Error('create perf customer failed: ' + c.body)
  }
  return (c.json.data && (c.json.data.customer ? c.json.data.customer.id : c.json.data.server_id))
}

module.exports = {
  STAFF_PHONE,
  STAFF_PASSWORD,
  ADMIN_PHONE,
  ADMIN_PASSWORD,
  mysqlExec,
  adminLogin,
  resetStaffPassword,
  staffLoginRaw,
  getStaffWorkingToken,
  ensureStaffCustomerId
}
