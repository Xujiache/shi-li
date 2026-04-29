/**
 * 孩子档案相关接口封装（员工 APP 端）。
 * 后端路径：/children
 *   list   → {list, total, page, page_size}              api 层 unwrap → {items, total, page, page_size}
 *   detail → {child, allowed_section_keys, allowed_field_keys, allowed_sections}
 *                                                         api 层保留原状（调用点直接用）
 *   update → {child, accepted_fields, dropped_fields}     api 层保留原状
 */
import { http } from './http'

export interface ChildListQuery {
  q?: string
  school?: string
  grade_name?: string
  page?: number
  page_size?: number
  [k: string]: any
}

export interface ChildSectionField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'textarea' | 'readonly'
  options?: string[]
  placeholder?: string
  enabled?: boolean
  required?: boolean
  readonly?: boolean
  sort_order?: number
}

export interface ChildSection {
  key: string
  label: string
  enabled?: boolean
  sort_order?: number
  fields: ChildSectionField[]
}

export interface ChildDetailResp {
  child: any
  allowed_section_keys: string[]
  allowed_field_keys: string[]
  allowed_sections: ChildSection[]
}

export async function list(params?: ChildListQuery) {
  const r: any = await http.get<any>('/children', params)
  return {
    items: r?.list || r?.items || [],
    total: r?.total || 0,
    page: r?.page || 1,
    page_size: r?.page_size || 20
  }
}

export function detail(id: number | string) {
  return http.get<ChildDetailResp>(`/children/${id}`)
}

export function update(id: number | string, patch: Record<string, any>) {
  return http.put<{ child: any; accepted_fields: string[]; dropped_fields: string[] }>(
    `/children/${id}`,
    patch
  )
}

// ===== AI / 人工分析 =====
export interface ChildAnalysis {
  id: number
  child_id: number
  source: 'human' | 'ai'
  content: string
  model: string | null
  tokens_used: number | null
  active: boolean
  created_at: string
  updated_at: string
  prompt_meta?: Record<string, any> | null
}

export interface CorrectionOption {
  code?: string
  label: string
  source?: 'base' | 'ai' | 'selected' | 'custom'
}

export interface CorrectionPromptResp {
  prompt: string
  summary: string
  base_options: CorrectionOption[]
  suggested_options: CorrectionOption[]
}

export interface AnalysisCorrection {
  id: number
  child_id: number
  original_analysis_id: number
  corrected_analysis_id: number
  question_prompt: string
  question_summary: string
  generated_options: CorrectionOption[]
  selected_options: CorrectionOption[]
  custom_reason: string
  created_by_employee_id: number | null
  created_by_admin_id: number | null
  created_at: string
  updated_at: string
}

export function listAnalyses(id: number | string) {
  return http.get<{ mode: string; current: ChildAnalysis | null; list: ChildAnalysis[] }>(
    `/children/${id}/analyses`
  )
}

export function writeHumanAnalysis(id: number | string, content: string) {
  return http.post<{ analysis: ChildAnalysis }>(`/children/${id}/analyses`, { content })
}

export function getCorrectionPrompt(
  id: number | string,
  analysisId: number | string,
  editedContent: string
) {
  return http.post<CorrectionPromptResp>(
    `/children/${id}/analyses/${analysisId}/correction-prompt`,
    { edited_content: editedContent }
  )
}

export function submitAnalysisCorrection(
  id: number | string,
  analysisId: number | string,
  payload: {
    edited_content: string
    selected_options: CorrectionOption[]
    custom_reason?: string
    question_prompt?: string
    question_summary?: string
    generated_options?: CorrectionOption[]
  }
) {
  return http.post<{
    original_analysis: ChildAnalysis
    analysis: ChildAnalysis
    correction: AnalysisCorrection
  }>(`/children/${id}/analyses/${analysisId}/corrections`, payload)
}
