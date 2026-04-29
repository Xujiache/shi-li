/**
 * 员工 App 鉴权相关路由。
 *
 * 拆为两段：
 *   - publicRouter：login / verify-code（无需 JWT）
 *   - authedRouter：change-password / logout（需要 JWT，但要绕过 must_change_password）
 *
 * 在 routes/employee/index.js 中分别挂载到鉴权链前/后。
 */
const express = require('express')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { createAppError } = require('../../utils/appError')
const {
  employeeLogin,
  verifyLoginCode,
  resendVerifyCode,
  changePassword,
  logoutEmployee
} = require('../../services/employeeService')

const publicRouter = express.Router()
const authedRouter = express.Router()

/**
 * 从请求里提取调用方的 IP。
 * @param {import('express').Request} req
 * @returns {string}
 */
function pickIp(req) {
  return req.ip || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || ''
}

/**
 * 从 Authorization header 取出裸 token。
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// ===== 公开 =====
publicRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const result = await employeeLogin({
      phone: body.phone,
      password: body.password,
      device_id: body.device_id,
      device_info: body.device_info,
      ip_addr: pickIp(req)
    })
    success(res, result, '登录成功')
  })
)

publicRouter.post(
  '/verify-code',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const result = await verifyLoginCode(body.phone, body.code)
    success(res, result, '验证成功')
  })
)

publicRouter.post(
  '/resend-verify-code',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const result = await resendVerifyCode(body.phone)
    success(res, result, result.message)
  })
)

// ===== 已鉴权 =====
authedRouter.post(
  '/change-password',
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    if (!body.old_password && !body.oldPassword) {
      throw createAppError('原密码不能为空', 400)
    }
    if (!body.new_password && !body.newPassword) {
      throw createAppError('新密码不能为空', 400)
    }
    const oldPwd = body.old_password || body.oldPassword
    const newPwd = body.new_password || body.newPassword
    const result = await changePassword(req.user.id, oldPwd, newPwd)
    success(res, result, '密码已更新')
  })
)

authedRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    const token = extractToken(req)
    const result = await logoutEmployee(req.user.id, token)
    success(res, result, '已退出登录')
  })
)

module.exports = {
  publicRouter,
  authedRouter
}
