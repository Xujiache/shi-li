const express = require('express')
const router = express.Router()
const mobileRoutes = require('./mobile/index')
const adminRoutes = require('./admin/index')
const commonRoutes = require('./common/index')
const { success } = require('../utils/response')

/**
 * 注册所有路由。
 * @param {import('express').Application} app Express 应用实例。
 * @returns {import('express').Application} 已注册路由的应用实例。
 */
function registerRoutes(app) {
  router.get('/health', (req, res) => {
    success(res, { status: 'ok' }, 'Server is running')
  })

  router.use('/api/v1/common', commonRoutes)
  router.use('/api/v1/mobile', mobileRoutes)
  router.use('/api/v1/admin', adminRoutes)

  app.use(router)
  return app
}

module.exports = registerRoutes