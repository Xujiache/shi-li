# ALIGNMENT_questionnaire_cover_contrast_fix: 问卷封面展示与顶部对比度优化

## 1. 项目上下文分析

### 1.1 目标页面
- `miniprogram/pages/questionnaire/index/index`
- `miniprogram/pages/questionnaire/detail/index`
- `miniprogram/pages/questionnaire/fill/index`

### 1.2 当前问题
- 问卷后台已支持上传 `cover_image_url`，但小程序问卷首页列表未展示封面图。
- 问卷详情页和填写页顶部蓝色区域存在可读性问题：
  - 文案对比度不足
  - 标签过于半透明
  - 右上角使用蓝色图标压在蓝底上，不够清晰

## 2. 原始需求
- 在 `pages/questionnaire/index/index` 找一个很好的区域展示管理后台上传的问卷封面
- 优化 `pages/questionnaire/detail/index` 和 `pages/questionnaire/fill/index` 顶部红框区域，让字和图标显示更清楚

## 3. 需求理解
- 问卷首页：为问卷卡片新增封面展示区，优先展示 `cover_image_url`
- 详情页/填写页：不更换主色调，只通过更高对比度的样式和图标资源提升可读性

## 4. 关键约束与决策
- 继续保持项目现有蓝色主题
- 不使用 emoji 图标
- 封面展示只影响问卷首页卡片，不改问卷详情和填写逻辑
- 顶部可读性问题优先通过：
  - 更稳的深蓝渐变
  - 更高透明度的标签底
  - 白色版问卷图标
  - 更清晰的文字颜色与阴影

## 5. 任务边界
- **包含**:
  - `pages/questionnaire/index/index.wxml`
  - `pages/questionnaire/index/index.wxss`
  - `pages/questionnaire/index/index.js`
  - `pages/questionnaire/detail/index.wxml`
  - `pages/questionnaire/detail/index.wxss`
  - `pages/questionnaire/fill/index.wxml`
  - `pages/questionnaire/fill/index.wxss`
  - 新增顶部用白色问卷图标资源
- **不包含**:
  - 后台问卷配置页改造
  - 后端问卷字段结构改造
