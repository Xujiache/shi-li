const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/** 解析当前用户：若传入 user_id 则按 user_id 查用户得到 _openid/phone，否则按设备 OPENID 查。用于同设备多账号不串号。 */
async function getCurrentUserContext(wxContext, eventPayload) {
  const user_id = (eventPayload && (eventPayload.user_id || (eventPayload.data && eventPayload.data.user_id))) || null
  if (user_id) {
    try {
      const doc = await db.collection('users').doc(String(user_id)).get()
      const u = (doc && doc.data) ? doc.data : (doc && doc._id ? doc : null)
      if (u) {
        return {
          _openid: wxContext.OPENID,
          phone: u.phone != null ? String(u.phone).trim() : null,
          user_id: String(user_id),
          from_user_id: true
        }
      }
    } catch (e) {}
  }
  let phone = null
  const res = await db.collection('users').where({ _openid: wxContext.OPENID }).limit(1).get()
  if (res.data.length > 0 && res.data[0] && res.data[0].phone != null) phone = String(res.data[0].phone).trim()
  return { _openid: wxContext.OPENID, phone, user_id: null, from_user_id: false }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event

  switch (action) {
    case 'get':
      try {
        const { _openid, phone, from_user_id } = await getCurrentUserContext(wxContext, event)

        let query
        // 通过 user_id（手机号账号登录）识别到用户时，只按手机号归属查询，
        // 避免同一微信 OPENID 下多手机号账号的数据被 _openid 条件“并集”到一起。
        if (from_user_id && phone) {
          query = db.collection('children').where({ parent_phone: phone })
        } else {
          query = db.collection('children').where({ _openid })
          if (phone) {
            query = db.collection('children').where(_.or([{ _openid }, { parent_phone: phone }]))
          }
        }

        const res = await query.get()

        let list = Array.isArray(res.data) ? res.data : []

        // Clean up invalid docs created by earlier bugs (e.g., _id: null)
        const hasNullId = list.some((c) => c && (c._id === null || c._id === undefined))
        if (hasNullId) {
          try {
            await db.collection('children').where({ _id: null }).remove()
          } catch (e) {
            // ignore
          }
          list = list.filter((c) => c && c._id)
        }

        // Ensure child_no exists for all children
        for (const child of list) {
          if (!child) continue
          if (child.child_no) continue
          try {
            const childNo = await generateUniqueChildNo(_openid)
            await db.collection('children').doc(child._id).update({
              data: { child_no: childNo, updated_at: db.serverDate() }
            })
            child.child_no = childNo
          } catch (e) {
            // ignore
          }
        }

        // If we matched by parent_phone but openid differs, bind to current openid
        if (phone && list && list.length > 0) {
          const needBind = list.filter((c) => c && c.parent_phone === phone && c._openid !== _openid)
          for (const child of needBind) {
            try {
              await db.collection('children').doc(child._id).update({
                data: { _openid, updated_at: db.serverDate() }
              })
              child._openid = _openid
            } catch (e) {
              // ignore
            }
          }
        }

        return { success: true, list }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'get_school_options':
      try {
        const rows = await db
          .collection('school_classes')
          .where({ active: _.neq(false) })
          .limit(1000)
          .get()

        const list = Array.isArray(rows.data) ? rows.data : []
        const schoolSet = new Set()
        const map = {}
        for (const r of list) {
          const school = r && typeof r.school === 'string' ? r.school.trim() : ''
          const className = r && typeof r.class_name === 'string' ? r.class_name.trim() : ''
          if (!school || !className) continue
          schoolSet.add(school)
          if (!map[school]) map[school] = []
          if (!map[school].includes(className)) map[school].push(className)
        }
        const schools = Array.from(schoolSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
        for (const s of schools) {
          map[s].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
        }

        return { success: true, schools, classes_map: map }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'delete_child':
      try {
        const { _id } = data || {}
        if (!_id) return { success: false, msg: '缺少孩子ID' }

        const { _openid, phone, from_user_id } = await getCurrentUserContext(wxContext, event)

        const doc = await db.collection('children').doc(_id).get()
        const child = doc && doc.data
        if (!child) return { success: false, msg: '孩子不存在' }

        const can = (from_user_id && phone)
          ? (child.parent_phone === phone)
          : (child._openid === _openid || (phone && child.parent_phone === phone))
        if (!can) return { success: false, msg: '无权限删除该孩子' }

        await db.collection('children').doc(_id).remove()
        return { success: true }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    case 'update':
      try {
        const ctx = await getCurrentUserContext(wxContext, event)
        const _openid = ctx && ctx._openid ? ctx._openid : wxContext.OPENID
        const parent_phone = ctx && ctx.phone ? ctx.phone : null
        const from_user_id = !!(ctx && ctx.from_user_id)

        // data contains child info. if _id exists, update; else add.
        if (data._id) {
          const { _id, ...rest } = data
          // 权限校验：避免同设备多账号或缓存 child_id 导致跨账号误改
          const oldDoc = await db.collection('children').doc(_id).get()
          const old = oldDoc && oldDoc.data
          if (!old) return { success: false, msg: '孩子不存在' }

          const can = (from_user_id && parent_phone)
            ? (old.parent_phone === parent_phone)
            : (old._openid === _openid || (parent_phone && old.parent_phone === parent_phone))
          if (!can) return { success: false, msg: '无权限修改该孩子' }

          await db.collection('children').doc(_id).update({
            data: { ...rest, _openid, parent_phone, updated_at: db.serverDate() }
          })
          return { success: true }
        } else {
          const { _id, ...rest } = data || {}
          if (!rest.child_no) {
            try {
              rest.child_no = await generateUniqueChildNo(_openid)
            } catch (e) {
              // ignore
            }
          }
          await db.collection('children').add({
            data: { ...rest, _openid, parent_phone, created_at: db.serverDate(), updated_at: db.serverDate() }
          })
          return { success: true }
        }
      } catch (e) {
        return { success: false, msg: e.message }
      }
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function generateUniqueChildNo(_openid) {
  for (let i = 0; i < 8; i += 1) {
    const first = Math.floor(Math.random() * 9) + 1
    let s = String(first)
    for (let j = 0; j < 7; j += 1) s += String(Math.floor(Math.random() * 10))
    const exist = await db.collection('children').where({ child_no: s }).limit(1).get()
    if (!exist.data || exist.data.length === 0) return s
  }
  throw new Error('GEN_CHILD_NO_FAILED')
}
