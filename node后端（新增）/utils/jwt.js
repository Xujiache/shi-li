const jwt = require('jsonwebtoken')
const config = require('../config')
const { StatusCodes } = require('http-status-codes')

const USER_TYPES = {
  MOBILE: 'mobile',
  ADMIN: 'admin',
  EMPLOYEE: 'employee'
}

/**
 * 根据用户类型获取签名密钥。
 * @param {string} type 用户类型。
 * @returns {string} 对应的 JWT 密钥。
 */
function getSecretByType(type) {
  switch (type) {
    case USER_TYPES.ADMIN:
      return config.jwt.adminSecret
    case USER_TYPES.EMPLOYEE:
      return config.jwt.employeeSecret
    case USER_TYPES.MOBILE:
    default:
      return config.jwt.mobileSecret
  }
}

/**
 * 根据用户类型获取过期时间。
 * @param {string} type 用户类型。
 * @returns {string} 过期时间字符串。
 */
function getExpiresInByType(type) {
  if (type === USER_TYPES.EMPLOYEE) {
    return config.jwt.employeeExpiresIn
  }
  return config.jwt.expiresIn
}

/**
 * 生成指定类型的 JWT 令牌。
 * @param {Record<string, unknown>} payload 载荷数据。
 * @param {string} [type=USER_TYPES.MOBILE] 用户类型。
 * @returns {string} JWT 令牌。
 */
function generateToken(payload, type = USER_TYPES.MOBILE) {
  return jwt.sign({ ...payload, type }, getSecretByType(type), {
    expiresIn: getExpiresInByType(type)
  })
}

/**
 * 验证 JWT 令牌并返回解码数据。
 * @param {string} token JWT 令牌。
 * @param {string} [type=USER_TYPES.MOBILE] 用户类型。
 * @returns {Record<string, unknown>|null} 解码后的用户信息。
 */
function verifyToken(token, type = USER_TYPES.MOBILE) {
  try {
    const decoded = jwt.verify(token, getSecretByType(type))
    if (decoded.type !== type) return null
    return decoded
  } catch {
    return null
  }
}

/**
 * 创建 JWT 鉴权中间件。
 * @param {string} [type=USER_TYPES.MOBILE] 用户类型。
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void} Express 中间件。
 */
function authMiddleware(type = USER_TYPES.MOBILE) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        code: StatusCodes.UNAUTHORIZED,
        message: '未提供授权令牌',
        data: null
      })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token, type)
    if (!decoded) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        code: StatusCodes.UNAUTHORIZED,
        message: '无效的授权令牌',
        data: null
      })
    }

    req.user = decoded
    return next()
  }
}

module.exports = {
  USER_TYPES,
  generateToken,
  verifyToken,
  authMiddleware
}