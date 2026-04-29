/**
 * bench-customers-list: GET /api/v1/employee/customers?page=1&page_size=200
 *
 * 步骤：
 *   1. 走完首登改密拿到一枚干净 staff token
 *   2. 并发 8、总 1000 GET 列表
 *   3. 跑完 finalize() 把 staff 密码 reset 回 Init@2025
 *
 * 阈值：p95 ≤ 800ms（TASK 硬指标）
 */
const { runBench, httpRequest } = require('./lib/runner')
const { getStaffWorkingToken } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 800, errorRate: 0.01 }

async function main() {
  const ctx = await getStaffWorkingToken()
  const token = ctx.token

  const result = await runBench({
    name: 'customers-list',
    concurrency: 8,
    total: 1000,
    warmup: 10,
    requestFn: async (seq) => {
      const r = await httpRequest({
        method: 'GET',
        path: '/api/v1/employee/customers?page=1&page_size=200',
        headers: { Authorization: 'Bearer ' + token }
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
    console.error('bench-customers-list error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
