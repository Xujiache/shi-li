import api from '@/utils/http'

function paginationParams(params: Record<string, unknown>) {
  const { current, size, page, page_size, ...rest } = params
  return {
    ...rest,
    page: (page ?? current ?? 1) as number,
    page_size: (page_size ?? size ?? 20) as number
  }
}

export interface AdminInfo {
  _id?: string
  user_id?: string
  phone?: string
  display_name?: string
  user_no?: string
  is_admin?: boolean
}

export function adminLogin(params: { phone: string; password: string }) {
  return api.post<{ token: string; admin: AdminInfo }>({
    url: '/api/v1/admin/auth/login',
    params
  })
}

export function adminRegister(params: { phone: string; password: string; display_name?: string }) {
  return usersCreate({ ...params, is_admin: true, active: true })
}

export function adminLogout() {
  return api.post({
    url: '/api/v1/admin/auth/logout'
  })
}

export function adminMe() {
  return api.get<{ admin: AdminInfo }>({
    url: '/api/v1/admin/auth/me'
  })
}

export function usersList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/users',
    params: paginationParams(params)
  })
}

export function usersDetail(params: { user_id: string }) {
  return api.get<{ user: unknown }>({
    url: `/api/v1/admin/users/${params.user_id}`
  })
}

export function usersCreate(params: {
  phone: string
  password: string
  display_name?: string
  avatar_file_id?: string
  is_admin?: boolean
  active?: boolean
}) {
  return api.post<{ user: unknown }>({
    url: '/api/v1/admin/users',
    params: {
      phone: params.phone,
      password: params.password,
      display_name: params.display_name,
      avatar_url: params.avatar_file_id,
      is_admin: params.is_admin,
      active: params.active
    }
  })
}

export function usersUpdate(params: {
  user_id: string
  patch: { phone?: string; display_name?: string; avatar_file_id?: string; password?: string; active?: boolean }
}) {
  return api.put({
    url: `/api/v1/admin/users/${params.user_id}`,
    params: {
      ...params.patch,
      avatar_url: params.patch.avatar_file_id
    }
  })
}

export function usersDelete(params: { user_id: string }) {
  return api.del({
    url: `/api/v1/admin/users/${params.user_id}`
  })
}

export function usersToggle(params: { user_id: string; active: boolean }) {
  return usersUpdate({
    user_id: params.user_id,
    patch: { active: params.active }
  })
}

export function usersSetAdmin(params: { user_id: string; is_admin: boolean }) {
  return api.put({
    url: `/api/v1/admin/users/${params.user_id}/admin`,
    params
  })
}

export function schoolClassesList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/school-classes',
    params: paginationParams(params)
  })
}

export function schoolClassesDetail(params: { _id: string }) {
  return api.get<{ row: unknown }>({
    url: `/api/v1/admin/school-classes/${params._id}`
  })
}

export function schoolClassesCreate(params: {
  school: string
  class_name: string
  active?: boolean
}) {
  return api.post<{ row: unknown }>({
    url: '/api/v1/admin/school-classes',
    params
  })
}

export function schoolClassesUpdate(params: {
  _id: string
  patch: { school?: string; class_name?: string; active?: boolean }
}) {
  return api.put({
    url: `/api/v1/admin/school-classes/${params._id}`,
    params: params.patch
  })
}

export function schoolClassesDelete(params: { _id: string }) {
  return api.del({
    url: `/api/v1/admin/school-classes/${params._id}`
  })
}

export function schoolClassesToggle(params: { _id: string; active: boolean }) {
  return schoolClassesUpdate({ _id: params._id, patch: { active: params.active } })
}

export function bannersList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/banners',
    params: paginationParams(params)
  })
}

export function bannersDetail(params: { _id: string }) {
  return api.get<{ row: unknown }>({
    url: `/api/v1/admin/banners/${params._id}`
  })
}

export function bannersCreate(params: {
  image_url: string
  title?: string
  sub_title?: string
  order: number
  active?: boolean
}) {
  return api.post<{ row: unknown }>({
    url: '/api/v1/admin/banners',
    params
  })
}

export function bannersUpdate(params: {
  _id: string
  patch: { image_url?: string; title?: string; sub_title?: string; order?: number; active?: boolean }
}) {
  return api.put({
    url: `/api/v1/admin/banners/${params._id}`,
    params: params.patch
  })
}

export function bannersDelete(params: { _id: string }) {
  return api.del({
    url: `/api/v1/admin/banners/${params._id}`
  })
}

export function bannersToggle(params: { _id: string; active: boolean }) {
  return bannersUpdate({ _id: params._id, patch: { active: params.active } })
}

export function appointmentItemsList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/appointment-items',
    params: paginationParams(params)
  })
}

export function appointmentItemsDetail(params: { _id: string }) {
  return api.get<{ row: unknown }>({
    url: `/api/v1/admin/appointment-items/${params._id}`
  })
}

export function appointmentItemsCreate(params: { name: string; image_url?: string; active?: boolean }) {
  return api.post<{ row: unknown }>({
    url: '/api/v1/admin/appointment-items',
    params
  })
}

export function appointmentItemsUpdate(params: {
  _id: string
  patch: { name?: string; image_url?: string; active?: boolean }
}) {
  return api.put({
    url: `/api/v1/admin/appointment-items/${params._id}`,
    params: params.patch
  })
}

export function appointmentItemsDelete(params: { _id: string }) {
  return api.del({
    url: `/api/v1/admin/appointment-items/${params._id}`
  })
}

export function appointmentItemsToggle(params: { _id: string; active: boolean }) {
  return appointmentItemsUpdate({ _id: params._id, patch: { active: params.active } })
}

export function appointmentSchedulesList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/appointment-schedules',
    params: paginationParams(params)
  })
}

export function appointmentSchedulesDetail(params: { _id: string }) {
  return api.get<{ row: unknown }>({
    url: `/api/v1/admin/appointment-schedules/${params._id}`
  })
}

export function appointmentSchedulesCreate(params: {
  item_id: string
  date: string
  time_slot: string
  max_count: number
  booked_count?: number
  active?: boolean
}) {
  return api.post<{ row: unknown }>({
    url: '/api/v1/admin/appointment-schedules',
    params
  })
}

export function appointmentSchedulesUpdate(params: {
  _id: string
  patch: Partial<{
    item_id: string
    date: string
    time_slot: string
    max_count: number
    booked_count: number
    active: boolean
  }>
}) {
  return api.put({
    url: `/api/v1/admin/appointment-schedules/${params._id}`,
    params: params.patch
  })
}

export function appointmentSchedulesDelete(params: { _id: string }) {
  return api.del({
    url: `/api/v1/admin/appointment-schedules/${params._id}`
  })
}

export function appointmentSchedulesToggle(params: { _id: string; active: boolean }) {
  return appointmentSchedulesUpdate({ _id: params._id, patch: { active: params.active } })
}

export function appointmentRecordsList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/appointment-records',
    params: paginationParams(params)
  })
}

export function appointmentRecordsDetail(params: { _id: string }) {
  return api.get<{ row: unknown }>({
    url: `/api/v1/admin/appointment-records/${params._id}`
  })
}

export function appointmentRecordsCreate(params: Record<string, unknown>) {
  return Promise.reject(new Error('当前版本未开放后台直接新建预约记录'))
}

export function appointmentRecordsUpdate(params: { _id: string; patch: Record<string, unknown> }) {
  if (params.patch.status) {
    return appointmentRecordsSetStatus({ _id: params._id, status: String(params.patch.status) })
  }
  return Promise.reject(new Error('当前版本仅支持后台更新预约状态'))
}

export function appointmentRecordsDelete(params: { _id: string }) {
  return api.del({
    url: `/api/v1/admin/appointment-records/${params._id}`
  })
}

export function appointmentRecordsSetStatus(params: { _id: string; status: string }) {
  return api.put({
    url: `/api/v1/admin/appointment-records/${params._id}/status`,
    params: { status: params.status }
  })
}

export function childrenList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/children',
    params: paginationParams(params)
  })
}

export function childrenSearch(params: Record<string, unknown>) {
  return childrenList(params)
}

export function childrenDetail(params: { child_id: string }) {
  return api.get<{ child: unknown }>({
    url: `/api/v1/admin/children/${params.child_id}`
  })
}

export function childrenCreate(params: Record<string, unknown>) {
  return api.post<{ child: unknown }>({
    url: '/api/v1/admin/children',
    params
  })
}

export function childrenUpdate(params: { child_id: string; patch: Record<string, unknown> }) {
  return api.put({
    url: `/api/v1/admin/children/${params.child_id}`,
    params: params.patch
  })
}

export function childrenDelete(params: { child_id: string }) {
  return api.del({
    url: `/api/v1/admin/children/${params.child_id}`
  })
}

export function childrenToggle(params: { child_id: string; active: boolean }) {
  return childrenUpdate({ child_id: params.child_id, patch: { active: params.active } })
}

export function checkupRecordsList(params: Record<string, unknown>) {
  return api.get({
    url: '/api/v1/admin/checkup-records',
    params: paginationParams(params)
  })
}

export function checkupRecordsDetail(params: { record_id: string }) {
  return api.get<{ record: unknown }>({
    url: `/api/v1/admin/checkup-records/${params.record_id}`
  })
}

export interface CheckupRecordPayload {
  child_id: string
  date: string
  height?: string | number | null
  weight?: string | number | null
  tongue_shape?: string
  tongue_color?: string
  tongue_coating?: string
  vision_l?: string
  vision_r?: string
  vision_both?: string
  refraction_l?: Record<string, unknown>
  refraction_r?: Record<string, unknown>
  diagnosis?: Record<string, unknown>
  conclusion?: string
  active?: boolean
}

export function checkupRecordsCreate(params: { record: CheckupRecordPayload }) {
  return api.post<{ record: unknown }>({
    url: '/api/v1/admin/checkup-records',
    params: params.record
  })
}

export function checkupRecordsUpdate(params: {
  record_id: string
  patch: Partial<CheckupRecordPayload>
}) {
  return api.put({
    url: `/api/v1/admin/checkup-records/${params.record_id}`,
    params: params.patch
  })
}

export function checkupRecordsDelete(params: { record_id: string }) {
  return api.del({
    url: `/api/v1/admin/checkup-records/${params.record_id}`
  })
}

export function checkupRecordsToggle(params: { record_id: string; active: boolean }) {
  return checkupRecordsUpdate({ record_id: params.record_id, patch: { active: params.active } })
}

export function systemConfigTermsGet() {
  return api.get<{ row: unknown }>({
    url: '/api/v1/admin/system-config/terms'
  })
}

export function systemConfigTermsUpdate(params: {
  patch: {
    user_agreement?: string
    privacy_policy?: string
    child_privacy_policy?: string
    third_party_share_list?: string
  }
}) {
  return api.put({
    url: '/api/v1/admin/system-config/terms',
    params: params.patch
  })
}

export interface DashboardStatsResponse {
  cards?: {
    total_visits?: number
    online_visitors?: number
    click_count?: number
    new_users_7d?: number
  }
  changes?: Record<string, string>
  overview?: Record<string, number>
  visits_series?: { xAxis?: string[]; data?: number[] }
  new_users_list?: Array<Record<string, unknown>>
  dynamics?: Array<Record<string, unknown>>
}

export function dashboardStats() {
  return api.get<DashboardStatsResponse>({
    url: '/api/v1/admin/dashboard/stats'
  })
}

// ——— 问卷 questionnaires ———
export interface QuestionnaireQuestionOption {
  _id?: string
  id?: number
  label: string
  value: string
  score?: number | null
  sort_order?: number
  extra?: Record<string, unknown>
}

export interface QuestionnaireQuestion {
  _id?: string
  id?: number
  type: string
  code?: string
  title: string
  description?: string
  required?: boolean
  sort_order?: number
  placeholder?: string
  default_value?: unknown
  settings?: Record<string, unknown>
  validation?: Record<string, unknown>
  visibility_rule?: Record<string, unknown>
  options?: QuestionnaireQuestionOption[]
}

export interface QuestionnaireSection {
  _id?: string
  id?: number
  title: string
  description?: string
  page_no?: number
  sort_order?: number
  questions?: QuestionnaireQuestion[]
}

export interface QuestionnaireAssignmentRule {
  _id?: string
  id?: number
  rule_name?: string
  scope_type: string
  school?: string
  grade_name?: string
  grade_min?: number | null
  grade_max?: number | null
  class_name?: string
  user_id?: string
  child_id?: string
  submit_rule_type?: string
  max_submit_count?: number | null
  cycle_type?: string
  cycle_value?: number | null
  start_at?: string | null
  end_at?: string | null
  active?: boolean
  extra?: Record<string, unknown>
}

export interface QuestionnairePayload {
  title: string
  description?: string
  cover_image_url: string
  status?: string
  allow_save_draft?: boolean
  allow_view_result?: boolean
  submit_rule_type?: string
  max_submit_count?: number | null
  cycle_type?: string
  cycle_value?: number | null
  publish_start_at?: string | null
  publish_end_at?: string | null
  welcome_text?: string
  submit_success_text?: string
  schema_version?: number
  active?: boolean
  sections?: QuestionnaireSection[]
  assignment_rules?: QuestionnaireAssignmentRule[]
}

export function questionnairesList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/questionnaires',
    params: paginationParams(params)
  })
}

export function questionnaireDetail(params: { questionnaire_id: string }) {
  return api.get({
    url: `/api/v1/admin/questionnaires/${params.questionnaire_id}`
  })
}

export function questionnaireCreate(params: QuestionnairePayload) {
  return api.post({
    url: '/api/v1/admin/questionnaires',
    params
  })
}

export function questionnaireUpdate(params: { questionnaire_id: string; payload: QuestionnairePayload }) {
  return api.put({
    url: `/api/v1/admin/questionnaires/${params.questionnaire_id}`,
    params: params.payload
  })
}

export function questionnaireDelete(params: { questionnaire_id: string }) {
  return api.del({
    url: `/api/v1/admin/questionnaires/${params.questionnaire_id}`
  })
}

export function questionnaireCopy(params: { questionnaire_id: string }) {
  return api.post({
    url: `/api/v1/admin/questionnaires/${params.questionnaire_id}/copy`
  })
}

export function questionnaireStatusUpdate(params: {
  questionnaire_id: string
  status?: string
  active?: boolean
}) {
  return api.put({
    url: `/api/v1/admin/questionnaires/${params.questionnaire_id}/status`,
    params
  })
}

export function questionnaireSubmissionsList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/questionnaire-submissions',
    params: paginationParams(params)
  })
}

export function questionnaireSubmissionDetail(params: { submission_id: string }) {
  return api.get({
    url: `/api/v1/admin/questionnaire-submissions/${params.submission_id}`
  })
}

export function questionnaireSubmissionsExport(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/questionnaire-submissions/export',
    params
  })
}
