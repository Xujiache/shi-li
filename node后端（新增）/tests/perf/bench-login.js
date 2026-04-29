/**
 * bench-login: POST /api/v1/employee/auth/login
 *
 * 步骤：
 *   1. 用 admin 把 staff 密码 reset 回 Init@2025
 *   2. 并发 10、总 200 次 login（每次都是新 device_id，模拟纯 bcrypt 校验耗时）
 *   3. 跑完再 reset 一次确保后续脚本可继续用 Init@2025
 *
 * 阈值：p95 ≤ 1500ms（bcrypt 慢，已放宽）；error_rate ≤ 5%
 */
const { runBench, httpRequest } = require('./lib/runner')
const { adminLogin, resetStaffPassword, STAFF_PHONE, STAFF_PASSWORD } = require('./lib/helpers')

const THRESHOLDS = { p95Ms: 1500, errorRate: 0.05 }

async function main() {
  const adminToken = await adminLogin()
  await resetStaffPassword(adminToken, 1)

  const result = await runBench({
    name: 'login',
    concurrency: 10,
    total: 200,
    warmup: 5,
    requestFn: async (seq) => {
      const r = await httpRequest({
        method: 'POST',
        path: '/api/v1/employee/auth/login',
        body: {
          phone: STAFF_PHONE,
          password: STAFF_PASSWORD,
          device_id: 'perf-login-' + seq + '-' + Date.now(),
          device_info: 'perf-bench-login'
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

  // 跑完再 reset 一次（保险）
  try {
    const t2 = await adminLogin()
    await resetStaffPassword(t2, 1)
  } catch (e) {
    // 不阻断
  }

  result.thresholds = THRESHOLDS
  result.passed = (result.latency.p95 <= THRESHOLDS.p95Ms) && (result.errorRate <= THRESHOLDS.errorRate)
  return result
}

if (require.main === module) {
  main().then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.passed ? 0 : 1)
  }).catch((err) => {
    console.error('bench-login error:', err && err.stack || err)
    process.exit(2)
  })
}

module.exports = main
