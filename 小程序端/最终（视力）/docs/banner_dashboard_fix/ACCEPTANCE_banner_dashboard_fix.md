# ACCEPTANCE_banner_dashboard_fix

## 1. 交付物清单

- [x] 看板页 `.container` 覆写 `align-items: stretch`（与首页一致）
- [x] 后台轮播图支持 `title/sub_title`（云函数写入 + 后台表单/列表）
- [x] 小程序首页轮播图展示主/副标题（遮罩层 + 文案样式）
- [x] 首页返回时自动刷新轮播数据

## 2. 关键改动位置（可定位）

- 小程序：
  - `miniprogram/pages/dashboard/index/index.wxss`
  - `miniprogram/pages/home/index/index.wxml`
  - `miniprogram/pages/home/index/index.wxss`
  - `miniprogram/pages/home/index/index.js`
- 云函数：
  - `cloudfunctions/admin_manager/index.js`
- 后台（art-lnb-master）：
  - `src/api/vision-admin.ts`
  - `src/views/vision-admin/banners/index.vue`

## 3. 验收用例（建议按顺序执行）

### A. 看板页宽度

- 进入小程序“数据看板”页
- 观察顶部/卡片与首页内容宽度
- **预期**：看板页内容与首页同宽，无明显左右留白导致的“变窄”

### B. 后台轮播图更换 + 标题保存

- 后台进入“轮播图管理”
- 编辑任意一条 banner：
  - 更换图片（上传）
  - 填写主标题/副标题
  - 保存
- **预期**：保存成功；列表中可看到主/副标题列；重新打开编辑弹窗标题仍存在

### C. 小程序首页展示

- 小程序回到首页（无需重启小程序）
- **预期**：轮播图显示最新图片，并在图上叠加显示主标题/副标题（无值不显示）

## 4. 构建/静态检查

- [x] 管理端 `pnpm build` 通过（`vue-tsc --noEmit && vite build`）

