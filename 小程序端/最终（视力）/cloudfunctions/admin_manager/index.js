const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  // 兼容 HTTP 访问服务（默认域名）：请求体在 event.body（字符串），需解析为 action/data
  if (event && event.body !== undefined && event.body !== null) {
    const parsed = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    event.action = parsed.action
    event.data = parsed.data != null ? parsed.data : {}
  }
  const { action, data } = event || {}

  try {
    switch (action) {
      case 'admin_login':
        return adminLogin(data)
      case 'admin_register':
        return adminRegister(data)
      case 'admin_logout':
        return adminLogout(data)
      case 'admin_me':
        return withAdmin(data, adminMe)

      case 'users_list':
        return withAdmin(data, usersList)
      case 'users_detail':
        return withAdmin(data, usersDetail)
      case 'users_create':
        return withAdmin(data, usersCreate)
      case 'users_update':
        return withAdmin(data, usersUpdate)
      case 'users_delete':
        return withAdmin(data, usersDelete)
      case 'users_toggle':
        return withAdmin(data, usersToggle)
      case 'users_set_admin':
        return withAdmin(data, usersSetAdmin)

      case 'children_list':
        return withAdmin(data, childrenList)
      case 'children_search':
        return withAdmin(data, childrenSearch)
      case 'children_detail':
        return withAdmin(data, childrenDetail)
      case 'children_create':
        return withAdmin(data, childrenCreate)
      case 'children_update':
        return withAdmin(data, childrenUpdate)
      case 'children_delete':
        return withAdmin(data, childrenDelete)
      case 'children_toggle':
        return withAdmin(data, childrenToggle)

      case 'school_classes_list':
        return withAdmin(data, schoolClassesList)
      case 'school_classes_detail':
        return withAdmin(data, schoolClassesDetail)
      case 'school_classes_create':
        return withAdmin(data, schoolClassesCreate)
      case 'school_classes_update':
        return withAdmin(data, schoolClassesUpdate)
      case 'school_classes_delete':
        return withAdmin(data, schoolClassesDelete)
      case 'school_classes_toggle':
        return withAdmin(data, schoolClassesToggle)

      case 'banners_list':
        return withAdmin(data, bannersList)
      case 'banners_detail':
        return withAdmin(data, bannersDetail)
      case 'banners_create':
        return withAdmin(data, bannersCreate)
      case 'banners_update':
        return withAdmin(data, bannersUpdate)
      case 'banners_delete':
        return withAdmin(data, bannersDelete)
      case 'banners_toggle':
        return withAdmin(data, bannersToggle)

      case 'appointment_items_list':
        return withAdmin(data, appointmentItemsList)
      case 'appointment_items_detail':
        return withAdmin(data, appointmentItemsDetail)
      case 'appointment_items_create':
        return withAdmin(data, appointmentItemsCreate)
      case 'appointment_items_update':
        return withAdmin(data, appointmentItemsUpdate)
      case 'appointment_items_delete':
        return withAdmin(data, appointmentItemsDelete)
      case 'appointment_items_toggle':
        return withAdmin(data, appointmentItemsToggle)

      case 'appointment_schedules_list':
        return withAdmin(data, appointmentSchedulesList)
      case 'appointment_schedules_detail':
        return withAdmin(data, appointmentSchedulesDetail)
      case 'appointment_schedules_create':
        return withAdmin(data, appointmentSchedulesCreate)
      case 'appointment_schedules_update':
        return withAdmin(data, appointmentSchedulesUpdate)
      case 'appointment_schedules_delete':
        return withAdmin(data, appointmentSchedulesDelete)
      case 'appointment_schedules_toggle':
        return withAdmin(data, appointmentSchedulesToggle)

      case 'appointment_records_list':
        return withAdmin(data, appointmentRecordsList)
      case 'appointment_records_detail':
        return withAdmin(data, appointmentRecordsDetail)
      case 'appointment_records_create':
        return withAdmin(data, appointmentRecordsCreate)
      case 'appointment_records_update':
        return withAdmin(data, appointmentRecordsUpdate)
      case 'appointment_records_delete':
        return withAdmin(data, appointmentRecordsDelete)
      case 'appointment_records_set_status':
        return withAdmin(data, appointmentRecordsSetStatus)

      case 'checkup_records_list':
        return withAdmin(data, checkupRecordsList)
      case 'checkup_records_detail':
        return withAdmin(data, checkupRecordsDetail)
      case 'checkup_records_create':
        return withAdmin(data, checkupRecordsCreate)
      case 'checkup_records_update':
        return withAdmin(data, checkupRecordsUpdate)
      case 'checkup_records_delete':
        return withAdmin(data, checkupRecordsDelete)
      case 'checkup_records_toggle':
        return withAdmin(data, checkupRecordsToggle)

      // ——— 系统配置 system_config（协议/隐私）———
      case 'system_config_terms_get':
        return withAdmin(data, systemConfigTermsGet)
      case 'system_config_terms_update':
        return withAdmin(data, systemConfigTermsUpdate)
      // ——— 仪表盘 dashboard ———
      case 'dashboard_stats':
        return withAdmin(data, dashboardStats)
      default:
        return { success: false, msg: 'Unknown action' }
    }
  } catch (e) {
    return { success: false, msg: e && e.message ? e.message : 'Unknown error' }
  }
}

async function withAdmin(data, handler) {
  const token = data && data.token ? String(data.token) : ''
  const session = await requireAdmin(token)
  if (!session.ok) return { success: false, msg: session.msg }
  return handler(data, session)
}

function nowMs() {
  return Date.now()
}

function randomToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 40; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function toInt(v, def) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.trunc(n)
}

function pickPagination(data) {
  const pageSize = Math.min(Math.max(toInt(data && data.page_size, 20), 1), 100)
  const page = Math.max(toInt(data && data.page, 1), 1)
  const skip = (page - 1) * pageSize
  return { page, page_size: pageSize, skip, limit: pageSize }
}

async function adminLogin(data) {
  const phone = data && data.phone ? String(data.phone) : ''
  const password = data && data.password ? String(data.password) : ''
  if (!phone || !password) return { success: false, msg: '缺少账号或密码' }

  // 先查该手机号是否存在（不加 deleted 过滤，避免云数据库运算符兼容问题）
  const userRes = await db.collection('users').where({ phone }).limit(10).get()
  const allUsers = Array.isArray(userRes.data) ? userRes.data : []
  // 过滤掉已删除的用户
  const activeUsers = allUsers.filter(u => u.deleted !== true)
  if (activeUsers.length === 0) {
    return { success: false, msg: '该手机号未注册' }
  }

  const user = activeUsers[0]
  // 验证密码
  if (user.password !== password) {
    return { success: false, msg: '密码错误' }
  }
  // 验证是否启用
  if (user.active === false) {
    return { success: false, msg: '该账号已被禁用，请联系管理员' }
  }
  // 验证管理员权限
  if (!user.is_admin) {
    return { success: false, msg: '该账号没有管理员权限，请在后台将该用户设为管理员后再登录' }
  }

  const res = { data: [user] }

  const token = randomToken()
  const ttlMs = 1000 * 60 * 60 * 12
  await db.collection('admin_sessions').add({
    data: {
      token,
      user_id: res.data[0]._id,
      created_at: db.serverDate(),
      expire_at_ms: nowMs() + ttlMs
    }
  })

  return {
    success: true,
    token,
    expires_in: ttlMs,
    admin: {
      user_id: res.data[0]._id,
      phone: res.data[0].phone || '',
      display_name: res.data[0].display_name || '',
      user_no: res.data[0].user_no || ''
    }
  }
}

async function adminRegister(data) {
  const phone = data && data.phone ? String(data.phone).trim() : ''
  const password = data && data.password ? String(data.password) : ''
  const displayName = data && data.display_name ? String(data.display_name).trim() : ''

  if (!phone || !password) return { success: false, msg: '缺少手机号或密码' }

  // 查重（不加 deleted 运算符过滤，避免兼容问题；改为代码中过滤 deleted !== true）
  const existRes = await db.collection('users').where({ phone }).limit(10).get()
  const existList = Array.isArray(existRes.data) ? existRes.data : []
  const existActive = existList.filter(u => u.deleted !== true)
  if (existActive.length > 0) {
    return { success: false, msg: '该手机号已注册' }
  }

  const addRes = await db.collection('users').add({
    data: {
      phone,
      password,
      display_name: displayName || phone,
      // 通过后台注册的账号默认具备管理员权限，便于直接登录后台
      is_admin: true,
      active: true,
      deleted: false,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })

  return { success: true, user_id: addRes && addRes._id }
}

async function adminMe(data, session) {
  const u = session && session.admin ? session.admin : null
  if (!u) return { success: false, msg: '无权限' }
  return {
    success: true,
    admin: {
      user_id: u._id,
      phone: u.phone || '',
      display_name: u.display_name || '',
      user_no: u.user_no || '',
      is_admin: !!u.is_admin
    }
  }
}

async function adminLogout(data) {
  const token = data && data.token ? String(data.token) : ''
  if (!token) return { success: true }
  try {
    await db.collection('admin_sessions').where({ token }).remove()
  } catch (e) {
    // ignore
  }
  return { success: true }
}

async function requireAdmin(token) {
  if (!token) return { ok: false, msg: '缺少token' }
  const res = await db.collection('admin_sessions').where({ token }).limit(1).get()
  if (!res.data || res.data.length === 0) return { ok: false, msg: 'token无效' }
  const s = res.data[0]
  if (s.expire_at_ms && Number(s.expire_at_ms) < nowMs()) {
    try {
      await db.collection('admin_sessions').doc(s._id).remove()
    } catch (e) {
      // ignore
    }
    return { ok: false, msg: 'token已过期' }
  }
  const u = await db.collection('users').doc(s.user_id).get()
  const user = u && u.data
  if (!user || !user.is_admin) return { ok: false, msg: '无权限' }
  return { ok: true, admin: user }
}

async function usersList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const q = data && data.q ? String(data.q).trim() : ''

  const andList = [{ deleted: _.neq(true) }]
  if (data && data.include_deleted) {
    andList.length = 0
  }

  let where = andList.length > 0 ? _.and(andList) : {}
  if (q) {
    const qWhere = _.or([
      { phone: db.RegExp({ regexp: q, options: 'i' }) },
      { display_name: db.RegExp({ regexp: q, options: 'i' }) },
      { user_no: db.RegExp({ regexp: q, options: 'i' }) }
    ])
    where = andList.length > 0 ? _.and([qWhere, ...andList]) : qWhere
  }

  const totalRes = await db.collection('users').where(where).count()
  const rows = await db.collection('users').where(where).orderBy('created_at', 'desc').skip(skip).limit(limit).get()

  const list = (rows.data || []).map((u) => ({
    _id: u._id,
    phone: u.phone || '',
    display_name: u.display_name || '',
    avatar_file_id: u.avatar_file_id || '',
    user_no: u.user_no || '',
    is_admin: !!u.is_admin,
    active: u.active !== false,
    deleted: !!u.deleted,
    created_at: u.created_at,
    updated_at: u.updated_at
  }))

  // 头像兜底：若 users.avatar_file_id 为空，则尝试使用该用户“孩子档案”的头像（按 parent_phone 关联）。
  // 说明：小程序端当前上传头像绑定在 children.avatar_file_id 上（个人中心显示的是孩子头像），
  // 所以后台“用户管理”里很多账号会没有 users.avatar_file_id。
  try {
    const needPhones = list
      .filter((u) => !u.avatar_file_id && u.phone)
      .map((u) => String(u.phone).trim())
      .filter(Boolean)

    const uniqPhones = Array.from(new Set(needPhones))
    if (uniqPhones.length > 0) {
      const phoneToAvatar = {}
      // 云数据库 _.in 可能存在数量限制，这里分块查询更稳
      const CHUNK = 10
      for (let i = 0; i < uniqPhones.length; i += CHUNK) {
        const chunk = uniqPhones.slice(i, i + CHUNK)
        const cRes = await db
          .collection('children')
          .where({ parent_phone: _.in(chunk) })
          .field({ parent_phone: true, avatar_file_id: true, updated_at: true, created_at: true })
          .limit(1000)
          .get()
        const children = Array.isArray(cRes.data) ? cRes.data : []
        for (const c of children) {
          const phone = c && c.parent_phone ? String(c.parent_phone).trim() : ''
          const fileId = c && c.avatar_file_id ? String(c.avatar_file_id) : ''
          if (!phone || !fileId) continue
          // 只取第一个即可（同手机号可能有多个孩子/头像）
          if (!phoneToAvatar[phone]) phoneToAvatar[phone] = fileId
        }
      }

      for (const u of list) {
        if (!u.avatar_file_id && u.phone) {
          const hit = phoneToAvatar[String(u.phone).trim()]
          if (hit) u.avatar_file_id = hit
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return { success: true, list, page, page_size, total: totalRes.total }
}

async function usersCreate(data) {
  const phone = data && data.phone ? String(data.phone).trim() : ''
  const password = data && data.password ? String(data.password) : ''
  const displayName = data && data.display_name ? String(data.display_name).trim() : ''
  const avatarFileId = data && data.avatar_file_id ? String(data.avatar_file_id).trim() : ''
  const isAdmin = !!(data && data.is_admin)
  const active = data && data.active !== undefined ? Boolean(data.active) : true

  if (!phone || !password) return { success: false, msg: '缺少手机号或密码' }
  if (password.length < 6 || password.length > 32) return { success: false, msg: '密码长度需要6-32位' }

  // 查重：查找该手机号下所有用户，在代码层面过滤已删除的
  const existRes = await db.collection('users').where({ phone }).limit(10).get()
  const existActive = (existRes.data || []).filter(u => u.deleted !== true)
  if (existActive.length > 0) return { success: false, msg: '手机号已存在' }

  const res = await db.collection('users').add({
    data: {
      phone,
      password,
      display_name: displayName,
      avatar_file_id: avatarFileId,
      is_admin: isAdmin,
      active,
      deleted: false,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
  return { success: true, user_id: res._id }
}

async function usersDelete(data) {
  const userId = data && data.user_id ? String(data.user_id) : ''
  if (!userId) return { success: false, msg: '缺少用户ID' }
  await db.collection('users').doc(userId).update({ data: { deleted: true, updated_at: db.serverDate() } })
  return { success: true }
}

async function usersToggle(data) {
  const userId = data && data.user_id ? String(data.user_id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!userId) return { success: false, msg: '缺少用户ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('users').doc(userId).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function usersDetail(data) {
  const userId = data && data.user_id ? String(data.user_id) : ''
  if (!userId) return { success: false, msg: '缺少用户ID' }
  const doc = await db.collection('users').doc(userId).get()
  if (!doc.data) return { success: false, msg: '用户不存在' }
  const u = doc.data
  return {
    success: true,
    user: {
      _id: u._id,
      phone: u.phone || '',
      display_name: u.display_name || '',
      avatar_file_id: u.avatar_file_id || '',
      user_no: u.user_no || '',
      is_admin: !!u.is_admin,
      created_at: u.created_at,
      updated_at: u.updated_at
    }
  }
}

async function usersUpdate(data) {
  const userId = data && data.user_id ? String(data.user_id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!userId) return { success: false, msg: '缺少用户ID' }
  if (!patch) return { success: false, msg: '缺少patch' }

  const allow = {}
  if (patch.display_name !== undefined) allow.display_name = String(patch.display_name || '')
  if (patch.avatar_file_id !== undefined) allow.avatar_file_id = String(patch.avatar_file_id || '')
  if (patch.phone !== undefined) allow.phone = String(patch.phone || '')
  if (patch.password !== undefined) allow.password = String(patch.password || '')

  allow.updated_at = db.serverDate()
  await db.collection('users').doc(userId).update({ data: allow })
  return { success: true }
}

async function usersSetAdmin(data, session) {
  const userId = data && data.user_id ? String(data.user_id) : ''
  const isAdmin = !!(data && data.is_admin)
  if (!userId) return { success: false, msg: '缺少用户ID' }

  if (session && session.admin && session.admin._id && session.admin._id === userId && !isAdmin) {
    return { success: false, msg: '不允许取消当前管理员自身权限' }
  }

  await db.collection('users').doc(userId).update({ data: { is_admin: isAdmin, updated_at: db.serverDate() } })
  return { success: true }
}

async function childrenList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const q = data && data.q ? String(data.q).trim() : ''
  const school = data && data.school ? String(data.school).trim() : ''
  const className = data && data.class_name ? String(data.class_name).trim() : ''

  const andList = []
  if (q) {
    andList.push(_.or([
      { name: db.RegExp({ regexp: q, options: 'i' }) },
      { parent_phone: db.RegExp({ regexp: q, options: 'i' }) },
      { child_no: db.RegExp({ regexp: q, options: 'i' }) }
    ]))
  }
  if (school) andList.push({ school })
  if (className) andList.push({ class_name: className })
  const where = andList.length > 0 ? _.and(andList) : {}

  const totalRes = await db.collection('children').where(where).count()
  const rows = await db.collection('children').where(where).orderBy('updated_at', 'desc').skip(skip).limit(limit).get()

  const list = (rows.data || []).map((c) => ({
    _id: c._id,
    name: c.name || '',
    gender: c.gender || '',
    dob: c.dob || '',
    school: c.school || '',
    class_name: c.class_name || '',
    parent_phone: c.parent_phone || '',
    child_no: c.child_no || '',
    updated_at: c.updated_at
  }))

  return { success: true, list, page, page_size, total: totalRes.total }
}

/**
 * children_search：用于“新增检测记录”等场景的选择孩子弹窗
 * 支持按：
 * - 孩子姓名（children.name）
 * - 家长手机号（children.parent_phone）
 * - 子编号（children.child_no）
 * - 用户8位编号（users.user_no）模糊搜索（通过 user_no -> phone -> children 关联）
 */
async function childrenSearch(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const q = data && data.q ? String(data.q).trim() : ''
  if (!q) return { success: true, list: [], page, page_size, total: 0 }

  const reg = db.RegExp({ regexp: q, options: 'i' })

  // 1) 直接在 children 表按姓名/手机号/子编号模糊查
  const childRes1 = await db.collection('children').where(
    _.or([
      { name: reg },
      { parent_phone: reg },
      { child_no: reg }
    ])
  ).orderBy('updated_at', 'desc').limit(200).get()
  const list1 = Array.isArray(childRes1.data) ? childRes1.data : []

  // 2) 在 users 表按 user_no（8位）模糊查出手机号，再到 children 表按 parent_phone 反查
  const userRes = await db.collection('users').where(
    _.or([
      { user_no: reg },
      { phone: reg }
    ])
  ).limit(200).get()
  const usersAll = Array.isArray(userRes.data) ? userRes.data : []
  const usersActive = usersAll.filter(u => u && u.deleted !== true && u.active !== false)
  const phones = Array.from(new Set(
    usersActive
      .map(u => (u && u.phone != null) ? String(u.phone).trim() : '')
      .filter(Boolean)
  ))

  const list2 = []
  const chunkSize = 10
  for (let i = 0; i < phones.length; i += chunkSize) {
    const chunk = phones.slice(i, i + chunkSize)
    const cRes = await db.collection('children').where({ parent_phone: _.in(chunk) }).orderBy('updated_at', 'desc').limit(200).get()
    ;(cRes.data || []).forEach((c) => list2.push(c))
  }

  // 3) 合并去重（保持 list1 优先顺序）
  const merged = []
  const seen = new Set()
  for (const c of [...list1, ...list2]) {
    if (!c || !c._id) continue
    const id = String(c._id)
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(c)
  }

  const total = merged.length
  const paged = merged.slice(skip, skip + limit)

  // 4) 为当前页补充 parent_user_no（按 parent_phone 映射 users.user_no）
  const pagePhones = Array.from(new Set(
    paged
      .map((c) => (c && c.parent_phone != null) ? String(c.parent_phone).trim() : '')
      .filter(Boolean)
  ))
  const phoneToUserNo = {}
  for (let i = 0; i < pagePhones.length; i += chunkSize) {
    const chunk = pagePhones.slice(i, i + chunkSize)
    const r = await db.collection('users').where({ phone: _.in(chunk) }).limit(200).get()
    const rows = Array.isArray(r.data) ? r.data : []
    for (const u of rows) {
      if (!u || u.deleted === true || u.active === false) continue
      const phone = u.phone != null ? String(u.phone).trim() : ''
      if (!phone) continue
      const userNo = u.user_no != null ? String(u.user_no).trim() : ''
      if (userNo) phoneToUserNo[phone] = userNo
    }
  }

  const list = paged.map((c) => ({
    _id: c._id,
    name: c.name || '',
    gender: c.gender || '',
    dob: c.dob || '',
    school: c.school || '',
    class_name: c.class_name || '',
    parent_phone: c.parent_phone || '',
    parent_user_no: phoneToUserNo[String(c.parent_phone || '').trim()] || '',
    child_no: c.child_no || '',
    updated_at: c.updated_at
  }))

  return { success: true, list, page, page_size, total }
}

async function childrenDetail(data) {
  const childId = data && data.child_id ? String(data.child_id) : ''
  if (!childId) return { success: false, msg: '缺少孩子ID' }
  const doc = await db.collection('children').doc(childId).get()
  if (!doc.data) return { success: false, msg: '孩子不存在' }
  return { success: true, child: doc.data }
}

async function childrenUpdate(data) {
  const childId = data && data.child_id ? String(data.child_id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!childId) return { success: false, msg: '缺少孩子ID' }
  if (!patch) return { success: false, msg: '缺少patch' }

  const allow = { ...patch }
  delete allow._id
  delete allow._openid
  allow.updated_at = db.serverDate()
  await db.collection('children').doc(childId).update({ data: allow })
  return { success: true }
}

async function childrenDelete(data) {
  const childId = data && data.child_id ? String(data.child_id) : ''
  if (!childId) return { success: false, msg: '缺少孩子ID' }
  await db.collection('children').doc(childId).remove()
  return { success: true }
}

async function childrenCreate(data) {
  const child = data && data.child && typeof data.child === 'object' ? data.child : null
  if (!child) return { success: false, msg: '缺少child' }
  const payload = { ...child }
  delete payload._id
  delete payload._openid
  payload.created_at = db.serverDate()
  payload.updated_at = db.serverDate()
  if (payload.active === undefined) payload.active = true
  const res = await db.collection('children').add({ data: payload })
  return { success: true, child_id: res._id }
}

async function childrenToggle(data) {
  const childId = data && data.child_id ? String(data.child_id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!childId) return { success: false, msg: '缺少孩子ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('children').doc(childId).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function schoolClassesList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const q = data && data.q ? String(data.q).trim() : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null

  const andList = []
  if (q) {
    andList.push(_.or([
      { school: db.RegExp({ regexp: q, options: 'i' }) },
      { class_name: db.RegExp({ regexp: q, options: 'i' }) }
    ]))
  }
  if (active !== null) andList.push({ active })
  const where = andList.length > 0 ? _.and(andList) : {}

  const totalRes = await db.collection('school_classes').where(where).count()
  const rows = await db.collection('school_classes').where(where).orderBy('school', 'asc').skip(skip).limit(limit).get()
  return { success: true, list: rows.data || [], page, page_size, total: totalRes.total }
}

async function schoolClassesDetail(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  const doc = await db.collection('school_classes').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, row: doc.data }
}

async function schoolClassesCreate(data) {
  const school = data && data.school ? String(data.school).trim() : ''
  const className = data && data.class_name ? String(data.class_name).trim() : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : true
  if (!school || !className) return { success: false, msg: '缺少学校或班级' }

  const exist = await db.collection('school_classes').where({ school, class_name: className }).limit(1).get()
  if (exist.data && exist.data.length > 0) return { success: false, msg: '已存在相同学校/班级' }

  const res = await db.collection('school_classes').add({
    data: { school, class_name: className, active, created_at: db.serverDate(), updated_at: db.serverDate() }
  })
  return { success: true, _id: res._id }
}

async function schoolClassesUpdate(data) {
  const id = data && data._id ? String(data._id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (!patch) return { success: false, msg: '缺少patch' }

  const allow = {}
  if (patch.school !== undefined) allow.school = String(patch.school || '').trim()
  if (patch.class_name !== undefined) allow.class_name = String(patch.class_name || '').trim()
  if (patch.active !== undefined) allow.active = Boolean(patch.active)
  allow.updated_at = db.serverDate()

  if (allow.school && allow.class_name) {
    const exist = await db.collection('school_classes').where({ school: allow.school, class_name: allow.class_name }).limit(1).get()
    if (exist.data && exist.data.length > 0 && exist.data[0]._id !== id) {
      return { success: false, msg: '已存在相同学校/班级' }
    }
  }

  await db.collection('school_classes').doc(id).update({ data: allow })
  return { success: true }
}

async function schoolClassesDelete(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  await db.collection('school_classes').doc(id).remove()
  return { success: true }
}

async function schoolClassesToggle(data) {
  const id = data && data._id ? String(data._id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('school_classes').doc(id).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function bannersList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  const where = active === null ? {} : { active }
  const totalRes = await db.collection('banners').where(where).count()
  const rows = await db.collection('banners').where(where).orderBy('order', 'asc').skip(skip).limit(limit).get()
  return { success: true, list: rows.data || [], page, page_size, total: totalRes.total }
}

async function bannersDetail(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  const doc = await db.collection('banners').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, row: doc.data }
}

async function bannersCreate(data) {
  const imageUrl = data && data.image_url ? String(data.image_url).trim() : ''
  const title = data && data.title !== undefined ? String(data.title || '').trim() : ''
  const subTitle = data && data.sub_title !== undefined ? String(data.sub_title || '').trim() : ''
  const order = toInt(data && data.order, 1)
  const active = data && data.active !== undefined ? Boolean(data.active) : true
  if (!imageUrl) return { success: false, msg: '缺少图片地址' }
  if (imageUrl.startsWith('/pages/')) return { success: false, msg: '图片地址不合法，请填写 cloud:// 或 https:// 或 /images/...（不要填写页面路径）' }
  if (title && title.length > 30) return { success: false, msg: '主标题过长（最多30字）' }
  if (subTitle && subTitle.length > 60) return { success: false, msg: '副标题过长（最多60字）' }
  const res = await db.collection('banners').add({
    data: {
      image_url: imageUrl,
      title,
      sub_title: subTitle,
      order,
      active,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
  return { success: true, _id: res._id }
}

async function bannersUpdate(data) {
  const id = data && data._id ? String(data._id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (!patch) return { success: false, msg: '缺少patch' }
  const allow = {}
  if (patch.image_url !== undefined) {
    const next = String(patch.image_url || '').trim()
    if (!next) return { success: false, msg: '图片地址不能为空' }
    if (next.startsWith('/pages/')) return { success: false, msg: '图片地址不合法，请填写 cloud:// 或 https:// 或 /images/...（不要填写页面路径）' }
    allow.image_url = next
  }
  if (patch.title !== undefined) {
    const next = String(patch.title || '').trim()
    if (next && next.length > 30) return { success: false, msg: '主标题过长（最多30字）' }
    allow.title = next
  }
  if (patch.sub_title !== undefined) {
    const next = String(patch.sub_title || '').trim()
    if (next && next.length > 60) return { success: false, msg: '副标题过长（最多60字）' }
    allow.sub_title = next
  }
  if (patch.order !== undefined) allow.order = toInt(patch.order, 1)
  if (patch.active !== undefined) allow.active = Boolean(patch.active)
  allow.updated_at = db.serverDate()
  await db.collection('banners').doc(id).update({ data: allow })
  return { success: true }
}

async function bannersDelete(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  await db.collection('banners').doc(id).remove()
  return { success: true }
}

async function bannersToggle(data) {
  const id = data && data._id ? String(data._id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('banners').doc(id).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function appointmentItemsList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const q = data && data.q ? String(data.q).trim() : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  const andList = []
  if (q) andList.push({ name: db.RegExp({ regexp: q, options: 'i' }) })
  if (active !== null) andList.push({ active })
  const where = andList.length > 0 ? _.and(andList) : {}
  const totalRes = await db.collection('appointment_items').where(where).count()
  const rows = await db.collection('appointment_items').where(where).orderBy('name', 'asc').skip(skip).limit(limit).get()
  return { success: true, list: rows.data || [], page, page_size, total: totalRes.total }
}

async function appointmentItemsDetail(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  const doc = await db.collection('appointment_items').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, row: doc.data }
}

async function appointmentItemsCreate(data) {
  const name = data && data.name ? String(data.name).trim() : ''
  const imageUrl = data && data.image_url ? String(data.image_url).trim() : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : true
  if (!name) return { success: false, msg: '缺少项目名称' }
  const payload = { name, active, created_at: db.serverDate(), updated_at: db.serverDate() }
  if (imageUrl) payload.image_url = imageUrl
  const res = await db.collection('appointment_items').add({ data: payload })
  return { success: true, _id: res._id }
}

async function appointmentItemsUpdate(data) {
  const id = data && data._id ? String(data._id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (!patch) return { success: false, msg: '缺少patch' }
  const allow = {}
  if (patch.name !== undefined) allow.name = String(patch.name || '').trim()
  if (patch.image_url !== undefined) allow.image_url = String(patch.image_url || '').trim()
  if (patch.active !== undefined) allow.active = Boolean(patch.active)
  allow.updated_at = db.serverDate()
  await db.collection('appointment_items').doc(id).update({ data: allow })
  return { success: true }
}

async function appointmentItemsDelete(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  await db.collection('appointment_items').doc(id).remove()
  return { success: true }
}

async function appointmentItemsToggle(data) {
  const id = data && data._id ? String(data._id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('appointment_items').doc(id).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function appointmentSchedulesList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const itemId = data && data.item_id ? String(data.item_id) : ''
  const date = data && data.date ? String(data.date) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null

  const andList = []
  if (itemId) andList.push({ item_id: itemId })
  if (date) andList.push({ date })
  if (active !== null) andList.push({ active })
  const where = andList.length > 0 ? _.and(andList) : {}
  const totalRes = await db.collection('appointment_schedules').where(where).count()
  const rows = await db.collection('appointment_schedules').where(where).orderBy('date', 'desc').skip(skip).limit(limit).get()
  return { success: true, list: rows.data || [], page, page_size, total: totalRes.total }
}

async function appointmentSchedulesDetail(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  const doc = await db.collection('appointment_schedules').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, row: doc.data }
}

async function appointmentSchedulesCreate(data) {
  const itemId = data && data.item_id ? String(data.item_id) : ''
  const date = data && data.date ? String(data.date) : ''
  const timeSlot = data && data.time_slot ? String(data.time_slot) : ''
  const maxCount = toInt(data && (data.max_count !== undefined ? data.max_count : data.capacity), 0)
  const bookedCount = toInt(data && (data.booked_count !== undefined ? data.booked_count : data.booked), 0)
  const active = data && data.active !== undefined ? Boolean(data.active) : true
  if (!itemId || !date || !timeSlot) return { success: false, msg: '缺少项目/日期/时段' }
  const res = await db.collection('appointment_schedules').add({
    data: { item_id: itemId, date, time_slot: timeSlot, max_count: maxCount, booked_count: bookedCount, active, created_at: db.serverDate(), updated_at: db.serverDate() }
  })
  return { success: true, _id: res._id }
}

async function appointmentSchedulesUpdate(data) {
  const id = data && data._id ? String(data._id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (!patch) return { success: false, msg: '缺少patch' }

  const allow = {}
  if (patch.item_id !== undefined) allow.item_id = String(patch.item_id || '')
  if (patch.date !== undefined) allow.date = String(patch.date || '')
  if (patch.time_slot !== undefined) allow.time_slot = String(patch.time_slot || '')
  if (patch.max_count !== undefined) allow.max_count = toInt(patch.max_count, 0)
  if (patch.booked_count !== undefined) allow.booked_count = toInt(patch.booked_count, 0)
  if (patch.active !== undefined) allow.active = Boolean(patch.active)
  allow.updated_at = db.serverDate()
  await db.collection('appointment_schedules').doc(id).update({ data: allow })
  return { success: true }
}

async function appointmentSchedulesDelete(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  await db.collection('appointment_schedules').doc(id).remove()
  return { success: true }
}

async function appointmentSchedulesToggle(data) {
  const id = data && data._id ? String(data._id) : ''
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('appointment_schedules').doc(id).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

async function appointmentRecordsList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const childId = data && data.child_id ? String(data.child_id) : ''
  const status = data && data.status ? String(data.status) : ''
  const phone = data && data.phone ? String(data.phone) : ''
  const date = data && data.date ? String(data.date) : ''

  const andList = []
  if (childId) andList.push({ child_id: childId })
  if (status) andList.push({ status })
  if (phone) andList.push({ phone })
  if (date) andList.push({ date })
  const where = andList.length > 0 ? _.and(andList) : {}
  const totalRes = await db.collection('appointment_records').where(where).count()
  const rows = await db.collection('appointment_records').where(where).orderBy('created_at', 'desc').skip(skip).limit(limit).get()
  return { success: true, list: rows.data || [], page, page_size, total: totalRes.total }
}

async function appointmentRecordsDetail(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  const doc = await db.collection('appointment_records').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, row: doc.data }
}

async function appointmentRecordsUpdate(data) {
  const id = data && data._id ? String(data._id) : ''
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少ID' }
  if (!patch) return { success: false, msg: '缺少patch' }
  const allow = { ...patch }
  delete allow._id
  allow.updated_at = db.serverDate()
  await db.collection('appointment_records').doc(id).update({ data: allow })
  return { success: true }
}

async function appointmentRecordsDelete(data) {
  const id = data && data._id ? String(data._id) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  await db.collection('appointment_records').doc(id).remove()
  return { success: true }
}

async function appointmentRecordsSetStatus(data) {
  const id = data && data._id ? String(data._id) : ''
  const status = data && data.status ? String(data.status) : ''
  if (!id) return { success: false, msg: '缺少ID' }
  if (!status) return { success: false, msg: '缺少status' }
  await db.collection('appointment_records').doc(id).update({ data: { status, updated_at: db.serverDate() } })
  return { success: true }
}

async function appointmentRecordsCreate(data) {
  const record = data && data.record && typeof data.record === 'object' ? data.record : null
  if (!record) return { success: false, msg: '缺少record' }
  const payload = { ...record }
  delete payload._id
  payload.created_at = db.serverDate()
  payload.updated_at = db.serverDate()
  const res = await db.collection('appointment_records').add({ data: payload })
  return { success: true, _id: res._id }
}

async function checkupRecordsList(data) {
  const { skip, limit, page, page_size } = pickPagination(data)
  const childId = data && data.child_id ? String(data.child_id) : ''
  const q = data && data.q ? String(data.q).trim() : ''
  const school = data && data.school ? String(data.school).trim() : ''
  const className = data && data.class_name ? String(data.class_name).trim() : ''
  const dateFrom = data && data.date_from ? String(data.date_from) : ''
  const dateTo = data && data.date_to ? String(data.date_to) : ''

  // 1) 先根据筛选条件确定 child_ids（避免 in 指令长度限制，采用分片合并）
  let childIds = []
  if (childId) {
    childIds = [childId]
  } else if (q || school || className) {
    const andChildren = []
    if (q) {
      andChildren.push(_.or([
        { name: db.RegExp({ regexp: q, options: 'i' }) },
        { parent_phone: db.RegExp({ regexp: q, options: 'i' }) },
        { child_no: db.RegExp({ regexp: q, options: 'i' }) }
      ]))
    }
    if (school) andChildren.push({ school })
    if (className) andChildren.push({ class_name: className })
    const childrenWhere = andChildren.length > 0 ? _.and(andChildren) : {}
    const childRows = await db.collection('children').where(childrenWhere).limit(200).get()
    childIds = (childRows.data || []).map((c) => c && c._id).filter(Boolean)
    if (childIds.length === 0) {
      return { success: true, list: [], page, page_size, total: 0 }
    }
  }

  const baseAnd = []
  if (dateFrom) baseAnd.push({ date: _.gte(dateFrom) })
  if (dateTo) baseAnd.push({ date: _.lte(dateTo) })

  function buildWhere(idsChunk) {
    const andList = [...baseAnd]
    if (Array.isArray(idsChunk) && idsChunk.length > 0) {
      andList.push({ child_id: _.in(idsChunk) })
    }
    return andList.length > 0 ? _.and(andList) : {}
  }

  async function enrichWithChildInfo(records) {
    const list = Array.isArray(records) ? records : []
    const ids = Array.from(new Set(list.map((r) => r && r.child_id).filter(Boolean)))
    if (ids.length === 0) return list

    const childMap = {}
    const chunkSize = 10
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const res = await db.collection('children').where({ _id: _.in(chunk) }).get()
      ;(res.data || []).forEach((c) => {
        if (c && c._id) childMap[c._id] = c
      })
    }

    return list.map((r) => {
      const c = r && r.child_id ? childMap[r.child_id] : null
      if (!c) return r
      return {
        ...r,
        child_name: c.name || '',
        school: c.school || '',
        class_name: c.class_name || '',
        parent_phone: c.parent_phone || '',
        child_no: c.child_no || ''
      }
    })
  }

  // 2) 查询记录（childIds 可能较多时，分片拉取后合并排序，再全局分页）
  const chunkSize = 10
  if (!Array.isArray(childIds) || childIds.length === 0) {
    const where = buildWhere([])
    const totalRes = await db.collection('checkup_records').where(where).count()
    const rows = await db.collection('checkup_records').where(where).orderBy('date', 'desc').skip(skip).limit(limit).get()
    const enriched = await enrichWithChildInfo(rows.data || [])
    return { success: true, list: enriched, page, page_size, total: totalRes.total }
  }

  // 单分片可直接分页
  if (childIds.length <= chunkSize) {
    const where = buildWhere(childIds)
    const totalRes = await db.collection('checkup_records').where(where).count()
    const rows = await db.collection('checkup_records').where(where).orderBy('date', 'desc').skip(skip).limit(limit).get()
    const enriched = await enrichWithChildInfo(rows.data || [])
    return { success: true, list: enriched, page, page_size, total: totalRes.total }
  }

  // 多分片：每片拉取前 page*page_size 条，再合并排序后做全局分页
  const fetchLimit = Math.min(page * page_size, 500)
  let total = 0
  const merged = []
  for (let i = 0; i < childIds.length; i += chunkSize) {
    const chunk = childIds.slice(i, i + chunkSize)
    const where = buildWhere(chunk)
    const c = await db.collection('checkup_records').where(where).count()
    total += c.total || 0
    const rows = await db.collection('checkup_records').where(where).orderBy('date', 'desc').limit(fetchLimit).get()
    ;(rows.data || []).forEach((r) => merged.push(r))
  }

  merged.sort((a, b) => {
    const da = a && a.date ? String(a.date) : ''
    const dbb = b && b.date ? String(b.date) : ''
    if (dbb !== da) return dbb.localeCompare(da)
    const ia = a && a._id ? String(a._id) : ''
    const ib = b && b._id ? String(b._id) : ''
    return ib.localeCompare(ia)
  })

  const paged = merged.slice(skip, skip + limit)
  const enriched = await enrichWithChildInfo(paged)
  return { success: true, list: enriched, page, page_size, total }
}

async function checkupRecordsDetail(data) {
  const id = data && data.record_id ? String(data.record_id) : (data && data._id ? String(data._id) : '')
  if (!id) return { success: false, msg: '缺少记录ID' }
  const doc = await db.collection('checkup_records').doc(id).get()
  if (!doc.data) return { success: false, msg: '记录不存在' }
  return { success: true, record: doc.data }
}

async function checkupRecordsCreate(data) {
  const record = data && data.record && typeof data.record === 'object' ? data.record : null
  if (!record) return { success: false, msg: '缺少record' }
  const cleaned = normalizeRecordInput(record)
  if (!cleaned.child_id) return { success: false, msg: '缺少孩子ID' }
  if (!cleaned.date) return { success: false, msg: '缺少检测日期' }
  // 允许同一天多份记录：不再限制 (child_id, date) 唯一
  const res = await db.collection('checkup_records').add({ data: { ...cleaned, created_at: db.serverDate(), updated_at: db.serverDate() } })
  return { success: true, record_id: res._id }
}

async function checkupRecordsUpdate(data) {
  const id = data && data.record_id ? String(data.record_id) : (data && data._id ? String(data._id) : '')
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!id) return { success: false, msg: '缺少记录ID' }
  if (!patch) return { success: false, msg: '缺少patch' }
  const oldDoc = await db.collection('checkup_records').doc(id).get()
  const old = oldDoc && oldDoc.data
  if (!old) return { success: false, msg: '记录不存在' }

  const cleanedPatch = normalizeRecordPatch(patch)
  if (cleanedPatch.child_id && cleanedPatch.child_id !== old.child_id) return { success: false, msg: '不允许修改孩子ID' }
  // 允许同一天多份记录：不再限制 (child_id, date) 唯一
  await db.collection('checkup_records').doc(id).update({ data: { ...cleanedPatch, updated_at: db.serverDate() } })
  return { success: true }
}

async function checkupRecordsDelete(data) {
  const id = data && data.record_id ? String(data.record_id) : (data && data._id ? String(data._id) : '')
  if (!id) return { success: false, msg: '缺少记录ID' }
  await db.collection('checkup_records').doc(id).remove()
  return { success: true }
}

async function checkupRecordsToggle(data) {
  const id = data && data.record_id ? String(data.record_id) : (data && data._id ? String(data._id) : '')
  const active = data && data.active !== undefined ? Boolean(data.active) : null
  if (!id) return { success: false, msg: '缺少记录ID' }
  if (active === null) return { success: false, msg: '缺少active' }
  await db.collection('checkup_records').doc(id).update({ data: { active, updated_at: db.serverDate() } })
  return { success: true }
}

// ——— system_config：协议与隐私（terms_and_privacy）———
const TERMS_KEY = 'terms_and_privacy'
const TERMS_FIELDS = ['user_agreement', 'privacy_policy', 'child_privacy_policy', 'third_party_share_list']

async function systemConfigTermsGet() {
  const res = await db.collection('system_config').where({ key: TERMS_KEY }).limit(1).get()
  if (res.data && res.data.length > 0) {
    return { success: true, row: res.data[0] }
  }

  const defaults = {
    key: TERMS_KEY,
    user_agreement: '',
    privacy_policy: '',
    child_privacy_policy: '',
    third_party_share_list: '',
    created_at: db.serverDate(),
    updated_at: db.serverDate()
  }
  const add = await db.collection('system_config').add({ data: defaults })
  const doc = await db.collection('system_config').doc(add._id).get()
  return { success: true, row: doc && doc.data ? doc.data : { _id: add._id, ...defaults } }
}

async function systemConfigTermsUpdate(data) {
  const patch = (data && data.patch && typeof data.patch === 'object') ? data.patch : null
  if (!patch) return { success: false, msg: '缺少patch' }

  const allow = { updated_at: db.serverDate() }
  TERMS_FIELDS.forEach((k) => {
    if (patch[k] !== undefined) allow[k] = String(patch[k] ?? '')
  })

  const exist = await db.collection('system_config').where({ key: TERMS_KEY }).limit(1).get()
  if (exist.data && exist.data.length > 0) {
    await db.collection('system_config').doc(exist.data[0]._id).update({ data: allow })
    return { success: true }
  }

  const payload = {
    key: TERMS_KEY,
    ...allow,
    created_at: db.serverDate()
  }
  await db.collection('system_config').add({ data: payload })
  return { success: true }
}

// ——— 仪表盘 dashboard ———
function pctChange(cur, prev) {
  const c = Number(cur) || 0
  const p = Number(prev) || 0
  if (p <= 0) return c > 0 ? '+100%' : '+0%'
  const v = ((c - p) / p) * 100
  const n = Math.round(v)
  return `${n >= 0 ? '+' : ''}${n}%`
}

async function safeCount(collectionName, where) {
  try {
    const res = where ? await db.collection(collectionName).where(where).count() : await db.collection(collectionName).count()
    return res && typeof res.total === 'number' ? res.total : 0
  } catch (e) {
    return 0
  }
}

async function dashboardStats() {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const onlineWindowMs = 5 * 60 * 1000

  const totalUsers = await safeCount('users', { deleted: _.neq(true) })
  const totalChildren = await safeCount('children')
  const totalAppointments = await safeCount('appointment_records')
  const totalCheckups = await safeCount('checkup_records')

  // 新用户：近 7 天
  let newUsers7d = 0
  let newUsersPrev7d = 0
  try {
    const start7d = new Date(now - 7 * DAY)
    const start14d = new Date(now - 14 * DAY)
    newUsers7d = await safeCount('users', { deleted: _.neq(true), created_at: _.gte(start7d) })
    newUsersPrev7d = await safeCount(
      'users',
      _.and([{ deleted: _.neq(true) }, { created_at: _.gte(start14d) }, { created_at: _.lt(start7d) }])
    )
  } catch (e) {
    // ignore
  }

  // 访问/点击（来自埋点事件）
  const totalVisits = await safeCount('analytics_events', { type: 'page_view' })
  const totalClicks = await safeCount('analytics_events', { type: 'click' })
  const onlineVisitors = await safeCount('analytics_visitors', { last_seen_ms: _.gte(now - onlineWindowMs) })

  const visits7d = await safeCount('analytics_events', { type: 'page_view', created_at_ms: _.gte(now - 7 * DAY) })
  const visitsPrev7d = await safeCount(
    'analytics_events',
    _.and([
      { type: 'page_view' },
      { created_at_ms: _.gte(now - 14 * DAY) },
      { created_at_ms: _.lt(now - 7 * DAY) }
    ])
  )
  const clicks7d = await safeCount('analytics_events', { type: 'click', created_at_ms: _.gte(now - 7 * DAY) })
  const clicksPrev7d = await safeCount(
    'analytics_events',
    _.and([{ type: 'click' }, { created_at_ms: _.gte(now - 14 * DAY) }, { created_at_ms: _.lt(now - 7 * DAY) }])
  )

  // 最近 12 个月访问量（按月 count）
  const xAxis = []
  const series = []
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    d.setHours(0, 0, 0, 0)
    const start = d.getTime()
    const next = new Date(d)
    next.setMonth(next.getMonth() + 1, 1)
    next.setHours(0, 0, 0, 0)
    const end = next.getTime()

    xAxis.push(`${d.getMonth() + 1}月`)
    const c = await safeCount(
      'analytics_events',
      _.and([{ type: 'page_view' }, { created_at_ms: _.gte(start) }, { created_at_ms: _.lt(end) }])
    )
    series.push(c)
  }

  // 新用户列表（最近）
  let newUsersList = []
  try {
    const rows = await db.collection('users').where({ deleted: _.neq(true) }).orderBy('created_at', 'desc').limit(8).get()
    newUsersList = (rows.data || []).map((u) => ({
      user_id: u._id,
      phone: u.phone || '',
      display_name: u.display_name || '',
      avatar_file_id: u.avatar_file_id || '',
      created_at: u.created_at
    }))
  } catch (e) {
    newUsersList = []
  }

  // 动态：最近事件
  let dynamics = []
  try {
    const evRows = await db.collection('analytics_events').orderBy('created_at_ms', 'desc').limit(10).get()
    const events = evRows.data || []
    const userIds = Array.from(new Set(events.map((e) => e && e.user_id).filter(Boolean)))

    const userMap = {}
    const chunkSize = 10
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize)
      const res = await db.collection('users').where({ _id: _.in(chunk) }).get()
      ;(res.data || []).forEach((u) => {
        if (u && u._id) userMap[u._id] = u
      })
    }

    dynamics = events.map((e) => {
      const u = e && e.user_id ? userMap[e.user_id] : null
      const username = (u && (u.display_name || u.phone)) || (e && e.visitor_id ? String(e.visitor_id).slice(0, 6) : '访客')
      const type = e && e.type === 'click' ? '点击了' : '访问了'
      const target = (e && (e.page || e.name)) ? String(e.page || e.name) : '未知页面'
      return { username, type, target }
    })
  } catch (e) {
    dynamics = []
  }

  return {
    success: true,
    cards: {
      total_visits: totalVisits,
      online_visitors: onlineVisitors,
      click_count: totalClicks || totalVisits,
      new_users_7d: newUsers7d
    },
    changes: {
      total_visits: pctChange(visits7d, visitsPrev7d),
      click_count: pctChange(clicks7d, clicksPrev7d),
      new_users_7d: pctChange(newUsers7d, newUsersPrev7d)
    },
    overview: {
      total_users: totalUsers,
      total_children: totalChildren,
      total_appointments: totalAppointments,
      total_checkups: totalCheckups
    },
    visits_series: { xAxis, data: series },
    new_users_list: newUsersList,
    dynamics
  }
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
  if (typeof r.vision_both === 'string') cleaned.vision_both = r.vision_both

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
    if (p.height === null || p.height === '') cleaned.height = _.remove()
    else {
      const n = Number(p.height)
      if (!Number.isNaN(n)) cleaned.height = n
    }
  }
  if (p.weight !== undefined) {
    if (p.weight === null || p.weight === '') cleaned.weight = _.remove()
    else {
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
  if (p.vision_both !== undefined) {
    if (p.vision_both === null || p.vision_both === '') cleaned.vision_both = _.remove()
    else if (typeof p.vision_both === 'string') cleaned.vision_both = p.vision_both
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
