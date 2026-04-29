/**
 * 员工 App Phase 4 — 安全测试套件（Wave 1-B）。
 *
 * 用 node --test 跑（与 phase1.test.js 同栈），不引入新依赖。
 *
 * 覆盖 5 项安全矩阵：
 *   1. 错密 5 次锁定（用临时员工，不动 staff 真账号）
 *   2. JWT 跨端隔离（staff token 调 admin / admin token 调 employee）
 *   3. 横向越权（staff A 读/改 staff B 的客户）
 *   4. 跨部门 manager 审批 transfer
 *   5. token_hash / bcrypt 哈希存储校验（DB 直查 employee_sessions / employees）
 *
 * 收尾：
 *   - 删除所有临时数据（员工/客户/部门）
 *   - pm2 restart vision-server --update-env  清登录失败 Map
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { execFile, execFileSync } = require('node:child_process')

const HOST = process.env.PERF_HOST || '127.0.0.1'
const PORT = Number(process.env.PERF_PORT) || 3100

const ADMIN_PHONE = '13800138000'
const ADMIN_PASSWORD = 'Admin@123456'

const DB_USER = process.env.DB_USER || 'vision_user'
const DB_PASS = process.env.DB_PASS || process.env.DB_PASSWORD || '0b75df4ed3170c3b45d68094ba19900f'
const DB_HOST = process.env.DB_HOST || '127.0.0.1'
const DB_NAME = process.env.DB_NAME || 'vision_management'

// ============ 工具 ============

/**
 * 极简 HTTP 客户端（不依赖 perf/lib/runner，避免连接池干扰）。
 * @param {{method?:string, path:string, headers?:Object, body?:any}} opts
 * @returns {Promise<{statusCode:number, body:string, json:any}>}
 */
function httpRequest(opts) {
  const method = (opts.method || 'GET').toUpperCase()
  const headers = Object.assign({}, opts.headers || {})
  let bodyBuf = null
  if (opts.body != null) {
    bodyBuf = Buffer.from(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = bodyBuf.length
  }
  return new Promise((resolve) => {
    const req = http.request(
      { host: HOST, port: PORT, method, path: opts.path, headers },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          let json = null
          try { json = JSON.parse(body) } catch (_) { json = null }
          resolve({ statusCode: res.statusCode, body, json })
        })
      }
    )
    req.setTimeout(15000, () => req.destroy(new Error('request_timeout')))
    req.on('error', (err) => resolve({ statusCode: 0, body: '', json: null, error: err.message }))
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

/**
 * 同步 mysql 查询，返回 stdout 字符串（-N -B 去掉表头）。
 * @param {string} sql
 * @returns {string}
 */
function mysqlExec(sql) {
  const out = execFileSync(
    'mysql',
    ['-u' + DB_USER, '-p' + DB_PASS, '-h' + DB_HOST, '-N', '-B', DB_NAME, '-e', sql],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return out.toString('utf8').trim()
}

/**
 * 异步执行 pm2 restart，10 秒超时。
 */
function pm2RestartVision() {
  return new Promise((resolve) => {
    execFile('pm2', ['restart', 'vision-server', '--update-env'], { timeout: 30000 }, (err, stdout) => {
      resolve({ ok: !err, stdout: stdout || '' })
    })
  })
}

/**
 * 等待 vision-server 重启后恢复（admin 登录接口 200）。
 */
async function waitForServerReady(maxMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const r = await httpRequest({
      method: 'POST',
      path: '/api/v1/admin/auth/login',
      body: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD }
    })
    if (r.json && r.json.code === 200) return true
    await new Promise((r2) => setTimeout(r2, 500))
  }
  return false
}

async function adminLogin() {
  const r = await httpRequest({
    method: 'POST',
    path: '/api/v1/admin/auth/login',
    body: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD }
  })
  assert.ok(r.json && r.json.code === 200, 'admin 登录失败: ' + r.body)
  return r.json.data.token
}

/**
 * 用 admin token 创建员工，返回 server 返回的 employee 对象。
 */
async function adminCreateEmployee(adminToken, payload) {
  const r = await httpRequest({
    method: 'POST',
    path: '/api/v1/admin/employees',
    headers: { Authorization: 'Bearer ' + adminToken },
    body: payload
  })
  assert.ok(r.json && r.json.code === 200, '创建员工失败: ' + r.body)
  return r.json.data.employee
}

async function adminDeleteEmployee(adminToken, id) {
  // 先确保 SQL 兜底，删 dependent
  try { mysqlExec(`DELETE FROM employee_sessions WHERE employee_id = ${Number(id)}`) } catch (_) {}
  const r = await httpRequest({
    method: 'DELETE',
    path: `/api/v1/admin/employees/${id}`,
    headers: { Authorization: 'Bearer ' + adminToken }
  })
  // 即使 API 返回 409（有依赖），最后用 SQL 兜底
  if (!r.json || r.json.code !== 200) {
    try {
      mysqlExec(`DELETE FROM customer_transfers WHERE from_employee_id = ${Number(id)} OR to_employee_id = ${Number(id)}`)
      mysqlExec(`DELETE FROM follow_ups WHERE employee_id = ${Number(id)}`)
      mysqlExec(`UPDATE customers SET active = 0 WHERE assigned_employee_id = ${Number(id)}`)
      mysqlExec(`DELETE FROM customers WHERE assigned_employee_id = ${Number(id)}`)
      mysqlExec(`DELETE FROM employee_sessions WHERE employee_id = ${Number(id)}`)
      mysqlExec(`DELETE FROM employees WHERE id = ${Number(id)}`)
    } catch (e) {
      // 已被前面 API 删除即忽略
    }
  }
}

async function adminCreateDepartment(adminToken, name) {
  const r = await httpRequest({
    method: 'POST',
    path: '/api/v1/admin/departments',
    headers: { Authorization: 'Bearer ' + adminToken },
    body: { name }
  })
  assert.ok(r.json && r.json.code === 200, '创建部门失败: ' + r.body)
  return r.json.data.department
}

async function adminDeleteDepartment(adminToken, id) {
  await httpRequest({
    method: 'DELETE',
    path: `/api/v1/admin/departments/${id}`,
    headers: { Authorization: 'Bearer ' + adminToken }
  })
}

/**
 * 员工首登改密 → 拿"业务可用 token"。
 *  1. 登录拿 token1（must_change_password=true）
 *  2. 用 token1 调 change-password 把 Init@2025 改成新密码
 *  3. 重新登录拿 token2
 */
async function getWorkingEmployeeToken(phone, initPassword, newPassword) {
  const r1 = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/auth/login',
    body: { phone, password: initPassword, device_id: 'sec-test-' + Date.now() }
  })
  assert.ok(r1.json && r1.json.code === 200, `${phone} 首登失败: ` + r1.body)

  if (r1.json.data.must_change_password) {
    const rc = await httpRequest({
      method: 'POST',
      path: '/api/v1/employee/auth/change-password',
      headers: { Authorization: 'Bearer ' + r1.json.data.token },
      body: { old_password: initPassword, new_password: newPassword }
    })
    assert.ok(rc.json && rc.json.code === 200, `${phone} 改密失败: ` + rc.body)

    const r2 = await httpRequest({
      method: 'POST',
      path: '/api/v1/employee/auth/login',
      body: { phone, password: newPassword, device_id: 'sec-test-after-' + Date.now() }
    })
    assert.ok(r2.json && r2.json.code === 200, `${phone} 改密后登录失败: ` + r2.body)
    return r2.json.data
  }
  return r1.json.data
}

// ============ 套件状态 ============
const ctx = {
  adminToken: null,
  // 测试 1：临时员工
  lockTestEmployeeId: null,
  lockTestPhone: '13900099999',
  // 测试 3：staff B 与他的客户
  staffBId: null,
  staffBPhone: '13900088888',
  staffBCustomerId: null,
  // 测试 4：跨部门
  otherDeptId: null,
  otherManagerId: null,
  otherManagerPhone: '13900077777',
  defaultDeptStaffId: null,
  defaultDeptStaffPhone: '13900066666',
  defaultDeptStaffToken: null,
  defaultDeptStaffCustomerId: null,
  pendingTransferId: null
}

// ============ 准备 ============

test('Phase4 安全 / 0. 取得 admin token', async () => {
  ctx.adminToken = await adminLogin()
  assert.ok(ctx.adminToken)
})

// ============ 测试 1：错密 5 次锁定 ============

test('Phase4 安全 / 1. 错密 5 次锁定（临时员工）', async () => {
  // 1.1 admin 端临时建员工 13900099999
  const emp = await adminCreateEmployee(ctx.adminToken, {
    phone: ctx.lockTestPhone,
    password: 'Init@2025',
    display_name: '锁定测试员工',
    role: 'staff',
    department_id: 1
  })
  ctx.lockTestEmployeeId = emp.id

  // 1.2 用错密码登录 5 次（每次必须 401）
  for (let i = 0; i < 5; i += 1) {
    const r = await httpRequest({
      method: 'POST',
      path: '/api/v1/employee/auth/login',
      body: { phone: ctx.lockTestPhone, password: 'WrongPwd@' + i, device_id: 'lock-fail-' + i }
    })
    assert.strictEqual(r.statusCode, 401, `第 ${i + 1} 次错密应 401，实际 ${r.statusCode}: ${r.body}`)
  }

  // 1.3 第 6 次错密 → 必须 429
  const r6 = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/auth/login',
    body: { phone: ctx.lockTestPhone, password: 'WrongPwd@6', device_id: 'lock-fail-6' }
  })
  assert.strictEqual(r6.statusCode, 429, `第 6 次错密必须 429，实际 ${r6.statusCode}: ${r6.body}`)

  // 1.4 第 7 次用正确密码登录 → 应仍被锁（429）
  const r7 = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/auth/login',
    body: { phone: ctx.lockTestPhone, password: 'Init@2025', device_id: 'lock-correct-7' }
  })
  assert.strictEqual(r7.statusCode, 429, `锁定期内即便正确密码也应 429，实际 ${r7.statusCode}: ${r7.body}`)
})

// ============ 测试 2：JWT 跨端隔离 ============

test('Phase4 安全 / 2. JWT 跨端隔离（staff token 不能调 admin / admin token 不能调 employee）', async () => {
  // 先确保 manager 可登录（admin reset → 改密 → 重新登录）
  await httpRequest({
    method: 'PUT',
    path: '/api/v1/admin/employees/2/reset-password',
    headers: { Authorization: 'Bearer ' + ctx.adminToken },
    body: { password: 'Init@2025' }
  })
  const sess = await getWorkingEmployeeToken('13900000002', 'Init@2025', 'SecMgr@2025')
  const employeeToken = sess.token

  // 2.1 employee token 调 admin 接口
  const r1 = await httpRequest({
    method: 'GET',
    path: '/api/v1/admin/employees',
    headers: { Authorization: 'Bearer ' + employeeToken }
  })
  assert.ok(r1.statusCode === 401 || r1.statusCode === 403, `employee→admin 必须 401/403，实际 ${r1.statusCode}`)

  // 2.2 admin token 调 employee 接口
  const r2 = await httpRequest({
    method: 'GET',
    path: '/api/v1/employee/me',
    headers: { Authorization: 'Bearer ' + ctx.adminToken }
  })
  assert.ok(r2.statusCode === 401 || r2.statusCode === 403, `admin→employee 必须 401/403，实际 ${r2.statusCode}`)

  // 2.3 无 token 调 admin → 401
  const r3 = await httpRequest({ method: 'GET', path: '/api/v1/admin/employees' })
  assert.strictEqual(r3.statusCode, 401)

  // 2.4 伪造的 token 调 employee → 401
  const r4 = await httpRequest({
    method: 'GET',
    path: '/api/v1/employee/me',
    headers: { Authorization: 'Bearer fake.token.value' }
  })
  assert.strictEqual(r4.statusCode, 401)
})

// ============ 测试 3：横向越权 ============

test('Phase4 安全 / 3. 横向越权（staff A 读/改 staff B 的客户）', async () => {
  // 3.1 admin 端建临时 staff B（与 staff A 同部门 1）
  const empB = await adminCreateEmployee(ctx.adminToken, {
    phone: ctx.staffBPhone,
    password: 'Init@2025',
    display_name: '越权测试员工B',
    role: 'staff',
    department_id: 1
  })
  ctx.staffBId = empB.id

  // 3.2 staff B 首登改密 + 拿 working token
  const sessB = await getWorkingEmployeeToken(ctx.staffBPhone, 'Init@2025', 'TestB@2025')
  assert.ok(sessB.token)

  // 3.3 staff B 创建一个客户
  const rCreate = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/customers',
    headers: { Authorization: 'Bearer ' + sessB.token },
    body: {
      display_name: '越权测试客户-StaffB',
      phone: '139' + String(Date.now()).slice(-8),
      client_uuid: 'sec-staffB-customer-' + Date.now()
    }
  })
  assert.ok(rCreate.json && rCreate.json.code === 200, 'staff B 建客户失败: ' + rCreate.body)
  const cid =
    (rCreate.json.data && rCreate.json.data.customer && rCreate.json.data.customer.id) ||
    (rCreate.json.data && rCreate.json.data.server_id)
  assert.ok(cid, '未拿到 customer_id: ' + rCreate.body)
  ctx.staffBCustomerId = cid

  // 3.4 用 staff A（id=1, 同部门 1, role=staff）的 working token 去读 staff B 的客户
  // staff A must_change_password=1，先走 working flow（用一个临时密码）；之后会回退
  // 为了不污染 staff A 的 must_change_password，用 admin reset 后再走流程
  const rReset = await httpRequest({
    method: 'PUT',
    path: '/api/v1/admin/employees/1/reset-password',
    headers: { Authorization: 'Bearer ' + ctx.adminToken },
    body: { password: 'Init@2025' }
  })
  assert.ok(rReset.json && rReset.json.code === 200, 'reset staff A 密码失败')

  const sessA = await getWorkingEmployeeToken('13900000001', 'Init@2025', 'TestA@Phase4')

  // 3.5 staff A 读 staff B 的客户 → 必须 403
  const rGet = await httpRequest({
    method: 'GET',
    path: `/api/v1/employee/customers/${cid}`,
    headers: { Authorization: 'Bearer ' + sessA.token }
  })
  assert.strictEqual(rGet.statusCode, 403, `staff A 读 staff B 的客户必须 403，实际 ${rGet.statusCode}: ${rGet.body}`)

  // 3.6 staff A 改 staff B 的客户 → 必须 403
  const rPut = await httpRequest({
    method: 'PUT',
    path: `/api/v1/employee/customers/${cid}`,
    headers: { Authorization: 'Bearer ' + sessA.token },
    body: { remark: '越权改' }
  })
  assert.strictEqual(rPut.statusCode, 403, `staff A 改 staff B 的客户必须 403，实际 ${rPut.statusCode}: ${rPut.body}`)

  // 3.7 staff A 删 staff B 的客户 → 必须 403
  const rDel = await httpRequest({
    method: 'DELETE',
    path: `/api/v1/employee/customers/${cid}`,
    headers: { Authorization: 'Bearer ' + sessA.token }
  })
  assert.strictEqual(rDel.statusCode, 403, `staff A 删 staff B 的客户必须 403，实际 ${rDel.statusCode}: ${rDel.body}`)
})

// ============ 测试 4：跨部门 manager 审批 ============

test('Phase4 安全 / 4. 跨部门 manager 不能审批其他部门 staff 的 transfer', async () => {
  // 4.1 建一个新部门
  const dept = await adminCreateDepartment(ctx.adminToken, '安全测试部门-' + Date.now())
  ctx.otherDeptId = dept.id

  // 4.2 在新部门建一个 manager
  const mgr = await adminCreateEmployee(ctx.adminToken, {
    phone: ctx.otherManagerPhone,
    password: 'Init@2025',
    display_name: '跨部门Manager',
    role: 'manager',
    department_id: ctx.otherDeptId
  })
  ctx.otherManagerId = mgr.id

  // 4.3 在 default 部门(1) 建一个 staff（ctx.defaultDeptStaffPhone），让他提 transfer
  const staff = await adminCreateEmployee(ctx.adminToken, {
    phone: ctx.defaultDeptStaffPhone,
    password: 'Init@2025',
    display_name: '默认部门Staff-审批测试',
    role: 'staff',
    department_id: 1
  })
  ctx.defaultDeptStaffId = staff.id

  // 4.4 staff 改密 + 拿 token + 建一个客户
  const sess = await getWorkingEmployeeToken(ctx.defaultDeptStaffPhone, 'Init@2025', 'DeptS@2025')
  ctx.defaultDeptStaffToken = sess.token

  const rC = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/customers',
    headers: { Authorization: 'Bearer ' + sess.token },
    body: {
      display_name: '审批测试客户',
      phone: '139' + String(Date.now()).slice(-8),
      client_uuid: 'sec-dept-customer-' + Date.now()
    }
  })
  assert.ok(rC.json && rC.json.code === 200)
  const cid =
    (rC.json.data && rC.json.data.customer && rC.json.data.customer.id) ||
    (rC.json.data && rC.json.data.server_id)
  ctx.defaultDeptStaffCustomerId = cid

  // 4.5 staff 提交 transfer
  const rT = await httpRequest({
    method: 'POST',
    path: '/api/v1/employee/customer-transfers',
    headers: { Authorization: 'Bearer ' + sess.token },
    body: { customer_id: cid, reason: '跨部门审批越权测试' }
  })
  assert.ok(rT.json && rT.json.code === 200, '提交 transfer 失败: ' + rT.body)
  const tid =
    (rT.json.data && rT.json.data.transfer && rT.json.data.transfer.id) ||
    (rT.json.data && rT.json.data.server_id)
  assert.ok(tid)
  ctx.pendingTransferId = tid

  // 4.6 跨部门 manager 改密 + 拿 token
  const sessMgr = await getWorkingEmployeeToken(ctx.otherManagerPhone, 'Init@2025', 'MgrX@2025')

  // 4.7 跨部门 manager 调 approve → 必须 403
  const rApprove = await httpRequest({
    method: 'PUT',
    path: `/api/v1/employee/customer-transfers/${tid}/approve`,
    headers: { Authorization: 'Bearer ' + sessMgr.token },
    body: { to_employee_id: ctx.otherManagerId }
  })
  assert.strictEqual(rApprove.statusCode, 403, `跨部门 manager 审批必须 403，实际 ${rApprove.statusCode}: ${rApprove.body}`)

  // 4.8 跨部门 manager 调 reject → 必须 403
  const rReject = await httpRequest({
    method: 'PUT',
    path: `/api/v1/employee/customer-transfers/${tid}/reject`,
    headers: { Authorization: 'Bearer ' + sessMgr.token },
    body: { approval_remark: '越权 reject' }
  })
  assert.strictEqual(rReject.statusCode, 403, `跨部门 manager 驳回必须 403，实际 ${rReject.statusCode}: ${rReject.body}`)

  // 4.9 顺带：staff（非 manager）调 approve → 也应 403（角色拦截）
  const rStaffApprove = await httpRequest({
    method: 'PUT',
    path: `/api/v1/employee/customer-transfers/${tid}/approve`,
    headers: { Authorization: 'Bearer ' + sess.token },
    body: { to_employee_id: ctx.otherManagerId }
  })
  assert.strictEqual(rStaffApprove.statusCode, 403, `staff 调 approve 必须 403，实际 ${rStaffApprove.statusCode}`)
})

// ============ 测试 5：token_hash / bcrypt 哈希 ============

test('Phase4 安全 / 5. employee_sessions.token_hash 必须是哈希，不是明文 JWT', async () => {
  // 走 reset → 改密 → 重新登录拿 token（与测试 2 同模式）
  await httpRequest({
    method: 'PUT',
    path: '/api/v1/admin/employees/2/reset-password',
    headers: { Authorization: 'Bearer ' + ctx.adminToken },
    body: { password: 'Init@2025' }
  })
  const sess = await getWorkingEmployeeToken('13900000002', 'Init@2025', 'SecHash@2025')
  const rawToken = sess.token
  assert.ok(rawToken && rawToken.split('.').length === 3, 'JWT 三段结构异常')

  // 直查 employee_sessions
  const rows = mysqlExec(
    `SELECT token_hash FROM employee_sessions WHERE employee_id = 2 AND revoked = 0 ORDER BY id DESC LIMIT 1`
  )
  assert.ok(rows && rows.length > 0, 'employee_sessions 无 active session')
  const tokenHash = rows.split('\n')[0].trim()

  // 必须是 64 位 hex（SHA-256）
  assert.match(tokenHash, /^[a-f0-9]{64}$/, `token_hash 不是 SHA-256 hex：${tokenHash}`)
  // 绝不能等于 JWT 原文或包含 JWT 前缀
  assert.notStrictEqual(tokenHash, rawToken, 'token_hash 居然等于 JWT 原文')
  assert.ok(!tokenHash.startsWith('eyJ'), 'token_hash 像是 JWT 原文')
})

test('Phase4 安全 / 5b. employees.password_hash 必须是 bcrypt $2 开头，且不是明文', async () => {
  const rows = mysqlExec(
    `SELECT password_hash FROM employees WHERE phone IN ('13900000001','13900000002')`
  )
  assert.ok(rows && rows.length > 0, '没读到员工 password_hash')
  rows.split('\n').forEach((line) => {
    const h = line.trim()
    assert.ok(h.startsWith('$2'), `password_hash 不是 bcrypt：${h.slice(0, 8)}...`)
    assert.notStrictEqual(h, 'Init@2025')
    assert.notStrictEqual(h, 'Admin@123456')
    assert.ok(h.length >= 50, 'bcrypt hash 长度异常')
  })
})

// ============ 收尾：清理 + pm2 restart ============

test('Phase4 安全 / 9. 清理临时数据', async () => {
  // 1) 锁定测试员工
  if (ctx.lockTestEmployeeId) {
    await adminDeleteEmployee(ctx.adminToken, ctx.lockTestEmployeeId)
  }
  // 2) staff B 与他的客户
  if (ctx.staffBCustomerId) {
    try { mysqlExec(`DELETE FROM customers WHERE id = ${Number(ctx.staffBCustomerId)}`) } catch (_) {}
  }
  if (ctx.staffBId) {
    await adminDeleteEmployee(ctx.adminToken, ctx.staffBId)
  }
  // 3) 跨部门 transfer / 客户 / 员工 / 部门
  if (ctx.pendingTransferId) {
    try { mysqlExec(`DELETE FROM customer_transfers WHERE id = ${Number(ctx.pendingTransferId)}`) } catch (_) {}
  }
  if (ctx.defaultDeptStaffCustomerId) {
    try { mysqlExec(`DELETE FROM customers WHERE id = ${Number(ctx.defaultDeptStaffCustomerId)}`) } catch (_) {}
  }
  if (ctx.defaultDeptStaffId) {
    await adminDeleteEmployee(ctx.adminToken, ctx.defaultDeptStaffId)
  }
  if (ctx.otherManagerId) {
    await adminDeleteEmployee(ctx.adminToken, ctx.otherManagerId)
  }
  if (ctx.otherDeptId) {
    await adminDeleteDepartment(ctx.adminToken, ctx.otherDeptId)
  }

  // 4) 把 staff A / manager 都改回初始密码 + must_change_password=1
  try {
    await httpRequest({
      method: 'PUT',
      path: '/api/v1/admin/employees/1/reset-password',
      headers: { Authorization: 'Bearer ' + ctx.adminToken },
      body: { password: 'Init@2025' }
    })
  } catch (_) {}
  try {
    await httpRequest({
      method: 'PUT',
      path: '/api/v1/admin/employees/2/reset-password',
      headers: { Authorization: 'Bearer ' + ctx.adminToken },
      body: { password: 'Init@2025' }
    })
  } catch (_) {}

  // SQL 校验：临时 phone 都不存在
  const left = mysqlExec(
    `SELECT COUNT(*) FROM employees WHERE phone IN ('${ctx.lockTestPhone}','${ctx.staffBPhone}','${ctx.otherManagerPhone}','${ctx.defaultDeptStaffPhone}')`
  )
  assert.strictEqual(left, '0', `仍有临时员工残留：${left}`)
})

test('Phase4 安全 / 10. pm2 restart vision-server --update-env 清登录失败 Map', async () => {
  const r = await pm2RestartVision()
  assert.ok(r.ok, 'pm2 restart 失败: ' + r.stdout)
  const ready = await waitForServerReady(20000)
  assert.ok(ready, 'vision-server 重启后未恢复服务')
})
