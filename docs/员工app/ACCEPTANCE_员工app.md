# ACCEPTANCE_员工app

> 本文档在落地阶段（Phase 4 ~ Phase 5）逐项填写实测结果，作为最终交付的验收凭证。
> 验收通过的项打 ✅；不通过的项打 ❌ 并在"问题描述"列写明，未实测的项打 ⏳。

## 一、文档验收

| 项 | 状态 | 实测结果 / 问题描述 |
| --- | --- | --- |
| 已交付 [新增员工app PRD.md](../../新增员工app%20PRD.md) | ✅ | 48KB / 12 章 / 44 三级标题 |
| 已交付 [ALIGNMENT_员工app.md](ALIGNMENT_员工app.md) | ✅ | 已创建 |
| 已交付 [CONSENSUS_员工app.md](CONSENSUS_员工app.md) | ✅ | 已创建 |
| 已交付 [DESIGN_员工app.md](DESIGN_员工app.md) | ✅ | 已创建 |
| 已交付 [TASK_员工app.md](TASK_员工app.md) | ✅ | 已创建 |
| 已交付 [ACCEPTANCE_员工app.md](ACCEPTANCE_员工app.md) | ✅ | 本文档 |
| 已交付 [FINAL_员工app.md](FINAL_员工app.md) | ⏳ | 待交付时填 |
| 已交付 [TODO_员工app.md](TODO_员工app.md) | ⏳ | 待交付时填 |
| 接口字段、schema、状态机、任务拆解可直接执行 | ⏳ | |
| 与项目现有文档风格一致 | ⏳ | |

---

## 二、后端验收

### 2.1 数据库 schema

| 项 | 状态 | 实测结果 |
| --- | --- | --- |
| `departments` 表创建成功 | ⏳ | |
| `employees` 表创建成功 | ⏳ | |
| `employee_sessions` 表创建成功 | ⏳ | |
| `customers` 表创建成功 | ⏳ | |
| `customer_attachments` 表创建成功 | ⏳ | |
| `follow_ups` 表创建成功 | ⏳ | |
| `customer_transfers` 表创建成功 | ⏳ | |
| `notifications` 表创建成功 | ⏳ | |
| `customer_tags` 表创建成功 | ⏳ | |
| `system_announcements` 表创建成功 | ⏳ | |
| 幂等执行 `npm run init-db` 3 次不报错 | ⏳ | |
| 既有 19 张表数据无任何变更 | ⏳ | |

### 2.2 接口（38 个 employee + 11 个 admin = 49 个，全部走通正面 + 反面）

#### Auth

| 接口 | 正面 | 反面 |
| --- | --- | --- |
| POST `/auth/login` | ⏳ | ⏳ 错误密码 / 锁账号 / 异地 |
| POST `/auth/verify-code` | ⏳ | ⏳ 错验证码 / 过期 |
| POST `/auth/change-password` | ⏳ | ⏳ 旧密错 / 新密太弱 |
| POST `/auth/logout` | ⏳ | |

#### Me

| 接口 | 状态 |
| --- | --- |
| GET `/me` | ⏳ |
| PUT `/me` | ⏳ |
| GET `/dashboard/me` | ⏳ |
| GET `/dashboard/stats` | ⏳ |

#### Customers

| 接口 | 正面 | 反面 |
| --- | --- | --- |
| GET `/customers` | ⏳ | |
| POST `/customers` | ⏳ | ⏳ 必填缺失 / phone 格式错 |
| GET `/customers/:id` | ⏳ | ⏳ 不归属本人 → 40302 |
| PUT `/customers/:id` | ⏳ | ⏳ 不归属本人 |
| DELETE `/customers/:id` | ⏳ | |
| GET `/customers/search` | ⏳ | |
| GET `/customers/:id/attachments` | ⏳ | |
| POST `/customers/:id/attachments` | ⏳ | |
| DELETE `/customers/:id/attachments/:aid` | ⏳ | |
| PUT `/customers/:id/reminder` | ⏳ | |

#### Follow-ups

| 接口 | 状态 |
| --- | --- |
| GET `/follow-ups` | ⏳ |
| POST `/follow-ups` | ⏳ |
| GET `/follow-ups/:id` | ⏳ |
| PUT `/follow-ups/:id`（仅自己） | ⏳ |
| DELETE `/follow-ups/:id`（仅自己） | ⏳ |

#### Transfers

| 接口 | 状态 |
| --- | --- |
| POST `/customer-transfers` | ⏳ |
| GET `/customer-transfers/mine` | ⏳ |
| GET `/customer-transfers/pending`（manager） | ⏳ |
| PUT `/customer-transfers/:id/approve`（manager） | ⏳ |
| PUT `/customer-transfers/:id/reject`（manager） | ⏳ |

#### Notifications

| 接口 | 状态 |
| --- | --- |
| GET `/notifications` | ⏳ |
| GET `/notifications/unread-count` | ⏳ |
| PUT `/notifications/:id/read` | ⏳ |
| PUT `/notifications/read-all` | ⏳ |
| DELETE `/notifications/read` | ⏳ |

#### Team

| 接口 | 状态 |
| --- | --- |
| GET `/team/members` | ⏳ |
| GET `/announcements` | ⏳ |
| GET `/customer-tags` | ⏳ |

#### Uploads & Sync

| 接口 | 状态 |
| --- | --- |
| POST `/uploads/image` | ⏳ |
| POST `/sync/batch` | ⏳ |

### 2.3 单元测试

| 测试 | 状态 |
| --- | --- |
| `employeeService.login` | ⏳ |
| `employeeService.changePassword` | ⏳ |
| `customerService.create + update + softDelete` | ⏳ |
| `followUpService.create` | ⏳ |
| `transferService.approve + reject` | ⏳ |
| `notificationService.push + markRead` | ⏳ |
| `syncService.processBatch`（含 ok / duplicate / conflict / validation_failed 4 种结果） | ⏳ |

### 2.4 性能

| 指标 | 目标 | 实测 |
| --- | --- | --- |
| 客户列表 200 条响应 | ≤ 800ms | ⏳ |
| 客户详情响应 | ≤ 500ms | ⏳ |
| 写跟进（在线） | ≤ 600ms | ⏳ |
| 同步 100 条 ops | ≤ 5s | ⏳ |
| 单图上传（4G） | ≤ 3s | ⏳ |

### 2.5 审计

| 项 | 状态 |
| --- | --- |
| 所有 employee 写操作有审计记录 | ⏳ |
| `audit_logs.operator_type='employee'` 可查询 | ⏳ |
| 审计字段完整：employee_id / module / action / before / after / ip / ua | ⏳ |

---

## 三、PC 管理后台验收

| 页面 | CRUD 可用 | 状态 |
| --- | --- | --- |
| `/employees` 员工管理 | 列表 / 增 / 改 / 启停 / 重置密码 | ⏳ |
| `/departments` 部门管理 | 列表 / 增 / 改 / 启停 | ⏳ |
| `/customers` 客户全局视图 | 列表 / 详情 / 跨员工查看 | ⏳ |
| `/customer-transfers` 转出审批 | 列表 / 通过 / 驳回 | ⏳ |
| `/customer-tags` 标签字典 | 列表 / 增 / 改 / 启停 / 颜色选择 | ⏳ |
| `/system-announcements` 公告 | 列表 / 增 / 改 / 置顶 / 弹窗 / 过期 | ⏳ |
| 既有 [vision-admin](../../后台/art-lnb-master/src/views/vision-admin/) 下页面 0 回归 | | ⏳ |

---

## 四、员工 App 验收

### 4.1 在线场景

| 项 | 状态 | 实测结果 |
| --- | --- | --- |
| staff / manager 账号都能登录 | ⏳ | |
| 角色感知 tabBar 切换正确 | ⏳ | |
| 首次登录强制改密 | ⏳ | |
| 异地登录触发短信验证码二次校验 | ⏳ | |
| 单设备限制：第二台登录第一台失效 | ⏳ | |
| 工作台正确展示 4 数据卡 + 公告 | ⏳ | |
| 客户列表筛选 / 排序 / 搜索全部生效 | ⏳ | |
| 点手机号直接拨打 | ⏳ | |
| 长按 ActionSheet 全部操作可用 | ⏳ | |
| 客户详情 4 个 Tab 数据正确 | ⏳ | |
| 改基本信息后小程序家长端立即可见 | ⏳ | |
| 写跟进日志后列表立即刷新 | ⏳ | |
| 仅自己创建的跟进可改 / 删 | ⏳ | |
| 提交转出申请后主管能看到待办 | ⏳ | |
| 主管能通过 / 驳回转出申请 | ⏳ | |
| 4 类通知正确推送（分配 / 转入 / 转出结果 / 信息变更） | ⏳ | |
| 跟进提醒到点产生站内消息 | ⏳ | |
| 一键清空已读消息生效 | ⏳ | |
| 业绩统计 + 趋势图正确 | ⏳ | |
| 团队页只显示同部门同事 | ⏳ | |

### 4.2 离线场景

| 项 | 状态 | 实测结果 |
| --- | --- | --- |
| 飞行模式登录可以（用 7 天内本地缓存） | ⏳ | |
| 飞行模式新建客户 + 写跟进 + 拍照 + 设提醒 全部可用 | ⏳ | |
| 网络恢复后 30 秒内队列自动同步并 toast 提示 | ⏳ | |
| 同一 client_uuid 重复提交服务端只生成一条 | ⏳ | |
| 附件上传失败可重试 3 次，仍失败标红并允许手动重传 | ⏳ | |
| 同一客户在两台设备同时改触发冲突合并 UI | ⏳ | |
| 切换账号前如有 pending_op 强制要求"先同步"或"清空" | ⏳ | |

### 4.3 兼容性

| 平台 | 机型 | 在线模式 | 离线模式 |
| --- | --- | --- | --- |
| Android 5 | （选 1 台） | ⏳ | ⏳ |
| Android 8 | 小米 / 华为 / OPPO 任选 | ⏳ | ⏳ |
| Android 10 | 同上 | ⏳ | ⏳ |
| Android 13+ | 同上 | ⏳ | ⏳ |
| iOS 14 | iPhone 8 | ⏳ | ⏳ |
| iOS 16 | iPhone 12+ | ⏳ | ⏳ |
| iOS 17 | iPhone 14 / 15 | ⏳ | ⏳ |
| H5 - Chrome | （仅在线） | ⏳ | N/A |
| H5 - Safari | （仅在线） | ⏳ | N/A |
| H5 - 微信内置 | （仅在线） | ⏳ | N/A |

### 4.4 性能

| 指标 | 目标 | 实测 |
| --- | --- | --- |
| App 冷启动 | ≤ 2s | ⏳ |
| 客户列表（200 条）滚动 | 流畅无卡顿 | ⏳ |
| 写跟进（离线） | ≤ 50ms | ⏳ |
| 单 APK 一周本地存储 | ≤ 80MB | ⏳ |
| 弱网（信号 1 格）同步成功率 | ≥ 95% | ⏳ |

---

## 五、安全验收

| 项 | 状态 | 实测结果 |
| --- | --- | --- |
| 错误密码登录 5 次后被锁 15 分钟 | ⏳ | |
| employees JWT 不能调 `/api/v1/admin/*` | ⏳ | |
| employees JWT 不能调 `/api/v1/mobile/*` | ⏳ | |
| HTTPS 证书有效，HTTP 重定向到 HTTPS | ⏳ | |
| staff 看不到其他员工的客户 | ⏳ | |
| manager 看不到其他部门客户 | ⏳ | |
| 手机号对非主管角色脱敏 | ⏳ | |
| 密码 bcrypt 哈希存储 | ⏳ | |
| token_hash 存 employee_sessions（不存明文） | ⏳ | |

---

## 六、兼容性 / 回归验收

| 项 | 状态 | 实测结果 |
| --- | --- | --- |
| `users` / `children` / `appointment_*` / `checkup_records` / `questionnaire_*` 数据无变化 | ⏳ | |
| 家长端小程序所有页面无回归 bug | ⏳ | |
| trading-platform 进程仍正常（端口 3000、库 trading_system） | ⏳ | |
| trading-platform PM2 进程未受影响 | ⏳ | |
| 既有 admin 后台 `/api/v1/admin/*` 接口 0 改动 | ⏳ | |
| 既有 mobile `/api/v1/mobile/*` 接口 0 改动 | ⏳ | |

---

## 七、真实场景验收

| 项 | 目标 | 实测 |
| --- | --- | --- |
| 员工日均跑 30 个客户跟进 | 无明显卡顿 | ⏳ |
| 主管处理 50 条转出申请用时 | ≤ 30 分钟 | ⏳ |
| 数据同步在弱网下成功率 | ≥ 95% | ⏳ |
| 全员安装率（灰度发布 7 天后） | ≥ 95% | ⏳ |
| 首周登录率 | ≥ 90% | ⏳ |
| P0 / P1 缺陷数 | 0 | ⏳ |

---

## 八、缺陷清单（落地阶段填）

| 编号 | 严重程度 | 模块 | 描述 | 状态 | 责任人 | 修复版本 |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - | - |

---

## 九、最终验收结论

> **本节由验收人在所有项实测完毕后填写**。

- 验收日期：____
- 验收人：____
- 总验收点数：____
- 通过数：____
- 不通过数：____
- 不通过项是否全部转入 [TODO_员工app.md](TODO_员工app.md)：☐
- 是否同意上线：☐ 同意 / ☐ 不同意（理由：____）

签字：____
