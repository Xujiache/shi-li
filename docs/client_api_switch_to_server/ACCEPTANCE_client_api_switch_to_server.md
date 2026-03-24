# ACCEPTANCE_client_api_switch_to_server

## 1. 验收结论
- 本次客户端切换服务器后端任务已完成。

## 2. 验收项

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| 小程序基础地址切换 | 通过 | `miniprogram/app.js` 已改为 `https://api.gmxd.asia/api/v1` |
| 小程序默认回退地址切换 | 通过 | `miniprogram/utils/request.js` 已改为 `https://api.gmxd.asia/api/v1` |
| 后台开发代理切换 | 通过 | `.env.development` 已改为 `https://api.gmxd.asia` |
| 后台生产 API 切换 | 通过 | `.env.production` 已改为 `https://api.gmxd.asia` |
| API 域名 HTTPS 可用 | 通过 | 已验证 `https://api.gmxd.asia/health` 与协议接口正常返回 |
| 后台生产构建同步 | 通过 | 已重新执行 `npm run build`，新的 `dist` 已生成 |
| 小程序静态检查 | 通过 | 已检查，无新增 lint 报错 |
| 后台旧地址残留检查 | 通过 | 新的 `dist` 中未发现旧 `127.0.0.1:3000` 地址或旧 IP 地址 |

## 3. 当前可执行验证
- 在微信开发者工具中打开小程序，确认请求全部发送到 `https://api.gmxd.asia`。
- 重点验证登录、首页轮播、协议、孩子档案、预约、问卷、历史记录、头像上传等链路。
