const { request } = require('./request')

/**
 * 注册移动端用户。
 * @param {{phone: string, password: string}} payload 注册参数。
 * @returns {Promise<any>} 注册结果。
 */
function registerMobile(payload) {
  return request({
    method: 'POST',
    path: '/mobile/auth/register',
    auth: false,
    data: payload
  })
}

/**
 * 使用手机号登录。
 * @param {{phone: string, password: string}} payload 登录参数。
 * @returns {Promise<any>} 登录结果。
 */
function loginMobile(payload) {
  return request({
    method: 'POST',
    path: '/mobile/auth/login',
    auth: false,
    data: payload
  })
}

/**
 * 使用微信 code 登录。
 * @param {{code: string}} payload 微信登录参数。
 * @returns {Promise<any>} 登录结果。
 */
function loginWechat(payload) {
  return request({
    method: 'POST',
    path: '/mobile/auth/wechat-login',
    auth: false,
    data: payload
  })
}

/**
 * 获取协议配置。
 * @returns {Promise<any>} 协议内容。
 */
function getTerms() {
  return request({
    method: 'GET',
    path: '/mobile/content/terms',
    auth: false
  })
}

/**
 * 获取轮播图列表。
 * @returns {Promise<any>} 轮播图数据。
 */
function getBanners() {
  return request({
    method: 'GET',
    path: '/mobile/content/banners',
    auth: false
  })
}

/**
 * 获取当前用户资料。
 * @returns {Promise<any>} 用户资料。
 */
function getUserProfile() {
  return request({
    method: 'GET',
    path: '/mobile/user/profile'
  })
}

/**
 * 更新当前用户资料。
 * @param {Record<string, any>} payload 更新字段。
 * @returns {Promise<any>} 更新后的资料。
 */
function updateUserProfile(payload) {
  return request({
    method: 'PUT',
    path: '/mobile/user/profile',
    data: payload
  })
}

/**
 * 获取当前用户孩子列表。
 * @returns {Promise<any>} 孩子列表。
 */
function getChildren() {
  return request({
    method: 'GET',
    path: '/mobile/children'
  })
}

/**
 * 获取学校班级选项。
 * @returns {Promise<any>} 学校班级选项。
 */
function getSchoolOptions() {
  return request({
    method: 'GET',
    path: '/mobile/children/school-options'
  })
}

/**
 * 创建孩子档案。
 * @param {Record<string, any>} payload 档案字段。
 * @returns {Promise<any>} 创建结果。
 */
function createChild(payload) {
  return request({
    method: 'POST',
    path: '/mobile/children',
    data: payload
  })
}

/**
 * 更新孩子档案。
 * @param {string|number} childId 孩子 ID。
 * @param {Record<string, any>} payload 档案字段。
 * @returns {Promise<any>} 更新结果。
 */
function updateChild(childId, payload) {
  return request({
    method: 'PUT',
    path: `/mobile/children/${childId}`,
    data: payload
  })
}

/**
 * 删除孩子档案。
 * @param {string|number} childId 孩子 ID。
 * @returns {Promise<any>} 删除结果。
 */
function deleteChild(childId) {
  return request({
    method: 'DELETE',
    path: `/mobile/children/${childId}`
  })
}

/**
 * 获取预约项目列表。
 * @returns {Promise<any>} 项目列表。
 */
function getAppointmentItems() {
  return request({
    method: 'GET',
    path: '/mobile/appointments/items'
  })
}

/**
 * 获取预约排班列表。
 * @param {string|number} itemId 项目 ID。
 * @returns {Promise<any>} 排班列表。
 */
function getAppointmentSchedules(itemId) {
  return request({
    method: 'GET',
    path: `/mobile/appointments/schedules?item_id=${encodeURIComponent(itemId)}`
  })
}

/**
 * 提交预约。
 * @param {Record<string, any>} payload 预约参数。
 * @returns {Promise<any>} 预约结果。
 */
function createAppointment(payload) {
  return request({
    method: 'POST',
    path: '/mobile/appointments/bookings',
    data: payload
  })
}

/**
 * 获取预约记录列表。
 * @param {string|number} [childId] 孩子 ID。
 * @returns {Promise<any>} 预约记录列表。
 */
function getAppointmentRecords(childId) {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : ''
  return request({
    method: 'GET',
    path: `/mobile/appointments/bookings${suffix}`
  })
}

/**
 * 获取检测记录列表。
 * @param {string|number} childId 孩子 ID。
 * @returns {Promise<any>} 检测记录列表。
 */
function getCheckupRecords(childId) {
  return request({
    method: 'GET',
    path: `/mobile/checkups?child_id=${encodeURIComponent(childId)}`
  })
}

/**
 * 获取检测记录详情。
 * @param {string|number} recordId 记录 ID。
 * @returns {Promise<any>} 检测记录详情。
 */
function getCheckupRecord(recordId) {
  return request({
    method: 'GET',
    path: `/mobile/checkups/${recordId}`
  })
}

/**
 * 创建检测记录。
 * @param {Record<string, any>} payload 检测记录。
 * @returns {Promise<any>} 创建结果。
 */
function createCheckupRecord(payload) {
  return request({
    method: 'POST',
    path: '/mobile/checkups',
    data: payload
  })
}

/**
 * 更新检测记录。
 * @param {string|number} recordId 记录 ID。
 * @param {Record<string, any>} payload 检测记录。
 * @returns {Promise<any>} 更新结果。
 */
function updateCheckupRecord(recordId, payload) {
  return request({
    method: 'PUT',
    path: `/mobile/checkups/${recordId}`,
    data: payload
  })
}

/**
 * 上报页面访问或点击事件。
 * @param {Record<string, any>} payload 埋点数据。
 * @returns {Promise<any>} 上报结果。
 */
function trackEvent(payload) {
  return request({
    method: 'POST',
    path: '/mobile/analytics/track',
    auth: false,
    data: payload
  })
}

/**
 * 获取当前孩子可填写的问卷中心列表。
 * @param {string|number} childId 孩子 ID。
 * @returns {Promise<any>} 问卷中心列表。
 */
function getQuestionnaires(childId) {
  return request({
    method: 'GET',
    path: `/mobile/questionnaires?child_id=${encodeURIComponent(childId)}`
  })
}

/**
 * 获取问卷详情。
 * @param {string|number} questionnaireId 问卷 ID。
 * @param {string|number} childId 孩子 ID。
 * @returns {Promise<any>} 问卷详情。
 */
function getQuestionnaireDetail(questionnaireId, childId) {
  return request({
    method: 'GET',
    path: `/mobile/questionnaires/${encodeURIComponent(questionnaireId)}?child_id=${encodeURIComponent(childId)}`
  })
}

/**
 * 保存问卷草稿。
 * @param {string|number} questionnaireId 问卷 ID。
 * @param {Record<string, any>} payload 提交数据。
 * @returns {Promise<any>} 草稿保存结果。
 */
function saveQuestionnaireDraft(questionnaireId, payload) {
  return request({
    method: 'POST',
    path: `/mobile/questionnaires/${encodeURIComponent(questionnaireId)}/draft`,
    data: payload
  })
}

/**
 * 提交问卷。
 * @param {string|number} questionnaireId 问卷 ID。
 * @param {Record<string, any>} payload 提交数据。
 * @returns {Promise<any>} 提交结果。
 */
function submitQuestionnaire(questionnaireId, payload) {
  return request({
    method: 'POST',
    path: `/mobile/questionnaires/${encodeURIComponent(questionnaireId)}/submit`,
    data: payload
  })
}

/**
 * 获取某问卷的我的填写历史。
 * @param {string|number} questionnaireId 问卷 ID。
 * @param {string|number} childId 孩子 ID。
 * @returns {Promise<any>} 提交历史。
 */
function getQuestionnaireSubmissions(questionnaireId, childId) {
  return request({
    method: 'GET',
    path: `/mobile/questionnaires/${encodeURIComponent(questionnaireId)}/submissions?child_id=${encodeURIComponent(childId)}`
  })
}

/**
 * 获取单条问卷填写详情。
 * @param {string|number} submissionId 提交记录 ID。
 * @returns {Promise<any>} 填写详情。
 */
function getQuestionnaireSubmissionDetail(submissionId) {
  return request({
    method: 'GET',
    path: `/mobile/questionnaire-submissions/${encodeURIComponent(submissionId)}`
  })
}

function getProfileFieldConfig() {
  return request({
    method: 'GET',
    path: '/mobile/config/profile-fields'
  })
}

module.exports = {
  registerMobile,
  loginMobile,
  loginWechat,
  getTerms,
  getBanners,
  getProfileFieldConfig,
  getUserProfile,
  updateUserProfile,
  getChildren,
  getSchoolOptions,
  createChild,
  updateChild,
  deleteChild,
  getAppointmentItems,
  getAppointmentSchedules,
  createAppointment,
  getAppointmentRecords,
  getCheckupRecords,
  getCheckupRecord,
  createCheckupRecord,
  updateCheckupRecord,
  trackEvent,
  getQuestionnaires,
  getQuestionnaireDetail,
  saveQuestionnaireDraft,
  submitQuestionnaire,
  getQuestionnaireSubmissions,
  getQuestionnaireSubmissionDetail
}
