const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, safeJsonParse, safeJsonStringify } = require('../utils/helpers')
const { parseClientDatetime, nowUtcString } = require('../utils/datetime')
const customerService = require('./customerService')

/**
 * 校验 actor 合法性。
 * @param {{id:number, role:string, department_id?:number}} actor
 */
function assertActor(actor) {
  if (!actor || !actor.id) {
    throw createAppError('当前会话异常，请重新登录', StatusCodes.UNAUTHORIZED)
  }
}

/**
 * 安全输出跟进对象。
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function safeFollowUp(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    customer_id: Number(row.customer_id),
    employee_id: Number(row.employee_id),
    employee_name: row.employee_name || '',
    customer_name: row.customer_name || '',
    follow_at: row.follow_at,
    type: row.type,
    result: row.result,
    content: row.content || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : safeJsonParse(row.attachments, []),
    next_follow_up_at: row.next_follow_up_at || null,
    client_uuid: row.client_uuid || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 内部：归属校验（先把 customer 查出来交给 customerService.assertOwnership）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} customerId
 * @returns {Promise<Record<string, any>>}
 */
async function assertCustomerScope(actor, customerId) {
  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  await customerService.assertOwnership(actor, customer)
  return customer
}

/**
 * 列表。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} params
 */
async function listFollowUps(actor, params = {}) {
  assertActor(actor)
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)

  const conditions = []
  const values = []

  // 强制归属：JOIN customers 后按 actor 范围限制
  if (actor.role === 'manager') {
    conditions.push('c.assigned_employee_id IN (SELECT id FROM employees WHERE department_id = ?)')
    values.push(actor.department_id)
  } else {
    conditions.push('c.assigned_employee_id = ?')
    values.push(actor.id)
  }

  if (params.customer_id) {
    conditions.push('f.customer_id = ?')
    values.push(Number(params.customer_id))
  }
  if (params.type) {
    conditions.push('f.type = ?')
    values.push(params.type)
  }
  if (params.result) {
    conditions.push('f.result = ?')
    values.push(params.result)
  }
  // 兼容前端 start_date/end_date 与旧 from/to
  const fromVal = params.from || params.start_date
  const toVal = params.to || params.end_date
  if (fromVal) {
    conditions.push('f.follow_at >= ?')
    values.push(fromVal)
  }
  if (toVal) {
    // end_date 通常是 YYYY-MM-DD，需要包含整天 → 拼到 23:59:59
    const v = String(toVal)
    conditions.push('f.follow_at <= ?')
    values.push(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v} 23:59:59` : v)
  }
  // 关键词搜索：客户姓名 / 客户手机号 / 跟进内容（任意命中）
  if (params.q) {
    const kw = String(params.q).trim()
    if (kw) {
      conditions.push('(c.display_name LIKE ? OR c.phone LIKE ? OR f.content LIKE ?)')
      values.push(`%${kw}%`, `%${kw}%`, `%${kw}%`)
    }
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM follow_ups f INNER JOIN customers c ON c.id = f.customer_id ${whereClause}`,
    values
  )
  const rows = await query(
    `SELECT f.*, e.display_name AS employee_name, c.display_name AS customer_name
     FROM follow_ups f
     INNER JOIN customers c ON c.id = f.customer_id
     LEFT JOIN employees e ON e.id = f.employee_id
     ${whereClause}
     ORDER BY f.follow_at DESC, f.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeFollowUp),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 详情。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 */
async function getFollowUpDetail(actor, id) {
  assertActor(actor)
  const row = await queryOne(
    `SELECT f.*, e.display_name AS employee_name, c.display_name AS customer_name
     FROM follow_ups f
     INNER JOIN customers c ON c.id = f.customer_id
     LEFT JOIN employees e ON e.id = f.employee_id
     WHERE f.id = ? LIMIT 1`,
    [id]
  )
  if (!row) throw createAppError('跟进不存在', StatusCodes.NOT_FOUND)
  await assertCustomerScope(actor, row.customer_id)
  return safeFollowUp(row)
}

/**
 * 创建跟进（含 client_uuid 幂等 + 同步 customer 的 last_follow_up_at / next_follow_up_at）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} payload
 * @returns {Promise<{follow_up:Record<string,any>, status:'ok'|'duplicate', server_id:number}>}
 */
async function createFollowUp(actor, payload = {}) {
  assertActor(actor)

  // client_uuid 幂等（必须先于校验和归属检查，避免重发因前端字段调整命中 validation_failed）
  const clientUuid = payload.client_uuid ? String(payload.client_uuid) : null
  if (clientUuid) {
    const existing = await queryOne('SELECT id FROM follow_ups WHERE client_uuid = ? LIMIT 1', [clientUuid])
    if (existing) {
      const fu = await getFollowUpDetail(actor, existing.id).catch(() => null)
      return { follow_up: fu, status: 'duplicate', server_id: Number(existing.id) }
    }
  }

  const customerId = Number(payload.customer_id)
  if (!customerId) throw createAppError('customer_id 必填', StatusCodes.UNPROCESSABLE_ENTITY)
  if (!payload.type) throw createAppError('跟进类型不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (!payload.result) throw createAppError('跟进结果不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  if (!String(payload.content || '').trim()) {
    throw createAppError('跟进内容不能为空', StatusCodes.UNPROCESSABLE_ENTITY)
  }

  await assertCustomerScope(actor, customerId)

  const followAt = parseClientDatetime(payload.follow_at) || nowUtcString()
  const nextFollowUpAt = parseClientDatetime(payload.next_follow_up_at)
  const attachmentsJson = safeJsonStringify(Array.isArray(payload.attachments) ? payload.attachments : [])

  let insertId = null
  try {
    const result = await execute(
      `INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        actor.id,
        followAt,
        payload.type,
        payload.result,
        String(payload.content || ''),
        attachmentsJson,
        nextFollowUpAt,
        clientUuid
      ]
    )
    insertId = result.insertId
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY' && clientUuid) {
      const existing = await queryOne('SELECT id FROM follow_ups WHERE client_uuid = ? LIMIT 1', [clientUuid])
      if (existing) {
        const fu = await getFollowUpDetail(actor, existing.id).catch(() => null)
        return { follow_up: fu, status: 'duplicate', server_id: Number(existing.id) }
      }
    }
    throw err
  }

  // 同步 customer 的 last_follow_up_at / next_follow_up_at
  const updateCols = ['last_follow_up_at = ?']
  const updateVals = [followAt]
  if (payload.next_follow_up_at !== undefined) {
    updateCols.push('next_follow_up_at = ?')
    updateVals.push(nextFollowUpAt)
  }
  updateVals.push(customerId)
  await execute(
    `UPDATE customers SET ${updateCols.join(', ')}, updated_at = NOW() WHERE id = ?`,
    updateVals
  )

  const fu = await getFollowUpDetail(actor, insertId)
  return { follow_up: fu, status: 'ok', server_id: insertId }
}

/**
 * 更新跟进（仅 employee_id === actor.id 才能改；manager 也不能改别人的）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 * @param {Record<string, any>} patch
 */
async function updateFollowUp(actor, id, patch = {}) {
  assertActor(actor)
  const row = await queryOne('SELECT * FROM follow_ups WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('跟进不存在', StatusCodes.NOT_FOUND)
  if (Number(row.employee_id) !== Number(actor.id)) {
    throw createAppError('仅可编辑自己创建的跟进', StatusCodes.FORBIDDEN)
  }

  const updates = []
  const values = []

  if (patch.follow_at !== undefined) {
    updates.push('follow_at = ?')
    values.push(parseClientDatetime(patch.follow_at))
  }
  if (patch.type !== undefined) {
    updates.push('type = ?')
    values.push(patch.type)
  }
  if (patch.result !== undefined) {
    updates.push('result = ?')
    values.push(patch.result)
  }
  if (patch.content !== undefined) {
    updates.push('content = ?')
    values.push(String(patch.content || ''))
  }
  if (patch.attachments !== undefined) {
    updates.push('attachments = ?')
    values.push(safeJsonStringify(Array.isArray(patch.attachments) ? patch.attachments : []))
  }
  if (patch.next_follow_up_at !== undefined) {
    updates.push('next_follow_up_at = ?')
    values.push(parseClientDatetime(patch.next_follow_up_at))
  }

  if (updates.length === 0) return getFollowUpDetail(actor, id)
  values.push(id)
  await execute(`UPDATE follow_ups SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values)

  return getFollowUpDetail(actor, id)
}

/**
 * 删跟进（仅自己创建可删）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 */
async function deleteFollowUp(actor, id) {
  assertActor(actor)
  const row = await queryOne('SELECT * FROM follow_ups WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('跟进不存在', StatusCodes.NOT_FOUND)
  if (Number(row.employee_id) !== Number(actor.id)) {
    throw createAppError('仅可删除自己创建的跟进', StatusCodes.FORBIDDEN)
  }
  await execute('DELETE FROM follow_ups WHERE id = ?', [id])
  return { success: true }
}

/**
 * 分享一条跟进给同部门同事（仅内部，不外发客户数据）。
 *   - 必须是自己创建的跟进
 *   - target 必须存在 / 启用 / 与 actor 同部门
 *   - 写一条 type='follow_up_shared' 通知给 target_employee_id
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} followUpId
 * @param {number|string} targetEmployeeId
 * @returns {Promise<{success:boolean, target_employee_id:number}>}
 */
async function shareFollowUp(actor, followUpId, targetEmployeeId) {
  assertActor(actor)
  const targetId = Number(targetEmployeeId)
  if (!targetId) throw createAppError('target_employee_id 必填', StatusCodes.BAD_REQUEST)
  if (Number(targetId) === Number(actor.id)) {
    throw createAppError('不能分享给自己', StatusCodes.BAD_REQUEST)
  }

  const fu = await queryOne(
    `SELECT f.*, c.display_name AS customer_name, e.display_name AS author_name
     FROM follow_ups f
     INNER JOIN customers c ON c.id = f.customer_id
     LEFT JOIN employees e ON e.id = f.employee_id
     WHERE f.id = ? LIMIT 1`,
    [followUpId]
  )
  if (!fu) throw createAppError('跟进不存在', StatusCodes.NOT_FOUND)
  if (Number(fu.employee_id) !== Number(actor.id)) {
    throw createAppError('仅可分享自己创建的跟进', StatusCodes.FORBIDDEN)
  }

  const target = await queryOne(
    'SELECT id, display_name, department_id, active FROM employees WHERE id = ? LIMIT 1',
    [targetId]
  )
  if (!target || !target.active) {
    throw createAppError('目标员工不存在或已停用', StatusCodes.NOT_FOUND)
  }
  if (Number(target.department_id) !== Number(actor.department_id)) {
    throw createAppError('仅可分享给同部门同事', StatusCodes.FORBIDDEN)
  }

  // 内联 require 避免循环依赖
  const { pushNotification } = require('./notificationService')
  const authorName = String(fu.author_name || '同事').trim() || '同事'
  const customerName = String(fu.customer_name || '客户').trim() || '客户'
  const contentSnippet = String(fu.content || '').replace(/\s+/g, ' ').slice(0, 60)

  await pushNotification({
    employee_id: targetId,
    type: 'follow_up_shared',
    title: `${authorName} 分享了一条跟进日志给您`,
    body: `客户「${customerName}」：${contentSnippet || '(无文字内容)'}`,
    payload: {
      follow_up_id: Number(fu.id),
      customer_id: Number(fu.customer_id),
      shared_by_employee_id: Number(actor.id)
    }
  })

  return { success: true, target_employee_id: targetId }
}

/**
 * Admin 全局跟进列表（不限部门 / 员工）。
 * @param {Record<string, any>} params
 * @returns {Promise<{list:any[], total:number, page:number, page_size:number}>}
 */
async function listFollowUpsForAdmin(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    const kw = String(params.q).trim()
    if (kw) {
      conditions.push('(c.display_name LIKE ? OR c.phone LIKE ? OR f.content LIKE ?)')
      values.push(`%${kw}%`, `%${kw}%`, `%${kw}%`)
    }
  }
  if (params.employee_id) {
    conditions.push('f.employee_id = ?')
    values.push(Number(params.employee_id))
  }
  if (params.department_id) {
    conditions.push('e.department_id = ?')
    values.push(Number(params.department_id))
  }
  if (params.customer_id) {
    conditions.push('f.customer_id = ?')
    values.push(Number(params.customer_id))
  }
  if (params.type) {
    conditions.push('f.type = ?')
    values.push(params.type)
  }
  if (params.result) {
    conditions.push('f.result = ?')
    values.push(params.result)
  }
  const fromVal = params.from || params.start_date
  const toVal = params.to || params.end_date
  if (fromVal) {
    conditions.push('f.follow_at >= ?')
    values.push(fromVal)
  }
  if (toVal) {
    const v = String(toVal)
    conditions.push('f.follow_at <= ?')
    values.push(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v} 23:59:59` : v)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total
     FROM follow_ups f
     INNER JOIN customers c ON c.id = f.customer_id
     LEFT JOIN employees e ON e.id = f.employee_id
     ${whereClause}`,
    values
  )
  const rows = await query(
    `SELECT f.*, e.display_name AS employee_name, e.phone AS employee_phone,
            d.name AS department_name,
            c.display_name AS customer_name, c.phone AS customer_phone
     FROM follow_ups f
     INNER JOIN customers c ON c.id = f.customer_id
     LEFT JOIN employees e ON e.id = f.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     ${whereClause}
     ORDER BY f.follow_at DESC, f.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map((r) => ({
      ...safeFollowUp(r),
      department_name: r.department_name || '',
      employee_phone: r.employee_phone || '',
      customer_phone: r.customer_phone || ''
    })),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

module.exports = {
  listFollowUps,
  getFollowUpDetail,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  shareFollowUp,
  safeFollowUp,
  listFollowUpsForAdmin
}
