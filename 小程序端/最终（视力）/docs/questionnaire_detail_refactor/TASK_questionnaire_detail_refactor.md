# TASK_questionnaire_detail_refactor

## 任务拆分

### T1. 定位并修复重复 Page 注册报错
- 输入：`miniprogram/pages/questionnaire/detail/index.js`
- 输出：删除重复的默认模板 `Page(...)`

### T2. 重构详情页展示结构
- 输入：
  - `index.wxml`
  - `index.wxss`
- 输出：
  - 英雄区
  - 填写对象卡
  - 结构概览卡
  - 结构列表卡
  - 记录与操作卡

### T3. 收敛展示层逻辑
- 输入：接口返回的 `questionnaire / sections / availability / historyList`
- 输出：
  - 状态文案
  - 规则文案
  - 剩余次数文案
  - 分组结构展示字段
  - 底部按钮文案

### T4. 验收与文档同步
- 输入：代码改动结果
- 输出：
  - `ACCEPTANCE / FINAL / TODO`
  - 根级 `说明文档.md` 更新
