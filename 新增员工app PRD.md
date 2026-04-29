# 视力管理系统 — 员工管理 App PRD（v1.0）

> 文档版本：v1.0  ·  最后更新：2026-04-27  ·  作者：架构组
>
> 本 PRD 是 shi-li 在现有家长端小程序 + PC 管理后台 + Node 后端基础上，**新增一个面向内部员工的客户管理 App**。
> 本文档与 [docs/云开发迁移到Node后端/](docs/云开发迁移到Node后端/) 五件套（ALIGNMENT/CONSENSUS/DESIGN/TASK/ACCEPTANCE）协同；落地阶段再拆 `docs/员工app/` 配套文档。

---

## 第 1 章 项目概述

### 1.1 业务定位

shi-li 现有三端：

| 端 | 角色 | 状态 |
|---|---|---|
| 家长端微信小程序 | 家长（注册用户） | 已上线，承接预约、查看检测记录、问卷 |
| PC 管理后台 | 系统管理员 | 已上线，承接配置、审核、统计 |
| Node 后端 | 服务方 | 已上线，提供 `/api/v1/{mobile,admin}/*` |

**缺口**：业务团队（顾问 / 销售 / 客服）日常要做客户跟进、转介、电话沟通，但当前没有任何工具——他们要么用微信群手工记，要么登 PC 后台查家长信息（PC 后台没有"客户视角"，只有"用户列表"），手机上根本动不了。

### 1.2 项目目标

通过 **UniApp 一码三端（APK + iOS App + H5）** + **后端补 employees / customers / follow_ups / customer_transfers / notifications 表 + 新 `/api/v1/employee/*` 命名空间** + **完整离线能力**，让员工在手机上完成：

- 自己名下客户的全生命周期管理（看 / 增 / 改 / 跟进 / 转出）
- 跟进日志结构化记录与提醒
- 客户分配 / 转入转出审批流
- 消息推送中心
- 个人业绩看板

**量化目标**：

- 员工 90% 的客户操作在 App 上完成，PC 后台只用于管理员审核
- 跟进日志数字化率 ≥ 95%
- 客户转出申请到审批结果时延 ≤ 24 小时
- 离线状态下可正常记录跟进日志、新增客户，连网后 30 秒内自动同步

### 1.3 非目标（v1 不做）

- 客户线索（leads）池抓取、广告投放归因
- 营销自动化 / 群发短信 / 邮件营销
- 实时音视频通话 / 录音
- 跨机构数据互通 / 多租户
- 上 App Store 公开发行（v1 内部 APK 装机）
- BI / 高级数据分析（基础统计够用即可）

### 1.4 关键决策（已和用户确认）

| 维度 | 选择 |
|---|---|
| 前端形态 | **UniApp**（同栈复用家长小程序工程经验，输出 APK） |
| v1 角色 | **全员一次性上**（员工 + 主管 + 管理员三层） |
| 认证方式 | **手机号 + 密码**（管理员后台预先开账号） |
| 离线策略 | **v1 全功能可离线**，连网按需同步 |

---

## 第 2 章 角色与权限

### 2.1 角色定义

| 角色 code | 中文名 | 主要场景 | 关键权限 |
|---|---|---|---|
| `staff` | 员工 | 维护自己名下客户、跟进、写日志 | 看自己客户、增删改自己客户、提交转出申请 |
| `manager` | 主管（v1.0 上） | 看团队数据、审批转入转出、给下属分配客户 | 看本部门所有员工的客户、审批转出申请、分配客户 |
| `admin` | 系统管理员（**复用现有 admins 表**） | 全局配置、跨部门调度 | 所有权限 |

> v1 用 `manager` 替代我之前误以为的 "team_lead"；与现有 [admins](node后端（新增）/scripts/db/core.js) 表区分：employees 是 App 用户，admins 是 PC 后台用户，可以重叠（同一个手机号在两边各自一条）也可以独立。

### 2.2 权限矩阵

| 资源 / 操作 | staff | manager | admin (PC) |
|---|---|---|---|
| 登录 App / 改密 / 看自己资料 | ✅ | ✅ | （只用 PC） |
| 看自己名下客户 | ✅ | ✅ | ✅ |
| 看本部门所有员工的客户 | ❌ | ✅ | ✅ |
| 看全公司客户 | ❌ | ❌ | ✅ |
| 增 / 改 / 删自己名下客户 | ✅ | ✅ | ✅ |
| 改其他员工名下客户 | ❌ | ✅ 限本部门 | ✅ |
| 写跟进日志（自己客户） | ✅ | ✅ | ✅ |
| 改 / 删跟进日志 | ✅ 仅自己创建 | ✅ 仅自己创建 | ✅ 任意 |
| 提交转出申请 | ✅ | ✅ | — |
| 审批转出 / 转入申请 | ❌ | ✅ 限本部门 | ✅ |
| 直接分配客户给员工 | ❌ | ✅ 限本部门 | ✅ |
| 查看团队同事姓名 / 职位 | ✅ 仅同部门 | ✅ | ✅ |
| 导出客户数据 | ❌（可配置开关） | ✅ | ✅ |
| 看个人 / 团队业绩看板 | ✅ 仅个人 | ✅ 个人 + 团队 | ✅ 全公司 |

### 2.3 权限实现

JWT payload（type=`employee`）：

```json
{
  "id": 17,
  "phone": "13900000007",
  "display_name": "李顾问",
  "role": "staff",
  "department_id": 3,
  "type": "employee",
  "iat": 1782000000,
  "exp": 1782604800
}
```

中间件：仿照 [routes/middlewares/permission.js](node后端（新增）/routes/middlewares/permission.js) 的 `isSuperAdmin` 风格新增 `requireEmployeeRole(...)`，并在 service 层做"客户归属校验"——任何接口接受 customer_id 时强制查询 `customers.assigned_employee_id` 与当前 `req.user.id` 匹配（manager 加部门校验）。

---

## 第 3 章 功能清单（按 6 大模块）

> 模块顺序与命名沿用 [/www/shi-li/新增员工app PRD.md](新增员工app%20PRD.md) 原始草稿，本章把每条扩展成可落地的功能描述 + 接口 + 字段。

### 3.1 模块一：登录页

| 功能 | 描述 | 后端接口 |
|---|---|---|
| 账号体系 | 仅支持 admin 在 PC 后台预创建的专属账号；不支持自主注册 | `POST /api/v1/admin/employees`（PC 端） |
| 账号密码登录 | 手机号 + 密码 | `POST /api/v1/employee/auth/login` |
| 登录失败锁定 | 连续 5 次失败 → 该 phone 锁定 15 分钟 | Redis 计数器（v1 简化为内存） |
| 异地登录提醒 | 检测到 IP 段变化 → push 通知到上次设备 + 强制二次验证（短信验证码） | `POST /api/v1/employee/auth/verify-code` |
| 自动退出 | 7 天无任何 API 调用 → token 失效，重新登录 | JWT exp = 7d，每次请求滑动续期 |
| 单设备登录限制 | 默认开启：登录新设备会让旧设备 token 失效；可在 PC 后台关闭 | `system_configs.employee_single_device_only` 开关 |

#### 3.1.1 安全细则

- **密码强度**：≥ 8 位，必须含字母 + 数字
- **首次登录强制改密**：admin 创建账号时下发的初始密码必须改
- **二次验证**：异地登录 → 发短信验证码到手机 → 验证通过后方可使用
- **设备指纹**：登录时记录 `device_id` (UUID + 平台) 进 `employee_sessions`；同一员工同时只能 1 个 session 活跃（除非配置允许多设备）

### 3.2 模块二：首页（工作台）

#### 3.2.1 顶部快捷入口区（4 个，可自定义排序）

| 入口 | 跳转目标 | 角标 |
|---|---|---|
| 新增客户 | `/customer/new` | 无 |
| 跟进任务 | `/customer/list?filter=needs_follow_up` | 待跟进客户数 |
| 待办任务 | `/notifications?type=todo` | 未处理转入申请数 |
| 客户搜索 | `/customer/search` | 无 |

**自定义排序**：长按拖拽，本地存储（`uni.setStorageSync`），与服务端不同步（个人偏好）。

#### 3.2.2 数据概览区（仅个人）

调 `GET /api/v1/employee/dashboard/me` 返回：

| 卡片 | 字段 |
|---|---|
| 我的客户总数 | `customers_total` |
| 本月新增客户数 | `customers_new_this_month` |
| 本月跟进次数 | `follow_ups_this_month` |
| 待跟进客户数 | `customers_pending_follow_up`（`next_follow_up_at <= NOW()`） |

#### 3.2.3 公告通知区

- 列表前 5 条公告（来自 `system_announcements` 表，admin 在 PC 后台发布）
- 重要公告（`is_top=1`）置顶
- 点击进入公告详情；首次发布的强制弹窗一次

接口：`GET /api/v1/employee/announcements?limit=5`

### 3.3 模块三：客户管理（核心模块）

#### 3.3.1 数据同步规则

- **同步对象**：customer 基础信息（姓名、手机号、性别、年龄、学校班级、标签）+ 附件（图片）
- **同步方向**：与小程序双向实时同步
  - 小程序新增 / 修改 → 推送到对应员工 App（通过 employee_notifications + push）
  - 员工 App 新增 / 修改 → 同步到小程序（家长打开小程序时立即可见）
- **同步触发**：`customers` 表 update/insert 后 → 写 `notifications` + （v1.1）unipush

#### 3.3.2 客户列表页

**筛选**：

- 客户状态：`potential / interested / signed / lost`（潜在 / 意向 / 成交 / 流失）
- 标签：从 `customer_tags` 多选
- 跟进时间：今天 / 7 天内 / 30 天内 / 30 天前 / 自定义范围
- 创建时间：同上

**排序**：最近跟进时间倒序（默认）/ 创建时间倒序 / 客户等级（A/B/C）

**列表项展示**：

```
┌──────────────────────────────────┐
│ 李明妈妈        🟢意向            │
│ 138-0013-9000  下次跟进 03-15    │
│ 最近跟进 1 天前   [拨号] [更多]   │
└──────────────────────────────────┘
```

**快捷操作**：

- 点手机号 → 调 `uni.makePhoneCall`
- 长按 → ActionSheet：写跟进、改标签、设下次跟进、转出
- 点条目 → 客户详情

接口：`GET /api/v1/employee/customers?status=&tags=&q=&sort=&page=&page_size=`

#### 3.3.3 客户详情页

**Tab 1 — 基本信息**

| 字段 | 类型 | 说明 |
|---|---|---|
| 客户姓名 | string | 必填 |
| 性别 | enum | 男 / 女 / 未填 |
| 年龄 | int | 0~120 |
| 手机号 | string | 必填，唯一约束需弱校验（家长共用一个号常见） |
| 学校 | string | 来自 children 表（如已绑定） |
| 班级 | string | 同上 |
| 客户来源 | enum | 小程序自注册 / 员工新增 / 转入 |
| 客户状态 | enum | 潜在 / 意向 / 成交 / 流失 |
| 客户等级 | enum | A / B / C |
| 标签 | string[] | 多标签 |
| 备注 | text | 长文本 |

**Tab 2 — 跟进记录**

按时间倒序展示所有跟进日志，支持分页（每页 20）。每条卡片：

```
┌─────────────────────────────────┐
│ 📞 电话  2026-04-27 15:30      │
│ 跟进结果：有意向                 │
│ 下次跟进：2026-04-30 09:00      │
│ ──────────                       │
│ 客户表示要带孩子来检查视力，约   │
│ 周末过来；同时关心是否能开发票...│
│                                  │
│ [图片预览×2]   [编辑] [删除]    │
└─────────────────────────────────┘
```

仅自己创建的可编辑、删除（manager / admin 不限）。

**Tab 3 — 客户档案**

详细资料（与小程序的"个人中心"页面同样字段）+ 附件列表（图片网格，点击大图）。

附件上传：调 `uni.chooseImage` → 压缩 → `POST /api/v1/employee/uploads/image` → 拿 `id` 关联到 `customer_attachments` 表。

**Tab 4 — 跟进提醒**

设置 `next_follow_up_at` + `follow_up_reminder_text`；时间到了走 push（v1.1）和 App 内消息。

**操作栏（底部固定）**：

- 写跟进 → 跳跟进新增页
- 转出 → 弹窗填转出原因 → 提交申请

接口：

| 操作 | 接口 |
|---|---|
| 看详情 | `GET /api/v1/employee/customers/:id` |
| 改基本信息 | `PUT /api/v1/employee/customers/:id` |
| 看跟进列表 | `GET /api/v1/employee/customers/:id/follow-ups` |
| 看附件 | `GET /api/v1/employee/customers/:id/attachments` |
| 设跟进提醒 | `PUT /api/v1/employee/customers/:id/reminder` |
| 提交转出 | `POST /api/v1/employee/customer-transfers` |

#### 3.3.4 权限控制（再次强调）

- **绝对数据隔离**：员工只能看到自己被分配的客户（service 层强制 `WHERE assigned_employee_id = :me`）
- **manager** 看本部门所有员工的客户（多 join customers→employees→department）
- **admin** 看全部
- **导出**：默认禁用；admin 可在 PC 后台为特定员工开"导出权限"

### 3.4 模块四：跟进日志

#### 3.4.1 日志列表页

**筛选**：

- 客户：搜索 + 选择
- 跟进类型：电话 / 微信 / 面谈 / 其他
- 时间范围：今天 / 7 天内 / 自定义

**展示**：

```
2026-04-27
├─ 15:30  📞  李明妈妈  有意向
├─ 11:20  💬  小红家长  待跟进
└─ 09:45  🤝  张伟父亲  已成交
```

接口：`GET /api/v1/employee/follow-ups?customer_id=&type=&from=&to=&page=`

#### 3.4.2 新增跟进日志页

**支持语音转文字**：调用微信 `wx.translateVoice` 或第三方（v1.1，v1 先做手输）。

**结构化字段**：

| 字段 | 类型 | 必填 |
|---|---|---|
| 客户（自动带入） | customer_id | ✅ |
| 跟进时间 | datetime | ✅ 默认 now() |
| 跟进类型 | enum: phone/wechat/face/other | ✅ |
| 跟进结果 | enum: no_progress/interested/follow_up/signed/lost | ✅ |
| 跟进内容 | text | ✅ |
| 下次跟进时间 | datetime | 否（写完自动写到 customer.next_follow_up_at） |
| 附件 | image_id[] | 否 |

接口：`POST /api/v1/employee/follow-ups`（payload 见上）

#### 3.4.3 日志详情页

- 完整内容 + 附件
- 编辑 / 删除：仅自己创建的
- 分享：`uni.share` 内部分享（仅 group + 仅含文本，不含敏感信息）

接口：

| 操作 | 接口 |
|---|---|
| 看详情 | `GET /api/v1/employee/follow-ups/:id` |
| 改 | `PUT /api/v1/employee/follow-ups/:id` |
| 删 | `DELETE /api/v1/employee/follow-ups/:id` |

### 3.5 模块五：消息中心

#### 3.5.1 系统通知（push + 站内）

| 通知类型 | 触发场景 | payload |
|---|---|---|
| `customer_assigned` | admin/manager 给我分配新客户 | customer_id + 操作人 |
| `customer_transfer_in` | 别人转给我的客户审批通过 | customer_id + 来源员工 + 审批人 |
| `customer_transfer_result` | 我提交的转出申请有结果 | transfer_id + 通过/驳回 + 备注 |
| `customer_modified` | 我的客户信息被 admin/manager 修改 | customer_id + 改动字段 |
| `follow_up_reminder` | 到了 next_follow_up_at | customer_id + 提醒文本 |
| `pending_approval` | 我有待处理的转入申请 | transfer_id |
| `system_announcement` | 公司发新公告 | announcement_id |

#### 3.5.2 待办提醒

- **跟进提醒**：到点弹 push（v1.1） + 站内红点
- **待处理申请提醒**：站内角标 + 进入消息中心高亮

#### 3.5.3 消息详情

- 点击消息 → 跳到对应页面（客户详情 / 申请处理 / 公告详情）
- 标记已读 / 未读
- 一键清空已读

接口：

| 操作 | 接口 |
|---|---|
| 列消息 | `GET /api/v1/employee/notifications?type=&is_read=&page=` |
| 标记已读 | `PUT /api/v1/employee/notifications/:id/read` |
| 全部已读 | `PUT /api/v1/employee/notifications/read-all` |
| 一键清空已读 | `DELETE /api/v1/employee/notifications/read` |
| 未读数 | `GET /api/v1/employee/notifications/unread-count` |

### 3.6 模块六：我的中心

#### 3.6.1 个人信息

- 头像（点击换 → 调 chooseImage → uploads → 更新 employees.avatar_url）
- 姓名 / 手机号 / 部门 / 角色（只读）
- 改密码

#### 3.6.2 我的团队

- 同部门同事列表，仅显示：头像 + 姓名 + 职位（不显示客户数、不显示业绩，避免内部比较）
- manager 角色可看部门人员的客户数、业绩

接口：`GET /api/v1/employee/team/members`

#### 3.6.3 数据统计

- 个人业绩：周 / 月 / 季度切换 → 新增客户数 / 跟进次数 / 成交数
- 跟进趋势图：近 30 天日历折线图（用 ECharts 或 uCharts）

接口：`GET /api/v1/employee/dashboard/stats?range=week|month|quarter`

#### 3.6.4 设置

- 消息通知设置：跟进提醒 / 转入提醒 / 公告提醒 → 各自独立开关
- 清除缓存：清本地数据库 + 重新拉数据
- 关于我们：版本号 + 检查更新（v1.1 走 trading-platform 同款 app_updates 机制）
- 退出登录

---

## 第 4 章 端到端业务流程

### 4.1 客户分配流程

```
[家长在小程序自注册]
  └─ users 表写入
  └─ 触发 → customers 表自动建一条 (assigned_employee_id = NULL, status='potential')
  └─ admin 在 PC 后台或 manager 在 App 把这条客户分配给某员工

[员工新建客户]
  └─ 员工 App → 新增客户表单 → POST /employee/customers
  └─ customers 表写入 (assigned_employee_id = me, status='potential')
  └─ 不会创建 users 记录（除非员工主动勾选"邀请客户注册小程序"）

[小程序家长 / 员工新增客户的双向同步]
  └─ trigger 同步 customers 与 users
  └─ users.phone = customers.phone 时自动 link 起来（customer.user_id 赋值）
```

### 4.2 转出 / 转入审批流程

```
员工 A → 提交转出申请（填原因 + 备注）
  └─ customer_transfers 表写入 (status='pending', from_employee=A, customer_id, reason)
  └─ notifications 通知 manager (type='pending_approval')

manager（或 admin）→ 在 App / PC 看待办
  ├─ 通过：选目标员工 B → 改 customer.assigned_employee_id=B + transfer.status='approved'
  │         → 通知 A（结果）+ 通知 B（新客户分配）
  └─ 驳回：填驳回理由 → transfer.status='rejected'
            → 通知 A（结果）
```

### 4.3 跟进日志写入流程

```
员工 → 客户详情 → 写跟进 → 提交
  ├─ 在线：POST /follow-ups → 服务端写库 → 返回 → 列表刷新
  └─ 离线：本地 SQLite 写一条 → pending_op 加队列 → UI 立即显示
            连网后 → POST /sync/batch → 服务端去重 + 落库
```

---

## 第 5 章 后端改造清单

### 5.1 数据库 schema 变更

> 全部在 [node后端（新增）/scripts/db/core.js](node后端（新增）/scripts/db/core.js) 增量补充，使用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 风格保证幂等。

#### 5.1.1 新增 `departments`（部门）

```sql
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  manager_id BIGINT UNSIGNED NULL COMMENT '部门主管',
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_dept_parent (parent_id),
  KEY idx_dept_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.2 新增 `employees`

```sql
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL DEFAULT '',
  avatar_url VARCHAR(500) NOT NULL DEFAULT '',
  role ENUM('staff','manager') NOT NULL DEFAULT 'staff',
  department_id BIGINT UNSIGNED NULL,
  position VARCHAR(100) NOT NULL DEFAULT '' COMMENT '职位文本',
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1 COMMENT '首登必须改密',
  last_login_at DATETIME NULL,
  last_login_ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_employees_phone (phone),
  KEY idx_employees_dept_role (department_id, role),
  KEY idx_employees_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.3 新增 `employee_sessions`（设备会话）

```sql
CREATE TABLE IF NOT EXISTS employee_sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  device_id VARCHAR(64) NOT NULL DEFAULT '',
  device_info VARCHAR(255) NOT NULL DEFAULT '',
  ip_addr VARCHAR(64) NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_emp_session (employee_id, revoked),
  KEY idx_session_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.4 新增 `customers`（客户主表）

```sql
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_no VARCHAR(20) NOT NULL,
  user_id BIGINT UNSIGNED NULL COMMENT '关联到 users.id（如果家长在小程序注册过）',
  display_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  gender ENUM('male','female','unknown') DEFAULT 'unknown',
  age INT NULL,
  school VARCHAR(120) NOT NULL DEFAULT '',
  class_name VARCHAR(120) NOT NULL DEFAULT '',
  source ENUM('miniprogram','employee','transferred') NOT NULL DEFAULT 'employee',
  status ENUM('potential','interested','signed','lost') NOT NULL DEFAULT 'potential',
  level ENUM('A','B','C') NOT NULL DEFAULT 'C',
  tags JSON NULL,
  remark TEXT NULL,
  assigned_employee_id BIGINT UNSIGNED NULL,
  next_follow_up_at DATETIME NULL,
  next_follow_up_text VARCHAR(500) NOT NULL DEFAULT '',
  last_follow_up_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  client_uuid VARCHAR(64) NULL COMMENT '离线幂等键',
  created_by BIGINT UNSIGNED NULL COMMENT '创建人 employee_id',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customers_no (customer_no),
  UNIQUE KEY uk_customers_uuid (client_uuid),
  KEY idx_customers_assigned (assigned_employee_id, status),
  KEY idx_customers_phone (phone),
  KEY idx_customers_user (user_id),
  KEY idx_customers_next_followup (next_follow_up_at),
  KEY idx_customers_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.5 新增 `customer_attachments`

```sql
CREATE TABLE IF NOT EXISTS customer_attachments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  upload_id BIGINT UNSIGNED NOT NULL,
  file_type ENUM('image','document') NOT NULL DEFAULT 'image',
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attach_customer (customer_id),
  KEY idx_attach_upload (upload_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.6 新增 `follow_ups`

```sql
CREATE TABLE IF NOT EXISTS follow_ups (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  follow_at DATETIME NOT NULL,
  type ENUM('phone','wechat','face','other') NOT NULL,
  result ENUM('no_progress','interested','follow_up','signed','lost') NOT NULL,
  content TEXT NOT NULL,
  attachments JSON NULL COMMENT '[upload_id, ...]',
  next_follow_up_at DATETIME NULL,
  client_uuid VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_followups_uuid (client_uuid),
  KEY idx_fu_customer_time (customer_id, follow_at DESC),
  KEY idx_fu_employee_time (employee_id, follow_at DESC),
  KEY idx_fu_type (type),
  KEY idx_fu_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.7 新增 `customer_transfers`（转出申请）

```sql
CREATE TABLE IF NOT EXISTS customer_transfers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  from_employee_id BIGINT UNSIGNED NOT NULL,
  to_employee_id BIGINT UNSIGNED NULL COMMENT '审批后填',
  reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  approval_remark VARCHAR(500) NOT NULL DEFAULT '',
  client_uuid VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_xfer_uuid (client_uuid),
  KEY idx_xfer_status (status),
  KEY idx_xfer_from (from_employee_id, status),
  KEY idx_xfer_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.8 新增 `notifications`（员工消息）

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  payload JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_emp_unread (employee_id, is_read, created_at DESC),
  KEY idx_notif_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.9 新增 `customer_tags`（标签字典）

```sql
CREATE TABLE IF NOT EXISTS customer_tags (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#1677FF',
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tag_name (name),
  KEY idx_tag_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.10 新增 `system_announcements`（员工公告）

```sql
CREATE TABLE IF NOT EXISTS system_announcements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  is_top TINYINT(1) NOT NULL DEFAULT 0,
  must_popup TINYINT(1) NOT NULL DEFAULT 0,
  publish_at DATETIME NULL,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ann_publish (active, publish_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 5.1.11 既有 `users` 表无变更

只是 `customers.user_id` 通过手机号 link 到 `users`；users 表本身不动。

### 5.2 新增路由 `/api/v1/employee/*`

新文件：

```
node后端（新增）/routes/employee/
├── index.js              # 注册子路由 + 公共中间件 (authMiddleware + requireType('employee'))
├── auth.js               # 登录 / 改密 / 验证码 / 退出
├── me.js                 # 个人信息 / dashboard / settings
├── customers.js          # 客户 CRUD / 搜索 / 附件
├── followUps.js          # 跟进日志
├── transfers.js          # 转出 / 审批
├── notifications.js      # 消息
├── team.js               # 团队 / 公告 / 标签
├── uploads.js            # 图片上传（单图）
└── sync.js               # 离线批量同步
```

#### 5.2.1 完整接口表

| Method | Path | 鉴权 | 描述 |
|---|---|---|---|
| **Auth** | | | |
| POST | `/api/v1/employee/auth/login` | 无 | 手机号+密码登录 |
| POST | `/api/v1/employee/auth/verify-code` | 无 | 异地登录的验证码校验 |
| POST | `/api/v1/employee/auth/change-password` | any | 改密码（首登强制） |
| POST | `/api/v1/employee/auth/logout` | any | 注销当前 session |
| **Me** | | | |
| GET | `/api/v1/employee/me` | any | 当前账号 + 基本信息 |
| PUT | `/api/v1/employee/me` | any | 改头像 / 昵称 |
| GET | `/api/v1/employee/dashboard/me` | any | 首页概览 4 项 |
| GET | `/api/v1/employee/dashboard/stats?range=` | any | 个人业绩 |
| **Customers** | | | |
| GET | `/api/v1/employee/customers` | any | 列表（分页 + 筛选 + 排序） |
| POST | `/api/v1/employee/customers` | any | 新增客户 |
| GET | `/api/v1/employee/customers/:id` | any | 详情 |
| PUT | `/api/v1/employee/customers/:id` | any | 改基本信息 |
| DELETE | `/api/v1/employee/customers/:id` | any（自己的） | 软删（active=0） |
| GET | `/api/v1/employee/customers/search?q=` | any | 全局搜索（限自己名下） |
| GET | `/api/v1/employee/customers/:id/attachments` | any | 附件列表 |
| POST | `/api/v1/employee/customers/:id/attachments` | any | 加附件（已上传的 upload_id） |
| DELETE | `/api/v1/employee/customers/:id/attachments/:aid` | any | 删附件 |
| PUT | `/api/v1/employee/customers/:id/reminder` | any | 设跟进提醒 |
| **Follow-ups** | | | |
| GET | `/api/v1/employee/follow-ups` | any | 列表 |
| POST | `/api/v1/employee/follow-ups` | any | 新增 |
| GET | `/api/v1/employee/follow-ups/:id` | any | 详情 |
| PUT | `/api/v1/employee/follow-ups/:id` | any（仅自己） | 改 |
| DELETE | `/api/v1/employee/follow-ups/:id` | any（仅自己） | 删 |
| **Transfers** | | | |
| POST | `/api/v1/employee/customer-transfers` | any | 提交转出申请 |
| GET | `/api/v1/employee/customer-transfers/mine` | any | 我提交的 |
| GET | `/api/v1/employee/customer-transfers/pending` | manager | 我要审批的 |
| PUT | `/api/v1/employee/customer-transfers/:id/approve` | manager | 通过 |
| PUT | `/api/v1/employee/customer-transfers/:id/reject` | manager | 驳回 |
| **Notifications** | | | |
| GET | `/api/v1/employee/notifications` | any | 列表 |
| GET | `/api/v1/employee/notifications/unread-count` | any | 未读数 |
| PUT | `/api/v1/employee/notifications/:id/read` | any | 标已读 |
| PUT | `/api/v1/employee/notifications/read-all` | any | 全部已读 |
| DELETE | `/api/v1/employee/notifications/read` | any | 一键清空已读 |
| **Team** | | | |
| GET | `/api/v1/employee/team/members` | any | 同部门同事 |
| GET | `/api/v1/employee/announcements` | any | 公告列表 |
| GET | `/api/v1/employee/customer-tags` | any | 标签字典 |
| **Uploads** | | | |
| POST | `/api/v1/employee/uploads/image` | any | 上传图片（multipart/form-data 字段名 **`file`**）→ `{id, url, file_url, relative_path}` |
| **Sync** | | | |
| POST | `/api/v1/employee/sync/batch` | any | 离线批量同步入口 |

### 5.3 新增 services

| 文件 | 职责 |
|---|---|
| [services/employeeService.js](node后端（新增）/services/employeeService.js) | employees CRUD + 登录 + 改密 + session |
| [services/customerService.js](node后端（新增）/services/customerService.js) | customers CRUD + 搜索 + 附件 |
| [services/followUpService.js](node后端（新增）/services/followUpService.js) | follow_ups CRUD |
| [services/transferService.js](node后端（新增）/services/transferService.js) | 转出申请 + 审批 |
| [services/notificationService.js](node后端（新增）/services/notificationService.js) | 通知发送 + 列表 |
| [services/syncService.js](node后端（新增）/services/syncService.js) | `/sync/batch` 处理 |

### 5.4 PC 后台需补的页面

[/www/shi-li/后台/art-lnb-master/src/views/vision-admin/](后台/art-lnb-master/src/views/vision-admin/) 加：

| 页面 | 路由 | 功能 |
|---|---|---|
| `employees/` | `/employees` | 员工 CRUD：手机号 + 默认密码 + 角色 + 部门 + 启停 |
| `departments/` | `/departments` | 部门 CRUD |
| `customers/` | `/customers` | 全公司客户列表，admin / manager 可看 |
| `customer-transfers/` | `/customer-transfers` | 待审批 / 审批历史 |
| `customer-tags/` | `/customer-tags` | 标签字典管理 |
| `system-announcements/` | `/system-announcements` | 公告 CRUD |

### 5.5 环境变量增量

`.env` 新增：

```env
# 员工 App JWT 密钥（独立于 mobile / admin）
JWT_EMPLOYEE_SECRET=
JWT_EMPLOYEE_EXPIRES_IN=7d

# 登录限流
EMPLOYEE_LOGIN_FAIL_LOCK_MINUTES=15
EMPLOYEE_LOGIN_FAIL_THRESHOLD=5

# 离线同步上限
EMPLOYEE_SYNC_BATCH_MAX=200

# 单设备登录限制（默认开）
EMPLOYEE_SINGLE_DEVICE=true

# 短信验证码
SMS_PROVIDER=
SMS_API_KEY=
```

---

## 第 6 章 前端工程（UniApp）

### 6.1 仓库与目录

放在 [/www/shi-li/员工App](员工App)（与 `小程序端` `后台` 同级）。

```
员工App/
├── manifest.json          # appid + 权限：camera / storage / location / network / phone
├── pages.json             # 路由 + 三套 tabBar
├── App.vue
├── main.ts
├── pages/
│   ├── login/
│   │   ├── index.vue
│   │   ├── verify.vue            # 异地登录二次验证
│   │   └── change-password.vue   # 首次登录强制改密
│   ├── home/
│   │   └── index.vue             # 工作台（按角色切布局）
│   ├── customer/
│   │   ├── list.vue              # 客户列表
│   │   ├── detail.vue            # 详情（4 个 Tab）
│   │   ├── new.vue               # 新增客户
│   │   ├── edit.vue              # 编辑
│   │   └── search.vue            # 全局搜索
│   ├── follow-up/
│   │   ├── list.vue              # 跟进日志列表
│   │   ├── new.vue               # 写跟进
│   │   ├── detail.vue            # 日志详情
│   │   └── edit.vue
│   ├── transfer/
│   │   ├── new.vue               # 提交转出
│   │   ├── mine.vue              # 我提交的
│   │   └── pending.vue           # 待审批（manager）
│   ├── notification/
│   │   ├── list.vue              # 消息列表
│   │   └── detail.vue
│   └── me/
│       ├── profile.vue           # 个人中心
│       ├── team.vue              # 我的团队
│       ├── stats.vue             # 数据统计
│       ├── sync-status.vue       # 同步队列详情
│       └── settings.vue
├── stores/
│   ├── auth.ts
│   ├── customers.ts              # 客户列表本地缓存
│   ├── notifications.ts          # 未读数
│   └── sync.ts                   # 同步状态机
├── api/
│   ├── http.ts
│   ├── employee.ts
│   ├── customer.ts
│   ├── followUp.ts
│   ├── transfer.ts
│   ├── notification.ts
│   ├── upload.ts
│   └── sync.ts
├── db/
│   ├── schema.ts                 # 本地表 DDL
│   ├── repo.ts                   # CRUD
│   └── migrations.ts
├── utils/
│   ├── network.ts
│   ├── conflict.ts
│   ├── compress.ts
│   ├── uuid.ts
│   └── voice.ts                  # 语音转文字（v1.1）
└── components/
    ├── role-tabbar.vue
    ├── sync-indicator.vue
    ├── customer-card.vue
    ├── follow-up-card.vue
    └── notification-badge.vue
```

### 6.2 技术选型

| 维度 | 选择 |
|---|---|
| 框架 | UniApp 3 + Vue 3 + `<script setup>` |
| 状态 | Pinia |
| UI 库 | uview-plus（与家长端一致） |
| 网络 | 自封 `http.ts`：拦截器 + token 自动刷新 + 离线兜底 + 重试 |
| 本地数据库 | APK：`uni.createSQLDatabase`；H5：禁用离线 |
| 图片 | `uni.chooseImage` → `uni.compressImage` → 本地路径暂存 → 异步上传 |
| 拨号 | `uni.makePhoneCall` |
| 图表 | uCharts（轻量） |
| 推送 | v1.1 用 unipush |

### 6.3 三角色 tabBar

| 角色 | tabBar |
|---|---|
| staff | 工作台 / 客户 / 跟进 / 消息 / 我 |
| manager | 工作台 / 客户 / 待审批 / 消息 / 我 |

### 6.4 关键交互

- **登录持久化**：JWT + 本地缓存的 employee profile 写本地，7 天免登
- **拨号**：列表点手机号 → 直接拨打，**不弹确认**（已是常用功能）
- **客户搜索**：在线全网模糊匹配 + 离线本地 LIKE，merge 去重
- **写跟进**：**本地立即写 + 立即返回成功**，UI 不等服务端，再异步同步
- **断网指示**：右上角圆点 — 离线红 / 同步中黄 / 已同步绿

---

## 第 7 章 离线策略

> v1 选了"全功能离线"。**对一个 CRM 应用来说这是偏重的选择，但用户已确认；本章节落实后大概率超出 v1 时间预算 30%~50%**，建议在落地评审时再次和产品确认是否真的需要这个深度。

### 7.1 核心原则

1. **本地优先**：客户列表、跟进、消息读写都先打本地 SQLite
2. **客户端 UUID**：新建数据带 `client_uuid`（v4），服务端去重
3. **乐观锁**：写操作带 `base_version`，冲突 409 + 客户端合并
4. **附件懒上传**：拍照立即写本地，后台空闲时上传

### 7.2 同步入口与触发

唯一接口：`POST /api/v1/employee/sync/batch`

**envelope**：

```json
{
  "ops": [
    {
      "op": "create",
      "type": "customer",
      "client_uuid": "...",
      "payload": { /* customer 字段 */ }
    },
    {
      "op": "create",
      "type": "follow_up",
      "client_uuid": "...",
      "payload": { "customer_client_uuid": "...", /* ... */ }
    },
    {
      "op": "update",
      "type": "customer",
      "client_uuid": "...",
      "base_version": 3,
      "payload": { /* ... */ }
    }
  ]
}
```

**返回每条的处理结果**：

```json
{
  "results": [
    { "client_uuid": "...", "status": "ok", "server_id": 123 },
    { "client_uuid": "...", "status": "duplicate", "server_id": 99 },
    { "client_uuid": "...", "status": "conflict", "server_id": 88, "current_version": 5 },
    { "client_uuid": "...", "status": "validation_failed", "errors": ["phone 必填"] }
  ]
}
```

**触发时机**：

1. 登录成功后 1 秒
2. `uni.onNetworkStatusChange` 从 `none` → 有网
3. 用户下拉刷新
4. 后台每 30 秒轮询（仅前台）
5. 提交单条操作后立即触发（在线时）

### 7.3 冲突合并 UI

服务端返回 `status='conflict'` → 本地标红 → 进入合并页：左"我的"右"服务器"，按字段勾选 → 合并后重新提交。

### 7.4 本地表 schema

```sql
CREATE TABLE local_employee (id INTEGER PRIMARY KEY, payload TEXT, expires_at INTEGER);

CREATE TABLE local_customers (
  id INTEGER, server_id INTEGER, client_uuid TEXT UNIQUE,
  payload TEXT, version INTEGER, last_synced_at INTEGER
);

CREATE TABLE local_follow_ups (
  id INTEGER, server_id INTEGER, client_uuid TEXT UNIQUE,
  customer_id INTEGER, payload TEXT, last_synced_at INTEGER
);

CREATE TABLE local_notifications (id INTEGER PRIMARY KEY, payload TEXT, is_read INTEGER);

CREATE TABLE pending_op (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid TEXT UNIQUE, type TEXT, op TEXT,
  payload TEXT, base_version INTEGER,
  status TEXT, retry_count INTEGER DEFAULT 0,
  last_error TEXT, created_at INTEGER
);

CREATE TABLE local_attachment (
  client_uuid TEXT PRIMARY KEY,
  local_path TEXT, uploaded_id INTEGER,
  upload_status TEXT, retry_count INTEGER DEFAULT 0
);
```

### 7.5 网络可用判定

不能只信 `uni.getNetworkType`，必须探活：

```ts
async function isReallyOnline(): Promise<boolean> {
  const net = await uni.getNetworkType()
  if (net.networkType === 'none') return false
  try {
    const res = await uni.request({ url: `${BASE_URL}/health`, timeout: 3000 })
    return res.statusCode === 200
  } catch { return false }
}
```

### 7.6 离线边界

- **H5 端不做离线**：成本不划算
- **登录不能离线**：第一次必须在线，之后 7 天可离线进 App
- **删除走在线**：避免离线删错没法回滚
- **审批走在线**：转出审批必须在线，不能离线决策

---

## 第 8 章 兼容与影响面

### 8.1 不影响的部分

| 端 | 影响 |
|---|---|
| 家长端小程序 | **零影响**。员工接口走 `/api/v1/employee/*` 全新命名空间 |
| PC 管理后台（既有页面） | **零影响**。只新增页面 |
| trading-platform（同机另一项目） | **零影响**。本机不动 3000 端口、不动 `trading_system` 库 |
| 现有 `users` `children` `appointment_records` `checkup_records` 等 | **完全兼容**。`customers.user_id` 通过 phone link 进 users，不修改 users 自身 schema |

### 8.2 数据库迁移策略

- 全部 `CREATE TABLE IF NOT EXISTS`，无破坏性变更
- 老库执行 `npm run init-db` 自动建新表
- 无需 backfill 旧数据；customers 是新表从 0 开始

### 8.3 部署影响

- 后端进程仍是 [pm2 vision-server](node后端（新增）/server.js)（端口 3100）
- Nginx 不需动，员工接口同站访问
- 员工 App 的 H5 fallback（如开）部署到 `/www/wwwroot/vision-employee-h5/`

---

## 第 9 章 性能与安全

### 9.1 安全

- **JWT 隔离**：employees 用独立的 `JWT_EMPLOYEE_SECRET`
- **登录限流**：5 次失败锁 15 分钟（per phone + per IP 双维度）
- **首次强制改密**：`employees.must_change_password=1` 时除 `change-password` 接口外都返回 403
- **设备绑定**：登录写 `employee_sessions.device_id`；同员工同时只允许 1 个 active session（除非配置允许）
- **敏感字段**：手机号脱敏展示给非主管角色（可配置）
- **导出限制**：`/api/v1/employee/customers/export` 默认禁用，admin 在 PC 后台开开关
- **审计**：所有写操作走审计日志（员工 ID + 模块 + 动作 + 前后值）

### 9.2 性能目标

| 维度 | 目标 |
|---|---|
| 登录响应 | ≤ 1.5s（在线）/ 即时（离线） |
| 客户列表（200 条） | ≤ 800ms |
| 客户详情 | ≤ 500ms |
| 写跟进（在线） | ≤ 600ms |
| 写跟进（离线） | ≤ 50ms |
| 同步 100 条 ops | ≤ 5s |
| 单张图片上传 | ≤ 3s（4G） |
| App 冷启动 | ≤ 2s |
| 单台 APK 一周本地存储 | ≤ 80MB |

---

## 第 10 章 验收标准

### 10.1 功能验收

- [ ] 员工 / 主管账号都能登录，看到匹配 tabBar
- [ ] 员工首次登录强制改密
- [ ] 异地登录触发短信验证码二次校验
- [ ] 单设备限制开启时，第二台设备登录第一台 token 失效
- [ ] 工作台正确展示 4 个数据卡片 + 公告
- [ ] 客户列表筛选 / 排序 / 搜索全部生效
- [ ] 点手机号直接拨打
- [ ] 长按出 ActionSheet 全部操作可用
- [ ] 客户详情 4 个 Tab（基本信息 / 跟进记录 / 档案 / 提醒）数据正确
- [ ] 改基本信息后小程序家长端立即可见
- [ ] 写跟进日志后列表立即刷新
- [ ] 仅自己创建的跟进可改 / 删
- [ ] 提交转出申请后，主管能看到待办、能通过 / 驳回
- [ ] 客户分配 / 转入 / 转出审批结果 / 客户信息变更 4 类通知正确推送到目标员工
- [ ] 跟进提醒到点产生站内消息
- [ ] 一键清空已读消息生效
- [ ] 我的中心：业绩统计、跟进趋势图正确
- [ ] 团队页只显示同部门同事，不显示客户数

### 10.2 离线验收

- [ ] 飞行模式登录可以（用 7 天内本地缓存）
- [ ] 飞行模式下完整跑通：新建客户 + 写跟进 + 拍照 + 设提醒
- [ ] 网络恢复后 30 秒内队列自动同步并 toast 提示
- [ ] 同一 client_uuid 重复提交服务端只生成一条
- [ ] 附件上传失败可重试 3 次，仍失败标红并允许手动重传
- [ ] 同一客户在两台设备同时改，第二台提交时正确触发冲突合并 UI
- [ ] 切换账号前如果 pending_op 不为空，强制要求"先同步"或"主动清空"

### 10.3 兼容验收

- [ ] users / children / appointment_records / checkup_records 数据无变化
- [ ] 家长端小程序所有页面无回归 bug
- [ ] trading-platform 仍正常（端口、库、PM2 都没变化）

### 10.4 安全验收

- [ ] 错误密码登录 5 次后被锁 15 分钟
- [ ] employees JWT 不能调 `/api/v1/admin/*` 或 `/api/v1/mobile/*`
- [ ] HTTPS 证书有效，HTTP 重定向到 HTTPS
- [ ] employees 看不到其他员工的客户（service 层校验）
- [ ] 主管看不到其他部门客户

### 10.5 真实场景验收

- [ ] 员工日均跑 30 个客户跟进无明显卡顿
- [ ] 主管处理 50 条转出申请用时 ≤ 30 分钟
- [ ] 数据同步在弱网（信号 1 格）下成功率 ≥ 95%

---

## 第 11 章 里程碑与排期

| 阶段 | 周期 | 交付物 |
|---|---|---|
| **Phase 1：后端打地基** | 6 个工作日 | schema 升级、employee 路由、admin 加员工 / 部门 / 客户 / 公告 / 标签管理页；接口 Postman 集合可调通 |
| **Phase 2：UniApp 在线主流程** | 8 个工作日 | 工程脚手架、登录、客户 / 跟进 / 转出 / 消息 / 我五大模块在线版；APK 内部测试包 |
| **Phase 3：离线本地库与同步** | 9 个工作日 | 本地 SQLite、pending_op 队列、`/sync/batch` 端到端、冲突合并 UI、附件懒上传 |
| **Phase 4：联调与压测** | 4 个工作日 | 性能达标、回归测试通过 |
| **Phase 5：灰度发布** | 3 个工作日 | 真机验收、APK 签名分发、培训文档 |

**合计约 30 个工作日（约 6 周）**。

> **Phase 3 是关键路径，资源不能并行省**。

---

## 第 12 章 风险与遗留

### 12.1 已知风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 全功能离线对 CRM 是过度投资 | 高 | 工期+30%~50%、缺陷率上升 | 落地 review 时再次评估，必要时砍到"在线优先 + 网络异常容错" |
| 同手机号多账号冲突（家长共用） | 中 | 客户重复 | customers.phone 不加 UNIQUE，靠去重 UI 提示员工 |
| 多账号设备共用导致队列错乱 | 低 | 数据混淆 | 登录时若队列非空，强制先同步 |
| iOS 拍照 / 通讯录权限审核 | 中 | 上 App Store 不过 | v1 先打 APK，iOS 走 TestFlight |
| 服务端时钟与设备时钟差太大 | 低 | 排序错乱 | 服务端写入用 NOW()；客户端时间戳只用于本地排序 |
| 弱网下同步反复失败 | 高 | 用户怀疑 App 坏了 | 重试用指数退避（1s→5s→30s→5min），UI 显示具体原因 |
| 短信验证码服务商选型 | 中 | 异地登录功能 block | v1.0 先内置阿里云 / 腾讯云任一，可后期切换 |

### 12.2 v1 暂缓项（v1.1+）

- 语音转文字写跟进
- unipush 真实推送（v1 只做站内）
- 实时 WebSocket 推送（消息中心）
- 客户线索池（公海）
- BI 看板 / 高级报表
- 真离线 H5
- 跨部门客户调拨
- 客户回收（流失 N 天后自动归还）

### 12.3 已知约束

- v1 假设单机构、单语言（中文）
- v1 客户与小程序 users 通过 phone 软关联，不强外键
- 短信发送量：异地登录二次验证按 100 员工 × 月均 10 次 ≈ 1000 条/月，按短信成本预算

---

## 附录 A：关键复用资产清单

| 已有资产 | 路径 | 复用方式 |
|---|---|---|
| JWT 中间件 | [utils/jwt.js](node后端（新增）/utils/jwt.js) | 加 `USER_TYPES.EMPLOYEE` 分支 |
| 密码哈希 | [utils/bcrypt.js](node后端（新增）/utils/bcrypt.js) | 直接复用 |
| 响应封装 | [utils/response.js](node后端（新增）/utils/response.js) | 直接复用 |
| 分页 helper | [utils/helpers.js](node后端（新增）/utils/helpers.js) | 直接复用 |
| 异步路由 | [utils/asyncRoute.js](node后端（新增）/utils/asyncRoute.js) | 直接复用 |
| 错误封装 | [utils/appError.js](node后端（新增）/utils/appError.js) | 直接复用 |
| 用户管理 service | [services/userService.js](node后端（新增）/services/userService.js) | 参照其 list/detail/create/update 风格写 employeeService |
| 图片上传 | [services/uploadService.js](node后端（新增）/services/uploadService.js) → `saveImage` | 直接复用 |
| 审计日志骨架 | [middlewares/adminLog.js](node后端（新增）/middlewares/adminLog.js) | 改名 `auditLog.js` 并支持 employee 类型 |
| 权限中间件骨架 | [routes/middlewares/permission.js](node后端（新增）/routes/middlewares/permission.js) → `isSuperAdmin` | 仿写 `requireEmployeeRole(...roles)` |

---

## 附录 B：配套文档（落地阶段补齐）

按 shi-li 项目惯例，下述文档在落地阶段建立在 [docs/员工app/](docs/员工app/)：

- `ALIGNMENT_员工app.md` — 需求对齐与边界
- `CONSENSUS_员工app.md` — 验收共识
- `DESIGN_员工app.md` — 详细架构与接口
- `TASK_员工app.md` — 五阶段任务拆解
- `ACCEPTANCE_员工app.md` — 落地完成后填验收记录
- `FINAL_员工app.md` — 阶段总结
- `TODO_员工app.md` — 遗留事项

---

## 附录 C：术语表

| 术语 | 含义 |
|---|---|
| 员工 / employee | 公司内部使用员工 App 的用户（staff / manager） |
| 客户 / customer | 员工管理的家长用户，可能与小程序 users 关联 |
| 跟进日志 / follow_up | 员工对客户的一次接触记录 |
| 转出申请 / customer_transfer | 员工请求把客户给到其他员工，需主管审批 |
| client_uuid | 客户端生成的离线幂等键 |
| pending_op | 离线场景下的待同步操作 |

---

## 附录 D：与原始草稿的对应关系

本 PRD 完整保留并扩展了 [/www/shi-li/新增员工app PRD.md 原始草稿](#)：

| 原始章节 | 本 PRD 章节 | 扩展点 |
|---|---|---|
| 登录页 | §3.1 模块一 | 增：异地登录验证 / 单设备限制 / 首登强制改密 / 安全细则 |
| 首页（工作台） | §3.2 模块二 | 增：4 个快捷入口接口、4 个数据卡接口、公告字段 |
| 客户管理 | §3.3 模块三 | 增：完整字段 / 4 个 Tab / 接口清单 / 权限矩阵 |
| 跟进日志 | §3.4 模块四 | 增：结构化字段表 / 接口 / 编辑权限规则 |
| 消息中心 | §3.5 模块五 | 增：7 类通知类型 / 触发场景 / payload |
| 我的中心 | §3.6 模块六 | 增：业绩统计接口 / 团队成员可见字段 / 设置项 |

---

> **本 PRD 是落地起点，不是终点**。落地阶段任何不一致以代码 + ACCEPTANCE 文档为准，发现 PRD 错误请回头改本文档，保持产品 / 开发同步。
