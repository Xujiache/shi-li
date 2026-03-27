/**
 * 构造带状态码的业务异常对象。
 * @param {string} message 错误消息。
 * @param {number} statusCode HTTP 状态码。
 * @param {string} [code] 业务错误码。
 * @returns {Error & {statusCode: number, code?: string}} 自定义错误对象。
 */
function createAppError(message, statusCode, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (code) error.code = code
  return error
}

module.exports = {
  createAppError
}
