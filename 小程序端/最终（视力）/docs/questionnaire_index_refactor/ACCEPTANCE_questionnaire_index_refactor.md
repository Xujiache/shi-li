# ACCEPTANCE_questionnaire_index_refactor

## 1. 交付物清单
- [x] 新建问卷首页重构任务文档集（`ALIGNMENT / CONSENSUS / DESIGN / TASK`）
- [x] 重构 `miniprogram/pages/questionnaire/index/index.wxml`
- [x] 重构 `miniprogram/pages/questionnaire/index/index.wxss`
- [x] 收敛 `miniprogram/pages/questionnaire/index/index.js` 展示层逻辑
- [x] 为改写方法补充函数级注释
- [x] 完成最近编辑文件静态检查

## 2. 关键改动位置
- `miniprogram/pages/questionnaire/index/index.wxml`
- `miniprogram/pages/questionnaire/index/index.wxss`
- `miniprogram/pages/questionnaire/index/index.js`

## 3. 验收结论

### A. 视觉一致性
- 问卷首页已切换为与首页、看板页一致的蓝色渐变头图 + 白卡内容区结构。
- 保持蓝色主主题，不引入偏离既有视觉的新主题色。
- 页面中未使用 emoji 作为图标或装饰。

### B. 信息层级
- 当前孩子信息区升级为更清晰的信息卡，支持已绑定/未绑定两种状态。
- 新增问卷概览统计区，可直接看到可填问卷、草稿记录、已提交数量。
- 问卷卡片改为“标题 + 状态 + 规则 + 统计 + 操作按钮”的稳定结构。

### C. 代码可维护性
- 模板中的复杂提交规则表达式已迁移到 `index.js` 中统一处理。
- 页面保留原有跳转链路和接口调用方式，不改变业务逻辑。

## 4. 静态检查
- [x] `index.js` / `index.wxml` / `index.wxss` 已通过本地诊断检查，未发现新增报错

## 5. 建议验证步骤
1. 进入小程序“问卷”页，确认顶部头图与首页/看板页视觉一致。
2. 在有孩子档案场景下，确认孩子信息卡、问卷统计卡、问卷列表卡片展示正常。
3. 在无孩子档案场景下，确认空状态与“去完善档案”按钮展示正常。
4. 点击“填写记录”“查看问卷/继续填写”，确认路由跳转保持正常。
