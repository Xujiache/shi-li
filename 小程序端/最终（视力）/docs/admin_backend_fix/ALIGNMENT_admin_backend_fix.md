# ALIGNMENT_admin_backend_fix

## 1. 原始需求（来自用户反馈）

- 后台管理端目前**只能增删改查用户账户**，希望补齐其他业务数据的管理能力。
- 小程序侧存在**同设备/同微信下切换账号仍访问到同一账号数据**（账号数据串号/混用）的问题，需要修复。

## 2. 项目上下文分析（当前代码现状）

### 2.1 技术栈与架构

- **小程序端**：微信小程序 + `wx.cloud.callFunction` 调用云函数。
- **云开发**：微信云开发（CloudBase），云函数使用 `wx-server-sdk` 访问数据库。
- **外部后台（管理端）**：`art-lnb-master`（Vue3 + Vite + ElementPlus + Pinia）
  - 通过 **CloudBase HTTP API 网关** 调用 `admin_manager` 云函数：`Authorization: Bearer <cloudbase access_token>`
  - 业务鉴权使用 `admin_manager.admin_login` 返回的 **token**（存储在后台前端的 `userStore.accessToken`，每次请求随 `data.token` 传入）

### 2.2 数据模型（关键集合）

- `users`：用户账户（手机号登录为主，字段：`phone/password/is_admin/active/deleted/...`）
- `children`：孩子档案（字段：`_openid/parent_phone/...`）
- `appointment_*`：预约项目、排班、记录
- `checkup_records`：检测记录（按 `child_id` 关联）
- `system_config`：系统配置（本次涉及 `key=terms_and_privacy`）
- `admin_sessions`：后台管理员会话（`token/user_id/expire_at_ms`）

## 3. 需求理解（问题根因与修复方向）

### 3.1 “多账号串号”根因（高概率场景）

- 同一微信 `OPENID` 下可存在多个手机号账号（`users` 多条记录 `_openid` 相同）。
- 若业务查询在缺少强约束身份时使用 `_openid`（或 `_openid OR phone`），会把多账号数据**并集**到一起，表现为“怎么看都是同一个账号的数据”。
- `user_manager` 中存在一处实现隐患：通过 `doc(user_id).get()` 读取时错误使用 `doc._id`，导致返回/更新时 `_id` 可能变成 `undefined`，从而触发回退逻辑走 `OPENID`，进一步放大串号概率。

### 3.2 “后台只能管用户账户”的可能原因

- 云函数 `admin_manager` 实际已实现多实体 CRUD，但后台前端可能缺少某些管理页或菜单入口（例如协议/隐私配置）。
- 预约记录/检测记录在后台 UI 里属于“列表为主”，用户可能感知为“不可增删改查”。

## 4. 范围边界（本次修复的 In/Out）

### 4.1 In Scope（本次要交付）

- **小程序侧多账号不串号**
  - `user_id` 逻辑修正与一致化：通过 `user_id` 获取用户时保证 `_id` 正确。
  - 通过 `last_login_at/updated_at` 让 OPENID 回退时优先选“最近登录账号”，降低误选。
  - `children` 更新接口增加归属校验，避免缓存 child_id 导致跨账号误改。
- **后台能力补齐**
  - 增加“协议与隐私”配置管理：后台可编辑 `system_config.key=terms_and_privacy`。
  - 后台前端新增对应路由/页面并可保存。
- **协议读取链路**
  - 小程序登录页协议内容优先走云函数读取，避免 `system_config` 直读权限导致无法加载。

### 4.2 Out of Scope（明确不做/后续再做）

- 密码加密、完整的账号登录态 token 化（小程序侧 phone 登录目前仍是“返回 user + 传 user_id”模式）。
- 企业级 RBAC（细粒度按钮级权限、后台菜单后端下发）。
- 历史脏数据的批量迁移清洗（仅做安全加固与“减少串号触发面”）。

## 5. 验收标准草案（可测试）

- **小程序**：
  - 同一微信下用不同手机号账号登录，`children/预约/检测记录` 不会互相串读。
  - 微信登录在同一 OPENID 下存在多个账号时，默认进入“最近登录过的账号”。
  - 更新孩子档案时，跨账号（不同 `parent_phone`）不能修改对方档案。
- **后台**：
  - 菜单中可进入“协议与隐私”页并保存成功；保存后小程序登录页可读取到最新内容（走云函数读取）。

