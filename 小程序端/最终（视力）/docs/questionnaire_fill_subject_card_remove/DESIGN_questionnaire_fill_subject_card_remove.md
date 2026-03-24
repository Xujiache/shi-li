# DESIGN_questionnaire_fill_subject_card_remove

## 1. 方案概述
- 直接删除填写页中对象卡片对应的 WXML 结构
- 清理该卡片专用样式
- 清理 JS 中仅用于这张卡片展示的字段

## 2. 影响范围
- `fill/index.wxml`
- `fill/index.wxss`
- `fill/index.js`

## 3. 风险控制
- 不改动题目渲染逻辑
- 不改动接口调用
- 不改动底部悬浮操作栏
