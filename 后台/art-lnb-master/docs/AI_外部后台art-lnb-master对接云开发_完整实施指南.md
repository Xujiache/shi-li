# 后台管理系统文档生成器（给另一个AI的完整开发指引）

## 任务目标
将你的外部后台代码仓库 `c:\Users\Administrator\Desktop\art-lnb-master` 改造成“儿童视力管理”项目的企业后台，并对接微信云开发（云函数 + 云数据库）。

要求：
- 后台的菜单、页面、字段、校验与本项目 C 端保持一致
- 后台所有数据操作通过云函数 `admin_manager`（B 端接口层）完成
- 输出必须覆盖：
  - `docs/后台管理系统开发规划.md` 的全部内容
  - `docs/API设计.md` 的全部内容

---

## 执行步骤

### 1) 扫描C端功能（已完成，作为B端反推依据）
本项目 C 端为微信小程序，页面与功能主链：
- 登录/注册（手机号）
- 孩子档案：新增/编辑/删除/选择当前孩子
- 首页：轮播 Banner、快捷入口
- 预约：项目列表 → 排班选择 → 预约记录
- 数据：看板（最新记录与对比）、历史记录列表
- 记录档案：新增/修改一次检测记录（字段与看板一致）

对应云函数（C端直连）：
- `user_manager`
- `profile_manager`
- `appointment_manager`
- `data_manager`

### 2) 扫描数据模型（已完成）
核心集合（云数据库 collections）：
- `users`
- `children`
- `school_classes`
- `banners`
- `appointment_items`
- `appointment_schedules`
- `appointment_records`
- `checkup_records`
- `admin_sessions`（B端登录会话）

### 3) 扫描现有接口（已完成）
已输出两份文档：
- `docs/后台管理系统开发规划.md`
- `docs/API设计.md`

并已在云开发侧提供 B 端对接云函数：
- `cloudfunctions/admin_manager`（本项目新增）

---

## 外部后台仓库（art-lnb-master）现状与约束

### 技术栈
`art-lnb-master` 是一个 Vue 3 + Vite + TypeScript + Element Plus 的后台模板项目。
- API 层：`src/api/*.ts`
- HTTP 封装：`src/utils/http/index.ts`（Axios，期望后端响应符合 `BaseResponse`：`{ code, msg, data }`）
- 登录与路由守卫：`src/api/auth.ts` + `src/router/guards/beforeEach.ts`
- 状态管理：Pinia `src/store/modules/user.ts`（用 `accessToken` 管理登录态）

### 关键约束（必须明确给另一个AI）
1. **浏览器前端不能安全持有云开发的服务端密钥**：
   - 因此不建议在浏览器直接使用 CloudBase Server SDK。
2. 推荐两种对接方式（择一）：
   - **方式A（推荐，企业级）**：外部后台 = 前端（art-lnb-master）+ 自建后端BFF（Node/Java等）。BFF 使用 CloudBase Server SDK 调用云函数 `admin_manager`。
   - **方式B（开发最快）**：为 `admin_manager` 配置 **HTTP触发器**，让前端直接 POST 调用。此方式依赖 `admin_manager` 的 token 体系，需做好 CORS、HTTPS、速率限制、IP白名单等。

本指引同时给出两种方式的落地步骤。

---

## 对接方案A（推荐）：前端 + BFF（服务端调用云函数）

### A1. 架构
```
浏览器(art-lnb-master)
  -> 你的BFF后端(HTTPS)
      -> CloudBase Server SDK
          -> 云函数 admin_manager
              -> 云数据库
```

### A2. BFF 要做什么
1. 暴露一组 REST API（或保持与 `admin_manager` 的 action 风格一致）
2. 在服务端保存 CloudBase 的私密配置（envId/secretId/secretKey 等，具体取决于你使用的 CloudBase 方案）
3. 统一把 `admin_manager` 的返回值转换为 `art-lnb-master` 需要的 `{ code, msg, data }`
4. 统一处理 token：
   - `admin_login` 成功返回 token
   - 浏览器端后续请求携带 token（比如放到 `Authorization`）
   - BFF 将 token 透传给 `admin_manager` 的 `data.token`

### A3. art-lnb-master 需要做什么
1. `VITE_API_URL` 指向 BFF 的 baseURL
2. 复用模板项目现有 axios 封装与拦截器
3. 在 `src/api/` 中新增业务模块 API 文件（见后文“页面与接口映射”）

---

## 对接方案B（开发最快）：HTTP触发器直连云函数

### B1. 在云开发控制台配置 HTTP 触发
在 CloudBase/云函数后台，为 `admin_manager` 配置 HTTP 触发（或 API 网关）。
- 方法：POST
- Path：建议 `/admin_manager`
- Body：JSON
- CORS：允许你的后台域名（例如 `https://admin.yourdomain.com`）

### B2. 前端请求协议（固定）
对 `admin_manager` 的每次调用都发：
```json
{
  "action": "users_list",
  "data": {
    "token": "...",
    "page": 1,
    "page_size": 20
  }
}
```

云函数返回示例：
```json
{ "success": true, "list": [], "page": 1, "page_size": 20, "total": 0 }
```

### B3. 让 art-lnb-master 兼容云函数返回格式（两种改法，选一）
**改法1（推荐）**：新建一个 `src/utils/http/cloudbase.ts`，不要复用模板的 `BaseResponse(code/msg/data)` 规范。
- `cloudbasePost(action, data)`
- 若 `success !== true`：弹出错误 msg
- 若成功：返回 data（或原样返回）

**改法2（侵入式）**：改造 `src/utils/http/index.ts` 的响应拦截器，使其能识别两种响应：
- 传统 `{ code, msg, data }`
- 云函数 `{ success, msg, ... }`

企业级建议：**改法1**，避免影响模板原有模块。

---

## 登录与鉴权（外部后台必须实现）

### 云函数侧（已实现）
`admin_manager` 提供：
- `admin_login`：手机号 + 密码登录（仅 `users.is_admin=true` 可登录）
  - 返回：`token` + `expires_in` + `admin`（含 `user_id/phone/display_name/user_no`）
- `admin_me`：用 token 换取当前管理员信息
- 所有其它 action：必须在 `data.token` 中携带 token

### art-lnb-master 侧（另一个AI需要完成的改造点）
1. 替换 `src/api/auth.ts`：
   - `fetchLogin` 不再请求 `/api/auth/login`，改为调用 `admin_manager.admin_login`
   - `fetchGetUserInfo` 不再请求 `/api/user/info`，改为调用 `admin_manager.admin_me`
2. 登录成功后把 `token` 存入：
   - `useUserStore().setToken(token)`（模板会在请求拦截器中放到 `Authorization`）
3. 把 `admin.user_id` 映射到模板期望的 `userId` 字段（Pinia 里用的是 `info.value.userId`）

---

## 页面与接口映射（必须照此落地）

### 菜单/页面清单
后台至少包含以下菜单与页面（与C端功能对应）：
- 账号与权限
  - 用户管理
- 基础字典
  - 学校/班级字典
- 内容运营
  - 首页轮播管理
- 预约管理
  - 预约项目
  - 预约排班
  - 预约记录
- 档案与检测
  - 孩子档案
  - 检测记录

### 每个页面的后端调用方式
统一走 `admin_manager`：
- 列表：`*_list`
- 详情：`*_detail`
- 新增：`*_create`
- 编辑：`*_update`
- 删除：`*_delete`
- 状态：`*_toggle` / `*_set_status` / `*_set_admin`

### 建议的前端文件落位（art-lnb-master）
让另一个AI按以下目录新增页面：
- `src/views/vision-admin/users/index.vue`
- `src/views/vision-admin/school-classes/index.vue`
- `src/views/vision-admin/banners/index.vue`
- `src/views/vision-admin/appointment-items/index.vue`
- `src/views/vision-admin/appointment-schedules/index.vue`
- `src/views/vision-admin/appointment-records/index.vue`
- `src/views/vision-admin/children/index.vue`
- `src/views/vision-admin/checkup-records/index.vue`

对应新增 API：
- `src/api/vision-admin.ts`（或拆成多个文件）
  - 每个方法内部调用 `admin_manager` action

路由与菜单：
- 新增 `src/router/modules/vision-admin.ts`（仿照现有 modules）
- 在菜单系统中注册该模块

UI组件建议复用模板已有：
- 搜索区：`art-search-bar`
- 表格：`art-table`
- 新增/编辑：弹窗（Element Plus Dialog）或抽屉

---

## 数据一致性强约束（学校/班级禁止自由输入）
小程序端已改造为：学校/班级必须从 `school_classes` 字典选择。

因此外部后台必须：
- 提供“学校/班级字典”的完整 CRUD
- 在“孩子档案编辑”中，学校/班级字段必须使用下拉（数据源来自 `school_classes_list`）

---

## 需要另一个AI在云开发侧做的上线动作
1. 部署云函数：
- `admin_manager`
- `profile_manager`（包含 `get_school_options`）
- `user_manager`（含 active/deleted 登录校验）
- `data_manager`、`appointment_manager`（按现有）
2.（如走方案B）配置 `admin_manager` HTTP 触发器
3. 在云数据库中创建或确保存在集合：
- `school_classes`
- `admin_sessions`

---

## 附录A：后台管理系统开发规划（原文，需完整保留）

以下内容来自：`docs/后台管理系统开发规划.md`

---

# 后台管理系统文档生成器

## 任务目标
根据项目的C端（用户端）功能，反推并生成后台管理系统的规划文档。

## 执行步骤

### 1. 扫描C端功能
- 已扫描小程序页面与云函数 action 路由：用户登录、孩子档案、预约报名、数据看板、检测记录、轮播配置。

### 2. 扫描数据模型
- 已提取云数据库集合：`users`、`children`、`school_classes`、`banners`、`appointment_items`、`appointment_schedules`、`appointment_records`、`checkup_records`、`admin_sessions`。

### 3. 扫描现有接口
- 已记录 C 端云函数接口（action、参数、响应）；并为 B 端生成可对接外部后台的完整 CRUD。

## 生成规范

### 一级菜单：[账号与权限]

#### 二级菜单：[用户管理]
搜索字段：
- `q`（输入框，匹配手机号/昵称/用户编号）
- `is_admin`（下拉选择：全部/是/否）
- `active`（下拉选择：全部/启用/禁用）
列表字段：
- 用户ID（`_id`）
- 用户编号（`user_no`）
- 手机号（`phone`）
- 昵称（`display_name`）
- 管理员（`is_admin`）
- 启用状态（`active`）
- 创建时间（`created_at`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除（软删除）
- 状态切换（启用/禁用）
- 状态切换（管理员权限开关）
新增/编辑表单字段：
- 手机号（必填，字符串，手机号格式）
- 密码（新增必填，编辑选填，字符串，长度 6–32）
- 昵称（选填，字符串，长度 1–20）
- 头像（选填，字符串，cloud fileId 或 URL）
- 管理员（选填，布尔）
- 启用状态（选填，布尔，默认 true）

---

### 一级菜单：[基础字典]

#### 二级菜单：[学校/班级字典]
搜索字段：
- `q`（输入框，匹配学校/班级）
- `active`（下拉选择：全部/启用/停用）
列表字段：
- 学校（`school`）
- 班级（`class_name`）
- 启用状态（`active`）
- 创建时间（`created_at`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（启用/停用）
新增/编辑表单字段：
- 学校（必填，字符串，长度 1–50）
- 班级（必填，字符串，长度 1–50）
- 启用状态（选填，布尔，默认 true）

---

### 一级菜单：[内容运营]

#### 二级菜单：[首页轮播管理]
搜索字段：
- `active`（下拉选择：全部/启用/停用）
列表字段：
- 图片地址（`image_url`）
- 排序（`order`）
- 启用状态（`active`）
- 创建时间（`created_at`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（启用/停用）
新增/编辑表单字段：
- 图片地址（必填，字符串，cloud fileId 或 URL）
- 排序（必填，数字，>=1）
- 启用状态（选填，布尔，默认 true）

---

### 一级菜单：[预约管理]

#### 二级菜单：[预约项目]
搜索字段：
- `q`（输入框，匹配项目名称）
- `active`（下拉选择：全部/启用/停用）
列表字段：
- 项目名称（`name`）
- 启用状态（`active`）
- 创建时间（`created_at`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（启用/停用）
新增/编辑表单字段：
- 项目名称（必填，字符串，长度 1–50）
- 启用状态（选填，布尔，默认 true）

#### 二级菜单：[预约排班]
搜索字段：
- `item_id`（下拉选择：预约项目）
- `date`（日期，单日筛选）
- `active`（下拉选择：全部/启用/停用）
列表字段：
- 预约项目（`item_id`）
- 日期（`date`，YYYY-MM-DD）
- 时段（`time_slot`）
- 最大容量（`max_count`）
- 已预约数（`booked_count`）
- 启用状态（`active`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（启用/停用）
新增/编辑表单字段：
- 预约项目（必填，字符串，存在于 `appointment_items._id`）
- 日期（必填，日期字符串 YYYY-MM-DD）
- 时段（必填，字符串，例如 09:00-10:00）
- 最大容量（必填，数字，>=0）
- 已预约数（选填，数字，>=0）
- 启用状态（选填，布尔，默认 true）

#### 二级菜单：[预约记录]
搜索字段：
- `child_id`（输入框）
- `phone`（输入框）
- `status`（下拉选择：confirmed/cancelled/…）
- `date`（日期范围：可在后续扩展）
列表字段：
- 孩子ID（`child_id`）
- 孩子姓名（`child_name`）
- 班级（`class_name`）
- 项目名称（`item_name`）
- 日期（`date`）
- 时段（`time_slot`）
- 手机号（`phone`）
- 状态（`status`）
- 创建时间（`created_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（例如：confirmed → cancelled）
新增/编辑表单字段：
- 状态（必填，字符串）
- 其他字段（选填，按现有 `appointment_records` 字段允许补录纠错）

---

### 一级菜单：[档案与检测]

#### 二级菜单：[孩子档案]
搜索字段：
- `q`（输入框，匹配孩子姓名/家长手机号/子编号）
- `school`（下拉选择：学校，来自 `school_classes`）
- `class_name`（下拉选择：班级，来自 `school_classes`）
列表字段：
- 孩子ID（`_id`）
- 子编号（`child_no`）
- 姓名（`name`）
- 性别（`gender`）
- 出生日期（`dob`）
- 学校（`school`）
- 班级（`class_name`）
- 家长手机号（`parent_phone`）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
新增/编辑表单字段：
- 姓名（必填，字符串 1–20）
- 性别（必填，枚举：男/女）
- 出生日期（必填，YYYY-MM-DD）
- 学校（必填，下拉选择，来自 `school_classes`）
- 班级（必填，下拉选择，来自 `school_classes`）
- 身高/体重（选填，数字）
- 症状/补充说明/体质观察/视力情况（选填，按 `children` 字段）

#### 二级菜单：[检测记录]
搜索字段：
- `child_id`（输入框）
- `date_from/date_to`（日期范围）
列表字段：
- 记录ID（`_id`）
- 孩子ID（`child_id`）
- 日期（`date`）
- 左眼视力（`vision_l`）
- 右眼视力（`vision_r`）
- 结论（`conclusion`，摘要）
- 更新时间（`updated_at`）
列表操作：
- 查看详情
- 编辑
- 删除
- 状态切换（预留：如需“作废/生效”，可增加 `active` 字段）
新增/编辑表单字段：
- 孩子ID（必填，字符串，存在于 `children._id`）
- 日期（必填，YYYY-MM-DD，同一孩子同日仅允许一条）
- 身高（选填，数字）
- 体重（选填，数字）
- 左/右裸眼视力（选填，字符串）
- 左/右屈光度（选填，对象：`{s,c,a}`）
- 视光诊断（选填，对象：`{vision_status,refraction_status,axis_status,cornea_status}`）
- 结论（选填，文本）

---

## 附录B：API设计（原文，需完整保留）

以下内容来自：`docs/API设计.md`

---

# API设计

## 说明
当前后端继续使用微信云开发（云函数 + 云数据库）。

为便于“外部自建后台”对接，本项目提供两层接口：
- **C端接口**：小程序直接调用云函数（`wx.cloud.callFunction`）。
- **B端接口**：外部后台通过云函数 `admin_manager` 实现完整 CRUD（列表/详情/新增/编辑/删除/状态）。

外部后台对接方式建议：
- 方式A（推荐）：外部后台服务端使用 CloudBase Server SDK 调用云函数（不需要用户 OPENID）。
- 方式B：给云函数配置 HTTP 触发（如你团队已有网关），外部后台以 HTTP 调用并透传 `action/data`。

---

## 一、C端接口（从实际代码提取）

### 1) user_manager（云函数）
- `register`
  - 入参：`{ phone, password }`
  - 出参：`{ success, msg? }`
- `login_phone`
  - 入参：`{ phone, password }`
  - 出参：`{ success, user?, msg? }`
- `get_user_info`
  - 入参：`{}`
  - 出参：`{ success, user? }`
- `get_profile`
  - 入参：`{}`
  - 出参：`{ success, profile: { user_id, user_no, display_name, avatar_file_id, phone, is_admin } }`
- `update_profile`
  - 入参：`{ data: { display_name?, avatar_file_id?, user_no? } }`
  - 出参：`{ success, msg? }`
- `bootstrap_admin`
  - 入参：`{}`
  - 出参：`{ success, is_admin?, code?, msg? }`
- `set_admin_by_user_no`
  - 入参：`{ data: { user_no } }`
  - 出参：`{ success, msg? }`

### 2) profile_manager（云函数）
- `get`
  - 入参：`{}`
  - 出参：`{ success, list: children[] }`
- `update`
  - 入参：`{ data: child }`（有 `_id` 更新；无 `_id` 新增）
  - 出参：`{ success, msg? }`
- `delete_child`
  - 入参：`{ data: { _id } }`
  - 出参：`{ success, msg? }`
- `get_school_options`
  - 入参：`{}`
  - 出参：`{ success, schools: string[], classes_map: { [school]: string[] } }`

### 3) data_manager（云函数）
- `get_banners`
  - 入参：`{}`
  - 出参：`{ success, list: banners[] }`
- `get_records`
  - 入参：`{ data: { child_id } }`
  - 出参：`{ success, list: checkup_records[] }`
- `get_record`
  - 入参：`{ data: { record_id } }`
  - 出参：`{ success, record?, msg? }`
- `create_record`
  - 入参：`{ data: { record } }`
  - 出参：`{ success, record_id?, code?, msg? }`
- `update_record`
  - 入参：`{ data: { record_id, patch } }`
  - 出参：`{ success, code?, msg? }`

### 4) appointment_manager（云函数）
- `get_items`
  - 入参：`{}`
  - 出参：`{ success, list: appointment_items[] }`
- `get_schedules`
  - 入参：`{ data: { item_id } }`
  - 出参：`{ success, list: appointment_schedules[] }`
- `book`
  - 入参：`{ data: { schedule_id, child_id, child_name, item_name, date, time_slot, phone, class_name } }`
  - 出参：`{ success, msg? }`
- `get_my_records`
  - 入参：`{}`
  - 出参：`{ success, list: appointment_records[] }`
- `list_by_child`
  - 入参：`{ data: { child_id } }`
  - 出参：`{ success, list: appointment_records[] }`

---

## 二、B端接口（根据规划生成完整CRUD）

### 统一约定
- 所有 B 端接口都通过云函数：`admin_manager`
- 入参统一：`{ action, data }`
- 认证：除 `admin_login` 外，所有接口都必须传 `data.token`

#### 认证
- `admin_login`
  - 入参：`{ phone, password }`
  - 出参：`{ success, token, expires_in, admin: { user_id, phone, display_name, user_no } }`
- `admin_logout`
  - 入参：`{ token }`
  - 出参：`{ success }`

- `admin_me`
  - 入参：`{ token }`
  - 出参：`{ success, admin: { user_id, phone, display_name, user_no, is_admin } }`

---

### 1) 用户管理（users）
- `users_list`（列表）
  - 入参：`{ token, q?, page?, page_size? }`
  - 出参：`{ success, list, page, page_size, total }`
- `users_detail`（详情）
  - 入参：`{ token, user_id }`
  - 出参：`{ success, user }`
- `users_create`（新增）
  - 入参：`{ token, phone, password, display_name?, is_admin?, active? }`
  - 出参：`{ success, user_id }`
- `users_update`（编辑）
  - 入参：`{ token, user_id, patch: { phone?, display_name?, avatar_file_id? } }`
  - 出参：`{ success }`
- `users_delete`（删除，软删除）
  - 入参：`{ token, user_id }`
  - 出参：`{ success }`
- `users_toggle`（状态）
  - 入参：`{ token, user_id, active }`
  - 出参：`{ success }`
- `users_set_admin`（状态/权限）
  - 入参：`{ token, user_id, is_admin }`
  - 出参：`{ success }`



---

### 2) 学校/班级字典（school_classes）
- `school_classes_list`（列表）
  - 入参：`{ token, q?, active?, page?, page_size? }`
  - 出参：`{ success, list, page, page_size, total }`
- `school_classes_detail`（详情）
  - 入参：`{ token, _id }`
  - 出参：`{ success, row }`
- `school_classes_create`（新增）
  - 入参：`{ token, school, class_name, active? }`
  - 出参：`{ success, _id }`
- `school_classes_update`（编辑）
  - 入参：`{ token, _id, patch: { school?, class_name?, active? } }`
  - 出参：`{ success }`
- `school_classes_delete`（删除）
  - 入参：`{ token, _id }`
  - 出参：`{ success }`
- `school_classes_toggle`（状态）
  - 入参：`{ token, _id, active }`
  - 出参：`{ success }`

---

### 3) 首页轮播（banners）
- `banners_list`
- `banners_detail`
- `banners_create`
- `banners_update`
- `banners_delete`
- `banners_toggle`

---

### 4) 预约项目（appointment_items）
- `appointment_items_list`
- `appointment_items_detail`
- `appointment_items_create`
- `appointment_items_update`
- `appointment_items_delete`
- `appointment_items_toggle`

---

### 5) 预约排班（appointment_schedules）
- `appointment_schedules_list`
- `appointment_schedules_detail`
- `appointment_schedules_create`
- `appointment_schedules_update`
- `appointment_schedules_delete`
- `appointment_schedules_toggle`

---

### 6) 预约记录（appointment_records）
- `appointment_records_list`
- `appointment_records_detail`
- `appointment_records_create`
- `appointment_records_update`
- `appointment_records_delete`
- `appointment_records_set_status`

---

### 7) 孩子档案（children）
- `children_list`
- `children_detail`
- `children_create`
- `children_update`
- `children_delete`

- `children_toggle`（状态）
  - 入参：`{ token, child_id, active }`
  - 出参：`{ success }`

（补充：新增孩子建议仍由 C 端完成；后台新增如需开放可补 `children_create`。）

---

### 8) 检测记录（checkup_records）
- `checkup_records_list`
- `checkup_records_detail`
- `checkup_records_create`
- `checkup_records_update`
- `checkup_records_delete`

- `checkup_records_toggle`（状态）
  - 入参：`{ token, record_id, active }`
  - 出参：`{ success }`

---

## 三、数据模型（字段对齐）

### users
- `_id` string
- `_openid` string（绑定小程序用户）
- `phone` string
- `password` string
- `display_name` string
- `avatar_file_id` string
- `user_no` string（8位数字）
- `is_admin` boolean
- `active` boolean（默认 true；false 表示禁用登录）
- `deleted` boolean（软删除标记）
- `created_at` date
- `updated_at` date

### children
- `_id` string
- `_openid` string
- `parent_phone` string
- `name` string
- `gender` string
- `dob` string（YYYY-MM-DD）
- `school` string（必须来自 `school_classes`）
- `class_name` string（必须来自 `school_classes`）
- `height` number
- `weight` number
- `symptoms` string[]
- `symptom_other` string
- `additional_note` string
- `tongue_shape/tongue_color/tongue_coating/face_color/lip_color/hair` string
- `vision_status` string
- `refraction_l/refraction_r` string
- `avatar_file_id` string
- `child_no` string（8位数字）
- `active` boolean
- `created_at` date
- `updated_at` date

### school_classes
- `_id` string
- `school` string
- `class_name` string
- `active` boolean
- `created_at` date
- `updated_at` date

### banners
- `_id` string
- `image_url` string
- `order` number
- `active` boolean
- `created_at` date
- `updated_at` date

### appointment_items
- `_id` string
- `name` string
- `active` boolean
- `created_at` date
- `updated_at` date

### appointment_schedules
- `_id` string
- `item_id` string
- `date` string（YYYY-MM-DD）
- `time_slot` string
- `max_count` number
- `booked_count` number
- `active` boolean（B端使用）
- `created_at` date
- `updated_at` date

### appointment_records
- `_id` string
- `_openid` string
- `child_id` string
- `child_name` string
- `class_name` string
- `schedule_id` string
- `item_name` string
- `date` string
- `time_slot` string
- `phone` string
- `status` string
- `created_at` date
- `updated_at` date

### checkup_records
- `_id` string
- `child_id` string
- `date` string
- `height` number
- `weight` number
- `vision_l` string
- `vision_r` string
- `refraction_l` object `{ s, c, a }`
- `refraction_r` object `{ s, c, a }`
- `diagnosis` object `{ vision_status, refraction_status, axis_status, cornea_status }`
- `conclusion` string
- `active` boolean
- `created_at` date
- `updated_at` date

### admin_sessions
- `_id` string
- `token` string
- `user_id` string
- `expire_at_ms` number
- `created_at` date
