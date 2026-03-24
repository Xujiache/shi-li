const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

/**
 * 将环境变量解析为整数。
 * @param {string|undefined} value 环境变量值。
 * @param {number} fallback 默认值。
 * @returns {number} 解析后的整数值。
 */
function toInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 将环境变量解析为布尔值。
 * @param {string|undefined} value 环境变量值。
 * @param {boolean} fallback 默认值。
 * @returns {boolean} 解析后的布尔值。
 */
function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

const port = toInt(process.env.PORT, 3000)

module.exports = {
  server: {
    port,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
    publicUrl: process.env.SERVER_PUBLIC_URL || `http://127.0.0.1:${port}`
  },
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vision_management',
    charset: process.env.DB_CHARSET || 'utf8mb4'
  },
  redis: {
    enabled: toBoolean(process.env.REDIS_ENABLED, false),
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || ''
  },
  jwt: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    mobileSecret: process.env.JWT_MOBILE_SECRET || process.env.JWT_SECRET || 'mobile-dev-secret',
    adminSecret: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'admin-dev-secret'
  },
  upload: {
    rootDir: process.env.UPLOAD_ROOT_DIR
      ? path.resolve(process.cwd(), process.env.UPLOAD_ROOT_DIR)
      : path.resolve(__dirname, '../uploads'),
    staticPrefix: process.env.UPLOAD_STATIC_PREFIX || '/uploads',
    maxImageSize: toInt(process.env.UPLOAD_MAX_IMAGE_SIZE, 5 * 1024 * 1024)
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || ''
  }
}