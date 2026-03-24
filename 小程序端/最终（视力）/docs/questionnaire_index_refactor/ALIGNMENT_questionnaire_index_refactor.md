# ALIGNMENT_questionnaire_index_refactor: 问卷首页重构与美化

## 1. 项目上下文分析

### 1.1 现有项目结构
- **端类型**: 微信小程序前端
- **目标页面**: `miniprogram/pages/questionnaire/index/index`
- **相关参考页**:
  - `miniprogram/pages/home/index/index`
  - `miniprogram/pages/dashboard/index/index`
  - `miniprogram/pages/user/index/index`

### 1.2 现有页面问题
- 当前问卷首页已具备基本信息与操作入口，但视觉层级偏弱。
- 顶部信息区与首页、看板页的英雄区风格不够统一。
- 问卷卡片内信息块较散，规则、统计、按钮关系不够清晰。
- WXML 中存在较长的内联表达式，可维护性一般。

## 2. 原始需求
- 重构并美化 `pages/questionnaire/index/index` 页面。
- 不改变现有主题色调。
- 页面风格需与其他页面 UI 保持接近。
- 不允许使用 emoji 表情包作为图标。

## 3. 需求理解（可执行）
- **范围**: 仅调整 `questionnaire/index` 的 WXML、WXSS、JS 展示层与轻量派生逻辑。
- **保持不变**:
  - 接口调用方式
  - 页面跳转链路
  - 业务数据结构
  - 问卷详情、历史、填写页
- **目标**:
  - 统一为蓝色渐变头图 + 白色内容卡片的视觉语言
  - 强化孩子信息、问卷统计、问卷卡片三层信息架构
  - 提升留白、对齐、按钮与标签的一致性

## 4. 关键约束与决策

### 4.1 视觉约束
- 保持项目既有蓝色主题，不新增偏离主视觉的新色系。
- 优先复用项目内已有图标资源，如 `question.svg`、`user.svg`。
- 不新增 emoji，不使用表情字符做视觉主体。

### 4.2 技术决策
- 通过页面局部样式覆写与结构微调完成重构。
- 在 `index.js` 中补充展示用派生字段，减少模板中的复杂三元表达式。
- 为本次新增或改写的方法补充函数级注释。

## 5. 任务边界
- **包含**:
  - `miniprogram/pages/questionnaire/index/index.wxml`
  - `miniprogram/pages/questionnaire/index/index.wxss`
  - `miniprogram/pages/questionnaire/index/index.js`
- **不包含**:
  - 接口协议变更
  - 后端数据结构变更
  - 其他问卷页面联动重构

## 6. 疑问澄清结论
- **是否需要变更主题色?**
  - 结论: 不变，仅在现有蓝色体系内调整明暗、透明度和层次。
- **是否需要新增插画或自定义图标?**
  - 结论: 不需要，复用现有 SVG 图标与几何图形装饰即可。
- **是否需要修改业务逻辑?**
  - 结论: 仅做展示数据整形，不改业务流程。
