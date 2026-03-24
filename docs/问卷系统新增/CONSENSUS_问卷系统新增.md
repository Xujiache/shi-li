# CONSENSUS_问卷系统新增

## 一、最终目标

为项目新增一套完整问卷系统，满足以下目标：

- 小程序端新增独立 `问卷` Tab
- 后台可配置问卷、题目、分组、派发规则
- 可按学校、年级、年级范围、班级、用户、孩子派发
- 支持草稿保存与正式提交
- 后台可查看全部填写数据与详情，并支持导出

## 二、技术共识

- 结构化年级字段新增到 `children` 和 `school_classes`
- 问卷核心表包括：
  - `questionnaires`
  - `questionnaire_sections`
  - `questionnaire_questions`
  - `questionnaire_question_options`
  - `questionnaire_assignment_rules`
  - `questionnaire_submissions`
  - `questionnaire_answers`
- 题目高级配置采用 JSON 字段承载
- 历史答卷保留用户/孩子/问卷快照，避免后续修改影响历史记录

## 三、验收标准

- 后端建表、初始化、查询、提交、导出接口可用
- 小程序新增问卷 Tab，可查看问卷中心、详情、填写与历史
- 后台新增问卷配置与问卷填写数据页面，且能构建通过
- 问卷示例数据可成功提交并在后台查看
