const dotenv = require('dotenv')
const path = require('path')
const crypto = require('crypto')

dotenv.config()

const IS_PROD = (process.env.NODE_ENV || 'development') === 'production'

/** 生产环境必须有真实的 JWT secret，否则 fail-fast。 */
function requireSecret(envKey, devFallback) {
  const v = process.env[envKey] || process.env.JWT_SECRET || ''
  if (IS_PROD && !v) {
    throw new Error(
      `[FATAL] 生产环境必须配置 ${envKey}（或 JWT_SECRET）；当前未设置，拒绝启动以避免使用 dev 默认 secret。`
    )
  }
  return v || devFallback
}

/** 默认员工密码：如果 env 没设，每次启动随机生成（持久化到内存）+ 启动日志告警。 */
function resolveDefaultEmployeePassword() {
  if (process.env.EMPLOYEE_DEFAULT_PASSWORD) return process.env.EMPLOYEE_DEFAULT_PASSWORD
  if (IS_PROD) {
    // 16 位随机：4 位字母 + 4 位数字 + 8 位 base64
    const rand = crypto.randomBytes(8).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'X8q3Lp2Z'
    const generated = `Emp@${rand}!${crypto.randomInt(1000, 9999)}`
    // eslint-disable-next-line no-console
    console.warn(
      `[WARN] EMPLOYEE_DEFAULT_PASSWORD 未设置；本次启动生成临时默认密码：${generated}\n` +
      '该密码仅用于本进程，重启会变；建议在 .env 中显式配置或通过 admin 后台改员工密码。'
    )
    return generated
  }
  return 'Init@2025'
}

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
    mobileSecret: requireSecret('JWT_MOBILE_SECRET', 'mobile-dev-secret'),
    adminSecret: requireSecret('JWT_ADMIN_SECRET', 'admin-dev-secret'),
    employeeSecret: requireSecret('JWT_EMPLOYEE_SECRET', 'employee-dev-secret'),
    employeeExpiresIn: process.env.JWT_EMPLOYEE_EXPIRES_IN || '7d'
  },
  employee: {
    loginFailLockMinutes: toInt(process.env.EMPLOYEE_LOGIN_FAIL_LOCK_MINUTES, 15),
    loginFailThreshold: toInt(process.env.EMPLOYEE_LOGIN_FAIL_THRESHOLD, 5),
    syncBatchMax: toInt(process.env.EMPLOYEE_SYNC_BATCH_MAX, 200),
    singleDevice: toBoolean(process.env.EMPLOYEE_SINGLE_DEVICE, true),
    defaultPassword: resolveDefaultEmployeePassword()
  },
  sms: {
    provider: process.env.SMS_PROVIDER || '',
    apiKey: process.env.SMS_API_KEY || '',
    apiSecret: process.env.SMS_API_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    loginTemplate: process.env.SMS_TEMPLATE_LOGIN || ''
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
  },
  ai: {
    base: process.env.AI_API_BASE || '',
    apiKey: process.env.AI_API_KEY || '',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini',
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 30000),
    // 每日 token 上限（每个 actor，admin 统一一个 actor_id；employee 每人独立）
    dailyTokenLimitAdmin: toInt(process.env.AI_DAILY_TOKEN_LIMIT_ADMIN, 200000),
    dailyTokenLimitEmployee: toInt(process.env.AI_DAILY_TOKEN_LIMIT_EMPLOYEE, 20000)
  },
  cors: {
    // 逗号分隔的允许 origin 列表；空 = 仅允许 same-origin / 无 origin（curl/小程序内）
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',').map((s) => s.trim()).filter(Boolean)
  }
}