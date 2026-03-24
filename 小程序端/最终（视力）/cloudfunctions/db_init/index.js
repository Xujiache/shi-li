const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event || {}

  if (action === 'seed_demo') {
    return seedDemo()
  }

  const collections = [
    'users',
    'children',
    'school_classes',
    'appointment_items',
    'appointment_schedules',
    'appointment_records',
    'checkup_records',
    'banners',
    'system_config',
    'admin_sessions',
    // analytics
    'analytics_events',
    'analytics_visitors'
  ]

  try {
    // 1. Create Collections
    for (const name of collections) {
      try {
        await db.createCollection(name)
        console.log(`Collection ${name} created.`)
      } catch (e) {
        // Ignore if already exists
        console.log(`Collection ${name} already exists or error:`, e.message)
      }
    }

    // 2. Seed System Config (Terms)
    const termsDefaults = {
      key: 'terms_and_privacy',
      user_agreement: '这里是《用户协议》的详细内容。您在使用本小程序前，请仔细阅读...',
      privacy_policy: '这里是《隐私政策》的详细内容。我们将如何收集和使用您的信息...',
      child_privacy_policy: '这里是《儿童隐私政策》的详细内容。我们将如何保护未成年人的信息...',
      third_party_share_list: '这里是《第三方信息共享清单》的内容。包括共享对象、目的、范围等...',
      updated_at: db.serverDate()
    }

    const termsRes = await db
      .collection('system_config')
      .where({ key: 'terms_and_privacy' })
      .get()

    if (termsRes.data.length === 0) {
      await db.collection('system_config').add({ data: termsDefaults })
    } else {
      const existing = termsRes.data[0]
      const patch = {}
      ;['user_agreement', 'privacy_policy', 'child_privacy_policy', 'third_party_share_list'].forEach((k) => {
        if (typeof existing[k] !== 'string' || existing[k].trim() === '') {
          patch[k] = termsDefaults[k]
        }
      })
      if (Object.keys(patch).length > 0) {
        await db.collection('system_config').doc(existing._id).update({
          data: { ...patch, updated_at: db.serverDate() }
        })
      }
    }

    // 3. Seed Banners (if empty)
    const bannerCount = await db.collection('banners').count()
    if (bannerCount.total === 0) {
      await db.collection('banners').add({
        data: [
          { image_url: 'cloud://your-env/banner1.png', order: 1, active: true },
          { image_url: 'cloud://your-env/banner2.png', order: 2, active: true }
        ]
      })
    }

    // 4. Seed Appointment Items (if empty)
    const itemCount = await db.collection('appointment_items').count()
    if (itemCount.total === 0) {
      const itemRes = await db.collection('appointment_items').add({
        data: [
          { name: '基础眼部护理', active: true },
          { name: '视力复查', active: true },
          { name: '护眼知识讲座', active: true }
        ]
      })
      
      // Seed Schedules for the first item
      const itemId = itemRes._ids[0]
      await db.collection('appointment_schedules').add({
        data: [
          { item_id: itemId, date: '2023-11-01', time_slot: '09:00-10:00', max_count: 5, booked_count: 0 },
          { item_id: itemId, date: '2023-11-01', time_slot: '10:00-11:00', max_count: 5, booked_count: 0 }
        ]
      })
    }

    return { success: true, msg: 'Database initialized successfully' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

async function seedDemo() {
  const demoPhone = '13800138000'
  const demoPassword = '123456'

  try {
    let userId = null
    const userRes = await db.collection('users').where({ phone: demoPhone }).limit(1).get()
    if (userRes.data.length === 0) {
      const addUser = await db.collection('users').add({
        data: {
          phone: demoPhone,
          password: demoPassword,
          created_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      })
      userId = addUser._id
    } else {
      userId = userRes.data[0]._id
      await db.collection('users').doc(userId).update({
        data: { password: demoPassword, updated_at: db.serverDate() }
      })
    }

    let childId = null
    const childRes = await db.collection('children').where({ parent_phone: demoPhone }).limit(1).get()
    if (childRes.data.length === 0) {
      const addChild = await db.collection('children').add({
        data: {
          parent_phone: demoPhone,
          name: '张三',
          gender: '男',
          dob: '2020-01-01',
          age: 6,
          school: '天堂小学',
          class_name: '一年二班',
          height: 120,
          weight: 22,
          symptoms: ['眼疲劳', '看远处模糊'],
          symptom_other: '',
          additional_note: '孩子近期用眼时间较长，晚上容易揉眼。',
          tongue_shape: '齿痕',
          tongue_color: '淡红',
          tongue_coating: '薄白',
          face_color: '红润',
          lip_color: '红润',
          hair: '正常',
          vision_status: '4.9-4.7',
          refraction_l: '-0.75',
          refraction_r: '-0.50',
          created_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      })
      childId = addChild._id
    } else {
      childId = childRes.data[0]._id
    }

    const itemCount = await db.collection('appointment_items').count()
    if (itemCount.total === 0) {
      await db.collection('appointment_items').add({
        data: [
          { name: '基础眼部护理', active: true },
          { name: '视力复查', active: true },
          { name: '护眼知识讲座', active: true }
        ]
      })
    }

    const items = await db.collection('appointment_items').where({ active: true }).get()
    const itemId = items.data[0] && items.data[0]._id
    if (itemId) {
      const scheduleRes = await db.collection('appointment_schedules').where({ item_id: itemId }).get()
      if (scheduleRes.data.length === 0) {
        await db.collection('appointment_schedules').add({
          data: [
            { item_id: itemId, date: '2026-02-10', time_slot: '14:30-15:30', max_count: 10, booked_count: 0 },
            { item_id: itemId, date: '2026-02-10', time_slot: '16:00-17:00', max_count: 10, booked_count: 0 }
          ]
        })
      }
    }

    const schedules = itemId ? await db.collection('appointment_schedules').where({ item_id: itemId }).get() : { data: [] }
    const scheduleId = schedules.data[0] && schedules.data[0]._id

    if (scheduleId) {
      const existBook = await db.collection('appointment_records').where({ child_id: childId, schedule_id: scheduleId, status: _.neq('cancelled') }).get()
      if (existBook.data.length === 0) {
        await db.runTransaction(async (transaction) => {
          const scheduleRef = transaction.collection('appointment_schedules').doc(scheduleId)
          const scheduleDoc = await scheduleRef.get()
          const schedule = scheduleDoc.data
          if (schedule.booked_count < schedule.max_count) {
            await scheduleRef.update({ data: { booked_count: _.inc(1) } })
          }
          await transaction.collection('appointment_records').add({
            data: {
              child_id: childId,
              child_name: '张三',
              class_name: '一年二班',
              schedule_id: scheduleId,
              item_name: items.data[0].name,
              date: schedules.data[0].date,
              time_slot: schedules.data[0].time_slot,
              phone: demoPhone,
              status: 'confirmed',
              created_at: db.serverDate()
            }
          })
        })
      }
    }

    const recordRes = await db.collection('checkup_records').where({ child_id: childId }).get()
    if (recordRes.data.length === 0) {
      await db.collection('checkup_records').add({
        data: [
          {
            child_id: childId,
            date: '2026-01-05',
            height: 118,
            weight: 21,
            vision_l: '4.7',
            vision_r: '4.8',
            refraction_l: { s: '-0.75', c: '-0.25', a: '180' },
            refraction_r: { s: '-0.50', c: '-0.25', a: '175' },
            diagnosis: { vision_status: '不正常', refraction_status: '不正常', axis_status: '正常', cornea_status: '正常' },
            conclusion: '建议控制近距离用眼，增加户外活动时间。',
            created_at: db.serverDate()
          },
          {
            child_id: childId,
            date: '2026-01-20',
            height: 119,
            weight: 21.5,
            vision_l: '4.8',
            vision_r: '4.8',
            refraction_l: { s: '-0.75', c: '-0.25', a: '180' },
            refraction_r: { s: '-0.50', c: '-0.25', a: '175' },
            diagnosis: { vision_status: '不正常', refraction_status: '不正常', axis_status: '正常', cornea_status: '正常' },
            conclusion: '持续观察，保持规律作息。',
            created_at: db.serverDate()
          },
          {
            child_id: childId,
            date: '2026-02-01',
            height: 120,
            weight: 22,
            vision_l: '4.9',
            vision_r: '4.9',
            refraction_l: { s: '-0.50', c: '-0.25', a: '180' },
            refraction_r: { s: '-0.25', c: '-0.25', a: '175' },
            diagnosis: { vision_status: '正常', refraction_status: '不正常', axis_status: '正常', cornea_status: '正常' },
            conclusion: '视力有所改善，建议继续保持。',
            created_at: db.serverDate()
          }
        ]
      })
    }

    return {
      success: true,
      msg: 'Demo data seeded',
      demo: {
        phone: demoPhone,
        password: demoPassword,
        user_id: userId,
        child_id: childId
      }
    }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}
