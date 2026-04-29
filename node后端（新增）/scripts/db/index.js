const logger = require('../../utils/logger')
const { createCoreTables, createEmployeeAppTables } = require('./core')

/**
 * 初始化所有业务数据库表。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接实例。
 * @returns {Promise<boolean>} 是否初始化成功。
 */
async function initAllTables(connection) {
  try {
    logger.info('开始初始化所有数据库表...')
    await createCoreTables(connection)
    await createEmployeeAppTables(connection)
    logger.info('所有数据库表初始化完成')
    return true
  } catch (error) {
    logger.error(`数据库表初始化失败: ${error.message}`)
    return false
  }
}

module.exports = {
  initAllTables
}