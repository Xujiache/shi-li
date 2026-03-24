# TASK_questionnaire_fill_refactor

## 任务拆分

### T1. 修复重复 Page 注册问题
- 输入：`miniprogram/pages/questionnaire/fill/index.js`
- 输出：删除重复模板 `Page(...)`

### T2. 重构填写页布局
- 输入：
  - `index.wxml`
  - `index.wxss`
- 输出：
  - 顶部英雄区
  - 填写对象摘要卡
  - 分组卡与题目卡
  - 底部操作卡

### T3. 收敛展示层逻辑
- 输入：当前页、题目、答案、用户/孩子档案信息
- 输出：
  - 当前页进度字段
  - 当前页统计字段
  - 填写对象展示字段

### T4. 验收与文档同步
- 输入：代码改动结果
- 输出：
  - `ACCEPTANCE / FINAL / TODO`
  - 根级 `说明文档.md` 更新
