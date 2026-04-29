/**
 * 客户端 datetime 输入归一化工具。
 *
 * 项目既有约定（utils/response.js 的 formatDate）：
 *   DB 存 UTC，response 阶段统一格式化为 'Asia/Shanghai' 字符串展示。
 * 本 util 处理写入侧：客户端传入的 'YYYY-MM-DD HH:mm:ss' 字符串视为
 * 北京时间，转 UTC 字符串再交给 mysql 存盘。
 *
 * 这样保证：
 *   用户输入 '2026-05-01 10:00:00' (北京) → DB '2026-05-01 02:00:00' (UTC)
 *   → mysql2 读回 Date(UTC) → response.js +8h → API '2026-05-01 10:00:00'
 *
 * 不要在 service / route 里手写 new Date() — 直接调 parseClientDatetime。
 */
const moment = require('moment-timezone')

const CLIENT_TZ = 'Asia/Shanghai'
const STORAGE_FMT = 'YYYY-MM-DD HH:mm:ss'

/**
 * 把客户端传入的 datetime 输入归一化为可写入 mysql 的 UTC 字符串。
 * 兼容多种输入：
 *   - undefined / null / '' → null
 *   - 'YYYY-MM-DD HH:mm:ss'（视为北京时间）
 *   - 'YYYY-MM-DD HH:mm'（视为北京时间，秒补 00）
 *   - 'YYYY-MM-DD'（视为北京时间 00:00:00）
 *   - ISO 8601 带 Z / +08:00 等显式时区 → 直接转 UTC
 *   - JS Date 实例（从 mysql2 读出来的）→ 直接 toUTC
 *
 * @param {string|Date|null|undefined} value 客户端输入
 * @returns {string|null} 'YYYY-MM-DD HH:mm:ss' UTC 字符串，或 null
 */
function parseClientDatetime(value) {
  if (value === undefined || value === null || value === '') return null

  // Date 实例直接走 utc()
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return moment(value).utc().format(STORAGE_FMT)
  }

  const text = String(value).trim()
  if (!text) return null

  // 含明确时区信息（Z / +08:00 / -05:00）的 ISO 字符串
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const m = moment(text)
    if (!m.isValid()) return null
    return m.utc().format(STORAGE_FMT)
  }

  // 否则按 北京时间 解析
  let m = moment.tz(text, [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD'
  ], true, CLIENT_TZ)
  // 严格匹配失败时降级到宽松解析
  if (!m.isValid()) {
    m = moment.tz(text, CLIENT_TZ)
  }
  if (!m.isValid()) return null
  return m.utc().format(STORAGE_FMT)
}

/**
 * 当前 UTC 时间字符串（写入 mysql 用）。
 * @returns {string}
 */
function nowUtcString() {
  return moment().utc().format(STORAGE_FMT)
}

module.exports = {
  parseClientDatetime,
  nowUtcString
}
