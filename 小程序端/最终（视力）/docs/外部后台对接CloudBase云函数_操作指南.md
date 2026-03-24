# 外部后台对接 CloudBase 云函数（操作指南）

目标：让你的外部后台项目 `art-lnb-master` 能调用 CloudBase 云函数 `admin_manager`，并完成后台登录与后续 CRUD 调用。

> 关键点：`tcloudbasegateway.com/v1/functions/...` 这类 HTTP API 调用必须携带 **CloudBase access_token**，否则会报 `401 / MISSING_CREDENTIALS`。

---

## 一、准备条件（必须确认）

### 1) CloudBase 侧（你的小程序云开发环境）
- 云函数已部署：`admin_manager`
- 云数据库集合存在：
  - `users`、`children`、`school_classes`、`banners`
  - `appointment_items`、`appointment_schedules`、`appointment_records`
  - `checkup_records`、`admin_sessions`

### 2) 管理员账号（用于后台登录）
在 CloudBase 的 `users` 集合中，确保至少有 1 个管理员用户：
- `is_admin: true`
- `phone`: 管理员手机号
- `password`: 管理员密码

---

## 二、拿到 CloudBase HTTP API 地址（云函数网关 URL）

**无需在云函数列表里点“开通 HTTP 触发”（控制台没有该按钮）。** 所有已部署的云函数都可通过环境级 HTTP API 网关调用。

任选一种方式得到地址即可：

**方式 A：用环境 ID 拼接**  
- 在 CloudBase 控制台**首页/概览**查看当前环境的 **环境 ID**（形如 `cloud1-xxxxxx`）。  
- 网关地址固定为：  
  `https://{环境ID}.api.tcloudbasegateway.com/v1/functions/admin_manager`  
  例如环境 ID 为 `cloud1-abc123` 时，地址即为：  
  `https://cloud1-abc123.api.tcloudbasegateway.com/v1/functions/admin_manager`

**方式 B：从示例里抄**  
- 控制台 → 云函数 → 顶部「云函数快速入门」→ 右侧切到 **HTTP API** Tab，复制示例里的 URL，把其中的函数名改成 `admin_manager`。

---

## 三、为什么你 curl 会 401（MISSING_CREDENTIALS）

原因：CloudBase HTTP API 网关调用必须在请求头里携带：

`Authorization: Bearer <access_token>`

这里的 `<access_token>` 是 **CloudBase 的访问令牌**（不是 `admin_manager` 返回的业务 token）。

调用链是“两层 token”：
1. `access_token`：让你有权限调用 CloudBase 网关（必须）
2. `admin_manager token`：你登录后台后拿到的业务 token（后续 CRUD 必须带在 `data.token`）

---

## 四、在外部后台获取 CloudBase access_token（推荐：匿名登录）

### 1) 安装 CloudBase Web SDK
在 `c:\Users\Administrator\Desktop\art-lnb-master` 目录执行：

```bash
pnpm add @cloudbase/js-sdk
```

### 2) 新建工具文件 `src/utils/cloudbase.ts`

```ts
import cloudbase from '@cloudbase/js-sdk'

const app = cloudbase.init({
  env: 'cloud1-1gwuiims1ab650b6'
})

let accessTokenCache = ''

export async function getCloudbaseAccessToken() {
  if (accessTokenCache) return accessTokenCache

  await app.auth().anonymousAuthProvider().signIn()

  const { accessToken } = app.auth().getAccessToken()
  if (!accessToken) throw new Error('获取 CloudBase accessToken 失败')

  accessTokenCache = accessToken
  return accessTokenCache
}
```

> 如果匿名登录不可用：需要在 CloudBase 控制台开启身份认证能力（至少启用匿名登录），或换成你启用的登录方式。

---

## 五、封装调用 `admin_manager` 的统一函数

### 1) 新建 API 文件 `src/api/cloud-admin.ts`

把 CloudBase 网关 URL 写死先跑通（跑通后再挪到 `.env` 也行）：

```ts
import request from '@/utils/http'
import { getCloudbaseAccessToken } from '@/utils/cloudbase'

const CLOUDBASE_FUNCTION_URL =
  'https://cloud1-1gwuiims1ab650b6.api.tcloudbasegateway.com/v1/functions/admin_manager'

interface AdminManagerPayload {
  action: string
  data?: any
}

export async function callAdminManager<T = any>(payload: AdminManagerPayload): Promise<T> {
  const accessToken = await getCloudbaseAccessToken()

  return request.post<T>({
    url: CLOUDBASE_FUNCTION_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: payload,
    showErrorMessage: true,
    showSuccessMessage: false
  })
}

export function apiAdminLogin(params: { phone: string; password: string }) {
  return callAdminManager<{ token: string }>(
    {
      action: 'admin_login',
      data: params
    }
  )
}

export function apiUsersList(params: { token: string; page?: number; page_size?: number }) {
  return callAdminManager({
    action: 'users_list',
    data: params
  })
}
```

---

## 六、把后台登录接口改成走 `admin_manager`

编辑 `src/api/auth.ts`：

```ts
import { apiAdminLogin } from './cloud-admin'

export function fetchLogin(params: Api.Auth.LoginParams) {
  const phone = params.phone || params.userName || ''
  if (!phone) return Promise.reject(new Error('请输入手机号'))

  return apiAdminLogin({ phone, password: params.password }).then((res) => {
    return { token: res.token } as Api.Auth.LoginResponse
  })
}
```

登录后拿到的 `token`（业务 token）要保存到你后台的 store（`accessToken`），后续调用时传到 `data.token`。

---

## 七、用 curl 本地验证（可选，用于排障）

把 `:name` 替换成 `admin_manager`，并把 `<access_token>` 换成你从 CloudBase SDK 获取到的真实 token：

```bash
curl -L 'https://cloud1-1gwuiims1ab650b6.api.tcloudbasegateway.com/v1/functions/admin_manager' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer <access_token>' \
  -d '{"action":"admin_login","data":{"phone":"你的管理员手机号","password":"你的管理员密码"}}'
```

成功返回后会拿到：
- `token`：这是 **后台业务 token**，后续调用例如：

```json
{ "action": "users_list", "data": { "token": "上一步token", "page": 1, "page_size": 20 } }
```

---

## 八、本地启动与检查

在 `art-lnb-master` 目录：

```bash
pnpm install
pnpm dev
```

浏览器打开 `http://localhost:5173`，用管理员手机号+密码登录。

如果仍然报 401：
- 说明 CloudBase `access_token` 没拿到或没带上请求头
- 或 CloudBase 侧身份认证未开启匿名登录

---

## 九、生产部署（宝塔）— 联接到云开发

当后台部署到服务器（如通过 **宝塔面板**）时，前端仍是同一套逻辑：浏览器加载 Vue 打包后的静态资源，在用户设备上执行 `getCloudbaseAccessToken()` 和 `callAdminManager()`，因此**部署到生产后同样可以联接到微信云开发**，无需单独的后端服务。

请按 **[《儿童视力管理后台 — 宝塔面板部署步骤》](../宝塔面板部署步骤.md)** 完成部署，并重点确认：

| 项 | 说明 |
|----|------|
| 环境变量 | 构建前在 `.env.production` 中配置 `VITE_CLOUDBASE_HTTP_URL`，填 **CloudBase 云函数网关地址**（本指南第二节的 URL），不要填成其他 HTTP 触发地址。 |
| 安全来源/安全域名 | 在 CloudBase 控制台「安全」或「环境配置 → 安全配置」里添加**后台站点域名**（如 `https://admin.yourdomain.com`），否则浏览器会报跨域。 |
| 匿名登录 | 若使用本指南的匿名登录方式，CloudBase 控制台需已开启「匿名登录」，线上与本地一致。 |
| 校验方式 | 部署后浏览器访问后台域名，用管理员账号登录；能正常进入后台即表示已成功联接到 CloudBase。 |

本地已按本指南接好 CloudBase 后，只需在部署时保证上述几点，即可在宝塔部署的 Vue 后台联机到微信云开发后端。
