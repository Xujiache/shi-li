const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination } = require('../utils/helpers')
const customerService = require('./customerService')
const notificationService = require('./notificationService')

/**
 * 校验 actor。
 * @param {{id:number, role:string, department_id?:number}} actor
 */
function assertActor(actor) {
  if (!actor || !actor.id) {
    throw createAppError('当前会话异常，请重新登录', StatusCodes.UNAUTHORIZED)
  }
}

/**
 * 仅 manager 可调用。
 * @param {{id:number, role:string, department_id?:number}} actor
 */
function assertManager(actor) {
  assertActor(actor)
  if (actor.role !== 'manager') {
    throw createAppError('需要部门主管权限', StatusCodes.FORBIDDEN)
  }
}

/**
 * 安全输出。
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function safeTransfer(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    customer_id: Number(row.customer_id),
    customer_name: row.customer_name || '',
    from_employee_id: Number(row.from_employee_id),
    from_employee_name: row.from_employee_name || '',
    to_employee_id: row.to_employee_id != null ? Number(row.to_employee_id) : null,
    to_employee_name: row.to_employee_name || '',
    reason: row.reason || '',
    status: row.status || 'pending',
    approved_by: row.approved_by != null ? Number(row.approved_by) : null,
    approved_at: row.approved_at || null,
    approval_remark: row.approval_remark || '',
    client_uuid: row.client_uuid || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 内部：联表查询单条。
 * @param {number|string} id
 */
async function findTransferById(id) {
  return queryOne(
    `SELECT t.*, c.display_name AS customer_name,
            ef.display_name AS from_employee_name,
            et.display_name AS to_employee_name
     FROM customer_transfers t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN employees ef ON ef.id = t.from_employee_id
     LEFT JOIN employees et ON et.id = t.to_employee_id
     WHERE t.id = ? LIMIT 1`,
    [id]
  )
}

/**
 * 提交转出申请（写 customer_transfers + 通知部门所有 manager）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{customer_id:number, reason:string, client_uuid?:string}} payload
 * @returns {Promise<{transfer:Record<string,any>, status:'ok'|'duplicate', server_id:number}>}
 */
async function submitTransfer(actor, payload = {}) {
  assertActor(actor)

  // client_uuid 幂等（必须先于校验、归属检查、pending 检查，避免重发因前端字段调整命中 validation_failed）
  const clientUuid = payload.client_uuid ? String(payload.client_uuid) : null
  if (clientUuid) {
    const existing = await queryOne('SELECT id FROM customer_transfers WHERE client_uuid = ? LIMIT 1', [clientUuid])
    if (existing) {
      const row = await findTransferById(existing.id)
      return { transfer: safeTransfer(row), status: 'duplicate', server_id: Number(existing.id) }
    }
  }

  const customerId = Number(payload.customer_id)
  if (!customerId) throw createAppError('customer_id 必填', StatusCodes.UNPROCESSABLE_ENTITY)
  const reason = String(payload.reason || '').trim()
  if (!reason) throw createAppError('转出原因不能为空', StatusCodes.UNPROCESSABLE_ENTITY)

  const customer = await queryOne('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
  if (!customer) throw createAppError('客户不存在', StatusCodes.NOT_FOUND)
  if (!customer.active) throw createAppError('客户已删除', StatusCodes.NOT_FOUND)
  await customerService.assertOwnership(actor, customer)

  // staff 仅能转出"自己"的客户；manager 也只能转出自己名下的（不允许越权）
  if (Number(customer.assigned_employee_id) !== Number(actor.id)) {
    throw createAppError('仅能对自己名下的客户提交转出', StatusCodes.FORBIDDEN)
  }

  // 拒绝重复 pending：同一个客户存在 pending 时不可再提
  const pending = await queryOne(
    "SELECT id FROM customer_transfers WHERE customer_id = ? AND status = 'pending' LIMIT 1",
    [customerId]
  )
  if (pending) {
    throw createAppError('该客户已有待审批的转出申请', StatusCodes.CONFLICT)
  }

  let insertId = null
  try {
    const result = await execute(
      `INSERT INTO customer_transfers (customer_id, from_employee_id, reason, status, client_uuid)
       VALUES (?, ?, ?, 'pending', ?)`,
      [customerId, actor.id, reason, clientUuid]
    )
    insertId = result.insertId
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY' && clientUuid) {
      const existing = await queryOne('SELECT id FROM customer_transfers WHERE client_uuid = ? LIMIT 1', [clientUuid])
      if (existing) {
        const row = await findTransferById(existing.id)
        return { transfer: safeTransfer(row), status: 'duplicate', server_id: Number(existing.id) }
      }
    }
    throw err
  }

  // 通知部门 manager
  try {
    const fromEmp = await queryOne('SELECT department_id FROM employees WHERE id = ? LIMIT 1', [actor.id])
    if (fromEmp && fromEmp.department_id != null) {
      const managers = await query(
        `SELECT id FROM employees WHERE department_id = ? AND role = 'manager' AND active = 1`,
        [fromEmp.department_id]
      )
      const managerIds = managers.map((m) => Number(m.id))
      if (managerIds.length > 0) {
        await notificationService.pushNotificationToMany(managerIds, {
          type: 'pending_approval',
          title: '新的客户转出待审批',
          body: `员工提交了客户「${customer.display_name}」的转出申请`,
          payload: {
            transfer_id: insertId,
            customer_id: customerId,
            from_employee_id: actor.id
          }
        })
      }
    }
  } catch (err) {
    // 通知失败不影响主流程
  }

  const row = await findTransferById(insertId)
  return { transfer: safeTransfer(row), status: 'ok', server_id: insertId }
}

/**
 * 我提交的转出列表。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{status?:string, page?:any, page_size?:any}} params
 */
async function listMineTransfers(actor, params = {}) {
  assertActor(actor)
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = ['t.from_employee_id = ?']
  const values = [actor.id]

  if (params.status) {
    conditions.push('t.status = ?')
    values.push(params.status)
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM customer_transfers t ${whereClause}`,
    values
  )
  const rows = await query(
    `SELECT t.*, c.display_name AS customer_name,
            ef.display_name AS from_employee_name,
            et.display_name AS to_employee_name
     FROM customer_transfers t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN employees ef ON ef.id = t.from_employee_id
     LEFT JOIN employees et ON et.id = t.to_employee_id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeTransfer),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 待审批列表（manager 限本部门内员工提交的 pending）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{page?:any, page_size?:any}} params
 */
async function listPendingTransfers(actor, params = {}) {
  assertManager(actor)
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)

  const conditions = [
    "t.status = 'pending'",
    't.from_employee_id IN (SELECT id FROM employees WHERE department_id = ?)'
  ]
  const values = [actor.department_id]

  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM customer_transfers t ${whereClause}`,
    values
  )
  const rows = await query(
    `SELECT t.*, c.display_name AS customer_name,
            ef.display_name AS from_employee_name,
            et.display_name AS to_employee_name
     FROM customer_transfers t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN employees ef ON ef.id = t.from_employee_id
     LEFT JOIN employees et ON et.id = t.to_employee_id
     ${whereClause}
     ORDER BY t.created_at ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeTransfer),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 批准转出（事务：UPDATE transfer + UPDATE customer + 写两条 notifications）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} transferId
 * @param {{to_employee_id:number, approval_remark?:string}} body
 */
async function approveTransfer(actor, transferId, body = {}) {
  assertManager(actor)
  const toEmployeeId = Number(body.to_employee_id)
  if (!toEmployeeId) throw createAppError('to_employee_id 必填', StatusCodes.BAD_REQUEST)

  const transfer = await findTransferById(transferId)
  if (!transfer) throw createAppError('转出申请不存在', StatusCodes.NOT_FOUND)
  if (transfer.status !== 'pending') {
    throw createAppError('该申请已处理', StatusCodes.CONFLICT)
  }

  // 校验提交人在本部门
  const fromEmp = await queryOne('SELECT department_id FROM employees WHERE id = ? LIMIT 1', [transfer.from_employee_id])
  if (!fromEmp || Number(fromEmp.department_id) !== Number(actor.department_id)) {
    throw createAppError('该申请不属于您管辖部门', StatusCodes.FORBIDDEN)
  }
  // 校验目标员工存在且 active
  const toEmp = await queryOne('SELECT id, display_name, active FROM employees WHERE id = ? LIMIT 1', [toEmployeeId])
  if (!toEmp) throw createAppError('目标员工不存在', StatusCodes.BAD_REQUEST)
  if (!toEmp.active) throw createAppError('目标员工已停用', StatusCodes.BAD_REQUEST)

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE customer_transfers SET status='approved', to_employee_id=?, approved_by=?, approved_at=NOW(), approval_remark=?, updated_at=NOW()
       WHERE id = ?`,
      [toEmployeeId, actor.id, String(body.approval_remark || ''), transferId]
    )
    await conn.execute(
      `UPDATE customers SET assigned_employee_id = ?, source = 'transferred', updated_at = NOW() WHERE id = ?`,
      [toEmployeeId, transfer.customer_id]
    )
  })

  // 通知 from / to（事务外，失败不阻塞）
  try {
    await notificationService.pushNotification({
      employee_id: transfer.from_employee_id,
      type: 'customer_transfer_result',
      title: '转出申请已通过',
      body: `客户「${transfer.customer_name || ''}」已转出至 ${toEmp.display_name || ''}`,
      payload: {
        transfer_id: Number(transferId),
        customer_id: transfer.customer_id,
        result: 'approved',
        to_employee_id: toEmployeeId
      }
    })
    await notificationService.pushNotification({
      employee_id: toEmployeeId,
      type: 'customer_transfer_in',
      title: '收到一个新客户',
      body: `客户「${transfer.customer_name || ''}」已转入您名下`,
      payload: {
        transfer_id: Number(transferId),
        customer_id: transfer.customer_id,
        from_employee_id: transfer.from_employee_id
      }
    })
  } catch (err) {
    // 忽略通知失败
  }

  const row = await findTransferById(transferId)
  return safeTransfer(row)
}

/**
 * 驳回转出。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} transferId
 * @param {{approval_remark?:string}} body
 */
async function rejectTransfer(actor, transferId, body = {}) {
  assertManager(actor)
  const transfer = await findTransferById(transferId)
  if (!transfer) throw createAppError('转出申请不存在', StatusCodes.NOT_FOUND)
  if (transfer.status !== 'pending') {
    throw createAppError('该申请已处理', StatusCodes.CONFLICT)
  }
  const fromEmp = await queryOne('SELECT department_id FROM employees WHERE id = ? LIMIT 1', [transfer.from_employee_id])
  if (!fromEmp || Number(fromEmp.department_id) !== Number(actor.department_id)) {
    throw createAppError('该申请不属于您管辖部门', StatusCodes.FORBIDDEN)
  }

  await execute(
    `UPDATE customer_transfers SET status='rejected', approved_by=?, approved_at=NOW(), approval_remark=?, updated_at=NOW()
     WHERE id = ?`,
    [actor.id, String(body.approval_remark || ''), transferId]
  )

  try {
    await notificationService.pushNotification({
      employee_id: transfer.from_employee_id,
      type: 'customer_transfer_result',
      title: '转出申请被驳回',
      body: `客户「${transfer.customer_name || ''}」的转出申请被驳回${body.approval_remark ? '：' + body.approval_remark : ''}`,
      payload: {
        transfer_id: Number(transferId),
        customer_id: transfer.customer_id,
        result: 'rejected'
      }
    })
  } catch (err) {
    // 忽略
  }

  const row = await findTransferById(transferId)
  return safeTransfer(row)
}

module.exports = {
  submitTransfer,
  listMineTransfers,
  listPendingTransfers,
  approveTransfer,
  rejectTransfer,
  safeTransfer
}
