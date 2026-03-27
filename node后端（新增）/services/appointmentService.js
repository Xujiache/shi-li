const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { normalizePagination, toBoolean, formatDateOnly } = require('../utils/helpers')
const { findChildById, ensureChildOwnership, normalizeChild } = require('./childService')

/**
 * 规范化预约项目。
 * @param {Record<string, any>} row 数据库记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeAppointmentItem(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    name: row.name || '',
    image_url: row.image_url || '',
    active: row.active !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化预约排班。
 * @param {Record<string, any>} row 数据库记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeAppointmentSchedule(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    item_id: String(row.item_id),
    item_name: row.item_name || '',
    date: formatDateOnly(row.schedule_date),
    time_slot: row.time_slot || '',
    max_count: Number(row.max_count || 0),
    booked_count: Number(row.booked_count || 0),
    active: row.active !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化预约记录。
 * @param {Record<string, any>} row 数据库记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeAppointmentRecord(row) {
  if (!row) return null
  const dateValue = formatDateOnly(row.appointment_date)

  return {
    _id: String(row.id),
    id: row.id,
    user_id: String(row.user_id),
    child_id: String(row.child_id),
    schedule_id: String(row.schedule_id),
    child_name: row.child_name || '',
    class_name: row.class_name || '',
    item_name: row.item_name || '',
    date: dateValue,
    time_slot: row.time_slot || '',
    phone: row.phone || '',
    status: row.status || 'confirmed',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 获取预约项目列表。
 * @param {{q?: string, active?: unknown, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listAppointmentItems(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('name LIKE ?')
    values.push(`%${params.q}%`)
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('active = ?')
    values.push(toBoolean(params.active, true) ? 1 : 0)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM appointment_items ${whereClause}`, values)
  const rows = await query(
    `
      SELECT *
      FROM appointment_items
      ${whereClause}
      ORDER BY name ASC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: rows.map(normalizeAppointmentItem),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取移动端可预约项目。
 * @returns {Promise<Array<Record<string, any>>>} 项目列表。
 */
async function listActiveAppointmentItems() {
  const rows = await query('SELECT * FROM appointment_items WHERE active = 1 ORDER BY name ASC, id DESC')
  return rows.map(normalizeAppointmentItem)
}

/**
 * 获取预约项目详情。
 * @param {number|string} id 项目 ID。
 * @returns {Promise<Record<string, any>>} 详情对象。
 */
async function getAppointmentItemDetail(id) {
  const row = await queryOne('SELECT * FROM appointment_items WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('预约项目不存在', StatusCodes.NOT_FOUND)
  return normalizeAppointmentItem(row)
}

/**
 * 创建预约项目。
 * @param {{name: string, image_url?: string, active?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建对象。
 */
async function createAppointmentItem(payload) {
  const name = String(payload.name || '').trim()
  if (!name) throw createAppError('项目名称不能为空', StatusCodes.BAD_REQUEST)
  const result = await execute(
    'INSERT INTO appointment_items (name, image_url, active) VALUES (?, ?, ?)',
    [name, String(payload.image_url || '').trim(), payload.active === undefined ? 1 : payload.active ? 1 : 0]
  )
  return getAppointmentItemDetail(result.insertId)
}

/**
 * 更新预约项目。
 * @param {number|string} id 项目 ID。
 * @param {{name?: string, image_url?: string, active?: boolean}} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的对象。
 */
async function updateAppointmentItem(id, patch) {
  const current = await getAppointmentItemDetail(id)
  await execute(
    `
      UPDATE appointment_items
      SET name = ?, image_url = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      patch.name !== undefined ? String(patch.name || '').trim() : current.name,
      patch.image_url !== undefined ? String(patch.image_url || '').trim() : current.image_url,
      patch.active === undefined ? (current.active ? 1 : 0) : patch.active ? 1 : 0,
      id
    ]
  )
  return getAppointmentItemDetail(id)
}

/**
 * 删除预约项目。
 * @param {number|string} id 项目 ID。
 * @returns {Promise<void>}
 */
async function deleteAppointmentItem(id) {
  await execute('DELETE FROM appointment_items WHERE id = ?', [id])
}

/**
 * 获取排班列表。
 * @param {{item_id?: string|number, date?: string, active?: unknown, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listAppointmentSchedules(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.item_id) {
    conditions.push('s.item_id = ?')
    values.push(params.item_id)
  }
  if (params.date) {
    conditions.push('s.schedule_date = ?')
    values.push(params.date)
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('s.active = ?')
    values.push(toBoolean(params.active, true) ? 1 : 0)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(
    `
      SELECT COUNT(*) AS total
      FROM appointment_schedules s
      LEFT JOIN appointment_items i ON i.id = s.item_id
      ${whereClause}
    `,
    values
  )
  const rows = await query(
    `
      SELECT s.*, i.name AS item_name
      FROM appointment_schedules s
      LEFT JOIN appointment_items i ON i.id = s.item_id
      ${whereClause}
      ORDER BY s.schedule_date DESC, s.time_slot ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: rows.map(normalizeAppointmentSchedule),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取排班详情。
 * @param {number|string} id 排班 ID。
 * @returns {Promise<Record<string, any>>} 排班对象。
 */
async function getAppointmentScheduleDetail(id) {
  const row = await queryOne(
    `
      SELECT s.*, i.name AS item_name
      FROM appointment_schedules s
      LEFT JOIN appointment_items i ON i.id = s.item_id
      WHERE s.id = ?
      LIMIT 1
    `,
    [id]
  )
  if (!row) throw createAppError('预约排班不存在', StatusCodes.NOT_FOUND)
  return normalizeAppointmentSchedule(row)
}

/**
 * 创建排班。
 * @param {{item_id: string|number, date: string, time_slot: string, max_count?: number, booked_count?: number, active?: boolean}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建排班。
 */
async function createAppointmentSchedule(payload) {
  if (!payload.item_id || !payload.date || !payload.time_slot) {
    throw createAppError('缺少项目、日期或时段', StatusCodes.BAD_REQUEST)
  }
  const result = await execute(
    `
      INSERT INTO appointment_schedules (item_id, schedule_date, time_slot, max_count, booked_count, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payload.item_id,
      payload.date,
      String(payload.time_slot || '').trim(),
      Number(payload.max_count || 0),
      Number(payload.booked_count || 0),
      payload.active === undefined ? 1 : payload.active ? 1 : 0
    ]
  )
  return getAppointmentScheduleDetail(result.insertId)
}

/**
 * 更新排班。
 * @param {number|string} id 排班 ID。
 * @param {{item_id?: string|number, date?: string, time_slot?: string, max_count?: number, booked_count?: number, active?: boolean}} patch 更新参数。
 * @returns {Promise<Record<string, any>>} 更新后的排班。
 */
async function updateAppointmentSchedule(id, patch) {
  const current = await getAppointmentScheduleDetail(id)
  await execute(
    `
      UPDATE appointment_schedules
      SET item_id = ?, schedule_date = ?, time_slot = ?, max_count = ?, booked_count = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      patch.item_id !== undefined ? patch.item_id : current.item_id,
      patch.date !== undefined ? patch.date : current.date,
      patch.time_slot !== undefined ? String(patch.time_slot || '').trim() : current.time_slot,
      patch.max_count !== undefined ? Number(patch.max_count || 0) : current.max_count,
      patch.booked_count !== undefined ? Number(patch.booked_count || 0) : current.booked_count,
      patch.active === undefined ? (current.active ? 1 : 0) : patch.active ? 1 : 0,
      id
    ]
  )
  return getAppointmentScheduleDetail(id)
}

/**
 * 删除排班。
 * @param {number|string} id 排班 ID。
 * @returns {Promise<void>}
 */
async function deleteAppointmentSchedule(id) {
  await execute('DELETE FROM appointment_schedules WHERE id = ?', [id])
}

/**
 * 获取预约记录详情。
 * @param {number|string} id 预约记录 ID。
 * @returns {Promise<Record<string, any>>} 预约记录。
 */
async function getAppointmentRecordDetail(id) {
  const row = await queryOne('SELECT * FROM appointment_records WHERE id = ? LIMIT 1', [id])
  if (!row) throw createAppError('预约记录不存在', StatusCodes.NOT_FOUND)
  return normalizeAppointmentRecord(row)
}

/**
 * 创建预约记录。
 * @param {{id: number, phone: string}} user 当前用户。
 * @param {{schedule_id: string|number, child_id: string|number}} payload 预约参数。
 * @returns {Promise<Record<string, any>>} 新建预约记录。
 */
async function createAppointmentRecord(user, payload) {
  const child = await findChildById(payload.child_id)
  ensureChildOwnership(child, user.id)

  const schedule = await queryOne('SELECT s.*, i.name AS item_name FROM appointment_schedules s LEFT JOIN appointment_items i ON i.id = s.item_id WHERE s.id = ? LIMIT 1', [
    payload.schedule_id
  ])
  if (!schedule) throw createAppError('预约排班不存在', StatusCodes.NOT_FOUND)
  if (!schedule.active) throw createAppError('该排班已停用', StatusCodes.BAD_REQUEST)

  const existing = await queryOne(
    `
      SELECT id
      FROM appointment_records
      WHERE child_id = ? AND schedule_id = ? AND status <> 'cancelled'
      LIMIT 1
    `,
    [payload.child_id, payload.schedule_id]
  )
  if (existing) throw createAppError('该时段已预约', StatusCodes.CONFLICT)

  const result = await withTransaction(async (connection) => {
    const [scheduleRows] = await connection.execute('SELECT * FROM appointment_schedules WHERE id = ? FOR UPDATE', [
      payload.schedule_id
    ])
    const currentSchedule = Array.isArray(scheduleRows) && scheduleRows.length > 0 ? scheduleRows[0] : null
    if (!currentSchedule) throw createAppError('预约排班不存在', StatusCodes.NOT_FOUND)
    if (Number(currentSchedule.booked_count) >= Number(currentSchedule.max_count)) {
      throw createAppError('该时段已约满', StatusCodes.CONFLICT)
    }

    await connection.execute('UPDATE appointment_schedules SET booked_count = booked_count + 1, updated_at = NOW() WHERE id = ?', [
      payload.schedule_id
    ])

    const [insertResult] = await connection.execute(
      `
        INSERT INTO appointment_records (
          user_id, child_id, schedule_id, child_name, class_name, item_name, appointment_date, time_slot, phone, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `,
      [
        user.id,
        child.id,
        schedule.id,
        child.name || '',
        child.class_name || '',
        schedule.item_name || '',
        schedule.schedule_date,
        schedule.time_slot || '',
        user.phone || child.parent_phone || ''
      ]
    )
    return insertResult.insertId
  })

  return getAppointmentRecordDetail(result)
}

/**
 * 获取当前用户预约记录。
 * @param {number|string} userId 用户 ID。
 * @param {{child_id?: string|number}} params 查询参数。
 * @returns {Promise<Array<Record<string, any>>>} 预约记录列表。
 */
async function listAppointmentRecordsByUser(userId, params = {}) {
  const conditions = ['user_id = ?']
  const values = [userId]

  if (params.child_id) {
    conditions.push('child_id = ?')
    values.push(params.child_id)
  }

  const rows = await query(
    `
      SELECT *
      FROM appointment_records
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `,
    values
  )
  return rows.map(normalizeAppointmentRecord)
}

/**
 * 获取后台预约记录列表。
 * @param {{child_id?: string|number, status?: string, phone?: string, date?: string, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listAppointmentRecordsForAdmin(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.child_id) {
    conditions.push('child_id = ?')
    values.push(params.child_id)
  }
  if (params.status) {
    conditions.push('status = ?')
    values.push(params.status)
  }
  if (params.phone) {
    conditions.push('phone = ?')
    values.push(params.phone)
  }
  if (params.date) {
    conditions.push('appointment_date = ?')
    values.push(params.date)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM appointment_records ${whereClause}`, values)
  const rows = await query(
    `
      SELECT *
      FROM appointment_records
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )
  return {
    list: rows.map(normalizeAppointmentRecord),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 更新预约记录状态并同步排班计数。
 * @param {number|string} id 预约记录 ID。
 * @param {string} status 目标状态。
 * @returns {Promise<Record<string, any>>} 更新后的记录。
 */
async function updateAppointmentRecordStatus(id, status) {
  const current = await getAppointmentRecordDetail(id)
  const nextStatus = String(status || '').trim()
  if (!nextStatus) throw createAppError('缺少预约状态', StatusCodes.BAD_REQUEST)

  if (current.status === nextStatus) {
    return current
  }

  await withTransaction(async (connection) => {
    const [scheduleRows] = await connection.execute('SELECT * FROM appointment_schedules WHERE id = ? FOR UPDATE', [current.schedule_id])
    const schedule = Array.isArray(scheduleRows) && scheduleRows.length > 0 ? scheduleRows[0] : null
    if (!schedule) throw createAppError('预约排班不存在', StatusCodes.NOT_FOUND)

    const leavingConfirmed = current.status !== 'cancelled' && nextStatus === 'cancelled'
    const reactivating = current.status === 'cancelled' && nextStatus !== 'cancelled'

    if (leavingConfirmed && Number(schedule.booked_count) > 0) {
      await connection.execute('UPDATE appointment_schedules SET booked_count = booked_count - 1, updated_at = NOW() WHERE id = ?', [
        current.schedule_id
      ])
    }

    if (reactivating) {
      if (Number(schedule.booked_count) >= Number(schedule.max_count)) {
        throw createAppError('该时段已约满，无法恢复预约', StatusCodes.CONFLICT)
      }
      await connection.execute('UPDATE appointment_schedules SET booked_count = booked_count + 1, updated_at = NOW() WHERE id = ?', [
        current.schedule_id
      ])
    }

    await connection.execute('UPDATE appointment_records SET status = ?, updated_at = NOW() WHERE id = ?', [nextStatus, id])
  })

  return getAppointmentRecordDetail(id)
}

/**
 * 删除预约记录并同步排班计数。
 * @param {number|string} id 预约记录 ID。
 * @returns {Promise<void>}
 */
async function deleteAppointmentRecord(id) {
  const current = await getAppointmentRecordDetail(id)

  await withTransaction(async (connection) => {
    if (current.status !== 'cancelled') {
      await connection.execute(
        'UPDATE appointment_schedules SET booked_count = CASE WHEN booked_count > 0 THEN booked_count - 1 ELSE 0 END, updated_at = NOW() WHERE id = ?',
        [current.schedule_id]
      )
    }

    await connection.execute('DELETE FROM appointment_records WHERE id = ?', [id])
  })
}

module.exports = {
  normalizeAppointmentItem,
  normalizeAppointmentSchedule,
  normalizeAppointmentRecord,
  listAppointmentItems,
  listActiveAppointmentItems,
  getAppointmentItemDetail,
  createAppointmentItem,
  updateAppointmentItem,
  deleteAppointmentItem,
  listAppointmentSchedules,
  getAppointmentScheduleDetail,
  createAppointmentSchedule,
  updateAppointmentSchedule,
  deleteAppointmentSchedule,
  getAppointmentRecordDetail,
  createAppointmentRecord,
  listAppointmentRecordsByUser,
  listAppointmentRecordsForAdmin,
  updateAppointmentRecordStatus,
  deleteAppointmentRecord
}
