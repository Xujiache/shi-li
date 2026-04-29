/**
 * 员工 App 路由聚合入口。挂载在 /api/v1/employee。
 *
 * 鉴权链顺序（关键）：
 *   1. /auth 公开子路由（login / verify-code）
 *   2. authMiddleware(EMPLOYEE)  —— 校验 JWT
 *   3. employeeAuth()           —— 单设备 / 活跃 / must_change_password 拦截
 *   4. /auth 已鉴权子路由（change-password / logout，白名单豁免 must_change_password）
 *   5. 其他业务路由
 *   6. 顶层独立小路由：/announcements、/customer-tags
 */
const express = require('express')
const router = express.Router()
const { authMiddleware, USER_TYPES } = require('../../utils/jwt')
const { employeeAuth } = require('../../middlewares/employeeAuth')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { query } = require('../../utils/db')

const { publicRouter: authPublic, authedRouter: authAuthed } = require('./auth')
const meRoutes = require('./me')
const customersRoutes = require('./customers')
const followUpsRoutes = require('./followUps')
const transfersRoutes = require('./transfers')
const notificationsRoutes = require('./notifications')
const teamRoutes = require('./team')
const uploadsRoutes = require('./uploads')
const syncRoutes = require('./sync')
const childrenRoutes = require('./children')

// 1) 公开路由（无 JWT）
router.use('/auth', authPublic)

// 2) 进入鉴权区
router.use(authMiddleware(USER_TYPES.EMPLOYEE))
router.use(employeeAuth())

// 3) 已鉴权 auth 子路由（change-password / logout 在 employeeAuth 白名单内）
router.use('/auth', authAuthed)

// 4) 业务路由
router.use(meRoutes)                              // /me、/dashboard/*
router.use('/customers', customersRoutes)
router.use('/follow-ups', followUpsRoutes)
router.use('/customer-transfers', transfersRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/team', teamRoutes)
router.use('/uploads', uploadsRoutes)
router.use('/sync', syncRoutes)
router.use('/children', childrenRoutes)

// 5) 顶层独立小路由
router.get(
  '/announcements',
  asyncRoute(async (req, res) => {
    const list = await query(
      `SELECT id, title, body, is_top, must_popup, publish_at
       FROM system_announcements
       WHERE active = 1
         AND (publish_at IS NULL OR publish_at <= NOW())
         AND (expires_at IS NULL OR expires_at >= NOW())
       ORDER BY is_top DESC, COALESCE(publish_at, created_at) DESC
       LIMIT 20`
    )
    success(res, { list })
  })
)

router.get(
  '/customer-tags',
  asyncRoute(async (req, res) => {
    const list = await query(
      `SELECT id, name, color, sort_order
       FROM customer_tags
       WHERE active = 1
       ORDER BY sort_order ASC, id ASC`
    )
    success(res, { list })
  })
)

module.exports = router
