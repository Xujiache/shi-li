const mysql = require('mysql2/promise')
const config = require('../config')
const logger = require('./logger')

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  charset: config.database.charset,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  multipleStatements: false
})

/**
 * 测试数据库连接是否可用。
 * @returns {Promise<boolean>} 是否连接成功。
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    logger.info('数据库连接成功')
    return true
  } catch (error) {
    logger.error(`数据库连接失败: ${error.message}`)
    return false
  }
}

/**
 * 执行查询并返回结果集。
 * @param {string} sql SQL 语句。
 * @param {object|Array<unknown>} [params] 查询参数。
 * @returns {Promise<Array<unknown>>} 查询结果。
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params)
    return rows
  } catch (error) {
    logger.error(`SQL查询失败: ${error.message}`, { sql })
    throw error
  }
}

/**
 * 执行写操作并返回 MySQL Result。
 * @param {string} sql SQL 语句。
 * @param {object|Array<unknown>} [params] 写入参数。
 * @returns {Promise<import('mysql2').ResultSetHeader>} 写操作结果。
 */
async function execute(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params)
    return result
  } catch (error) {
    logger.error(`SQL执行失败: ${error.message}`, { sql })
    throw error
  }
}

/**
 * 查询单条记录。
 * @param {string} sql SQL 语句。
 * @param {object|Array<unknown>} [params] 查询参数。
 * @returns {Promise<unknown|null>} 单条记录或空值。
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

/**
 * 在事务中执行数据库逻辑。
 * @param {(connection: import('mysql2/promise').PoolConnection) => Promise<unknown>} callback 事务回调。
 * @returns {Promise<unknown>} 回调返回值。
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    logger.error(`事务执行失败: ${error.message}`)
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  pool,
  query,
  execute,
  queryOne,
  testConnection,
  withTransaction
}