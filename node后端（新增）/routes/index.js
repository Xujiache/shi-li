const express = require('express')
const router = express.Router()
const mobileRoutes = require('./mobile/index')
const adminRoutes = require('./admin/index')
const employeeRoutes = require('./employee/index')
const commonRoutes = require('./common/index')
const { success } = require('../utils/response')

/**
 * 注册所有路由。
 * @param {import('express').Application} app Express 应用实例。
 * @returns {import('express').Application} 已注册路由的应用实例。
 */
function registerRoutes(app) {
  // 健康检查 — 同时挂在根和 /api/v1 下，兼容前端探活路径（utils/network.ts）
  const healthHandler = (req, res) => {
    success(res, { status: 'ok' }, 'Server is running')
  }
  router.get('/health', healthHandler)
  router.get('/api/v1/health', healthHandler)

  router.use('/api/v1/common', commonRoutes)
  router.use('/api/v1/mobile', mobileRoutes)
  router.use('/api/v1/admin', adminRoutes)
  router.use('/api/v1/employee', employeeRoutes)

  app.use(router)
  return app
}

module.exports = registerRoutes