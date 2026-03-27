const { execute } = require('../utils/db')
const logger = require('../utils/logger')

/**
 * 记录管理员操作日志的中间件工厂。
 * @param {string} action 操作类型 (create/update/delete/export)。
 * @param {string} resource 资源类型 (user/child/checkup 等)。
 * @returns {Function} Express 中间件。
 */
function logAdminAction(action, resource) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)

    res.json = function (body) {
      // 仅在操作成功时记录日志
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user || {}
        const resourceId = req.params.id || (body && body.data && body.data.id) || null

        const detail = {}
        if (action === 'create' || action === 'update') {
          // 记录请求体（排除敏感字段）
          const safeBody = { ...req.body }
          delete safeBody.password
          delete safeBody.password_hash
          detail.body = safeBody
        }
        if (action === 'delete') {
          detail.deleted_id = resourceId
        }

        execute(
          `INSERT INTO admin_operation_logs
            (admin_id, admin_phone, admin_name, action, resource, resource_id, detail, ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id || 0,
            user.phone || '',
            user.display_name || '',
            action,
            resource,
            resourceId ? String(resourceId) : null,
            JSON.stringify(detail),
            req.ip || req.headers['x-real-ip'] || ''
          ]
        ).catch(err => {
          logger.error(`操作日志记录失败: ${err.message}`)
        })
      }

      return originalJson(body)
    }

    next()
  }
}

module.exports = { logAdminAction }
