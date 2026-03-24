# ACCEPTANCE_云开发迁移到Node后端

## 一、验收范围

本次验收覆盖以下内容：

- `说明文档.md` 与迁移文档集
- `node后端（新增）` 的后端收敛、MySQL、JWT、上传、核心业务接口
- 小程序端核心业务调用从云函数切换到 Node HTTP API
- 管理后台 `vision-admin` 调用从 CloudBase 网关切换到 Node REST API
- 关键链路联调与构建验证

## 二、文档验收

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| `说明文档.md` 已创建 | 通过 | 包含项目规划、实施方案、进度记录 |
| `ALIGNMENT` 已创建 | 通过 | 已明确范围、边界、约束与确认项 |
| `CONSENSUS` 已创建 | 通过 | 已明确迁移目标与验收标准 |
| `DESIGN` 已创建 | 通过 | 已包含架构、API、MySQL 与数据流设计 |
| `TASK` 已创建 | 通过 | 已拆分为 5 个阶段并标明依赖 |
| `ACCEPTANCE` 已创建 | 通过 | 当前文档 |
| `FINAL` 已创建 | 通过 | 已补充总结文档 |
| `TODO` 已创建 | 通过 | 已补充剩余配置与建议 |

## 三、后端验收

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| Node 后端可启动 | 通过 | `npm run dev` 启动成功 |
| MySQL 建库建表成功 | 通过 | `npm run init-db` 成功执行 |
| 种子数据初始化成功 | 通过 | `npm run init-data` 成功执行 |
| JWT 双端鉴权可用 | 通过 | 已验证移动端与后台登录 |
| 文件上传可用 | 通过 | 已验证 `/api/v1/common/upload/image` 与静态访问 |
| 移动端接口可用 | 通过 | 已验证登录、孩子列表、检测记录、预约创建与查询 |
| 后台接口可用 | 通过 | 已验证登录、用户列表、孩子列表、预约项目、协议与统计 |

## 四、小程序端验收

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| 手机号登录切换到 Node | 通过 | 登录页已改为 `/api/v1/mobile/auth/login` |
| 协议读取切换到 Node | 通过 | 登录页已改为 `/api/v1/mobile/content/terms` |
| 孩子档案切换到 Node | 通过 | 首页、档案编辑、孩子选择页已切换 |
| 预约链路切换到 Node | 通过 | 预约列表、预约下单、我的预约已切换 |
| 检测记录切换到 Node | 通过 | 看板、历史、记录编辑页已切换 |
| 头像上传切换到 Node | 通过 | 我的页面改为调用本地上传接口 |
| 微信快捷登录代码已接入 | 通过 | 已改为 `wx.login -> /mobile/auth/wechat-login` |
| 微信快捷登录实测 | 条件通过 | 缺少 `WECHAT_APP_SECRET`，未做实网验证 |

## 五、管理后台验收

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| 管理员登录切换到 Node | 通过 | `fetchLogin` 已走 `/api/v1/admin/auth/login` |
| `vision-admin` API 切换到 REST | 通过 | `src/api/vision-admin.ts` 已改造 |
| 图片上传切换到 Node | 通过 | `cloudbase-storage.ts` 已改为本地上传 |
| 后台构建通过 | 通过 | `npm run build` 成功执行 |

## 六、联调记录

### 6.1 已执行命令

```bash
npm run init-db
npm run init-data
npm run build
```

### 6.2 已验证接口

- `GET /health`
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/mobile/auth/login`
- `GET /api/v1/mobile/content/banners`
- `GET /api/v1/mobile/children`
- `GET /api/v1/mobile/checkups`
- `POST /api/v1/mobile/appointments/bookings`
- `GET /api/v1/mobile/appointments/bookings`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/children`
- `GET /api/v1/admin/appointment-items`
- `GET /api/v1/admin/system-config/terms`
- `GET /api/v1/admin/dashboard/stats`
- `POST /api/v1/common/upload/image`

## 七、剩余注意事项

- 微信快捷登录需要补充 `WECHAT_APP_SECRET` 才能在真实微信环境完成联调。
- 小程序和后台若需在真机或局域网设备访问，需要将本地 `127.0.0.1` 地址改成可达 IP 或部署域名。
- 仓库中仍保留历史云函数目录和少量旧说明文档，作为迁移参考，并非运行时依赖。
