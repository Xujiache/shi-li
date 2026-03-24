# ACCEPTANCE_questionnaire_fill_child_lock

## 1. 交付物清单
- [x] 删除填写页中的“切换孩子”按钮
- [x] 删除填写页中不再使用的 `goSelectChild`
- [x] 调整填写对象卡文案为“上一页已确认的本次填写档案”
- [x] 无档案状态下仅保留完善档案入口
- [x] 完成最近编辑文件诊断检查

## 2. 验收结论
- `pages/questionnaire/fill/index` 中不再允许更换孩子
- 本次填写对象固定为上一页已确认的孩子档案
- 填写对象卡仅用于展示当前档案信息，不再承担切换功能
