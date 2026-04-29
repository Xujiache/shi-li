/**
 * 冲突合并辅助：
 *   - defaultSchemaForType(type)：返回字段名 → 中文 label 的映射
 *   - diffFields(mine, server, schema)：找出有差异的字段（用于 UI 显示）
 *
 * 设计：
 *   - v1 简化为整体二选一（用我的 / 用服务器），diff 仅作展示
 *   - 未在 schema 中声明的字段不展示（避免把内部字段如 base_version 暴露出来）
 *   - mine / server 中任一缺失也算差异（旧字段被移除 / 新字段被添加）
 */

export interface FieldSchema {
  field: string
  label: string
}

export interface DiffRow {
  field: string
  label: string
  mine: any
  server: any
}

/**
 * 三种业务类型的字段标签映射。后端 conflict 返回的 current_payload 只会包含其中字段。
 */
export function defaultSchemaForType(type: string): FieldSchema[] {
  switch (type) {
    case 'customer':
      return [
        { field: 'name', label: '姓名' },
        { field: 'phone', label: '手机号' },
        { field: 'gender', label: '性别' },
        { field: 'age', label: '年龄' },
        { field: 'level', label: '客户等级' },
        { field: 'status', label: '状态' },
        { field: 'source', label: '来源' },
        { field: 'next_follow_up_at', label: '下次跟进时间' },
        { field: 'next_follow_up_text', label: '下次跟进事项' },
        { field: 'remark', label: '备注' }
      ]
    case 'follow_up':
      return [
        { field: 'type', label: '跟进类型' },
        { field: 'result', label: '跟进结果' },
        { field: 'content', label: '跟进内容' },
        { field: 'next_follow_up_at', label: '下次跟进时间' }
      ]
    case 'transfer':
      return [
        { field: 'reason', label: '转出原因' },
        { field: 'target_department_id', label: '目标部门' },
        { field: 'remark', label: '备注' }
      ]
    default:
      return []
  }
}

function isEmpty(v: any): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0)
}

function eq(a: any, b: any): boolean {
  if (a === b) return true
  if (isEmpty(a) && isEmpty(b)) return true
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b) } catch (e) { return false }
  }
  return String(a) === String(b)
}

/**
 * 找出两个 payload 中字段差异，按 schema 给定的字段顺序输出。
 */
export function diffFields(mine: any, server: any, schema: FieldSchema[]): DiffRow[] {
  const out: DiffRow[] = []
  const m = mine || {}
  const s = server || {}
  for (const f of schema) {
    const a = m[f.field]
    const b = s[f.field]
    if (!eq(a, b)) {
      out.push({ field: f.field, label: f.label, mine: a, server: b })
    }
  }
  return out
}
