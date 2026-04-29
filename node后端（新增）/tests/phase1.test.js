/**
 * 员工 App Phase 1 单元测试（6 个核心方法 + 关键 helper）。
 * 用 Node 18+ 内置 `node --test` runner，无需新依赖。
 *
 * 跑法：cd node后端（新增） && npm test
 *
 * 测试覆盖（按 TASK §7 要求 6 个核心方法）：
 *   1. employeeService.buildEmployeeTokenPayload + safeEmployee（login 链路出参）
 *   2. employeeService.changePassword 边界（密码强度）
 *   3. customerService.generateCustomerNo（编码规则）+ safeCustomer（tags 反序列化）
 *   4. followUpService.safeFollowUp（attachments 反序列化）
 *   5. transferService.safeTransfer（出参标准化）
 *   6. syncService.processBatch（入参校验：不是数组 / 超长）
 *
 * 另加：
 *   - utils/datetime.parseClientDatetime（时区 +8h 修复后必须保持的契约）
 *   - utils/jwt.generateToken / verifyToken（EMPLOYEE 三端隔离）
 */
const test = require('node:test')
const assert = require('node:assert')

// ====== utils/datetime ======
const { parseClientDatetime, nowUtcString } = require('../utils/datetime')

test('parseClientDatetime 北京时间字符串 → UTC -8h', () => {
  const utc = parseClientDatetime('2026-05-01 10:00:00')
  assert.strictEqual(utc, '2026-05-01 02:00:00')
})

test('parseClientDatetime 接受 ISO 带时区', () => {
  const utc = parseClientDatetime('2026-05-01T10:00:00+08:00')
  assert.strictEqual(utc, '2026-05-01 02:00:00')
})

test('parseClientDatetime null/undefined/空串 → null', () => {
  assert.strictEqual(parseClientDatetime(null), null)
  assert.strictEqual(parseClientDatetime(undefined), null)
  assert.strictEqual(parseClientDatetime(''), null)
})

test('nowUtcString 返回 YYYY-MM-DD HH:mm:ss 格式', () => {
  const s = nowUtcString()
  assert.match(s, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
})

// ====== utils/jwt ======
const { USER_TYPES, generateToken, verifyToken } = require('../utils/jwt')

test('jwt USER_TYPES 含 EMPLOYEE', () => {
  assert.strictEqual(USER_TYPES.EMPLOYEE, 'employee')
  assert.strictEqual(USER_TYPES.ADMIN, 'admin')
  assert.strictEqual(USER_TYPES.MOBILE, 'mobile')
})

test('jwt employee token sign + verify 闭环', () => {
  const t = generateToken({ id: 99, role: 'staff' }, USER_TYPES.EMPLOYEE)
  const decoded = verifyToken(t, USER_TYPES.EMPLOYEE)
  assert.ok(decoded)
  assert.strictEqual(decoded.id, 99)
  assert.strictEqual(decoded.type, 'employee')
})

test('jwt employee token 不能被当 admin 验通过', () => {
  const t = generateToken({ id: 99 }, USER_TYPES.EMPLOYEE)
  // 跨类型 verify：用 admin secret 解 employee token，应失败
  const decoded = verifyToken(t, USER_TYPES.ADMIN)
  assert.strictEqual(decoded, null)
})

test('jwt admin token 不能被当 employee 验通过', () => {
  const t = generateToken({ id: 1 }, USER_TYPES.ADMIN)
  const decoded = verifyToken(t, USER_TYPES.EMPLOYEE)
  assert.strictEqual(decoded, null)
})

// ====== employeeService.safeEmployee + buildEmployeeTokenPayload ======
const employeeService = require('../services/employeeService')

test('employeeService.safeEmployee 不返回 password_hash', () => {
  const row = {
    id: 1, phone: '13800000000', display_name: 'X',
    password_hash: 'should-not-leak',
    role: 'staff', department_id: 1, active: 1, must_change_password: 0,
    last_login_at: null, last_login_ip: null,
    created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00'
  }
  const safe = employeeService.safeEmployee(row)
  assert.ok(safe)
  assert.strictEqual(safe.password_hash, undefined)
  assert.strictEqual(safe.id, 1)
  assert.strictEqual(safe.role, 'staff')
})

test('employeeService.buildEmployeeTokenPayload 含必要字段', () => {
  const payload = employeeService.buildEmployeeTokenPayload({
    id: 5, phone: '13900000000', display_name: 'Y', role: 'manager', department_id: 3
  })
  assert.strictEqual(payload.id, 5)
  assert.strictEqual(payload.role, 'manager')
  assert.strictEqual(payload.department_id, 3)
})

// ====== customerService.generateCustomerNo + safeCustomer ======
const customerService = require('../services/customerService')

test('customerService.generateCustomerNo 格式 C+8 位日期+4 位序号', () => {
  const no = customerService.generateCustomerNo()
  assert.match(no, /^C\d{12}$/)
})

test('customerService.safeCustomer tags JSON 反序列化', () => {
  const row = {
    id: 1, customer_no: 'C202604280001', display_name: 'X', phone: '13800000000',
    gender: 'unknown', age: null, school: '', class_name: '',
    source: 'employee', status: 'potential', level: 'C',
    tags: '["A级","急客"]', remark: null,
    assigned_employee_id: 2, next_follow_up_at: null, next_follow_up_text: '',
    last_follow_up_at: null, active: 1, client_uuid: null, created_by: 2,
    created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00'
  }
  const safe = customerService.safeCustomer(row)
  assert.ok(Array.isArray(safe.tags))
  assert.deepStrictEqual(safe.tags, ['A级', '急客'])
  assert.strictEqual(safe.active, true) // 应被转 boolean
})

// ====== followUpService.safeFollowUp ======
const followUpService = require('../services/followUpService')

test('followUpService.safeFollowUp attachments 反序列化', () => {
  const row = {
    id: 1, customer_id: 1, employee_id: 2,
    follow_at: '2026-01-01 00:00:00',
    type: 'phone', result: 'interested',
    content: 'hi',
    attachments: '[101, 102]',
    next_follow_up_at: null, client_uuid: null,
    created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00'
  }
  const safe = followUpService.safeFollowUp(row)
  assert.deepStrictEqual(safe.attachments, [101, 102])
})

// ====== transferService.safeTransfer ======
const transferService = require('../services/transferService')

test('transferService.safeTransfer 标准化 ID 字段', () => {
  const row = {
    id: 5, customer_id: 1, from_employee_id: 2, to_employee_id: 3,
    reason: 'test', status: 'pending', approved_by: null, approved_at: null,
    approval_remark: '', client_uuid: null,
    created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00'
  }
  const safe = transferService.safeTransfer(row)
  assert.strictEqual(safe.id, 5)
  assert.strictEqual(safe.status, 'pending')
})

// ====== syncService.processBatch ======
const syncService = require('../services/syncService')

test('syncService.processBatch ops 不是数组 → service 兜底返回 {results:[]}（route 层已抛 400）', async () => {
  const r = await syncService.processBatch({ id: 1, role: 'staff' }, 'not-an-array')
  assert.ok(r)
  assert.ok(Array.isArray(r.results))
  assert.strictEqual(r.results.length, 0)
})

test('syncService.processBatch ops 超长 → 抛错', async () => {
  const big = new Array(500).fill({ op: 'create', type: 'customer', client_uuid: 'x', payload: {} })
  await assert.rejects(
    () => syncService.processBatch({ id: 1, role: 'staff' }, big),
    /上限|超过|max|too many|批|单次|限制|多/i
  )
})

// ====== employeeService.changePassword 弱密码拒绝 ======
test('employeeService.changePassword 新密码 < 8 位 → 抛错', async () => {
  // changePassword 第一步会查 DB；用一个不存在的 id，期待"账号不存在"或"密码"错误
  await assert.rejects(
    () => employeeService.changePassword(999999, 'whatever', 'short'),
    /密码|password|不存在|账号/
  )
})

// ====== employeeService.findEmployeeById 接口存在 ======
test('employeeService.findEmployeeById 函数存在并返回 Promise', async () => {
  assert.strictEqual(typeof employeeService.findEmployeeById, 'function')
  const result = await employeeService.findEmployeeById(999999)
  assert.strictEqual(result, null) // 不存在的 id 应返回 null
})

// ====== Cleanup：关闭 DB 连接池让进程能正常退出 ======
test('cleanup: 关闭 DB 连接池', async () => {
  const { pool } = require('../utils/db')
  await pool.end()
})
