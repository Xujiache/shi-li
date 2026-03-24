# ACCEPTANCE_admin_backend_fix

## 实施完成情况（代码侧）

- [x] `user_manager`：修复 `user_id` 场景 `_id` 处理与更新目标错误
- [x] `user_manager`：`login_phone` 写入 `last_login_at/updated_at`，OPENID 回退优先选最近账号
- [x] `profile_manager.update`：更新孩子档案增加归属校验
- [x] `admin_manager`：新增 `system_config_terms_get/update`（协议/隐私）
- [x] `art-lnb-master`：新增后台路由与页面 `vision-admin/terms-and-privacy`
- [x] `data_manager`：新增 `terms_get`，小程序登录页优先走云函数获取协议
- [x] `art-lnb-master`：通过 `pnpm build`（含 `vue-tsc --noEmit`）构建通过

## 需要你执行的环境动作（部署/验证）

> 下面两项属于“部署与运行态验证”，不在代码仓库内自动完成。

- [ ] 重新上传并部署云函数：
  - `cloudfunctions/admin_manager`
  - `cloudfunctions/user_manager`
  - `cloudfunctions/profile_manager`
  - `cloudfunctions/data_manager`
- [ ] 验收用例（建议按顺序）
  - **小程序**
    - A 手机号登录 → 创建孩子档案/预约/记录
    - 退出登录 → B 手机号登录（同一微信）→ 不应看到 A 的档案/预约/记录
    - 微信登录（同 OPENID 多账号）→ 默认进入最近登录账号
  - **后台**
    - 登录后台 → 菜单进入“协议与隐私” → 修改并保存 → 刷新仍存在
    - 小程序打开登录页 → 协议弹窗应显示最新内容（云函数读取）

