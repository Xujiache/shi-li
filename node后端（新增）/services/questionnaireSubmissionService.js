const { StatusCodes } = require('http-status-codes')
const { query, queryOne, withTransaction } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const {
  safeJsonParse,
  safeJsonStringify,
  normalizePagination
} = require('../utils/helpers')
const {
  getQuestionnaireDetail,
  getQuestionnaireRow,
  normalizeQuestionnaire,
  isQuestionnairePublished,
  pickMatchedAssignmentRule,
  buildEffectiveSubmitRule
} = require('./questionnaireService')

/**
 * 获取 profile_field 或带预填设置的问题默认值。
 * @param {Record<string, any>} question 问题对象。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {any} 预填值。
 */
function getPrefillValue(question, user, child) {
  const settings = question && question.settings ? question.settings : {}
  const profileKey = settings.profile_key || settings.field_key || settings.prefill_field
  if (!profileKey) return null

  const childMap = {
    name: child.name || '',
    child_name: child.name || '',
    gender: child.gender || '',
    dob: child.dob || '',
    school: child.school || '',
    grade_name: child.grade_name || '',
    class_name: child.class_name || '',
    child_no: child.child_no || '',
    parent_phone: child.parent_phone || ''
  }
  const userMap = {
    display_name: user.display_name || '',
    user_display_name: user.display_name || '',
    phone: user.phone || '',
    user_phone: user.phone || '',
    user_no: user.user_no || ''
  }

  if (Object.prototype.hasOwnProperty.call(childMap, profileKey)) return childMap[profileKey]
  if (Object.prototype.hasOwnProperty.call(userMap, profileKey)) return userMap[profileKey]
  return null
}

/**
 * 从原始答案对象中提取某一题的答案。
 * @param {Record<string, any>|Array<any>|undefined} rawAnswers 原始答案结构。
 * @param {Record<string, any>} question 当前题目。
 * @returns {any} 提取出的答案值。
 */
function extractAnswerValue(rawAnswers, question) {
  if (Array.isArray(rawAnswers)) {
    const hit =
      rawAnswers.find((item) => item && (String(item.question_id || '') === String(question.id))) ||
      rawAnswers.find((item) => item && question.code && String(item.question_code || '') === String(question.code))
    if (!hit) return undefined
    return hit.value
  }

  const source = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {}
  if (Object.prototype.hasOwnProperty.call(source, String(question.id))) return source[String(question.id)]
  if (question.code && Object.prototype.hasOwnProperty.call(source, question.code)) return source[question.code]
  return undefined
}

/**
 * 将答案值转成可比较的原始值。
 * @param {any} value 答案值。
 * @returns {any} 可比较值。
 */
function normalizeComparableValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

/**
 * 判断单条显示条件是否命中。
 * @param {Record<string, any>} condition 单条条件。
 * @param {Record<string, any>} answerMap 当前答案映射。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {boolean} 条件是否命中。
 */
function evaluateVisibilityCondition(condition, answerMap, user, child) {
  const sourceType = condition.source_type || 'question'
  const comparator = condition.comparator || 'eq'
  let leftValue

  if (sourceType === 'profile') {
    leftValue = getPrefillValue(
      {
        settings: {
          profile_key: condition.field_key
        }
      },
      user,
      child
    )
  } else if (condition.question_code) {
    leftValue = answerMap[condition.question_code]
  } else {
    leftValue = answerMap[String(condition.question_id || '')]
  }

  const rightValue = condition.value
  const left = normalizeComparableValue(leftValue)
  const right = normalizeComparableValue(rightValue)

  switch (comparator) {
    case 'neq':
      return left !== right
    case 'includes':
      return Array.isArray(left) ? left.includes(String(right)) : String(left).includes(String(right))
    case 'not_includes':
      return Array.isArray(left) ? !left.includes(String(right)) : !String(left).includes(String(right))
    case 'gt':
      return Number(left) > Number(right)
    case 'gte':
      return Number(left) >= Number(right)
    case 'lt':
      return Number(left) < Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    case 'in':
      return Array.isArray(rightValue) ? rightValue.map(String).includes(String(left)) : false
    case 'eq':
    default:
      return left === right
  }
}

/**
 * 判断题目是否应该显示。
 * @param {Record<string, any>} question 题目对象。
 * @param {Record<string, any>} answerMap 当前答案映射。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {boolean} 是否显示。
 */
function isQuestionVisible(question, answerMap, user, child) {
  const rule = question && question.visibility_rule ? question.visibility_rule : {}
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
  if (conditions.length === 0) return true
  const operator = String(rule.operator || 'and').toLowerCase()
  const results = conditions.map((condition) => evaluateVisibilityCondition(condition, answerMap, user, child))
  return operator === 'or' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * 根据题型规范化答案并计算得分。
 * @param {Record<string, any>} question 题目对象。
 * @param {any} rawValue 原始答案值。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @param {boolean} strictRequired 是否校验必填。
 * @returns {{value: any, answer_text: string, score: number|null}} 规范化答案。
 */
function normalizeAnswerByQuestion(question, rawValue, user, child, strictRequired) {
  const settings = question.settings || {}
  const type = question.type || 'single_choice'
  const options = Array.isArray(question.options) ? question.options : []
  const prefillValue = getPrefillValue(question, user, child)
  const sourceMode = settings.source_mode || 'manual'
  let value = rawValue

  if ((value === undefined || value === null || value === '') && sourceMode !== 'manual' && prefillValue !== null) {
    value = prefillValue
  }

  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  if (strictRequired && question.required && empty) {
    throw createAppError(`题目「${question.title}」为必答项`, StatusCodes.BAD_REQUEST)
  }

  if (empty) {
    return { value: null, answer_text: '', score: null }
  }

  if (type === 'multi_choice') {
    const arr = Array.isArray(value) ? value.map(String) : [String(value)]
    const labels = options.filter((option) => arr.includes(String(option.value))).map((option) => option.label)
    const score = options
      .filter((option) => arr.includes(String(option.value)) && option.score != null)
      .reduce((sum, option) => sum + Number(option.score || 0), 0)
    return {
      value: arr,
      answer_text: labels.join('、') || arr.join('、'),
      score: options.some((option) => option.score != null) ? score : null
    }
  }

  if (type === 'single_choice' || type === 'select') {
    const stringValue = String(value)
    const option = options.find((item) => String(item.value) === stringValue)
    return {
      value: stringValue,
      answer_text: option ? option.label : stringValue,
      score: option && option.score != null ? Number(option.score) : null
    }
  }

  if (type === 'rating') {
    const scoreValue = Number(value)
    const min = Number(settings.min || 1)
    const max = Number(settings.max || 5)
    if (Number.isNaN(scoreValue) || scoreValue < min || scoreValue > max) {
      throw createAppError(`题目「${question.title}」评分超出允许范围`, StatusCodes.BAD_REQUEST)
    }
    return {
      value: scoreValue,
      answer_text: String(scoreValue),
      score: scoreValue
    }
  }

  if (type === 'number') {
    const numericValue = Number(value)
    if (Number.isNaN(numericValue)) {
      throw createAppError(`题目「${question.title}」必须填写数字`, StatusCodes.BAD_REQUEST)
    }
    return {
      value: numericValue,
      answer_text: String(numericValue),
      score: null
    }
  }

  const stringValue = String(value)
  return {
    value: stringValue,
    answer_text: stringValue,
    score: null
  }
}

/**
 * 构造当前提交周期窗口。
 * @param {string} cycleType 周期类型。
 * @param {Date} now 当前时间。
 * @returns {{start: Date, end: Date}|null} 周期窗口。
 */
function buildCycleWindow(cycleType, now = new Date()) {
  const current = new Date(now)
  if (cycleType === 'none') return null

  if (cycleType === 'day') {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0)
    const end = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 0, 0, 0)
    return { start, end }
  }

  if (cycleType === 'week') {
    const day = current.getDay() || 7
    const start = new Date(current)
    start.setDate(current.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start, end }
  }

  if (cycleType === 'month') {
    const start = new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0)
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 1, 0, 0, 0)
    return { start, end }
  }

  if (cycleType === 'term') {
    const month = current.getMonth() + 1
    if (month >= 2 && month <= 8) {
      return {
        start: new Date(current.getFullYear(), 1, 1, 0, 0, 0),
        end: new Date(current.getFullYear(), 8, 1, 0, 0, 0)
      }
    }
    if (month === 1) {
      return {
        start: new Date(current.getFullYear() - 1, 8, 1, 0, 0, 0),
        end: new Date(current.getFullYear(), 1, 1, 0, 0, 0)
      }
    }
    return {
      start: new Date(current.getFullYear(), 8, 1, 0, 0, 0),
      end: new Date(current.getFullYear() + 1, 1, 1, 0, 0, 0)
    }
  }

  return null
}

/**
 * 判断当前孩子是否还能继续提交问卷。
 * @param {Record<string, any>} questionnaire 问卷对象。
 * @param {Record<string, any>|null} matchedRule 命中的派发规则。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {Promise<{can_submit: boolean, used_count: number, remaining_count: number|null, effective_rule: Record<string, any>}>} 可提交性结果。
 */
async function getSubmissionAvailability(questionnaire, matchedRule, user, child) {
  const effectiveRule = buildEffectiveSubmitRule(questionnaire, matchedRule)
  const ruleType = effectiveRule.submit_rule_type || 'once'
  if (ruleType === 'unlimited') {
    return { can_submit: true, used_count: 0, remaining_count: null, effective_rule: effectiveRule }
  }

  const cycleWindow = buildCycleWindow(effectiveRule.cycle_type || 'none')
  const values = [questionnaire.id, user.id || user._id, child.id || child._id]
  let where = `
      questionnaire_id = ?
      AND user_id = ?
      AND child_id = ?
      AND status = 'submitted'
    `
  if (cycleWindow) {
    where += ' AND submitted_at >= ? AND submitted_at < ?'
    values.push(cycleWindow.start, cycleWindow.end)
  }
  const countRow = await queryOne(`SELECT COUNT(*) AS total FROM questionnaire_submissions WHERE ${where}`, values)
  const usedCount = countRow ? Number(countRow.total) : 0

  const limit = ruleType === 'once' ? 1 : effectiveRule.max_submit_count == null ? 1 : Number(effectiveRule.max_submit_count)
  const remainingCount = Math.max(limit - usedCount, 0)
  return {
    can_submit: remainingCount > 0,
    used_count: usedCount,
    remaining_count: remainingCount,
    effective_rule: effectiveRule
  }
}

/**
 * 规范化答卷记录对象。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeSubmission(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    questionnaire_id: String(row.questionnaire_id),
    questionnaire_title: row.questionnaire_title || '',
    assignment_rule_id: row.assignment_rule_id == null ? '' : String(row.assignment_rule_id),
    user_id: String(row.user_id),
    child_id: String(row.child_id),
    attempt_no: Number(row.attempt_no || 1),
    status: row.status || 'draft',
    user_phone: row.user_phone || '',
    user_no: row.user_no || '',
    user_display_name: row.user_display_name || '',
    child_name: row.child_name || '',
    school: row.school || '',
    grade_name: row.grade_name || '',
    class_name: row.class_name || '',
    total_score: row.total_score == null ? null : Number(row.total_score),
    answered_count: Number(row.answered_count || 0),
    required_answered_count: Number(row.required_answered_count || 0),
    user_snapshot: safeJsonParse(row.user_snapshot_json, {}),
    child_snapshot: safeJsonParse(row.child_snapshot_json, {}),
    schema_snapshot: safeJsonParse(row.schema_snapshot_json, {}),
    submission_meta: safeJsonParse(row.submission_meta_json, {}),
    started_at: row.started_at || null,
    submitted_at: row.submitted_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 规范化答卷答案对象。
 * @param {Record<string, any>} row 原始记录。
 * @returns {Record<string, any>} 规范化对象。
 */
function normalizeSubmissionAnswer(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    submission_id: String(row.submission_id),
    questionnaire_id: String(row.questionnaire_id),
    question_id: row.question_id == null ? '' : String(row.question_id),
    section_id: row.section_id == null ? '' : String(row.section_id),
    question_title: row.question_title || '',
    question_type: row.question_type || '',
    answer: safeJsonParse(row.answer_json, null),
    answer_text: row.answer_text || '',
    score: row.score == null ? null : Number(row.score),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 获取当前用户可填写的问卷详情。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {Promise<Record<string, any>>} 可填写详情。
 */
async function getMobileQuestionnaireDetail(questionnaireId, user, child) {
  const detail = await getQuestionnaireDetail(questionnaireId)
  if (!isQuestionnairePublished(detail.questionnaire)) {
    throw createAppError('问卷当前未发布', StatusCodes.FORBIDDEN)
  }

  const matchedRule = pickMatchedAssignmentRule(detail.assignment_rules, child, user)
  if (!matchedRule) {
    throw createAppError('当前孩子不在该问卷的可填写范围内', StatusCodes.FORBIDDEN)
  }

  const availability = await getSubmissionAvailability(detail.questionnaire, matchedRule, user, child)
  const latestDraft = await queryOne(
    `
      SELECT *
      FROM questionnaire_submissions
      WHERE questionnaire_id = ?
        AND user_id = ?
        AND child_id = ?
        AND status = 'draft'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [questionnaireId, user.id || user._id, child.id || child._id]
  )

  return {
    questionnaire: detail.questionnaire,
    sections: detail.sections,
    matched_rule: matchedRule,
    availability,
    draft_submission_id: latestDraft ? String(latestDraft.id) : ''
  }
}

/**
 * 保存问卷草稿或提交正式答卷。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @param {{answers?: any, submission_id?: string|number, action?: 'draft'|'submit'}} payload 提交数据。
 * @param {'draft'|'submitted'} targetStatus 目标状态。
 * @returns {Promise<Record<string, any>>} 保存后的答卷详情。
 */
async function saveQuestionnaireSubmission(questionnaireId, user, child, payload, targetStatus) {
  const detail = await getQuestionnaireDetail(questionnaireId)
  if (!isQuestionnairePublished(detail.questionnaire) && targetStatus === 'submitted') {
    throw createAppError('问卷当前未发布，无法提交', StatusCodes.FORBIDDEN)
  }

  const matchedRule = pickMatchedAssignmentRule(detail.assignment_rules, child, user)
  if (!matchedRule) {
    throw createAppError('当前孩子不在该问卷的可填写范围内', StatusCodes.FORBIDDEN)
  }

  const availability = await getSubmissionAvailability(detail.questionnaire, matchedRule, user, child)
  if (targetStatus === 'submitted' && !availability.can_submit) {
    throw createAppError('当前提交次数已达上限', StatusCodes.CONFLICT)
  }

  const answerSource = payload && payload.answers !== undefined ? payload.answers : {}
  const answerMap = {}
  const visibleQuestions = []
  for (const section of detail.sections || []) {
    for (const question of section.questions || []) {
      const rawValue = extractAnswerValue(answerSource, question)
      const normalizedPreview = normalizeAnswerByQuestion(question, rawValue, user, child, false)
      answerMap[String(question.id)] = normalizedPreview.value
      if (question.code) answerMap[question.code] = normalizedPreview.value
    }
  }

  for (const section of detail.sections || []) {
    for (const question of section.questions || []) {
      if (!isQuestionVisible(question, answerMap, user, child)) continue
      const normalizedAnswer = normalizeAnswerByQuestion(question, extractAnswerValue(answerSource, question), user, child, targetStatus === 'submitted')
      visibleQuestions.push({
        section_id: section.id,
        question,
        normalizedAnswer
      })
    }
  }

  const totalScore = visibleQuestions.reduce((sum, item) => sum + Number(item.normalizedAnswer.score || 0), 0)
  const answeredCount = visibleQuestions.filter((item) => item.normalizedAnswer.value !== null && item.normalizedAnswer.value !== '').length
  const requiredAnsweredCount = visibleQuestions.filter((item) => item.question.required && item.normalizedAnswer.value !== null && item.normalizedAnswer.value !== '').length

  const questionnaireSnapshot = {
    questionnaire: detail.questionnaire,
    sections: detail.sections
  }
  const userSnapshot = {
    user_id: String(user.id || user._id),
    user_no: user.user_no || '',
    phone: user.phone || '',
    display_name: user.display_name || ''
  }
  const childSnapshot = {
    child_id: String(child.id || child._id),
    child_no: child.child_no || '',
    name: child.name || '',
    school: child.school || '',
    grade_name: child.grade_name || '',
    class_name: child.class_name || ''
  }

  const submissionId = await withTransaction(async (connection) => {
    let existingDraft = null
    if (payload && payload.submission_id) {
      const [rows] = await connection.execute(
        `
          SELECT *
          FROM questionnaire_submissions
          WHERE id = ?
            AND questionnaire_id = ?
            AND user_id = ?
            AND child_id = ?
            AND status = 'draft'
          LIMIT 1
        `,
        [payload.submission_id, questionnaireId, user.id || user._id, child.id || child._id]
      )
      existingDraft = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    }

    if (!existingDraft) {
      const [rows] = await connection.execute(
        `
          SELECT *
          FROM questionnaire_submissions
          WHERE questionnaire_id = ?
            AND user_id = ?
            AND child_id = ?
            AND status = 'draft'
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [questionnaireId, user.id || user._id, child.id || child._id]
      )
      existingDraft = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    }

    let targetSubmissionId = existingDraft ? existingDraft.id : null
    let attemptNo = existingDraft ? Number(existingDraft.attempt_no || 1) : null
    if (!targetSubmissionId) {
      const [rows] = await connection.execute(
        `
          SELECT MAX(attempt_no) AS max_attempt
          FROM questionnaire_submissions
          WHERE questionnaire_id = ?
            AND user_id = ?
            AND child_id = ?
        `,
        [questionnaireId, user.id || user._id, child.id || child._id]
      )
      const maxAttempt = Array.isArray(rows) && rows[0] ? Number(rows[0].max_attempt || 0) : 0
      attemptNo = maxAttempt + 1
      const [insertResult] = await connection.execute(
        `
          INSERT INTO questionnaire_submissions (
            questionnaire_id, assignment_rule_id, user_id, child_id, attempt_no, status,
            user_phone, user_no, user_display_name, child_name, school, grade_name, class_name,
            total_score, answered_count, required_answered_count, user_snapshot_json,
            child_snapshot_json, schema_snapshot_json, submission_meta_json, started_at, submitted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `,
        [
          questionnaireId,
          matchedRule ? matchedRule.id : null,
          user.id || user._id,
          child.id || child._id,
          attemptNo,
          targetStatus,
          user.phone || '',
          user.user_no || '',
          user.display_name || '',
          child.name || '',
          child.school || '',
          child.grade_name || '',
          child.class_name || '',
          totalScore || null,
          answeredCount,
          requiredAnsweredCount,
          safeJsonStringify(userSnapshot),
          safeJsonStringify(childSnapshot),
          safeJsonStringify(questionnaireSnapshot),
          safeJsonStringify({
            matched_rule_id: matchedRule ? matchedRule.id : null
          }),
          targetStatus === 'submitted' ? new Date() : null
        ]
      )
      targetSubmissionId = insertResult.insertId
    } else {
      await connection.execute(
        `
          UPDATE questionnaire_submissions
          SET assignment_rule_id = ?, status = ?, user_phone = ?, user_no = ?, user_display_name = ?,
              child_name = ?, school = ?, grade_name = ?, class_name = ?, total_score = ?, answered_count = ?,
              required_answered_count = ?, user_snapshot_json = ?, child_snapshot_json = ?, schema_snapshot_json = ?,
              submission_meta_json = ?, submitted_at = ?, updated_at = NOW()
          WHERE id = ?
        `,
        [
          matchedRule ? matchedRule.id : null,
          targetStatus,
          user.phone || '',
          user.user_no || '',
          user.display_name || '',
          child.name || '',
          child.school || '',
          child.grade_name || '',
          child.class_name || '',
          totalScore || null,
          answeredCount,
          requiredAnsweredCount,
          safeJsonStringify(userSnapshot),
          safeJsonStringify(childSnapshot),
          safeJsonStringify(questionnaireSnapshot),
          safeJsonStringify({
            matched_rule_id: matchedRule ? matchedRule.id : null
          }),
          targetStatus === 'submitted' ? new Date() : null,
          targetSubmissionId
        ]
      )
    }

    await connection.execute('DELETE FROM questionnaire_answers WHERE submission_id = ?', [targetSubmissionId])

    for (const item of visibleQuestions) {
      await connection.execute(
        `
          INSERT INTO questionnaire_answers (
            submission_id, questionnaire_id, question_id, section_id, question_title, question_type,
            answer_json, answer_text, score
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          targetSubmissionId,
          questionnaireId,
          item.question.id,
          item.section_id || null,
          item.question.title,
          item.question.type,
          safeJsonStringify(item.normalizedAnswer.value),
          item.normalizedAnswer.answer_text,
          item.normalizedAnswer.score
        ]
      )
    }

    return targetSubmissionId
  })

  return getQuestionnaireSubmissionDetail(submissionId)
}

/**
 * 获取当前问卷历史提交记录。
 * @param {number|string} questionnaireId 问卷 ID。
 * @param {Record<string, any>} user 当前用户。
 * @param {Record<string, any>} child 当前孩子。
 * @returns {Promise<Array<Record<string, any>>>} 提交记录数组。
 */
async function listMyQuestionnaireSubmissions(questionnaireId, user, child) {
  const rows = await query(
    `
      SELECT *
      FROM questionnaire_submissions
      WHERE questionnaire_id = ?
        AND user_id = ?
        AND child_id = ?
      ORDER BY attempt_no DESC, updated_at DESC
    `,
    [questionnaireId, user.id || user._id, child.id || child._id]
  )
  return (rows || []).map(normalizeSubmission)
}

/**
 * 获取问卷提交详情。
 * @param {number|string} submissionId 提交记录 ID。
 * @returns {Promise<Record<string, any>>} 提交详情。
 */
async function getQuestionnaireSubmissionDetail(submissionId) {
  const row = await queryOne(
    `
      SELECT qs.*, q.title AS questionnaire_title
      FROM questionnaire_submissions qs
      LEFT JOIN questionnaires q ON q.id = qs.questionnaire_id
      WHERE qs.id = ?
      LIMIT 1
    `,
    [submissionId]
  )
  if (!row) throw createAppError('问卷填写记录不存在', StatusCodes.NOT_FOUND)

  const answers = await query(
    `
      SELECT *
      FROM questionnaire_answers
      WHERE submission_id = ?
      ORDER BY id ASC
    `,
    [submissionId]
  )

  return {
    submission: normalizeSubmission(row),
    answers: (answers || []).map(normalizeSubmissionAnswer)
  }
}

/**
 * 获取后台答卷列表。
 * @param {{questionnaire_id?: string|number, q?: string, school?: string, grade_name?: string, class_name?: string, status?: string, date_from?: string, date_to?: string, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listQuestionnaireSubmissionsForAdmin(params = {}) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.questionnaire_id) {
    conditions.push('questionnaire_id = ?')
    values.push(params.questionnaire_id)
  }
  if (params.q) {
    conditions.push('(child_name LIKE ? OR user_phone LIKE ? OR user_no LIKE ? OR user_display_name LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.school) {
    conditions.push('school = ?')
    values.push(params.school)
  }
  if (params.grade_name) {
    conditions.push('grade_name = ?')
    values.push(params.grade_name)
  }
  if (params.class_name) {
    conditions.push('class_name = ?')
    values.push(params.class_name)
  }
  if (params.status) {
    conditions.push('status = ?')
    values.push(params.status)
  }
  if (params.date_from) {
    conditions.push('submitted_at >= ?')
    values.push(params.date_from)
  }
  if (params.date_to) {
    conditions.push('submitted_at <= ?')
    values.push(params.date_to)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM questionnaire_submissions ${whereClause}`, values)
  const rows = await query(
    `
      SELECT qs.*, q.title AS questionnaire_title
      FROM questionnaire_submissions qs
      LEFT JOIN questionnaires q ON q.id = qs.questionnaire_id
      ${whereClause ? whereClause.replace(/questionnaire_submissions/g, 'qs') : ''}
      ORDER BY COALESCE(qs.submitted_at, qs.updated_at) DESC, qs.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )
  return {
    list: (rows || []).map(normalizeSubmission),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 导出后台答卷数据。
 * @param {Record<string, any>} params 查询参数。
 * @returns {Promise<Array<Record<string, any>>>} 导出行数组。
 */
async function exportQuestionnaireSubmissions(params = {}) {
  const result = await listQuestionnaireSubmissionsForAdmin({
    ...params,
    page: 1,
    page_size: 1000
  })

  if (params.questionnaire_id) {
    const questionnaireId = params.questionnaire_id
    const exportRows = []
    for (const row of result.list) {
      const detail = await getQuestionnaireSubmissionDetail(row.id)
      const baseRow = {
        提交ID: row._id,
        问卷ID: row.questionnaire_id,
        用户编号: row.user_no,
        手机号: row.user_phone,
        学生姓名: row.child_name,
        学校: row.school,
        年级: row.grade_name,
        班级: row.class_name,
        提交状态: row.status,
        提交次数: row.attempt_no,
        提交时间: row.submitted_at || ''
      }
      for (const answer of detail.answers) {
        baseRow[answer.question_title || `题目${answer.question_id}`] = answer.answer_text || safeJsonStringify(answer.answer)
      }
      exportRows.push(baseRow)
    }
    return exportRows
  }

  return result.list.map((row) => ({
    提交ID: row._id,
    问卷ID: row.questionnaire_id,
    用户编号: row.user_no,
    手机号: row.user_phone,
    学生姓名: row.child_name,
    学校: row.school,
    年级: row.grade_name,
    班级: row.class_name,
    提交状态: row.status,
    提交次数: row.attempt_no,
    提交时间: row.submitted_at || ''
  }))
}

module.exports = {
  getPrefillValue,
  isQuestionVisible,
  normalizeAnswerByQuestion,
  getSubmissionAvailability,
  getMobileQuestionnaireDetail,
  saveQuestionnaireSubmission,
  listMyQuestionnaireSubmissions,
  getQuestionnaireSubmissionDetail,
  listQuestionnaireSubmissionsForAdmin,
  exportQuestionnaireSubmissions
}
