/**
 * 包装异步路由处理函数，统一透传异常到错误中间件。
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>} handler 异步处理函数。
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void} Express 路由函数。
 */
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

module.exports = {
  asyncRoute
}
