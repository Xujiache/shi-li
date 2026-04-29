/**
 * Admin — AI 分析配置 + 孩子档案分析历史 / 触发生成 / 撤回 / 修订反馈查看。
 */
const express = require('express')
const router = express.Router()
const { success } = require('../../utils/response')
const { asyncRoute } = require('../../utils/asyncRoute')
const { isSuperAdmin } = require('../middlewares/permission')
const { logAdminAction } = require('../../middlewares/adminLog')
const aiAnalysisService = require('../../services/aiAnalysisService')

router.get(
  '/ai-analysis/config',
  asyncRoute(async (req, res) => {
    const config = await aiAnalysisService.getConfig()
    success(res, { config })
  })
)

router.put(
  '/ai-analysis/config',
  isSuperAdmin,
  logAdminAction('update', 'ai_analysis_config'),
  asyncRoute(async (req, res) => {
    const config = await aiAnalysisService.setConfig(req.body || {})
    success(res, { config }, '已保存')
  })
)

router.get(
  '/children/:id/analyses',
  asyncRoute(async (req, res) => {
    const config = await aiAnalysisService.getConfig()
    const list = await aiAnalysisService.listAnalysesByChild(req.params.id, { onlyActive: false })
    const current = await aiAnalysisService.getDisplayAnalysis(req.params.id, { allow_generate: false })
    success(res, { mode: config.mode, list, current })
  })
)

router.post(
  '/children/:id/analyses',
  isSuperAdmin,
  logAdminAction('create', 'child_analysis'),
  asyncRoute(async (req, res) => {
    const analysis = await aiAnalysisService.createHumanAnalysis({
      child_id: req.params.id,
      content: (req.body && req.body.content) || '',
      admin_id: req.user && req.user.id
    })
    success(res, { analysis }, '已保存')
  })
)

router.post(
  '/children/:id/analyses/generate',
  isSuperAdmin,
  logAdminAction('generate', 'child_analysis'),
  asyncRoute(async (req, res) => {
    const analysis = await aiAnalysisService.generateAiAnalysis(req.params.id, {
      actor_admin_id: req.user && req.user.id
    })
    success(res, { analysis }, 'AI 分析已生成')
  })
)

router.delete(
  '/analyses/:id',
  isSuperAdmin,
  logAdminAction('delete', 'child_analysis'),
  asyncRoute(async (req, res) => {
    const result = await aiAnalysisService.deactivateAnalysis(req.params.id)
    success(res, result, '已撤回')
  })
)

router.get(
  '/ai-analysis/corrections',
  asyncRoute(async (req, res) => {
    const result = await aiAnalysisService.listCorrections(req.query || {})
    success(res, result)
  })
)

router.get(
  '/ai-analysis/corrections/stats',
  asyncRoute(async (req, res) => {
    const stats = await aiAnalysisService.getCorrectionReasonStats()
    success(res, { stats })
  })
)

// ===== Style Pack（AI 风格知识包）=====

router.get(
  '/ai-analysis/style-pack',
  asyncRoute(async (req, res) => {
    const [active, history] = await Promise.all([
      aiAnalysisService.getActiveStylePack(),
      aiAnalysisService.listStylePacks()
    ])
    success(res, { active, history })
  })
)

router.post(
  '/ai-analysis/style-pack/regenerate',
  isSuperAdmin,
  logAdminAction('generate', 'ai_style_pack'),
  asyncRoute(async (req, res) => {
    const pack = await aiAnalysisService.regenerateStylePack({
      model: req.body && req.body.model
    })
    success(res, { pack }, '风格包已蒸馏（v' + pack.version + '）')
  })
)

module.exports = router
