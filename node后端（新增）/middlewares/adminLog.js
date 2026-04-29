/**
 * 历史兼容层：adminLog.js 现统一代理到 auditLog.js。
 * 既有 routes/admin/index.js 等 24 处 require('./adminLog') 不必修改。
 *
 * @deprecated 新代码请直接 require('./auditLog')。
 */
const { logAuditAction } = require('./auditLog')

/**
 * 兼容旧签名 logAdminAction(action, resource)，operator_type 默认 'admin'。
 * @param {string} action
 * @param {string} resource
 * @returns {Function} Express 中间件
 */
function logAdminAction(action, resource) {
  return logAuditAction(action, resource, { operatorType: 'admin' })
}

module.exports = { logAdminAction }
