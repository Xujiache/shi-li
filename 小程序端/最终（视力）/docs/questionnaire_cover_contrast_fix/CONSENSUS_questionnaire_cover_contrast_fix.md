# CONSENSUS_questionnaire_cover_contrast_fix

## 1. 最终共识
- 问卷首页中的每张问卷卡片需要优先展示后台上传的封面图
- 封面图放在卡片顶部作为视觉主区，是问卷卡内最合适的展示位置
- 问卷详情页和填写页顶部区域继续保留蓝色主题，但提高对比度和图标可见性

## 2. 验收标准
- `pages/questionnaire/index/index`
  - 后台已上传封面的问卷，在小程序首页卡片顶部可看到封面
  - 无封面的问卷保持现有无图卡片布局，不出现异常空白
- `pages/questionnaire/detail/index`
  - 顶部标题、说明、标签、图标都更清楚
- `pages/questionnaire/fill/index`
  - 顶部标题、说明、标签、图标都更清楚
- 不改变原有业务交互
- 不新增报错

## 3. 技术共识
- 使用问卷对象已有字段 `cover_image_url`
- 新增白色版问卷 hero 图标资源
- 顶部对比度优化主要通过样式完成，尽量少动逻辑
