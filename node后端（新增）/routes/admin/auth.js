const express = require('express')
const router = express.Router()
const { authMiddleware, USER_TYPES, generateToken } = require('../../utils/jwt')
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { adminLogin, safeAdmin, buildAdminTokenPayload, findAdminById } = require('../../services/adminService')

/**
 * 管理员登录（使用独立 admins 表）。
 */
async function loginHandler(req, res) {
  const admin = await adminLogin(
    String(req.body.phone || '').trim(),
    String(req.body.password || '')
  )
  const token = generateToken(buildAdminTokenPayload(admin), USER_TYPES.ADMIN)
  success(res, { token, admin: safeAdmin(admin) }, '登录成功')
}

/**
 * 获取当前管理员信息。
 */
async function meHandler(req, res) {
  const admin = await findAdminById(req.user.id)
  success(res, { admin: safeAdmin(admin) })
}

/**
 * 退出登录。
 */
function logoutHandler(req, res) {
  success(res, null, '退出登录成功')
}

router.post('/login', asyncRoute(loginHandler))
router.get('/me', authMiddleware(USER_TYPES.ADMIN), asyncRoute(meHandler))
router.post('/logout', authMiddleware(USER_TYPES.ADMIN), logoutHandler)

module.exports = router
