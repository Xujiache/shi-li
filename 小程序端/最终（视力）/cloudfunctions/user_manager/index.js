// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

function toDateMs(v) {
  if (!v) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v instanceof Date) return v.getTime()
  // 兼容云数据库可能返回的日期结构
  if (typeof v === 'object') {
    if (typeof v.getTime === 'function') return v.getTime()
    const any = v
    if (any.$date) return toDateMs(any.$date)
    if (any.seconds && Number.isFinite(any.seconds)) return any.seconds * 1000
    if (any.milliseconds && Number.isFinite(any.milliseconds)) return any.milliseconds
  }
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return 0
}

function pickLatestUser(list) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : []
  if (arr.length === 0) return null
  arr.sort((a, b) => {
    const t1 =
      toDateMs(b.last_login_at) - toDateMs(a.last_login_at) ||
      toDateMs(b.updated_at) - toDateMs(a.updated_at) ||
      toDateMs(b.created_at) - toDateMs(a.created_at)
    if (t1 !== 0) return t1
    const aid = a && a._id ? String(a._id) : ''
    const bid = b && b._id ? String(b._id) : ''
    return bid.localeCompare(aid)
  })
  return arr[0]
}

async function getUserByUserId(eventPayload) {
  const user_id = (eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))) || null
  if (!user_id) return null
  try {
    const doc = await db.collection('users').doc(String(user_id)).get()
    if (doc && doc.data) return { _id: String(user_id), ...doc.data }
  } catch (e) {}
  return null
}

async function getUserByOpenid(openid) {
  if (!openid) return null
  // 不使用 orderBy 避免索引要求；同一 OPENID 下用户数通常很少，取一批后在内存里择优
  const res = await db
    .collection('users')
    .where({ _openid: openid, deleted: _.neq(true), active: _.neq(false) })
    .limit(50)
    .get()
  if (!res.data || res.data.length === 0) return null
  return pickLatestUser(res.data)
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event

  switch (action) {
    case 'register':
      return register(data, wxContext)
    case 'login_phone':
      return loginPhone(event, wxContext)
    case 'get_user_info':
      return getUserInfo(wxContext, event)
    case 'get_profile':
      return getProfile(wxContext, event)
    case 'update_profile':
      return updateProfile(data, wxContext, event)
    case 'bootstrap_admin':
      return bootstrapAdmin(wxContext, event)
    case 'set_admin_by_user_no':
      return setAdminByUserNo(data, wxContext, event)
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function register(data, wxContext) {
  const { phone, password } = data
  if (!phone || !password) return { success: false, msg: '请填写手机号和密码' }

  // 查重：查找该手机号下所有用户，在代码层面过滤已删除的
  const existRes = await db.collection('users').where({ phone }).limit(10).get()
  const existActive = (existRes.data || []).filter(u => u.deleted !== true)
  if (existActive.length > 0) {
    return { success: false, msg: '手机号已注册' }
  }
  // Create user
  await db.collection('users').add({
    data: {
      _openid: wxContext.OPENID,
      phone,
      password, // In production, hash this!
      active: true,
      deleted: false,
      created_at: db.serverDate(),
      updated_at: db.serverDate(),
      last_login_at: db.serverDate()
    }
  })
  return { success: true }
}

async function loginPhone(event, wxContext) {
  // 兼容两种入参：{ data: { phone, password } } 或 { phone, password }
  const payload = (event && event.data && (event.data.phone != null || event.data.password != null))
    ? event.data
    : (event || {})
  const phone = payload.phone != null ? String(payload.phone).trim() : ''
  const password = payload.password != null ? String(payload.password) : ''

  if (!phone || !password) {
    return { success: false, msg: '请填写手机号和密码' }
  }

  const res = await db.collection('users').where({
    phone,
    password,
    deleted: _.neq(true),
    active: _.neq(false)
  }).get()

  if (res.data.length > 0) {
    const user = res.data[0]
    // 记录最近登录（用于同一微信 OPENID 下多账号时，微信登录优先取最近登录的账号）
    try {
      await db.collection('users').doc(user._id).update({
        data: { _openid: wxContext.OPENID, last_login_at: db.serverDate(), updated_at: db.serverDate() }
      })
    } catch (e) {}
    // 必须返回本条记录（按 phone+password 查到的），不得用 OPENID 覆盖或替换
    return { success: true, user }
  }
  return { success: false, msg: '手机号或密码错误' }
}

async function getUserInfo(wxContext, eventPayload) {
  const byId = await getUserByUserId(eventPayload)
  if (byId) return { success: true, user: byId }

  const byOpenid = await getUserByOpenid(wxContext && wxContext.OPENID)
  if (byOpenid) return { success: true, user: byOpenid }

  return { success: false, msg: '未找到用户' }
}

async function getProfile(wxContext, eventPayload) {
  let u = await getUserByUserId(eventPayload)
  if (!u) u = await getUserByOpenid(wxContext && wxContext.OPENID)
  if (!u) return { success: false, msg: '未找到用户' }

  return {
    success: true,
    profile: {
      user_id: u._id,
      user_no: u.user_no || '',
      display_name: u.display_name || '',
      avatar_file_id: u.avatar_file_id || '',
      phone: u.phone || '',
      is_admin: !!u.is_admin
    }
  }
}

async function updateProfile(data, wxContext, eventPayload) {
  const { display_name, avatar_file_id, user_no } = data || {}
  // 优先使用 user_id（同设备多账号），否则回退 OPENID
  let userDoc = await getUserByUserId(eventPayload || data)
  if (!userDoc) userDoc = await getUserByOpenid(wxContext && wxContext.OPENID)
  if (!userDoc || !userDoc._id) return { success: false, msg: '未找到用户' }
  const userId = String(userDoc._id)

  const patch = { updated_at: db.serverDate() }
  if (typeof display_name === 'string') patch.display_name = display_name
  if (typeof avatar_file_id === 'string') patch.avatar_file_id = avatar_file_id

  if (typeof user_no === 'string' && user_no) {
    if (userDoc.user_no) {
      // user_no is immutable once set
    } else if (!/^\d{8}$/.test(user_no)) {
      return { success: false, msg: '用户编号格式错误' }
    } else {
      const exist = await db.collection('users').where({ user_no }).limit(1).get()
      if (exist.data.length > 0) return { success: false, code: 'USER_NO_TAKEN', msg: '用户编号已被占用' }
      patch.user_no = user_no
    }
  }

  await db.collection('users').doc(userId).update({ data: patch })
  return { success: true }
}

async function bootstrapAdmin(wxContext, eventPayload) {
  const openid = wxContext && wxContext.OPENID
  if (!openid) return { success: false, msg: '未登录' }

  const admins = await db.collection('users').where({ is_admin: true }).limit(1).get()
  if (admins.data && admins.data.length > 0) {
    return { success: false, code: 'ADMIN_EXISTS', msg: '已存在管理员' }
  }

  const me = (await getUserByUserId(eventPayload)) || (await getUserByOpenid(openid))
  if (!me) return { success: false, msg: '未找到用户' }

  const userId = me._id
  await db.collection('users').doc(userId).update({
    data: { is_admin: true, updated_at: db.serverDate() }
  })
  return { success: true, is_admin: true }
}

async function setAdminByUserNo(data, wxContext, eventPayload) {
  const openid = wxContext && wxContext.OPENID
  const userNo = data && data.user_no ? String(data.user_no) : ''
  if (!openid) return { success: false, msg: '未登录' }
  if (!/^\d{8}$/.test(userNo)) return { success: false, msg: '用户编号格式错误' }

  const me = (await getUserByUserId(eventPayload)) || (await getUserByOpenid(openid))
  if (!me) return { success: false, msg: '未找到用户' }
  if (!me.is_admin) return { success: false, msg: '无权限' }

  const target = await db.collection('users').where({ user_no: userNo }).limit(1).get()
  if (!target.data || target.data.length === 0) return { success: false, msg: '目标用户不存在' }

  await db.collection('users').doc(target.data[0]._id).update({
    data: { is_admin: true, updated_at: db.serverDate() }
  })
  return { success: true }
}
