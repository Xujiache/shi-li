# TASK_questionnaire_history_refactor

## 任务拆分

### T1. 修复重复 Page 注册问题
- 输入：`miniprogram/pages/questionnaire/history/index.js`
- 输出：删除重复模板 `Page(...)`

### T2. 重构填写记录列表态
- 输入：
  - `index.js`
  - `index.wxml`
  - `index.wxss`
- 输出：
  - 顶部概览 hero
  - 历史记录卡片列表
  - 优化空状态

### T3. 重构答卷详情态
- 输入：
  - `index.js`
  - `index.wxml`
  - `index.wxss`
- 输出：
  - 顶部摘要 hero
  - 答卷摘要卡
  - 答案列表卡

### T4. 验收与文档同步
- 输入：代码改动结果
- 输出：
  - `ACCEPTANCE / FINAL / TODO`
  - 根级 `说明文档.md`
