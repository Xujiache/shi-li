/**
 * 员工 App 离线批量同步路由。
 * 挂载在 /api/v1/employee/sync
 *
 * POST /batch  body: { ops: Array<...> }
 */
const express = require('express')
const router = express.Router()
const config = require('../../config')
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { createAppError } = require('../../utils/appError')
const { processBatch } = require('../../services/syncService')

router.post(
  '/batch',
  asyncRoute(async (req, res) => {
    const ops = (req.body && req.body.ops) || null
    if (!Array.isArray(ops)) {
      throw createAppError('ops 必须是数组', 400)
    }
    const max = (config.employee && config.employee.syncBatchMax) || 200
    if (ops.length > max) {
      throw createAppError(`单批次最多 ${max} 条`, 400)
    }
    const result = await processBatch(req.user, ops)
    success(res, result)
  })
)

module.exports = router
