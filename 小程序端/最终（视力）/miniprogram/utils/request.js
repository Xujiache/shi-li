const TOKEN_KEY = 'mobile_token'

/**
 * 获取小程序 API 基地址。
 * @returns {string} API 基地址。
 */
function getApiBaseUrl() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.apiBaseUrl) {
      return String(app.globalData.apiBaseUrl).replace(/\/+$/, '')
    }
  } catch (e) {}
  return 'https://api.gmxd.asia/api/v1'
}

/**
 * 获取当前登录 token。
 * @returns {string} 当前 token。
 */
function getAuthToken() {
  try {
    return String(wx.getStorageSync(TOKEN_KEY) || '')
  } catch (e) {
    return ''
  }
}

/**
 * 保存当前登录 token。
 * @param {string} token 登录 token。
 * @returns {void}
 */
function setAuthToken(token) {
  wx.setStorageSync(TOKEN_KEY, String(token || ''))
}

/**
 * 清理当前登录 token。
 * @returns {void}
 */
function clearAuthToken() {
  try {
    wx.removeStorageSync(TOKEN_KEY)
  } catch (e) {
    // ignore
  }
}

/**
 * 统一发起 HTTP 请求。
 * @param {{ method?: string, path: string, data?: any, auth?: boolean }} options 请求选项。
 * @returns {Promise<any>} 接口 `data` 字段。
 */
function request(options) {
  const method = options && options.method ? String(options.method).toUpperCase() : 'GET'
  const path = options && options.path ? String(options.path) : ''
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`
  const header = {}
  const token = getAuthToken()

  if (token) {
    header.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: options && options.data !== undefined ? options.data : undefined,
      header,
      success(res) {
        const body = res && res.data ? res.data : {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body.data)
          return
        }
        if (res.statusCode === 401) {
          clearAuthToken()
        }
        reject(new Error(body.message || `请求失败(${res.statusCode})`))
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络请求失败'))
      }
    })
  })
}

module.exports = {
  TOKEN_KEY,
  getApiBaseUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  request
}
