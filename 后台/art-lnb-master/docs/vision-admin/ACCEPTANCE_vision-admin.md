# 儿童视力管理后台对接云开发 - 验收记录

## 完成项

### 1. 云开发对接层
- **`src/utils/http/cloudbase.ts`**：云函数 HTTP 直连封装，`cloudbasePost(action, data)`，失败时 ElMessage 提示并 reject。
- **`src/api/vision-admin.ts`**：所有 `admin_manager` 的 action 封装（认证、用户、学校班级、轮播、预约项目/排班/记录、孩子档案、检测记录），列表接口统一做分页参数映射（current/size → page/page_size）。

### 2. 登录与鉴权
- **`src/api/auth.ts`**：`fetchLogin` 改为调用 `adminLogin(phone, password)`；`fetchGetUserInfo` 改为调用 `adminMe()`，并将 `admin` 映射为模板所需的 `UserInfo`（userId/userName/roles）。
- **`src/types/api/api.d.ts`**：`LoginParams` 支持 `phone` / `userName`，`UserInfo.userId` 支持 `number | string`，`roles`/`buttons` 可选。
- **登录页**：表单项占位改为「手机号」，提交时传 `phone: username`。

### 3. 路由与菜单
- **`src/router/modules/vision-admin.ts`**：新增「儿童视力管理」一级菜单及 8 个子路由（用户管理、学校/班级字典、首页轮播、预约项目、预约排班、预约记录、孩子档案、检测记录）。
- **`src/router/modules/index.ts`**：将 `visionAdminRoutes` 加入 `routeModules`。菜单来源为前端路由（`VITE_ACCESS_MODE=frontend`），登录后可见「儿童视力管理」菜单。

### 4. 页面与功能
| 页面 | 路径 | 功能 |
|------|------|------|
| 用户管理 | `/vision-admin/users` | 列表(含 q/is_admin/active 搜索)、分页、新增/编辑(手机号/密码/昵称/管理员/启用)、删除、启用禁用、设管理员 |
| 学校/班级字典 | `/vision-admin/school-classes` | 列表、搜索、新增/编辑/删除、启用停用 |
| 首页轮播 | `/vision-admin/banners` | 列表、搜索、新增/编辑/删除、启用停用 |
| 预约项目 | `/vision-admin/appointment-items` | 列表、搜索、新增/编辑/删除、启用停用 |
| 预约排班 | `/vision-admin/appointment-schedules` | 列表、按日期/状态搜索、新增/编辑(选预约项目+日期+时段+容量)、删除、启用停用 |
| 预约记录 | `/vision-admin/appointment-records` | 列表、按孩子ID/手机号/状态/日期搜索 |
| 孩子档案 | `/vision-admin/children` | 列表、搜索、新增/编辑(姓名/性别/出生日期/学校/班级/家长手机号)、删除 |
| 检测记录 | `/vision-admin/checkup-records` | 列表、按孩子ID/日期范围搜索 |

### 5. 表格与分页
- **`src/utils/table/tableConfig.ts`**：`sizeFields` 增加 `page_size`，以兼容云函数返回的 `page_size`。
- 各列表页使用 `useTable` + `ArtTable`，请求参数使用 `current`/`size`，在 API 层映射为 `page`/`page_size`。

## 验收标准（需云函数与配置就绪后验证）

- [ ] 在 `.env.development` / `.env.production` 中配置 `VITE_CLOUDBASE_HTTP_URL` 为 `admin_manager` 的 **HTTP API 网关地址**（控制台一般不再显示「HTTP 触发」开关：进入 **云函数列表 → admin_manager → 接入指引 → HTTP API** 复制地址）。
  - 示例：`https://{环境ID}.api.tcloudbasegateway.com/v1/functions/admin_manager`
- [ ] 云函数 `admin_manager` 已部署且提供：admin_login、admin_me、users_*、school_classes_*、banners_*、appointment_*、children_*、checkup_records_*。
- [ ] 使用 `users.is_admin=true` 的账号以手机号+密码登录，能进入后台并看到「儿童视力管理」菜单。
- [ ] 各菜单下列表、分页、搜索、新增/编辑/删除（及状态切换）与云函数返回格式一致，无报错。

## 技术说明

- **对接方式**：采用实施指南中的 **方案 B**（前端直连 **CloudBase HTTP API 网关** → 云函数 `admin_manager`）。若需改为方案 A（BFF + CloudBase Server SDK），只需将 `VITE_API_URL` 指向 BFF，由 BFF 调用 `admin_manager` 并转成 `{ code, msg, data }`，同时登录/用户信息接口改为 BFF 提供的 URL，无需改前端业务页面逻辑。
- **鉴权**：除 `admin_login` 外，所有 `vision-admin` 请求均在 `data` 中自动附带 `token`（来自 `useUserStore().accessToken`）。
