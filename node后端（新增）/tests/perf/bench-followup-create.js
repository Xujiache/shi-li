/**
 * bench-followup-create: POST /api/v1/employee/follow-ups
 *
 * 步骤：
 *   1. 拿干净 staff token + 找到/创建一个属于 staff 的 customer
 *   2. 并发 8、总 200 次 create，每条 client_uuid='perf-fu-<seq>'
 *   3. 用 mysql 命令行 SQL 删掉 client_uuid LIKE 'perf-fu-%' 的记录
 *
 * 阈值：p95 ≤ 600ms
 */
const { runBench, httpRequest } = require('./lib/runner')
const { getStaffWorkingToken, ensureStaffCustomerId, mysqlExec } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 600, errorRate: 0.02 }

async function main() {
  const ctx = await getStaffWorkingToken()
  const token = ctx.token
  const customerId = await ensureStaffCustomerId(token)

  // 防止多次跑积压脏数据
  try { mysqlExec("DELETE FROM follow_ups WHERE client_uuid LIKE 'perf-fu-%'") } catch (_) {}

  const result = await runBench({
    name: 'followup-create',
    concurrency: 8,
    total: 200,
    warmup: 5,
    requestFn: async (seq) => {
      const uuid = 'perf-fu-' + seq + '-' + Date.now()
      const r = await httpRequest({
        method: 'POST',
        path: '/api/v1/employee/follow-ups',
        headers: { Authorization: 'Bearer ' + token },
        body: {
          customer_id: customerId,
          type: 'phone',
          result: 'follow_up',
          content: '压测自动跟进 #' + seq,
          client_uuid: uuid
        }
      })
      const ok = r.statusCode === 200 && r.json && r.json.code === 200
      return {
        ok,
        latencyMs: r.latencyMs,
        status: r.statusCode,
        error: ok ? null : (r.error || (r.json && r.json.message) || 'bad_response')
      }
    }
  })

  // 数据清理
  let cleanedCount = 0
  let remaining = 0
  try {
    cleanedCount = Number(mysqlExec("SELECT COUNT(*) FROM follow_ups WHERE client_uuid LIKE 'perf-fu-%'")) || 0
    mysqlExec("DELETE FROM follow_ups WHERE client_uuid LIKE 'perf-fu-%'")
    remaining = Number(mysqlExec("SELECT COUNT(*) FROM follow_ups WHERE client_uuid LIKE 'perf-fu-%'")) || 0
  } catch (e) {
    cleanedCount = -1
    remaining = -1
  }
  result.cleanup = { matchedBeforeDelete: cleanedCount, remainingAfterDelete: remaining }

  try { await ctx.finalize() } catch (_) {}

  result.thresholds = THRESHOLDS
  result.passed = (result.latency.p95 <= THRESHOLDS.p95Ms) && (result.errorRate <= THRESHOLDS.errorRate)
  return result
}

if (require.main === module) {
  main().then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.passed ? 0 : 1)
  }).catch((err) => {
    console.error('bench-followup-create error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
