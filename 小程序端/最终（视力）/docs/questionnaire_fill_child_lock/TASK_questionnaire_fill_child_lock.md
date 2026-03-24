# TASK_questionnaire_fill_child_lock

## 任务拆分

### T1. 移除填写页切换孩子入口
- 输入：`fill/index.wxml`
- 输出：删除页面中的“切换孩子”按钮

### T2. 调整填写对象卡语义
- 输入：`fill/index.wxml`
- 输出：将卡片文案改为“上一页已确认的本次填写档案”

### T3. 清理无用逻辑
- 输入：`fill/index.js`
- 输出：移除不再使用的 `goSelectChild`

### T4. 验收与文档同步
- 输入：代码改动结果
- 输出：`ACCEPTANCE / FINAL / TODO` 和根级 `说明文档.md`
