const express = require('express')
const multer = require('multer')
const config = require('../../config')
const { USER_TYPES, verifyToken } = require('../../utils/jwt')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { saveImage } = require('../../services/uploadService')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxImageSize
  }
})

/**
 * 校验上传接口的双端令牌。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @param {import('express').NextFunction} next Express next 回调。
 * @returns {void}
 */
function anyAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      code: 401,
      message: '未提供授权令牌',
      data: null
    })
    return
  }

  const token = authHeader.split(' ')[1]
  const adminUser = verifyToken(token, USER_TYPES.ADMIN)
  const mobileUser = adminUser || verifyToken(token, USER_TYPES.MOBILE)
  if (!mobileUser) {
    res.status(401).json({
      code: 401,
      message: '无效的授权令牌',
      data: null
    })
    return
  }

  req.user = mobileUser
  next()
}

/**
 * 处理图片上传。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function uploadImageHandler(req, res) {
  const prefix = String(req.body.prefix || req.body.biz_type || 'common').trim()
  const result = await saveImage(req.file, prefix)
  success(
    res,
    {
      file_url: result.url,
      url: result.url,
      relative_path: result.relativePath
    },
    '上传成功'
  )
}

router.post(
  '/upload/image',
  anyAuthMiddleware,
  upload.single('file'),
  asyncRoute(uploadImageHandler)
)

module.exports = router
