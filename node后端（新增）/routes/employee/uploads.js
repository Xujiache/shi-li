/**
 * 员工 App 图片上传路由。
 * 挂载在 /api/v1/employee/uploads
 *
 * 复用 services/uploadService.saveImage（写 uploads 表）。
 * 上传后回查 uploads 表拿 id（saveImage 仅返回 url+relativePath）。
 */
const express = require('express')
const multer = require('multer')
const router = express.Router()
const config = require('../../config')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { createAppError } = require('../../utils/appError')
const { queryOne } = require('../../utils/db')
const { saveImage } = require('../../services/uploadService')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxImageSize
  }
})

router.post(
  '/image',
  upload.single('file'),
  asyncRoute(async (req, res) => {
    if (!req.file) {
      throw createAppError('缺少上传文件', 400)
    }
    const result = await saveImage(req.file, 'employee')
    // saveImage 不返回 id，按 url 回查最新一条 uploads
    const row = await queryOne(
      'SELECT id FROM uploads WHERE url = ? ORDER BY id DESC LIMIT 1',
      [result.url]
    )
    success(
      res,
      {
        id: row ? Number(row.id) : null,
        url: result.url,
        file_url: result.url,
        relative_path: result.relativePath
      },
      '上传成功'
    )
  })
)

module.exports = router
