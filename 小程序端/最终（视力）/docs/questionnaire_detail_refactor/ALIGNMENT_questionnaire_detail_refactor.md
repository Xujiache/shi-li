# ALIGNMENT_questionnaire_detail_refactor: 问卷详情预览页重构与报错修复

## 1. 项目上下文分析

### 1.1 目标页面
- 页面路径：`miniprogram/pages/questionnaire/detail/index`
- 页面职责：展示问卷标题、规则说明、填写对象、问卷结构与填写入口

### 1.2 现有问题
- 页面视觉层级偏弱，与问卷首页、首页、数据看板页风格不够统一。
- WXML 中存在较长的内联规则表达式，可维护性一般。
- `index.js` 文件末尾残留微信开发者工具默认模板，造成同一文件内重复注册 `Page(...)`。

## 2. 原始需求
- 美化“填写预览页” `pages/questionnaire/detail/index`
- 修复报错：
  - `Please do not register multiple Pages in pages/questionnaire/detail/index.js`

## 3. 需求理解（可执行）
- **范围**:
  - `miniprogram/pages/questionnaire/detail/index.js`
  - `miniprogram/pages/questionnaire/detail/index.wxml`
  - `miniprogram/pages/questionnaire/detail/index.wxss`
- **保持不变**:
  - 接口调用方式
  - 问卷详情后端协议
  - 跳转路由
- **目标**:
  - 页面视觉与问卷首页保持同一设计语言
  - 提升预览信息的层级与可读性
  - 消除重复 `Page(...)` 注册报错

## 4. 决策与约束
- 保持项目现有蓝色主题，不引入新主题色
- 不使用 emoji 作为图标
- 优先复用已有图标资源与当前问卷数据结构
- 在 `index.js` 内增加展示层派生字段，降低模板复杂度

## 5. 边界
- **包含**: 详情预览页结构、样式、展示数据收敛、报错修复
- **不包含**: 填写页、历史页、后端服务改动
