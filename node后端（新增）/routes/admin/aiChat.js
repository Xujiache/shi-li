/**
 * Admin — AI 对话（长上下文）。
 *   GET    /ai-chat/conversations
 *   POST   /ai-chat/conversations
 *   PUT    /ai-chat/conversations/:id
 *   DELETE /ai-chat/conversations/:id
 *   POST   /ai-chat/conversations/:id/clear   清空消息但保留会话
 *   GET    /ai-chat/conversations/:id/messages
 *   POST   /ai-chat/conversations/:id/messages   发送一条用户消息并取回 AI 回复
 */
const express = require('express')
const router = express.Router()
const { asyncRoute } = require('../../utils/asyncRoute')
const { success } = require('../../utils/response')
const { aiChatLimiter } = require('../../middlewares/rateLimit')
const aiChatService = require('../../services/aiChatService')

router.get(
  '/ai-chat/conversations',
  asyncRoute(async (req, res) => {
    const result = await aiChatService.listConversations(req.user && req.user.id, req.query || {})
    success(res, result)
  })
)

router.post(
  '/ai-chat/conversations',
  asyncRoute(async (req, res) => {
    const conversation = await aiChatService.createConversation(req.user && req.user.id, req.body || {})
    success(res, { conversation }, '已创建')
  })
)

router.put(
  '/ai-chat/conversations/:id',
  asyncRoute(async (req, res) => {
    const conversation = await aiChatService.updateConversation(
      req.user && req.user.id,
      req.params.id,
      req.body || {}
    )
    success(res, { conversation }, '已更新')
  })
)

router.delete(
  '/ai-chat/conversations/:id',
  asyncRoute(async (req, res) => {
    const result = await aiChatService.deleteConversation(req.user && req.user.id, req.params.id)
    success(res, result, '已删除')
  })
)

router.post(
  '/ai-chat/conversations/:id/clear',
  asyncRoute(async (req, res) => {
    const conversation = await aiChatService.clearMessages(req.user && req.user.id, req.params.id)
    success(res, { conversation }, '已清空')
  })
)

router.get(
  '/ai-chat/conversations/:id/messages',
  asyncRoute(async (req, res) => {
    const result = await aiChatService.listMessages(req.user && req.user.id, req.params.id)
    success(res, result)
  })
)

router.post(
  '/ai-chat/conversations/:id/messages',
  aiChatLimiter,
  asyncRoute(async (req, res) => {
    const result = await aiChatService.sendMessage(
      req.user && req.user.id,
      req.params.id,
      req.body && req.body.content
    )
    success(res, result)
  })
)

module.exports = router
