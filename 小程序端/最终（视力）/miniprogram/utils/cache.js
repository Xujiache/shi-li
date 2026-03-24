/**
 * 数据缓存工具 —— 所有缓存 key 绑定 user_id，防止不同账号串数据
 */

function _getUserId() {
  try {
    return wx.getStorageSync('current_user_id') || ''
  } catch (e) {
    return ''
  }
}

function _makeKey(key, userId) {
  const uid = userId || _getUserId()
  if (!uid) return null
  return 'cache_' + uid + '_' + key
}

/**
 * 写入缓存
 * @param {string} key   业务 key，如 'children' / 'records_xxx'
 * @param {*}      data  要缓存的数据
 * @param {string} [userId] 可选，指定用户 ID
 */
function setCache(key, data, userId) {
  const uid = userId || _getUserId()
  const cacheKey = _makeKey(key, uid)
  if (!cacheKey) return false
  try {
    wx.setStorageSync(cacheKey, {
      data: data,
      ts: Date.now(),
      uid: uid
    })
    return true
  } catch (e) {
    return false
  }
}

/**
 * 读取缓存，同时验证账号一致性
 * @param {string} key
 * @param {string} [userId]
 * @returns {*|null}  缓存的数据，无效时返回 null
 */
function getCache(key, userId) {
  const uid = userId || _getUserId()
  const cacheKey = _makeKey(key, uid)
  if (!cacheKey) return null
  try {
    const entry = wx.getStorageSync(cacheKey)
    if (!entry || typeof entry !== 'object' || !entry.data) return null
    // 验证：缓存的 uid 必须与当前 uid 一致
    if (entry.uid && entry.uid !== uid) return null
    return entry.data
  } catch (e) {
    return null
  }
}

/**
 * 删除某一条缓存
 */
function removeCache(key, userId) {
  const cacheKey = _makeKey(key, userId)
  if (!cacheKey) return
  try {
    wx.removeStorageSync(cacheKey)
  } catch (e) {
    // ignore
  }
}

/**
 * 清除指定用户的所有缓存（退出登录时调用）
 */
function clearUserCache(userId) {
  const uid = userId || _getUserId()
  if (!uid) return
  try {
    const info = wx.getStorageInfoSync()
    const keys = info.keys || []
    const prefix = 'cache_' + uid + '_'
    keys.forEach(function (k) {
      if (k.indexOf(prefix) === 0) {
        wx.removeStorageSync(k)
      }
    })
  } catch (e) {
    // ignore
  }
}

module.exports = { setCache, getCache, removeCache, clearUserCache }
