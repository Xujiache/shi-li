# ALIGNMENT_员工app

## 一、原始需求

### 1.1 用户原始诉求

1. 在现有 shi-li（儿童视力管理）项目基础上，**新增一个面向内部员工的客户管理 App**。
2. 员工 App 用于员工日常维护客户、写跟进日志、客户分配 / 转入转出审批、消息推送、个人业绩统计等场景。
3. 与现有家长端微信小程序、PC 管理后台、Node 后端协同；**不影响**现有任何端的运行。
4. 在同一台服务器上部署，与已上线的 trading-platform 项目互不干扰。

### 1.2 已提供材料

- 用户在 `/www/shi-li/新增员工app PRD.md` 写了功能模块草稿（六大模块：登录页 / 首页 / 客户管理 / 跟进日志 / 消息中心 / 我的中心）
- 现有项目结构：
  - `小程序端/最终（视力）` — 家长端 UniApp / 小程序
  - `后台/art-lnb-master` — Vue3 管理后台
  - `node后端（新增）` — Express + MySQL + JWT，已上线
- 已确认的关键决策（四项）：
  - 前端形态：**UniApp 一码三端**（APK + iOS + H5）
  - v1 角色范围：**员工 + 主管 一次性上**（管理员仍走 PC 后台）
  - 认证方式：**手机号 + 密码**（管理员后台预先开账号）
  - 离线策略：**v1 全功能可离线，连网按需同步**

### 1.3 上下文沉淀

- shi-li 已完成"云开发迁移到 Node 后端"主迁移，数据库为 MySQL `vision_management`
- 当前后端 PM2 进程：`vision-server`，监听 `127.0.0.1:3100`，对外通过 Nginx 代理（`api.gmxd.asia` / `admin.gmxd.asia`）
- 同机另一项目 trading-platform 跑在 `:3000`，使用独立数据库 `trading_system`，**不能受影响**
- 现有数据库表：`users / admins / children / appointment_* / checkup_records / questionnaire_* / school_classes / banners / system_configs / uploads / analytics_*`，共 19 张

---

## 二、需求理解

### 2.1 项目目标理解

shi-li 现有三端覆盖了"家长 → 系统"的链路，但**业务团队（顾问 / 销售 / 客服）日常缺少手机端工具**：客户跟进、转介、电话沟通靠微信群手抄或登 PC 后台查信息（PC 后台没有"客户视角"，只有"用户列表"）。员工 App 要补齐"员工 → 客户"这条链路，让员工在手机上完成客户全生命周期管理。

### 2.2 业务角色理解

| 角色 | 说明 | 主要诉求 |
| --- | --- | --- |
| 员工 / staff | 一线顾问 / 销售 / 客服 | 看自己名下客户、跟进、写日志、转出申请 |
| 主管 / manager | 部门负责人 | 看部门员工客户、审批转出申请、给下属分配客户 |
| 系统管理员 / admin | 复用现有 admins 表，仅 PC 后台使用 | 全局配置、跨部门调度、停用员工 |
| 家长 / customer | 现有家长端用户的"销售视角" | 不直接使用员工 App，但其在小程序的行为会同步成 customers 数据 |

### 2.3 多端范围理解

| 端 | 现状 | 本次目标 |
| --- | --- | --- |
| 家长端微信小程序 | 已上线 | **不动**，只新增"customers 与 users 通过 phone 软关联" |
| 管理后台（PC） | 已上线 | **新增**：employees / departments / customers / customer-transfers / customer-tags / system-announcements 6 个管理页 |
| Node 后端 | 已上线 | **新增**：`/api/v1/employee/*` 命名空间，10 张新表 |
| 员工 App | 不存在 | **新建**：UniApp 工程，输出 APK + H5 |

### 2.4 核心业务流程理解

1. **员工日常**：登录 → 选今日工作 → 看待跟进客户列表 → 拨号 / 写跟进 → 设下次提醒
2. **新增客户**：员工在 App 内手动建档 OR 家长在小程序自注册（自动建 customers 记录待分配）
3. **客户分配**：admin / manager 在管理界面把待分配客户分给某员工 → 员工收到通知
4. **客户转出**：员工觉得客户不适合自己 → 提交转出申请 → manager 审批 → 通过后客户归到新员工
5. **离线作业**：员工外出（地铁 / 客户家 / 弱网咖啡馆）也能录跟进、新建客户、拍照，回到信号区自动同步
6. **数据同步**：customers 与 小程序 users 通过 phone 软关联，互改互见

---

## 三、任务边界

### 3.1 本次纳入范围

- 新增 1 个 UniApp 工程 `员工App/`，输出 APK + H5
- 后端新增 10 张表：`departments / employees / employee_sessions / customers / customer_attachments / follow_ups / customer_transfers / notifications / customer_tags / system_announcements`
- 后端新增路由命名空间 `/api/v1/employee/*`，**38 个接口**
- 后端新增 6 个 services：`employeeService / customerService / followUpService / transferService / notificationService / syncService`
- PC 管理后台新增 6 个管理页（员工 / 部门 / 客户 / 转出审批 / 标签 / 公告）
- 离线本地数据库 + 同步管道（client_uuid 幂等 + 乐观锁 + 冲突合并 UI）
- 员工身份认证（含异地登录二次验证、单设备登录、首登强制改密）
- 配套 7 件套文档（本套）

### 3.2 本次不纳入范围

- 客户线索（leads）池抓取、广告投放归因
- 营销自动化 / 群发短信 / 邮件营销
- 实时音视频通话 / 录音
- 跨机构数据互通 / 多租户
- 上 App Store 公开发行（v1 内部 APK 装机）
- BI / 高级数据分析（基础统计够用即可）
- 跨部门客户调拨、客户公海、流失自动回收
- 团队协作功能（如群聊、@提及）
- 与企业微信 / 钉钉打通

### 3.3 约束条件

- **不影响现有项目**：trading-platform、家长小程序、PC 管理后台既有页面，零回归
- **数据库变更幂等**：所有 schema 变更用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，老库执行 `npm run init-db` 自动升级
- **JWT 隔离**：employees 用独立 `JWT_EMPLOYEE_SECRET`，不与 mobile/admin 串
- **离线边界**：H5 不做离线；登录、删除、审批操作必须在线
- **资源隔离**：员工 App 后端不另起进程，仍跑在 `vision-server`（端口 3100）
- **密码安全**：所有员工密码 bcrypt 哈希，初始密码首次登录强制改

### 3.4 性能与容量

- 单台 APK 一周本地存储 ≤ 80MB
- 客户列表 200 条响应 ≤ 800ms
- 同步 100 条 ops ≤ 5s
- 离线写入响应 ≤ 50ms（本地写完即返回）

---

## 四、现有项目对齐

### 4.1 已有文档与模式

- 项目根目录有 [说明文档.md](../../说明文档.md) 总览
- [/www/shi-li/新增员工app PRD.md](../../新增员工app%20PRD.md) 为本任务的 PRD 主文档（已交付，48KB / 12 章 / 44 三级标题）
- [docs/云开发迁移到Node后端/](../云开发迁移到Node后端/) 七件套是本任务文档的风格基准
- [docs/问卷系统新增/](../问卷系统新增/) / [docs/问卷入口与舌诊扩展/](../问卷入口与舌诊扩展/) 也是同风格参考

### 4.2 可复用结构

| 位置 | 可复用内容 | 复用方式 |
| --- | --- | --- |
| [node后端（新增）/utils/jwt.js](../../node后端（新增）/utils/jwt.js) | 双端 JWT 中间件 | 加 `USER_TYPES.EMPLOYEE` 第三种 type |
| [node后端（新增）/utils/bcrypt.js](../../node后端（新增）/utils/bcrypt.js) | 密码哈希 | 直接复用 |
| [node后端（新增）/utils/response.js](../../node后端（新增）/utils/response.js) | 标准响应 | 直接复用 |
| [node后端（新增）/utils/db.js](../../node后端（新增）/utils/db.js) | MySQL 连接池 + 事务 | 直接复用 |
| [node后端（新增）/utils/asyncRoute.js](../../node后端（新增）/utils/asyncRoute.js) | 异步路由包装 | 直接复用 |
| [node后端（新增）/utils/appError.js](../../node后端（新增）/utils/appError.js) | 业务错误封装 | 直接复用 |
| [node后端（新增）/services/uploadService.js](../../node后端（新增）/services/uploadService.js) | 图片上传 | 直接复用 |
| [node后端（新增）/services/userService.js](../../node后端（新增）/services/userService.js) | CRUD 风格 | 仿写 employeeService / customerService |
| [node后端（新增）/services/adminService.js](../../node后端（新增）/services/adminService.js) | 登录 / 改密 | 仿写 employee 登录 |
| [node后端（新增）/middlewares/adminLog.js](../../node后端（新增）/middlewares/adminLog.js) | 审计日志 | 改名 auditLog 并支持 employee operator_type |
| [node后端（新增）/routes/middlewares/permission.js](../../node后端（新增）/routes/middlewares/permission.js) → `isSuperAdmin` | 角色守卫骨架 | 仿写 `requireEmployeeRole(...roles)` |
| [小程序端/最终（视力）](../../小程序端/最终（视力）) | UniApp 工程示例 | 复用 `request` 封装、token 持久化、`uni.chooseImage` 经验 |
| [后台/art-lnb-master/src/views/vision-admin/](../../后台/art-lnb-master/src/views/vision-admin/) | Vue 后台页面骨架 | 仿写 employees / departments / customers 等新页面 |

---

## 五、疑问澄清

### 5.1 必须确认项（已锁定）

| 优先级 | 问题 | 影响范围 | 当前状态 |
| --- | --- | --- | --- |
| 高 | 前端形态选 UniApp 还是小程序 / H5 | 整个工程结构 | 已确认：**UniApp** |
| 高 | v1 上几个角色 | 后端表 / 前端 tabBar | 已确认：**员工 + 主管**（admin 走 PC） |
| 高 | 认证方式 | 后端 auth 模块 | 已确认：**手机号 + 密码**（首登强制改密） |
| 高 | 离线深度 | 工期 / 工程复杂度 | 已确认：**v1 全功能离线** |
| 中 | 客户与家长 users 是否强外键 | 数据一致性 | 已确认：**软关联**（customers.user_id NULL，phone 字段 link） |
| 中 | 员工与管理员账号是否复用 | 表结构 / 登录逻辑 | 已确认：**独立 employees 表**（与 admins 隔离） |
| 中 | 异地登录处理 | 安全 / 用户体验 | 已确认：**强制短信验证码二次校验** |

### 5.2 可带假设继续项

| 问题 | 默认假设 | 风险 |
| --- | --- | --- |
| 部门是否多级 | 单级即可，但 schema 留 `parent_id` 字段 | 后期扩多级无需迁移 |
| 短信服务商 | v1 接阿里云 / 腾讯云任一 | 切换需改 SMS_PROVIDER |
| iOS 上架 | v1 不上 App Store，走 TestFlight 内测 | 后期需补审核材料 |
| 客户标签是否多分组 | v1 平铺标签字典，不分组 | 标签数 > 30 后再考虑分组 |
| 业绩统计周期 | v1 周 / 月 / 季度切换；不做实时排行 | 后期补 KPI 模块 |
| 数据导出权限 | v1 默认禁用，admin 在 PC 后台开开关 | 合规性更稳 |

### 5.3 落地阶段需用户决策的项

下面这些等到落地阶段再确认，先按假设走：

- 异地登录的 IP 段判定阈值（默认按 /16 网段差异判异地）
- 员工头像默认图（可用 display_name 首字符做色块）
- 公告富文本编辑器选型（默认 PC 后台用 wangEditor，员工 App 不编辑只阅读）
- 客户号 customer_no 编码规则（默认 `C` + 8 位日期 + 4 位自增）
- 离线本地存储上限报警阈值（默认 80% 时弹提醒）

---

## 六、当前对齐结论

本次任务的本质是：**为 shi-li 项目补齐"员工视角"的 CRM 移动端**，让业务团队能在手机上闭环管理客户。

技术路径明确：
- 后端在 `node后端（新增）` 增量新增表与路由，**不重构**
- 前端新增 UniApp 工程 `员工App/`，与现有家长端工程同栈但完全独立
- PC 管理后台新增 6 个页面，**不改**现有页面
- 部署沿用 `vision-server` PM2 进程 + Nginx，端口不增不减

可直接进入 CONSENSUS 验收共识与 DESIGN 详细设计阶段。
