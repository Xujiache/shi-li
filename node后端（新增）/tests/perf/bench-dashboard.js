/**
 * bench-dashboard: GET /api/v1/employee/dashboard/me
 *
 * 步骤：
 *   1. 拿干净 staff token
 *   2. 并发 10、总 500 次 GET
 *   3. finalize
 *
 * 阈值：p95 ≤ 500ms
 */
const { runBench, httpRequest } = require('./lib/runner')
const { getStaffWorkingToken } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 500, errorRate: 0.01 }

async function main() {
  const ctx = await getStaffWorkingToken()
  const token = ctx.token

  const result = await runBench({
    name: 'dashboard-me',
    concurrency: 10,
    total: 500,
    warmup: 10,
    requestFn: async (seq) => {
      const r = await httpRequest({
        method: 'GET',
        path: '/api/v1/employee/dashboard/me',
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
    console.error('bench-dashboard error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
