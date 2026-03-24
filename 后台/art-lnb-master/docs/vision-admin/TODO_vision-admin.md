# 儿童视力管理后台 - 待办与配置

## 必须配置（否则无法对接云开发）

### 1. 云函数 HTTP 触发地址
- **位置**：`.env.development`、`.env.production`
- **变量**：`VITE_CLOUDBASE_HTTP_URL`
- **说明**：填写云函数 `admin_manager` 的 HTTP 触发 URL（方案 B）。例如：
  ```env
  VITE_CLOUDBASE_HTTP_URL = https://xxx.tcloudbaseapp.com/admin_manager
  ```
- **获取方式**：微信云开发控制台 → 云函数 → 选择 `admin_manager` → 触发器 → 创建/查看 HTTP 触发器，并配置 CORS 允许后台前端域名。

### 2. 云开发侧
- 部署并发布云函数：`admin_manager`（以及 C 端依赖的 `profile_manager`、`user_manager`、`data_manager`、`appointment_manager` 等）。
- 云库中确保存在集合：`users`、`children`、`school_classes`、`banners`、`appointment_items`、`appointment_schedules`、`appointment_records`、`checkup_records`、`admin_sessions`。
- 至少一个 `users` 文档将 `is_admin` 设为 `true`，并用该手机号+密码在后台登录。

## 可选优化

- **孩子档案 - 学校/班级**：当前为输入框。若需与 C 端一致「仅从字典选择」，可在孩子档案表单中改为下拉，数据源为 `schoolClassesList` 的列表或单独拉取的 `get_school_options`。
- **检测记录**：当前仅列表与搜索；若需「新增/编辑/删除」可复用 `checkup_records_create/update/delete` 与弹窗表单，字段参考 `docs/后台管理系统开发规划.md` 中「检测记录」表单。
- **预约记录**：当前仅列表；若需状态切换可调用 `appointmentRecordsSetStatus` 并在表格操作列增加按钮。

## 本地运行

```bash
# 安装依赖（如未安装）
pnpm install

# 开发
pnpm dev

# 构建
pnpm build
```

登录时使用 **手机号** + **密码**（与云开发 `users` 中 is_admin 为 true 的账号一致）。
