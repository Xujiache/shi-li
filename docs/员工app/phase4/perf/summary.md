# Phase 4 性能压测汇总

- 生成时间：2026-04-28T12:26:29.282Z
- 环境：vision-server PM2 端口 3100，mysql.connectionLimit=10
- 内核：tests/perf/lib/runner.js（无外部依赖）

| 接口 | 并发 | 总数 | p50(ms) | p95(ms) | p99(ms) | RPS | error_rate | p95 阈值(ms) | 通过 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| login | 10 | 200 | 218.03 | 264.82 | 281.03 | 44.21 | 0.00% | 1500 | ✅ |
| customers-list | 8 | 1000 | 71.76 | 96.28 | 105.05 | 115.19 | 0.00% | 800 | ✅ |
| followup-create | 8 | 200 | 63.08 | 93.35 | 104.05 | 124.77 | 0.00% | 600 | ✅ |
| dashboard-me | 10 | 500 | 64.02 | 85.07 | 93.54 | 166.5 | 0.00% | 500 | ✅ |
| sync-batch | 5 | 50 | 94.93 | 133.58 | 156.02 | 48.45 | 0.00% | 5000 | ✅ |
| sync-batch-100ops | 3 | 10 | 1041.9 | 1237.7 | 1237.7 | 2.31 | 0.00% | 5000 | ✅ |

## 详细

### login
- duration: 4524ms, ok: 200 / 200
- latency: min=79.52 mean=220.96 max=296.89
- statusBuckets: `{"200":200}`

### customers-list
- duration: 8681ms, ok: 1000 / 1000
- latency: min=26.44 mean=68.73 max=127.52
- statusBuckets: `{"200":1000}`

### followup-create
- duration: 1603ms, ok: 200 / 200
- latency: min=24.52 mean=63.38 max=108.24
- statusBuckets: `{"200":200}`
- cleanup: matched=205 remaining=0

### dashboard-me
- duration: 3003ms, ok: 500 / 500
- latency: min=26 mean=59.68 max=97.62
- statusBuckets: `{"200":500}`

### sync-batch
- duration: 1032ms, ok: 50 / 50
- latency: min=59.94 mean=99.95 max=156.02
- statusBuckets: `{"200":50}`
- cleanup: matched=520 remaining=0

### sync-batch-100ops（TASK §3.4 字面对齐：100 ops 单包）
- 每批 100 个 customer create op，并发 3，总 10 批 → 实际写入 1000 条
- duration: ~5s ok: 10 / 10
- latency p50=1041.9 / p95=1237.7 / p99=1237.7
- statusBuckets: `{"200":10}`
- cleanup: matched=1100 remaining=0（含 warmup 1 批的 100 条）
- 阈值：p95 ≤ 5000ms ✅ （余量 4×）

> 该用例直接对齐 TASK §3.4"同步 100 条 ops ≤ 5s"硬指标，与 sync-batch（10 ops/批 × 50 次）互补。
