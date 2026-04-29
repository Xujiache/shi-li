/**
 * 顺序执行 5 个压测 bench，写 raw JSON + summary.md。
 *
 *   raw:    /www/shi-li/docs/员工app/phase4/perf/raw/<bench>.json
 *   表格:   /www/shi-li/docs/员工app/phase4/perf/summary.md
 */
const fs = require('fs')
const path = require('path')

const benches = [
  { key: 'login',           file: './bench-login' },
  { key: 'customers-list',  file: './bench-customers-list' },
  { key: 'followup-create', file: './bench-followup-create' },
  { key: 'dashboard',       file: './bench-dashboard' },
  { key: 'sync-batch',      file: './bench-sync-batch' }
]

const ROOT_DOC = '/www/shi-li/docs/员工app/phase4/perf'
const RAW_DIR = path.join(ROOT_DOC, 'raw')
const SUMMARY_PATH = path.join(ROOT_DOC, 'summary.md')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function fmtPct(v) {
  return (v * 100).toFixed(2) + '%'
}

function buildSummary(rows) {
  const lines = []
  lines.push('# Phase 4 性能压测汇总')
  lines.push('')
  lines.push('- 生成时间：' + new Date().toISOString())
  lines.push('- 环境：vision-server PM2 端口 3100，mysql.connectionLimit=10')
  lines.push('- 内核：tests/perf/lib/runner.js（无外部依赖）')
  lines.push('')
  lines.push('| 接口 | 并发 | 总数 | p50(ms) | p95(ms) | p99(ms) | RPS | error_rate | p95 阈值(ms) | 通过 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of rows) {
    if (r.error) {
      lines.push(`| ${r.name} | - | - | - | - | - | - | - | - | ❌ (脚本异常: ${String(r.error).slice(0, 80)}) |`)
      continue
    }
    lines.push([
      r.name,
      r.concurrency,
      r.total,
      r.latency.p50,
      r.latency.p95,
      r.latency.p99,
      r.rps,
      fmtPct(r.errorRate),
      r.thresholds.p95Ms,
      r.passed ? '✅' : '❌'
    ].map((v) => '| ' + v).join(' ') + ' |')
  }
  lines.push('')
  lines.push('## 详细')
  lines.push('')
  for (const r of rows) {
    lines.push('### ' + r.name)
    if (r.error) {
      lines.push('脚本异常：' + String(r.error))
      lines.push('')
      continue
    }
    lines.push('- duration: ' + r.durationMs + 'ms, ok: ' + r.okCount + ' / ' + r.total)
    lines.push('- latency: min=' + r.latency.min + ' mean=' + r.latency.mean + ' max=' + r.latency.max)
    lines.push('- statusBuckets: `' + JSON.stringify(r.statusBuckets) + '`')
    if (r.cleanup) {
      lines.push('- cleanup: matched=' + r.cleanup.matchedBeforeDelete + ' remaining=' + r.cleanup.remainingAfterDelete)
    }
    if (r.sampleErrors && r.sampleErrors.length) {
      lines.push('- sampleErrors: `' + JSON.stringify(r.sampleErrors) + '`')
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function main() {
  ensureDir(RAW_DIR)

  const rows = []
  for (const b of benches) {
    const start = Date.now()
    process.stdout.write('\n>>> running ' + b.key + ' ...\n')
    let result
    try {
      const fn = require(b.file)
      result = await fn()
    } catch (err) {
      result = { name: b.key, error: (err && err.message) || String(err) }
      console.error('bench ' + b.key + ' failed:', err && err.stack || err)
    }
    const dur = Date.now() - start
    process.stdout.write('<<< ' + b.key + ' done in ' + dur + 'ms\n')
    rows.push(result)
    fs.writeFileSync(path.join(RAW_DIR, b.key + '.json'), JSON.stringify(result, null, 2))
  }

  const summary = buildSummary(rows)
  fs.writeFileSync(SUMMARY_PATH, summary)
  process.stdout.write('\n--- summary written: ' + SUMMARY_PATH + ' ---\n')
  process.stdout.write(summary + '\n')

  const allPassed = rows.every((r) => r.passed)
  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('run-all fatal:', err && err.stack || err)
  process.exit(2)
})
