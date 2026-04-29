/**
 * 平台能力探测（不直接 require 任何平台 API，只暴露能力位）。
 *
 * isOfflineCapable：
 *   - APP-PLUS（Android/iOS）→ true（plus.sqlite 可用）
 *   - H5 / MP-WEIXIN → false（仅 in-memory 桩，重载即丢）
 *
 * Wave 2/3 不要直接判断 process.env / 字符串，统一走这里。
 */

/**
 * 当前运行环境是否具备真正的离线持久化能力。
 */
export function isOfflineCapable(): boolean {
  // #ifdef APP-PLUS
  return true
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/**
 * 本地 sqlite 数据库文件名（plus.sqlite 用）。
 */
export function getDbName(): string {
  return 'shi_li_employee.db'
}

/**
 * 数据库 alias（plus.sqlite openDatabase 的 name 参数）。
 * 与 getDbName 区分仅为语义清晰，目前同值。
 */
export function getDbAlias(): string {
  return 'shi_li_employee'
}

/**
 * sqlite 文件落盘路径（仅 APP-PLUS 有意义）。
 * H5 / MP 返回空串。
 */
export function getDbPath(): string {
  // #ifdef APP-PLUS
  return `_doc/${getDbName()}`
  // #endif
  // #ifndef APP-PLUS
  return ''
  // #endif
}
