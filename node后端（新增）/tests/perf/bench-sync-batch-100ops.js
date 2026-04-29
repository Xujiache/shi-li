/**
 * bench-sync-batch-100ops: POST /api/v1/employee/sync/batch（100 ops 单包压测，对齐 TASK §3.4）
 *
 * 与 bench-sync-batch 区别：每批 100 个 customer create op，跑 10 批 × 并发 3
 *   → 命中 TASK §3.4 第 3 行字面"同步 100 条 ops ≤ 5s"的硬指标
 *
 * 阈值：p95 ≤ 5000ms（单批 100 op 写入）
 */
const { runBench, httpRequest } = require('./lib/runner')
const { getStaffWorkingToken, mysqlExec } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 5000, errorRate: 0.02 }
const OPS_PER_BATCH = 100

async function main() {
  const ctx = await getStaffWorkingToken()
  const token = ctx.token

  try { mysqlExec("UPDATE customers SET active = 0, deleted = 1 WHERE client_uuid LIKE 'perf-sync100-%'") } catch (_) {}

  const runStamp = Date.now()

  const result = await runBench({
    name: 'sync-batch-100ops',
    concurrency: 3,
    total: 10,
    warmup: 1,
    requestFn: async (seq) => {
      const ops = []
      for (let i = 0; i < OPS_PER_BATCH; i += 1) {
        const uuid = 'perf-sync100-' + runStamp + '-' + seq + '-' + i
        ops.push({
          op: 'create',
          type: 'customer',
          client_uuid: uuid,
          payload: {
            display_name: 'Perf 100ops ' + seq + '-' + i,
            phone: '138' + String(runStamp).slice(-6) + String(seq).padStart(2, '0') + String(i % 10),
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
        timeoutMs: 90000
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
  let matched = 0
  let remaining = 0
  try {
    matched = Number(mysqlExec("SELECT COUNT(*) FROM customers WHERE client_uuid LIKE 'perf-sync100-%'")) || 0
    mysqlExec("DELETE FROM customers WHERE client_uuid LIKE 'perf-sync100-%'")
    remaining = Number(mysqlExec("SELECT COUNT(*) FROM customers WHERE client_uuid LIKE 'perf-sync100-%'")) || 0
  } catch (e) {
    matched = -1
    remaining = -1
  }
  result.cleanup = { matchedBeforeDelete: matched, remainingAfterDelete: remaining }
  result.opsPerBatch = OPS_PER_BATCH

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
    console.error('bench-sync-batch-100ops error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
