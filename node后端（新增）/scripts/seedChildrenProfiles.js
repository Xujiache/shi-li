/**
 * 孩子档案 seed
 * 幂等：补齐家长用户、孩子档案、对应的检测记录
 * 运行：node scripts/seedChildrenProfiles.js  或  npm run seed:children
 */
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== '1') {
  console.error('[SEED] 拒绝在生产环境运行测试 seed。')
  process.exit(1)
}

const { query, execute, queryOne } = require('../utils/db')
const logger = require('../utils/logger')
const { hashPassword } = require('../utils/bcrypt')
const { safeJsonStringify } = require('../utils/helpers')

const PARENT_PASSWORD = '123456'

function pad(n, w = 2) { return String(n).padStart(w, '0') }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function ensureParentUser({ phone, displayName, userNo }) {
  const existing = await queryOne('SELECT id FROM users WHERE phone = ?', [phone])
  if (existing) return existing.id
  const hash = await hashPassword(PARENT_PASSWORD)
  const result = await execute(
    `INSERT INTO users
       (phone, password_hash, display_name, avatar_url, user_no, is_admin, active, deleted, last_login_at)
     VALUES (?, ?, ?, '', ?, 0, 1, 0, NOW())`,
    [phone, hash, displayName, userNo]
  )
  return result.insertId
}

async function ensureChild(spec) {
  const existing = await queryOne('SELECT id FROM children WHERE child_no = ?', [spec.child_no])
  const fields = [
    'user_id', 'child_no', 'name', 'gender', 'dob', 'age', 'school', 'grade_name', 'class_name', 'parent_phone',
    'height', 'weight', 'symptoms', 'symptom_other', 'additional_note',
    'tongue_shape', 'tongue_color', 'tongue_coating', 'face_color', 'lip_color', 'hair',
    'vision_status', 'vision_r', 'vision_l', 'vision_both',
    'refraction_l', 'refraction_r', 'refraction_l_detail', 'refraction_r_detail',
    'curvature_l', 'curvature_r', 'axial_length_l', 'axial_length_r',
    'diagnosis_json', 'management_plan', 'optometrist_name', 'exam_date',
    'tcm_symptoms_json', 'tcm_symptom_other', 'tcm_syndrome_types', 'tcm_syndrome_other',
    'risk_level', 'treatment_plans', 'treatment_other', 'doctor_name', 'avatar_url', 'active'
  ]
  const values = [
    spec.user_id, spec.child_no, spec.name, spec.gender, spec.dob, spec.age,
    spec.school, spec.grade_name, spec.class_name, spec.parent_phone,
    spec.height, spec.weight, safeJsonStringify(spec.symptoms || []), spec.symptom_other || '', spec.additional_note || '',
    spec.tongue_shape, spec.tongue_color, spec.tongue_coating, spec.face_color, spec.lip_color, spec.hair,
    spec.vision_status, spec.vision_r, spec.vision_l, spec.vision_both,
    spec.refraction_l, spec.refraction_r, safeJsonStringify(spec.refraction_l_detail || null), safeJsonStringify(spec.refraction_r_detail || null),
    spec.curvature_l || '', spec.curvature_r || '', spec.axial_length_l || '', spec.axial_length_r || '',
    safeJsonStringify(spec.diagnosis_json || null), spec.management_plan || '', spec.optometrist_name || '', spec.exam_date || '',
    safeJsonStringify(spec.tcm_symptoms_json || null), spec.tcm_symptom_other || '', safeJsonStringify(spec.tcm_syndrome_types || null), spec.tcm_syndrome_other || '',
    spec.risk_level || '', safeJsonStringify(spec.treatment_plans || null), spec.treatment_other || '', spec.doctor_name || '',
    spec.avatar_url || '', 1
  ]
  if (existing) {
    const setClause = fields.map(f => `${f} = ?`).join(', ')
    await execute(`UPDATE children SET ${setClause} WHERE id = ?`, [...values, existing.id])
    return existing.id
  }
  const placeholders = fields.map(() => '?').join(', ')
  const result = await execute(
    `INSERT INTO children (${fields.join(', ')}) VALUES (${placeholders})`,
    values
  )
  return result.insertId
}

async function ensureChildDeptAssignment(childId, deptId) {
  const found = await queryOne(
    'SELECT id FROM child_dept_assignments WHERE child_id = ? AND department_id = ?',
    [childId, deptId]
  )
  if (found) return found.id
  const result = await execute(
    'INSERT INTO child_dept_assignments (child_id, department_id, assigned_by) VALUES (?, ?, NULL)',
    [childId, deptId]
  )
  return result.insertId
}

async function ensureDeptFieldGrants(deptId, sectionKeys) {
  for (const key of sectionKeys) {
    const found = await queryOne(
      'SELECT id FROM dept_field_grants WHERE department_id = ? AND section_key = ?',
      [deptId, key]
    )
    if (found) continue
    await execute(
      'INSERT INTO dept_field_grants (department_id, section_key) VALUES (?, ?)',
      [deptId, key]
    )
  }
}

async function ensureCheckup(spec) {
  // 用 (child_id + checkup_date) 当近似键去重
  const found = await queryOne(
    'SELECT id FROM checkup_records WHERE child_id = ? AND checkup_date = ?',
    [spec.child_id, spec.checkup_date]
  )
  if (found) return found.id
  const result = await execute(
    `INSERT INTO checkup_records
       (child_id, checkup_date, height, weight, vision_l, vision_r, vision_both,
        refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      spec.child_id, spec.checkup_date, spec.height, spec.weight,
      spec.vision_l, spec.vision_r, spec.vision_both,
      safeJsonStringify(spec.refraction_l_json || null),
      safeJsonStringify(spec.refraction_r_json || null),
      safeJsonStringify(spec.diagnosis_json || null),
      spec.conclusion || ''
    ]
  )
  return result.insertId
}

async function main() {
  try {
    logger.info('开始 seed 孩子档案...')

    // ===== 父母用户 =====
    const parent1 = await queryOne('SELECT id FROM users WHERE phone = ?', ['13900139000'])
    if (!parent1) throw new Error('原始家长 13900139000 不存在，请先跑 seed:full')
    const parent1Id = parent1.id

    const parent2Id = await ensureParentUser({
      phone: '13900139001', displayName: '王大伟爸爸', userNo: '10000003'
    })
    const parent3Id = await ensureParentUser({
      phone: '13900139002', displayName: '赵晓燕妈妈', userNo: '10000004'
    })
    logger.info(`家长: 李明妈妈=${parent1Id}, 王大伟爸爸=${parent2Id}, 赵晓燕妈妈=${parent3Id}`)

    // ===== 孩子档案 =====
    // ① 张三的妹妹（同家长）：4 岁幼儿园，视力正常，TCM 偏燥
    const child2 = await ensureChild({
      child_no: '20000002', user_id: parent1Id,
      name: '张小妹', gender: '女', dob: '2022-03-12', age: 4,
      school: '天堂幼儿园', grade_name: '中班', class_name: '小2班',
      parent_phone: '13900139000',
      height: 105.50, weight: 17.20,
      symptoms: ['揉眼睛'], symptom_other: '', additional_note: '幼儿园定期检查，平时户外活动多。',
      tongue_shape: '正常', tongue_color: '淡红', tongue_coating: '薄白',
      face_color: '红润', lip_color: '红润', hair: '正常',
      vision_status: '正常',
      vision_r: '5.0', vision_l: '5.0', vision_both: '5.0',
      refraction_r: '+0.50', refraction_l: '+0.50',
      refraction_r_detail: { s: '+0.50', c: '0.00', a: '0' },
      refraction_l_detail: { s: '+0.50', c: '0.00', a: '0' },
      curvature_r: '43.50', curvature_l: '43.25',
      axial_length_r: '21.50', axial_length_l: '21.40',
      diagnosis_json: { vision_status: '正常', refraction_status: '正常', axis_status: '正常', cornea_status: '正常' },
      management_plan: '保持户外活动 2h/天，6 个月后复查。',
      optometrist_name: '陈医生', exam_date: '2026-04-15',
      tcm_symptoms_json: ['眼干'], tcm_symptom_other: '',
      tcm_syndrome_types: ['肝肾不足型'], tcm_syndrome_other: '',
      risk_level: '低风险',
      treatment_plans: ['行为干预'], treatment_other: '',
      doctor_name: '王医生'
    })

    // ② 王大伟（10 岁，四年级，已有近视，要重点关注）
    const child3 = await ensureChild({
      child_no: '20000003', user_id: parent2Id,
      name: '王大伟', gender: '男', dob: '2016-07-22', age: 10,
      school: '红旗小学', grade_name: '四年级', class_name: '四年三班',
      parent_phone: '13900139001',
      height: 142.00, weight: 36.50,
      symptoms: ['看远处模糊', '眯眼看东西', '眼疲劳'], symptom_other: '',
      additional_note: '每日用眼时间 5-6 小时，户外活动较少。',
      tongue_shape: '胖大', tongue_color: '淡白', tongue_coating: '白腻',
      face_color: '萎黄', lip_color: '淡白', hair: '稀疏',
      vision_status: '近视',
      vision_r: '4.7', vision_l: '4.6', vision_both: '4.6',
      refraction_r: '-2.25', refraction_l: '-2.50',
      refraction_r_detail: { s: '-2.25', c: '-0.50', a: '180' },
      refraction_l_detail: { s: '-2.50', c: '-0.75', a: '175' },
      curvature_r: '44.00', curvature_l: '44.25',
      axial_length_r: '24.50', axial_length_l: '24.70',
      diagnosis_json: { vision_status: '不正常', refraction_status: '中度近视', axis_status: '偏长', cornea_status: '正常' },
      management_plan: '配戴框架眼镜，建议低浓度阿托品眼药水；每天户外 2h，控制近距离用眼。3 个月复查。',
      optometrist_name: '李医生', exam_date: '2026-04-20',
      tcm_symptoms_json: ['眼疲劳', '眼涩', '注意力不集中'], tcm_symptom_other: '',
      tcm_syndrome_types: ['脾虚气弱型'], tcm_syndrome_other: '',
      risk_level: '高风险',
      treatment_plans: ['框架眼镜', '行为干预', '中医调理'], treatment_other: '低浓度阿托品',
      doctor_name: '王医生'
    })

    // ③ 王大伟的姐姐 - 王小琳（12 岁初一）
    const child4 = await ensureChild({
      child_no: '20000004', user_id: parent2Id,
      name: '王小琳', gender: '女', dob: '2014-05-08', age: 12,
      school: '红旗中学', grade_name: '初一', class_name: '七年一班',
      parent_phone: '13900139001',
      height: 158.00, weight: 45.00,
      symptoms: ['看远处模糊'], symptom_other: '', additional_note: '已戴镜 1 年，本次复查。',
      tongue_shape: '正常', tongue_color: '淡红', tongue_coating: '薄白',
      face_color: '红润', lip_color: '红润', hair: '正常',
      vision_status: '近视',
      vision_r: '4.8', vision_l: '4.8', vision_both: '4.8',
      refraction_r: '-1.50', refraction_l: '-1.50',
      refraction_r_detail: { s: '-1.50', c: '-0.25', a: '180' },
      refraction_l_detail: { s: '-1.50', c: '-0.25', a: '170' },
      curvature_r: '43.75', curvature_l: '43.75',
      axial_length_r: '23.80', axial_length_l: '23.85',
      diagnosis_json: { vision_status: '不正常', refraction_status: '轻度近视', axis_status: '正常', cornea_status: '正常' },
      management_plan: '继续戴镜，每日户外 2h，半年复查。',
      optometrist_name: '李医生', exam_date: '2026-04-20',
      tcm_symptoms_json: [], tcm_symptom_other: '',
      tcm_syndrome_types: [], tcm_syndrome_other: '',
      risk_level: '中风险',
      treatment_plans: ['框架眼镜', '行为干预'], treatment_other: '',
      doctor_name: ''
    })

    // ④ 赵雨涵（9 岁三年级，假性近视，可逆）
    const child5 = await ensureChild({
      child_no: '20000005', user_id: parent3Id,
      name: '赵雨涵', gender: '女', dob: '2017-09-30', age: 9,
      school: '阳光小学', grade_name: '三年级', class_name: '三年二班',
      parent_phone: '13900139002',
      height: 132.00, weight: 28.50,
      symptoms: ['眼疲劳', '看书时间长后头疼'], symptom_other: '',
      additional_note: '阅读量大，散瞳后查为假性近视。',
      tongue_shape: '正常', tongue_color: '淡红', tongue_coating: '薄白',
      face_color: '红润', lip_color: '红润', hair: '正常',
      vision_status: '假性近视',
      vision_r: '4.9', vision_l: '4.9', vision_both: '4.9',
      refraction_r: '-0.50', refraction_l: '-0.50',
      refraction_r_detail: { s: '-0.50', c: '0.00', a: '0' },
      refraction_l_detail: { s: '-0.50', c: '0.00', a: '0' },
      curvature_r: '43.25', curvature_l: '43.25',
      axial_length_r: '23.00', axial_length_l: '23.05',
      diagnosis_json: { vision_status: '不正常', refraction_status: '假性近视', axis_status: '正常', cornea_status: '正常' },
      management_plan: '减少近距离用眼，每天户外 2h，1 个月后复查；不需配镜。',
      optometrist_name: '陈医生', exam_date: '2026-04-22',
      tcm_symptoms_json: ['眼疲劳', '眼酸'], tcm_symptom_other: '',
      tcm_syndrome_types: ['肝肾不足型'], tcm_syndrome_other: '',
      risk_level: '中风险',
      treatment_plans: ['行为干预', '中医调理'], treatment_other: '热敷',
      doctor_name: '李医生'
    })

    logger.info(`孩子: 共新增/更新 4 条 (child_no 20000002 ~ 20000005)`)

    // ===== 部门归属 child_dept_assignments：员工 App 才能看见 =====
    const existingChild1 = await queryOne('SELECT id FROM children WHERE child_no = ?', ['20000001'])
    const child1Id = existingChild1 ? existingChild1.id : null
    const SECTION_KEYS = ['vision', 'diagnosis', 'tcm']
    const DEPT_DEFAULT = 1
    const DEPT_TIANTANG = 2
    const DEPT_CHENXI = 3

    // 全部孩子分到默认部门（员工 13700137000 在这个部门，能看见）
    const allChildIds = [child1Id, child2, child3, child4, child5].filter(Boolean)
    for (const cid of allChildIds) {
      await ensureChildDeptAssignment(cid, DEPT_DEFAULT)
    }
    // 王大伟 / 王小琳 同时分到「天堂校区」演示多部门归属
    await ensureChildDeptAssignment(child3, DEPT_TIANTANG)
    await ensureChildDeptAssignment(child4, DEPT_TIANTANG)
    // 赵雨涵 单独分给「晨曦校区」（员工李海洋 在天堂；测试员工在默认部门 → 晨曦员工才能看到她）
    // 这里仍同时保留默认部门的归属，便于测试员工能看见
    await ensureChildDeptAssignment(child5, DEPT_CHENXI)

    // 三个部门都开通 vision/diagnosis/tcm 三组字段授权（保证员工能编辑 + 写分析）
    for (const did of [DEPT_DEFAULT, DEPT_TIANTANG, DEPT_CHENXI]) {
      await ensureDeptFieldGrants(did, SECTION_KEYS)
    }
    logger.info(`部门归属: 默认部门 ${allChildIds.length} 个孩子 + 天堂校区 2 个 + 晨曦校区 1 个`)
    logger.info(`字段授权: 3 个部门 × ${SECTION_KEYS.length} 组 (${SECTION_KEYS.join('/')})`)

    // ===== 检测记录（给王大伟一条近期复查 + 赵雨涵一条；张小妹和王小琳留作"无近期检测") =====
    await ensureCheckup({
      child_id: child3, checkup_date: '2026-01-10', height: 140.00, weight: 35.00,
      vision_l: '4.7', vision_r: '4.7', vision_both: '4.7',
      refraction_l_json: { s: '-2.00', c: '-0.50', a: '175' },
      refraction_r_json: { s: '-1.75', c: '-0.50', a: '180' },
      diagnosis_json: { vision_status: '不正常', refraction_status: '轻度近视', axis_status: '偏长', cornea_status: '正常' },
      conclusion: '近视进展中，建议配戴矫正眼镜。'
    })
    await ensureCheckup({
      child_id: child3, checkup_date: '2026-04-20', height: 142.00, weight: 36.50,
      vision_l: '4.6', vision_r: '4.7', vision_both: '4.6',
      refraction_l_json: { s: '-2.50', c: '-0.75', a: '175' },
      refraction_r_json: { s: '-2.25', c: '-0.50', a: '180' },
      diagnosis_json: { vision_status: '不正常', refraction_status: '中度近视', axis_status: '偏长', cornea_status: '正常' },
      conclusion: '近视加重至中度，开始低浓度阿托品干预。'
    })
    await ensureCheckup({
      child_id: child4, checkup_date: '2026-04-20', height: 158.00, weight: 45.00,
      vision_l: '4.8', vision_r: '4.8', vision_both: '4.8',
      refraction_l_json: { s: '-1.50', c: '-0.25', a: '170' },
      refraction_r_json: { s: '-1.50', c: '-0.25', a: '180' },
      diagnosis_json: { vision_status: '不正常', refraction_status: '轻度近视', axis_status: '正常', cornea_status: '正常' },
      conclusion: '度数稳定，继续戴镜观察。'
    })
    await ensureCheckup({
      child_id: child5, checkup_date: '2026-04-22', height: 132.00, weight: 28.50,
      vision_l: '4.9', vision_r: '4.9', vision_both: '4.9',
      refraction_l_json: { s: '-0.50', c: '0.00', a: '0' },
      refraction_r_json: { s: '-0.50', c: '0.00', a: '0' },
      diagnosis_json: { vision_status: '不正常', refraction_status: '假性近视', axis_status: '正常', cornea_status: '正常' },
      conclusion: '散瞳后散光消失，确诊假性近视，行为干预即可。'
    })
    logger.info('检测记录: 共补 4 条')

    logger.info('')
    logger.info('===== 孩子档案 seed 完成 =====')
    logger.info(`【小程序】李明妈妈   13900139000 / 123456 → 张三 + 张小妹`)
    logger.info(`【小程序】王大伟爸爸 13900139001 / 123456 → 王大伟 + 王小琳`)
    logger.info(`【小程序】赵晓燕妈妈 13900139002 / 123456 → 赵雨涵`)
    logger.info('================================')
    process.exit(0)
  } catch (error) {
    logger.error(`孩子档案 seed 失败: ${error.message}`)
    logger.error(error.stack)
    process.exit(1)
  }
}

main()
