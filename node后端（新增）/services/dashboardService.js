const { query, queryOne } = require('../utils/db')

/**
 * 计算百分比变化。
 * @param {number} current 当前值。
 * @param {number} previous 对比值。
 * @returns {string} 百分比变化字符串。
 */
function pctChange(current, previous) {
  const c = Number(current || 0)
  const p = Number(previous || 0)
  if (p <= 0) return c > 0 ? '+100%' : '+0%'
  const result = Math.round(((c - p) / p) * 100)
  return `${result >= 0 ? '+' : ''}${result}%`
}

/**
 * 统计某条 SQL 的数量结果。
 * @param {string} sql SQL 语句。
 * @param {Array<unknown>} [params=[]] 查询参数。
 * @returns {Promise<number>} 统计值。
 */
async function countBySql(sql, params = []) {
  const row = await queryOne(sql, params)
  return row ? Number(row.total || 0) : 0
}

/**
 * 获取后台仪表盘统计数据。
 * @returns {Promise<Record<string, any>>} 仪表盘数据。
 */
async function getDashboardStats() {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const onlineWindowMs = 5 * 60 * 1000

  const totalUsers = await countBySql('SELECT COUNT(*) AS total FROM users WHERE deleted = 0')
  const totalChildren = await countBySql('SELECT COUNT(*) AS total FROM children')
  const totalAppointments = await countBySql('SELECT COUNT(*) AS total FROM appointment_records')
  const totalCheckups = await countBySql('SELECT COUNT(*) AS total FROM checkup_records')

  const newUsers7d = await countBySql('SELECT COUNT(*) AS total FROM users WHERE deleted = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
  const newUsersPrev7d = await countBySql(
    'SELECT COUNT(*) AS total FROM users WHERE deleted = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
  )

  const totalVisits = await countBySql("SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'page_view'")
  const totalClicks = await countBySql("SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'click'")
  const onlineVisitors = await countBySql('SELECT COUNT(*) AS total FROM analytics_visitors WHERE last_seen_ms >= ?', [
    now - onlineWindowMs
  ])

  const visits7d = await countBySql(
    "SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'page_view' AND created_at_ms >= ?",
    [now - 7 * day]
  )
  const visitsPrev7d = await countBySql(
    "SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'page_view' AND created_at_ms >= ? AND created_at_ms < ?",
    [now - 14 * day, now - 7 * day]
  )
  const clicks7d = await countBySql(
    "SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'click' AND created_at_ms >= ?",
    [now - 7 * day]
  )
  const clicksPrev7d = await countBySql(
    "SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'click' AND created_at_ms >= ? AND created_at_ms < ?",
    [now - 14 * day, now - 7 * day]
  )

  const xAxis = []
  const series = []
  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    start.setMonth(start.getMonth() - index)

    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)

    const total = await countBySql(
      "SELECT COUNT(*) AS total FROM analytics_events WHERE event_type = 'page_view' AND created_at_ms >= ? AND created_at_ms < ?",
      [start.getTime(), end.getTime()]
    )
    xAxis.push(`${start.getMonth() + 1}月`)
    series.push(total)
  }

  const newUsersRows = await query(
    `
      SELECT id, phone, display_name, avatar_url, created_at
      FROM users
      WHERE deleted = 0
      ORDER BY created_at DESC
      LIMIT 8
    `
  )

  const dynamicsRows = await query(
    `
      SELECT e.event_type, e.event_name, e.page_path, e.visitor_key, u.display_name, u.phone
      FROM analytics_events e
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at_ms DESC
      LIMIT 10
    `
  )

  return {
    cards: {
      total_visits: totalVisits,
      online_visitors: onlineVisitors,
      click_count: totalClicks || totalVisits,
      new_users_7d: newUsers7d
    },
    changes: {
      total_visits: pctChange(visits7d, visitsPrev7d),
      click_count: pctChange(clicks7d, clicksPrev7d),
      new_users_7d: pctChange(newUsers7d, newUsersPrev7d)
    },
    overview: {
      total_users: totalUsers,
      total_children: totalChildren,
      total_appointments: totalAppointments,
      total_checkups: totalCheckups
    },
    visits_series: {
      xAxis,
      data: series
    },
    new_users_list: newUsersRows.map((row) => ({
      user_id: String(row.id),
      phone: row.phone || '',
      display_name: row.display_name || '',
      avatar_file_id: row.avatar_url || '',
      avatar_url: row.avatar_url || '',
      created_at: row.created_at
    })),
    dynamics: dynamicsRows.map((row) => ({
      username: row.display_name || row.phone || row.visitor_key || '访客',
      type: row.event_type === 'click' ? '点击了' : '访问了',
      target: row.page_path || row.event_name || '未知页面'
    }))
  }
}

module.exports = {
  getDashboardStats
}
