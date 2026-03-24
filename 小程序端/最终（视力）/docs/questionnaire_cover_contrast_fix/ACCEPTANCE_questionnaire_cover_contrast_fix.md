# ACCEPTANCE_questionnaire_cover_contrast_fix

## 1. 交付物清单
- [x] 问卷首页卡片支持展示后台上传的封面图
- [x] 无封面时保持原有问卷卡片布局
- [x] 新增白色版问卷 hero 图标
- [x] 优化问卷详情页顶部蓝色区域的对比度
- [x] 优化问卷填写页顶部蓝色区域的对比度
- [x] 完成最近编辑文件诊断检查

## 2. 验收结论

### A. 问卷首页
- `pages/questionnaire/index/index` 已支持在问卷卡片顶部展示 `cover_image_url`
- 封面图以卡片视觉主区形式显示，更符合“问卷封面”的使用预期
- 无封面图时仍保持原有图标卡头，不会出现异常空白

### B. 问卷详情页 / 填写页
- `pages/questionnaire/detail/index` 顶部文字、标签、图标对比度已提升
- `pages/questionnaire/fill/index` 顶部文字、标签、图标对比度已提升
- 顶部右侧图标已改为白色版，更适合蓝底 hero 区

## 3. 建议验证步骤
1. 在后台上传一张问卷封面并发布问卷。
2. 打开 `pages/questionnaire/index/index`，确认首页问卷卡片顶部能看到封面图。
3. 打开 `pages/questionnaire/detail/index` 和 `pages/questionnaire/fill/index`，确认顶部蓝色区域的字和图标显示更清楚。
