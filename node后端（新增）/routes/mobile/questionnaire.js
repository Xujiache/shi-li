const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { createAppError } = require('../../utils/appError')
const { findChildById, ensureChildOwnership } = require('../../services/childService')
const { listQuestionnairesForMobile } = require('../../services/questionnaireService')
const {
  getMobileQuestionnaireDetail,
  saveQuestionnaireSubmission,
  listMyQuestionnaireSubmissions,
  getQuestionnaireSubmissionDetail
} = require('../../services/questionnaireSubmissionService')

/**
 * 获取当前请求上下文中的孩子对象。
 * @param {import('express').Request} req Express 请求对象。
 * @returns {Promise<Record<string, any>>} 当前孩子对象。
 */
async function getCurrentChild(req) {
  const childId = req.query.child_id || req.body.child_id
  if (!childId) {
    throw createAppError('缺少孩子 ID', StatusCodes.BAD_REQUEST)
  }
  const child = await findChildById(childId)
  ensureChildOwnership(child, req.user.id)
  return child
}

/**
 * 获取问卷中心列表。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function questionnaireListHandler(req, res) {
  const child = await getCurrentChild(req)
  const list = await listQuestionnairesForMobile(req.user, {
    ...child,
    _id: String(child.id),
    id: child.id
  })
  success(res, { list })
}

/**
 * 获取问卷详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function questionnaireDetailHandler(req, res) {
  const child = await getCurrentChild(req)
  const detail = await getMobileQuestionnaireDetail(req.params.id, req.user, {
    ...child,
    _id: String(child.id),
    id: child.id
  })
  success(res, detail)
}

/**
 * 保存问卷草稿。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function saveDraftHandler(req, res) {
  const child = await getCurrentChild(req)
  const detail = await saveQuestionnaireSubmission(
    req.params.id,
    req.user,
    {
      ...child,
      _id: String(child.id),
      id: child.id
    },
    req.body || {},
    'draft'
  )
  success(res, detail, '草稿已保存')
}

/**
 * 提交问卷。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submitHandler(req, res) {
  const child = await getCurrentChild(req)
  const detail = await saveQuestionnaireSubmission(
    req.params.id,
    req.user,
    {
      ...child,
      _id: String(child.id),
      id: child.id
    },
    req.body || {},
    'submitted'
  )
  success(res, detail, '问卷提交成功')
}

/**
 * 获取当前问卷的历史提交记录。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submissionHistoryHandler(req, res) {
  const child = await getCurrentChild(req)
  const list = await listMyQuestionnaireSubmissions(req.params.id, req.user, {
    ...child,
    _id: String(child.id),
    id: child.id
  })
  success(res, { list })
}

/**
 * 获取单条提交详情。
 * @param {import('express').Request} req Express 请求对象。
 * @param {import('express').Response} res Express 响应对象。
 * @returns {Promise<void>}
 */
async function submissionDetailHandler(req, res) {
  const detail = await getQuestionnaireSubmissionDetail(req.params.submissionId)
  if (String(detail.submission.user_id) !== String(req.user.id)) {
    throw createAppError('无权限查看该问卷填写记录', StatusCodes.FORBIDDEN)
  }
  success(res, detail)
}

router.get('/questionnaires', asyncRoute(questionnaireListHandler))
router.get('/questionnaires/:id', asyncRoute(questionnaireDetailHandler))
router.post('/questionnaires/:id/draft', asyncRoute(saveDraftHandler))
router.post('/questionnaires/:id/submit', asyncRoute(submitHandler))
router.get('/questionnaires/:id/submissions', asyncRoute(submissionHistoryHandler))
router.get('/questionnaire-submissions/:submissionId', asyncRoute(submissionDetailHandler))

module.exports = router
