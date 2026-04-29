const app = require('./app')
const config = require('./config')
const logger = require('./utils/logger')
const { testConnection } = require('./utils/db')
const { connectRedis } = require('./utils/redis')
const { checkAndReleasePort } = require('./utils/portCheck')
const followUpReminder = require('./jobs/followUpReminder')

/**
 * 启动 HTTP 服务。
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    const portAvailable = await checkAndReleasePort(config.server.port)
    if (!portAvailable) {
      logger.error(`无法释放端口 ${config.server.port}，服务器启动失败`)
      process.exit(1)
    }

    const dbConnected = await testConnection()
    if (!dbConnected) {
      logger.error('数据库连接失败，服务器启动失败')
      process.exit(1)
    }

    await connectRedis()

    app.listen(config.server.port, config.server.host, () => {
      logger.info(`服务器在 ${config.server.host}:${config.server.port} 启动成功 (${config.server.env}模式)`)
      logger.info(`API基地址: ${config.server.publicUrl}`)
      // 启动跟进提醒定时任务（每分钟扫一次 customers.next_follow_up_at）
      try {
        followUpReminder.start()
      } catch (err) {
        logger.error(`followUpReminder 启动失败: ${err && err.message}`)
      }
    })
  } catch (error) {
    logger.error(`服务器启动失败: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 处理未捕获异常并中止服务。
 * @param {Error} error 未捕获的异常。
 * @returns {void}
 */
function handleUncaughtException(error) {
  logger.error(`未捕获的异常: ${error.message}`)
  logger.error(error.stack)
  process.exit(1)
}

/**
 * 处理未处理的 Promise 拒绝。
 * @param {unknown} reason 拒绝原因。
 * @returns {void}
 */
function handleUnhandledRejection(reason) {
  logger.error('未处理的Promise拒绝', { reason })
}

process.on('uncaughtException', handleUncaughtException)
process.on('unhandledRejection', handleUnhandledRejection)

startServer()