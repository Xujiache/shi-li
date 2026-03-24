const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function getCurrentUserContext(wxContext, eventPayload) {
  const openid = wxContext && wxContext.OPENID
  const user_id =
    (eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))) || null

  if (user_id) {
    try {
      const doc = await db.collection('users').doc(String(user_id)).get()
      const u = (doc && doc.data) ? doc.data : (doc && doc._id ? doc : null)
      if (u) {
        return { openid, phone: u.phone != null ? String(u.phone).trim() : null, hasUserId: true, user_id: String(user_id) }
      }
    } catch (e) {}
  }

  let phone = null
  try {
    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (userRes.data.length > 0 && userRes.data[0] && userRes.data[0].phone != null) phone = String(userRes.data[0].phone).trim()
  } catch (e) {
    // ignore
  }
  return { openid, phone, hasUserId: false, user_id: null }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event
  const _openid = wxContext.OPENID

  switch (action) {
    case 'get_items':
      try {
        const items = await db.collection('appointment_items').where({ active: true }).get()
        return { success: true, list: items.data }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'get_schedules':
      try {
        const { item_id } = data
        const schedules = await db.collection('appointment_schedules').where({
          item_id
        }).get()
        return { success: true, list: schedules.data }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'book':
      return book(data, wxContext, event)
    case 'list_by_child':
      return listByChild(data, wxContext, event)
    case 'get_my_records':
      try {
        const ctx = await getCurrentUserContext(wxContext, event)
        const phone = ctx && ctx.phone ? String(ctx.phone) : null
        // 若携带 user_id（手机号账号），仅按手机号归属查询，避免同一微信 OPENID 下多账号并集
        let query
        if (ctx && ctx.hasUserId && phone) {
          query = db.collection('appointment_records').where({ phone })
        } else {
          query = db.collection('appointment_records').where({ _openid })
          if (phone) query = db.collection('appointment_records').where(_.or([{ _openid }, { phone }]))
        }

        const records = await query.orderBy('created_at', 'desc').get()
        return { success: true, list: records.data }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function listByChild(data, wxContext, eventPayload) {
  try {
    const { child_id } = data || {}
    if (!child_id) return { success: false, msg: '缺少孩子ID' }

    const ctx = await getCurrentUserContext(wxContext, eventPayload)
    const _openid = (ctx && ctx.openid) || (wxContext && wxContext.OPENID)
    const phone = ctx && ctx.phone ? String(ctx.phone) : null

    // 若携带 user_id（手机号账号），仅按手机号归属查询，避免同一微信 OPENID 下多账号并集
    let whereCond
    if (ctx && ctx.hasUserId && phone) {
      whereCond = { phone, child_id }
    } else {
      const orList = [{ _openid, child_id }]
      if (phone) orList.push({ phone, child_id })
      whereCond = _.or(orList)
    }

    const records = await db
      .collection('appointment_records')
      .where(whereCond)
      .orderBy('created_at', 'desc')
      .get()
    return { success: true, list: records.data }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

async function book(data, wxContext, eventPayload) {
  const _openid = wxContext && wxContext.OPENID
  const { schedule_id, child_id, child_name, item_name, date, time_slot, phone, class_name } = data || {}
  
  // 1. Check duplicate booking
  const existing = await db.collection('appointment_records').where({
    child_id,
    schedule_id,
    status: _.neq('cancelled')
  }).get()
  
  if (existing.data.length > 0) {
    return { success: false, msg: '该时段已预约' }
  }

  // 2. Resolve current user (optional) and validate
  const ctx = await getCurrentUserContext(wxContext, eventPayload)
  const phoneFromUser = ctx && ctx.phone ? String(ctx.phone) : ''
  const phoneToSave = (ctx && ctx.hasUserId && phoneFromUser) ? phoneFromUser : (phone ? String(phone) : '')

  if (!phoneToSave) return { success: false, msg: '缺少手机号' }

  // 手机号账号登录时，校验孩子归属
  if (ctx && ctx.hasUserId && phoneFromUser) {
    try {
      const doc = await db.collection('children').doc(String(child_id)).get()
      const child = doc && doc.data
      if (!child || !child.parent_phone || child.parent_phone !== phoneFromUser) {
        return { success: false, msg: '无权限为该孩子预约' }
      }
    } catch (e) {
      return { success: false, msg: '孩子信息校验失败' }
    }
  }

  // 3. Transaction for counting
  try {
    const result = await db.runTransaction(async transaction => {
      const scheduleRef = transaction.collection('appointment_schedules').doc(schedule_id)
      const scheduleRes = await scheduleRef.get()
      const schedule = scheduleRes.data
      
      if (schedule.booked_count >= schedule.max_count) {
        // Use custom error to rollback
        throw new Error('BOOK_FULL')
      }
      
      await scheduleRef.update({
        data: { booked_count: _.inc(1) }
      })
      
      await transaction.collection('appointment_records').add({
        data: {
          _openid,
          child_id,
          child_name,
          class_name,
          schedule_id,
          item_name,
          date,
          time_slot,
          phone: phoneToSave,
          status: 'confirmed',
          created_at: db.serverDate()
        }
      })
      
      return { success: true }
    })
    return result
  } catch (e) {
    if (e.message === 'BOOK_FULL') {
        return { success: false, msg: '该时段已约满' }
    }
    return { success: false, msg: e.message || '预约失败' }
  }
}
