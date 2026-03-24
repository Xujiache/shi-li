# ALIGNMENT_questionnaire_index_title_dedup: 问卷首页双标题去重

## 1. 项目上下文
- 目标页面：`miniprogram/pages/questionnaire/index/index`
- 当前状态：顶部原生导航栏标题为“问卷”，页面 hero 大标题也为“问卷”，产生重复显示

## 2. 原始需求
- 修复 `pages/questionnaire/index/index` 顶部显示两个“问卷”的问题

## 3. 需求理解
- 保留页面内容区的 hero 标题设计
- 去掉原生导航栏中的重复标题
- 尽量以最小改动完成修复

## 4. 决策
- 修改 `index.json` 中的 `navigationBarTitleText`
- 不改动页面业务逻辑和样式布局
