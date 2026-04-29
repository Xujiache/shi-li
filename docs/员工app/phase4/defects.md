# Phase 4 缺陷清单

> 编号规则：P4-NNN（三位自增）
> 严重度：P0 阻塞 / P1 强烈建议修 / P2 已知可绕开 / P3 优化项
> 状态：待修 / 已修 / 已确认不修 / 真机回填

## 一、Phase 4 实测发现并已修

| 编号 | 严重度 | 模块 | 描述 | 复现步骤 | 修复 | 状态 |
|---|---|---|---|---|---|---|
| P4-001 | P1 | 后端 syncService | 同 `client_uuid` 重发但 payload 不同（如缺必填字段）会先触发校验返 `validation_failed`，而不是返 `duplicate` | 1) 用 client_uuid=X 创建一条客户 status=ok；2) 用同 X 但 payload 缺 phone 再发；预期 duplicate，实际 validation_failed | 在 customerService.createCustomer / followUpService.createFollowUp / transferService.submitTransfer 三处把 client_uuid 幂等检查**前置到校验之前** | ✅ 已修（Wave 2） |
| P4-002 | P2 | 前端 db/sqlite.ts | `bindParams` 仅转义单引号，反斜杠 `\` 和 `\0` 控制字符未处理；payload 含这些字符可能破 SQL | 写带 `\\'` 的客户备注离线提交 | 增加 `\\\\` `\x00` `''` 三类转义 | ✅ 已修（Wave 2） |
| P4-003 | P3 | 文档 DESIGN §6.1 | 文档误写 `uni.createSQLDatabase`（实际是微信小程序 API），且未说明本地表 `updated_at INTEGER` vs 服务端 mysql DATETIME 的双套版本号 | 读 DESIGN §6.1 | 修正为 `plus.sqlite` + 加字段类型表 + 加双套版本号说明 | ✅ 已修（Wave 2） |

## 二、Phase 4 真机阶段需进一步验证的潜在问题

| 编号 | 严重度 | 模块 | 描述 | 真机验证步骤 | 状态 |
|---|---|---|---|---|---|
| P4-004 | P1 | 前端 manifest.json viewport | viewport meta 未声明 `viewport-fit=cover`，iOS 刘海屏底部 home indicator 可能与 tabBar 重叠 | iPhone 13+ 真机访问 H5 看底 tabBar 是否被遮挡 | 真机回填 |
| P4-005 | P2 | 前端 H5 输入框 | iOS Safari `font-size<16px` 触发自动缩放 | iPhone 真机点击登录页输入框看是否页面缩放 | 真机回填 |
| P4-006 | P2 | 前端 H5 高度 | `100vh` 在 iOS Safari 滚动时会抖动（地址栏出现/消失） | iPhone 真机滚动客户列表看视觉抖动 | 真机回填 |
| P4-007 | P2 | 前端微信内核 | Android 微信 X5 内核可能落后 Chrome 1-2 大版本 | 微信扫一扫打开 H5 看 console 报错 | 真机回填 |

## 三、Phase 3 留下的非阻塞偏差（顺手在 Phase 4 修了）

见上 P4-001 / P4-002 / P4-003。

## 四、Wave 4-B Plan B 报告中已确认无需处理

| 编号 | 严重度 | 内容 | 决策 |
|---|---|---|---|
| - | P3 | sync/batch ops 上限 | **已实现**（[routes/employee/sync.js](../../node后端（新增）/routes/employee/sync.js) 已限 50 条），无需新增 |
| - | P3 | 后端 IP 维度限流 | 现有限流仅 phone 维度，本机 127.0.0.1 测试不会全锁。生产可在 Phase 5 加 nginx limit_req 兜底 |

## 五、统计

- P0 阻塞：**0**
- P1 强烈建议修：**1（已修）**
- P2 已知可绕开 / 真机验证：**4（1 已修 / 3 真机回填）**
- P3 优化：**1（已修）**

**Phase 4 实验室阶段无 P0 / P1 阻塞项，可进入 Phase 5。**
