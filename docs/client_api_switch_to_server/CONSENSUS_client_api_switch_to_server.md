# CONSENSUS_client_api_switch_to_server

## 1. 最终共识
- 小程序端统一切换到服务器后端：
  - `https://api.gmxd.asia/api/v1`
- 管理后台开发代理与生产 API 统一切换到服务器入口：
  - `https://api.gmxd.asia`
- 本次先完成代码配置切换，不处理管理后台正式上线部署。

## 2. 验收标准
- 小程序 `app.js` 与请求工具默认地址均已切换到服务器。
- 管理后台 `.env.development` 的代理目标已切换到服务器。
- 管理后台 `.env.production` 的 API 地址已切换到服务器。
- 修改后无新增 lint 报错。

## 3. 技术共识
- 小程序请求路径格式保持不变，仅改基础地址。
- 管理后台开发环境保留 `/api` 代理方案，只改 `VITE_API_PROXY_URL`。
- 管理后台生产环境直接改 `VITE_API_URL` 为服务器主机根地址。
