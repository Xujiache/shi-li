const { StatusCodes } = require('http-status-codes')
const { query, queryOne, execute, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const {
  normalizePagination,
  safeJsonParse,
  safeJsonStringify,
  toBoolean,
  gradeLevelToName,
  isGradeMatched
} = require('../utils/helpers')

const RULE_SCOPE_PRIORITY = {
  child: 70,
  user: 60,
  class: 50,
  grade: 40,
  grade_range: 35,
  school: 30,
  all: 10
}

/**
 * 规范化问卷对象。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeQuestionnaire(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    cover_image_url: row.cover_image_url || '',
    status: row.status || 'draft',
    allow_save_draft: row.allow_save_draft !== 0,
    allow_view_result: row.allow_view_result !== 0,
    submit_rule_type: row.submit_rule_type || 'once',
    max_submit_count: row.max_submit_count == null ? null : Number(row.max_submit_count),
    cycle_type: row.cycle_type || 'none',
    cycle_value: row.cycle_value == null ? null : Number(row.cycle_value),
    publish_start_at: row.publish_start_at || null,
    publish_end_at: row.publish_end_at || null,
    welcome_text: row.welcome_text || '',
    submit_success_text: row.submit_success_text || '',
    schema_version: Number(row.schema_version || 1),
    active: row.active !== 0,
    section_count: row.section_count == null ? 0 : Number(row.section_count),
    question_count: row.question_count == null ? 0 : Number(row.question_count),
    submission_count: row.submission_count == null ? 0 : Number(row.submission_count),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化问卷分组。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeQuestionnaireSection(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    questionnaire_id: String(row.questionnaire_id),
    title: row.title || '',
    description: row.description || '',
    page_no: Number(row.page_no || 1),
    sort_order: Number(row.sort_order || 1),
    questions: [],
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化问卷题目。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeQuestionnaireQuestion(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    questionnaire_id: String(row.questionnaire_id),
    section_id: row.section_id == null ? '' : String(row.section_id),
    type: row.type || 'single_choice',
    code: row.code || '',
    title: row.title || '',
    description: row.description || '',
    required: row.required !== 0,
    sort_order: Number(row.sort_order || 1),
    placeholder: row.placeholder || '',
    default_value: safeJsonParse(row.default_value_json, null),
    settings: safeJsonParse(row.settings_json, {}),
    validation: safeJsonParse(row.validation_json, {}),
    visibility_rule: safeJsonParse(row.visibility_rule_json, {}),
    options: [],
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化题目选项。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeQuestionnaireOption(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    questionnaire_id: String(row.questionnaire_id),
    question_id: String(row.question_id),
    label: row.label || '',
    value: row.value || '',
    score: row.score == null ? null : Number(row.score),
    sort_order: Number(row.sort_order || 1),
    extra: safeJsonParse(row.extra_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化派发规则。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeAssignmentRule(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    questionnaire_id: String(row.questionnaire_id),
    rule_name: row.rule_name || '',
    scope_type: row.scope_type || 'all',
    school: row.school || '',
    grade_name: row.grade_name || '',
    grade_min: row.grade_min == null ? null : Number(row.grade_min),
    grade_max: row.grade_max == null ? null : Number(row.grade_max),
    class_name: row.class_name || '',
    user_id: row.user_id == null ? '' : String(row.user_id),
    child_id: row.child_id == null ? '' : String(row.child_id),
    submit_rule_type: row.submit_rule_type || 'inherit',
    max_submit_count: row.max_submit_count == null ? null : Number(row.max_submit_count),
    cycle_type: row.cycle_type || 'none',
    cycle_value: row.cycle_value == null ? null : Number(row.cycle_value),
    start_at: row.start_at || null,
    end_at: row.end_at || null,
    active: row.active !== 0,
    extra: safeJsonParse(row.extra_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 构造默认问卷分组。
 * @returns {Array<Record<string, any>>} 默认分组。
 */
function buildDefaultSections() {
  return [
    {
      title: '默认分组',
      description: '',
      page_no: 1,
      sort_order: 1,
      questions: []
    }
  ]
}

/**
 * 获取问卷基础记录。
 * @param {number|string} questionnaireId 问卷 ID。
 * @returns {Promise<Record<string, any>>} 问卷对象。
 */
async function getQuestionnaireRow(questionnaireId) {
  const row = await queryOne('SELECT * FROM questionnaires WHERE id = ? LIMIT 1', [questionnaireId])
  if (!row) throw createAppError('问卷不存在', StatusCodes.NOT_FOUND)
  return row
}

/**
 * 读取问卷的完整结构。
 * @param {number|string} questionnaireId 问卷 ID。
 * @returns {Promise<{questionnaire: Record<string, any>, sections: Array<Record<string, any>>, assignment_rules: Array<Record<string, any>>}>} 完整结构。
 */
async function getQuestionnaireDetail(questionnaireId) {
  const questionnaire = normalizeQuestionnaire(await getQuestionnaireRow(questionnaireId))
  const sectionRows = await query(
    `
      SELECT *
      FROM questionnaire_sections
      WHERE questionnaire_id = ?
      ORDER BY page_no ASC, sort_order ASC, id ASC
    `,
    [questionnaireId]
  )
  const questionRows = await query(
    `
      SELECT *
      FROM questionnaire_questions
      WHERE questionnaire_id = ?
      ORDER BY section_id ASC, sort_order ASC, id ASC
    `,
    [questionnaireId]
  )
  const optionRows = await query(
    `
      SELECT *
      FROM questionnaire_question_options
      WHERE questionnaire_id = ?
      ORDER BY question_id ASC, sort_order ASC, id ASC
    `,
    [questionnaireId]
  )
  const ruleRows = await query(
    `
      SELECT *
      FROM questionnaire_assignment_rules
      WHERE questionnaire_id = ?
      ORDER BY active DESC, id ASC
    `,
    [questionnaireId]
  )

  const sectionMap = new Map()
  const sections = (sectionRows || []).map((row) => {
    const normalized = normalizeQuestionnaireSection(row)
    sectionMap.set(Number(row.id), normalized)
    return normalized
  })

  const optionMap = new Map()
  for (const row of optionRows || []) {
    const normalizedOption = normalizeQuestionnaireOption(row)
    const questionId = Number(row.question_id)
    if (!optionMap.has(questionId)) optionMap.set(questionId, [])
    optionMap.get(questionId).push(normalizedOption)
  }

  for (const row of questionRows || []) {
    const normalizedQuestion = normalizeQuestionnaireQuestion(row)
    normalizedQuestion.options = optionMap.get(Number(row.id)) || []
    const sectionId = row.section_id == null ? null : Number(row.section_id)
    if (sectionId && sectionMap.has(sectionId)) {
      sectionMap.get(sectionId).questions.push(normalizedQuestion)
      continue
    }
    if (sections.length === 0) {
      const fallback = buildDefaultSections()[0]
      sectionMap.set(-1, fallback)
      sections.push(fallback)
    }
    sections[0].questions.push(normalizedQuestion)
  }

  return {
    questionnaire,
    sections: sections.length > 0 ? sections : buildDefaultSections(),
    assignment_rules: (ruleRows || []).map(normalizeAssignmentRule)
  }
}

/**
 * 获取后台问卷列表。
 * @param {{q?: string, status?: string, active?: unknown, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 列表结果。
 */
async function listQuestionnaires(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('(q.title LIKE ? OR q.description LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`)
  }
  if (params.status) {
    conditions.push('q.status = ?')
    values.push(params.status)
  }
  if (params.active !== undefined && params.active !== '') {
    conditions.push('q.active = ?')
    values.push(toBoolean(params.active, true) ? 1 : 0)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM questionnaires q ${whereClause}`, values)
  const rows = await query(
    `
      SELECT
        q.*,
        (
          SELECT COUNT(*)
          FROM questionnaire_sections s
          WHERE s.questionnaire_id = q.id
        ) AS section_count,
        (
          SELECT COUNT(*)
          FROM questionnaire_questions qq
          WHERE qq.questionnaire_id = q.id
        ) AS question_count,
        (
          SELECT COUNT(*)
          FROM questionnaire_submissions qs
          WHERE qs.questionnaire_id = q.id
            AND qs.status = 'submitted'
        ) AS submission_count
      FROM questionnaires q
      ${whereClause}
      ORDER BY q.updated_at DESC, q.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: (rows || []).map(normalizeQuestionnaire),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 规范化问卷分组提交数据。
 * @param {Array<Record<string, any>>|undefined} sections 原始分组数组。
 * @returns {Array<Record<string, any>>} 规范化分组数组。
 */
function normalizeIncomingSections(sections) {
  const list = Array.isArray(sections) && sections.length > 0 ? sections : buildDefaultSections()
  return list.map((section, sectionIndex) => ({
    title: String(section.title || `分组${sectionIndex + 1}`).trim(),
    description: String(section.description || '').trim(),
    page_no: Number(section.page_no || section.pageNo || sectionIndex + 1),
    sort_order: Number(section.sort_order || section.sortOrder || sectionIndex + 1),
    questions: Array.isArray(section.questions) ? section.questions : []
  }))
}

/**
 * 规范化单个题目。
 * @param {Record<string, any>} question 原始题目数据。
 * @param {number} sortOrder 排序号。
 * @returns {Record<string, any>} 规范化题目。
 */
function normalizeIncomingQuestion(question, sortOrder) {
  const normalized = {
    type: String(question.type || 'single_choice').trim(),
    code: String(question.code || '').trim(),
    title: String(question.title || '').trim(),
    description: String(question.description || '').trim(),
    required: toBoolean(question.required, false),
    sort_order: Number(question.sort_order || question.sortOrder || sortOrder),
    placeholder: String(question.placeholder || '').trim(),
    default_value: question.default_value !== undefined ? question.default_value : null,
    settings: question.settings && typeof question.settings === 'object' ? question.settings : safeJsonParse(question.settings, {}),
    validation:
      question.validation && typeof question.validation === 'object' ? question.validation : safeJsonParse(question.validation, {}),
    visibility_rule:
      question.visibility_rule && typeof question.visibility_rule === 'object'
        ? question.visibility_rule
        : safeJsonParse(question.visibility_rule, {}),
    options: Array.isArray(question.options) ? question.options : []
  }

  if (!normalized.title) {
    throw createAppError('问卷题目标题不能为空', StatusCodes.BAD_REQUEST)
  }

  return normalized
}

/**
 * 规范化派发规则。
 * @param {Array<Record<string, any>>|undefined} rules 原始规则数组。
 * @returns {Array<Record<string, any>>} 规范化规则。
 */
function normalizeIncomingAssignmentRules(rules) {
  return (Array.isArray(rules) ? rules : []).map((rule, index) => {
    const gradeMin = rule.grade_min == null || rule.grade_min === '' ? null : Number(rule.grade_min)
    const gradeMax = rule.grade_max == null || rule.grade_max === '' ? null : Number(rule.grade_max)
    const ruleGradeName =
      String(rule.grade_name || '').trim() ||
      (gradeMin && gradeMax
        ? `${gradeLevelToName(gradeMin)}-${gradeLevelToName(gradeMax)}`
        : gradeMin
          ? gradeLevelToName(gradeMin)
          : '')

    return {
      rule_name: String(rule.rule_name || `规则${index + 1}`).trim(),
      scope_type: String(rule.scope_type || 'all').trim(),
      school: String(rule.school || '').trim(),
      grade_name: ruleGradeName,
      grade_min: gradeMin,
      grade_max: gradeMax,
      class_name: String(rule.class_name || '').trim(),
      user_id: rule.user_id == null || rule.user_id === '' ? null : Number(rule.user_id),
      child_id: rule.child_id == null || rule.child_id === '' ? null : Number(rule.child_id),
      submit_rule_type: String(rule.submit_rule_type || 'inherit').trim(),
      max_submit_count:
        rule.max_submit_count == null || rule.max_submit_count === '' ? null : Number(rule.max_submit_count),
      cycle_type: String(rule.cycle_type || 'none').trim(),
      cycle_value: rule.cycle_value == null || rule.cycle_value === '' ? null : Number(rule.cycle_value),
      start_at: rule.start_at || null,
      end_at: rule.end_at || null,
      active: toBoolean(rule.active, true),
      extra: rule.extra && typeof rule.extra === 'object' ? rule.extra : safeJsonParse(rule.extra, {})
    }
  })
}

/**
 * 保存问卷分组、题目、选项和派发规则。
 * @param {import('mysql2/promise').PoolConnection} connection 事务连接。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {Array<Record<string, any>>|undefined} sections 分组数组。
 * @param {Array<Record<string, any>>|undefined} assignmentRules 派发规则数组。
 * @returns {Promise<void>}
 */
async function saveQuestionnaireRelations(connection, questionnaireId, sections, assignmentRules) {
  const normalizedSections = normalizeIncomingSections(sections)
  const normalizedRules = normalizeIncomingAssignmentRules(assignmentRules)

  await connection.execute('DELETE FROM questionnaire_assignment_rules WHERE questionnaire_id = ?', [questionnaireId])
  await connection.execute('DELETE FROM questionnaire_question_options WHERE questionnaire_id = ?', [questionnaireId])
  await connection.execute('DELETE FROM questionnaire_questions WHERE questionnaire_id = ?', [questionnaireId])
  await connection.execute('DELETE FROM questionnaire_sections WHERE questionnaire_id = ?', [questionnaireId])

  for (const rule of normalizedRules) {
    await connection.execute(
      `
        INSERT INTO questionnaire_assignment_rules (
          questionnaire_id, rule_name, scope_type, school, grade_name, grade_min, grade_max,
          class_name, user_id, child_id, submit_rule_type, max_submit_count, cycle_type,
          cycle_value, start_at, end_at, active, extra_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        questionnaireId,
        rule.rule_name,
        rule.scope_type,
        rule.school,
        rule.grade_name,
        rule.grade_min,
        rule.grade_max,
        rule.class_name,
        rule.user_id,
        rule.child_id,
        rule.submit_rule_type,
        rule.max_submit_count,
        rule.cycle_type,
        rule.cycle_value,
        rule.start_at,
        rule.end_at,
        rule.active ? 1 : 0,
        safeJsonStringify(rule.extra)
      ]
    )
  }

  for (let sectionIndex = 0; sectionIndex < normalizedSections.length; sectionIndex += 1) {
    const section = normalizedSections[sectionIndex]
    const [sectionResult] = await connection.execute(
      `
        INSERT INTO questionnaire_sections (
          questionnaire_id, title, description, page_no, sort_order
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [questionnaireId, section.title, section.description, section.page_no, section.sort_order]
    )
    const sectionId = sectionResult.insertId

    const questions = Array.isArray(section.questions) ? section.questions : []
    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
      const question = normalizeIncomingQuestion(questions[questionIndex], questionIndex + 1)
      const [questionResult] = await connection.execute(
        `
          INSERT INTO questionnaire_questions (
            questionnaire_id, section_id, type, code, title, description, required, sort_order,
            placeholder, default_value_json, settings_json, validation_json, visibility_rule_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          questionnaireId,
          sectionId,
          question.type,
          question.code,
          question.title,
          question.description,
          question.required ? 1 : 0,
          question.sort_order,
          question.placeholder,
          safeJsonStringify(question.default_value),
          safeJsonStringify(question.settings),
          safeJsonStringify(question.validation),
          safeJsonStringify(question.visibility_rule)
        ]
      )

      const questionId = questionResult.insertId
      const options = Array.isArray(question.options) ? question.options : []
      for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const option = options[optionIndex] || {}
        await connection.execute(
          `
            INSERT INTO questionnaire_question_options (
              questionnaire_id, question_id, label, value, score, sort_order, extra_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            questionnaireId,
            questionId,
            String(option.label || '').trim(),
            String(option.value !== undefined ? option.value : option.label || '').trim(),
            option.score == null || option.score === '' ? null : Number(option.score),
            Number(option.sort_order || option.sortOrder || optionIndex + 1),
            safeJsonStringify(option.extra || {})
          ]
        )
      }
    }
  }
}

/**
 * 创建后台问卷。
 * @param {Record<string, any>} payload 问卷数据。
 * @returns {Promise<Record<string, any>>} 创建后的问卷详情。
 */
async function createQuestionnaire(payload) {
  const title = String(payload.title || '').trim()
  if (!title) throw createAppError('问卷标题不能为空', StatusCodes.BAD_REQUEST)

  const questionnaireId = await withTransaction(async (connection) => {
    const [result] = await connection.execute(
      `
        INSERT INTO questionnaires (
          title, description, cover_image_url, status, allow_save_draft, allow_view_result,
          submit_rule_type, max_submit_count, cycle_type, cycle_value, publish_start_at,
          publish_end_at, welcome_text, submit_success_text, schema_version, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        title,
        String(payload.description || '').trim(),
        String(payload.cover_image_url || '').trim(),
        String(payload.status || 'draft').trim(),
        toBoolean(payload.allow_save_draft, true) ? 1 : 0,
        toBoolean(payload.allow_view_result, false) ? 1 : 0,
        String(payload.submit_rule_type || 'once').trim(),
        payload.max_submit_count == null || payload.max_submit_count === '' ? null : Number(payload.max_submit_count),
        String(payload.cycle_type || 'none').trim(),
        payload.cycle_value == null || payload.cycle_value === '' ? null : Number(payload.cycle_value),
        payload.publish_start_at || null,
        payload.publish_end_at || null,
        String(payload.welcome_text || '').trim(),
        String(payload.submit_success_text || '').trim(),
        Number(payload.schema_version || 1),
        toBoolean(payload.active, true) ? 1 : 0
      ]
    )

    await saveQuestionnaireRelations(connection, result.insertId, payload.sections, payload.assignment_rules)
    return result.insertId
  })

  return getQuestionnaireDetail(questionnaireId)
}

/**
 * 更新后台问卷。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {Record<string, any>} payload 更新数据。
 * @returns {Promise<Record<string, any>>} 更新后的问卷详情。
 */
async function updateQuestionnaire(questionnaireId, payload) {
  await getQuestionnaireRow(questionnaireId)

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE questionnaires
        SET title = ?, description = ?, cover_image_url = ?, status = ?, allow_save_draft = ?,
            allow_view_result = ?, submit_rule_type = ?, max_submit_count = ?, cycle_type = ?,
            cycle_value = ?, publish_start_at = ?, publish_end_at = ?, welcome_text = ?,
            submit_success_text = ?, schema_version = ?, active = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [
        String(payload.title || '').trim(),
        String(payload.description || '').trim(),
        String(payload.cover_image_url || '').trim(),
        String(payload.status || 'draft').trim(),
        toBoolean(payload.allow_save_draft, true) ? 1 : 0,
        toBoolean(payload.allow_view_result, false) ? 1 : 0,
        String(payload.submit_rule_type || 'once').trim(),
        payload.max_submit_count == null || payload.max_submit_count === '' ? null : Number(payload.max_submit_count),
        String(payload.cycle_type || 'none').trim(),
        payload.cycle_value == null || payload.cycle_value === '' ? null : Number(payload.cycle_value),
        payload.publish_start_at || null,
        payload.publish_end_at || null,
        String(payload.welcome_text || '').trim(),
        String(payload.submit_success_text || '').trim(),
        Number(payload.schema_version || 1),
        toBoolean(payload.active, true) ? 1 : 0,
        questionnaireId
      ]
    )

    await saveQuestionnaireRelations(connection, questionnaireId, payload.sections, payload.assignment_rules)
  })

  return getQuestionnaireDetail(questionnaireId)
}

/**
 * 删除后台问卷。
 * @param {number|string} questionnaireId 问卷 ID。
 * @returns {Promise<void>}
 */
async function deleteQuestionnaire(questionnaireId) {
  const submissionCount = await queryOne(
    'SELECT COUNT(*) AS total FROM questionnaire_submissions WHERE questionnaire_id = ?',
    [questionnaireId]
  )
  if (submissionCount && Number(submissionCount.total) > 0) {
    throw createAppError('该问卷已有填写数据，请先停用或归档，不能直接删除', StatusCodes.CONFLICT)
  }
  await execute('DELETE FROM questionnaires WHERE id = ?', [questionnaireId])
}

/**
 * 复制后台问卷。
 * @param {number|string} questionnaireId 原问卷 ID。
 * @returns {Promise<Record<string, any>>} 复制后的问卷详情。
 */
async function copyQuestionnaire(questionnaireId) {
  const detail = await getQuestionnaireDetail(questionnaireId)
  const payload = {
    ...detail.questionnaire,
    title: `${detail.questionnaire.title} - 副本`,
    status: 'draft',
    active: true,
    sections: detail.sections.map((section) => ({
      title: section.title,
      description: section.description,
      page_no: section.page_no,
      sort_order: section.sort_order,
      questions: section.questions.map((question) => ({
        type: question.type,
        code: question.code,
        title: question.title,
        description: question.description,
        required: question.required,
        sort_order: question.sort_order,
        placeholder: question.placeholder,
        default_value: question.default_value,
        settings: question.settings,
        validation: question.validation,
        visibility_rule: question.visibility_rule,
        options: question.options.map((option) => ({
          label: option.label,
          value: option.value,
          score: option.score,
          sort_order: option.sort_order,
          extra: option.extra
        }))
      }))
    })),
    assignment_rules: detail.assignment_rules.map((rule) => ({
      rule_name: rule.rule_name,
      scope_type: rule.scope_type,
      school: rule.school,
      grade_name: rule.grade_name,
      grade_min: rule.grade_min,
      grade_max: rule.grade_max,
      class_name: rule.class_name,
      user_id: rule.user_id,
      child_id: rule.child_id,
      submit_rule_type: rule.submit_rule_type,
      max_submit_count: rule.max_submit_count,
      cycle_type: rule.cycle_type,
      cycle_value: rule.cycle_value,
      start_at: rule.start_at,
      end_at: rule.end_at,
      active: rule.active,
      extra: rule.extra
    }))
  }
  return createQuestionnaire(payload)
}

/**
 * 更新问卷发布状态。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {{status?: string, active?: boolean}} patch 状态更新参数。
 * @returns {Promise<Record<string, any>>} 更新后的问卷详情。
 */
async function updateQuestionnaireStatus(questionnaireId, patch) {
  await execute(
    'UPDATE questionnaires SET status = ?, active = ?, updated_at = NOW() WHERE id = ?',
    [String(patch.status || 'draft').trim(), patch.active === undefined ? 1 : patch.active ? 1 : 0, questionnaireId]
  )
  return getQuestionnaireDetail(questionnaireId)
}

/**
 * 判断问卷是否在发布期内。
 * @param {Record<string, any>} questionnaire 问卷对象。
 * @param {Date} now 当前时间。
 * @returns {boolean} 是否可发布。
 */
function isQuestionnairePublished(questionnaire, now = new Date()) {
  if (!questionnaire || questionnaire.status !== 'published' || !questionnaire.active) return false
  if (questionnaire.publish_start_at && new Date(questionnaire.publish_start_at).getTime() > now.getTime()) return false
  if (questionnaire.publish_end_at && new Date(questionnaire.publish_end_at).getTime() < now.getTime()) return false
  return true
}

/**
 * 判断派发规则是否在有效期内。
 * @param {Record<string, any>} rule 派发规则。
 * @param {Date} now 当前时间。
 * @returns {boolean} 是否有效。
 */
function isAssignmentRuleActive(rule, now = new Date()) {
  if (!rule || !rule.active) return false
  if (rule.start_at && new Date(rule.start_at).getTime() > now.getTime()) return false
  if (rule.end_at && new Date(rule.end_at).getTime() < now.getTime()) return false
  return true
}

/**
 * 判断派发规则是否命中当前用户/孩子。
 * @param {Record<string, any>} rule 派发规则。
 * @param {Record<string, any>} child 当前孩子。
 * @param {Record<string, any>} user 当前用户。
 * @returns {boolean} 是否命中。
 */
function isAssignmentRuleMatched(rule, child, user) {
  const scopeType = rule.scope_type || 'all'
  const childId = String(child && child._id ? child._id : child && child.id ? child.id : '')
  const userId = String(user && user._id ? user._id : user && user.id ? user.id : '')

  switch (scopeType) {
    case 'child':
      return !!rule.child_id && String(rule.child_id) === childId
    case 'user':
      return !!rule.user_id && String(rule.user_id) === userId
    case 'class':
      return (
        (!rule.school || String(rule.school) === String(child.school || '')) &&
        (!rule.class_name || String(rule.class_name) === String(child.class_name || ''))
      )
    case 'grade':
      return (!rule.school || String(rule.school) === String(child.school || '')) && String(rule.grade_name || '') === String(child.grade_name || '')
    case 'grade_range':
      return (!rule.school || String(rule.school) === String(child.school || '')) && isGradeMatched(child.grade_name, rule.grade_min, rule.grade_max)
    case 'school':
      return String(rule.school || '') === String(child.school || '')
    case 'all':
    default:
      return true
  }
}

/**
 * 从多条命中的派发规则中选出优先级最高的一条。
 * @param {Array<Record<string, any>>} rules 派发规则数组。
 * @param {Record<string, any>} child 当前孩子。
 * @param {Record<string, any>} user 当前用户。
 * @returns {Record<string, any>|null} 命中的优先规则。
 */
function pickMatchedAssignmentRule(rules, child, user) {
  const matched = (rules || []).filter((rule) => isAssignmentRuleActive(rule) && isAssignmentRuleMatched(rule, child, user))
  if (matched.length === 0) return null
  matched.sort((a, b) => {
    const p1 = RULE_SCOPE_PRIORITY[b.scope_type] || 0
    const p2 = RULE_SCOPE_PRIORITY[a.scope_type] || 0
    if (p1 !== p2) return p1 - p2
    return Number(b.id) - Number(a.id)
  })
  return matched[0]
}

/**
 * 组装生效提交规则。
 * @param {Record<string, any>} questionnaire 问卷。
 * @param {Record<string, any>|null} rule 匹配到的派发规则。
 * @returns {{submit_rule_type: string, max_submit_count: number|null, cycle_type: string, cycle_value: number|null}} 生效规则。
 */
function buildEffectiveSubmitRule(questionnaire, rule) {
  if (rule && rule.submit_rule_type && rule.submit_rule_type !== 'inherit') {
    return {
      submit_rule_type: rule.submit_rule_type,
      max_submit_count: rule.max_submit_count,
      cycle_type: rule.cycle_type || 'none',
      cycle_value: rule.cycle_value == null ? null : Number(rule.cycle_value)
    }
  }

  return {
    submit_rule_type: questionnaire.submit_rule_type || 'once',
    max_submit_count: questionnaire.max_submit_count == null ? null : Number(questionnaire.max_submit_count),
    cycle_type: questionnaire.cycle_type || 'none',
    cycle_value: questionnaire.cycle_value == null ? null : Number(questionnaire.cycle_value)
  }
}

/**
 * 获取移动端问卷中心列表。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {Promise<Array<Record<string, any>>>} 问卷中心列表。
 */
async function listQuestionnairesForMobile(user, child) {
  const rows = await query(
    `
      SELECT *
      FROM questionnaires
      WHERE active = 1
      ORDER BY updated_at DESC, id DESC
    `
  )

  const result = []
  for (const row of rows || []) {
    const questionnaire = normalizeQuestionnaire(row)
    if (!isQuestionnairePublished(questionnaire)) continue
    const detail = await getQuestionnaireDetail(questionnaire.id)
    const matchedRule = pickMatchedAssignmentRule(detail.assignment_rules, child, user)
    if (!matchedRule) continue

    const draftCount = await queryOne(
      `
        SELECT COUNT(*) AS total
        FROM questionnaire_submissions
        WHERE questionnaire_id = ?
          AND user_id = ?
          AND child_id = ?
          AND status = 'draft'
      `,
      [questionnaire.id, user.id || user._id, child.id || child._id]
    )
    const submitCount = await queryOne(
      `
        SELECT COUNT(*) AS total
        FROM questionnaire_submissions
        WHERE questionnaire_id = ?
          AND user_id = ?
          AND child_id = ?
          AND status = 'submitted'
      `,
      [questionnaire.id, user.id || user._id, child.id || child._id]
    )

    result.push({
      ...questionnaire,
      matched_rule: matchedRule,
      effective_submit_rule: buildEffectiveSubmitRule(questionnaire, matchedRule),
      draft_count: draftCount ? Number(draftCount.total) : 0,
      submitted_count: submitCount ? Number(submitCount.total) : 0
    })
  }

  return result
}

module.exports = {
  normalizeQuestionnaire,
  normalizeQuestionnaireSection,
  normalizeQuestionnaireQuestion,
  normalizeQuestionnaireOption,
  normalizeAssignmentRule,
  getQuestionnaireRow,
  getQuestionnaireDetail,
  listQuestionnaires,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  copyQuestionnaire,
  updateQuestionnaireStatus,
  isQuestionnairePublished,
  isAssignmentRuleActive,
  isAssignmentRuleMatched,
  pickMatchedAssignmentRule,
  buildEffectiveSubmitRule,
  listQuestionnairesForMobile
}
