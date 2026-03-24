# CONSENSUS_banner_dashboard_fix

## 1. 最终需求共识

### 1.1 看板页宽度一致性

- 看板页 `miniprogram/pages/dashboard/index` 的整体内容宽度应与首页一致（同样的容器宽度策略）。
- 不改变现有看板页信息结构，仅修复“内容变窄”的布局问题。

### 1.2 轮播图后台可更换 + 主/副标题

- 后台“轮播图管理”支持：
  - 图片可上传/替换并保存到 `banners.image_url`
  - 可选填写 `banners.title`（主标题，最多 30 字）
  - 可选填写 `banners.sub_title`（副标题，最多 60 字）
- 小程序首页轮播图支持：
  - 叠加展示主/副标题（有值才显示，避免空白占位）
  - 返回首页时自动刷新轮播数据，便于后台改完立即看到

## 2. 技术实现共识（约束与集成）

- 数据库存储集合：`banners`，新增字段：`title`、`sub_title`（无强 schema，按文档写入）。
- 云函数：
  - `admin_manager`：扩展 `banners_create` / `banners_update` 入参校验与写入逻辑（图片地址合法性校验，标题长度校验）。
  - `data_manager`：`get_banners` 返回 banner 原始文档（包含新增字段）。
- 后台前端（`art-lnb-master`）：
  - API 类型更新：`bannersCreate` / `bannersUpdate` 增加可选字段。
  - 轮播图管理页：新增表单项 + 表格列（主/副标题），提交时透传到云函数。
- 小程序前端：
  - 首页轮播 WXML 增加文字遮罩层，WXSS 增加样式。
  - 看板页 `.container` 覆写 `align-items: stretch`。

## 3. 验收标准（最终）

- **布局**：看板页内容不再窄于首页（与首页同宽策略）。
- **后台**：轮播图支持上传/更换图片并保存成功；主/副标题可编辑并保存成功。
- **小程序**：首页轮播图展示主/副标题；后台更换后返回首页可看到更新。

