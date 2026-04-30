const express = require('express')
const router = express.Router()
const authRoutes = require('./auth')
const questionnaireRoutes = require('./questionnaire')
const { authMiddleware, USER_TYPES } = require('../../utils/jwt')
const { publicTrackLimiter } = require('../../middlewares/rateLimit')
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { getUserProfile, updateUserProfile } = require('../../services/userService')
const {
  listChildrenByUser,
  getSchoolOptions,
  createChild,
  updateChild,
  deleteChild
} = require('../../services/childService')
const {
  listActiveAppointmentItems,
  listAppointmentSchedules,
  createAppointmentRecord,
  listAppointmentRecordsByUser
} = require('../../services/appointmentService')
const {
  listCheckupRecordsByChild,
  getCheckupRecordDetailForUser,
  createCheckupRecord,
  updateCheckupRecord
} = require('../../services/checkupService')
const { listActiveBanners, getTermsConfig, getProfileFieldConfig, trackEvent } = require('../../services/contentService')
const { findChildById, ensureChildOwnership } = require('../../services/childService')
const { getDisplayAnalysis } = require('../../services/aiAnalysisService')

/**
 * 家长查看孩子档案分析（按 admin 配置自动选 human/ai 模式）。
 */
async function childAnalysisHandler(req, res) {
  const child = await findChildById(req.params.id)
  if (!child) {
    return success(res, { analysis: null })
  }
  ensureChildOwnership(child, req.user.id)
  const analysis = await getDisplayAnalysis(req.params.id, { allow_generate: true })
  success(res, { analysis })
}

/**
 * 获取当前用户资料。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function getProfileHandler(req, res) {
  const profile = await getUserProfile(req.user.id)
  success(res, { profile })
}

/**
 * 更新当前用户资料。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateProfileHandler(req, res) {
  const profile = await updateUserProfile(req.user.id, req.body || {})
  success(res, { profile }, '保存成功')
}

/**
 * 获取当前用户孩子列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function listChildrenHandler(req, res) {
  const list = await listChildrenByUser(req.user.id)
  success(res, { list })
}

/**
 * 获取学校班级选项。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function schoolOptionsHandler(req, res) {
  const options = await getSchoolOptions()
  success(res, options)
}

/**
 * 创建孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createChildHandler(req, res) {
  const child = await createChild(req.user.id, req.user.phone || '', req.body || {})
  success(res, { child }, '创建成功')
}

/**
 * 更新孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateChildHandler(req, res) {
  const child = await updateChild(req.user.id, req.params.id, req.user.phone || '', req.body || {})
  success(res, { child }, '更新成功')
}

/**
 * 删除孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteChildHandler(req, res) {
  await deleteChild(req.user.id, req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取预约项目列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentItemsHandler(req, res) {
  const list = await listActiveAppointmentItems()
  success(res, { list })
}

/**
 * 获取预约排班列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentSchedulesHandler(req, res) {
  const result = await listAppointmentSchedules({
    item_id: req.query.item_id,
    date: req.query.date,
    active: true,
    page: req.query.page,
    page_size: req.query.page_size
  })
  success(res, result)
}

/**
 * 创建预约记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createBookingHandler(req, res) {
  const booking = await createAppointmentRecord(
    {
      id: req.user.id,
      phone: req.user.phone || ''
    },
    req.body || {}
  )
  success(res, { booking }, '预约成功')
}

/**
 * 获取当前用户预约记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function bookingListHandler(req, res) {
  const list = await listAppointmentRecordsByUser(req.user.id, {
    child_id: req.query.child_id
  })
  success(res, { list })
}

/**
 * 获取孩子检测记录列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function checkupListHandler(req, res) {
  const list = await listCheckupRecordsByChild(req.user.id, req.query.child_id)
  success(res, { list })
}

/**
 * 获取检测记录详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function checkupDetailHandler(req, res) {
  const record = await getCheckupRecordDetailForUser(req.user.id, req.params.id)
  success(res, { record })
}

/**
 * 创建检测记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createCheckupHandler(req, res) {
  const record = await createCheckupRecord(req.user.id, req.body || {})
  success(res, { record }, '创建成功')
}

/**
 * 更新检测记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateCheckupHandler(req, res) {
  const record = await updateCheckupRecord(req.user.id, req.params.id, req.body || {})
  success(res, { record }, '更新成功')
}

/**
 * 获取轮播图数据。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function bannersHandler(req, res) {
  const list = await listActiveBanners()
  success(res, { list })
}

/**
 * 获取协议与隐私配置。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function termsHandler(req, res) {
  const row = await getTermsConfig()
  success(res, { row })
}

/**
 * 写入前端埋点事件。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function trackHandler(req, res) {
  await trackEvent({
    userId: req.user ? req.user.id : null,
    visitorKey: req.body.visitor_key || req.ip,
    type: req.body.type,
    page: req.body.page,
    name: req.body.name
  })
  success(res, null, '上报成功')
}

router.use('/auth', authRoutes)
router.get('/user/profile', authMiddleware(USER_TYPES.MOBILE), asyncRoute(getProfileHandler))
router.put('/user/profile', authMiddleware(USER_TYPES.MOBILE), asyncRoute(updateProfileHandler))
router.get('/children', authMiddleware(USER_TYPES.MOBILE), asyncRoute(listChildrenHandler))
router.get('/children/school-options', authMiddleware(USER_TYPES.MOBILE), asyncRoute(schoolOptionsHandler))
router.post('/children', authMiddleware(USER_TYPES.MOBILE), asyncRoute(createChildHandler))
router.put('/children/:id', authMiddleware(USER_TYPES.MOBILE), asyncRoute(updateChildHandler))
router.delete('/children/:id', authMiddleware(USER_TYPES.MOBILE), asyncRoute(deleteChildHandler))
router.get('/children/:id/analysis', authMiddleware(USER_TYPES.MOBILE), asyncRoute(childAnalysisHandler))
router.get('/appointments/items', authMiddleware(USER_TYPES.MOBILE), asyncRoute(appointmentItemsHandler))
router.get('/appointments/schedules', authMiddleware(USER_TYPES.MOBILE), asyncRoute(appointmentSchedulesHandler))
router.get('/appointments/bookings', authMiddleware(USER_TYPES.MOBILE), asyncRoute(bookingListHandler))
router.post('/appointments/bookings', authMiddleware(USER_TYPES.MOBILE), asyncRoute(createBookingHandler))
router.get('/checkups', authMiddleware(USER_TYPES.MOBILE), asyncRoute(checkupListHandler))
router.get('/checkups/:id', authMiddleware(USER_TYPES.MOBILE), asyncRoute(checkupDetailHandler))
router.post('/checkups', authMiddleware(USER_TYPES.MOBILE), asyncRoute(createCheckupHandler))
router.put('/checkups/:id', authMiddleware(USER_TYPES.MOBILE), asyncRoute(updateCheckupHandler))
router.get('/content/banners', asyncRoute(bannersHandler))
router.get('/content/terms', asyncRoute(termsHandler))
router.get('/config/profile-fields', asyncRoute(async (req, res) => {
  const config = await getProfileFieldConfig()
  success(res, { config })
}))
router.post('/analytics/track', publicTrackLimiter, asyncRoute(trackHandler))
router.use('/', authMiddleware(USER_TYPES.MOBILE), questionnaireRoutes)

module.exports = router