const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, safeJsonParse, safeJsonStringify } = require('../utils/helpers')
const { parseClientDatetime } = require('../utils/datetime')

/**
 * 当前员工角色枚举校验（service 层兜底，不依赖中间件）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @returns {void}
 */
function assertActor(actor) {
  if (!actor || !actor.id) {
    throw createAppError('当前会话异常，请重新登录', StatusCodes.UNAUTHORIZED)
  }
}

/**
 * 安全输出客户对象（tags 反序列化）。
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function safeCustomer(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    customer_no: row.customer_no || '',
    user_id: row.user_id != null ? Number(row.user_id) : null,
    display_name: row.display_name || '',
    phone: row.phone || '',
    gender: row.gender || 'unknown',
    age: row.age != null ? Number(row.age) : null,
    school: row.school || '',
    class_name: row.class_name || '',
    source: row.source || 'employee',
    status: row.status || 'potential',
    level: row.level || 'C',
    tags: Array.isArray(row.tags) ? row.tags : safeJsonParse(row.tags, []),
    remark: row.remark || '',
    assigned_employee_id: row.assigned_employee_id != null ? Number(row.assigned_employee_id) : null,
    assigned_employee_name: row.assigned_employee_name || '',
    next_follow_up_at: row.next_follow_up_at || null,
    next_follow_up_text: row.next_follow_up_text || '',
    last_follow_up_at: row.last_follow_up_at || null,
    active: Boolean(row.active),
    client_uuid: row.client_uuid || '',
    created_by: row.created_by != null ? Number(row.created_by) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 生成候选客户编号 C + YYYYMMDD + 4 位随机序号。
 * @returns {string}
 */
function generateCustomerNo() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `C${ymd}${seq}`
}

/**
 * 归属校验：staff 仅看自己；manager 看本部门所有员工的客户。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} customer 客户行（必须含 assigned_employee_id）
 * @returns {Promise<void>}
 */
async function assertOwnership(actor, customer) {
  if (!customer) {
    throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  }
  if (actor.role === 'manager') {
    if (customer.assigned_employee_id == null) {
      // manager 也只能看本部门员工名下，未分配的不算
      throw createAppError('客户不归属当前员工', StatusCodes.FORBIDDEN)
    }
    const emp = await queryOne(
      'SELECT department_id FROM employees WHERE id = ? LIMIT 1',
      [customer.assigned_employee_id]
    )
    if (!emp || Number(emp.department_id) !== Number(actor.department_id)) {
      throw createAppError('客户不归属当前员工', StatusCodes.FORBIDDEN)
    }
    return
  }
  if (Number(customer.assigned_employee_id) !== Number(actor.id)) {
    throw createAppError('客户不归属当前员工', StatusCodes.FORBIDDEN)
  }
}

/**
 * 内部：构建归属过滤 WHERE 片段。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @returns {{sql:string, values:Array<any>}}
 */
function buildScopeWhere(actor) {
  if (actor.role === 'manager') {
    return {
      sql: `c.assigned_employee_id IN (SELECT id FROM employees WHERE department_id = ?)`,
      values: [actor.department_id]
    }
  }
  return { sql: 'c.assigned_employee_id = ?', values: [actor.id] }
}

/**
 * 通过手机号关联 users（软关联，不加 FK）。
 * @param {string} phone
 * @returns {Promise<void>}
 */
async function linkUserByPhone(phone) {
  if (!phone) return
  const user = await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone])
  if (!user) return
  await execute('UPDATE customers SET user_id = ? WHERE phone = ? AND (user_id IS NULL OR user_id <> ?)', [
    user.id,
    phone,
    user.id
  ])
}

/**
 * 列出客户。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} params
 * @returns {Promise<{list:any[], total:number, page:number, page_size:number}>}
 */
async function listCustomers(actor, params = {}) {
  assertActor(actor)
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const scope = buildScopeWhere(actor)
  const conditions = [scope.sql, 'c.active = 1']
  const values = [...scope.values]

  if (params.q) {
    conditions.push('(c.display_name LIKE ? OR c.phone LIKE ? OR c.customer_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.status) {
    conditions.push('c.status = ?')
    values.push(params.status)
  }
  if (params.level) {
    conditions.push('c.level = ?')
    values.push(params.level)
  }
  if (params.assigned_employee_id !== undefined && params.assigned_employee_id !== '') {
    conditions.push('c.assigned_employee_id = ?')
    values.push(Number(params.assigned_employee_id))
  }
  if (params.tags) {
    const tagList = Array.isArray(params.tags) ? params.tags : String(params.tags).split(',').filter(Boolean)
    for (const tag of tagList) {
      conditions.push('JSON_CONTAINS(c.tags, ?, "$")')
      values.push(JSON.stringify(String(tag)))
    }
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`

  let orderBy = 'c.updated_at DESC'
  if (params.sort === 'next_follow_up_at') orderBy = 'c.next_follow_up_at ASC'
  else if (params.sort === 'last_follow_up_at') orderBy = 'c.last_follow_up_at DESC'
  else if (params.sort === 'created_at') orderBy = 'c.created_at DESC'

  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM customers c ${whereClause}`, values)
  const rows = await query(
    `SELECT c.*, e.display_name AS assigned_employee_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeCustomer),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 客户详情（带归属校验）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 * @returns {Promise<Record<string, any>>}
 */
async function getCustomerDetail(actor, id) {
  assertActor(actor)
  const row = await queryOne(
    `SELECT c.*, e.display_name AS assigned_employee_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     WHERE c.id = ? LIMIT 1`,
    [id]
  )
  if (!row) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!row.active) throw createAppError('客户已删除', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, row)
  return safeCustomer(row)
}

/**
 * 创建客户（含 customer_no 重试 + client_uuid 幂等）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} payload
 * @returns {Promise<{customer:Record<string,any>, status:'ok'|'duplicate'}>}
 */
async function createCustomer(actor, payload = {}) {
  assertActor(actor)

  // client_uuid 幂等（必须先于校验，避免同 uuid 重发因前端字段调整命中 validation_failed）
  const clientUuid = payload.client_uuid ? String(payload.client_uuid) : null
  if (clientUuid) {
    const existing = await queryOne('SELECT id FROM customers WHERE client_uuid = ? LIMIT 1', [clientUuid])
    if (existing) {
      const customer = await getCustomerDetail(actor, existing.id).catch(() => null)
      return { customer, status: 'duplicate', server_id: Number(existing.id) }
    }
  }

  const displayName = String(payload.display_name || '').trim()
  const phone = String(payload.phone || '').trim()
  if (!displayName) throw createAppError('客户姓名不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (!phone) throw createAppError('手机号不能为空', StatusCodes.UNPROCESSABLE_ENTITY)

  // 创建客户始终归属当前操作员；要转给别人必须走 transfer 流程
  const assignedEmployeeId = Number(actor.id)

  const tagsJson = safeJsonStringify(Array.isArray(payload.tags) ? payload.tags : [])
  const status = payload.status || 'potential'
  const level = payload.level || 'C'
  const gender = payload.gender || 'unknown'
  const source = payload.source || 'employee'

  // 重试 customer_no 最多 5 次
  let lastErr = null
  let insertId = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const customerNo = generateCustomerNo()
    try {
      const result = await execute(
        `INSERT INTO customers (
          customer_no, display_name, phone, gender, age,
          school, class_name, source, status, level,
          tags, remark, assigned_employee_id, next_follow_up_at, next_follow_up_text,
          active, client_uuid, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          customerNo,
          displayName,
          phone,
          gender,
          payload.age != null ? Number(payload.age) : null,
          String(payload.school || ''),
          String(payload.class_name || ''),
          source,
          status,
          level,
          tagsJson,
          payload.remark != null ? String(payload.remark) : null,
          assignedEmployeeId,
          parseClientDatetime(payload.next_follow_up_at),
          String(payload.next_follow_up_text || ''),
          clientUuid,
          actor.id
        ]
      )
      insertId = result.insertId
      break
    } catch (err) {
      lastErr = err
      if (err && err.code === 'ER_DUP_ENTRY') {
        // 判断是 customer_no 重复还是 client_uuid 重复
        const msg = String(err.sqlMessage || err.message || '')
        if (msg.includes('uk_customers_uuid') && clientUuid) {
          const existing = await queryOne('SELECT id FROM customers WHERE client_uuid = ? LIMIT 1', [clientUuid])
          if (existing) {
            const customer = await getCustomerDetail(actor, existing.id).catch(() => null)
            return { customer, status: 'duplicate', server_id: Number(existing.id) }
          }
        }
        // customer_no 冲突：继续重试
        continue
      }
      throw err
    }
  }
  if (!insertId) {
    throw lastErr || createAppError('生成客户编号失败，请重试', StatusCodes.INTERNAL_SERVER_ERROR)
  }

  // 软关联 user_id
  await linkUserByPhone(phone)

  const customer = await getCustomerDetail(actor, insertId)
  return { customer, status: 'ok', server_id: insertId }
}

/**
 * 更新客户（含归属校验 + 乐观锁）。
 * 当 patch.base_version 与服务端 updated_at 不一致时不抛错，返回 status='conflict' 与 current_payload。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 * @param {Record<string, any>} patch
 * @returns {Promise<{status:'ok'|'conflict', customer?:Record<string,any>, current_payload?:Record<string,any>, current_version?:any}>}
 */
async function updateCustomer(actor, id, patch = {}) {
  assertActor(actor)
  const current = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!current.active) throw createAppError('客户已删除', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, current)

  // 乐观锁
  if (patch.base_version) {
    const baseStr = String(patch.base_version)
    const curStr = current.updated_at instanceof Date ? current.updated_at.toISOString() : String(current.updated_at)
    // 兼容：截断毫秒、去掉 T/Z 等格式差异
    const norm = (s) => String(s || '').replace('T', ' ').replace('Z', '').slice(0, 19)
    if (norm(baseStr) !== norm(curStr)) {
      const detail = await getCustomerDetail(actor, id).catch(() => null)
      return {
        status: 'conflict',
        current_payload: detail,
        current_version: current.updated_at
      }
    }
  }

  const updates = []
  const values = []

  // ⚠️ 安全：assigned_employee_id 不能在此通过 PUT 直接改——必须走 customer_transfers 审批流程。
  const fieldMap = {
    display_name: (v) => String(v || ''),
    phone: (v) => String(v || ''),
    gender: (v) => v || 'unknown',
    age: (v) => (v == null ? null : Number(v)),
    school: (v) => String(v || ''),
    class_name: (v) => String(v || ''),
    source: (v) => v || 'employee',
    status: (v) => v || 'potential',
    level: (v) => v || 'C',
    remark: (v) => (v == null ? null : String(v)),
    next_follow_up_at: (v) => parseClientDatetime(v),
    next_follow_up_text: (v) => String(v || '')
  }
  for (const key of Object.keys(fieldMap)) {
    if (patch[key] !== undefined) {
      updates.push(`${key} = ?`)
      values.push(fieldMap[key](patch[key]))
    }
  }
  if (patch.tags !== undefined) {
    updates.push('tags = ?')
    values.push(safeJsonStringify(Array.isArray(patch.tags) ? patch.tags : []))
  }

  if (updates.length === 0) {
    return { status: 'ok', customer: await getCustomerDetail(actor, id) }
  }

  values.push(id)
  await execute(`UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)

  if (patch.phone !== undefined) {
    await linkUserByPhone(String(patch.phone))
  }

  return { status: 'ok', customer: await getCustomerDetail(actor, id) }
}

/**
 * 软删客户（仅置 active=0）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 * @returns {Promise<{success:true}>}
 */
async function softDeleteCustomer(actor, id) {
  assertActor(actor)
  const current = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!current.active) return { success: true }
  await assertOwnership(actor, current)
  await execute('UPDATE customers SET active = 0, updated_at = NOW() WHERE id = ?', [id])
  return { success: true }
}

/**
 * 全局搜索（限自己名下 / 本部门）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {string} q
 * @returns {Promise<Array<Record<string,any>>>}
 */
async function searchCustomers(actor, q) {
  assertActor(actor)
  const keyword = String(q || '').trim()
  if (!keyword) return []
  const scope = buildScopeWhere(actor)
  const kw = `%${keyword}%`
  const rows = await query(
    `SELECT c.*, e.display_name AS assigned_employee_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     WHERE ${scope.sql} AND c.active = 1
       AND (
         c.display_name LIKE ?
         OR c.phone LIKE ?
         OR c.customer_no LIKE ?
         OR c.school LIKE ?
         OR c.class_name LIKE ?
         OR c.remark LIKE ?
       )
     ORDER BY c.updated_at DESC LIMIT 50`,
    [...scope.values, kw, kw, kw, kw, kw, kw]
  )
  return rows.map(safeCustomer)
}

/**
 * 设置客户跟进提醒。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 * @param {{next_follow_up_at?:string|null, next_follow_up_text?:string}} body
 * @returns {Promise<Record<string, any>>}
 */
async function setCustomerReminder(actor, id, body = {}) {
  assertActor(actor)
  const current = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!current.active) throw createAppError('客户已删除', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, current)

  await execute(
    `UPDATE customers SET next_follow_up_at = ?, next_follow_up_text = ?, updated_at = NOW() WHERE id = ?`,
    [
      parseClientDatetime(body.next_follow_up_at),
      String(body.next_follow_up_text || ''),
      id
    ]
  )
  return getCustomerDetail(actor, id)
}

/**
 * 列附件（含归属校验）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} customerId
 * @returns {Promise<Array<Record<string,any>>>}
 */
async function listAttachments(actor, customerId) {
  assertActor(actor)
  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, customer)

  const rows = await query(
    `SELECT a.*, u.url AS upload_url, u.file_name AS upload_name
     FROM customer_attachments a
     LEFT JOIN uploads u ON u.id = a.upload_id
     WHERE a.customer_id = ?
     ORDER BY a.created_at DESC`,
    [customerId]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    customer_id: Number(r.customer_id),
    upload_id: Number(r.upload_id),
    file_type: r.file_type || 'image',
    upload_url: r.upload_url || '',
    upload_name: r.upload_name || '',
    uploaded_by: r.uploaded_by != null ? Number(r.uploaded_by) : null,
    created_at: r.created_at
  }))
}

/**
 * 加附件（校验 uploads.id 存在）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} customerId
 * @param {{upload_id:number, file_type?:string}} body
 * @returns {Promise<Record<string, any>>}
 */
async function addAttachment(actor, customerId, body = {}) {
  assertActor(actor)
  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, customer)

  const uploadId = Number(body.upload_id)
  if (!uploadId) throw createAppError('upload_id 必填', StatusCodes.BAD_REQUEST)
  const upload = await queryOne('SELECT id FROM uploads WHERE id = ? LIMIT 1', [uploadId])
  if (!upload) throw createAppError('上传记录不存在', StatusCodes.NOT_FOUND)

  const fileType = body.file_type === 'document' ? 'document' : 'image'
  const result = await execute(
    `INSERT INTO customer_attachments (customer_id, upload_id, file_type, uploaded_by) VALUES (?, ?, ?, ?)`,
    [customerId, uploadId, fileType, actor.id]
  )
  const list = await listAttachments(actor, customerId)
  return list.find((it) => it.id === result.insertId) || { id: result.insertId, customer_id: Number(customerId), upload_id: uploadId, file_type: fileType }
}

/**
 * 删附件。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} customerId
 * @param {number|string} attachmentId
 * @returns {Promise<{success:true}>}
 */
async function deleteAttachment(actor, customerId, attachmentId) {
  assertActor(actor)
  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  await assertOwnership(actor, customer)

  const att = await queryOne(
    'SELECT * FROM customer_attachments WHERE id = ? AND customer_id = ? LIMIT 1',
    [attachmentId, customerId]
  )
  if (!att) throw createAppError('附件不存在', StatusCodes.NOT_FOUND)
  await execute('DELETE FROM customer_attachments WHERE id = ?', [attachmentId])
  return { success: true }
}

/**
 * 员工视角：根据客户 phone 找其家长名下孩子档案的「基础字段」。
 *
 * 权限模型：
 *   - 客户归属（assigned_employee_id 是 actor 或 actor 的部门）→ 即可看孩子的基础信息
 *   - 专业医疗字段（视力/屈光/中医证型/诊断方案）仍由 child/detail 接口按部门字段授权控制
 *
 * 关联：customers.phone === children.parent_phone
 *
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} customerId
 * @returns {Promise<Array<Record<string,any>>>}
 */
async function listLinkedChildrenForEmployee(actor, customerId) {
  assertActor(actor)
  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) return []
  await assertOwnership(actor, customer)  // 客户归属校验（staff 本人 / manager 本部门）
  const phone = String(customer.phone || '').trim()
  if (!phone) return []
  const rows = await query(
    `SELECT c.id, c.name, c.gender, c.dob, c.age,
            c.school, c.grade_name, c.class_name,
            c.parent_phone, c.height, c.weight, c.avatar_url,
            c.symptoms, c.symptom_other, c.additional_note,
            c.created_at, c.updated_at
     FROM children c
     WHERE c.active = 1 AND c.parent_phone = ?
     ORDER BY c.id DESC LIMIT 20`,
    [phone]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    _id: String(r.id),
    name: r.name,
    gender: r.gender,
    dob: r.dob,
    age: r.age != null ? Number(r.age) : null,
    school: r.school || '',
    grade_name: r.grade_name || '',
    class_name: r.class_name || '',
    parent_phone: r.parent_phone || '',
    height: r.height != null ? Number(r.height) : null,
    weight: r.weight != null ? Number(r.weight) : null,
    avatar_url: r.avatar_url || '',
    symptoms: Array.isArray(r.symptoms) ? r.symptoms : (r.symptoms ? safeJsonParse(r.symptoms, []) : []),
    symptom_other: r.symptom_other || '',
    additional_note: r.additional_note || '',
    created_at: r.created_at,
    updated_at: r.updated_at
  }))
}

/**
 * Admin 视角列出客户（不走员工归属过滤）。
 * @param {Record<string, any>} params
 * @returns {Promise<{list:any[], total:number, page:number, page_size:number}>}
 */
async function listCustomersForAdmin(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = ['c.active = 1']
  const values = []

  if (params.q) {
    conditions.push('(c.display_name LIKE ? OR c.phone LIKE ? OR c.customer_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.status) { conditions.push('c.status = ?'); values.push(params.status) }
  if (params.level) { conditions.push('c.level = ?'); values.push(params.level) }
  if (params.assigned_employee_id !== undefined && params.assigned_employee_id !== '') {
    conditions.push('c.assigned_employee_id = ?')
    values.push(Number(params.assigned_employee_id))
  }
  if (params.department_id !== undefined && params.department_id !== '') {
    conditions.push('c.assigned_employee_id IN (SELECT id FROM employees WHERE department_id = ?)')
    values.push(Number(params.department_id))
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM customers c ${whereClause}`, values)
  const rows = await query(
    `SELECT c.*, e.display_name AS assigned_employee_name, d.name AS department_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     ${whereClause}
     ORDER BY c.updated_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map((r) => ({ ...safeCustomer(r), department_name: r.department_name || '' })),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * Admin 视角获取客户详情（不校验归属）。
 * @param {number|string} id
 */
async function getCustomerDetailForAdmin(id) {
  const row = await queryOne(
    `SELECT c.*, e.display_name AS assigned_employee_name, d.name AS department_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE c.id = ? LIMIT 1`,
    [id]
  )
  if (!row) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  return { ...safeCustomer(row), department_name: row.department_name || '' }
}

/**
 * Admin 修改客户（不校验员工归属，可改 assigned_employee_id）。
 * 调用方负责推送通知（拿 changed_fields + previous_assigned_employee_id 决定通知谁）。
 * @param {number|string} id
 * @param {Record<string, any>} patch
 * @returns {Promise<{customer:Record<string,any>, previous_assigned_employee_id:number|null, changed_fields:string[]}>}
 */
async function updateCustomerByAdmin(id, patch = {}) {
  const current = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
  if (!current) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!current.active) throw createAppError('客户已删除', StatusCodes.NOT_FOUND)

  const updates = []
  const values = []
  const changed = []

  const fieldMap = {
    display_name: (v) => String(v || ''),
    phone: (v) => String(v || ''),
    gender: (v) => v || 'unknown',
    age: (v) => (v == null ? null : Number(v)),
    school: (v) => String(v || ''),
    class_name: (v) => String(v || ''),
    status: (v) => v || 'potential',
    level: (v) => v || 'C',
    remark: (v) => (v == null ? null : String(v)),
    next_follow_up_at: (v) => parseClientDatetime(v),
    next_follow_up_text: (v) => String(v || ''),
    assigned_employee_id: (v) => (v == null ? null : Number(v))
  }
  for (const key of Object.keys(fieldMap)) {
    if (patch[key] !== undefined) {
      const newVal = fieldMap[key](patch[key])
      const oldVal = current[key]
      const oldNorm = oldVal instanceof Date ? oldVal.toISOString() : oldVal
      if (String(newVal == null ? '' : newVal) !== String(oldNorm == null ? '' : oldNorm)) {
        changed.push(key)
      }
      updates.push(`${key} = ?`)
      values.push(newVal)
    }
  }
  if (patch.tags !== undefined) {
    const tagsJson = safeJsonStringify(Array.isArray(patch.tags) ? patch.tags : [])
    const oldJson = typeof current.tags === 'string' ? current.tags : safeJsonStringify(current.tags || [])
    if (tagsJson !== oldJson) changed.push('tags')
    updates.push('tags = ?')
    values.push(tagsJson)
  }

  if (updates.length === 0) {
    return {
      customer: await getCustomerDetailForAdmin(id),
      previous_assigned_employee_id: current.assigned_employee_id != null ? Number(current.assigned_employee_id) : null,
      changed_fields: []
    }
  }

  values.push(id)
  await execute(`UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)

  if (patch.phone !== undefined) {
    await linkUserByPhone(String(patch.phone))
  }

  return {
    customer: await getCustomerDetailForAdmin(id),
    previous_assigned_employee_id: current.assigned_employee_id != null ? Number(current.assigned_employee_id) : null,
    changed_fields: changed
  }
}

/**
 * Admin 视角拉取导出数据（带过滤，封顶 50000 条）。
 * 返回原始 row（不走 safeCustomer，方便 CSV 直接取字段）。
 * @param {Record<string, any>} params
 * @returns {Promise<Array<Record<string,any>>>}
 */
async function listCustomersForExport(params = {}) {
  const conditions = ['c.active = 1']
  const values = []
  if (params.status) { conditions.push('c.status = ?'); values.push(params.status) }
  if (params.level) { conditions.push('c.level = ?'); values.push(params.level) }
  if (params.assigned_employee_id !== undefined && params.assigned_employee_id !== '') {
    conditions.push('c.assigned_employee_id = ?')
    values.push(Number(params.assigned_employee_id))
  }
  if (params.department_id !== undefined && params.department_id !== '') {
    conditions.push('c.assigned_employee_id IN (SELECT id FROM employees WHERE department_id = ?)')
    values.push(Number(params.department_id))
  }
  if (params.q) {
    conditions.push('(c.display_name LIKE ? OR c.phone LIKE ? OR c.customer_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const rows = await query(
    `SELECT c.*, e.display_name AS assigned_employee_name, d.name AS department_name
     FROM customers c
     LEFT JOIN employees e ON e.id = c.assigned_employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT 50000`,
    values
  )
  return rows
}

module.exports = {
  listCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  searchCustomers,
  setCustomerReminder,
  linkUserByPhone,
  listAttachments,
  addAttachment,
  deleteAttachment,
  safeCustomer,
  generateCustomerNo,
  assertOwnership,
  listCustomersForAdmin,
  getCustomerDetailForAdmin,
  updateCustomerByAdmin,
  listCustomersForExport,
  listLinkedChildrenForEmployee
}
