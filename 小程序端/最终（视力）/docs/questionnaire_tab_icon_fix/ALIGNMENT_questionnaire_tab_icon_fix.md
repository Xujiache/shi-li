# ALIGNMENT_questionnaire_tab_icon_fix: 问卷 Tab 图标高亮修复

## 1. 项目上下文
- 目标端：微信小程序前端
- 目标模块：`miniprogram/custom-tab-bar` 与 `miniprogram/app.js`
- 问题现象：底部 tabBar 中“问卷”图标默认显示为黑色，选中后也不会切换为蓝色

## 2. 原始需求
- 修改底部 tab 栏的问卷图标
- 解决点击后仍然保持黑色、不切换蓝色的问题

## 3. 需求理解
- 本次只修复“问卷”tab 的图标资源与选中态映射
- 不改动页面业务逻辑
- 不改动其他 tab 的交互

## 4. 根因判断
- 自定义 tabBar 使用 `item.iconPath / item.selectedIconPath` 切换图标
- `app.js` 中“问卷”tab 的普通态与选中态都指向同一个 `question.svg`
- 该 SVG 内部颜色写死为黑色，因此无论是否选中都保持黑色

## 5. 决策
- 为“问卷”单独新增普通态和选中态 SVG 图标
- 在 `app.js` 中将“问卷”tab 的图标配置切换到新资源
