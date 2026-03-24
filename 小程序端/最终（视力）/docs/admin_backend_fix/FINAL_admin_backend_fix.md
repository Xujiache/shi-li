# FINAL_admin_backend_fix

## 交付总结

本次修复聚焦两件事：

1) **小程序多账号不串号**：修复 `user_manager` 在携带 `user_id` 时 `_id` 可能为 `undefined` 的问题；并在 OPENID 回退时优先选择“最近登录账号”，降低误命中旧账号导致的数据混用；同时对孩子档案更新接口补齐归属校验，避免跨账号误改扩大串号影响面。

2) **后台管理能力补齐**：增加“协议与隐私”配置管理（`system_config.key=terms_and_privacy`），后台可编辑保存，小程序登录页优先走云函数读取协议，避免数据库直读权限导致加载失败。

## 关键改动清单（文件级）

### 小程序云函数（`WeChatProjects/最终（视力）`）

- `cloudfunctions/user_manager/index.js`
  - 修复 `user_id` 场景 `_id` 处理
  - `login_phone` 写入 `last_login_at/updated_at` 并绑定 `_openid`
  - `bootstrap_admin/set_admin_by_user_no` 支持按 `user_id` 定位当前用户
- `cloudfunctions/profile_manager/index.js`
  - `update` 更新孩子档案增加归属校验
- `cloudfunctions/data_manager/index.js`
  - `getCurrentUser` 的 `user_id` 分支 `_id` 修正
  - 新增 `terms_get`（公开只读）读取 `system_config` 协议内容

### 小程序前端

- `miniprogram/pages/auth/login/index.js`
  - `fetchTerms()` 优先调用 `data_manager.terms_get`，失败再回退数据库直读

### 后台（`art-lnb-master`）

- `src/views/vision-admin/terms-and-privacy/index.vue`
  - 新增“协议与隐私”管理页
- `src/router/modules/vision-admin.ts`
  - 新增路由 `terms-and-privacy`
- `src/api/vision-admin.ts`
  - 新增 `systemConfigTermsGet/systemConfigTermsUpdate`
- 云函数：`cloudfunctions/admin_manager/index.js`
  - 新增 `system_config_terms_get/system_config_terms_update`

## 部署与运行说明

- 重新部署云函数：`admin_manager/user_manager/profile_manager/data_manager`
- 后台前端重新构建发布（已本地 `pnpm build` 通过）

