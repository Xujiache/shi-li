const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const {
  generateNumericCode,
  normalizePagination,
  safeJsonParse,
  safeJsonStringify,
  toBoolean,
  parseGradeInfo
} = require('../utils/helpers')

const EDITABLE_CHILD_FIELDS = [
  'name',
  'gender',
  'dob',
  'age',
  'school',
  'grade_name',
  'class_name',
  'height',
  'weight',
  'symptoms',
  'symptom_other',
  'additional_note',
  'tongue_shape',
  'tongue_color',
  'tongue_coating',
  'face_color',
  'lip_color',
  'hair',
  'vision_status',
  'vision_r',
  'vision_l',
  'vision_both',
  'refraction_l',
  'refraction_r',
  'refraction_r_detail',
  'refraction_l_detail',
  'curvature_r',
  'curvature_l',
  'axial_length_r',
  'axial_length_l',
  'diagnosis_json',
  'management_plan',
  'optometrist_name',
  'exam_date',
  'tcm_symptoms_json',
  'tcm_symptom_other',
  'tcm_syndrome_types',
  'tcm_syndrome_other',
  'risk_level',
  'treatment_plans',
  'treatment_other',
  'doctor_name',
  'custom_fields_json',
  'avatar_url',
  'avatar_file_id',
  'active'
]

const JSON_CHILD_FIELDS = new Set([
  'symptoms',
  'refraction_r_detail',
  'refraction_l_detail',
  'diagnosis_json',
  'tcm_symptoms_json',
  'tcm_syndrome_types',
  'treatment_plans',
  'custom_fields_json'
])

/**
 * 规范化孩子记录，兼容原小程序字段名。
 * @param {Record<string, any>} row 数据库记录。
 * @returns {Record<string, any>} 规范化孩子对象。
 */
function normalizeChild(row) {
  if (!row) return null
  return {
    _id: String(row.id),
    id: row.id,
    user_id: String(row.user_id),
    child_no: row.child_no || '',
    name: row.name || '',
    gender: row.gender || '',
    dob: row.dob || '',
    age: row.age,
    school: row.school || '',
    grade_name: row.grade_name || '',
    class_name: row.class_name || '',
    parent_phone: row.parent_phone || '',
    height: row.height,
    weight: row.weight,
    symptoms: safeJsonParse(row.symptoms, []),
    symptom_other: row.symptom_other || '',
    additional_note: row.additional_note || '',
    tongue_shape: row.tongue_shape || '',
    tongue_color: row.tongue_color || '',
    tongue_coating: row.tongue_coating || '',
    face_color: row.face_color || '',
    lip_color: row.lip_color || '',
    hair: row.hair || '',
    vision_status: row.vision_status || '',
    vision_r: row.vision_r || '',
    vision_l: row.vision_l || '',
    vision_both: row.vision_both || '',
    refraction_l: row.refraction_l || '',
    refraction_r: row.refraction_r || '',
    refraction_r_detail: safeJsonParse(row.refraction_r_detail, null),
    refraction_l_detail: safeJsonParse(row.refraction_l_detail, null),
    curvature_r: row.curvature_r || '',
    curvature_l: row.curvature_l || '',
    axial_length_r: row.axial_length_r || '',
    axial_length_l: row.axial_length_l || '',
    diagnosis_json: safeJsonParse(row.diagnosis_json, null),
    management_plan: row.management_plan || '',
    optometrist_name: row.optometrist_name || '',
    exam_date: row.exam_date || '',
    tcm_symptoms_json: safeJsonParse(row.tcm_symptoms_json, null),
    tcm_symptom_other: row.tcm_symptom_other || '',
    tcm_syndrome_types: safeJsonParse(row.tcm_syndrome_types, []),
    tcm_syndrome_other: row.tcm_syndrome_other || '',
    risk_level: row.risk_level || '',
    treatment_plans: safeJsonParse(row.treatment_plans, []),
    treatment_other: row.treatment_other || '',
    doctor_name: row.doctor_name || '',
    custom_fields_json: safeJsonParse(row.custom_fields_json, {}),
    avatar_url: row.avatar_url || '',
    avatar_file_id: row.avatar_url || '',
    active: row.active !== 0,
    parent_user_no: row.parent_user_no || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * 生成唯一孩子编号。
 * @returns {Promise<string>} 唯一 8 位数字孩子编号。
 */
async function generateUniqueChildNo() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const next = generateNumericCode(8)
    const existing = await queryOne('SELECT id FROM children WHERE child_no = ? LIMIT 1', [next])
    if (!existing) return next
  }
  throw createAppError('生成孩子编号失败', StatusCodes.INTERNAL_SERVER_ERROR)
}

/**
 * 获取孩子详情。
 * @param {number|string} childId 孩子 ID。
 * @returns {Promise<Record<string, any>|null>} 孩子记录。
 */
async function findChildById(childId) {
  return queryOne('SELECT * FROM children WHERE id = ? LIMIT 1', [childId])
}

/**
 * 校验孩子归属是否属于当前用户。
 * @param {Record<string, any>|null} child 孩子记录。
 * @param {number|string} userId 当前用户 ID。
 * @returns {void}
 */
function ensureChildOwnership(child, userId) {
  if (!child) {
    throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)
  }
  if (Number(child.user_id) !== Number(userId)) {
    throw createAppError('无权限操作该孩子', StatusCodes.FORBIDDEN)
  }
}

/**
 * 根据学校/班级或现有输入推导结构化年级名。
 * @param {string} school 学校名称。
 * @param {string} className 班级名称。
 * @param {string} currentGradeName 当前传入的年级名。
 * @returns {Promise<string>} 结构化年级名。
 */
async function resolveGradeName(school, className, currentGradeName) {
  const manualGrade = String(currentGradeName || '').trim()
  if (manualGrade) return manualGrade

  const safeSchool = String(school || '').trim()
  const safeClassName = String(className || '').trim()
  if (safeSchool && safeClassName) {
    const schoolClass = await queryOne(
      'SELECT grade_name FROM school_classes WHERE school = ? AND class_name = ? LIMIT 1',
      [safeSchool, safeClassName]
    )
    if (schoolClass && schoolClass.grade_name) {
      return String(schoolClass.grade_name).trim()
    }
  }

  const gradeInfo = parseGradeInfo(safeClassName)
  return gradeInfo.grade_name || ''
}

/**
 * 将孩子表单数据规范化为数据库字段。
 * @param {Record<string, any>} payload 原始表单数据。
 * @param {string} parentPhone 家长手机号。
 * @returns {Promise<Record<string, any>>} 可写入的数据库字段。
 */
async function normalizeChildPayload(payload, parentPhone) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const next = {
    parent_phone: parentPhone || ''
  }

  if (!source.name || !String(source.name).trim()) {
    throw createAppError('孩子姓名不能为空', StatusCodes.BAD_REQUEST)
  }

  for (const field of EDITABLE_CHILD_FIELDS) {
    if (source[field] === undefined) continue

    switch (field) {
      case 'age':
        next.age = source.age === '' || source.age === null ? null : Number(source.age)
        break
      case 'height':
        next.height = source.height === '' || source.height === null ? null : Number(source.height)
        break
      case 'weight':
        next.weight = source.weight === '' || source.weight === null ? null : Number(source.weight)
        break
      case 'avatar_file_id':
        next.avatar_url = String(source.avatar_file_id || '').trim()
        break
      case 'active':
        next.active = toBoolean(source.active, true) ? 1 : 0
        break
      default:
        if (JSON_CHILD_FIELDS.has(field)) {
          const raw = source[field]
          if (typeof raw === 'string') {
            next[field] = raw
          } else {
            next[field] = safeJsonStringify(raw != null ? raw : null)
          }
        } else {
          next[field] = String(source[field] ?? '').trim()
        }
        break
    }
  }

  if (!next.name || !String(next.name).trim()) {
    next.name = String(source.name || '').trim()
  }

  next.grade_name = await resolveGradeName(
    next.school || source.school || '',
    next.class_name || source.class_name || '',
    next.grade_name || source.grade_name || ''
  )

  return next
}

/**
 * 获取当前用户的孩子列表。
 * @param {number|string} userId 用户 ID。
 * @returns {Promise<Array<Record<string, any>>>} 孩子列表。
 */
async function listChildrenByUser(userId) {
  const rows = await query('SELECT * FROM children WHERE user_id = ? ORDER BY updated_at DESC', [userId])
  return rows.map(normalizeChild)
}

/**
 * 获取当前用户的学校班级可选项。
 * @returns {Promise<{schools: Array<string>, classes_map: Record<string, Array<string>>}>} 学校班级选项。
 */
async function getSchoolOptions() {
  const rows = await query(
    'SELECT school, class_name FROM school_classes WHERE active = 1 ORDER BY school ASC, class_name ASC'
  )
  const classesMap = {}
  for (const row of rows) {
    if (!classesMap[row.school]) classesMap[row.school] = []
    classesMap[row.school].push(row.class_name)
  }
  return {
    schools: Object.keys(classesMap),
    classes_map: classesMap
  }
}

/**
 * 创建孩子档案。
 * @param {number|string} userId 用户 ID。
 * @param {string} parentPhone 家长手机号。
 * @param {Record<string, any>} payload 表单数据。
 * @returns {Promise<Record<string, any>>} 新建后的孩子对象。
 */
async function createChild(userId, parentPhone, payload) {
  const childNo = await generateUniqueChildNo()
  const next = await normalizeChildPayload(payload, parentPhone)

  const result = await execute(
    `
      INSERT INTO children (
        user_id, child_no, name, gender, dob, age, school, grade_name, class_name, parent_phone,
        height, weight, symptoms, symptom_other, additional_note, tongue_shape, tongue_color,
        tongue_coating, face_color, lip_color, hair, vision_status,
        vision_r, vision_l, vision_both,
        refraction_l, refraction_r, refraction_r_detail, refraction_l_detail,
        curvature_r, curvature_l, axial_length_r, axial_length_l,
        diagnosis_json, management_plan, optometrist_name, exam_date,
        tcm_symptoms_json, tcm_symptom_other, tcm_syndrome_types, tcm_syndrome_other,
        risk_level, treatment_plans, treatment_other, doctor_name,
        custom_fields_json, avatar_url, active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      childNo,
      next.name || '',
      next.gender || '',
      next.dob || '',
      next.age ?? null,
      next.school || '',
      next.grade_name || '',
      next.class_name || '',
      next.parent_phone || '',
      next.height ?? null,
      next.weight ?? null,
      next.symptoms || safeJsonStringify([]),
      next.symptom_other || '',
      next.additional_note || '',
      next.tongue_shape || '',
      next.tongue_color || '',
      next.tongue_coating || '',
      next.face_color || '',
      next.lip_color || '',
      next.hair || '',
      next.vision_status || '',
      next.vision_r || '',
      next.vision_l || '',
      next.vision_both || '',
      next.refraction_l || '',
      next.refraction_r || '',
      next.refraction_r_detail || null,
      next.refraction_l_detail || null,
      next.curvature_r || '',
      next.curvature_l || '',
      next.axial_length_r || '',
      next.axial_length_l || '',
      next.diagnosis_json || null,
      next.management_plan || '',
      next.optometrist_name || '',
      next.exam_date || '',
      next.tcm_symptoms_json || null,
      next.tcm_symptom_other || '',
      next.tcm_syndrome_types || null,
      next.tcm_syndrome_other || '',
      next.risk_level || '',
      next.treatment_plans || null,
      next.treatment_other || '',
      next.doctor_name || '',
      next.custom_fields_json || null,
      next.avatar_url || '',
      next.active === undefined ? 1 : next.active
    ]
  )

  const created = await findChildById(result.insertId)
  return normalizeChild(created)
}

/**
 * 更新孩子档案。
 * @param {number|string} userId 用户 ID。
 * @param {number|string} childId 孩子 ID。
 * @param {string} parentPhone 家长手机号。
 * @param {Record<string, any>} payload 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的孩子对象。
 */
async function updateChild(userId, childId, parentPhone, payload) {
  const current = await findChildById(childId)
  ensureChildOwnership(current, userId)
  const next = await normalizeChildPayload({ ...current, ...payload }, parentPhone)

  await execute(
    `
      UPDATE children
      SET name = ?, gender = ?, dob = ?, age = ?, school = ?, grade_name = ?, class_name = ?, parent_phone = ?,
          height = ?, weight = ?, symptoms = ?, symptom_other = ?, additional_note = ?,
          tongue_shape = ?, tongue_color = ?, tongue_coating = ?, face_color = ?, lip_color = ?,
          hair = ?, vision_status = ?,
          vision_r = ?, vision_l = ?, vision_both = ?,
          refraction_l = ?, refraction_r = ?, refraction_r_detail = ?, refraction_l_detail = ?,
          curvature_r = ?, curvature_l = ?, axial_length_r = ?, axial_length_l = ?,
          diagnosis_json = ?, management_plan = ?, optometrist_name = ?, exam_date = ?,
          tcm_symptoms_json = ?, tcm_symptom_other = ?, tcm_syndrome_types = ?, tcm_syndrome_other = ?,
          risk_level = ?, treatment_plans = ?, treatment_other = ?, doctor_name = ?,
          custom_fields_json = ?, avatar_url = ?, active = ?,
          updated_at = NOW()
      WHERE id = ?
    `,
    [
      next.name || '',
      next.gender || '',
      next.dob || '',
      next.age ?? null,
      next.school || '',
      next.grade_name || '',
      next.class_name || '',
      next.parent_phone || '',
      next.height ?? null,
      next.weight ?? null,
      next.symptoms || safeJsonStringify([]),
      next.symptom_other || '',
      next.additional_note || '',
      next.tongue_shape || '',
      next.tongue_color || '',
      next.tongue_coating || '',
      next.face_color || '',
      next.lip_color || '',
      next.hair || '',
      next.vision_status || '',
      next.vision_r || '',
      next.vision_l || '',
      next.vision_both || '',
      next.refraction_l || '',
      next.refraction_r || '',
      next.refraction_r_detail || null,
      next.refraction_l_detail || null,
      next.curvature_r || '',
      next.curvature_l || '',
      next.axial_length_r || '',
      next.axial_length_l || '',
      next.diagnosis_json || null,
      next.management_plan || '',
      next.optometrist_name || '',
      next.exam_date || '',
      next.tcm_symptoms_json || null,
      next.tcm_symptom_other || '',
      next.tcm_syndrome_types || null,
      next.tcm_syndrome_other || '',
      next.risk_level || '',
      next.treatment_plans || null,
      next.treatment_other || '',
      next.doctor_name || '',
      next.custom_fields_json || null,
      next.avatar_url || '',
      next.active === undefined ? 1 : next.active,
      childId
    ]
  )

  const updated = await findChildById(childId)
  return normalizeChild(updated)
}

/**
 * 删除孩子档案。
 * @param {number|string} userId 用户 ID。
 * @param {number|string} childId 孩子 ID。
 * @returns {Promise<void>}
 */
async function deleteChild(userId, childId) {
  const current = await findChildById(childId)
  ensureChildOwnership(current, userId)
  await execute('DELETE FROM children WHERE id = ?', [childId])
}

/**
 * 获取后台孩子列表。
 * @param {{q?: string, school?: string, grade_name?: string, class_name?: string, page?: unknown, page_size?: unknown}} params 查询参数。
 * @returns {Promise<{list: Array<Record<string, any>>, total: number, page: number, page_size: number}>} 分页结果。
 */
async function listChildrenForAdmin(params) {
  const { page, pageSize, offset } = normalizePagination(params.page, params.page_size)
  const conditions = []
  const values = []

  if (params.q) {
    conditions.push('(c.name LIKE ? OR c.parent_phone LIKE ? OR c.child_no LIKE ? OR u.user_no LIKE ?)')
    values.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
  }
  if (params.school) {
    conditions.push('c.school = ?')
    values.push(params.school)
  }
  if (params.grade_name) {
    conditions.push('c.grade_name = ?')
    values.push(params.grade_name)
  }
  if (params.class_name) {
    conditions.push('c.class_name = ?')
    values.push(params.class_name)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await queryOne(
    `
      SELECT COUNT(*) AS total
      FROM children c
      LEFT JOIN users u ON u.id = c.user_id
      ${whereClause}
    `,
    values
  )
  const rows = await query(
    `
      SELECT c.*, u.user_no AS parent_user_no
      FROM children c
      LEFT JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    values
  )

  return {
    list: rows.map(normalizeChild),
    total: totalRow ? Number(totalRow.total) : 0,
    page,
    page_size: pageSize
  }
}

/**
 * 获取后台孩子详情。
 * @param {number|string} childId 孩子 ID。
 * @returns {Promise<Record<string, any>>} 详情对象。
 */
async function getAdminChildDetail(childId) {
  const row = await queryOne(
    `
      SELECT c.*, u.user_no AS parent_user_no
      FROM children c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [childId]
  )
  if (!row) {
    throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)
  }
  return normalizeChild(row)
}

/**
 * 由后台创建孩子。
 * @param {{user_id?: number|string, parent_phone?: string, [key: string]: any}} payload 创建参数。
 * @returns {Promise<Record<string, any>>} 新建后的孩子对象。
 */
async function createChildByAdmin(payload) {
  let userId = payload.user_id ? Number(payload.user_id) : null
  let parentPhone = payload.parent_phone ? String(payload.parent_phone).trim() : ''

  if (!userId && parentPhone) {
    const user = await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [parentPhone])
    userId = user ? Number(user.id) : null
  }

  if (!userId) {
    throw createAppError('缺少用户 ID 或家长手机号', StatusCodes.BAD_REQUEST)
  }

  return createChild(userId, parentPhone, payload)
}

/**
 * 由后台更新孩子。
 * @param {number|string} childId 孩子 ID。
 * @param {Record<string, any>} patch 更新字段。
 * @returns {Promise<Record<string, any>>} 更新后的孩子对象。
 */
async function updateChildByAdmin(childId, patch) {
  const current = await findChildById(childId)
  if (!current) {
    throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)
  }
  return updateChild(current.user_id, childId, patch.parent_phone || current.parent_phone || '', {
    ...current,
    ...patch
  })
}

/**
 * 由后台删除孩子。
 * @param {number|string} childId 孩子 ID。
 * @returns {Promise<void>}
 */
async function deleteChildByAdmin(childId) {
  const current = await findChildById(childId)
  if (!current) {
    throw createAppError('孩子不存在', StatusCodes.NOT_FOUND)
  }
  await execute('DELETE FROM children WHERE id = ?', [childId])
}

module.exports = {
  normalizeChild,
  findChildById,
  ensureChildOwnership,
  listChildrenByUser,
  getSchoolOptions,
  createChild,
  updateChild,
  deleteChild,
  listChildrenForAdmin,
  getAdminChildDetail,
  createChildByAdmin,
  updateChildByAdmin,
  deleteChildByAdmin
}
