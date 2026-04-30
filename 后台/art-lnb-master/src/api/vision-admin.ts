import api from '@/utils/http'
import { useUserStore } from '@/store/modules/user'

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

// ——— 管理员管理（独立 admins 表）———
export function adminsList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/admins',
    params: paginationParams(params)
  })
}

export function adminsDetail(params: { admin_id: string }) {
  return api.get<{ admin: unknown }>({
    url: `/api/v1/admin/admins/${params.admin_id}`
  })
}

export function adminsCreate(params: {
  phone: string
  password: string
  display_name?: string
  role?: string
}) {
  return api.post<{ admin: unknown }>({
    url: '/api/v1/admin/admins',
    params
  })
}

export function adminsUpdate(params: {
  admin_id: string
  patch: { phone?: string; display_name?: string; password?: string; role?: string; active?: boolean }
}) {
  return api.put({
    url: `/api/v1/admin/admins/${params.admin_id}`,
    params: params.patch
  })
}

export function adminsDelete(params: { admin_id: string }) {
  return api.del({
    url: `/api/v1/admin/admins/${params.admin_id}`
  })
}

// ——— 档案字段配置 ———
export function profileFieldConfigGet() {
  return api.get<{ config: ProfileFieldConfig }>({
    url: '/api/v1/admin/system-config/profile-fields'
  })
}

export function profileFieldConfigUpdate(params: ProfileFieldConfig) {
  return api.put<{ config: ProfileFieldConfig }>({
    url: '/api/v1/admin/system-config/profile-fields',
    params
  })
}

export type ProfileFieldType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'textarea' | 'readonly'

export interface ProfileFieldItem {
  key: string
  label: string
  type: ProfileFieldType
  options: string[]
  placeholder: string
  enabled: boolean
  required: boolean
  sort_order: number
  readonly?: boolean
}

export interface ProfileFieldSection {
  key: string
  label: string
  enabled: boolean
  sort_order: number
  fields: ProfileFieldItem[]
}

export interface ProfileFieldConfig {
  sections: ProfileFieldSection[]
}

// ——— 操作日志 ———
export function operationLogsList(params: Record<string, unknown> = {}) {
  return api.get({
    url: '/api/v1/admin/operation-logs',
    params: paginationParams(params)
  })
}

// ===== 员工管理 =====
export interface EmployeeRow {
  id: number
  _id?: number | string
  phone: string
  display_name: string
  role: 'staff' | 'manager'
  department_id: number | null
  department_name?: string
  position: string
  active: boolean
  must_change_password?: boolean
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface EmployeeListParams {
  q?: string
  role?: string
  department_id?: number
  active?: boolean
  page?: number
  page_size?: number
  current?: number
  size?: number
}

export function employeesList(params: Record<string, unknown> = {}) {
  return api.get<{ list: EmployeeRow[]; total: number; page: number; page_size: number }>({
    url: '/api/v1/admin/employees',
    params: paginationParams(params)
  })
}

export function employeesDetail(params: { id: number | string }) {
  return api.get<EmployeeRow>({
    url: `/api/v1/admin/employees/${params.id}`
  })
}

export function employeesCreate(params: {
  phone: string
  password?: string
  display_name: string
  role: 'staff' | 'manager'
  department_id?: number | null
  position?: string
}) {
  return api.post<{ employee: EmployeeRow; default_password?: string }>({
    url: '/api/v1/admin/employees',
    params
  })
}

export function employeesUpdate(params: {
  id: number | string
  patch: {
    display_name?: string
    role?: 'staff' | 'manager'
    department_id?: number | null
    position?: string
  }
}) {
  return api.put<EmployeeRow>({
    url: `/api/v1/admin/employees/${params.id}`,
    params: params.patch
  })
}

export function employeesSetStatus(params: { id: number | string; active: boolean }) {
  return api.put<EmployeeRow>({
    url: `/api/v1/admin/employees/${params.id}/status`,
    params: { active: params.active }
  })
}

export function employeesResetPassword(params: { id: number | string; password?: string }) {
  return api.put<{ default_password?: string }>({
    url: `/api/v1/admin/employees/${params.id}/reset-password`,
    params: params.password ? { password: params.password } : {}
  })
}

export function employeesDelete(params: { id: number | string }) {
  return api.del({
    url: `/api/v1/admin/employees/${params.id}`
  })
}

// ===== 部门管理 =====
export interface DepartmentRow {
  id: number
  _id?: number | string
  name: string
  parent_id: number | null
  manager_id: number | null
  sort_order: number
  active: boolean
  created_at?: string
  updated_at?: string
}

export function departmentsList(params: Record<string, unknown> = {}) {
  return api.get<{ list: DepartmentRow[]; total: number; page: number; page_size: number }>({
    url: '/api/v1/admin/departments',
    params: paginationParams(params)
  })
}

export function departmentsDetail(params: { id: number | string }) {
  return api.get<DepartmentRow>({
    url: `/api/v1/admin/departments/${params.id}`
  })
}

export function departmentsCreate(params: {
  name: string
  parent_id?: number | null
  manager_id?: number | null
  sort_order?: number
}) {
  return api.post<DepartmentRow>({
    url: '/api/v1/admin/departments',
    params
  })
}

export function departmentsUpdate(params: {
  id: number | string
  patch: {
    name?: string
    parent_id?: number | null
    manager_id?: number | null
    sort_order?: number
    active?: boolean
  }
}) {
  return api.put<DepartmentRow>({
    url: `/api/v1/admin/departments/${params.id}`,
    params: params.patch
  })
}

export function departmentsDelete(params: { id: number | string }) {
  return api.del({
    url: `/api/v1/admin/departments/${params.id}`
  })
}

// ===== 员工客户管理 =====
export interface AdminCustomerRow {
  id: number
  _id?: number | string
  customer_no: string
  display_name: string
  phone: string
  gender: 'male' | 'female' | 'unknown'
  age: number | null
  school: string
  class_name: string
  source: string
  status: 'potential' | 'interested' | 'signed' | 'lost'
  level: 'A' | 'B' | 'C'
  tags: string[]
  remark: string
  assigned_employee_id: number | null
  assigned_employee_name?: string
  department_name?: string
  next_follow_up_at: string | null
  next_follow_up_text: string
  last_follow_up_at: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface AdminCustomerListParams {
  q?: string
  status?: string
  level?: string
  assigned_employee_id?: number | null
  department_id?: number | null
  page?: number
  page_size?: number
  current?: number
  size?: number
}

export function adminCustomersList(params: Record<string, unknown> = {}) {
  return api.get<{ list: AdminCustomerRow[]; total: number; page: number; page_size: number }>({
    url: '/api/v1/admin/customers',
    params: paginationParams(params)
  })
}

export function adminCustomerDetail(params: { id: number | string }) {
  return api.get<{ customer: AdminCustomerRow }>({
    url: `/api/v1/admin/customers/${params.id}`
  })
}

export function adminCustomerUpdate(params: {
  id: number | string
  patch: Partial<{
    display_name: string
    phone: string
    gender: 'male' | 'female' | 'unknown'
    age: number | null
    school: string
    class_name: string
    status: 'potential' | 'interested' | 'signed' | 'lost'
    level: 'A' | 'B' | 'C'
    remark: string
    next_follow_up_at: string | null
    next_follow_up_text: string
    assigned_employee_id: number | null
    tags: string[]
  }>
}) {
  return api.put<{ customer: AdminCustomerRow }>({
    url: `/api/v1/admin/customers/${params.id}`,
    params: params.patch
  })
}

/**
 * 触发客户 CSV 导出：fetch + Bearer token，浏览器保存文件。
 * 不走 axios 因为 axios 拦截器只处理 JSON。
 */
export async function adminCustomersExport(filter: AdminCustomerListParams = {}) {
  const qs = new URLSearchParams()
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  })
  const url = `/api/v1/admin/customers/export${qs.toString() ? `?${qs.toString()}` : ''}`
  const userStore = useUserStore()
  const accessToken = (userStore as any).accessToken || ''
  const headers: Record<string, string> = {}
  if (accessToken) {
    headers.Authorization = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
  }
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) {
    throw new Error(`导出失败: HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const ymd = new Date().toISOString().slice(0, 10)
  const filename = `customers-${ymd}.csv`
  const dlUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = dlUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(dlUrl)
}

// ===== 孩子档案：部门字段组授权 + 孩子归属 =====
export interface SectionMeta {
  key: string
  label: string
  enabled: boolean
  sort_order: number
}

export interface DeptFieldGrantRow {
  department_id: number
  section_keys: string[]
}

export function adminListAllDeptGrants() {
  return api.get<{ grants: DeptFieldGrantRow[]; sections: SectionMeta[] }>({
    url: '/api/v1/admin/dept-field-grants'
  })
}

export function adminSetDeptGrants(params: { dept_id: number; section_keys: string[] }) {
  return api.put<DeptFieldGrantRow>({
    url: `/api/v1/admin/dept-field-grants/${params.dept_id}`,
    params: { section_keys: params.section_keys }
  })
}

export function adminListChildAssignments(params: { child_id: number | string }) {
  return api.get<{ child_id: number; department_ids: number[] }>({
    url: `/api/v1/admin/children/${params.child_id}/assignments`
  })
}

export function adminSetChildAssignments(params: { child_id: number | string; dept_ids: number[] }) {
  return api.post<{ child_id: number; department_ids: number[] }>({
    url: `/api/v1/admin/children/${params.child_id}/assignments`,
    params: { dept_ids: params.dept_ids }
  })
}

// ===== AI 分析（孩子档案）=====
export interface AiAnalysisConfig {
  mode: 'human' | 'ai'
  model: string
  few_shot_count: number
  system_prompt: string
  stale_hours: number
}

export interface ChildAnalysisRow {
  id: number
  _id?: string
  child_id: number
  source: 'human' | 'ai'
  content: string
  model: string | null
  prompt_meta: any
  tokens_used: number | null
  created_by_employee_id: number | null
  created_by_admin_id: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export function adminGetAiAnalysisConfig() {
  return api.get<{ config: AiAnalysisConfig }>({ url: '/api/v1/admin/ai-analysis/config' })
}

export function adminSetAiAnalysisConfig(patch: Partial<AiAnalysisConfig>) {
  return api.put<{ config: AiAnalysisConfig }>({
    url: '/api/v1/admin/ai-analysis/config',
    params: patch
  })
}

export function adminListChildAnalyses(params: { child_id: number | string }) {
  return api.get<{ mode: string; list: ChildAnalysisRow[]; current: ChildAnalysisRow | null }>({
    url: `/api/v1/admin/children/${params.child_id}/analyses`
  })
}

export function adminCreateChildAnalysis(params: { child_id: number | string; content: string }) {
  return api.post<{ analysis: ChildAnalysisRow }>({
    url: `/api/v1/admin/children/${params.child_id}/analyses`,
    params: { content: params.content }
  })
}

export function adminGenerateChildAnalysis(params: { child_id: number | string }) {
  return api.post<{ analysis: ChildAnalysisRow }>({
    url: `/api/v1/admin/children/${params.child_id}/analyses/generate`,
    params: {}
  })
}

export function adminDeactivateAnalysis(params: { id: number | string }) {
  return api.del<{ success: boolean; id: number }>({
    url: `/api/v1/admin/analyses/${params.id}`
  })
}

// ===== AI 风格包（蒸馏后的人工分析风格知识库）=====
export interface AiStylePack {
  id: number
  version: number
  based_on_count: number
  based_on_max_human_id: number | null
  content: string
  model: string | null
  tokens_used: number | null
  active: boolean
  created_at: string
}

export function adminGetAiStylePack() {
  return api.get<{ active: AiStylePack | null; history: AiStylePack[] }>({
    url: '/api/v1/admin/ai-analysis/style-pack'
  })
}

export function adminRegenerateAiStylePack(params: { model?: string } = {}) {
  return api.post<{ pack: AiStylePack }>({
    url: '/api/v1/admin/ai-analysis/style-pack/regenerate',
    params: { model: params.model }
  })
}

export interface AiAnalysisOverview {
  analyses: {
    human_active: number
    ai_active: number
    human_total: number
    ai_total: number
    tokens_total: number
    children_with_analysis: number
  }
  corrections: { total: number }
  style_pack: {
    active_version: number | null
    based_on_count: number
    created_at: string | null
    total_versions: number
  }
  recent_7d: { ai_count: number; human_count: number; tokens_used: number }
}

export function adminGetAiAnalysisOverview() {
  return api.get<{ stats: AiAnalysisOverview }>({
    url: '/api/v1/admin/ai-analysis/overview'
  })
}

export interface AiBulkState {
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  trigger: string | null
  total: number
  done: number
  ok: number
  failed: number
  errors: Array<{ child_id: number; message: string }>
}

export function adminBulkGenerateAiAnalyses(params: { interval_ms?: number; limit?: number } = {}) {
  return api.post<{ status: string; total?: number; state?: AiBulkState }>({
    url: '/api/v1/admin/ai-analysis/bulk-generate',
    params
  })
}

export function adminGetAiBulkStatus() {
  return api.get<{ state: AiBulkState }>({
    url: '/api/v1/admin/ai-analysis/bulk-status'
  })
}

export interface CorrectionOption {
  code?: string
  label: string
  source?: 'base' | 'ai' | 'selected' | 'custom'
}

export interface AiCorrectionRow {
  id: number
  child_id: number
  child_name: string
  school: string
  grade_name: string
  original_analysis_id: number
  corrected_analysis_id: number
  original_model: string
  original_created_at: string | null
  corrected_created_at: string | null
  original_content: string
  corrected_content: string
  question_prompt: string
  question_summary: string
  generated_options: CorrectionOption[]
  selected_options: CorrectionOption[]
  custom_reason: string
  employee_name: string
  employee_phone: string
  created_by_employee_id: number | null
  created_by_admin_id: number | null
  created_at: string
  updated_at: string
}

export interface AiCorrectionReasonStat {
  code: string
  label: string
  count: number
}

export function adminListAiCorrections(params: Record<string, unknown> = {}) {
  return api.get<{ list: AiCorrectionRow[]; total: number; page: number; page_size: number }>({
    url: '/api/v1/admin/ai-analysis/corrections',
    params: paginationParams(params)
  })
}

export function adminGetAiCorrectionStats() {
  return api.get<{
    stats: {
      list: AiCorrectionReasonStat[]
      custom_reason_count: number
      sample_size: number
    }
  }>({
    url: '/api/v1/admin/ai-analysis/corrections/stats'
  })
}

// ===== 全局跟进日志 =====
export interface AdminFollowUpRow {
  customer_id: number
  customer_name?: string
  customer_phone?: string
  employee_id: number
  employee_name?: string
  employee_phone?: string
  department_name?: string
  follow_at: string
  type: string
  result: string
  content: string
  next_follow_up_at: string | null
  created_at: string
}

export function adminListAllFollowUps(params: Record<string, unknown> = {}) {
  return api.get<{ list: AdminFollowUpRow[]; total: number; page: number; page_size: number }>({
    url: '/api/v1/admin/follow-ups',
    params: paginationParams(params)
  })
}

export async function adminExportAllFollowUps(filter: Record<string, unknown> = {}) {
  const qs = new URLSearchParams()
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  })
  const url = `/api/v1/admin/follow-ups/export${qs.toString() ? `?${qs.toString()}` : ''}`
  const userStore = useUserStore()
  const accessToken = (userStore as any).accessToken || ''
  const headers: Record<string, string> = {}
  if (accessToken) {
    headers.Authorization = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
  }
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`)
  const blob = await res.blob()
  const ymd = new Date().toISOString().slice(0, 10)
  const filename = `follow-ups-${ymd}.csv`
  const dlUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = dlUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  window.URL.revokeObjectURL(dlUrl)
}

// ===== AI 对话（管理员私有，长上下文）=====
export interface AiChatConversation {
  id: number
  admin_id: number
  title: string
  model: string
  system_prompt: string
  message_count: number
  total_tokens: number
  archived: boolean
  created_at: string
  updated_at: string
}

export interface AiChatMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  created_at: string
}

export function adminListChatConversations() {
  return api.get<{ list: AiChatConversation[] }>({
    url: '/api/v1/admin/ai-chat/conversations'
  })
}

export function adminCreateChatConversation(params: {
  title?: string
  model?: string
  system_prompt?: string
}) {
  return api.post<{ conversation: AiChatConversation }>({
    url: '/api/v1/admin/ai-chat/conversations',
    params
  })
}

export function adminUpdateChatConversation(params: {
  id: number | string
  title?: string
  model?: string
  system_prompt?: string
  archived?: boolean
}) {
  const { id, ...rest } = params
  return api.put<{ conversation: AiChatConversation }>({
    url: `/api/v1/admin/ai-chat/conversations/${id}`,
    params: rest
  })
}

export function adminDeleteChatConversation(params: { id: number | string }) {
  return api.del<{ success: boolean; id: number }>({
    url: `/api/v1/admin/ai-chat/conversations/${params.id}`
  })
}

export function adminClearChatConversation(params: { id: number | string }) {
  return api.post<{ conversation: AiChatConversation }>({
    url: `/api/v1/admin/ai-chat/conversations/${params.id}/clear`,
    params: {}
  })
}

export function adminListChatMessages(params: { id: number | string }) {
  return api.get<{ conversation: AiChatConversation; list: AiChatMessage[] }>({
    url: `/api/v1/admin/ai-chat/conversations/${params.id}/messages`
  })
}

export function adminSendChatMessage(params: { id: number | string; content: string }) {
  return api.post<{
    conversation: AiChatConversation
    user_message: AiChatMessage
    assistant_message: AiChatMessage
  }>({
    url: `/api/v1/admin/ai-chat/conversations/${params.id}/messages`,
    params: { content: params.content }
  })
}
