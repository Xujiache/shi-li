/**
 * 管理后台 — 部门字段组授权 + 孩子档案部门归属。
 *
 * 路由：
 *   GET    /admin/dept-field-grants                    所有部门授权矩阵
 *   GET    /admin/dept-field-grants/:dept_id           某部门已授权 section_keys
 *   PUT    /admin/dept-field-grants/:dept_id           重写 { section_keys: [] }
 *   GET    /admin/children/:id/assignments             某孩子的归属部门
 *   POST   /admin/children/:id/assignments             重写 { dept_ids: [] }
 *
 * 鉴权：admin token + isSuperAdmin（与现有 customers / employees 模块一致）。
 */
const express = require('express')
const router = express.Router()
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { isSuperAdmin } = require('../middlewares/permission')
const { logAdminAction } = require('../../middlewares/adminLog')
const {
  listAllGrants,
  listGrantsByDepartment,
  setDepartmentGrants,
  listDeptsByChild,
  setChildAssignments,
  getAllSections
} = require('../../services/childGrantService')

router.get(
  '/dept-field-grants',
  asyncRoute(async (req, res) => {
    const [grants, sections] = await Promise.all([listAllGrants(), getAllSections()])
    success(res, {
      grants,
      sections: sections.map((s) => ({
        key: s.key,
        label: s.label,
        enabled: s.enabled !== false,
        sort_order: s.sort_order || 0
      }))
    })
  })
)

router.get(
  '/dept-field-grants/:dept_id',
  asyncRoute(async (req, res) => {
    const section_keys = await listGrantsByDepartment(req.params.dept_id)
    success(res, { department_id: Number(req.params.dept_id), section_keys })
  })
)

router.put(
  '/dept-field-grants/:dept_id',
  isSuperAdmin,
  logAdminAction('update', 'dept_field_grant'),
  asyncRoute(async (req, res) => {
    const sectionKeys = (req.body && req.body.section_keys) || []
    const result = await setDepartmentGrants(req.params.dept_id, sectionKeys)
    success(res, result, '已更新部门字段组授权')
  })
)

router.get(
  '/children/:id/assignments',
  asyncRoute(async (req, res) => {
    const dept_ids = await listDeptsByChild(req.params.id)
    success(res, { child_id: Number(req.params.id), department_ids: dept_ids })
  })
)

router.post(
  '/children/:id/assignments',
  isSuperAdmin,
  logAdminAction('update', 'child_assignment'),
  asyncRoute(async (req, res) => {
    const deptIds = (req.body && req.body.dept_ids) || []
    const result = await setChildAssignments(req.params.id, deptIds, req.user && req.user.id)
    success(res, result, '已更新孩子档案归属部门')
  })
)

module.exports = router
