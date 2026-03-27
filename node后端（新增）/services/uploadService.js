const path = require('path')
const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const config = require('../config')
const { execute } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { ensureDirectory, buildRelativeFilePath } = require('../utils/helpers')

/**
 * 根据上传文件生成唯一文件名。
 * @param {string} originalName 原始文件名。
 * @returns {string} 新文件名。
 */
function buildFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.png'
  return `${Date.now()}-${crypto.randomUUID()}${ext}`
}

/**
 * 将 Windows 路径标准化为 URL 路径。
 * @param {string} targetPath 文件相对路径。
 * @returns {string} 规范化后的 URL 路径。
 */
function normalizeUrlPath(targetPath) {
  return String(targetPath).replace(/\\/g, '/')
}

/**
 * 保存图片并返回文件访问地址。
 * @param {Express.Multer.File} file 上传文件。
 * @param {string} prefix 业务前缀。
 * @returns {Promise<{url: string, relativePath: string}>} 上传结果。
 */
async function saveImage(file, prefix) {
  if (!file) {
    throw createAppError('缺少上传文件', StatusCodes.BAD_REQUEST)
  }
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    throw createAppError('仅支持图片上传', StatusCodes.BAD_REQUEST)
  }

  const filename = buildFilename(file.originalname)
  const relativePath = buildRelativeFilePath(prefix, filename)
  const targetDir = path.join(config.upload.rootDir, path.dirname(relativePath))
  ensureDirectory(targetDir)

  const finalPath = path.join(config.upload.rootDir, relativePath)
  await require('fs').promises.writeFile(finalPath, file.buffer)

  const urlPath = normalizeUrlPath(path.posix.join(config.upload.staticPrefix, relativePath))
  const fullUrl = `${config.server.publicUrl}${urlPath}`

  await execute('INSERT INTO uploads (biz_type, file_name, file_path, url) VALUES (?, ?, ?, ?)', [
    String(prefix || ''),
    filename,
    normalizeUrlPath(relativePath),
    fullUrl
  ])

  return {
    url: fullUrl,
    relativePath: normalizeUrlPath(relativePath)
  }
}

module.exports = {
  saveImage
}
