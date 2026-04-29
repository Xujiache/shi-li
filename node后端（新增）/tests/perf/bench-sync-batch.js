/**
 * bench-sync-batch: POST /api/v1/employee/sync/batch
 *
 * 步骤：
 *   1. 拿干净 staff token
 *   2. 并发 5、总 50 批，每批 10 个 customer create op，client_uuid='perf-sync-<batch>-<i>'
 *   3. SQL 删除 client_uuid LIKE 'perf-sync-%' 的 customers
 *
 * 阈值：p95 ≤ 5000ms（批量写，预算放宽）
 */
const { runBench, httpRequest } = require('./lib/runner')
const { getStaffWorkingToken, mysqlExec } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 5000, errorRate: 0.02 }
const OPS_PER_BATCH = 10

async function main() {
  const ctx = await getStaffWorkingToken()
  const token = ctx.token

  // 提前清理潜在脏数据
  try { mysqlExec("UPDATE customers SET active = 0, deleted = 1 WHERE client_uuid LIKE 'perf-sync-%'") } catch (_) {}

  const runStamp = Date.now()

  const result = await runBench({
    name: 'sync-batch',
    concurrency: 5,
    total: 50,
    warmup: 2,
    requestFn: async (seq) => {
      const ops = []
      for (let i = 0; i < OPS_PER_BATCH; i += 1) {
        const uuid = 'perf-sync-' + runStamp + '-' + seq + '-' + i
        ops.push({
          op: 'create',
          type: 'customer',
          client_uuid: uuid,
          payload: {
            display_name: 'Perf Sync ' + seq + '-' + i,
            phone: '139' + String(runStamp).slice(-6) + String(seq).padStart(2, '0') + String(i),
            client_uuid: uuid,
            status: 'potential',
            level: 'C',
            gender: 'unknown'
          }
        })
      }
      const r = await httpRequest({
        method: 'POST',
        path: '/api/v1/employee/sync/batch',
        headers: { Authorization: 'Bearer ' + token },
        body: { ops },
        timeoutMs: 60000
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

  // 数据清理：直接物理删，避免污染列表统计
  let matched = 0
  let remaining = 0
  try {
    matched = Number(mysqlExec("SELECT COUNT(*) FROM customers WHERE client_uuid LIKE 'perf-sync-%'")) || 0
    mysqlExec("DELETE FROM customers WHERE client_uuid LIKE 'perf-sync-%'")
    remaining = Number(mysqlExec("SELECT COUNT(*) FROM customers WHERE client_uuid LIKE 'perf-sync-%'")) || 0
  } catch (e) {
    matched = -1
    remaining = -1
  }
  result.cleanup = { matchedBeforeDelete: matched, remainingAfterDelete: remaining }

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
    console.error('bench-sync-batch error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
