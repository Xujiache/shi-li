/**
 * 员工 App 站内消息路由。
 * 挂载在 /api/v1/employee/notifications
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  clearReadNotifications
} = require('../../services/notificationService')

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listNotifications(req.user, req.query)
    success(res, result)
  })
)

router.get(
  '/unread-count',
  asyncRoute(async (req, res) => {
    const count = await unreadCount(req.user)
    success(res, { unread: count })
  })
)

router.put(
  '/read-all',
  asyncRoute(async (req, res) => {
    const result = await markAllRead(req.user)
    success(res, result, '已全部已读')
  })
)

router.put(
  '/:id/read',
  asyncRoute(async (req, res) => {
    const result = await markRead(req.user, req.params.id)
    success(res, result, '已读')
  })
)

router.delete(
  '/read',
  asyncRoute(async (req, res) => {
    const result = await clearReadNotifications(req.user)
    success(res, result, '已清空已读消息')
  })
)

module.exports = router
