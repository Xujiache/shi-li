const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, safeJsonParse, safeJsonStringify } = require('../utils/helpers')

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
 * 安全输出消息。
 * @param {Record<string, any>|null} row
 * @returns {Record<string, any>|null}
 */
function safeNotification(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    _id: String(row.id),
    employee_id: Number(row.employee_id),
    type: row.type || '',
    title: row.title || '',
    body: row.body || '',
    payload: row.payload && typeof row.payload === 'object' ? row.payload : safeJsonParse(row.payload, {}),
    is_read: Boolean(row.is_read),
    read_at: row.read_at || null,
    created_at: row.created_at
  }
}

/**
 * 推送一条消息（被其他 service 调用）。
 * @param {{employee_id:number, type:string, title:string, body?:string, payload?:Record<string,any>}} input
 * @returns {Promise<number>} insertId
 */
async function pushNotification(input = {}) {
  const employeeId = Number(input.employee_id)
  if (!employeeId) throw createAppError('employee_id 必填', StatusCodes.BAD_REQUEST)
  if (!input.type) throw createAppError('type 必填', StatusCodes.BAD_REQUEST)
  if (!input.title) throw createAppError('title 必填', StatusCodes.BAD_REQUEST)

  const result = await execute(
    `INSERT INTO notifications (employee_id, type, title, body, payload, is_read) VALUES (?, ?, ?, ?, ?, 0)`,
    [
      employeeId,
      String(input.type).slice(0, 64),
      String(input.title).slice(0, 200),
      String(input.body || '').slice(0, 500),
      safeJsonStringify(input.payload || {})
    ]
  )
  return result.insertId
}

/**
 * 批量推送（同一 payload 推给多个 employee_id）。
 * @param {Array<number>} employeeIds
 * @param {{type:string, title:string, body?:string, payload?:Record<string,any>}} payload
 * @returns {Promise<number>} 实际写入条数
 */
async function pushNotificationToMany(employeeIds, payload = {}) {
  const ids = Array.from(new Set((employeeIds || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)))
  if (ids.length === 0) return 0
  let n = 0
  for (const empId of ids) {
    try {
      await pushNotification({ ...payload, employee_id: empId })
      n += 1
    } catch (err) {
      // 单条失败不阻塞批量
    }
  }
  return n
}

/**
 * 列消息。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Record<string, any>} params
 */
async function listNotifications(actor, params = {}) {
  assertActor(actor)
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = ['employee_id = ?']
  const values = [actor.id]

  if (params.type) {
    conditions.push('type = ?')
    values.push(params.type)
  }
  if (params.is_read !== undefined && params.is_read !== '') {
    const v = params.is_read === '0' || params.is_read === 0 || params.is_read === false ? 0 : 1
    conditions.push('is_read = ?')
    values.push(v)
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM notifications ${whereClause}`, values)
  const rows = await query(
    `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    values
  )

  return {
    list: rows.map(safeNotification),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 未读数。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @returns {Promise<number>}
 */
async function unreadCount(actor) {
  assertActor(actor)
  const row = await queryOne(
    'SELECT COUNT(*) AS c FROM notifications WHERE employee_id = ? AND is_read = 0',
    [actor.id]
  )
  return row ? Number(row.c) : 0
}

/**
 * 标记单条已读。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {number|string} id
 */
async function markRead(actor, id) {
  assertActor(actor)
  const row = await queryOne(
    'SELECT * FROM notifications WHERE id = ? AND employee_id = ? LIMIT 1',
    [id, actor.id]
  )
  if (!row) throw createAppError('消息不存在', StatusCodes.NOT_FOUND)
  if (!row.is_read) {
    await execute(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?',
      [id]
    )
  }
  return { success: true }
}

/**
 * 全部已读。
 * @param {{id:number, role:string, department_id?:number}} actor
 */
async function markAllRead(actor) {
  assertActor(actor)
  await execute(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE employee_id = ? AND is_read = 0',
    [actor.id]
  )
  return { success: true }
}

/**
 * 一键清空已读。
 * @param {{id:number, role:string, department_id?:number}} actor
 */
async function clearReadNotifications(actor) {
  assertActor(actor)
  const result = await execute(
    'DELETE FROM notifications WHERE employee_id = ? AND is_read = 1',
    [actor.id]
  )
  return { success: true, deleted: result.affectedRows || 0 }
}

module.exports = {
  pushNotification,
  pushNotificationToMany,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  clearReadNotifications,
  safeNotification
}
