const { execute } = require('../utils/db')
const logger = require('../utils/logger')

/**
 * 通用审计日志中间件工厂。
 * 同时服务于 admin 与 employee 两套写操作场景，写入 admin_operation_logs 表
 * （表已扩 operator_type 字段区分两套来源）。
 *
 * @param {string} action 操作类型 (create/update/delete/export 等)
 * @param {string} resource 资源类型 (employee/customer/follow_up 等)
 * @param {Object} [options]
 * @param {('admin'|'employee')} [options.operatorType='admin'] 操作人类型
 * @returns {Function} Express 中间件
 */
function logAuditAction(action, resource, options = {}) {
  const operatorType = options.operatorType === 'employee' ? 'employee' : 'admin'

  return (req, res, next) => {
    const originalJson = res.json.bind(res)

    res.json = function (body) {
      // 仅成功操作才记录
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user || {}
        // 兼容嵌套响应：data.{id | server_id | customer.id | follow_up.id | transfer.id | employee.id | department.id | attachment.id | notification.id}
        const data = body && body.data
        const resourceId = req.params.id || (data && (
          data.id ||
          data.server_id ||
          (data.customer && data.customer.id) ||
          (data.follow_up && data.follow_up.id) ||
          (data.transfer && data.transfer.id) ||
          (data.employee && data.employee.id) ||
          (data.department && data.department.id) ||
          (data.attachment && data.attachment.id) ||
          (data.notification && data.notification.id)
        )) || null

        const detail = {}
        if (action === 'create' || action === 'update') {
          const safeBody = { ...req.body }
          delete safeBody.password
          delete safeBody.password_hash
          delete safeBody.old_password
          delete safeBody.new_password
          detail.body = safeBody
        }
        if (action === 'delete') {
          detail.deleted_id = resourceId
        }

        execute(
          `INSERT INTO admin_operation_logs
            (admin_id, admin_phone, admin_name, operator_type, action, resource, resource_id, detail, ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id || 0,
            user.phone || '',
            user.display_name || '',
            operatorType,
            action,
            resource,
            resourceId ? String(resourceId) : null,
            JSON.stringify(detail),
            req.ip || req.headers['x-real-ip'] || ''
          ]
        ).catch(err => {
          logger.error(`审计日志记录失败 (${operatorType}/${action}/${resource}): ${err.message}`)
        })
      }

      return originalJson(body)
    }

    next()
  }
}

/**
 * 员工 App 写操作审计专用包装。
 * @param {string} action
 * @param {string} resource
 * @returns {Function}
 */
function logEmployeeAction(action, resource) {
  return logAuditAction(action, resource, { operatorType: 'employee' })
}

module.exports = {
  logAuditAction,
  logEmployeeAction
}
