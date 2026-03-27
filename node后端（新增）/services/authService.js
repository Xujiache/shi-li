const { StatusCodes } = require('http-status-codes')
const { comparePassword, hashPassword } = require('../utils/bcrypt')
const { createAppError } = require('../utils/appError')
const { USER_TYPES, generateToken } = require('../utils/jwt')
const { getWechatOpenidByCode } = require('./wechatService')
const {
  normalizeUser,
  findUserByPhone,
  findUserById,
  findUserByOpenid,
  ensureLoginableUser,
  touchLastLogin,
  createUser,
  buildTokenPayload
} = require('./userService')

/**
 * 构造认证响应。
 * @param {Record<string, any>} user 用户记录。
 * @param {string} userType 令牌类型。
 * @returns {{token: string, user: Record<string, any>}} 登录结果。
 */
function buildAuthResult(user, userType) {
  return {
    token: generateToken(buildTokenPayload(user), userType),
    user: normalizeUser(user)
  }
}

/**
 * 处理手机号注册。
 * @param {{phone: string, password: string}} payload 注册参数。
 * @returns {Promise<{token: string, user: Record<string, any>}>} 注册结果。
 */
async function registerByPhone(payload) {
  const phone = String(payload.phone || '').trim()
  const password = String(payload.password || '')

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw createAppError('手机号格式不正确', StatusCodes.BAD_REQUEST)
  }
  if (password.length < 6) {
    throw createAppError('密码长度不能少于 6 位', StatusCodes.BAD_REQUEST)
  }

  const passwordHash = await hashPassword(password)
  const user = await createUser({
    phone,
    passwordHash,
    displayName: phone
  })

  return buildAuthResult(user, USER_TYPES.MOBILE)
}

/**
 * 处理手机号登录。
 * @param {{phone: string, password: string}} payload 登录参数。
 * @param {string} [userType=USER_TYPES.MOBILE] 令牌类型。
 * @returns {Promise<{token: string, user: Record<string, any>}>} 登录结果。
 */
async function loginByPhone(payload, userType = USER_TYPES.MOBILE) {
  const phone = String(payload.phone || '').trim()
  const password = String(payload.password || '')
  const user = await findUserByPhone(phone)

  ensureLoginableUser(user)

  if (!user.password_hash) {
    throw createAppError('该账号未设置密码，请使用微信登录或联系管理员', StatusCodes.BAD_REQUEST)
  }

  const matched = await comparePassword(password, user.password_hash)
  if (!matched) {
    throw createAppError('手机号或密码错误', StatusCodes.UNAUTHORIZED)
  }

  if (userType === USER_TYPES.ADMIN && !user.is_admin) {
    throw createAppError('该账号没有管理员权限', StatusCodes.FORBIDDEN)
  }

  await touchLastLogin(user.id)
  const latest = await findUserById(user.id)
  return buildAuthResult(latest, userType)
}

/**
 * 处理微信快捷登录。
 * @param {{code: string}} payload 微信登录参数。
 * @returns {Promise<{token: string, user: Record<string, any>}>} 登录结果。
 */
async function loginByWechat(payload) {
  const openid = await getWechatOpenidByCode(String(payload.code || ''))
  let user = await findUserByOpenid(openid)

  if (!user) {
    user = await createUser({
      wechatOpenid: openid,
      displayName: '微信用户'
    })
  }

  ensureLoginableUser(user)
  await touchLastLogin(user.id)
  const latest = await findUserById(user.id)
  return buildAuthResult(latest, USER_TYPES.MOBILE)
}

module.exports = {
  registerByPhone,
  loginByPhone,
  loginByWechat
}
