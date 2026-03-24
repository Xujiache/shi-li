# ALIGNMENT_banner_dashboard_fix

## 1. 原始需求（来自用户反馈）

- 看板页（`miniprogram/pages/dashboard/index`）内容宽度与首页不一致：看板内容偏窄，要求与首页同宽。
- 首页轮播图在后台无法更换。
- 轮播图需要增加**主标题/副标题**能力（后台可编辑保存，小程序首页可展示）。

## 2. 项目上下文分析（当前代码现状）

### 2.1 技术栈与结构

- **小程序端**：微信小程序（WXML/WXSS/JS），通过 `wx.cloud.callFunction` 调用云函数。
- **云开发**：CloudBase（云函数：`admin_manager`、`data_manager` 等；集合：`banners`）。
- **外部后台（管理端）**：`art-lnb-master`（Vue3 + Vite + ElementPlus + Pinia），通过 HTTP API 网关调用 `admin_manager`。

### 2.2 关键现状

- 全局样式 `miniprogram/app.wxss` 中 `.container` 使用 `display:flex` 且默认 `align-items:center`，会导致页面内容在横向“居中收缩”。
- 首页页面样式已覆写 `.container { align-items: stretch; }`，因此首页内容可全宽。
- 看板页未覆写 `align-items`，导致看板页内容变窄。
- 轮播图数据来自 `banners` 集合，后台页面使用 `CloudImageField` 管理图片字段 `image_url`，小程序端会将 `cloud://` FileID 转临时 URL 后渲染。

## 3. 需求理解（根因与修复方向）

### 3.1 看板宽度不一致根因

- 根因：看板页沿用全局 `.container align-items:center`，子元素未默认拉伸，导致视觉上“变窄”。
- 修复：在看板页局部覆写 `.container { align-items: stretch; }`，与首页一致。

### 3.2 轮播图后台更换 + 主/副标题需求

- 后台需支持为 `banners` 写入 `title`/`sub_title` 字段，并在列表/编辑弹窗中可编辑。
- 小程序首页需在轮播图上叠加显示 `title`/`sub_title`（有值才显示），避免影响无标题的历史数据。

## 4. 范围边界（In/Out）

### 4.1 In Scope（本次交付）

- 看板页宽度与首页一致（全宽拉伸）。
- 后台轮播图：可新增/编辑时填写 `title`、`sub_title`，并随 `image_url/order/active` 一并保存。
- 小程序首页轮播图：展示主/副标题（文字遮罩），并在返回首页时自动刷新轮播图数据。

### 4.2 Out of Scope（本次不做）

- 轮播图点击跳转（link/url）能力与埋点。
- 轮播图多语言/富文本渲染、复杂排版。
- 对历史脏数据（例如 `image_url` 写成 `/pages/...` 或无效 FileID）的批量迁移清洗（仅做过滤与输入校验）。

## 5. 初版验收标准（可测试）

- 看板页首屏卡片/内容宽度与首页一致，不再出现左右留白导致的“变窄”。
- 后台在“轮播图管理”中上传/更换图片后保存成功，小程序首页能看到最新图片。
- 后台编辑轮播图的主标题/副标题后保存成功，小程序首页轮播图上能显示对应文字（无值不显示）。

