const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, data } = event
  const wxContext = cloud.getWXContext()
  
  switch (action) {
    case 'track':
      return trackEvent(data, wxContext, event)
    case 'get_banners':
      try {
        // 使用 neq(false) 而非 active:true，兼容 active 字段缺失或为 null 的旧数据
        const banners = await db.collection('banners').where({ active: _.neq(false) }).orderBy('order', 'asc').get()
        const rows = Array.isArray(banners.data) ? banners.data : []
        // 过滤明显不合法的图片地址
        const list = rows.filter((b) => {
          const url = b && b.image_url
          if (typeof url !== 'string') return false
          const u = url.trim()
          if (!u) return false
          if (u.startsWith('/pages/')) return false
          return true
        })
        // 直接返回原始 image_url（含 cloud://），由客户端 downloadFile 处理
        return { success: true, list }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'terms_get':
      try {
        const key = 'terms_and_privacy'
        const res = await db.collection('system_config').where({ key }).limit(1).get()
        if (res.data && res.data.length > 0) {
          return { success: true, row: res.data[0] }
        }
        // 不强制写入（公开读取接口），直接返回默认结构
        return {
          success: true,
          row: {
            key,
            user_agreement: '',
            privacy_policy: '',
            child_privacy_policy: '',
            third_party_share_list: ''
          }
        }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'get_records':
      try {
        const { child_id } = data || {}
        if (!child_id) return { success: false, msg: '缺少孩子ID' }

        // 权限校验：避免不同账号在同一微信 OPENID 下串读数据
        const access = await canAccessChild(child_id, wxContext, event)
        if (!access.ok) return { success: false, msg: '无权限查看该孩子记录' }

        const records = await db.collection('checkup_records').where({ child_id }).orderBy('date', 'desc').get()
        const list = Array.isArray(records.data) ? records.data : []

        // 允许同一天多份记录：在 date 相同的情况下再按 created_at/updated_at 排序，保证“最新记录”稳定
        const toDateMs = (v) => {
          if (!v) return 0
          if (typeof v === 'number' && Number.isFinite(v)) return v
          if (v instanceof Date) return v.getTime()
          if (typeof v === 'object') {
            if (typeof v.getTime === 'function') return v.getTime()
            if (v.$date) return toDateMs(v.$date)
            if (v.seconds && Number.isFinite(v.seconds)) return v.seconds * 1000
            if (v.milliseconds && Number.isFinite(v.milliseconds)) return v.milliseconds
          }
          if (typeof v === 'string') {
            const t = Date.parse(v)
            if (!Number.isNaN(t)) return t
          }
          return 0
        }

        list.sort((a, b) => {
          const ad = a && a.date ? String(a.date) : ''
          const bd = b && b.date ? String(b.date) : ''
          if (bd !== ad) return bd.localeCompare(ad)
          const bt = toDateMs(b && (b.created_at || b.updated_at))
          const at = toDateMs(a && (a.created_at || a.updated_at))
          if (bt !== at) return bt - at
          const bid = b && b._id ? String(b._id) : ''
          const aid = a && a._id ? String(a._id) : ''
          return bid.localeCompare(aid)
        })

        return { success: true, list }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'get_record':
      try {
        const { record_id } = data || {}
        if (!record_id) return { success: false, msg: '缺少记录ID' }

        const doc = await db.collection('checkup_records').doc(record_id).get()
        const record = doc && doc.data
        if (!record) return { success: false, msg: '记录不存在' }

        const access = await canAccessChild(record.child_id, wxContext, event)
        if (!access.ok) return { success: false, msg: '无权限查看该记录' }

        return { success: true, record }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'create_record':
      try {
        const { record } = data || {}
        const cleaned = normalizeRecordInput(record)
        if (!cleaned.child_id) return { success: false, msg: '缺少孩子ID' }
        if (!cleaned.date) return { success: false, msg: '缺少检测日期' }

        const access = await canAccessChild(cleaned.child_id, wxContext, event)
        if (!access.ok) return { success: false, msg: '无权限为该孩子新增记录' }

        const res = await db.collection('checkup_records').add({
          data: { ...cleaned, created_at: db.serverDate(), updated_at: db.serverDate() }
        })
        return { success: true, record_id: res._id }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'update_record':
      try {
        const { record_id, patch } = data || {}
        if (!record_id) return { success: false, msg: '缺少记录ID' }

        const oldDoc = await db.collection('checkup_records').doc(record_id).get()
        const old = oldDoc && oldDoc.data
        if (!old) return { success: false, msg: '记录不存在' }

        const access = await canAccessChild(old.child_id, wxContext, event)
        if (!access.ok) return { success: false, msg: '无权限修改该记录' }

        const cleanedPatch = normalizeRecordPatch(patch)
        if (cleanedPatch.child_id && cleanedPatch.child_id !== old.child_id) {
          return { success: false, msg: '不允许修改孩子ID' }
        }

        // 允许同一天多份记录：不再限制 (child_id, date) 的唯一性

        await db.collection('checkup_records').doc(record_id).update({
          data: { ...cleanedPatch, updated_at: db.serverDate() }
        })
        return { success: true }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function trackEvent(data, wxContext, eventPayload) {
  try {
    const payload = (data && typeof data === 'object') ? data : {}
    const type = payload.type != null ? String(payload.type) : 'page_view'
    const page = payload.page != null ? String(payload.page) : ''
    const name = payload.name != null ? String(payload.name) : ''

    const now = Date.now()
    const openid = wxContext && wxContext.OPENID ? String(wxContext.OPENID) : ''
    const userId =
      (eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))) || ''
    const visitorId = userId ? String(userId) : (openid || 'anonymous')

    // 记录事件
    await db.collection('analytics_events').add({
      data: {
        type,
        page,
        name,
        visitor_id: visitorId,
        user_id: userId ? String(userId) : '',
        _openid: openid,
        created_at_ms: now,
        created_at: db.serverDate()
      }
    })

    // 更新在线访客（用 visitorId 作为 docId，便于按 last_seen_ms 统计在线）
    await db.collection('analytics_visitors').doc(String(visitorId)).set({
      data: {
        visitor_id: visitorId,
        user_id: userId ? String(userId) : '',
        _openid: openid,
        last_seen_ms: now,
        last_page: page || name || '',
        updated_at: db.serverDate()
      }
    })

    return { success: true }
  } catch (e) {
    return { success: false, msg: e.message || 'track failed' }
  }
}

async function getCurrentUser(wxContext, eventPayload) {
  const user_id =
    (eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))) || null

  if (user_id) {
    try {
      const doc = await db.collection('users').doc(String(user_id)).get()
      if (doc && doc.data) return { _id: String(user_id), ...doc.data }
    } catch (e) {}
  }

  const openid = wxContext && wxContext.OPENID
  if (!openid) return null
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (res.data && res.data.length > 0) return res.data[0]
  return null
}

async function canAccessChild(childId, wxContext, eventPayload) {
  const openid = wxContext && wxContext.OPENID
  if (!childId) return { ok: false }

  const hasUserId = !!(
    eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))
  )

  const user = await getCurrentUser(wxContext, eventPayload)
  if (user && user.is_admin) return { ok: true, role: 'admin' }

  const doc = await db.collection('children').doc(childId).get()
  const child = doc && doc.data
  if (!child) return { ok: false }

  // 若携带 user_id（手机号账号），只允许按手机号归属访问，避免同一微信 OPENID 下多账号互相访问
  if (hasUserId) {
    if (user && user.phone && child.parent_phone && child.parent_phone === user.phone) {
      return { ok: true, role: 'phone' }
    }
    return { ok: false }
  }

  // 未携带 user_id（微信登录/兼容模式）才允许按 OPENID 或手机号访问
  if (openid && child._openid === openid) return { ok: true, role: 'owner' }
  if (user && user.phone && child.parent_phone && child.parent_phone === user.phone) return { ok: true, role: 'phone' }
  return { ok: false }
}

function normalizeRecordInput(input) {
  const r = input && typeof input === 'object' ? input : {}

  const cleaned = {}
  cleaned.child_id = typeof r.child_id === 'string' ? r.child_id : ''
  cleaned.date = typeof r.date === 'string' ? r.date : ''

  if (r.height !== undefined && r.height !== null && r.height !== '') {
    const n = Number(r.height)
    if (!Number.isNaN(n)) cleaned.height = n
  }
  if (r.weight !== undefined && r.weight !== null && r.weight !== '') {
    const n = Number(r.weight)
    if (!Number.isNaN(n)) cleaned.weight = n
  }

  if (typeof r.vision_l === 'string') cleaned.vision_l = r.vision_l
  if (typeof r.vision_r === 'string') cleaned.vision_r = r.vision_r

  cleaned.refraction_l = normalizeRefraction(r.refraction_l)
  cleaned.refraction_r = normalizeRefraction(r.refraction_r)
  cleaned.diagnosis = normalizeDiagnosis(r.diagnosis)

  if (typeof r.conclusion === 'string') cleaned.conclusion = r.conclusion
  return cleaned
}

function normalizeRecordPatch(patch) {
  const p = patch && typeof patch === 'object' ? patch : {}
  const cleaned = {}

  if (typeof p.child_id === 'string') cleaned.child_id = p.child_id
  if (typeof p.date === 'string') cleaned.date = p.date

  if (p.height !== undefined) {
    if (p.height === null || p.height === '') {
      cleaned.height = _.remove()
    } else {
      const n = Number(p.height)
      if (!Number.isNaN(n)) cleaned.height = n
    }
  }
  if (p.weight !== undefined) {
    if (p.weight === null || p.weight === '') {
      cleaned.weight = _.remove()
    } else {
      const n = Number(p.weight)
      if (!Number.isNaN(n)) cleaned.weight = n
    }
  }

  if (p.vision_l !== undefined) {
    if (p.vision_l === null || p.vision_l === '') cleaned.vision_l = _.remove()
    else if (typeof p.vision_l === 'string') cleaned.vision_l = p.vision_l
  }
  if (p.vision_r !== undefined) {
    if (p.vision_r === null || p.vision_r === '') cleaned.vision_r = _.remove()
    else if (typeof p.vision_r === 'string') cleaned.vision_r = p.vision_r
  }

  if (p.refraction_l !== undefined) cleaned.refraction_l = normalizeRefraction(p.refraction_l, true)
  if (p.refraction_r !== undefined) cleaned.refraction_r = normalizeRefraction(p.refraction_r, true)
  if (p.diagnosis !== undefined) cleaned.diagnosis = normalizeDiagnosis(p.diagnosis, true)

  if (p.conclusion !== undefined) {
    if (p.conclusion === null || p.conclusion === '') cleaned.conclusion = _.remove()
    else if (typeof p.conclusion === 'string') cleaned.conclusion = p.conclusion
  }

  return cleaned
}

function normalizeRefraction(input, allowRemove = false) {
  if (input === null) return allowRemove ? _.remove() : {}
  const r = input && typeof input === 'object' ? input : {}
  const cleaned = {}
  if (typeof r.s === 'string' && r.s) cleaned.s = r.s
  if (typeof r.c === 'string' && r.c) cleaned.c = r.c
  if (typeof r.a === 'string' && r.a) cleaned.a = r.a
  return cleaned
}

function normalizeDiagnosis(input, allowRemove = false) {
  if (input === null) return allowRemove ? _.remove() : {}
  const d = input && typeof input === 'object' ? input : {}
  const cleaned = {}
  if (typeof d.vision_status === 'string' && d.vision_status) cleaned.vision_status = d.vision_status
  if (typeof d.refraction_status === 'string' && d.refraction_status) cleaned.refraction_status = d.refraction_status
  if (typeof d.axis_status === 'string' && d.axis_status) cleaned.axis_status = d.axis_status
  if (typeof d.cornea_status === 'string' && d.cornea_status) cleaned.cornea_status = d.cornea_status
  return cleaned
}
