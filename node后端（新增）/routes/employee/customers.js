/**
 * 员工 App 客户管理路由。
 * 全部挂载在 /api/v1/employee/customers
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { createAppError } = require('../../utils/appError')
const { logEmployeeAction } = require('../../middlewares/auditLog')
const {
  listCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  searchCustomers,
  setCustomerReminder,
  listAttachments,
  listLinkedChildrenForEmployee,
  addAttachment,
  deleteAttachment
} = require('../../services/customerService')

// ===== 列表 / 创建 =====
router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listCustomers(req.user, req.query)
    success(res, result)
  })
)

router.post(
  '/',
  logEmployeeAction('create', 'customer'),
  asyncRoute(async (req, res) => {
    const result = await createCustomer(req.user, req.body || {})
    success(res, result, result.status === 'duplicate' ? '已存在该客户' : '创建成功')
  })
)

// ===== 搜索（必须放在 /:id 之前）=====
router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const list = await searchCustomers(req.user, req.query.q || '')
    success(res, { list })
  })
)

// ===== 详情 / 更新 / 删除 =====
router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const customer = await getCustomerDetail(req.user, req.params.id)
    success(res, { customer })
  })
)

router.put(
  '/:id',
  logEmployeeAction('update', 'customer'),
  asyncRoute(async (req, res) => {
    const result = await updateCustomer(req.user, req.params.id, req.body || {})
    if (result && result.status === 'conflict') {
      // 客户端根据 409 + current_payload 走冲突 UI
      throw Object.assign(createAppError('数据冲突', 409), {
        data: {
          status: 'conflict',
          current_payload: result.current_payload,
          current_version: result.current_version
        }
      })
    }
    success(res, result, '更新成功')
  })
)

router.delete(
  '/:id',
  logEmployeeAction('delete', 'customer'),
  asyncRoute(async (req, res) => {
    const result = await softDeleteCustomer(req.user, req.params.id)
    success(res, result, '已删除')
  })
)

// ===== 跟进提醒 =====
router.put(
  '/:id/reminder',
  asyncRoute(async (req, res) => {
    const customer = await setCustomerReminder(req.user, req.params.id, req.body || {})
    success(res, { customer }, '提醒已更新')
  })
)

// ===== 附件 =====
router.get(
  '/:id/attachments',
  asyncRoute(async (req, res) => {
    const list = await listAttachments(req.user, req.params.id)
    success(res, { list })
  })
)

router.post(
  '/:id/attachments',
  logEmployeeAction('create', 'customer_attachment'),
  asyncRoute(async (req, res) => {
    const attachment = await addAttachment(req.user, req.params.id, req.body || {})
    success(res, { attachment }, '附件已添加')
  })
)

router.delete(
  '/:id/attachments/:aid',
  logEmployeeAction('delete', 'customer_attachment'),
  asyncRoute(async (req, res) => {
    const result = await deleteAttachment(req.user, req.params.id, req.params.aid)
    success(res, result, '附件已删除')
  })
)

// ===== 关联孩子档案（按手机号匹配 + 部门授权过滤）=====
router.get(
  '/:id/linked-children',
  asyncRoute(async (req, res) => {
    const list = await listLinkedChildrenForEmployee(req.user, req.params.id)
    success(res, { list })
  })
)

module.exports = router
