/**
 * 跟进提醒定时扫描：
 *   每分钟扫一次 customers.next_follow_up_at <= NOW() 且未提醒过的客户，
 *   推送 type='follow_up_reminder' 通知给 assigned_employee_id，
 *   并把 customers.reminded_at 置为 NOW() 防重复。
 *
 * 设计要点：
 *   - 不引 node-cron，setInterval 即可，单进程 PM2 模式下不会重复触发
 *   - 单次扫描封顶 200 条，避免一次推送暴冲
 *   - reminded_at < next_follow_up_at 表示用户后来又改了下次跟进时间，需要重新提醒一次
 */
const logger = require('../utils/logger')
const { query, execute } = require('../utils/db')
const { pushNotification } = require('../services/notificationService')

const SCAN_INTERVAL_MS = 60_000
const BATCH_LIMIT = 200

let timer = null
let scanning = false

/**
 * 单次扫描：返回处理条数。
 * @returns {Promise<number>}
 */
async function scanOnce() {
  if (scanning) return 0
  scanning = true
  try {
    const rows = await query(
      `SELECT id, assigned_employee_id, display_name, next_follow_up_at, next_follow_up_text
       FROM customers
       WHERE active = 1
         AND assigned_employee_id IS NOT NULL
         AND next_follow_up_at IS NOT NULL
         AND next_follow_up_at <= NOW()
         AND (reminded_at IS NULL OR reminded_at < next_follow_up_at)
       ORDER BY next_follow_up_at ASC
       LIMIT ${Number(BATCH_LIMIT)}`,
      []
    )
    let n = 0
    for (const row of rows) {
      try {
        const empId = Number(row.assigned_employee_id)
        if (!empId) continue
        const name = String(row.display_name || '').trim() || '客户'
        const noteText = String(row.next_follow_up_text || '').slice(0, 100)
        await pushNotification({
          employee_id: empId,
          type: 'follow_up_reminder',
          title: `跟进提醒：${name}`,
          body: noteText ? `提醒内容：${noteText}` : '到了预设的跟进时间，请尽快跟进客户。',
          payload: {
            customer_id: Number(row.id),
            next_follow_up_at: row.next_follow_up_at
          }
        })
        await execute('UPDATE customers SET reminded_at = NOW() WHERE id = ?', [row.id])
        n += 1
      } catch (err) {
        // 单条失败不阻塞批量
        logger.warn(`followUpReminder: customer ${row.id} push failed: ${err && err.message}`)
      }
    }
    if (n > 0) {
      logger.info(`followUpReminder: pushed ${n} reminders`)
    }
    return n
  } catch (err) {
    logger.error(`followUpReminder scan failed: ${err && err.message}`)
    return 0
  } finally {
    scanning = false
  }
}

/**
 * 启动定时器。
 */
function start() {
  if (timer) return
  // 启动后立即跑一次（防止 PM2 重启遗漏的提醒）
  setTimeout(() => { scanOnce().catch(() => {}) }, 5000)
  timer = setInterval(() => { scanOnce().catch(() => {}) }, SCAN_INTERVAL_MS)
  logger.info(`followUpReminder started (interval=${SCAN_INTERVAL_MS}ms)`)
}

/**
 * 停止定时器（测试 / 进程退出用）。
 */
function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

module.exports = {
  start,
  stop,
  scanOnce
}
