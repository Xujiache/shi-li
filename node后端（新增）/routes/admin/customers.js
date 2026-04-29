/**
 * 管理后台 — 员工客户管理 / 导出。
 *   GET  /admin/customers                       列表
 *   GET  /admin/customers/export?format=csv     导出 CSV
 *   GET  /admin/customers/:id                   详情
 *   PUT  /admin/customers/:id                   修改（自动推送变更通知给归属员工）
 *
 * 仅 admin token 可访问；导出额外支持 ?token=<jwt> 查询串以便浏览器直接下载。
 */
const express = require('express')
const router = express.Router()
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { isSuperAdmin } = require('../middlewares/permission')
const { logAdminAction } = require('../../middlewares/adminLog')
const {
  listCustomersForAdmin,
  getCustomerDetailForAdmin,
  updateCustomerByAdmin,
  listCustomersForExport
} = require('../../services/customerService')
const { pushNotification } = require('../../services/notificationService')

const FIELD_LABELS = {
  display_name: '姓名',
  phone: '手机号',
  gender: '性别',
  age: '年龄',
  school: '学校',
  class_name: '班级',
  status: '状态',
  level: '等级',
  remark: '备注',
  next_follow_up_at: '下次跟进时间',
  next_follow_up_text: '提醒内容',
  assigned_employee_id: '归属员工',
  tags: '标签'
}

/**
 * 列表。
 */
router.get('/', asyncRoute(async (req, res) => {
  const result = await listCustomersForAdmin(req.query || {})
  success(res, result)
}))

/**
 * 导出 CSV：UTF-8 BOM + ,分隔，Excel 可直接打开。
 * 兼容 ?token=xxx 查询串（浏览器 window.open 时鉴权）。
 */
router.get('/export', asyncRoute(async (req, res) => {
  const rows = await listCustomersForExport(req.query || {})

  const headers = [
    '客户编号', '姓名', '手机号', '性别', '年龄',
    '学校', '班级', '状态', '等级',
    '归属员工', '所属部门',
    '上次跟进时间', '下次跟进时间', '备注',
    '创建时间', '更新时间'
  ]
  const csvLines = [headers.join(',')]

  const escape = (v) => {
    if (v == null) return ''
    let s = String(v)
    if (s.indexOf('"') >= 0) s = s.replace(/"/g, '""')
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
      s = `"${s}"`
    }
    return s
  }

  const fmtDate = (v) => {
    if (!v) return ''
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ')
    return String(v).slice(0, 19).replace('T', ' ')
  }

  const statusZh = { potential: '潜在', interested: '意向', signed: '成交', lost: '流失' }
  const genderZh = { male: '男', female: '女', unknown: '未知' }

  for (const r of rows) {
    csvLines.push([
      escape(r.customer_no || ''),
      escape(r.display_name || ''),
      escape(r.phone || ''),
      escape(genderZh[r.gender] || r.gender || ''),
      escape(r.age != null ? r.age : ''),
      escape(r.school || ''),
      escape(r.class_name || ''),
      escape(statusZh[r.status] || r.status || ''),
      escape(r.level || ''),
      escape(r.assigned_employee_name || ''),
      escape(r.department_name || ''),
      escape(fmtDate(r.last_follow_up_at)),
      escape(fmtDate(r.next_follow_up_at)),
      escape(r.remark || ''),
      escape(fmtDate(r.created_at)),
      escape(fmtDate(r.updated_at))
    ].join(','))
  }

  const ymd = new Date().toISOString().slice(0, 10)
  const filename = `customers-${ymd}.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  // UTF-8 BOM
  res.write('﻿')
  res.write(csvLines.join('\n'))
  res.end()
}))

/**
 * 详情。
 */
router.get('/:id', asyncRoute(async (req, res) => {
  const customer = await getCustomerDetailForAdmin(req.params.id)
  success(res, { customer })
}))

/**
 * 修改 + 推送变更通知。
 */
router.put(
  '/:id',
  isSuperAdmin,
  logAdminAction('update', 'customer'),
  asyncRoute(async (req, res) => {
    const result = await updateCustomerByAdmin(req.params.id, req.body || {})
    const { customer, previous_assigned_employee_id, changed_fields } = result

    // 仅当真有字段变更时推送
    if (changed_fields && changed_fields.length > 0) {
      const newOwner = customer.assigned_employee_id != null ? Number(customer.assigned_employee_id) : null
      const fieldZh = changed_fields.map((f) => FIELD_LABELS[f] || f).join('、')

      const targets = new Set()
      // 重新分配：旧员工 + 新员工都要通知
      if (changed_fields.indexOf('assigned_employee_id') >= 0) {
        if (previous_assigned_employee_id) targets.add(Number(previous_assigned_employee_id))
        if (newOwner) targets.add(Number(newOwner))
      } else if (newOwner) {
        // 普通字段变更：通知当前归属员工
        targets.add(Number(newOwner))
      }

      for (const empId of targets) {
        try {
          let title = ''
          let body = ''
          if (changed_fields.indexOf('assigned_employee_id') >= 0 && Number(empId) === Number(previous_assigned_employee_id)) {
            title = `客户「${customer.display_name}」已被管理员转出`
            body = `该客户不再归属于您，请知悉。`
          } else if (changed_fields.indexOf('assigned_employee_id') >= 0 && Number(empId) === Number(newOwner)) {
            title = `管理员将客户「${customer.display_name}」分配给您`
            body = `请尽快查看并跟进。`
          } else {
            title = `管理员修改了您的客户「${customer.display_name}」`
            body = `变更字段：${fieldZh}`
          }
          await pushNotification({
            employee_id: empId,
            type: 'customer_updated',
            title,
            body,
            payload: {
              customer_id: customer.id,
              changed_fields
            }
          })
        } catch (err) {
          // 单条失败不阻塞主流程
        }
      }
    }

    success(res, { customer }, '更新成功')
  })
)

module.exports = router
