const express = require('express')
const router = express.Router()
const authRoutes = require('./auth')
const questionnaireRoutes = require('./questionnaire')
const { authMiddleware, USER_TYPES } = require('../../utils/jwt')
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { hashPassword } = require('../../utils/bcrypt')
const { createAppError } = require('../../utils/appError')
const {
  listUsers,
  getUserDetail,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUser,
  setAdmin
} = require('../../services/userService')
const {
  listChildrenForAdmin,
  getAdminChildDetail,
  createChildByAdmin,
  updateChildByAdmin,
  deleteChildByAdmin
} = require('../../services/childService')
const {
  listSchoolClasses,
  getSchoolClassDetail,
  createSchoolClass,
  updateSchoolClass,
  deleteSchoolClass
} = require('../../services/schoolClassService')
const {
  listBanners,
  getBannerDetail,
  createBanner,
  updateBanner,
  deleteBanner,
  getTermsConfig,
  updateTermsConfig
} = require('../../services/contentService')
const {
  listAppointmentItems,
  getAppointmentItemDetail,
  createAppointmentItem,
  updateAppointmentItem,
  deleteAppointmentItem,
  listAppointmentSchedules,
  getAppointmentScheduleDetail,
  createAppointmentSchedule,
  updateAppointmentSchedule,
  deleteAppointmentSchedule,
  listAppointmentRecordsForAdmin,
  getAppointmentRecordDetail,
  updateAppointmentRecordStatus,
  deleteAppointmentRecord
} = require('../../services/appointmentService')
const {
  listCheckupRecordsForAdmin,
  getCheckupRecordDetail,
  createCheckupRecordByAdmin,
  updateCheckupRecordByAdmin,
  deleteCheckupRecord
} = require('../../services/checkupService')
const { getDashboardStats } = require('../../services/dashboardService')

/**
 * 获取用户列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function usersListHandler(req, res) {
  const result = await listUsers(req.query)
  success(res, result)
}

/**
 * 获取用户详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function userDetailHandler(req, res) {
  const user = await getUserDetail(req.params.id)
  success(res, { user })
}

/**
 * 创建后台用户。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createUserHandler(req, res) {
  const passwordHash = await hashPassword(String(req.body.password || ''))
  const user = await createUserByAdmin({
    ...req.body,
    passwordHash,
    avatar_url: req.body.avatar_url || req.body.avatar_file_id || ''
  })
  success(res, { user }, '创建成功')
}

/**
 * 更新后台用户。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateUserHandler(req, res) {
  const patch = { ...req.body }
  if (patch.password) {
    patch.password_hash = await hashPassword(String(patch.password || ''))
  }
  if (patch.avatar_file_id !== undefined && patch.avatar_url === undefined) {
    patch.avatar_url = patch.avatar_file_id
  }
  const user = await updateUserByAdmin(req.params.id, patch)
  success(res, { user }, '更新成功')
}

/**
 * 删除后台用户。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteUserHandler(req, res) {
  await deleteUser(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 设置管理员状态。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function setAdminHandler(req, res) {
  if (Number(req.user.id) === Number(req.params.id) && !req.body.is_admin) {
    throw createAppError('不允许取消当前管理员自身权限', 400)
  }
  await setAdmin(req.params.id, Boolean(req.body.is_admin))
  success(res, null, '设置成功')
}

/**
 * 获取孩子列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function childrenListHandler(req, res) {
  const result = await listChildrenForAdmin(req.query)
  success(res, result)
}

/**
 * 获取孩子详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function childDetailHandler(req, res) {
  const child = await getAdminChildDetail(req.params.id)
  success(res, { child })
}

/**
 * 创建孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createChildHandler(req, res) {
  const child = await createChildByAdmin(req.body || {})
  success(res, { child }, '创建成功')
}

/**
 * 更新孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateChildHandler(req, res) {
  const child = await updateChildByAdmin(req.params.id, req.body || {})
  success(res, { child }, '更新成功')
}

/**
 * 删除孩子档案。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteChildHandler(req, res) {
  await deleteChildByAdmin(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取学校班级字典列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function schoolClassesListHandler(req, res) {
  const result = await listSchoolClasses(req.query)
  success(res, result)
}

/**
 * 获取学校班级详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function schoolClassDetailHandler(req, res) {
  const row = await getSchoolClassDetail(req.params.id)
  success(res, { row })
}

/**
 * 创建学校班级字典项。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createSchoolClassHandler(req, res) {
  const row = await createSchoolClass(req.body || {})
  success(res, { row }, '创建成功')
}

/**
 * 更新学校班级字典项。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateSchoolClassHandler(req, res) {
  const row = await updateSchoolClass(req.params.id, req.body || {})
  success(res, { row }, '更新成功')
}

/**
 * 删除学校班级字典项。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteSchoolClassHandler(req, res) {
  await deleteSchoolClass(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取轮播图列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function bannersListHandler(req, res) {
  const result = await listBanners(req.query)
  success(res, result)
}

/**
 * 获取轮播图详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function bannerDetailHandler(req, res) {
  const row = await getBannerDetail(req.params.id)
  success(res, { row })
}

/**
 * 创建轮播图。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createBannerHandler(req, res) {
  const row = await createBanner(req.body || {})
  success(res, { row }, '创建成功')
}

/**
 * 更新轮播图。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateBannerHandler(req, res) {
  const row = await updateBanner(req.params.id, req.body || {})
  success(res, { row }, '更新成功')
}

/**
 * 删除轮播图。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteBannerHandler(req, res) {
  await deleteBanner(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取预约项目列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentItemsListHandler(req, res) {
  const result = await listAppointmentItems(req.query)
  success(res, result)
}

/**
 * 获取预约项目详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentItemDetailHandler(req, res) {
  const row = await getAppointmentItemDetail(req.params.id)
  success(res, { row })
}

/**
 * 创建预约项目。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createAppointmentItemHandler(req, res) {
  const row = await createAppointmentItem(req.body || {})
  success(res, { row }, '创建成功')
}

/**
 * 更新预约项目。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateAppointmentItemHandler(req, res) {
  const row = await updateAppointmentItem(req.params.id, req.body || {})
  success(res, { row }, '更新成功')
}

/**
 * 删除预约项目。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteAppointmentItemHandler(req, res) {
  await deleteAppointmentItem(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取预约排班列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentSchedulesListHandler(req, res) {
  const result = await listAppointmentSchedules(req.query)
  success(res, result)
}

/**
 * 获取预约排班详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentScheduleDetailHandler(req, res) {
  const row = await getAppointmentScheduleDetail(req.params.id)
  success(res, { row })
}

/**
 * 创建预约排班。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createAppointmentScheduleHandler(req, res) {
  const row = await createAppointmentSchedule(req.body || {})
  success(res, { row }, '创建成功')
}

/**
 * 更新预约排班。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateAppointmentScheduleHandler(req, res) {
  const row = await updateAppointmentSchedule(req.params.id, req.body || {})
  success(res, { row }, '更新成功')
}

/**
 * 删除预约排班。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteAppointmentScheduleHandler(req, res) {
  await deleteAppointmentSchedule(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取预约记录列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentRecordsListHandler(req, res) {
  const result = await listAppointmentRecordsForAdmin(req.query)
  success(res, result)
}

/**
 * 获取预约记录详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentRecordDetailHandler(req, res) {
  const row = await getAppointmentRecordDetail(req.params.id)
  success(res, { row })
}

/**
 * 更新预约记录状态。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function appointmentRecordStatusHandler(req, res) {
  const row = await updateAppointmentRecordStatus(req.params.id, req.body.status)
  success(res, { row }, '更新成功')
}

/**
 * 删除预约记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteAppointmentRecordHandler(req, res) {
  await deleteAppointmentRecord(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取检测记录列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function checkupRecordsListHandler(req, res) {
  const result = await listCheckupRecordsForAdmin(req.query)
  success(res, result)
}

/**
 * 获取检测记录详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function checkupRecordDetailHandler(req, res) {
  const record = await getCheckupRecordDetail(req.params.id)
  success(res, { record })
}

/**
 * 创建检测记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createCheckupRecordHandler(req, res) {
  const record = await createCheckupRecordByAdmin(req.body || {})
  success(res, { record }, '创建成功')
}

/**
 * 更新检测记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateCheckupRecordHandler(req, res) {
  const record = await updateCheckupRecordByAdmin(req.params.id, req.body || {})
  success(res, { record }, '更新成功')
}

/**
 * 删除检测记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteCheckupRecordHandler(req, res) {
  await deleteCheckupRecord(req.params.id)
  success(res, null, '删除成功')
}

/**
 * 获取协议配置。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function termsGetHandler(req, res) {
  const row = await getTermsConfig()
  success(res, { row })
}

/**
 * 更新协议配置。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function termsUpdateHandler(req, res) {
  const row = await updateTermsConfig(req.body || {})
  success(res, { row }, '保存成功')
}

/**
 * 获取仪表盘数据。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function dashboardStatsHandler(req, res) {
  const stats = await getDashboardStats()
  success(res, stats)
}

router.use('/auth', authRoutes)
router.use(authMiddleware(USER_TYPES.ADMIN))

router.get('/users', asyncRoute(usersListHandler))
router.get('/users/:id', asyncRoute(userDetailHandler))
router.post('/users', asyncRoute(createUserHandler))
router.put('/users/:id', asyncRoute(updateUserHandler))
router.delete('/users/:id', asyncRoute(deleteUserHandler))
router.put('/users/:id/admin', asyncRoute(setAdminHandler))

router.get('/children', asyncRoute(childrenListHandler))
router.get('/children/:id', asyncRoute(childDetailHandler))
router.post('/children', asyncRoute(createChildHandler))
router.put('/children/:id', asyncRoute(updateChildHandler))
router.delete('/children/:id', asyncRoute(deleteChildHandler))

router.get('/school-classes', asyncRoute(schoolClassesListHandler))
router.get('/school-classes/:id', asyncRoute(schoolClassDetailHandler))
router.post('/school-classes', asyncRoute(createSchoolClassHandler))
router.put('/school-classes/:id', asyncRoute(updateSchoolClassHandler))
router.delete('/school-classes/:id', asyncRoute(deleteSchoolClassHandler))

router.get('/banners', asyncRoute(bannersListHandler))
router.get('/banners/:id', asyncRoute(bannerDetailHandler))
router.post('/banners', asyncRoute(createBannerHandler))
router.put('/banners/:id', asyncRoute(updateBannerHandler))
router.delete('/banners/:id', asyncRoute(deleteBannerHandler))

router.get('/appointment-items', asyncRoute(appointmentItemsListHandler))
router.get('/appointment-items/:id', asyncRoute(appointmentItemDetailHandler))
router.post('/appointment-items', asyncRoute(createAppointmentItemHandler))
router.put('/appointment-items/:id', asyncRoute(updateAppointmentItemHandler))
router.delete('/appointment-items/:id', asyncRoute(deleteAppointmentItemHandler))

router.get('/appointment-schedules', asyncRoute(appointmentSchedulesListHandler))
router.get('/appointment-schedules/:id', asyncRoute(appointmentScheduleDetailHandler))
router.post('/appointment-schedules', asyncRoute(createAppointmentScheduleHandler))
router.put('/appointment-schedules/:id', asyncRoute(updateAppointmentScheduleHandler))
router.delete('/appointment-schedules/:id', asyncRoute(deleteAppointmentScheduleHandler))

router.get('/appointment-records', asyncRoute(appointmentRecordsListHandler))
router.get('/appointment-records/:id', asyncRoute(appointmentRecordDetailHandler))
router.put('/appointment-records/:id/status', asyncRoute(appointmentRecordStatusHandler))
router.delete('/appointment-records/:id', asyncRoute(deleteAppointmentRecordHandler))

router.get('/checkup-records', asyncRoute(checkupRecordsListHandler))
router.get('/checkup-records/:id', asyncRoute(checkupRecordDetailHandler))
router.post('/checkup-records', asyncRoute(createCheckupRecordHandler))
router.put('/checkup-records/:id', asyncRoute(updateCheckupRecordHandler))
router.delete('/checkup-records/:id', asyncRoute(deleteCheckupRecordHandler))

router.get('/system-config/terms', asyncRoute(termsGetHandler))
router.put('/system-config/terms', asyncRoute(termsUpdateHandler))

router.get('/dashboard/stats', asyncRoute(dashboardStatsHandler))
router.use('/', questionnaireRoutes)

module.exports = router