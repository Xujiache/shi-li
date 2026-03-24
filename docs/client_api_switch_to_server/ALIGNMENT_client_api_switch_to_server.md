# ALIGNMENT_client_api_switch_to_server: 客户端切换到服务器后端

## 1. 项目上下文分析

### 1.1 目标范围
- 小程序端：`小程序端/最终（视力）/miniprogram`
- 管理后台：`后台/art-lnb-master`
- 目标后端：已部署到 `https://api.gmxd.asia`

### 1.2 当前现状
- 服务器端后端已经部署成功，并通过：
  - `https://api.gmxd.asia/health`
  - `https://api.gmxd.asia/api/v1/mobile/content/terms`
  验证了 HTTPS 反向代理链路可用。
- 本地代码中仍存在客户端指向本地后端的配置：
  - 小程序 `apiBaseUrl`
  - 小程序请求工具默认回退地址
  - 管理后台开发代理地址
  - 管理后台生产 API 地址

## 2. 原始需求
- 把代码都改到这个后端。
- 先验证小程序是否全部连到服务器后端，再处理管理后台上线。

## 3. 需求理解（可执行）
- **本次优先目标**：
  - 将小程序所有 HTTP 请求统一切换到 `https://api.gmxd.asia/api/v1`
  - 将管理后台开发/生产环境 API 配置统一切到 `https://api.gmxd.asia`
- **本次不包含**：
  - 管理后台服务器上线部署
  - HTTPS/域名改造

## 4. 决策与约束
- 小程序继续使用 `apiBaseUrl + path` 拼接模式，因此基础地址应配置为：
  - `https://api.gmxd.asia/api/v1`
- 管理后台代码中接口路径自带 `/api/v1/...`，因此 `VITE_API_URL` 应配置为主机根地址：
  - `https://api.gmxd.asia`
- 管理后台开发环境继续保留 Vite 代理模式，仅将代理目标改为服务器地址。

## 5. 验收标准
- 小程序代码中不再保留 `127.0.0.1:3000/api/v1` 作为实际请求地址。
- 管理后台开发/生产配置不再指向本地 `127.0.0.1:3000`。
- 静态检查无新增报错。
- 你可以直接在微信开发者工具里验证小程序请求是否都打到服务器。
