/**
 * 员工 App 鉴权增强中间件。
 *
 * 职责：在 utils/jwt.authMiddleware(USER_TYPES.EMPLOYEE) 已经把 JWT 解到 req.user 之后，
 * 进一步做：
 *   1) employees.active=1 校验（被禁用的账号立刻下线）
 *   2) must_change_password 拦截（除白名单 path 外强制跳改密接口）
 *   3) 单设备登录校验（token_hash 必须在 employee_sessions 中且 revoked=0）
 *
 * 若任意一项失败，返回对应错误码（详见 PRD §3.5）。
 *
 * 与 utils/jwt.authMiddleware 配合使用：
 *   router.use(authMiddleware(USER_TYPES.EMPLOYEE))
 *   router.use(employeeAuth())
 */
const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const { queryOne } = require('../utils/db')
const { error } = require('../utils/response')
const config = require('../config')
const logger = require('../utils/logger')

/**
 * 不需要走完整 employeeAuth 校验的 path 集合。
 * 这些 path 必须在登录后能调用（比如首登改密），但不要被 must_change_password 拦截。
 * @type {Set<string>}
 */
const MUST_CHANGE_PASSWORD_WHITELIST = new Set([
  '/auth/change-password',
  '/auth/logout'
])

/**
 * 计算 token 的 SHA-256 哈希，与 employee_sessions.token_hash 比对。
 * @param {string} token JWT token 原文
 * @returns {string} 64 位十六进制
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

/**
 * 从 Authorization header 提取裸 token。
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

/**
 * 员工鉴权后置中间件工厂。
 * @returns {Function} Express 中间件
 */
function employeeAuth() {
  return async function employeeAuthMiddleware(req, res, next) {
    try {
      const user = req.user
      if (!user || user.type !== 'employee' || !user.id) {
        return error(res, '需要员工身份', StatusCodes.UNAUTHORIZED)
      }

      // 1) 账号活跃性
      const employee = await queryOne(
        `SELECT id, phone, role, department_id, active, must_change_password
         FROM employees WHERE id = ? LIMIT 1`,
        [user.id]
      )
      if (!employee) {
        return error(res, '账号不存在', StatusCodes.UNAUTHORIZED)
      }
      if (!employee.active) {
        return error(res, '账号已被停用，请联系管理员', StatusCodes.UNAUTHORIZED)
      }

      // 2) 单设备登录校验（开关由配置控制）
      if (config.employee.singleDevice) {
        const token = extractToken(req)
        if (token) {
          const session = await queryOne(
            `SELECT id, revoked, expires_at
             FROM employee_sessions
             WHERE employee_id = ? AND token_hash = ?
             ORDER BY id DESC LIMIT 1`,
            [user.id, hashToken(token)]
          )
          if (!session) {
            // 当前 token 没在 session 表里 — 大概率是被踢下线了
            return error(res, '账号已在其他设备登录', StatusCodes.UNAUTHORIZED)
          }
          if (session.revoked) {
            return error(res, '账号已在其他设备登录', StatusCodes.UNAUTHORIZED)
          }
          if (session.expires_at && new Date(session.expires_at) < new Date()) {
            return error(res, '登录已过期，请重新登录', StatusCodes.UNAUTHORIZED)
          }
        }
      }

      // 3) must_change_password 拦截（白名单豁免）
      //    业务码 40104（DESIGN §3.5）—— 客户端据此跳改密页，与一般 403 区分
      if (employee.must_change_password) {
        const reqPath = req.path || req.url || ''
        if (!MUST_CHANGE_PASSWORD_WHITELIST.has(reqPath)) {
          return res.status(StatusCodes.FORBIDDEN).json({
            code: 40104,
            message: '请先修改初始密码',
            data: null
          })
        }
      }

      // 透传更鲜活的字段到 req.user，业务侧统一从 req.user 取
      req.user = {
        ...user,
        role: employee.role,
        department_id: employee.department_id,
        active: employee.active,
        must_change_password: employee.must_change_password
      }
      // 同时挂在 req.employee 方便业务层读
      req.employee = req.user

      return next()
    } catch (err) {
      logger.error(`employeeAuth 中间件异常: ${err.message}`)
      return error(res, '鉴权失败', StatusCodes.INTERNAL_SERVER_ERROR)
    }
  }
}

module.exports = {
  employeeAuth,
  hashToken,
  MUST_CHANGE_PASSWORD_WHITELIST
}
