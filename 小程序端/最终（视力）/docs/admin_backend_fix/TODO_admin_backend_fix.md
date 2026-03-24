# TODO_admin_backend_fix

## 必做（你现在就能按清单操作）

- [ ] **部署云函数**：把本次改动的云函数上传并部署
  - `cloudfunctions/admin_manager`
  - `cloudfunctions/user_manager`
  - `cloudfunctions/profile_manager`
  - `cloudfunctions/data_manager`
- [ ] **确认数据库集合存在**：若是新环境，先运行 `db_init` 初始化集合与默认数据（含 `system_config`）。
- [ ] **验收用例跑通**：见 `ACCEPTANCE_admin_backend_fix.md`

## 建议做（提升安全与可维护性）

- [ ] **小程序登录态 token 化**：目前 phone 登录是“返回 user 并以 user_id 识别”，建议改为云端签发 token（绑定 openid + user_id + 过期），后续云函数仅接收 token，避免 user_id 可被篡改的风险。
- [ ] **密码存储加密**：`users.password` 目前为明文，建议改为 hash（bcrypt/argon2）并增加改密流程。
- [ ] **统一 OPENID/手机号绑定策略**：当前 `login_phone` 会把 `_openid` 更新为当前 OPENID；若未来需要“一个手机号账号可被多个微信使用”，需要改为多 openid 绑定表或不覆盖策略。
- [ ] **索引与查询优化**：随着数据量增长，建议为常用查询字段建立索引（如 `children.parent_phone`、`appointment_records.phone`、`system_config.key`）。
- [ ] **后台数据治理**：对历史脏数据（缺少 `parent_phone`、缺少 `child_no` 等）做一次性清洗脚本，降低边缘问题。

