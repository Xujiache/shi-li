/**
 * 轻量自实现 autocannon-lite 压测器内核（无外部 npm 依赖）。
 *
 * 仅依赖 node 内置模块，提供：
 *   - http.Agent 长连接复用（提升吞吐稳定性）
 *   - Promise pool 控制并发
 *   - 收集 latency / status / error，输出 p50/p90/p95/p99/min/max/mean、RPS、error_rate
 *
 * 使用示例：
 *
 *   const { runBench, httpRequest } = require('./lib/runner')
 *   const result = await runBench({
 *     name: 'foo',
 *     concurrency: 8,
 *     total: 200,
 *     warmup: 10,
 *     requestFn: async (seq) => {
 *       const r = await httpRequest({ method: 'GET', path: '/api/v1/employee/dashboard/me', headers: { Authorization: 'Bearer xxx' } })
 *       return { ok: r.statusCode >= 200 && r.statusCode < 400, latencyMs: r.latencyMs, status: r.statusCode, error: r.error }
 *     }
 *   })
 */
const http = require('http')

const DEFAULT_HOST = process.env.PERF_HOST || '127.0.0.1'
const DEFAULT_PORT = Number(process.env.PERF_PORT) || 3100

// 共享长连接池：keepAlive 让连接复用，maxSockets 与并发同量级即可
const sharedAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 30000
})

/**
 * 发送一次 HTTP 请求并返回 { statusCode, latencyMs, body, error }。
 * @param {{method?:string, path:string, headers?:Object, body?:any, host?:string, port?:number, timeoutMs?:number}} opts
 */
function httpRequest(opts) {
  const method = (opts.method || 'GET').toUpperCase()
  const headers = Object.assign({}, opts.headers || {})
  let bodyBuf = null
  if (opts.body != null) {
    if (typeof opts.body === 'string' || Buffer.isBuffer(opts.body)) {
      bodyBuf = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body)
    } else {
      bodyBuf = Buffer.from(JSON.stringify(opts.body))
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
    }
    headers['Content-Length'] = bodyBuf.length
  }
  const start = process.hrtime.bigint()
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: opts.host || DEFAULT_HOST,
        port: opts.port || DEFAULT_PORT,
        method,
        path: opts.path,
        headers,
        agent: sharedAgent
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const latencyMs = Number(process.hrtime.bigint() - start) / 1e6
          let body = Buffer.concat(chunks).toString('utf8')
          let parsed = null
          try { parsed = JSON.parse(body) } catch (_) { parsed = null }
          resolve({ statusCode: res.statusCode, latencyMs, body, json: parsed, error: null })
        })
      }
    )
    req.setTimeout(opts.timeoutMs || 30000, () => {
      req.destroy(new Error('request_timeout'))
    })
    req.on('error', (err) => {
      const latencyMs = Number(process.hrtime.bigint() - start) / 1e6
      resolve({ statusCode: 0, latencyMs, body: '', json: null, error: err.message })
    })
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

/**
 * 计算分位数（输入数组会被原地排序）。
 * @param {number[]} sortedArr 已升序排序的数组。
 * @param {number} p 0~1。
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0
  const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.ceil(p * sortedArr.length) - 1))
  return sortedArr[idx]
}

function summarize(latencies) {
  const sorted = latencies.slice().sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    p50: round(percentile(sorted, 0.5)),
    p90: round(percentile(sorted, 0.9)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    min: round(sorted[0] || 0),
    max: round(sorted[sorted.length - 1] || 0),
    mean: round(sorted.length ? sum / sorted.length : 0)
  }
}

function round(v) { return Math.round(v * 100) / 100 }

/**
 * 运行一次压测。
 * @param {{name:string, concurrency:number, total:number, warmup?:number,
 *          requestFn:(seq:number)=>Promise<{ok:boolean,latencyMs:number,status:number,error?:string}>}} cfg
 */
async function runBench(cfg) {
  const { name, concurrency, total, requestFn } = cfg
  const warmup = cfg.warmup || 0

  // warmup（不计入统计），失败也不报错
  for (let i = 0; i < warmup; i += 1) {
    try { await requestFn(-1 - i) } catch (_) {}
  }

  const latencies = []
  const errors = []
  const statusBuckets = {}
  let okCount = 0

  let next = 0
  const startTs = Date.now()
  async function worker() {
    while (true) {
      const seq = next
      next += 1
      if (seq >= total) return
      let r
      try {
        r = await requestFn(seq)
      } catch (err) {
        r = { ok: false, latencyMs: 0, status: 0, error: err && err.message ? err.message : String(err) }
      }
      latencies.push(r.latencyMs)
      const k = String(r.status || 0)
      statusBuckets[k] = (statusBuckets[k] || 0) + 1
      if (r.ok) okCount += 1
      else errors.push({ seq, status: r.status, error: r.error || 'not_ok' })
    }
  }

  const workers = []
  for (let i = 0; i < concurrency; i += 1) workers.push(worker())
  await Promise.all(workers)

  const durationMs = Date.now() - startTs
  const errorCount = total - okCount
  const lat = summarize(latencies)
  const result = {
    name,
    concurrency,
    total,
    durationMs,
    rps: round(total / (durationMs / 1000)),
    okCount,
    errorCount,
    errorRate: round((errorCount / total) * 100) / 100, // 0~1 区间，保留 4 位精度
    statusBuckets,
    latency: lat,
    sampleErrors: errors.slice(0, 5)
  }
  return result
}

module.exports = {
  runBench,
  httpRequest,
  sharedAgent
}
