/**
 * 员工 App 当前用户 / 仪表盘相关路由。
 *
 * 路径直接挂在 /api/v1/employee 根：
 *   GET  /me
 *   PUT  /me
 *   GET  /dashboard/me
 *   GET  /dashboard/stats
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { query, queryOne } = require('../../utils/db')
const {
  getEmployeeDetail,
  updateEmployee
} = require('../../services/employeeService')

// ===== 个人资料 =====
router.get(
  '/me',
  asyncRoute(async (req, res) => {
    const employee = await getEmployeeDetail(req.user.id)
    success(res, { employee })
  })
)

router.put(
  '/me',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    // 仅允许 display_name / avatar_url 自助修改
    const patch = {}
    if (body.display_name !== undefined) patch.display_name = body.display_name
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url
    const employee = await updateEmployee(req.user.id, patch)
    success(res, { employee }, '更新成功')
  })
)

// ===== 仪表盘卡片 =====
router.get(
  '/dashboard/me',
  asyncRoute(async (req, res) => {
    const employeeId = req.user.id
    const totalRow = await queryOne(
      'SELECT COUNT(*) AS c FROM customers WHERE assigned_employee_id = ? AND active = 1',
      [employeeId]
    )
    const newRow = await queryOne(
      `SELECT COUNT(*) AS c FROM customers
       WHERE assigned_employee_id = ? AND active = 1
         AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [employeeId]
    )
    const followUpsRow = await queryOne(
      `SELECT COUNT(*) AS c FROM follow_ups
       WHERE employee_id = ?
         AND follow_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [employeeId]
    )
    const pendingRow = await queryOne(
      `SELECT COUNT(*) AS c FROM customers
       WHERE assigned_employee_id = ? AND active = 1
         AND next_follow_up_at IS NOT NULL
         AND next_follow_up_at <= NOW()`,
      [employeeId]
    )

    success(res, {
      customers_total: totalRow ? Number(totalRow.c) : 0,
      customers_new_this_month: newRow ? Number(newRow.c) : 0,
      follow_ups_this_month: followUpsRow ? Number(followUpsRow.c) : 0,
      customers_pending_follow_up: pendingRow ? Number(pendingRow.c) : 0
    })
  })
)

router.get(
  '/dashboard/stats',
  asyncRoute(async (req, res) => {
    const employeeId = req.user.id
    const range = ['week', 'month', 'quarter'].includes(req.query.range) ? req.query.range : 'month'
    const intervalMap = { week: 7, month: 30, quarter: 90 }
    const days = intervalMap[range]

    const newCustomersRow = await queryOne(
      `SELECT COUNT(*) AS c FROM customers
       WHERE assigned_employee_id = ? AND active = 1
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [employeeId, days]
    )
    const followUpsRow = await queryOne(
      `SELECT COUNT(*) AS c FROM follow_ups
       WHERE employee_id = ? AND follow_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [employeeId, days]
    )
    const signedRow = await queryOne(
      `SELECT COUNT(*) AS c FROM customers
       WHERE assigned_employee_id = ? AND active = 1
         AND status = 'signed'
         AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [employeeId, days]
    )
    const trendRows = await query(
      `SELECT DATE(follow_at) AS day, COUNT(*) AS c FROM follow_ups
       WHERE employee_id = ? AND follow_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY DATE(follow_at) ORDER BY day ASC`,
      [employeeId]
    )

    success(res, {
      range,
      new_customers: newCustomersRow ? Number(newCustomersRow.c) : 0,
      follow_ups: followUpsRow ? Number(followUpsRow.c) : 0,
      signed_customers: signedRow ? Number(signedRow.c) : 0,
      trend: trendRows.map((r) => ({
        date: r.day instanceof Date
          ? `${r.day.getFullYear()}-${String(r.day.getMonth() + 1).padStart(2, '0')}-${String(r.day.getDate()).padStart(2, '0')}`
          : String(r.day),
        count: Number(r.c)
      }))
    })
  })
)

module.exports = router
