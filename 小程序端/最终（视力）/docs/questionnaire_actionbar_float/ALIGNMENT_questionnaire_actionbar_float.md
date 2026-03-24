# ALIGNMENT_questionnaire_actionbar_float: 问卷页面底部操作栏悬浮化

## 1. 项目上下文分析
- 目标页面：
  - `miniprogram/pages/questionnaire/detail/index`
  - `miniprogram/pages/questionnaire/fill/index`
- 当前状态：
  - 两个页面底部按钮都位于页面内容流末尾
  - 用户需要滚动到底部才能点击关键操作

## 2. 原始需求
- `pages/questionnaire/detail/index` 的“查看历史”“开始填写”按钮需要始终悬浮在底部
- `pages/questionnaire/fill/index` 的“上一页”“下一页”“保存草稿”“提交问卷”按钮需要始终悬浮在底部

## 3. 需求理解
- 仅改造底部操作栏的布局和定位方式
- 保持现有按钮文案、功能、事件绑定不变
- 需要补足内容区域的底部留白，避免被悬浮栏遮挡

## 4. 决策与约束
- 保持当前蓝色主题与现有按钮风格
- 不改后端、不改业务逻辑、不改跳转链路
- 通过固定定位 `position: fixed` + 内容区底部安全留白实现
- 考虑手机底部安全区，避免按钮紧贴底边

## 5. 任务边界
- **包含**:
  - `detail/index.wxml`
  - `detail/index.wxss`
  - `fill/index.wxml`
  - `fill/index.wxss`
- **不包含**:
  - 题型逻辑改造
  - 接口或提交流程改造
