const { query, execute, queryOne } = require('../utils/db')
const logger = require('../utils/logger')
const { hashPassword } = require('../utils/bcrypt')
const { safeJsonStringify } = require('../utils/helpers')

async function seedAdmins() {
  const superHash = await hashPassword('Admin@123456')
  const normalHash = await hashPassword('Admin@654321')

  await execute(`
    INSERT INTO admins (phone, password_hash, display_name, role, active) VALUES
    ('13800138000', ?, '超级管理员', 'super_admin', 1),
    ('13800138001', ?, '运营管理员', 'admin', 1)
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), display_name = VALUES(display_name), role = VALUES(role)
  `, [superHash, normalHash])

  logger.info('管理员账号创建完成')
}

async function seedMobileUser() {
  const userHash = await hashPassword('123456')

  await execute(`
    INSERT INTO users (phone, password_hash, display_name, avatar_url, user_no, is_admin, active, deleted, last_login_at)
    VALUES ('13900139000', ?, '李明妈妈', '', '10000002', 0, 1, 0, NOW())
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), display_name = VALUES(display_name)
  `, [userHash])

  const user = await queryOne('SELECT id FROM users WHERE phone = ?', ['13900139000'])
  if (!user) return

  const existingKids = await query('SELECT id FROM children WHERE user_id = ?', [user.id])
  if (existingKids && existingKids.length >= 2) {
    logger.info('小程序用户孩子数据已存在，跳过')
    return user.id
  }

  if (!existingKids || existingKids.length === 0) {
    await execute(`
      INSERT INTO children (
        user_id, child_no, name, gender, dob, age, school, grade_name, class_name, parent_phone,
        height, weight, symptoms, symptom_other, additional_note,
        tongue_shape, tongue_color, tongue_coating, face_color, lip_color, hair,
        vision_status, refraction_l, refraction_r, avatar_url, active
      ) VALUES
      (?, '20000001', '李明', '男', '2018-06-15', 8, '天堂小学', '二年级', '二年一班', '13900139000',
       130.00, 28.00, ?, '', '每天户外活动约1小时，偶尔使用平板看动画。',
       '正常', '淡红', '薄白', '红润', '红润', '正常',
       '4.8-4.6', '-1.00', '-0.75', '', 1),
      (?, '20000002', '李小花', '女', '2020-09-20', 6, '晨曦小学', '一年级', '一年二班', '13900139000',
       118.00, 22.50, ?, '', '刚入学，视力正常，定期检查预防。',
       '正常', '淡红', '薄白', '红润', '红润', '正常',
       '5.0-5.0', '0.00', '0.00', '', 1)
    `, [
      user.id, safeJsonStringify(['看远处模糊', '眼疲劳']),
      user.id, safeJsonStringify([])
    ])
  }

  logger.info('小程序用户和孩子档案创建完成')
  return user.id
}

async function seedCheckupRecords() {
  const children = await query('SELECT id, name FROM children ORDER BY id ASC')
  if (!children || children.length === 0) return

  const child1 = children[0]
  const child2 = children.length > 1 ? children[1] : null

  const c1Count = await queryOne('SELECT COUNT(*) AS total FROM checkup_records WHERE child_id = ?', [child1.id])
  if (c1Count && Number(c1Count.total) >= 4) {
    logger.info('检测记录已存在，跳过')
    return
  }

  await execute('DELETE FROM checkup_records WHERE child_id = ?', [child1.id])
  await execute(`
    INSERT INTO checkup_records (
      child_id, checkup_date, height, weight, vision_l, vision_r, vision_both,
      refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active
    ) VALUES
    (?, '2025-09-10', 125.00, 25.50, '4.9', '5.0', '5.0',
     ?, ?, ?, '入学体检视力正常。', 1),
    (?, '2026-01-05', 127.00, 26.50, '4.8', '4.8', '4.8',
     ?, ?, ?, '右眼视力略有下降，需注意用眼习惯。建议减少电子屏幕使用时间。', 1),
    (?, '2026-03-15', 129.00, 27.20, '4.7', '4.6', '4.7',
     ?, ?, ?, '双眼视力进一步下降，建议每天增加2小时户外活动，控制近距离用眼在30分钟以内。', 1),
    (?, '2026-04-10', 130.00, 28.00, '4.8', '4.7', '4.8',
     ?, ?, ?, '视力有所恢复，户外活动增加效果明显。继续保持良好习惯。', 1)
  `, [
    child1.id,
    safeJsonStringify({ s: '-0.25', c: '0.00', a: '0' }),
    safeJsonStringify({ s: '0.00', c: '0.00', a: '0' }),
    safeJsonStringify({ vision_status: '正常', refraction_status: '正常', axis_status: '正常', cornea_status: '正常' }),
    child1.id,
    safeJsonStringify({ s: '-0.75', c: '-0.25', a: '180' }),
    safeJsonStringify({ s: '-0.50', c: '-0.25', a: '175' }),
    safeJsonStringify({ vision_status: '不正常', refraction_status: '不正常', axis_status: '正常', cornea_status: '正常' }),
    child1.id,
    safeJsonStringify({ s: '-1.00', c: '-0.25', a: '180' }),
    safeJsonStringify({ s: '-0.75', c: '-0.50', a: '175' }),
    safeJsonStringify({ vision_status: '不正常', refraction_status: '不正常', axis_status: '正常', cornea_status: '正常' }),
    child1.id,
    safeJsonStringify({ s: '-0.75', c: '-0.25', a: '180' }),
    safeJsonStringify({ s: '-0.50', c: '-0.25', a: '175' }),
    safeJsonStringify({ vision_status: '不正常', refraction_status: '轻度', axis_status: '正常', cornea_status: '正常' })
  ])

  if (child2) {
    await execute('DELETE FROM checkup_records WHERE child_id = ?', [child2.id])
    await execute(`
      INSERT INTO checkup_records (
        child_id, checkup_date, height, weight, vision_l, vision_r, vision_both,
        refraction_l_json, refraction_r_json, diagnosis_json, conclusion, active
      ) VALUES
      (?, '2026-03-01', 117.00, 22.00, '5.0', '5.0', '5.0',
       ?, ?, ?, '视力正常，继续保持。', 1),
      (?, '2026-04-05', 118.00, 22.50, '5.0', '5.0', '5.0',
       ?, ?, ?, '视力保持正常，建议定期复查。', 1)
    `, [
      child2.id,
      safeJsonStringify({ s: '0.00', c: '0.00', a: '0' }),
      safeJsonStringify({ s: '0.00', c: '0.00', a: '0' }),
      safeJsonStringify({ vision_status: '正常', refraction_status: '正常', axis_status: '正常', cornea_status: '正常' }),
      child2.id,
      safeJsonStringify({ s: '0.00', c: '0.00', a: '0' }),
      safeJsonStringify({ s: '0.00', c: '0.00', a: '0' }),
      safeJsonStringify({ vision_status: '正常', refraction_status: '正常', axis_status: '正常', cornea_status: '正常' })
    ])
  }

  logger.info('检测记录创建完成')
}

async function seedAppointments() {
  const items = await query('SELECT id, name FROM appointment_items ORDER BY id ASC')
  if (!items || items.length === 0) return

  await execute('DELETE FROM appointment_records')
  await execute('DELETE FROM appointment_schedules')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const fmt = d => d.toISOString().slice(0, 10)

  for (const item of items) {
    await execute(`
      INSERT INTO appointment_schedules (item_id, schedule_date, time_slot, max_count, booked_count, active)
      VALUES
      (?, ?, '09:00-10:00', 15, 3, 1),
      (?, ?, '10:00-11:00', 15, 1, 1),
      (?, ?, '14:00-15:00', 10, 0, 1),
      (?, ?, '09:00-10:00', 15, 0, 1),
      (?, ?, '14:00-15:00', 10, 0, 1)
    `, [
      item.id, fmt(tomorrow),
      item.id, fmt(tomorrow),
      item.id, fmt(tomorrow),
      item.id, fmt(nextWeek),
      item.id, fmt(nextWeek)
    ])
  }

  const child = await queryOne('SELECT id, name, user_id, parent_phone, class_name FROM children ORDER BY id ASC LIMIT 1')
  const schedule = await queryOne('SELECT s.id, s.schedule_date, s.time_slot, i.name AS item_name FROM appointment_schedules s JOIN appointment_items i ON s.item_id = i.id ORDER BY s.id ASC LIMIT 1')
  if (child && schedule) {
    const recCount = await queryOne('SELECT COUNT(*) AS total FROM appointment_records WHERE child_id = ?', [child.id])
    if (!recCount || Number(recCount.total) === 0) {
      await execute(`
        INSERT INTO appointment_records (schedule_id, child_id, user_id, child_name, class_name, item_name, appointment_date, time_slot, phone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `, [schedule.id, child.id, child.user_id, child.name, child.class_name || '', schedule.item_name || '', schedule.schedule_date, schedule.time_slot || '', child.parent_phone || ''])
    }
  }

  logger.info('预约排班和记录创建完成')
}

async function seedBanners() {
  const count = await queryOne('SELECT COUNT(*) AS total FROM banners')
  if (count && Number(count.total) > 0) {
    logger.info('轮播图已存在，跳过')
    return
  }

  await execute(`
    INSERT INTO banners (title, sub_title, image_url, sort_order, active) VALUES
    ('爱眼护眼 从小做起', '关注孩子视力健康', 'https://picsum.photos/seed/eye1/750/340', 1, 1),
    ('定期检查 守护光明', '每学期至少检查一次', 'https://picsum.photos/seed/eye2/750/340', 2, 1),
    ('科学用眼 预防近视', '户外活动每天2小时', 'https://picsum.photos/seed/eye3/750/340', 3, 1)
  `)

  logger.info('轮播图创建完成')
}

async function main() {
  try {
    logger.info('开始创建完整测试数据...')
    await seedAdmins()
    await seedMobileUser()
    await seedCheckupRecords()
    await seedAppointments()
    await seedBanners()
    logger.info('完整测试数据创建完成！')
    logger.info('')
    logger.info('===== 账号信息 =====')
    logger.info('【管理后台】超级管理员: 13800138000 / Admin@123456')
    logger.info('【管理后台】运营管理员: 13800138001 / Admin@654321')
    logger.info('【小程序端】家长用户:   13900139000 / 123456')
    logger.info('====================')
    process.exit(0)
  } catch (error) {
    logger.error(`测试数据创建失败: ${error.message}`)
    logger.error(error.stack)
    process.exit(1)
  }
}

main()
