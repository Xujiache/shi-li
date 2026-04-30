const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { isSuperAdmin } = require('../middlewares/permission')
const {
  listQuestionnaires,
  getQuestionnaireDetail,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  copyQuestionnaire,
  updateQuestionnaireStatus
} = require('../../services/questionnaireService')
const {
  listQuestionnaireSubmissionsForAdmin,
  getQuestionnaireSubmissionDetail,
  exportQuestionnaireSubmissions
} = require('../../services/questionnaireSubmissionService')

/**
 * 获取问卷列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function questionnaireListHandler(req, res) {
  const result = await listQuestionnaires(req.query)
  success(res, result)
}

/**
 * 获取问卷详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function questionnaireDetailHandler(req, res) {
  const detail = await getQuestionnaireDetail(req.params.id)
  success(res, detail)
}

/**
 * 创建问卷。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function createQuestionnaireHandler(req, res) {
  const detail = await createQuestionnaire(req.body || {})
  success(res, detail, '问卷创建成功')
}

/**
 * 更新问卷。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function updateQuestionnaireHandler(req, res) {
  const detail = await updateQuestionnaire(req.params.id, req.body || {})
  success(res, detail, '问卷更新成功')
}

/**
 * 删除问卷。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function deleteQuestionnaireHandler(req, res) {
  await deleteQuestionnaire(req.params.id)
  success(res, null, '问卷删除成功')
}

/**
 * 复制问卷。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function copyQuestionnaireHandler(req, res) {
  const detail = await copyQuestionnaire(req.params.id)
  success(res, detail, '问卷复制成功')
}

/**
 * 修改问卷状态。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function questionnaireStatusHandler(req, res) {
  const detail = await updateQuestionnaireStatus(req.params.id, req.body || {})
  success(res, detail, '问卷状态已更新')
}

/**
 * 获取问卷填写列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submissionListHandler(req, res) {
  const result = await listQuestionnaireSubmissionsForAdmin(req.query)
  success(res, result)
}

/**
 * 获取问卷填写详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submissionDetailHandler(req, res) {
  const detail = await getQuestionnaireSubmissionDetail(req.params.submissionId)
  success(res, detail)
}

/**
 * 导出问卷填写数据。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submissionExportHandler(req, res) {
  const rows = await exportQuestionnaireSubmissions(req.query)
  success(res, { rows })
}

// 读接口所有 admin 都能访问
router.get('/questionnaires', asyncRoute(questionnaireListHandler))
router.get('/questionnaires/:id', asyncRoute(questionnaireDetailHandler))
// 写接口仅 super_admin
router.post('/questionnaires', isSuperAdmin, asyncRoute(createQuestionnaireHandler))
router.put('/questionnaires/:id', isSuperAdmin, asyncRoute(updateQuestionnaireHandler))
router.delete('/questionnaires/:id', isSuperAdmin, asyncRoute(deleteQuestionnaireHandler))
router.post('/questionnaires/:id/copy', isSuperAdmin, asyncRoute(copyQuestionnaireHandler))
router.put('/questionnaires/:id/status', isSuperAdmin, asyncRoute(questionnaireStatusHandler))

// 提交数据：列表/详情普通 admin 可查；导出仅 super_admin（包含 PII）
router.get('/questionnaire-submissions', asyncRoute(submissionListHandler))
router.get('/questionnaire-submissions/export', isSuperAdmin, asyncRoute(submissionExportHandler))
router.get('/questionnaire-submissions/:submissionId', asyncRoute(submissionDetailHandler))

module.exports = router
