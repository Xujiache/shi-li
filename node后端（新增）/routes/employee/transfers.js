/**
 * 员工 App 客户转出审批路由。
 * 挂载在 /api/v1/employee/customer-transfers
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { requireEmployeeRole } = require('../middlewares/permission')
const { logEmployeeAction } = require('../../middlewares/auditLog')
const {
  submitTransfer,
  listMineTransfers,
  listPendingTransfers,
  approveTransfer,
  rejectTransfer
} = require('../../services/transferService')

// ===== 提交转出 =====
router.post(
  '/',
  asyncRoute(async (req, res) => {
    const result = await submitTransfer(req.user, req.body || {})
    success(res, result, result && result.status === 'duplicate' ? '已存在该转出申请' : '提交成功')
  })
)

// ===== 我的转出 =====
router.get(
  '/mine',
  asyncRoute(async (req, res) => {
    const result = await listMineTransfers(req.user, req.query)
    success(res, result)
  })
)

// ===== 待审批（manager） =====
router.get(
  '/pending',
  requireEmployeeRole('manager'),
  asyncRoute(async (req, res) => {
    const result = await listPendingTransfers(req.user, req.query)
    success(res, result)
  })
)

// ===== 审批通过 =====
router.put(
  '/:id/approve',
  requireEmployeeRole('manager'),
  logEmployeeAction('approve', 'customer_transfer'),
  asyncRoute(async (req, res) => {
    const transfer = await approveTransfer(req.user, req.params.id, req.body || {})
    success(res, { transfer }, '已通过')
  })
)

// ===== 驳回 =====
router.put(
  '/:id/reject',
  requireEmployeeRole('manager'),
  logEmployeeAction('reject', 'customer_transfer'),
  asyncRoute(async (req, res) => {
    const transfer = await rejectTransfer(req.user, req.params.id, req.body || {})
    success(res, { transfer }, '已驳回')
  })
)

module.exports = router
