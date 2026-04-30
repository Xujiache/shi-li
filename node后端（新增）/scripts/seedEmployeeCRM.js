/**
 * 员工 CRM 测试数据 seed
 * 幂等脚本：补齐员工、部门、客户、跟进、转移申请、通知
 * 运行：node scripts/seedEmployeeCRM.js
 */
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== '1') {
  console.error('[SEED] 拒绝在生产环境运行测试 seed。')
  process.exit(1)
}

const { query, execute, queryOne } = require('../utils/db')
const logger = require('../utils/logger')
const { hashPassword } = require('../utils/bcrypt')
const { safeJsonStringify } = require('../utils/helpers')

const STAFF_PASSWORD = 'Staff@123456'
const MANAGER_PASSWORD = 'Manager@123456'

function pad(n, w = 4) { return String(n).padStart(w, '0') }
function ymd(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`
}
function customerNoForToday(seq) {
  return `C${ymd(new Date())}${pad(seq)}`
}
function daysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
function fmtDateTime(d) {
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1, 2)
  const dd = pad(d.getDate(), 2)
  const hh = pad(d.getHours(), 2)
  const mi = pad(d.getMinutes(), 2)
  const ss = pad(d.getSeconds(), 2)
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

async function ensureDepartment(name, parentId = null) {
  const existing = await queryOne('SELECT id FROM departments WHERE name = ?', [name])
  if (existing) return existing.id
  const result = await execute(
    'INSERT INTO departments (name, parent_id, sort_order, active) VALUES (?, ?, ?, 1)',
    [name, parentId, 0]
  )
  return result.insertId
}

async function ensureEmployee({ phone, name, role, departmentId, position }) {
  const existing = await queryOne('SELECT id FROM employees WHERE phone = ?', [phone])
  if (existing) {
    // 同步显示名 / 角色 / 部门，方便重新跑刷新
    await execute(
      `UPDATE employees
         SET display_name = ?, role = ?, department_id = ?, position = ?, active = 1
       WHERE id = ?`,
      [name, role, departmentId, position || '', existing.id]
    )
    return existing.id
  }
  const password = role === 'manager' ? MANAGER_PASSWORD : STAFF_PASSWORD
  const hash = await hashPassword(password)
  const result = await execute(
    `INSERT INTO employees
       (phone, password_hash, display_name, role, department_id, position, active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
    [phone, hash, name, role, departmentId, position || '']
  )
  return result.insertId
}

async function setDeptManager(deptId, managerId) {
  await execute('UPDATE departments SET manager_id = ? WHERE id = ?', [managerId, deptId])
}

async function ensureCustomer(spec) {
  const found = await queryOne('SELECT id FROM customers WHERE client_uuid = ?', [spec.client_uuid])
  if (found) {
    // 重复执行时刷新可变字段，避免数据漂移
    await execute(
      `UPDATE customers
         SET display_name = ?, phone = ?, gender = ?, age = ?, school = ?, class_name = ?,
             source = ?, status = ?, level = ?, tags = ?, remark = ?,
             assigned_employee_id = ?, next_follow_up_at = ?, next_follow_up_text = ?,
             user_id = ?, active = 1
       WHERE id = ?`,
      [
        spec.display_name, spec.phone, spec.gender, spec.age, spec.school, spec.class_name,
        spec.source, spec.status, spec.level, safeJsonStringify(spec.tags || []), spec.remark || '',
        spec.assigned_employee_id, spec.next_follow_up_at, spec.next_follow_up_text || '',
        spec.user_id || null, found.id
      ]
    )
    return found.id
  }
  // 重试 customer_no
  for (let i = 0; i < 5; i++) {
    const customerNo = customerNoForToday(spec.seq + i)
    try {
      const result = await execute(
        `INSERT INTO customers
           (customer_no, user_id, display_name, phone, gender, age, school, class_name,
            source, status, level, tags, remark,
            assigned_employee_id, next_follow_up_at, next_follow_up_text,
            client_uuid, created_by, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          customerNo, spec.user_id || null, spec.display_name, spec.phone, spec.gender, spec.age,
          spec.school, spec.class_name,
          spec.source, spec.status, spec.level, safeJsonStringify(spec.tags || []), spec.remark || '',
          spec.assigned_employee_id, spec.next_follow_up_at, spec.next_follow_up_text || '',
          spec.client_uuid, spec.assigned_employee_id
        ]
      )
      return result.insertId
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY' && /uk_customers_no/.test(err.message)) {
        continue
      }
      throw err
    }
  }
  throw new Error(`无法为客户 ${spec.display_name} 生成唯一 customer_no`)
}

async function ensureFollowUp(spec) {
  const found = await queryOne('SELECT id FROM follow_ups WHERE client_uuid = ?', [spec.client_uuid])
  if (found) return found.id
  const result = await execute(
    `INSERT INTO follow_ups
       (customer_id, employee_id, follow_at, type, result, content, attachments,
        next_follow_up_at, client_uuid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.customer_id, spec.employee_id, spec.follow_at,
      spec.type, spec.result, spec.content,
      safeJsonStringify(spec.attachments || []),
      spec.next_follow_up_at || null,
      spec.client_uuid
    ]
  )
  // 顺便维护客户的 last_follow_up_at
  await execute(
    `UPDATE customers
       SET last_follow_up_at = GREATEST(COALESCE(last_follow_up_at, ?), ?)
     WHERE id = ?`,
    [spec.follow_at, spec.follow_at, spec.customer_id]
  )
  return result.insertId
}

async function ensureTransfer(spec) {
  const found = await queryOne('SELECT id FROM customer_transfers WHERE client_uuid = ?', [spec.client_uuid])
  if (found) return found.id
  const result = await execute(
    `INSERT INTO customer_transfers
       (customer_id, from_employee_id, to_employee_id, reason, status,
        approved_by, approved_at, approval_remark, client_uuid, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.customer_id, spec.from_employee_id, spec.to_employee_id || null,
      spec.reason, spec.status,
      spec.approved_by || null, spec.approved_at || null,
      spec.approval_remark || '', spec.client_uuid,
      spec.created_at || new Date()
    ]
  )
  return result.insertId
}

async function ensureNotification(spec) {
  // 用 (employee_id + title + type) 当唯一性近似键
  const found = await queryOne(
    'SELECT id FROM notifications WHERE employee_id = ? AND title = ? AND type = ?',
    [spec.employee_id, spec.title, spec.type]
  )
  if (found) return found.id
  const result = await execute(
    `INSERT INTO notifications
       (employee_id, type, title, body, payload, is_read, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.employee_id, spec.type, spec.title, spec.body || '',
      safeJsonStringify(spec.payload || {}),
      spec.is_read ? 1 : 0,
      spec.is_read ? (spec.read_at || new Date()) : null,
      spec.created_at || new Date()
    ]
  )
  return result.insertId
}

async function main() {
  try {
    logger.info('开始 seed 员工 CRM 测试数据...')

    // ===== 部门 =====
    const dept1 = await ensureDepartment('默认部门')
    const dept2 = await ensureDepartment('天堂校区')
    const dept3 = await ensureDepartment('晨曦校区')
    logger.info(`部门: 默认部门=${dept1}, 天堂校区=${dept2}, 晨曦校区=${dept3}`)

    // ===== 员工（保留已有 13700137000） =====
    const empStaff1 = await ensureEmployee({
      phone: '13700137000', name: '测试员工', role: 'staff',
      departmentId: dept1, position: '初级顾问'
    })
    const empManager = await ensureEmployee({
      phone: '13700137100', name: '张经理', role: 'manager',
      departmentId: dept1, position: '部门主管'
    })
    const empStaff2 = await ensureEmployee({
      phone: '13700137101', name: '王晓静', role: 'staff',
      departmentId: dept1, position: '客户顾问'
    })
    const empStaff3 = await ensureEmployee({
      phone: '13700137102', name: '李海洋', role: 'staff',
      departmentId: dept2, position: '客户顾问'
    })
    await setDeptManager(dept1, empManager)
    logger.info(`员工: 测试员工=${empStaff1}, 张经理=${empManager}, 王晓静=${empStaff2}, 李海洋=${empStaff3}`)

    // ===== 关联 mobile user（小程序家长李明妈妈） =====
    const parentUser = await queryOne('SELECT id FROM users WHERE phone = ?', ['13900139000'])
    const parentUserId = parentUser ? parentUser.id : null

    // ===== 客户 =====
    const today = new Date()
    const c1 = await ensureCustomer({
      client_uuid: 'seed-cust-001', seq: 1,
      display_name: '王小宝爸爸', phone: '13501010001', gender: 'male', age: 8,
      school: '天堂小学', class_name: '二年一班',
      source: 'employee', status: 'potential', level: 'B',
      tags: ['热情', '近视防控'], remark: '家长比较关注户外活动方案',
      assigned_employee_id: empStaff1,
      next_follow_up_at: fmtDateTime(daysFromNow(1)),
      next_follow_up_text: '电话回访课程方案'
    })
    const c2 = await ensureCustomer({
      client_uuid: 'seed-cust-002', seq: 2,
      display_name: '李明妈妈', phone: '13900139000', gender: 'female', age: 33,
      school: '天堂小学', class_name: '二年一班',
      source: 'miniprogram', status: 'interested', level: 'A',
      tags: ['小程序注册', '已查档案'],
      remark: '小程序里有李明的体检档案，已主动来咨询',
      assigned_employee_id: empStaff1,
      user_id: parentUserId,
      next_follow_up_at: fmtDateTime(today),
      next_follow_up_text: '今日加微信发课程详情'
    })
    const c3 = await ensureCustomer({
      client_uuid: 'seed-cust-003', seq: 3,
      display_name: '张萌萌妈妈', phone: '13501010003', gender: 'female', age: 30,
      school: '晨曦小学', class_name: '一年二班',
      source: 'transferred', status: 'signed', level: 'A',
      tags: ['老客户介绍', '已签约'], remark: '已签 12 课时课程包',
      assigned_employee_id: empStaff1,
      next_follow_up_at: null, next_follow_up_text: ''
    })
    const c4 = await ensureCustomer({
      client_uuid: 'seed-cust-004', seq: 4,
      display_name: '赵敏', phone: '13501010004', gender: 'female', age: 7,
      school: '光明小学', class_name: '一年三班',
      source: 'employee', status: 'lost', level: 'C',
      tags: ['暂不考虑'], remark: '家长表示孩子视力还可以，暂不考虑',
      assigned_employee_id: empStaff1,
      next_follow_up_at: null, next_follow_up_text: ''
    })
    const c5 = await ensureCustomer({
      client_uuid: 'seed-cust-005', seq: 5,
      display_name: '孙宇爸爸', phone: '13501010005', gender: 'male', age: 9,
      school: '阳光小学', class_name: '三年一班',
      source: 'employee', status: 'potential', level: 'C',
      tags: ['待跟进'], remark: '上次说要再考虑',
      assigned_employee_id: empStaff1,
      next_follow_up_at: fmtDateTime(daysFromNow(-3)),
      next_follow_up_text: '已逾期 3 天未跟进'
    })
    const c6 = await ensureCustomer({
      client_uuid: 'seed-cust-006', seq: 6,
      display_name: '周心怡妈妈', phone: '13501010006', gender: 'female', age: 31,
      school: '天堂小学', class_name: '二年二班',
      source: 'employee', status: 'interested', level: 'B',
      tags: ['有意向'], remark: '约好下周面谈',
      assigned_employee_id: empStaff2,
      next_follow_up_at: fmtDateTime(daysFromNow(5)),
      next_follow_up_text: '面谈讲解视力训练方案'
    })
    const c7 = await ensureCustomer({
      client_uuid: 'seed-cust-007', seq: 7,
      display_name: '吴大壮妈妈', phone: '13501010007', gender: 'female', age: 35,
      school: '红旗小学', class_name: '四年一班',
      source: 'transferred', status: 'signed', level: 'A',
      tags: ['续费'], remark: '原归 测试员工，已转给 李海洋',
      assigned_employee_id: empStaff3,
      next_follow_up_at: null, next_follow_up_text: ''
    })
    const c8 = await ensureCustomer({
      client_uuid: 'seed-cust-008', seq: 8,
      display_name: '钱小满妈妈', phone: '13501010008', gender: 'female', age: 28,
      school: '晨曦小学', class_name: '幼大班',
      source: 'miniprogram', status: 'potential', level: 'B',
      tags: ['新注册'], remark: '今天刚从小程序注册',
      assigned_employee_id: empStaff1,
      next_follow_up_at: fmtDateTime(daysFromNow(7)),
      next_follow_up_text: '一周后电话沟通'
    })
    logger.info(`客户: 共 8 条，均落库`)

    // ===== 跟进 =====
    await ensureFollowUp({
      client_uuid: 'seed-fu-001-1', customer_id: c1, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-7)),
      type: 'phone', result: 'follow_up',
      content: '首次电话沟通，家长比较关注户外活动方案，要求电话回访。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-001-2', customer_id: c1, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-2)),
      type: 'wechat', result: 'follow_up',
      content: '微信发送了课程介绍 PDF，约好明天电话回访。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-002-1', customer_id: c2, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-3)),
      type: 'wechat', result: 'interested',
      content: '从小程序档案进来，对孩子视力下降有担忧，已加微信。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-002-2', customer_id: c2, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-1)),
      type: 'wechat', result: 'interested',
      content: '客户主动询问课程价格，今日加发详情。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-003-1', customer_id: c3, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-14)),
      type: 'face', result: 'signed',
      content: '面谈后当场签约 12 课时套餐。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-004-1', customer_id: c4, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-10)),
      type: 'phone', result: 'lost',
      content: '家长表示孩子视力还可以，暂不考虑。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-005-1', customer_id: c5, employee_id: empStaff1,
      follow_at: fmtDateTime(daysFromNow(-15)),
      type: 'phone', result: 'no_progress',
      content: '客户表示需要再考虑一下，约 3 天后回访。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-006-1', customer_id: c6, employee_id: empStaff2,
      follow_at: fmtDateTime(daysFromNow(-5)),
      type: 'wechat', result: 'interested',
      content: '微信沟通顺利，约下周面谈。'
    })
    await ensureFollowUp({
      client_uuid: 'seed-fu-007-1', customer_id: c7, employee_id: empStaff3,
      follow_at: fmtDateTime(daysFromNow(-1)),
      type: 'phone', result: 'follow_up',
      content: '从测试员工转交后已电话联系，沟通顺畅。'
    })
    logger.info('跟进: 共 9 条')

    // ===== 转移申请 =====
    await ensureTransfer({
      client_uuid: 'seed-xfer-001',
      customer_id: c1, from_employee_id: empStaff1, to_employee_id: empStaff2,
      reason: '客户在 王晓静 学区，建议转给她跟进',
      status: 'pending',
      created_at: fmtDateTime(daysFromNow(-1))
    })
    await ensureTransfer({
      client_uuid: 'seed-xfer-002',
      customer_id: c7, from_employee_id: empStaff1, to_employee_id: empStaff3,
      reason: '客户家在 天堂校区，由 李海洋 接手更方便',
      status: 'approved',
      approved_by: empManager, approved_at: fmtDateTime(daysFromNow(-3)),
      approval_remark: '同意转出，请尽快交接资料',
      created_at: fmtDateTime(daysFromNow(-5))
    })
    await ensureTransfer({
      client_uuid: 'seed-xfer-003',
      customer_id: c4, from_employee_id: empStaff1, to_employee_id: empStaff2,
      reason: '想转给王晓静再尝试一次',
      status: 'rejected',
      approved_by: empManager, approved_at: fmtDateTime(daysFromNow(-2)),
      approval_remark: '客户已 lost，不建议占用资源',
      created_at: fmtDateTime(daysFromNow(-4))
    })
    await ensureTransfer({
      client_uuid: 'seed-xfer-004',
      customer_id: c5, from_employee_id: empStaff1, to_employee_id: empStaff2,
      reason: '看看是否要转出',
      status: 'cancelled',
      created_at: fmtDateTime(daysFromNow(-2))
    })
    logger.info('转移申请: pending/approved/rejected/cancelled 各 1')

    // ===== 通知 =====
    await ensureNotification({
      employee_id: empStaff1, type: 'follow_up_reminder',
      title: '今日待跟进客户 1 位',
      body: '李明妈妈（C2）今日需联系',
      payload: { customer_id: c2 },
      is_read: false,
      created_at: fmtDateTime(daysFromNow(0))
    })
    await ensureNotification({
      employee_id: empStaff1, type: 'transfer_approved',
      title: '转出申请已通过',
      body: '客户 吴大壮妈妈 已转交给 李海洋',
      payload: { customer_id: c7, transfer_status: 'approved' },
      is_read: true,
      read_at: fmtDateTime(daysFromNow(-2)),
      created_at: fmtDateTime(daysFromNow(-3))
    })
    await ensureNotification({
      employee_id: empStaff1, type: 'transfer_rejected',
      title: '转出申请被驳回',
      body: '客户 赵敏 转出申请未通过',
      payload: { customer_id: c4, transfer_status: 'rejected' },
      is_read: false,
      created_at: fmtDateTime(daysFromNow(-2))
    })
    await ensureNotification({
      employee_id: empStaff2, type: 'transfer_pending',
      title: '有一笔转入申请待你查看',
      body: '测试员工 申请将 王小宝爸爸 转给你',
      payload: { customer_id: c1, transfer_status: 'pending' },
      is_read: false,
      created_at: fmtDateTime(daysFromNow(-1))
    })
    await ensureNotification({
      employee_id: empManager, type: 'transfer_pending',
      title: '部门内有 1 条转移申请待审批',
      body: '测试员工 → 王晓静（客户：王小宝爸爸）',
      payload: { customer_id: c1, transfer_status: 'pending' },
      is_read: false,
      created_at: fmtDateTime(daysFromNow(-1))
    })
    logger.info('通知: 5 条')

    logger.info('')
    logger.info('===== 员工 CRM 测试数据 seed 完成 =====')
    logger.info('【员工 App】测试员工(staff): 13700137000 / Staff@123456')
    logger.info('【员工 App】张经理(manager):  13700137100 / Manager@123456')
    logger.info('【员工 App】王晓静(staff):    13700137101 / Staff@123456')
    logger.info('【员工 App】李海洋(staff):    13700137102 / Staff@123456')
    logger.info('====================================')
    process.exit(0)
  } catch (error) {
    logger.error(`员工 CRM 测试数据 seed 失败: ${error.message}`)
    logger.error(error.stack)
    process.exit(1)
  }
}

main()
