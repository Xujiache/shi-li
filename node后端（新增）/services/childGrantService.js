/**
 * 孩子档案 — 部门授权 / 字段权限解析。
 *
 * 三个职责：
 *   1. 部门 × 字段组(section_key) 授权管理（dept_field_grants）
 *   2. 孩子 × 部门 多对多归属管理（child_dept_assignments）
 *   3. 给定员工部门，解析"可编辑 sections / fields"集合（员工 APP 写入校验用）
 *
 * 字段组定义来自 system_configs.profile_field_config（contentService 维护）。
 * 本 service 不动该配置，只引用其 sections[].key 与 fields[].key。
 */
const { StatusCodes } = require('http-status-codes')
const { execute, query, queryOne } = require('../utils/db')
const { createAppError } = require('../utils/appError')
const { getProfileFieldConfig } = require('./contentService')

// ===== 工具：拿全集 sections =====
async function getAllSections() {
  const cfg = await getProfileFieldConfig()
  return Array.isArray(cfg && cfg.sections) ? cfg.sections : []
}

// ===== 部门授权：dept_field_grants =====

/**
 * 列出某部门已授权的 section_keys。
 * @param {number|string} deptId
 * @returns {Promise<string[]>}
 */
async function listGrantsByDepartment(deptId) {
  const rows = await query(
    'SELECT section_key FROM dept_field_grants WHERE department_id = ?',
    [Number(deptId)]
  )
  return rows.map((r) => String(r.section_key))
}

/**
 * 列出所有部门授权（管理矩阵用）。
 * @returns {Promise<Array<{department_id:number, section_keys:string[]}>>}
 */
async function listAllGrants() {
  const rows = await query(
    'SELECT department_id, section_key FROM dept_field_grants ORDER BY department_id ASC'
  )
  const map = new Map()
  for (const r of rows) {
    const id = Number(r.department_id)
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(String(r.section_key))
  }
  return Array.from(map.entries()).map(([department_id, section_keys]) => ({
    department_id,
    section_keys
  }))
}

/**
 * 全量重写某部门的授权（事务：DELETE + INSERT）。
 * 自动过滤掉 profile_field_config 不存在的 section_key。
 * @param {number|string} deptId
 * @param {string[]} sectionKeys
 * @returns {Promise<{department_id:number, section_keys:string[]}>}
 */
async function setDepartmentGrants(deptId, sectionKeys) {
  const did = Number(deptId)
  if (!did) throw createAppError('部门 id 必填', StatusCodes.BAD_REQUEST)
  const inputKeys = Array.isArray(sectionKeys) ? sectionKeys.map(String) : []

  // 过滤合法 keys（在 profile_field_config 里实际存在的 section）
  const sections = await getAllSections()
  const validKeys = new Set(sections.map((s) => String(s.key)))
  const safeKeys = Array.from(new Set(inputKeys.filter((k) => validKeys.has(k))))

  await execute('DELETE FROM dept_field_grants WHERE department_id = ?', [did])
  if (safeKeys.length > 0) {
    const placeholders = safeKeys.map(() => '(?, ?)').join(', ')
    const values = []
    for (const k of safeKeys) {
      values.push(did, k)
    }
    await execute(
      `INSERT INTO dept_field_grants (department_id, section_key) VALUES ${placeholders}`,
      values
    )
  }
  return { department_id: did, section_keys: safeKeys }
}

// ===== 孩子归属：child_dept_assignments =====

/**
 * 一个孩子分到了哪些部门。
 * @param {number|string} childId
 * @returns {Promise<number[]>}
 */
async function listDeptsByChild(childId) {
  const rows = await query(
    'SELECT department_id FROM child_dept_assignments WHERE child_id = ?',
    [Number(childId)]
  )
  return rows.map((r) => Number(r.department_id))
}

/**
 * 一组部门负责的所有 child_id。
 * @param {Array<number|string>} deptIds
 * @returns {Promise<number[]>}
 */
async function listChildIdsByDept(deptIds) {
  const ids = (Array.isArray(deptIds) ? deptIds : [deptIds]).map(Number).filter(Boolean)
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await query(
    `SELECT DISTINCT child_id FROM child_dept_assignments WHERE department_id IN (${placeholders})`,
    ids
  )
  return rows.map((r) => Number(r.child_id))
}

/**
 * 全量重写某孩子的部门归属。
 * @param {number|string} childId
 * @param {Array<number|string>} deptIds
 * @param {number} [actorAdminId]
 */
async function setChildAssignments(childId, deptIds, actorAdminId) {
  const cid = Number(childId)
  if (!cid) throw createAppError('child_id 必填', StatusCodes.BAD_REQUEST)
  const ids = Array.from(
    new Set((Array.isArray(deptIds) ? deptIds : []).map(Number).filter(Boolean))
  )
  await execute('DELETE FROM child_dept_assignments WHERE child_id = ?', [cid])
  if (ids.length > 0) {
    const placeholders = ids.map(() => '(?, ?, ?)').join(', ')
    const values = []
    for (const did of ids) {
      values.push(cid, did, actorAdminId || null)
    }
    await execute(
      `INSERT INTO child_dept_assignments (child_id, department_id, assigned_by) VALUES ${placeholders}`,
      values
    )
  }
  return { child_id: cid, department_ids: ids }
}

// ===== 字段权限解析（员工端核心）=====

/**
 * 给定员工的 department_id，解析其可编辑 sections + fields。
 * @param {number|string} employeeDeptId
 * @returns {Promise<{
 *   allowed_section_keys: string[],
 *   allowed_field_keys: string[],
 *   allowed_sections: Array<Record<string, any>>
 * }>}
 */
async function resolveEditableFields(employeeDeptId) {
  const did = Number(employeeDeptId)
  if (!did) {
    return { allowed_section_keys: [], allowed_field_keys: [], allowed_sections: [] }
  }
  const grantedKeys = new Set(await listGrantsByDepartment(did))
  const sections = await getAllSections()
  const allowed_sections = sections.filter(
    (s) => grantedKeys.has(String(s.key)) && s.enabled !== false
  )
  const allowed_section_keys = allowed_sections.map((s) => String(s.key))
  const allowed_field_keys = []
  for (const s of allowed_sections) {
    if (Array.isArray(s.fields)) {
      for (const f of s.fields) {
        if (f && f.key && f.enabled !== false && !f.readonly) {
          allowed_field_keys.push(String(f.key))
        }
      }
    }
  }
  return {
    allowed_section_keys,
    allowed_field_keys,
    allowed_sections
  }
}

module.exports = {
  listGrantsByDepartment,
  listAllGrants,
  setDepartmentGrants,
  listDeptsByChild,
  listChildIdsByDept,
  setChildAssignments,
  resolveEditableFields,
  getAllSections
}
