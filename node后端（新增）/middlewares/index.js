const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')
const { notFoundHandler, errorHandler } = require('./error')
const logger = require('../utils/logger')
const config = require('../config')
const { ensureDirectory } = require('../utils/helpers')

/**
 * 注册所有中间件。
 * @param {import('express').Application} app Express 应用实例。
 * @returns {import('express').Application} 已注册中间件的应用实例。
 */
function registerMiddlewares(app) {
  ensureDirectory(config.upload.rootDir)

  app.use(helmet({ crossOriginResourcePolicy: false }))

  // CORS：生产环境只允许 env 中显式配置的 origin
  const allowed = config.cors.allowedOrigins
  app.use(cors({
    origin(origin, callback) {
      // 无 origin（curl / 同源 / 小程序原生请求）→ 放行
      if (!origin) return callback(null, true)
      // 配置了白名单 → 严格匹配
      if (allowed.length > 0) {
        if (allowed.includes(origin)) return callback(null, true)
        return callback(new Error(`CORS not allowed: ${origin}`))
      }
      // 没配白名单（dev 默认）→ 全放
      if (config.server.env === 'production') {
        return callback(new Error(`CORS not allowed in production without CORS_ALLOWED_ORIGINS configured`))
      }
      return callback(null, true)
    },
    credentials: true
  }))

  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))

  app.use(
    morgan('dev', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
    })
  )

  // 暴露本地上传目录，替代原 cloud:// 文件访问能力。
  app.use(config.upload.staticPrefix, express.static(path.resolve(config.upload.rootDir)))

  return app
}

/**
 * 注册错误处理中间件。
 * @param {import('express').Application} app Express 应用实例。
 * @returns {import('express').Application} 已注册错误处理的应用实例。
 */
function registerErrorHandlers(app) {
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

module.exports = {
  registerMiddlewares,
  registerErrorHandlers
}