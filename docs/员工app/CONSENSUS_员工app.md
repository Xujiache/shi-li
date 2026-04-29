# CONSENSUS_员工app

## 一、最终需求描述

### 1.1 目标

为 shi-li 项目新增一个**面向内部员工的客户管理 App（员工 App）**，覆盖客户全生命周期、跟进日志、客户分配 / 转出审批、消息推送、个人业绩统计五大场景；与现有家长端小程序、PC 管理后台、Node 后端协同；输出 UniApp 一码三端（APK + iOS App + H5）。

### 1.2 交付范围

#### 后端

- 新增 10 张表：`departments / employees / employee_sessions / customers / customer_attachments / follow_ups / customer_transfers / notifications / customer_tags / system_announcements`
- 新增路由命名空间 `/api/v1/employee/*`，**38 个接口**，分布于 9 个子模块（auth / me / customers / followUps / transfers / notifications / team / uploads / sync）
- 新增 7 个 services：employeeService / customerService / followUpService / transferService / notificationService / syncService / departmentService（admin 端用）
- 新增审计日志支持 `operator_type='employee'`
- 新增环境变量：`JWT_EMPLOYEE_SECRET / JWT_EMPLOYEE_EXPIRES_IN / EMPLOYEE_SYNC_BATCH_MAX / EMPLOYEE_SINGLE_DEVICE / SMS_PROVIDER / SMS_API_KEY` 等

#### PC 管理后台

- **Phase 1 交付 2 个管理页**：employees / departments（最小集，让 admin 能开员工 / 部门账号）
- **Phase 2 增量交付 4 个管理页**：customers（全局视图）/ customer-transfers（审批）/ customer-tags（标签字典）/ system-announcements（公告管理）
- 既有页面**零改动**

#### 员工 App（UniApp）

- 新工程目录 `员工App/`，独立 manifest.json
- 6 大功能模块、~25 个页面
- 输出 APK（v1 主交付）+ H5（备用，无离线能力）
- 角色感知 tabBar（staff / manager 两套）
- 完整离线 + 同步管道（local SQLite + pending_op 队列 + 冲突合并 UI）

#### 文档

- 7 件套：[ALIGNMENT](ALIGNMENT_员工app.md) / [CONSENSUS](CONSENSUS_员工app.md) / [DESIGN](DESIGN_员工app.md) / [TASK](TASK_员工app.md) / [ACCEPTANCE](ACCEPTANCE_员工app.md) / [FINAL](FINAL_员工app.md) / [TODO](TODO_员工app.md)
- 已存在的 [新增员工app PRD.md](../../新增员工app%20PRD.md) 为对外 PRD 主文档

### 1.3 端范围

| 端 | 调整 | 说明 |
| --- | --- | --- |
| 家长端微信小程序 | **不动** | 仅由后端隐式同步 customers ⇄ users 字段 |
| PC 管理后台（既有页面） | **不动** | Phase 1 新增 2 页（employees / departments），Phase 2 新增剩余 4 页 |
| Node 后端 | **增量** | 新增表 / 路由 / services；既有接口 0 改动 |
| 员工 App | **新建** | UniApp 工程，APK + H5 |
| trading-platform（同机另一项目） | **零影响** | 不动其端口、库、PM2 进程 |

---

## 二、验收标准

### 2.1 文档验收标准

- 已创建 [新增员工app PRD.md](../../新增员工app%20PRD.md)（已有，48KB / 12 章 / 44 三级标题）
- 已创建 [docs/员工app/](.) 七件套
- 各文档内容可直接作为后续开发输入
- 文档中 schema、API 列表、状态机、任务拆解可执行
- 与项目现有文档风格一致（章节编号、表格、Mermaid）

### 2.2 后端验收标准

- 后端可启动，`/api/v1/employee/auth/login` 接口能正常签发 JWT
- 10 张新表全部创建成功，幂等执行 `npm run init-db` 不报错
- 既有 19 张表数据无任何变更
- 38 个新接口在 Postman 集合内全部 200 返回（含正面 + 反面用例）
- 审计日志在既有 `admin_operation_logs` 表（已扩 `operator_type` 字段）中可按 `operator_type='employee'` 查询
- 单元测试覆盖：登录、改密、客户 CRUD、跟进 CRUD、转出审批、同步去重 7 个核心服务方法
- 接口性能达标：客户列表 200 条 ≤ 800ms，写跟进在线 ≤ 600ms

### 2.3 PC 管理后台验收标准

#### Phase 1（最小集）

- 2 个新页面 CRUD 全部可用：员工管理 / 部门管理
- 员工管理可：建账号 / 改角色 / 改部门 / 启停 / 重置密码
- 部门管理可：建 / 改 / 停用
- 既有 [vision-admin](../../后台/art-lnb-master/src/views/vision-admin/) 下的页面访问无回归

#### Phase 2（在 Phase 1 基础上增量）

- 4 个新页面 CRUD：客户管理 / 转出审批 / 标签字典 / 公告管理
- 客户管理可：跨员工查看（manager 限部门，admin 全公司）
- 转出审批可：通过 / 驳回，结果落库并通知
- 标签字典可：增 / 改 / 启停
- 公告可：发布 / 置顶 / 设过期 / 强制弹窗

### 2.4 员工 App 验收标准

#### 在线场景

- 员工 / 主管账号都能登录，看到匹配 tabBar
- 员工首次登录强制改密
- 异地登录触发短信验证码二次校验
- 单设备限制开启时，第二台设备登录第一台 token 失效
- 工作台正确展示 4 个数据卡片 + 公告
- 客户列表筛选 / 排序 / 搜索全部生效
- 点手机号直接拨打
- 客户详情 4 个 Tab（基本信息 / 跟进记录 / 档案 / 提醒）数据正确
- 改基本信息后小程序家长端立即可见
- 写跟进日志后列表立即刷新；仅自己创建的跟进可改 / 删
- 提交转出申请后，主管能看到待办、能通过 / 驳回
- 客户分配 / 转入 / 转出审批结果 / 客户信息变更 4 类通知正确推送到目标员工
- 跟进提醒到点产生站内消息
- 一键清空已读消息生效
- 我的中心：业绩统计、跟进趋势图正确
- 团队页只显示同部门同事，不显示客户数

#### 离线场景

- 飞行模式登录可以（用 7 天内本地缓存）
- 飞行模式下完整跑通：新建客户 + 写跟进 + 拍照 + 设提醒
- 网络恢复后 30 秒内队列自动同步并 toast 提示
- 同一 client_uuid 重复提交服务端只生成一条
- 附件上传失败可重试 3 次，仍失败标红并允许手动重传
- 同一客户在两台设备同时改，第二台提交时正确触发冲突合并 UI
- 切换账号前如果 pending_op 不为空，强制要求"先同步"或"主动清空"

### 2.5 兼容性验收标准

- [users](../../node后端（新增）/scripts/db/core.js) / children / appointment_records / checkup_records / questionnaire_* 数据无变化
- 家长端小程序所有页面无回归 bug
- trading-platform 进程仍正常（端口 3000、库 trading_system、PM2 trading-server / vpn-sub-server 都没变化）
- 既有 admin 后台的 `/api/v1/admin/*` 接口 0 改动

### 2.6 安全验收标准

- 错误密码登录 5 次后被锁 15 分钟
- employees JWT 不能调 `/api/v1/admin/*` 或 `/api/v1/mobile/*`
- HTTPS 证书有效，HTTP 重定向到 HTTPS
- employees 看不到其他员工的客户（service 层校验）
- 主管看不到其他部门客户

### 2.7 真实场景验收标准

- 员工日均跑 30 个客户跟进无明显卡顿
- 主管处理 50 条转出申请用时 ≤ 30 分钟
- 数据同步在弱网（信号 1 格）下成功率 ≥ 95%
- 单台 APK 一周本地存储 ≤ 80MB

---

## 三、技术实现共识

### 3.1 前端共识

- **技术栈**：UniApp 3 + Vue 3 + `<script setup>` + Pinia + uview-plus
- **构建产物**：APK（主） / iOS（TestFlight） / H5（备用，无离线）
- **HTTP 封装**：自封 `http.ts`，含拦截器、token 自动刷新、离线兜底、自动重试
- **本地数据库**：APK 用 `uni.createSQLDatabase`；H5 禁用离线
- **图片处理**：`uni.chooseImage` → `uni.compressImage` → 本地路径 → 异步上传
- **拨号**：`uni.makePhoneCall`，列表点手机号直接拨打不弹确认
- **UI 一致性**：尽量沿用家长端小程序的视觉风格与组件命名
- **路由**：每个角色独立 tabBar，登录后根据 `auth.role` 调 `uni.setTabBarItem` 动态切换

### 3.2 后端共识

- **复用 vision-server**：员工 App 后端不另起进程；继续用 PM2 `vision-server`（端口 3100）
- **路由前缀**：`/api/v1/employee/*` 全新命名空间
- **JWT 隔离**：employees 用独立 `JWT_EMPLOYEE_SECRET`，type 字段强制 `employee`
- **Service 层**：每个领域一个 service，透传 service ↔ route，不在 route 内嵌业务逻辑
- **错误处理**：复用 [utils/appError.js](../../node后端（新增）/utils/appError.js) `createAppError(message, statusCode)` + [utils/asyncRoute.js](../../node后端（新增）/utils/asyncRoute.js)
- **审计**：所有 employee 写操作走审计中间件，operator_type='employee'
- **限流**：登录 5 次 / 5 分钟 / phone+IP 双维度
- **离线接口**：单一 `POST /api/v1/employee/sync/batch` 入口处理 envelope，按 type 分发到对应 service

### 3.3 数据库共识

- 数据库继续用现有的 `vision_management`，不另建库
- 新增表全部 InnoDB + utf8mb4 + utf8mb4_unicode_ci
- 所有表保留 `created_at` / `updated_at` 字段
- 所有写操作的客户端 UUID 字段 `client_uuid` 加 UNIQUE 索引，做幂等去重
- 嵌套结构（标签 / 调理方案）首版用 JSON
- 不写历史数据迁移脚本，新表从 0 开始

### 3.4 部署共识

- Nginx 配置不改动，员工 App 接口同走 `/api/` 反代（既有 [/etc/nginx/sites-available/shi-li](../../../../etc/nginx/sites-available/shi-li) 已支持）
- 员工 App H5 fallback（如启用）部署到 `/www/wwwroot/vision-employee-h5/`，新增 Nginx server 块或子路径
- APK 签名走 release.keystore（提交到 secrets / git-crypt，不入仓库）
- 不影响 trading-platform 端口、目录、进程

---

## 四、边界与限制

### 4.1 范围限制

- 只做客户管理 + 跟进日志 + 转出审批 + 消息中心 + 个人统计 5 类核心能力
- 不做客户公海 / 线索池 / 营销自动化 / 群发推送 / BI 看板
- 不做团队协作（群聊、@、文件共享）
- 不做实时音视频通话或录音
- 不做与企业微信 / 钉钉 / 飞书的接口对接
- 不做检测设备硬件直连
- v1 不上 App Store；iOS 走 TestFlight 内测

### 4.2 不确定项处理规则

- **若实现中遇到"是否改变现有 schema"问题**：优先用新表 + 软关联，不改既有表
- **若遇到 PRD 与实际开发冲突**：以 PRD 为基准，发现 PRD 错误回头改 PRD（保持单一真相）
- **若遇到性能不达标**：先满足功能、再做优化；列入 TODO_员工app.md
- **若遇到第三方依赖（短信 / unipush）**：v1 优先内置阿里云任一服务商，可后期切换
- **若遇到离线冲突合并复杂度爆炸**：UI 层只支持"用我的 / 用服务器 / 字段级合并"三选一，不做更复杂规则
- **若遇到设备兼容性问题（特定 Android 型号）**：v1 fallback 到 plus.storage（KV 模式），列 TODO

### 4.3 非功能限制

- **离线**：H5 不做离线；登录、删除、审批 3 类操作必须在线
- **多账号**：一台设备同时只允许 1 个员工账号 active
- **导出**：默认禁用，admin 在 PC 后台为特定员工开开关
- **数据可见性**：staff 仅自己客户、manager 仅本部门、admin 全公司
- **合规**：所有审计日志保留 ≥ 1 年，敏感字段（手机号）对非主管脱敏展示

---

## 五、最终共识结论

本次实施分 5 个阶段（详见 [TASK_员工app.md](TASK_员工app.md)）：

1. **后端打地基**（5~6 工作日）：schema + 路由骨架 + 接口 + admin 加员工管理页
2. **UniApp 在线主流程**（7~8 工作日）：5 大模块在线版 + APK 出包
3. **离线本地库与同步**（8~9 工作日）：local SQLite + pending_op + sync/batch + 冲突合并
4. **联调与压测**（4 工作日）：性能、回归、弱网测试
5. **灰度发布**（3 工作日）：真机验收、APK 签名分发、培训

**总工期约 30 工作日（约 6 周）**。Phase 3 是关键路径，资源不能并行省。

通过本任务，shi-li 项目从"家长 + 管理员"二元模型升级为"家长 + 员工 + 主管 + 管理员"四元模型，业务团队首次拥有移动端工具，预计客户跟进数字化率 ≥ 95%。
