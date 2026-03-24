const { getApiBaseUrl, getAuthToken } = require('./request')

/**
 * 上传图片到 Node 后端。
 * @param {string} filePath 本地临时文件路径。
 * @param {string} prefix 业务前缀。
 * @returns {Promise<{url: string, file_url: string, relative_path: string}>} 上传结果。
 */
function uploadImage(filePath, prefix) {
  const token = getAuthToken()
  const url = `${getApiBaseUrl()}/common/upload/image`

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      formData: {
        prefix: String(prefix || 'common')
      },
      success(res) {
        try {
          const body = JSON.parse(res.data || '{}')
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body.data || {})
            return
          }
          reject(new Error(body.message || `上传失败(${res.statusCode})`))
        } catch (error) {
          reject(new Error('上传返回解析失败'))
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '上传失败'))
      }
    })
  })
}

module.exports = {
  uploadImage
}
