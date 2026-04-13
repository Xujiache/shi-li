const logger = require('../../utils/logger')

/**
 * 执行单条 DDL 语句。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @param {string} sql DDL SQL。
 * @returns {Promise<void>}
 */
async function runDDL(connection, sql) {
  await connection.query(sql)
}

/**
 * 判断数据表字段是否存在。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @param {string} tableName 表名。
 * @param {string} columnName 字段名。
 * @returns {Promise<boolean>} 是否存在。
 */
async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  )
  return Array.isArray(rows) && rows[0] && Number(rows[0].total) > 0
}

/**
 * 为已有表补充缺失字段。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @param {string} tableName 表名。
 * @param {string} columnName 字段名。
 * @param {string} definition 字段定义。
 * @returns {Promise<void>}
 */
async function ensureColumn(connection, tableName, columnName, definition) {
  const exists = await columnExists(connection, tableName, columnName)
  if (exists) return
  await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`)
}

/**
 * 判断索引是否存在。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @param {string} tableName 表名。
 * @param {string} indexName 索引名。
 * @returns {Promise<boolean>} 是否存在。
 */
async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  )
  return Array.isArray(rows) && rows[0] && Number(rows[0].total) > 0
}

/**
 * 为已有表补充缺失索引。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @param {string} tableName 表名。
 * @param {string} indexName 索引名。
 * @param {string} indexDefinition 索引定义。
 * @returns {Promise<void>}
 */
async function ensureIndex(connection, tableName, indexName, indexDefinition) {
  const exists = await indexExists(connection, tableName, indexName)
  if (exists) return
  await connection.query(`ALTER TABLE \`${tableName}\` ADD ${indexDefinition}`)
}

/**
 * 创建迁移后的核心业务表与问卷体系表。
 * @param {import('mysql2/promise').Connection} connection MySQL 连接。
 * @returns {Promise<void>}
 */
async function createCoreTables(connection) {
  logger.info('开始初始化儿童视力管理与问卷体系表...')

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        phone VARCHAR(20) DEFAULT NULL,
        password_hash VARCHAR(255) DEFAULT NULL,
        display_name VARCHAR(100) NOT NULL DEFAULT '',
        avatar_url VARCHAR(500) NOT NULL DEFAULT '',
        user_no VARCHAR(20) NOT NULL,
        wechat_openid VARCHAR(100) DEFAULT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        last_login_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_users_phone (phone),
        UNIQUE KEY uk_users_user_no (user_no),
        UNIQUE KEY uk_users_wechat_openid (wechat_openid),
        KEY idx_users_is_admin (is_admin),
        KEY idx_users_active_deleted (active, deleted)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS school_classes (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        school VARCHAR(120) NOT NULL,
        grade_name VARCHAR(50) NOT NULL DEFAULT '',
        class_name VARCHAR(120) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_school_classes (school, class_name),
        KEY idx_school_classes_active (active),
        KEY idx_school_classes_grade_name (grade_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS children (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        child_no VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        gender VARCHAR(20) NOT NULL DEFAULT '',
        dob VARCHAR(20) NOT NULL DEFAULT '',
        age INT DEFAULT NULL,
        school VARCHAR(120) NOT NULL DEFAULT '',
        grade_name VARCHAR(50) NOT NULL DEFAULT '',
        class_name VARCHAR(120) NOT NULL DEFAULT '',
        parent_phone VARCHAR(20) NOT NULL DEFAULT '',
        height DECIMAL(10,2) DEFAULT NULL,
        weight DECIMAL(10,2) DEFAULT NULL,
        symptoms JSON DEFAULT NULL,
        symptom_other VARCHAR(255) NOT NULL DEFAULT '',
        additional_note TEXT,
        tongue_shape VARCHAR(50) NOT NULL DEFAULT '',
        tongue_color VARCHAR(50) NOT NULL DEFAULT '',
        tongue_coating VARCHAR(50) NOT NULL DEFAULT '',
        face_color VARCHAR(50) NOT NULL DEFAULT '',
        lip_color VARCHAR(50) NOT NULL DEFAULT '',
        hair VARCHAR(50) NOT NULL DEFAULT '',
        vision_status VARCHAR(50) NOT NULL DEFAULT '',
        refraction_l VARCHAR(50) NOT NULL DEFAULT '',
        refraction_r VARCHAR(50) NOT NULL DEFAULT '',
        avatar_url VARCHAR(500) NOT NULL DEFAULT '',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_children_child_no (child_no),
        KEY idx_children_user_id (user_id),
        KEY idx_children_parent_phone (parent_phone),
        KEY idx_children_school_class (school, class_name),
        KEY idx_children_grade_name (grade_name),
        CONSTRAINT fk_children_user_id FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  // 兼容已存在的旧表结构，补齐问卷需要的结构化年级字段。
  await ensureColumn(connection, 'school_classes', 'grade_name', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `school`")
  await ensureColumn(connection, 'children', 'grade_name', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `school`")
  await ensureIndex(connection, 'school_classes', 'idx_school_classes_grade_name', 'INDEX idx_school_classes_grade_name (`grade_name`)')
  await ensureIndex(connection, 'children', 'idx_children_grade_name', 'INDEX idx_children_grade_name (`grade_name`)')

  // ── 近视防控健康档案 & 中医评估新增字段 ──
  await ensureColumn(connection, 'children', 'vision_r', "VARCHAR(20) NOT NULL DEFAULT '' AFTER `vision_status`")
  await ensureColumn(connection, 'children', 'vision_l', "VARCHAR(20) NOT NULL DEFAULT '' AFTER `vision_r`")
  await ensureColumn(connection, 'children', 'vision_both', "VARCHAR(20) NOT NULL DEFAULT '' AFTER `vision_l`")
  await ensureColumn(connection, 'children', 'refraction_r_detail', "JSON DEFAULT NULL AFTER `refraction_r`")
  await ensureColumn(connection, 'children', 'refraction_l_detail', "JSON DEFAULT NULL AFTER `refraction_r_detail`")
  await ensureColumn(connection, 'children', 'curvature_r', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `refraction_l_detail`")
  await ensureColumn(connection, 'children', 'curvature_l', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `curvature_r`")
  await ensureColumn(connection, 'children', 'axial_length_r', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `curvature_l`")
  await ensureColumn(connection, 'children', 'axial_length_l', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `axial_length_r`")
  await ensureColumn(connection, 'children', 'diagnosis_json', "JSON DEFAULT NULL AFTER `axial_length_l`")
  await ensureColumn(connection, 'children', 'management_plan', "TEXT AFTER `diagnosis_json`")
  await ensureColumn(connection, 'children', 'optometrist_name', "VARCHAR(100) NOT NULL DEFAULT '' AFTER `management_plan`")
  await ensureColumn(connection, 'children', 'exam_date', "VARCHAR(20) NOT NULL DEFAULT '' AFTER `optometrist_name`")
  await ensureColumn(connection, 'children', 'tcm_symptoms_json', "JSON DEFAULT NULL AFTER `exam_date`")
  await ensureColumn(connection, 'children', 'tcm_symptom_other', "VARCHAR(500) NOT NULL DEFAULT '' AFTER `tcm_symptoms_json`")
  await ensureColumn(connection, 'children', 'tcm_syndrome_types', "JSON DEFAULT NULL AFTER `tcm_symptom_other`")
  await ensureColumn(connection, 'children', 'tcm_syndrome_other', "VARCHAR(255) NOT NULL DEFAULT '' AFTER `tcm_syndrome_types`")
  await ensureColumn(connection, 'children', 'risk_level', "VARCHAR(20) NOT NULL DEFAULT '' AFTER `tcm_syndrome_other`")
  await ensureColumn(connection, 'children', 'treatment_plans', "JSON DEFAULT NULL AFTER `risk_level`")
  await ensureColumn(connection, 'children', 'treatment_other', "VARCHAR(255) NOT NULL DEFAULT '' AFTER `treatment_plans`")
  await ensureColumn(connection, 'children', 'doctor_name', "VARCHAR(100) NOT NULL DEFAULT '' AFTER `treatment_other`")
  await ensureColumn(connection, 'children', 'custom_fields_json', "JSON DEFAULT NULL AFTER `doctor_name`")

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS banners (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        image_url VARCHAR(500) NOT NULL,
        title VARCHAR(100) NOT NULL DEFAULT '',
        sub_title VARCHAR(200) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 1,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_banners_sort_active (sort_order, active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS system_configs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(120) NOT NULL,
        config_value JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_system_configs_key (config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaires (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        cover_image_url VARCHAR(500) NOT NULL DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        allow_save_draft TINYINT(1) NOT NULL DEFAULT 1,
        allow_view_result TINYINT(1) NOT NULL DEFAULT 0,
        submit_rule_type VARCHAR(30) NOT NULL DEFAULT 'once',
        max_submit_count INT DEFAULT 1,
        cycle_type VARCHAR(30) NOT NULL DEFAULT 'none',
        cycle_value INT DEFAULT NULL,
        publish_start_at DATETIME DEFAULT NULL,
        publish_end_at DATETIME DEFAULT NULL,
        welcome_text TEXT,
        submit_success_text TEXT,
        schema_version INT NOT NULL DEFAULT 1,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_questionnaires_status_active (status, active),
        KEY idx_questionnaires_publish_time (publish_start_at, publish_end_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_sections (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        page_no INT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_questionnaire_sections_qid_order (questionnaire_id, page_no, sort_order),
        CONSTRAINT fk_questionnaire_sections_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_questions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        section_id BIGINT UNSIGNED DEFAULT NULL,
        type VARCHAR(40) NOT NULL,
        code VARCHAR(100) NOT NULL DEFAULT '',
        title VARCHAR(500) NOT NULL,
        description TEXT,
        required TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 1,
        placeholder VARCHAR(255) NOT NULL DEFAULT '',
        default_value_json JSON DEFAULT NULL,
        settings_json JSON DEFAULT NULL,
        validation_json JSON DEFAULT NULL,
        visibility_rule_json JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_questionnaire_questions_qid_sid_order (questionnaire_id, section_id, sort_order),
        KEY idx_questionnaire_questions_type (type),
        CONSTRAINT fk_questionnaire_questions_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_questions_section_id
          FOREIGN KEY (section_id) REFERENCES questionnaire_sections(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_question_options (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        question_id BIGINT UNSIGNED NOT NULL,
        label VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL DEFAULT '',
        score DECIMAL(10,2) DEFAULT NULL,
        sort_order INT NOT NULL DEFAULT 1,
        extra_json JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_questionnaire_options_qid_order (question_id, sort_order),
        CONSTRAINT fk_questionnaire_question_options_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_question_options_question_id
          FOREIGN KEY (question_id) REFERENCES questionnaire_questions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_assignment_rules (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        rule_name VARCHAR(200) NOT NULL DEFAULT '',
        scope_type VARCHAR(30) NOT NULL DEFAULT 'all',
        school VARCHAR(120) NOT NULL DEFAULT '',
        grade_name VARCHAR(50) NOT NULL DEFAULT '',
        grade_min TINYINT UNSIGNED DEFAULT NULL,
        grade_max TINYINT UNSIGNED DEFAULT NULL,
        class_name VARCHAR(120) NOT NULL DEFAULT '',
        user_id BIGINT UNSIGNED DEFAULT NULL,
        child_id BIGINT UNSIGNED DEFAULT NULL,
        submit_rule_type VARCHAR(30) NOT NULL DEFAULT 'inherit',
        max_submit_count INT DEFAULT NULL,
        cycle_type VARCHAR(30) NOT NULL DEFAULT 'none',
        cycle_value INT DEFAULT NULL,
        start_at DATETIME DEFAULT NULL,
        end_at DATETIME DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        extra_json JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_questionnaire_assignment_rules_qid_active (questionnaire_id, active),
        KEY idx_questionnaire_assignment_rules_scope (scope_type, school, grade_min, grade_max, class_name),
        KEY idx_questionnaire_assignment_rules_child_user (child_id, user_id),
        CONSTRAINT fk_questionnaire_assignment_rules_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_assignment_rules_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_questionnaire_assignment_rules_child_id
          FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_submissions (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        assignment_rule_id BIGINT UNSIGNED DEFAULT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        child_id BIGINT UNSIGNED NOT NULL,
        attempt_no INT NOT NULL DEFAULT 1,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        user_phone VARCHAR(20) NOT NULL DEFAULT '',
        user_no VARCHAR(20) NOT NULL DEFAULT '',
        user_display_name VARCHAR(120) NOT NULL DEFAULT '',
        child_name VARCHAR(100) NOT NULL DEFAULT '',
        school VARCHAR(120) NOT NULL DEFAULT '',
        grade_name VARCHAR(50) NOT NULL DEFAULT '',
        class_name VARCHAR(120) NOT NULL DEFAULT '',
        total_score DECIMAL(10,2) DEFAULT NULL,
        answered_count INT NOT NULL DEFAULT 0,
        required_answered_count INT NOT NULL DEFAULT 0,
        user_snapshot_json JSON NOT NULL,
        child_snapshot_json JSON NOT NULL,
        schema_snapshot_json JSON NOT NULL,
        submission_meta_json JSON DEFAULT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_questionnaire_submissions_attempt (questionnaire_id, user_id, child_id, attempt_no),
        KEY idx_questionnaire_submissions_qid_status (questionnaire_id, status),
        KEY idx_questionnaire_submissions_school_grade_class (school, grade_name, class_name),
        KEY idx_questionnaire_submissions_child_name (child_name),
        KEY idx_questionnaire_submissions_submitted_at (submitted_at),
        CONSTRAINT fk_questionnaire_submissions_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_submissions_assignment_rule_id
          FOREIGN KEY (assignment_rule_id) REFERENCES questionnaire_assignment_rules(id) ON DELETE SET NULL,
        CONSTRAINT fk_questionnaire_submissions_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_submissions_child_id
          FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS questionnaire_answers (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        submission_id BIGINT UNSIGNED NOT NULL,
        questionnaire_id BIGINT UNSIGNED NOT NULL,
        question_id BIGINT UNSIGNED DEFAULT NULL,
        section_id BIGINT UNSIGNED DEFAULT NULL,
        question_title VARCHAR(500) NOT NULL DEFAULT '',
        question_type VARCHAR(40) NOT NULL DEFAULT '',
        answer_json JSON NOT NULL,
        answer_text TEXT,
        score DECIMAL(10,2) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_questionnaire_answers_submission_question (submission_id, question_id),
        KEY idx_questionnaire_answers_qid (questionnaire_id),
        CONSTRAINT fk_questionnaire_answers_submission_id
          FOREIGN KEY (submission_id) REFERENCES questionnaire_submissions(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_answers_questionnaire_id
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
        CONSTRAINT fk_questionnaire_answers_question_id
          FOREIGN KEY (question_id) REFERENCES questionnaire_questions(id) ON DELETE SET NULL,
        CONSTRAINT fk_questionnaire_answers_section_id
          FOREIGN KEY (section_id) REFERENCES questionnaire_sections(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS appointment_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        image_url VARCHAR(500) NOT NULL DEFAULT '',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_appointment_items_active_name (active, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS appointment_schedules (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        item_id BIGINT UNSIGNED NOT NULL,
        schedule_date DATE NOT NULL,
        time_slot VARCHAR(50) NOT NULL,
        max_count INT NOT NULL DEFAULT 0,
        booked_count INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_appointment_schedules_item_date (item_id, schedule_date),
        KEY idx_appointment_schedules_active (active),
        CONSTRAINT fk_appointment_schedules_item_id FOREIGN KEY (item_id) REFERENCES appointment_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS appointment_records (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        child_id BIGINT UNSIGNED NOT NULL,
        schedule_id BIGINT UNSIGNED NOT NULL,
        child_name VARCHAR(100) NOT NULL DEFAULT '',
        class_name VARCHAR(120) NOT NULL DEFAULT '',
        item_name VARCHAR(120) NOT NULL DEFAULT '',
        appointment_date DATE NOT NULL,
        time_slot VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_appointment_records_user_id (user_id),
        KEY idx_appointment_records_child_id (child_id),
        KEY idx_appointment_records_schedule_id (schedule_id),
        KEY idx_appointment_records_status (status),
        CONSTRAINT fk_appointment_records_user_id FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_appointment_records_child_id FOREIGN KEY (child_id) REFERENCES children(id),
        CONSTRAINT fk_appointment_records_schedule_id FOREIGN KEY (schedule_id) REFERENCES appointment_schedules(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS checkup_records (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        child_id BIGINT UNSIGNED NOT NULL,
        checkup_date DATE NOT NULL,
        height DECIMAL(10,2) DEFAULT NULL,
        weight DECIMAL(10,2) DEFAULT NULL,
        tongue_shape VARCHAR(50) NOT NULL DEFAULT '',
        tongue_color VARCHAR(50) NOT NULL DEFAULT '',
        tongue_coating VARCHAR(50) NOT NULL DEFAULT '',
        vision_l VARCHAR(20) NOT NULL DEFAULT '',
        vision_r VARCHAR(20) NOT NULL DEFAULT '',
        vision_both VARCHAR(20) NOT NULL DEFAULT '',
        refraction_l_json JSON DEFAULT NULL,
        refraction_r_json JSON DEFAULT NULL,
        diagnosis_json JSON DEFAULT NULL,
        conclusion TEXT,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_checkup_records_child_date (child_id, checkup_date),
        KEY idx_checkup_records_active (active),
        CONSTRAINT fk_checkup_records_child_id FOREIGN KEY (child_id) REFERENCES children(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )
  await ensureColumn(connection, 'checkup_records', 'tongue_shape', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `weight`")
  await ensureColumn(connection, 'checkup_records', 'tongue_color', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `tongue_shape`")
  await ensureColumn(connection, 'checkup_records', 'tongue_coating', "VARCHAR(50) NOT NULL DEFAULT '' AFTER `tongue_color`")

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        visitor_key VARCHAR(120) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_name VARCHAR(120) NOT NULL DEFAULT '',
        page_path VARCHAR(255) NOT NULL DEFAULT '',
        created_at_ms BIGINT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_analytics_events_type_created (event_type, created_at_ms),
        KEY idx_analytics_events_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS analytics_visitors (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        visitor_key VARCHAR(120) NOT NULL,
        last_seen_ms BIGINT NOT NULL DEFAULT 0,
        last_page VARCHAR(255) NOT NULL DEFAULT '',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_analytics_visitors_key (visitor_key),
        KEY idx_analytics_visitors_last_seen (last_seen_ms)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  await runDDL(
    connection,
    `
      CREATE TABLE IF NOT EXISTS uploads (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        biz_type VARCHAR(120) NOT NULL DEFAULT '',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        url VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_uploads_biz_type (biz_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  )

  logger.info('儿童视力管理核心业务表与问卷表初始化完成')
}

module.exports = {
  createCoreTables
}
