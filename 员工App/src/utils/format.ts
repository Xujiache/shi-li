/**
 * 通用格式化 helper：日期、相对时间、手机号脱敏。
 */
import dayjs from 'dayjs'

/** 输入：ISO 字符串 / 时间戳 / Date；输出 YYYY-MM-DD HH:mm */
export function fmtDateTime(s: any, pattern = 'YYYY-MM-DD HH:mm'): string {
  if (!s) return ''
  const d = dayjs(s)
  if (!d.isValid()) return ''
  return d.format(pattern)
}

/** 简易相对时间，不依赖 dayjs/relativeTime 插件 */
export function fmtRelativeTime(s: any): string {
  if (!s) return ''
  const d = dayjs(s)
  if (!d.isValid()) return ''
  const diff = Date.now() - d.valueOf()
  const abs = Math.abs(diff)
  const future = diff < 0
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour
  const week = 7 * day
  let txt = ''
  if (abs < min) txt = '刚刚'
  else if (abs < hour) txt = `${Math.floor(abs / min)} 分钟`
  else if (abs < day) txt = `${Math.floor(abs / hour)} 小时`
  else if (abs < week) txt = `${Math.floor(abs / day)} 天`
  else if (abs < 30 * day) txt = `${Math.floor(abs / week)} 周`
  else return d.format('YYYY-MM-DD')
  if (txt === '刚刚') return txt
  return future ? `${txt}后` : `${txt}前`
}

/** 手机号脱敏：138****1234 */
export function fmtPhone(s: any): string {
  if (!s) return ''
  const str = String(s)
  if (!/^1\d{10}$/.test(str)) return str
  return str.slice(0, 3) + '****' + str.slice(7)
}
