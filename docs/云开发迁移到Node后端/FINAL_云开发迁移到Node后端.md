# FINAL_云开发迁移到Node后端

## 一、任务结论

本次已完成“儿童视力管理项目从微信云开发迁移到 Node 后端 + MySQL”的核心实施工作，形成了新的统一后端形态：

- 小程序端核心业务已切换到 Node HTTP API
- 管理后台 `vision-admin` 已切换到 Node REST API
- `node后端（新增）` 已成为唯一业务后端实现
- 微信云函数目录保留为历史参考，不再承担实际业务入口

## 二、核心成果

### 2.1 文档成果

- 创建 `说明文档.md`
- 创建 `ALIGNMENT`、`CONSENSUS`、`DESIGN`、`TASK`
- 创建 `ACCEPTANCE`、`FINAL`、`TODO`

### 2.2 后端成果

- 新建并收敛了真实业务表结构与初始化脚本
- 新增移动端与后台端 REST 接口
- 新增本地图片上传与静态访问
- 保留 JWT 双端隔离认证
- 新增微信登录官方 `code2session` 接入代码

### 2.3 小程序成果

- 登录页改为 Node 后端接口
- 首页、看板、历史、预约、我的预约、档案编辑、孩子选择、记录编辑全部切换为 HTTP 请求
- 头像上传改为 Node 上传接口
- 页面埋点改为 Node 统计接口

### 2.4 管理后台成果

- `vision-admin.ts` 已从 CloudBase action 封装改为标准 REST 封装
- 管理后台图片上传与预览逻辑改为 Node 文件服务
- 管理后台构建通过

## 三、当前运行方式

### 3.1 Node 后端

```bash
cd node后端（新增）
npm run init-db
npm run init-data
npm run dev
```

### 3.2 管理后台

```bash
cd 后台/art-lnb-master
npm run build
```

开发联调时，后台通过 `.env.development` 中的代理访问本地 Node 服务。

### 3.3 小程序端

小程序默认请求：

- `http://127.0.0.1:3000/api/v1`

若需要真机或局域网调试，需将 `miniprogram/app.js` 中的 `apiBaseUrl` 改为实际可访问地址。

## 四、已知限制

1. 微信快捷登录代码已接入，但需要补充 `WECHAT_APP_SECRET` 才能完成真实微信环境登录。
2. 仓库中仍保留历史云函数目录与部分旧文档，当前作为迁移参考，不再是运行必需。
3. 管理后台仍保留少量以 `cloudbase` 命名的历史文件名，但内部实现已改为 Node 上传/URL 模式。

## 五、建议下一步

1. 补充 `WECHAT_APP_SECRET` 后验证微信快捷登录。
2. 将小程序与后台的本地地址改成局域网或正式域名，验证真机访问。
3. 如需进一步彻底清理历史痕迹，可单独进行“云开发参考代码归档/删除”整理。
