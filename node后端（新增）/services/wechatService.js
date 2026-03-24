const https = require('https')
const { StatusCodes } = require('http-status-codes')
const config = require('../config')
const { createAppError } = require('../utils/appError')

/**
 * 发起微信 jscode2session 请求。
 * @param {string} code 小程序登录 code。
 * @returns {Promise<Record<string, any>>} 微信返回结果。
 */
function requestCode2Session(code) {
  const query = new URLSearchParams({
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code'
  }).toString()

  return new Promise((resolve, reject) => {
    https
      .get(`https://api.weixin.qq.com/sns/jscode2session?${query}`, (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

/**
 * 通过 code 获取微信 openid。
 * @param {string} code 小程序 `wx.login` 返回的 code。
 * @returns {Promise<string>} 微信 openid。
 */
async function getWechatOpenidByCode(code) {
  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw createAppError('未配置微信小程序登录参数，请补充 WECHAT_APP_ID 和 WECHAT_APP_SECRET', StatusCodes.BAD_REQUEST)
  }

  if (!code) {
    throw createAppError('缺少微信登录 code', StatusCodes.BAD_REQUEST)
  }

  const response = await requestCode2Session(code)
  if (!response || response.errcode) {
    throw createAppError(response.errmsg || '微信登录失败', StatusCodes.BAD_GATEWAY)
  }

  if (!response.openid) {
    throw createAppError('微信登录未返回 openid', StatusCodes.BAD_GATEWAY)
  }

  return String(response.openid)
}

module.exports = {
  getWechatOpenidByCode
}
