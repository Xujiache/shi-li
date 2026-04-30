const path = require('path')
const crypto = require('crypto')
const { StatusCodes } = require('http-status-codes')
const config = require('../config')
const { execute } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { ensureDirectory, buildRelativeFilePath } = require('../utils/helpers')

// 仅允许的图片扩展名
const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])

/**
 * 通过 magic byte 检测文件真实类型，返回标准扩展名（含点）；不是图片返回 null。
 */
function detectImageExtFromMagic(buffer) {
  if (!buffer || buffer.length < 12) return null
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return '.png'
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return '.jpg'
  // GIF87a / GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return '.gif'
  // WebP: "RIFF....WEBP"
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
      && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return '.webp'
  // BMP: "BM"
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return '.bmp'
  return null
}

/**
 * 根据上传文件生成唯一文件名。 优先用 magic byte 推断的扩展，避免攻击者用 .html 伪装成 image/png
 */
function buildFilename(originalName, detectedExt) {
  const claimedExt = path.extname(originalName || '').toLowerCase()
  const ext = detectedExt || (ALLOWED_EXTS.has(claimedExt) ? claimedExt : '.png')
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
  // 1) 客户端 mimetype 粗筛（可被伪造，仅作早期拒绝）
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    throw createAppError('仅支持图片上传', StatusCodes.BAD_REQUEST)
  }
  // 2) magic byte 真实校验（关键防御：拒绝伪装成图片的 .html / .svg / 任意脚本）
  const detectedExt = detectImageExtFromMagic(file.buffer)
  if (!detectedExt) {
    throw createAppError('文件不是合法图片（PNG/JPG/GIF/WebP/BMP）', StatusCodes.BAD_REQUEST)
  }

  const filename = buildFilename(file.originalname, detectedExt)
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
