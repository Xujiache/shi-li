const fs = require('fs')
const path = require('path')

/**
 * 归一化分页参数。
 * @param {unknown} page 页码。
 * @param {unknown} pageSize 每页数量。
 * @param {number} [defaultSize=20] 默认每页数量。
 * @returns {{page: number, pageSize: number, offset: number}} 分页结果。
 */
function normalizePagination(page, pageSize, defaultSize = 20) {
  const safePage = Math.max(Number.parseInt(page || '1', 10) || 1, 1)
  const safePageSize = Math.min(Math.max(Number.parseInt(pageSize || `${defaultSize}`, 10) || defaultSize, 1), 100)
  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize
  }
}

/**
 * 将任意值转为布尔。
 * @param {unknown} value 待转换值。
 * @param {boolean} [fallback=false] 默认值。
 * @returns {boolean} 布尔结果。
 */
function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

/**
 * 安全解析 JSON 字符串。
 * @param {unknown} value 待解析值。
 * @param {unknown} [fallback={}] 失败时默认值。
 * @returns {unknown} 解析结果。
 */
function safeJsonParse(value, fallback = {}) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

/**
 * 将对象序列化为 JSON 字符串。
 * @param {unknown} value 待序列化值。
 * @returns {string} JSON 字符串。
 */
function safeJsonStringify(value) {
  return JSON.stringify(value === undefined ? {} : value)
}

/**
 * 生成指定长度的随机数字编号。
 * @param {number} [length=8] 编号长度。
 * @returns {string} 数字编号。
 */
function generateNumericCode(length = 8) {
  let result = ''
  for (let index = 0; index < length; index += 1) {
    const min = index === 0 ? 1 : 0
    result += String(Math.floor(Math.random() * (10 - min)) + min)
  }
  return result
}

/**
 * 确保目录存在，不存在时自动创建。
 * @param {string} targetDir 目标目录。
 * @returns {void}
 */
function ensureDirectory(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
}

/**
 * 基于业务前缀与文件名拼接存储路径。
 * @param {string} prefix 业务前缀。
 * @param {string} filename 文件名。
 * @returns {string} 相对路径。
 */
function buildRelativeFilePath(prefix, filename) {
  const normalizedPrefix = String(prefix || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalizedPrefix ? path.posix.join(normalizedPrefix, filename) : filename
}

/**
 * 将 Date 对象格式化为本地 YYYY-MM-DD 字符串。
 * @param {Date|string|null|undefined} value 日期值。
 * @returns {string} 日期字符串。
 */
function formatDateOnly(value) {
  if (!value) return ''
  if (!(value instanceof Date)) return String(value)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const GRADE_CN_LIST = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

/**
 * 将中文或阿拉伯数字年级文本转为数字级别。
 * @param {string|number|null|undefined} value 年级文本或数字。
 * @returns {number|null} 年级数字级别。
 */
function gradeNameToLevel(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const text = String(value).trim()
  const digitMatch = text.match(/(\d{1,2})/)
  if (digitMatch) {
    const level = Number.parseInt(digitMatch[1], 10)
    return Number.isFinite(level) ? level : null
  }

  for (let index = GRADE_CN_LIST.length - 1; index >= 0; index -= 1) {
    const cn = GRADE_CN_LIST[index]
    if (text.includes(cn)) return index + 1
  }
  return null
}

/**
 * 将数字级别转为标准中文年级名。
 * @param {number|null|undefined} level 年级级别。
 * @returns {string} 中文年级名。
 */
function gradeLevelToName(level) {
  const safeLevel = Number(level)
  if (!Number.isFinite(safeLevel) || safeLevel <= 0 || safeLevel > GRADE_CN_LIST.length) return ''
  return `${GRADE_CN_LIST[safeLevel - 1]}年级`
}

/**
 * 从任意年级/班级文本里提取标准年级名与级别。
 * @param {string|null|undefined} text 待解析文本。
 * @returns {{ grade_name: string, grade_level: number|null }} 提取结果。
 */
function parseGradeInfo(text) {
  const level = gradeNameToLevel(text)
  return {
    grade_name: gradeLevelToName(level),
    grade_level: level
  }
}

/**
 * 判断某个年级是否命中给定年级范围。
 * @param {string|null|undefined} gradeName 年级名称。
 * @param {number|null|undefined} gradeMin 起始年级。
 * @param {number|null|undefined} gradeMax 结束年级。
 * @returns {boolean} 是否命中。
 */
function isGradeMatched(gradeName, gradeMin, gradeMax) {
  const level = gradeNameToLevel(gradeName)
  if (!level) return false
  const min = gradeMin != null ? Number(gradeMin) : null
  const max = gradeMax != null ? Number(gradeMax) : null
  if (min != null && level < min) return false
  if (max != null && level > max) return false
  return true
}

module.exports = {
  normalizePagination,
  toBoolean,
  safeJsonParse,
  safeJsonStringify,
  generateNumericCode,
  ensureDirectory,
  buildRelativeFilePath,
  formatDateOnly,
  gradeNameToLevel,
  gradeLevelToName,
  parseGradeInfo,
  isGradeMatched
}
