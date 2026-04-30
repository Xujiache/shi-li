/**
 * 员工 APP — 孩子档案。
 *
 * 路由（/api/v1/employee/children/*）：
 *   GET  /                    我部门归属的孩子列表（多对多 child_dept_assignments）
 *   GET  /:id                 详情 + 本部门可编辑 sections / fields
 *   PUT  /:id                 仅授权字段会保存，其他静默丢弃（dropped_fields 返回）
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { logEmployeeAction } = require('../../middlewares/auditLog')
const {
  listChildrenForEmployee,
  getChildDetailForEmployee,
  updateChildByEmployee
} = require('../../services/childService')
const childGrantService = require('../../services/childGrantService')
const aiAnalysisService = require('../../services/aiAnalysisService')
const { createAppError } = require('../../utils/appError')
const { aiCorrectionLimiter } = require('../../middlewares/rateLimit')

/**
 * 校验员工部门是否被分配该孩子。
 *   requireFieldGrant=true 时还要求该部门至少有一条字段组授权（用于人工分析写权限）。
 * @returns {Promise<void>}
 */
async function ensureChildAccessForEmployee(actor, childId, opts = {}) {
  if (!actor || !actor.department_id) {
    throw createAppError('当前账号未绑定部门', 403)
  }
  const childDepts = await childGrantService.listDeptsByChild(childId)
  if (!childDepts.includes(Number(actor.department_id))) {
    throw createAppError('该孩子档案未分配给当前部门', 403)
  }
  if (opts.requireFieldGrant) {
    const editable = await childGrantService.resolveEditableFields(actor.department_id)
    if (!editable.allowed_section_keys.length) {
      throw createAppError('当前部门没有字段授权，无法写入分析', 403)
    }
  }
}

function normalizeSelectedOptions(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string') {
        return { label: item, source: 'selected' }
      }
      if (typeof item === 'object') {
        return {
          code: item.code,
          label: item.label || item.text || item.title,
          source: item.source || 'selected'
        }
      }
      return null
    })
    .filter(Boolean)
}

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listChildrenForEmployee(req.user, req.query || {})
    success(res, result)
  })
)

router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const result = await getChildDetailForEmployee(req.user, req.params.id)
    success(res, result)
  })
)

router.put(
  '/:id',
  logEmployeeAction('update', 'child_profile'),
  asyncRoute(async (req, res) => {
    const result = await updateChildByEmployee(req.user, req.params.id, req.body || {})
    const msg =
      result.dropped_fields.length > 0
        ? '保存成功（部分字段无授权已丢弃）'
        : '保存成功'
    success(res, result, msg)
  })
)

// ===== 孩子档案 AI / 人工分析 =====

/**
 * 列出某孩子的分析历史 + 当前展示分析（按 admin 配置的 mode）。
 */
router.get(
  '/:id/analyses',
  asyncRoute(async (req, res) => {
    await ensureChildAccessForEmployee(req.user, req.params.id)
    const [config, list, current] = await Promise.all([
      aiAnalysisService.getConfig(),
      aiAnalysisService.listAnalysesByChild(req.params.id),
      aiAnalysisService.getEmployeeDisplayAnalysis(req.params.id, { employee_id: req.user && req.user.id })
    ])
    success(res, {
      mode: config.mode,
      current,
      list
    })
  })
)

/**
 * 员工写一条人工分析。
 *   要求当前部门至少有一组字段授权（防止“零授权部门”也能写诊断）。
 */
router.post(
  '/:id/analyses',
  logEmployeeAction('create', 'child_analysis'),
  asyncRoute(async (req, res) => {
    await ensureChildAccessForEmployee(req.user, req.params.id, { requireFieldGrant: true })
    const analysis = await aiAnalysisService.createHumanAnalysis({
      child_id: req.params.id,
      content: (req.body && req.body.content) || '',
      employee_id: req.user.id
    })
    success(res, { analysis }, '已保存')
  })
)

/**
 * 员工在 AI 报告基础上编辑内容后，先获取一组“为什么修改”的追问。
 */
router.post(
  '/:id/analyses/:analysisId/correction-prompt',
  aiCorrectionLimiter,
  asyncRoute(async (req, res) => {
    await ensureChildAccessForEmployee(req.user, req.params.id, { requireFieldGrant: true })
    const prompt = await aiAnalysisService.generateCorrectionPrompt({
      child_id: req.params.id,
      analysis_id: req.params.analysisId,
      edited_content: req.body && req.body.edited_content,
      employee_id: req.user && req.user.id
    })
    success(res, prompt)
  })
)

/**
 * 员工提交 AI 报告修订版 + 修改原因。
 */
router.post(
  '/:id/analyses/:analysisId/corrections',
  logEmployeeAction('create', 'child_analysis_correction'),
  asyncRoute(async (req, res) => {
    await ensureChildAccessForEmployee(req.user, req.params.id, { requireFieldGrant: true })
    const result = await aiAnalysisService.createAnalysisCorrection({
      child_id: req.params.id,
      analysis_id: req.params.analysisId,
      edited_content: req.body && req.body.edited_content,
      selected_options: normalizeSelectedOptions(req.body && req.body.selected_options),
      custom_reason: req.body && req.body.custom_reason,
      question_prompt: req.body && req.body.question_prompt,
      question_summary: req.body && req.body.question_summary,
      generated_options: normalizeSelectedOptions(req.body && req.body.generated_options),
      employee_id: req.user.id
    })
    success(res, result, '修订已保存')
  })
)

module.exports = router
