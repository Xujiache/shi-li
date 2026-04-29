/**
 * 员工 App 跟进记录路由。
 * 挂载在 /api/v1/employee/follow-ups
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { logEmployeeAction } = require('../../middlewares/auditLog')
const {
  listFollowUps,
  getFollowUpDetail,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  shareFollowUp
} = require('../../services/followUpService')

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listFollowUps(req.user, req.query)
    success(res, result)
  })
)

router.post(
  '/',
  logEmployeeAction('create', 'follow_up'),
  asyncRoute(async (req, res) => {
    const result = await createFollowUp(req.user, req.body || {})
    success(res, result, result && result.status === 'duplicate' ? '已存在该跟进' : '创建成功')
  })
)

router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const followUp = await getFollowUpDetail(req.user, req.params.id)
    success(res, { follow_up: followUp })
  })
)

router.put(
  '/:id',
  logEmployeeAction('update', 'follow_up'),
  asyncRoute(async (req, res) => {
    const result = await updateFollowUp(req.user, req.params.id, req.body || {})
    success(res, result, '更新成功')
  })
)

router.delete(
  '/:id',
  logEmployeeAction('delete', 'follow_up'),
  asyncRoute(async (req, res) => {
    const result = await deleteFollowUp(req.user, req.params.id)
    success(res, result, '已删除')
  })
)

router.post(
  '/:id/share',
  logEmployeeAction('share', 'follow_up'),
  asyncRoute(async (req, res) => {
    const result = await shareFollowUp(
      req.user,
      req.params.id,
      req.body && req.body.target_employee_id
    )
    success(res, result, '已分享给同事')
  })
)

module.exports = router
