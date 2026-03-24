# 儿童视力管理 Node 后端

当前目录已从示例 Express 项目收敛为“儿童视力管理”项目的唯一业务后端，负责承接：

- 小程序端 `/api/v1/mobile/*`
- 管理后台 `/api/v1/admin/*`
- 公共上传接口 `/api/v1/common/upload/image`

## 技术栈

- Node.js
- Express
- MySQL
- JWT
- Multer
- Winston
- Redis（可选，不作为首版强依赖）

## 当前目录结构

```text
├── app.js
├── server.js
├── config/
├── middlewares/
├── routes/
│   ├── index.js
│   ├── admin/
│   ├── mobile/
│   └── common/
├── scripts/
│   ├── initDB.js
│   ├── initDbData.js
│   └── db/
├── services/
├── uploads/
├── utils/
├── .env
└── README.md
```

说明：

- 根层目录为当前正式后端结构。
- `src/` 为历史骨架参考目录，当前不再作为正式业务入口。

## 启动步骤

```bash
npm install
npm run init-db
npm run init-data
npm run dev
```

## 关键配置

请在 `.env` 中确认以下项目：

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `SERVER_PUBLIC_URL`

## 主要业务模块

- `authService`：手机号登录、后台登录、微信快捷登录
- `userService`：用户资料与后台用户管理
- `childService`：孩子档案与学校班级选项
- `appointmentService`：预约项目、排班、预约记录
- `checkupService`：检测记录
- `contentService`：轮播图、协议配置、埋点
- `dashboardService`：后台统计
- `uploadService`：本地文件上传与静态访问

## 已完成的迁移目标

- 不再依赖微信云函数承接实际业务
- 不再依赖 CloudBase HTTP 网关
- 不再依赖云存储上传图片
- 已改为本地 MySQL 与本地文件存储

## 已知待补配置

- 微信快捷登录需要补 `WECHAT_APP_SECRET`
- 若需真机调试，需要将 `SERVER_PUBLIC_URL` 和前端接口地址改为局域网可访问地址