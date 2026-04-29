/**
 * 员工 App 同事列表路由。
 * 挂载在 /api/v1/employee/team
 *
 * 注：announcements 与 customer-tags 不在 team 子路由下，由 index.js 直接挂顶层。
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { query } = require('../../utils/db')

router.get(
  '/members',
  asyncRoute(async (req, res) => {
    const departmentId = req.user.department_id
    if (!departmentId) {
      return success(res, { list: [] })
    }
    const rows = await query(
      `SELECT id, display_name, avatar_url, role, position, phone
       FROM employees
       WHERE department_id = ? AND active = 1 AND id <> ?
       ORDER BY display_name ASC`,
      [departmentId, req.user.id]
    )
    return success(res, {
      list: rows.map((r) => ({
        id: Number(r.id),
        display_name: r.display_name || '',
        avatar_url: r.avatar_url || '',
        role: r.role || 'staff',
        position: r.position || '',
        phone: r.phone || ''
      }))
    })
  })
)

module.exports = router
