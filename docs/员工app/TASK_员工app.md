# TASK_员工app

## 一、阶段拆分总览

| 阶段 | 目标 | 主要交付物 | 依赖 | 工期 |
| --- | --- | --- | --- | --- |
| 第一阶段 | 后端打地基 | 10 张新表、`/api/v1/employee/*` 路由骨架、6 个 services、PC 后台员工 / 部门管理页 | 无 | 5~6 天 |
| 第二阶段 | UniApp 在线主流程 | 工程脚手架、登录 / 工作台 / 客户 / 跟进 / 转出 / 消息 / 我 5 大模块在线版、APK 内测包 | 第一阶段 | 7~8 天 |
| 第三阶段 | 离线本地库与同步 | local SQLite、pending_op 队列、`/sync/batch` 端到端、冲突合并 UI、附件懒上传 | 第二阶段 | 8~9 天 |
| 第四阶段 | 联调与压测 | 性能达标、回归测试通过、弱网真机测试 | 第三阶段 | 4 天 |
| 第五阶段 | 灰度发布 | 真机验收、APK 签名分发、培训文档 | 第四阶段 | 3 天 |

**合计：约 30 工作日（约 6 周）**。Phase 3 是关键路径，资源不能并行省。

## 二、任务依赖图

```mermaid
flowchart LR
    phase1[第一阶段<br/>后端打地基] --> phase2[第二阶段<br/>UniApp 在线主流程]
    phase2 --> phase3[第三阶段<br/>离线本地库与同步]
    phase3 --> phase4[第四阶段<br/>联调与压测]
    phase4 --> phase5[第五阶段<br/>灰度发布]
```

## 三、阶段详情

### 第一阶段：后端打地基

#### 1. 阶段目标

让后端 `vision-server` 具备员工 App 的全部接入能力：表结构、路由、services、JWT、PC 后台管理页。

#### 2. 页面 / 模块范围

| 端 | 模块 | 说明 |
| --- | --- | --- |
| Node 后端 | 全部 | 新增 10 张表 + 9 个路由子模块 + 6 个 services |
| PC 管理后台 | employees / departments | 新增管理页（其余 4 个新页可放在 Phase 2 并行） |

#### 3. 后端任务

##### 3.1 数据库 schema

- [ ] 在 [node后端（新增）/scripts/db/core.js](../../node后端（新增）/scripts/db/core.js) 增量加 10 张表 DDL（详见 [DESIGN_员工app §4.2](DESIGN_员工app.md)）
- [ ] 加幂等保护：`CREATE TABLE IF NOT EXISTS`
- [ ] 加索引（详见 DESIGN）
- [ ] 跑 `npm run init-db` 验证幂等性（连跑 3 次不报错）
- [ ] 验证既有 19 张表数据无任何变化

##### 3.2 utils 增强

- [ ] [utils/jwt.js](../../node后端（新增）/utils/jwt.js)：加 `USER_TYPES.EMPLOYEE = 'employee'`；扩展既有 `generateToken / verifyToken / authMiddleware` 三个函数支持 EMPLOYEE 分支（不新增独立函数，复用更稳）
- [ ] [middlewares/adminLog.js](../../node后端（新增）/middlewares/adminLog.js) → 重命名 `middlewares/auditLog.js`，扩展 `operator_type` 支持 'admin' / 'employee'
- [ ] [routes/middlewares/permission.js](../../node后端（新增）/routes/middlewares/permission.js)：新增 `requireEmployeeRole(...allowedRoles)` 中间件
- [ ] 新增 [middlewares/employeeAuth.js](../../node后端（新增）/middlewares/employeeAuth.js)：employee 鉴权入口（含 must_change_password 拦截、单设备校验）

##### 3.3 services 实现

> 注：方法名严格按代码 export 命名，文档与实现单一真相。

- [ ] [services/employeeService.js](../../node后端（新增）/services/employeeService.js)：`employeeLogin / verifyLoginCode / changePassword / logoutEmployee / findEmployeeByPhone / findEmployeeById / safeEmployee / buildEmployeeTokenPayload / listEmployees / getEmployeeDetail / createEmployee / updateEmployee / setEmployeeActive / resetEmployeePassword / deleteEmployee`
- [ ] [services/customerService.js](../../node后端（新增）/services/customerService.js)：`listCustomers / getCustomerDetail / createCustomer / updateCustomer / softDeleteCustomer / searchCustomers / setCustomerReminder / linkUserByPhone / listAttachments / addAttachment / deleteAttachment / safeCustomer / generateCustomerNo / assertOwnership`
- [ ] [services/followUpService.js](../../node后端（新增）/services/followUpService.js)：`listFollowUps / getFollowUpDetail / createFollowUp / updateFollowUp / deleteFollowUp / safeFollowUp`
- [ ] [services/transferService.js](../../node后端（新增）/services/transferService.js)：`submitTransfer / listMineTransfers / listPendingTransfers / approveTransfer / rejectTransfer / safeTransfer`
- [ ] [services/notificationService.js](../../node后端（新增）/services/notificationService.js)：`pushNotification / pushNotificationToMany / listNotifications / unreadCount / markRead / markAllRead / clearReadNotifications / safeNotification`
- [ ] [services/syncService.js](../../node后端（新增）/services/syncService.js)：`processBatch / processCustomerOp / processFollowUpOp / processTransferOp`（按 type 分发，处理 ok/duplicate/conflict/validation_failed/forbidden/not_found/error）
- [ ] [services/departmentService.js](../../node后端（新增）/services/departmentService.js)：`listDepartments / getDepartmentDetail / createDepartment / updateDepartment / deleteDepartment / safeDepartment`（admin 端 PC 后台用）

##### 3.4 路由实现

- [ ] [routes/employee/index.js](../../node后端（新增）/routes/employee/index.js)：注册 9 个子路由 + 公共中间件
- [ ] [routes/employee/auth.js](../../node后端（新增）/routes/employee/auth.js)：login / verify-code / change-password / logout
- [ ] [routes/employee/me.js](../../node后端（新增）/routes/employee/me.js)：me / dashboard / stats
- [ ] [routes/employee/customers.js](../../node后端（新增）/routes/employee/customers.js)：CRUD + search + attachments + reminder
- [ ] [routes/employee/followUps.js](../../node后端（新增）/routes/employee/followUps.js)：CRUD
- [ ] [routes/employee/transfers.js](../../node后端（新增）/routes/employee/transfers.js)：submit / mine / pending / approve / reject
- [ ] [routes/employee/notifications.js](../../node后端（新增）/routes/employee/notifications.js)：list / unread-count / read / clear-read
- [ ] [routes/employee/team.js](../../node后端（新增）/routes/employee/team.js)：members / announcements / customer-tags
- [ ] [routes/employee/uploads.js](../../node后端（新增）/routes/employee/uploads.js)：image
- [ ] [routes/employee/sync.js](../../node后端（新增）/routes/employee/sync.js)：batch
- [ ] 在 [routes/index.js](../../node后端（新增）/routes/index.js) 挂载 `app.use('/api/v1/employee', employeeRoutes)`

##### 3.5 PC 后台管理页（必上）

- [ ] [后台/art-lnb-master/src/views/vision-admin/employees/](../../后台/art-lnb-master/src/views/vision-admin/employees/)：列表、增 / 改 / 启停 / 重置密码 / 选部门 / 选角色
- [ ] [后台/art-lnb-master/src/views/vision-admin/departments/](../../后台/art-lnb-master/src/views/vision-admin/departments/)：列表、增 / 改 / 启停
- [ ] 配套 admin 端接口：`/api/v1/admin/employees` / `/api/v1/admin/departments`（CRUD）

#### 4. API 任务

| 接口 | Method | 说明 |
| --- | --- | --- |
| `/api/v1/employee/auth/login` | POST | 员工登录 |
| `/api/v1/employee/auth/verify-code` | POST | 异地验证 |
| `/api/v1/employee/auth/change-password` | POST | 改密 |
| `/api/v1/employee/auth/logout` | POST | 注销 |
| `/api/v1/employee/me` | GET / PUT | 个人信息 |
| `/api/v1/employee/dashboard/me` | GET | 首页概览 |
| `/api/v1/employee/dashboard/stats` | GET | 业绩统计 |
| `/api/v1/employee/customers` | GET / POST | 列表 / 新增 |
| `/api/v1/employee/customers/:id` | GET / PUT / DELETE | CRUD |
| `/api/v1/employee/customers/search` | GET | 全局搜索 |
| `/api/v1/employee/customers/:id/attachments` | GET / POST | 附件 |
| `/api/v1/employee/customers/:id/attachments/:aid` | DELETE | 删附件 |
| `/api/v1/employee/customers/:id/reminder` | PUT | 设跟进提醒 |
| `/api/v1/employee/follow-ups` | GET / POST | 跟进列表 / 新增 |
| `/api/v1/employee/follow-ups/:id` | GET / PUT / DELETE | CRUD |
| `/api/v1/employee/customer-transfers` | POST | 提交转出 |
| `/api/v1/employee/customer-transfers/mine` | GET | 我提交的 |
| `/api/v1/employee/customer-transfers/pending` | GET | 待审批 |
| `/api/v1/employee/customer-transfers/:id/approve` | PUT | 通过 |
| `/api/v1/employee/customer-transfers/:id/reject` | PUT | 驳回 |
| `/api/v1/employee/notifications` | GET | 消息列表 |
| `/api/v1/employee/notifications/unread-count` | GET | 未读数 |
| `/api/v1/employee/notifications/:id/read` | PUT | 标已读 |
| `/api/v1/employee/notifications/read-all` | PUT | 全部已读 |
| `/api/v1/employee/notifications/read` | DELETE | 一键清空 |
| `/api/v1/employee/team/members` | GET | 同部门 |
| `/api/v1/employee/announcements` | GET | 公告 |
| `/api/v1/employee/customer-tags` | GET | 标签字典 |
| `/api/v1/employee/uploads/image` | POST | 上传图片 |
| `/api/v1/employee/sync/batch` | POST | 批量同步 |

#### 5. 数据库任务

| 表 | 任务 |
| --- | --- |
| `departments` | 建表 + 默认数据：1 条 `id=1, name='默认部门'` 做种子（admin 可在 PC 后台自行重命名） |
| `employees` | 建表 |
| `employee_sessions` | 建表 |
| `customers` | 建表 |
| `customer_attachments` | 建表 |
| `follow_ups` | 建表 |
| `customer_transfers` | 建表 |
| `notifications` | 建表 |
| `customer_tags` | 建表 + 默认数据：A 级 / B 级 / C 级 / 急客 / 续约 5 个 |
| `system_announcements` | 建表 |

#### 6. 环境变量任务

- [ ] [node后端（新增）/.env](../../node后端（新增）/.env) 加：
  - `JWT_EMPLOYEE_SECRET`（用 `openssl rand -hex 32` 生成）
  - `JWT_EMPLOYEE_EXPIRES_IN=7d`
  - `EMPLOYEE_LOGIN_FAIL_LOCK_MINUTES=15`
  - `EMPLOYEE_LOGIN_FAIL_THRESHOLD=5`
  - `EMPLOYEE_SYNC_BATCH_MAX=200`
  - `EMPLOYEE_SINGLE_DEVICE=true`
  - `EMPLOYEE_DEFAULT_PASSWORD=Init@2025`（admin 创建员工不传 password 时使用）
  - `SMS_PROVIDER=`（留空则跳过异地登录验证码二次校验，v1 简化）
  - `SMS_API_KEY=` / `SMS_API_SECRET=` / `SMS_SIGN_NAME=` / `SMS_TEMPLATE_LOGIN=`

#### 7. 交付物

- 新增 10 张表全部建好（mysql 验证）
- `/api/v1/employee/*` 全部 38 个接口在 Postman 中可调通
- PC 管理后台 employees / departments 两个页面 CRUD 可用
- 默认账号：admin 通过 PC 后台预先创建 1 个 staff + 1 个 manager 测试账号
- 单元测试：login / changePassword / customer create+update+delete / follow_up create / transfer approve 6 个核心方法
- Postman 集合：`docs/员工app/postman/employee-app.json`（落地阶段交付）

#### 8. 验收标准

- [ ] 所有新表创建成功，老表数据无变化
- [ ] 所有接口走通正面 + 反面用例
- [ ] PC 后台员工 / 部门管理 CRUD 全部可用
- [ ] 既有 admin 端接口 0 改动（回归通过）
- [ ] 既有 mobile 端接口 0 改动（回归通过）
- [ ] trading-platform 仍正常（端口 3000、库 trading_system 不变）
- [ ] 后端启动日志无新错误

#### 9. 风险与依赖

- 短信服务商账号需提前申请（v1 用阿里云 / 腾讯云任一）
- 未提前申请会 block 异地登录功能（可降级为不开此功能）
- DB schema 一旦上线，后续改动需走 migration 思路（v1 暂不引入 migration 工具）

---

### 第二阶段：UniApp 在线主流程

#### 1. 阶段目标

让员工 App **在网络可用的前提下** 跑通 5 大模块完整体验，输出可分发的 APK 内测包。

#### 2. 页面 / 模块范围

详见 [DESIGN_员工app §2.2 页面清单](DESIGN_员工app.md) 全部 23 个页面。

#### 3. 前端任务

##### 3.1 工程脚手架

- [ ] HBuilderX 创建 UniApp 工程 [/www/shi-li/员工App/](../../员工App/)
- [ ] manifest.json：appid、权限（camera / storage / location / network / phone）、包名 `cn.shi-li.employee`
- [ ] pages.json：路由 + 三套 tabBar（staff / manager）+ 默认 splash
- [ ] 安装依赖：uview-plus / pinia / dayjs / lodash-es / uuid（兼容 UniApp 的实现）/ uCharts
- [ ] 配置 vite / webpack（按 HBuilderX 默认即可）
- [ ] 配置 ESLint + Prettier，与家长端工程对齐

##### 3.2 公共能力

- [ ] [api/http.ts](../../员工App/api/http.ts)：请求封装 + 拦截器 + token 自动刷新 + 错误码处理 + 离线兜底（暂留接口）
- [ ] [stores/auth.ts](../../员工App/stores/auth.ts)：Pinia store，持久化 token + employee profile
- [ ] [components/sync-indicator.vue](../../员工App/components/sync-indicator.vue)：顶部圆点（暂只显示在线 / 离线）
- [ ] [components/customer-card.vue](../../员工App/components/customer-card.vue)：客户列表项
- [ ] [components/follow-up-card.vue](../../员工App/components/follow-up-card.vue)：跟进列表项
- [ ] [components/notification-badge.vue](../../员工App/components/notification-badge.vue)：未读数角标

##### 3.3 登录链路

- [ ] [pages/login/index.vue](../../员工App/pages/login/index.vue)：手机号 + 密码登录
- [ ] [pages/login/change-password.vue](../../员工App/pages/login/change-password.vue)：首登强制改密
- [ ] [pages/login/verify.vue](../../员工App/pages/login/verify.vue)：异地登录验证码
- [ ] 拦截：未登录调任意接口跳登录页

##### 3.4 工作台

- [ ] [pages/home/index.vue](../../员工App/pages/home/index.vue)：4 个快捷入口 + 4 个数据卡 + 公告列表
- [ ] 数据卡片可下拉刷新
- [ ] 角色感知布局（manager 多一个"待审批"卡）

##### 3.5 客户管理

- [ ] [pages/customer/list.vue](../../员工App/pages/customer/list.vue)：列表 + 筛选 + 排序 + 长按菜单
- [ ] [pages/customer/detail.vue](../../员工App/pages/customer/detail.vue)：4 个 Tab（基本 / 跟进 / 档案 / 提醒）
- [ ] [pages/customer/new.vue](../../员工App/pages/customer/new.vue)：新建客户表单
- [ ] [pages/customer/edit.vue](../../员工App/pages/customer/edit.vue)：编辑表单
- [ ] [pages/customer/search.vue](../../员工App/pages/customer/search.vue)：全局搜索
- [ ] 拨号：直接调 `uni.makePhoneCall`，不弹确认

##### 3.6 跟进日志

- [ ] [pages/follow-up/list.vue](../../员工App/pages/follow-up/list.vue)：时间线列表 + 筛选
- [ ] [pages/follow-up/new.vue](../../员工App/pages/follow-up/new.vue)：写跟进表单（结构化字段 + 附件）
- [ ] [pages/follow-up/detail.vue](../../员工App/pages/follow-up/detail.vue)：详情 + 编辑 / 删除（仅自己）

##### 3.7 转出

- [ ] [pages/transfer/new.vue](../../员工App/pages/transfer/new.vue)：提交转出申请
- [ ] [pages/transfer/mine.vue](../../员工App/pages/transfer/mine.vue)：我提交的
- [ ] [pages/transfer/pending.vue](../../员工App/pages/transfer/pending.vue)：待审批（manager）

##### 3.8 消息中心

- [ ] [pages/notification/list.vue](../../员工App/pages/notification/list.vue)：列表 + 类型筛选
- [ ] [pages/notification/detail.vue](../../员工App/pages/notification/detail.vue)：详情 + 跳转

##### 3.9 我的中心

- [ ] [pages/me/profile.vue](../../员工App/pages/me/profile.vue)：个人信息 + 改密 + 退出
- [ ] [pages/me/team.vue](../../员工App/pages/me/team.vue)：同部门同事列表
- [ ] [pages/me/stats.vue](../../员工App/pages/me/stats.vue)：业绩统计 + uCharts 趋势图
- [ ] [pages/me/settings.vue](../../员工App/pages/me/settings.vue)：通知开关 / 清缓存 / 关于

#### 4. 后端任务

- [ ] 修复第一阶段联调中暴露的接口缺陷
- [ ] 新增 PC 后台 4 个剩余管理页：customers / customer-transfers / customer-tags / system-announcements

#### 5. API 任务

无新增（沿用第一阶段全部 38 个接口）。

#### 6. 数据库任务

- [ ] 根据联调反馈调整索引 / 字段类型

#### 7. 交付物

- 可在内部测试机上扫码安装的 APK
- v1 H5 可访问（无离线）
- PC 后台 6 个新页面全部完成

#### 8. 验收标准

- [ ] 三个角色账号都能登录
- [ ] 5 大模块所有页面在线状态下功能完整
- [ ] 改密、改资料、客户 CRUD、跟进 CRUD、转出申请、审批、消息已读 全链路通
- [ ] 接口性能达标
- [ ] 既有 admin 后台、家长小程序无回归

#### 9. 风险与依赖

- UniApp 在低端 Android 设备上图片压缩耗时长 → 需测试至少 5 个机型
- 大列表（200+ 条客户）滚动卡顿 → 需虚拟列表（uview-plus 不带，可考虑 z-paging）
- iOS 原生功能（拨号、相机）某些版本兼容问题 → 测试 iOS 14~17

---

### 第三阶段：离线本地库与同步

#### 1. 阶段目标

让员工 App 在断网情况下完整可用，连网后 30 秒内自动同步。**这是关键路径，工作量约占整体 30%**。

#### 2. 页面 / 模块范围

| 端 | 模块 | 说明 |
| --- | --- | --- |
| 员工 App | 全部 | 改造所有读写为本地优先 |
| 员工 App | 同步引擎 | 新建 sync 模块 |
| 员工 App | 冲突合并 | 新建 conflict 页面 |
| 后端 | sync | 完善 sync/batch 处理 |

#### 3. 前端任务

##### 3.1 本地数据库

- [ ] [db/schema.ts](../../员工App/db/schema.ts)：定义 6 张本地表 DDL（local_employee / local_customers / local_follow_ups / local_notifications / pending_op / local_attachment）
- [ ] [db/migrations.ts](../../员工App/db/migrations.ts)：版本号管理 + 升级
- [ ] [db/repo.ts](../../员工App/db/repo.ts)：每张表 CRUD 抽象
- [ ] H5 fallback：检测到非 APK 平台直接禁用本地库 + 强制在线模式

##### 3.2 同步引擎

- [ ] [stores/sync.ts](../../员工App/stores/sync.ts)：同步状态机（idle / syncing / failed / conflict）
- [ ] [api/sync.ts](../../员工App/api/sync.ts)：调 `POST /sync/batch`
- [ ] [utils/network.ts](../../员工App/utils/network.ts)：实时探测真在线（health 探活）
- [ ] [utils/uuid.ts](../../员工App/utils/uuid.ts)：v4 生成 client_uuid
- [ ] 同步触发时机（5 个）实现：登录后 / 网络恢复 / 下拉 / 30s 轮询 / 提交后立即
- [ ] 重试策略：1s → 5s → 30s → 5min，最多 5 次

##### 3.3 业务模块改造（核心）

- [ ] **客户 CRUD**：`createCustomer / updateCustomer / softDelete` 都先打本地，再 push 到 pending_op
- [ ] **跟进 CRUD**：同上
- [ ] **客户搜索**：在线全网模糊匹配 + 离线本地 LIKE，merge 去重
- [ ] **附件上传**：拍照立即写本地路径，后台空闲时上传，成功后替换 photo_id
- [ ] **消息列表**：在线优先，本地缓存后备
- [ ] **登录持久化**：7 天免登逻辑（本地 token + employee profile + 过期时间）

##### 3.4 冲突合并 UI

- [ ] [pages/customer/conflict.vue](../../员工App/pages/customer/conflict.vue)：左"我的"右"服务器"，按字段勾选 → 合并
- [ ] [components/conflict-row.vue](../../员工App/components/conflict-row.vue)：单字段对比组件
- [ ] [utils/conflict.ts](../../员工App/utils/conflict.ts)：合并逻辑

##### 3.5 同步状态可视化

- [ ] [components/sync-indicator.vue](../../员工App/components/sync-indicator.vue) 升级：红 / 黄 / 绿圆点 + 计数
- [ ] [pages/me/sync-status.vue](../../员工App/pages/me/sync-status.vue)：队列详情 + 重试 / 清空 / 删除单条

#### 4. 后端任务

- [ ] [services/syncService.js](../../node后端（新增）/services/syncService.js) 完善：
  - 按 type 分发到对应 service
  - 处理 4 种结果（ok / duplicate / conflict / validation_failed）
  - 单 envelope 内的 op 顺序处理（同 customer_uuid 的 create + update 不能并行）
- [ ] 性能优化：批量查询 client_uuid 已存在性，避免逐条查 DB

#### 5. API 任务

| 接口 | 强化点 |
| --- | --- |
| `/api/v1/employee/sync/batch` | 完善 envelope 处理逻辑、性能优化 |

#### 6. 数据库任务

| 表 | 任务 |
| --- | --- |
| `customers` `follow_ups` `customer_transfers` | 验证 client_uuid 索引高效 |

#### 7. 交付物

- APK 离线模式可用：
  - 飞行模式登录（用 7 天内本地缓存）
  - 飞行模式新建客户、写跟进、拍照
  - 网络恢复 30s 内自动同步
- 冲突合并 UI 可演示

#### 8. 验收标准

- [ ] 飞行模式下完整跑通：新建客户 + 写跟进 + 拍照 + 设提醒
- [ ] 网络恢复后 30 秒内队列自动同步并 toast 提示
- [ ] 同一 client_uuid 重复提交服务端只生成一条
- [ ] 附件上传失败可重试 3 次
- [ ] 同一客户在两台设备同时改，第二台触发冲突合并 UI
- [ ] 切换账号前如果 pending_op 不为空，强制要求"先同步"或"主动清空"

#### 9. 风险与依赖

- UniApp SQLite 在某些 Android 设备初始化失败 → 加 try/catch + fallback 到 plus.storage（KV 模式）
- 弱网下同步反复失败 → 指数退避 + 详细日志
- 冲突合并 UI 复杂度高 → 限定 v1 只支持 customers 与 follow_ups 两类实体的冲突
- 服务端时钟与设备时钟差太大 → 服务端写入用 NOW()；客户端只用本地排序

---

### 第四阶段：联调与压测

#### 1. 阶段目标

确保员工 App 性能、稳定性、兼容性达标，所有验收点通过。

#### 2. 任务

##### 2.1 性能压测

- [ ] 客户列表 200 条 ≤ 800ms
- [ ] 写跟进（在线）≤ 600ms
- [ ] 同步 100 条 ops ≤ 5s
- [ ] App 冷启动 ≤ 2s
- [ ] 单 APK 一周本地存储 ≤ 80MB

##### 2.2 弱网测试

- [ ] 信号 1 格 / 切换 4G ↔ WiFi / 飞行模式打开关闭
- [ ] 同步成功率 ≥ 95%

##### 2.3 兼容性测试

- [ ] Android 5+ 至 14（小米、华为、OPPO、vivo 各 1 台）
- [ ] iOS 14+ 至 17（iPhone 8 / 12 / 14 / 15 各 1 台）
- [ ] H5 浏览器（Chrome / Safari / 微信内置）

##### 2.4 回归测试

- [ ] 家长端小程序所有页面无回归
- [ ] PC 管理后台既有页面无回归
- [ ] trading-platform 仍正常

##### 2.5 安全测试

- [ ] 错误密码登录 5 次后被锁
- [ ] employees JWT 不能调 admin 或 mobile 接口
- [ ] HTTPS 证书有效
- [ ] 客户归属隔离生效

#### 3. 交付物

- 性能测试报告
- 弱网测试报告
- 兼容性测试报告
- 缺陷清单 + 修复

#### 4. 验收标准

- 全部见 [ACCEPTANCE_员工app.md](ACCEPTANCE_员工app.md) 验收清单

#### 5. 风险与依赖

- 真机数量不够 → 用云测试平台（perfdog / TestBird）
- 弱网模拟工具 → Charles 或 Network Link Conditioner

---

### 第五阶段：灰度发布

#### 1. 阶段目标

把 APK 安全部署给真实员工，监控生产，处理首批反馈。

#### 2. 任务

##### 2.1 APK 签名

- [ ] 生成 release.keystore（git-crypt 加密保存）
- [ ] 用 HBuilderX 云打包 + 自签名
- [ ] APK 文件名规范：`shi-li-employee-{version}-{build}.apk`

##### 2.2 分发

- [ ] 上传 APK 到 [/www/wwwroot/app-downloads/](../../../wwwroot/app-downloads/)
- [ ] 生成下载页（带二维码）
- [ ] 内网通知员工扫码下载

##### 2.3 培训

- [ ] 编写《员工 App 操作手册》（PDF）
- [ ] 录制 5 分钟操作演示视频
- [ ] 部门主管线下培训 1 次

##### 2.4 监控

- [ ] PC 后台加"员工 App 监控"页：在线员工数、客户增长、跟进次数
- [ ] 后端日志监控：登录失败率、同步成功率、平均响应时间
- [ ] 设置告警：登录失败率 > 30% / 同步成功率 < 90%

##### 2.5 灰度策略

- 第 1 天：3 个员工试用
- 第 3 天：扩到 1 个部门（10 人）
- 第 7 天：全公司

##### 2.6 反馈处理

- [ ] 收集首周反馈
- [ ] 修复 P0 / P1 问题
- [ ] [TODO_员工app.md](TODO_员工app.md) 记录 P2 / P3

#### 3. 交付物

- 已发布 APK
- 操作手册 + 视频
- 监控页 + 告警
- 首周反馈与处理记录

#### 4. 验收标准

- [ ] 全员安装率 ≥ 95%
- [ ] 首周登录率 ≥ 90%
- [ ] 无 P0 / P1 缺陷
- [ ] 反馈分类与处理记录在 [ACCEPTANCE_员工app.md](ACCEPTANCE_员工app.md)

#### 5. 风险与依赖

- 老员工不会装 APK / 不会用 → 培训补强 + 1 对 1 帮助
- iOS 用户暂时无 App → 走 H5 临时使用，等 iOS 内测包

---

## 四、关键依赖与里程碑

| 里程碑 | 时间 | 交付物 |
| --- | --- | --- |
| M1 后端打通 | 第 6 天 | 38 个接口 + Postman 集合 |
| M2 在线 APK | 第 14 天 | 内测 APK，可登录可跑全流程（在线） |
| M3 离线 APK | 第 23 天 | 离线 APK，飞行模式可用 |
| M4 验收 | 第 27 天 | 全部验收点通过 |
| M5 上线 | 第 30 天 | 全员安装 |

## 五、并行机会

- 第一阶段：后端开发 + PC 后台员工管理页可**并行**（不同人）
- 第二阶段：UniApp 5 大模块可**部分并行**（一人主负责，其他人补 2~3 个独立页面）
- 第三阶段：**不可并行**，离线引擎是单点
- 第四阶段：性能 / 弱网 / 兼容三类测试可**并行**
- 第五阶段：培训 + 监控可**并行**

## 六、人力建议

- 后端 1 人 全程参与
- 前端 2 人（其中一人主负责离线引擎，另一人写业务页面）
- PC 后台 1 人 兼职（约占 30% 时间）
- 测试 1 人 第四 / 五阶段全职
- 产品 1 人 首尾参与（PRD / 验收）

## 七、避免遗漏的检查清单

实施前请逐项检查：

- [ ] PRD 已最终化（[新增员工app PRD.md](../../新增员工app%20PRD.md)）
- [ ] DESIGN 中所有接口都有对应 service 方法
- [ ] schema 字段全部覆盖前端表单与展示
- [ ] 离线策略有同步入口、幂等键、冲突合并三件套
- [ ] 安全设计覆盖鉴权 / 数据隔离 / 审计 / 限流
- [ ] PC 后台 6 个新页面定义清楚
- [ ] APK 签名 keystore 准备到位
- [ ] 短信服务商账号申请到位
- [ ] HBuilderX 云打包账号 / 证书准备到位

实施过程中如发现 PRD 或 DESIGN 错误，**回头改文档**保持单一真相，不要走"代码与文档不一致"的路径。
