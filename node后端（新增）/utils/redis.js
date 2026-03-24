const { createClient } = require('redis')
const config = require('../config')
const logger = require('./logger')

const redisConfig = {
  socket: {
    host: config.redis.host,
    port: config.redis.port
  }
}

if (config.redis.password && config.redis.password.trim() !== '') {
  redisConfig.password = config.redis.password
}

const redisClient = createClient(redisConfig)

redisClient.on('error', (error) => {
  logger.error(`Redis错误: ${error.message}`)
})

/**
 * 按配置决定是否连接 Redis。
 * @returns {Promise<boolean>} 是否成功建立或跳过连接。
 */
async function connectRedis() {
  if (!config.redis.enabled) {
    logger.info('Redis未启用，跳过连接')
    return true
  }

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect()
    }
    logger.info('Redis连接成功')
    return true
  } catch (error) {
    logger.warn(`Redis连接失败，继续以无缓存模式运行: ${error.message}`)
    return true
  }
}

/**
 * 在服务关闭时断开 Redis 连接。
 * @returns {Promise<void>}
 */
async function disconnectRedis() {
  if (!redisClient.isOpen) return
  try {
    await redisClient.disconnect()
    logger.info('Redis断开连接')
  } catch (error) {
    logger.error(`Redis断开连接失败: ${error.message}`)
  }
}

module.exports = {
  redisClient,
  connectRedis,
  disconnectRedis
}