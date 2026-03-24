const express = require('express')
const router = express.Router()
const { authMiddleware, USER_TYPES } = require('../../utils/jwt')
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { loginByPhone } = require('../../services/authService')
const { getUserProfile } = require('../../services/userService')

/**
 * 处理管理员登录。
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
    USER_TYPES.ADMIN
  )
  success(
    res,
    {
      token: result.token,
      admin: result.user
    },
    '登录成功'
  )
}

/**
 * 获取当前管理员信息。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function meHandler(req, res) {
  const admin = await getUserProfile(req.user.id)
  success(res, { admin })
}

/**
 * 处理管理员退出登录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {void}
 */
function logoutHandler(req, res) {
  success(res, null, '退出登录成功')
}

router.post('/login', asyncRoute(loginHandler))
router.get('/me', authMiddleware(USER_TYPES.ADMIN), asyncRoute(meHandler))
router.post('/logout', authMiddleware(USER_TYPES.ADMIN), logoutHandler)

module.exports = router
