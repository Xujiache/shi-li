const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { authMiddleware, USER_TYPES } = require('../../utils/jwt')
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { registerByPhone, loginByPhone, loginByWechat } = require('../../services/authService')
const { getUserProfile } = require('../../services/userService')

/**
 * 处理手机号注册。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function registerHandler(req, res) {
  const result = await registerByPhone({
    phone: req.body.phone,
    password: req.body.password
  })
  success(res, result, '注册成功', StatusCodes.CREATED)
}

/**
 * 处理手机号登录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function loginHandler(req, res) {
  const result = await loginByPhone(
    {
      phone: req.body.phone,
      password: req.body.password
    },
    USER_TYPES.MOBILE
  )
  success(res, result, '登录成功')
}

/**
 * 处理微信快捷登录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function wechatLoginHandler(req, res) {
  const result = await loginByWechat({
    code: req.body.code
  })
  success(res, result, '微信登录成功')
}

/**
 * 获取当前登录用户资料。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function meHandler(req, res) {
  const profile = await getUserProfile(req.user.id)
  success(res, profile)
}

/**
 * 处理移动端退出登录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {void}
 */
function logoutHandler(req, res) {
  success(res, null, '退出登录成功')
}

router.post('/register', asyncRoute(registerHandler))
router.post('/login', asyncRoute(loginHandler))
router.post('/wechat-login', asyncRoute(wechatLoginHandler))
router.get('/me', authMiddleware(USER_TYPES.MOBILE), asyncRoute(meHandler))
router.post('/logout', authMiddleware(USER_TYPES.MOBILE), logoutHandler)

module.exports = router