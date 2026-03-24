# TASK_questionnaire_tab_icon_fix

## 任务拆分

### T1. 定位 tabBar 图标切换链路
- 输入：`app.js`、`custom-tab-bar/index.js`、`custom-tab-bar/index.wxml`
- 输出：明确图标显示依赖 `iconPath / selectedIconPath`

### T2. 新增问卷 tab 图标资源
- 输入：现有项目图标风格
- 输出：
  - `images/icons/question-tab.svg`
  - `images/icons/question-tab-active.svg`

### T3. 更新问卷 tab 配置
- 输入：`app.js` 的 `__tabbarList`
- 输出：问卷 tab 改为引用新图标资源

### T4. 自检与文档同步
- 输入：代码改动结果
- 输出：验收文档、总结文档、根级说明文档进度更新
