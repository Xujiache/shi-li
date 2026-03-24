const { query, execute, queryOne } = require('../utils/db')
const logger = require('../utils/logger')
const { hashPassword } = require('../utils/bcrypt')
const { safeJsonStringify, parseGradeInfo } = require('../utils/helpers')

/**
 * 初始化系统配置数据。
 * @returns {Promise<void>}
 */
async function seedSystemConfig() {
  const configKey = 'terms_and_privacy'
  const existing = await queryOne('SELECT id FROM system_configs WHERE config_key = ?', [configKey])
  if (existing) return

  await execute('INSERT INTO system_configs (config_key, config_value) VALUES (?, ?)', [
    configKey,
    safeJsonStringify({
      user_agreement: '欢迎使用儿童视力管理系统，请在使用前仔细阅读用户协议。',
      privacy_policy: '我们仅在业务必要范围内收集和使用您的信息。',
      child_privacy_policy: '我们会谨慎保护儿童个人信息并仅用于视力管理业务。',
      third_party_share_list: '当前系统仅在微信登录场景下调用微信官方能力，不向其他第三方共享业务数据。'
    })
  ])
}

/**
 * 初始化基础字典与展示数据。
 * @returns {Promise<void>}
 */
async function seedBasicContent() {
  const classes = [
    ['天堂小学', '一年级', '一年二班'],
    ['天堂小学', '二年级', '二年一班'],
    ['晨曦小学', '三年级', '三年二班']
  ]

  for (const [school, gradeName, className] of classes) {
    await execute(
      `
        INSERT INTO school_classes (school, grade_name, class_name, active)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE grade_name = VALUES(grade_name), active = VALUES(active), updated_at = CURRENT_TIMESTAMP
      `,
      [school, gradeName, className]
    )
  }

  // 不再初始化默认轮播图，首页轮播只依赖后台真实上传数据。

  const itemCount = await queryOne('SELECT COUNT(*) AS total FROM appointment_items')
  if ((itemCount && itemCount.total) === 0) {
    await execute(
      `
        INSERT INTO appointment_items (name, image_url, active)
        VALUES
          ('基础眼部护理', '', 1),
          ('视力复查', '', 1),
          ('护眼知识讲座', '', 1)
      `
    )
  }
}

/**
 * 回填学校班级和孩子档案中的结构化年级字段。
 * @returns {Promise<void>}
 */
async function backfillGradeNames() {
  const schoolClassRows = await query('SELECT id, class_name, grade_name FROM school_classes')
  for (const row of schoolClassRows || []) {
    if (row.grade_name) continue
    const gradeInfo = parseGradeInfo(row.class_name)
    if (!gradeInfo.grade_name) continue
    await execute('UPDATE school_classes SET grade_name = ?, updated_at = NOW() WHERE id = ?', [
      gradeInfo.grade_name,
      row.id
    ])
  }

  const childRows = await query('SELECT id, class_name, grade_name FROM children')
  for (const row of childRows || []) {
    if (row.grade_name) continue
    const gradeInfo = parseGradeInfo(row.class_name)
    if (!gradeInfo.grade_name) continue
    await execute('UPDATE children SET grade_name = ?, updated_at = NOW() WHERE id = ?', [
      gradeInfo.grade_name,
      row.id
    ])
  }
}

/**
 * 初始化测试用户与孩子数据。
 * @returns {Promise<void>}
 */
async function seedUsersAndChildren() {
  const adminPhone = '13800138000'
  const userPhone = '13900139000'
  const adminPasswordHash = await hashPassword('Admin@123456')
  const userPasswordHash = await hashPassword('123456')

  await execute(
    `
      INSERT INTO users (phone, password_hash, display_name, avatar_url, user_no, is_admin, active, deleted, last_login_at)
      VALUES (?, ?, ?, '', '10000001', 1, 1, 0, NOW())
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        is_admin = VALUES(is_admin),
        active = VALUES(active),
        deleted = VALUES(deleted),
        last_login_at = VALUES(last_login_at)
    `,
    [adminPhone, adminPasswordHash, '系统管理员']
  )

  await execute(
    `
      INSERT INTO users (phone, password_hash, display_name, avatar_url, user_no, is_admin, active, deleted, last_login_at)
      VALUES (?, ?, ?, '', '10000002', 0, 1, 0, NOW())
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        is_admin = VALUES(is_admin),
        active = VALUES(active),
        deleted = VALUES(deleted),
        last_login_at = VALUES(last_login_at)
    `,
    [userPhone, userPasswordHash, '示例家长']
  )

  const user = await queryOne('SELECT id, phone FROM users WHERE phone = ?', [userPhone])
  if (!user) return

  const existingChild = await queryOne('SELECT id FROM children WHERE child_no = ?', ['20000001'])
  if (!existingChild) {
    await execute(
      `
        INSERT INTO children (
          user_id, child_no, name, gender, dob, age, school, grade_name, class_name, parent_phone,
          height, weight, symptoms, symptom_other, additional_note, tongue_shape, tongue_color,
          tongue_coating, face_color, lip_color, hair, vision_status, refraction_l, refraction_r,
          avatar_url, active
        )
        VALUES (?, '20000001', '张三', '男', '2020-01-01', 6, '天堂小学', '一年级', '一年二班', ?, 120.00, 22.00,
          ?, '', '孩子近期用眼时间较长，晚上容易揉眼。', '齿痕', '淡红', '薄白', '红润', '红润', '正常',
          '4.9-4.7', '-0.75', '-0.50', '', 1
        )
      `,
      [user.id, user.phone, safeJsonStringify(['眼疲劳', '看远处模糊'])]
    )
  }
}

/**
 * 初始化问卷样例数据。
 * @returns {Promise<void>}
 */
async function seedQuestionnaireSample() {
  const questionnaireCount = await queryOne('SELECT COUNT(*) AS total FROM questionnaires')
  if (questionnaireCount && Number(questionnaireCount.total) > 0) return

  const insertQuestionnaire = await execute(
    `
      INSERT INTO questionnaires (
        title, description, cover_image_url, status, allow_save_draft, allow_view_result,
        submit_rule_type, max_submit_count, cycle_type, cycle_value,
        publish_start_at, publish_end_at, welcome_text, submit_success_text, schema_version, active
      )
      VALUES (?, ?, '', 'published', 1, 0, 'limited', 1, 'term', 1, NOW(), NULL, ?, ?, 1, 1)
    `,
    [
      '小学生心理健康评定量表（示例）',
      '参考问卷星风格的高级问卷样例，支持基本信息自动带出、单选、多选、量表评分与文本填写。',
      '请家长和孩子如实填写，本问卷用于示范“按年级派发 + 题目配置 + 提交数据留档”的完整能力。',
      '感谢填写，系统已记录本次问卷内容。'
    ]
  )

  const questionnaireId = insertQuestionnaire.insertId

  const insertSection1 = await execute(
    `
      INSERT INTO questionnaire_sections (questionnaire_id, title, description, page_no, sort_order)
      VALUES (?, '基本信息', '自动带出或允许手填的基础信息。', 1, 1)
    `,
    [questionnaireId]
  )
  const insertSection2 = await execute(
    `
      INSERT INTO questionnaire_sections (questionnaire_id, title, description, page_no, sort_order)
      VALUES (?, '学习与情绪', '参考心理健康量表的示例题目。', 2, 2)
    `,
    [questionnaireId]
  )
  const insertSection3 = await execute(
    `
      INSERT INTO questionnaire_sections (questionnaire_id, title, description, page_no, sort_order)
      VALUES (?, '家长补充', '开放式补充说明。', 3, 3)
    `,
    [questionnaireId]
  )

  const section1Id = insertSection1.insertId
  const section2Id = insertSection2.insertId
  const section3Id = insertSection3.insertId

  const insertQuestion = async (sectionId, type, code, title, required, sortOrder, settings, validation, visibility) => {
    const result = await execute(
      `
        INSERT INTO questionnaire_questions (
          questionnaire_id, section_id, type, code, title, required, sort_order,
          default_value_json, settings_json, validation_json, visibility_rule_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        questionnaireId,
        sectionId,
        type,
        code,
        title,
        required ? 1 : 0,
        sortOrder,
        safeJsonStringify(null),
        safeJsonStringify(settings || {}),
        safeJsonStringify(validation || {}),
        safeJsonStringify(visibility || {})
      ]
    )
    return result.insertId
  }

  const qChildName = await insertQuestion(
    section1Id,
    'profile_field',
    'child_name',
    '学生姓名',
    true,
    1,
    { profile_key: 'name', source_mode: 'readonly_profile', input_type: 'text' },
    {},
    {}
  )
  const qGrade = await insertQuestion(
    section1Id,
    'profile_field',
    'grade_name',
    '学生年级',
    true,
    2,
    { profile_key: 'grade_name', source_mode: 'editable_profile', input_type: 'text' },
    {},
    {}
  )
  const qClass = await insertQuestion(
    section1Id,
    'profile_field',
    'class_name',
    '学生班级',
    true,
    3,
    { profile_key: 'class_name', source_mode: 'editable_profile', input_type: 'text' },
    {},
    {}
  )
  const qQ1 = await insertQuestion(
    section2Id,
    'single_choice',
    'mh_12',
    '不能按时交作业或作业质量差',
    true,
    1,
    { option_layout: 'vertical' },
    {},
    {}
  )
  const qQ2 = await insertQuestion(
    section2Id,
    'single_choice',
    'mh_14',
    '遇到一点小事也担忧',
    true,
    2,
    { option_layout: 'vertical' },
    {},
    {}
  )
  const qQ3 = await insertQuestion(
    section2Id,
    'multi_choice',
    'recent_issues',
    '近期主要困扰（可多选）',
    false,
    3,
    { option_layout: 'vertical', max_select_count: 3 },
    {},
    {}
  )
  const qQ4 = await insertQuestion(
    section2Id,
    'rating',
    'study_pressure',
    '当前学习压力感受',
    true,
    4,
    { min: 1, max: 5, min_label: '很轻松', max_label: '很大' },
    {},
    {}
  )
  const qQ5 = await insertQuestion(
    section3Id,
    'textarea',
    'parent_note',
    '家长补充说明',
    false,
    1,
    { rows: 4, max_length: 500, placeholder: '如有特殊情况可补充说明' },
    {},
    {}
  )

  const optionRows = [
    [qQ1, '经常', 'often', 2, 1],
    [qQ1, '偶尔', 'sometimes', 1, 2],
    [qQ1, '没有', 'never', 0, 3],
    [qQ2, '经常', 'often', 2, 1],
    [qQ2, '偶尔', 'sometimes', 1, 2],
    [qQ2, '没有', 'never', 0, 3],
    [qQ3, '学习压力', 'study_pressure', null, 1],
    [qQ3, '同伴关系', 'peer_relation', null, 2],
    [qQ3, '睡眠问题', 'sleep_issue', null, 3],
    [qQ3, '情绪波动', 'emotion_change', null, 4]
  ]

  for (const [questionId, label, value, score, sortOrder] of optionRows) {
    await execute(
      `
        INSERT INTO questionnaire_question_options (
          questionnaire_id, question_id, label, value, score, sort_order, extra_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [questionnaireId, questionId, label, value, score, sortOrder, safeJsonStringify({})]
    )
  }

  await execute(
    `
      INSERT INTO questionnaire_assignment_rules (
        questionnaire_id, rule_name, scope_type, school, grade_name, grade_min, grade_max,
        submit_rule_type, max_submit_count, cycle_type, cycle_value, start_at, end_at, active, extra_json
      )
      VALUES (?, '一至三年级通用', 'grade_range', '', '一至三年级', 1, 3, 'limited', 1, 'term', 1, NOW(), NULL, 1, ?)
    `,
    [questionnaireId, safeJsonStringify({ description: '示例规则：一年级到三年级学生可填写，每学期限提交 1 次。' })]
  )
}

/**
 * 初始化预约排班与检测记录。
 * @returns {Promise<void>}
 */
async function seedAppointmentsAndCheckups() {
  const item = await queryOne('SELECT id, name FROM appointment_items ORDER BY id ASC LIMIT 1')
  const child = await queryOne('SELECT id, name, class_name, user_id, parent_phone FROM children ORDER BY id ASC LIMIT 1')
  if (!item || !child) return

  const scheduleCount = await queryOne('SELECT COUNT(*) AS total FROM appointment_schedules WHERE item_id = ?', [item.id])
  if ((scheduleCount && scheduleCount.total) === 0) {
    await execute(
      `
        INSERT INTO appointment_schedules (item_id, schedule_date, time_slot, max_count, booked_count, active)
        VALUES
          (?, '2026-03-20', '09:00-10:00', 10, 0, 1),
          (?, '2026-03-20', '14:00-15:00', 10, 0, 1)
      `,
      [item.id, item.id]
    )
  }

  const recordCount = await queryOne('SELECT COUNT(*) AS total FROM checkup_records WHERE child_id = ?', [child.id])
  if ((recordCount && recordCount.total) === 0) {
    await execute(
      `
        INSERT INTO checkup_records (
          child_id, checkup_date, height, weight, vision_l, vision_r, vision_both,
          refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active
        )
        VALUES
          (?, '2026-01-05', 118.00, 21.00, '4.7', '4.8', '4.8', ?, ?, ?, '建议控制近距离用眼，增加户外活动时间。', 1),
          (?, '2026-02-01', 120.00, 22.00, '4.9', '4.9', '4.9', ?, ?, ?, '视力有所改善，建议继续保持。', 1)
      `,
      [
        child.id,
        safeJsonStringify({ s: '-0.75', c: '-0.25', a: '180' }),
        safeJsonStringify({ s: '-0.50', c: '-0.25', a: '175' }),
        safeJsonStringify({
          vision_status: '不正常',
          refraction_status: '不正常',
          axis_status: '正常',
          cornea_status: '正常'
        }),
        child.id,
        safeJsonStringify({ s: '-0.50', c: '-0.25', a: '180' }),
        safeJsonStringify({ s: '-0.25', c: '-0.25', a: '175' }),
        safeJsonStringify({
          vision_status: '正常',
          refraction_status: '不正常',
          axis_status: '正常',
          cornea_status: '正常'
        })
      ]
    )
  }
}

/**
 * 初始化迁移后的基础测试数据。
 * @returns {Promise<boolean>} 是否初始化成功。
 */
async function initTestData() {
  try {
    logger.info('开始初始化迁移后的基础测试数据...')
    await seedSystemConfig()
    await seedBasicContent()
    await seedUsersAndChildren()
    await backfillGradeNames()
    await seedAppointmentsAndCheckups()
    await seedQuestionnaireSample()
    logger.info('测试数据初始化完成')
    return true
  } catch (error) {
    logger.error(`测试数据初始化失败: ${error.message}`)
    return false
  }
}

if (require.main === module) {
  initTestData()
    .then((success) => {
      if (success) {
        logger.info('测试数据初始化脚本执行成功')
        process.exit(0)
      } else {
        logger.error('测试数据初始化脚本执行失败')
        process.exit(1)
      }
    })
    .catch((error) => {
      logger.error(`测试数据初始化脚本执行异常: ${error.message}`)
      process.exit(1)
    })
}

module.exports = {
  initTestData
}