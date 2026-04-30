/**
 * Admin — 全局跟进日志（超级管理员可看所有员工的所有跟进 + 导出 CSV）。
 *   GET  /api/v1/admin/follow-ups                列表
 *   GET  /api/v1/admin/follow-ups/export         导出 CSV
 */
const express = require('express')
const router = express.Router()
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { isSuperAdmin } = require('../middlewares/permission')
const { listFollowUpsForAdmin } = require('../../services/followUpService')

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listFollowUpsForAdmin(req.query || {})
    success(res, result)
  })
)

// 导出条数上限（环境变量可调，默认 50000；硬上限 100000 防 OOM）
const EXPORT_HARD_CAP = 100000
const EXPORT_DEFAULT_LIMIT = Math.min(
  Math.max(1000, Number(process.env.FOLLOW_UPS_EXPORT_MAX) || 50000),
  EXPORT_HARD_CAP
)

router.get(
  '/export',
  isSuperAdmin,
  asyncRoute(async (req, res) => {
    // 允许调用方传 limit 收紧导出范围；不允许超过硬上限
    const reqLimit = Number((req.query || {}).limit)
    const safeLimit = Number.isFinite(reqLimit) && reqLimit > 0
      ? Math.min(reqLimit, EXPORT_DEFAULT_LIMIT)
      : EXPORT_DEFAULT_LIMIT

    // 先快速 count，超过上限直接拒绝并提示收紧筛选
    const totalRow = await require('../../services/followUpService')
      .listFollowUpsForAdmin({ ...(req.query || {}), page: 1, page_size: 1 })
    if (totalRow && Number(totalRow.total) > EXPORT_HARD_CAP) {
      return res.status(400).json({
        code: 400,
        message: `导出范围过大（${totalRow.total} 条 > 上限 ${EXPORT_HARD_CAP}），请加更窄的筛选条件`,
        data: null
      })
    }

    const params = { ...(req.query || {}), page: 1, page_size: safeLimit }
    const result = await listFollowUpsForAdmin(params)
    const TYPE_ZH = { phone: '电话', wechat: '微信', face: '当面', other: '其他' }
    const RESULT_ZH = {
      no_progress: '无进展', interested: '有意向', follow_up: '需复跟',
      signed: '已成交', lost: '已流失'
    }
    const headers = [
      '客户姓名', '客户手机', '跟进员工', '员工手机', '部门',
      '跟进时间', '类型', '结果', '内容', '下次跟进', '创建时间'
    ]
    const escape = (v) => {
      if (v == null) return ''
      let s = String(v)
      if (s.indexOf('"') >= 0) s = s.replace(/"/g, '""')
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) s = `"${s}"`
      return s
    }
    const fmtDate = (v) => {
      if (!v) return ''
      if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ')
      return String(v).slice(0, 19).replace('T', ' ')
    }
    const lines = [headers.join(',')]
    for (const r of result.list) {
      lines.push([
        escape(r.customer_name || ''),
        escape(r.customer_phone || ''),
        escape(r.employee_name || ''),
        escape(r.employee_phone || ''),
        escape(r.department_name || ''),
        escape(fmtDate(r.follow_at)),
        escape(TYPE_ZH[r.type] || r.type || ''),
        escape(RESULT_ZH[r.result] || r.result || ''),
        escape((r.content || '').replace(/\s+/g, ' ').slice(0, 500)),
        escape(fmtDate(r.next_follow_up_at)),
        escape(fmtDate(r.created_at))
      ].join(','))
    }
    const ymd = new Date().toISOString().slice(0, 10)
    const filename = `follow-ups-${ymd}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.write('﻿') // UTF-8 BOM
    res.write(lines.join('\n'))
    res.end()
  })
)

module.exports = router
