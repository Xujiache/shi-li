<template>
  <div class="vision-children art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="resetSearchParams"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增孩子档案</ElButton>
          <ArtExcelExport
            :data="exportData"
            filename="孩子档案"
            :headers="exportHeaders"
            button-text="导出"
            type="default"
          />
        </template>
      </ArtTableHeader>
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
    <ElDialog v-model="dialogVisible" :title="editId ? '编辑孩子档案' : '新增孩子档案'" width="780px" top="4vh">
      <div style="max-height:68vh;overflow-y:auto;padding-right:12px">
        <ElForm ref="formRef" :model="form" :rules="formRules" label-width="120px">
          <ElDivider content-position="left">基础信息</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="姓名" prop="name"><ElInput v-model="form.name" placeholder="1-20字" /></ElFormItem></ElCol>
            <ElCol :span="12">
              <ElFormItem label="性别" prop="gender">
                <ElSelect v-model="form.gender" placeholder="请选择" style="width:100%">
                  <ElOption label="男" value="男" /><ElOption label="女" value="女" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
          </ElRow>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="出生日期" prop="dob"><ElDatePicker v-model="form.dob" type="date" value-format="YYYY-MM-DD" style="width:100%" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="家长手机号" prop="parent_phone"><ElInput v-model="form.parent_phone" /></ElFormItem></ElCol>
          </ElRow>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="学校" prop="school"><ElInput v-model="form.school" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="班级" prop="class_name"><ElInput v-model="form.class_name" /></ElFormItem></ElCol>
          </ElRow>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="身高(cm)"><ElInputNumber v-model="form.height" :min="0" :max="300" :precision="1" style="width:100%" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="体重(kg)"><ElInputNumber v-model="form.weight" :min="0" :max="300" :precision="1" style="width:100%" /></ElFormItem></ElCol>
          </ElRow>

          <!-- 动态分区（从档案字段配置读取，自动两列布局） -->
          <template v-for="section in enabledSections" :key="section.key">
            <ElDivider content-position="left">{{ section.label }}</ElDivider>
            <ElRow :gutter="16">
              <template v-for="field in section.fields" :key="field.key">
                <ElCol
                  v-if="field.enabled"
                  :span="(field.type === 'textarea' || field.type === 'readonly' || (field.type === 'multi_select' && (field.options || []).length > 4)) ? 24 : 12"
                >
                  <!-- text / number -->
                  <ElFormItem
                    v-if="field.type === 'text' || field.type === 'number'"
                    :label="field.label"
                    :required="field.required"
                  >
                    <ElInput
                      v-model="dynamicForm[field.key]"
                      :placeholder="field.placeholder || '请输入'"
                      :type="field.type === 'number' ? 'number' : 'text'"
                    />
                  </ElFormItem>

                  <!-- select -->
                  <ElFormItem
                    v-else-if="field.type === 'select'"
                    :label="field.label"
                    :required="field.required"
                  >
                    <ElSelect v-model="dynamicForm[field.key]" :placeholder="field.placeholder || '请选择'" style="width:100%" clearable>
                      <ElOption v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
                    </ElSelect>
                  </ElFormItem>

                  <!-- multi_select -->
                  <ElFormItem
                    v-else-if="field.type === 'multi_select'"
                    :label="field.label"
                    :required="field.required"
                  >
                    <ElSelect
                      v-model="dynamicForm[field.key]"
                      multiple
                      :placeholder="field.placeholder || '可多选'"
                      style="width:100%"
                      clearable
                    >
                      <ElOption v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
                    </ElSelect>
                  </ElFormItem>

                  <!-- date -->
                  <ElFormItem
                    v-else-if="field.type === 'date'"
                    :label="field.label"
                    :required="field.required"
                  >
                    <ElDatePicker
                      v-model="dynamicForm[field.key]"
                      type="date"
                      value-format="YYYY-MM-DD"
                      :placeholder="field.placeholder || '请选择日期'"
                      style="width:100%"
                    />
                  </ElFormItem>

                  <!-- textarea -->
                  <ElFormItem
                    v-else-if="field.type === 'textarea'"
                    :label="field.label"
                    :required="field.required"
                  >
                    <ElInput
                      v-model="dynamicForm[field.key]"
                      type="textarea"
                      :rows="3"
                      :placeholder="field.placeholder || '请输入'"
                    />
                  </ElFormItem>

                  <!-- readonly -->
                  <ElFormItem
                    v-else-if="field.type === 'readonly'"
                    :label="field.label"
                  >
                    <ElInput v-model="dynamicForm[field.key]" :placeholder="field.placeholder || '由专业人员填写'" />
                  </ElFormItem>
                </ElCol>
              </template>
            </ElRow>
          </template>
        </ElForm>
      </div>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 分配部门 Drawer -->
    <ElDrawer
      v-model="assignVisible"
      :title="assignTitle"
      size="420px"
      destroy-on-close
    >
      <div style="padding: 16px;">
        <div style="margin-bottom: 12px; color: #606266; font-size: 13px;">
          勾选可访问该孩子档案的部门。员工只看到本部门授权的字段组。
        </div>
        <ElCheckboxGroup v-model="assignSelected">
          <div v-for="d in assignDepts" :key="d.id" style="margin-bottom: 12px;">
            <ElCheckbox :label="d.id" :value="d.id">
              {{ d.name }}
            </ElCheckbox>
          </div>
        </ElCheckboxGroup>
      </div>
      <template #footer>
        <ElButton @click="assignVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="assignSaving" @click="confirmAssign">保存</ElButton>
      </template>
    </ElDrawer>

    <!-- AI 分析 Drawer -->
    <ElDrawer
      v-model="analysisVisible"
      :title="analysisTitle"
      size="640px"
      destroy-on-close
    >
      <div style="padding: 16px;">
        <ElAlert
          v-if="analysisMode"
          :type="analysisMode === 'ai' ? 'warning' : 'info'"
          :closable="false"
          show-icon
          :title="analysisMode === 'ai' ? '当前为 AI 模式：家长 / 员工 / 后台展示自动生成内容' : '当前为人工模式：家长 / 员工看人工写的最新一条'"
          style="margin-bottom: 16px;"
        />

        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <ElButton type="primary" @click="onWriteHuman">写人工分析</ElButton>
          <ElButton type="warning" :loading="generating" @click="onGenerateAi">立即用 AI 生成</ElButton>
          <ElButton @click="loadAnalyses">刷新</ElButton>
        </div>

        <ElEmpty v-if="!analysisList.length" description="暂无分析" />
        <div v-else>
          <div
            v-for="a in analysisList"
            :key="a.id"
            class="analysis-item"
            :class="{ inactive: !a.active }"
          >
            <div class="ai-head">
              <ElTag
                :type="a.source === 'ai' ? 'warning' : 'success'"
                size="small"
              >
                {{ a.source === 'ai' ? 'AI' : '人工' }}
              </ElTag>
              <span class="ai-time">{{ a.created_at }}</span>
              <span v-if="a.model" class="ai-model">{{ a.model }}{{ a.tokens_used ? ` · ${a.tokens_used} tokens` : '' }}</span>
              <span v-if="!a.active" class="ai-tag-muted">已撤回</span>
              <span style="flex:1"></span>
              <ElButton
                v-if="a.active"
                size="small"
                link
                type="danger"
                @click="onDeactivate(a.id)"
              >撤回</ElButton>
            </div>
            <div class="ai-content">{{ a.content }}</div>
          </div>
        </div>
      </div>
    </ElDrawer>

    <!-- 写人工分析 Dialog -->
    <ElDialog
      v-model="writeVisible"
      title="写一条人工分析"
      width="640px"
      destroy-on-close
    >
      <ElInput
        v-model="writeContent"
        type="textarea"
        :rows="10"
        placeholder="请输入分析内容（AI 模式下会作为 GPT 模仿的风格范例）"
        maxlength="5000"
        show-word-limit
      />
      <template #footer>
        <ElButton @click="writeVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="writeSaving" @click="confirmWrite">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, computed, onMounted } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    childrenList, childrenCreate, childrenUpdate, childrenDelete,
    schoolClassesList, profileFieldConfigGet,
    departmentsList,
    adminListChildAssignments, adminSetChildAssignments,
    adminListChildAnalyses, adminCreateChildAnalysis,
    adminGenerateChildAnalysis, adminDeactivateAnalysis,
    type ProfileFieldSection,
    type DepartmentRow,
    type ChildAnalysisRow
  } from '@/api/vision-admin'
  import {
    ElMessageBox, ElMessage,
    ElDrawer, ElCheckboxGroup, ElCheckbox, ElButton,
    ElDialog, ElInput, ElAlert, ElEmpty, ElTag
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminChildren' })

  const NESTED_FIELD_MAP: Record<string, { parent: string; subkey: string }> = {
    diagnosis_vision: { parent: 'diagnosis_json', subkey: 'vision' },
    diagnosis_refraction: { parent: 'diagnosis_json', subkey: 'refraction' },
    diagnosis_axial: { parent: 'diagnosis_json', subkey: 'axial' },
    diagnosis_curvature: { parent: 'diagnosis_json', subkey: 'curvature' },
    diagnosis_axial_ratio: { parent: 'diagnosis_json', subkey: 'axial_ratio' }
  }

  const ALIAS_FIELD_MAP: Record<string, string> = {
    tcm_symptoms: 'tcm_symptoms_json'
  }

  const COMPOUND_FIELDS = new Set(['refraction_r_detail', 'refraction_l_detail'])

  const KNOWN_CHILD_COLUMNS = new Set([
    'vision_r', 'vision_l', 'vision_both',
    'refraction_r_detail', 'refraction_l_detail',
    'curvature_r', 'curvature_l',
    'axial_length_r', 'axial_length_l',
    'diagnosis_json', 'management_plan', 'optometrist_name', 'exam_date',
    'tcm_symptoms_json', 'tcm_symptom_other',
    'tcm_syndrome_types', 'tcm_syndrome_other',
    'risk_level', 'treatment_plans', 'treatment_other', 'doctor_name'
  ])

  function compoundToString(obj: Record<string, string> | null): string {
    if (!obj) return ''
    const parts: string[] = []
    if (obj.s) parts.push('S:' + obj.s)
    if (obj.c) parts.push('C:' + obj.c)
    if (obj.a) parts.push('A:' + obj.a)
    return parts.join(' ')
  }

  function stringToCompound(str: string): Record<string, string> {
    const result: Record<string, string> = { s: '', c: '', a: '' }
    if (!str) return result
    str.split(/\s+/).forEach((p) => {
      const [k, v] = p.split(':')
      if (k && v) {
        const upper = k.toUpperCase()
        if (upper === 'S') result.s = v
        else if (upper === 'C') result.c = v
        else if (upper === 'A') result.a = v
      }
    })
    return result
  }

  function readChildFieldValue(row: Record<string, unknown>, fieldKey: string): unknown {
    if (NESTED_FIELD_MAP[fieldKey]) {
      const { parent, subkey } = NESTED_FIELD_MAP[fieldKey]
      const obj = row[parent] as Record<string, unknown> | null
      return obj?.[subkey] ?? ''
    }
    if (ALIAS_FIELD_MAP[fieldKey]) {
      return row[ALIAS_FIELD_MAP[fieldKey]] ?? ''
    }
    if (COMPOUND_FIELDS.has(fieldKey)) {
      const obj = row[fieldKey] as Record<string, string> | null
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return compoundToString(obj)
      return typeof obj === 'string' ? obj : ''
    }
    if (KNOWN_CHILD_COLUMNS.has(fieldKey)) {
      return row[fieldKey] ?? ''
    }
    const custom = row.custom_fields_json as Record<string, unknown> | null
    return custom?.[fieldKey] ?? ''
  }

  const fieldSections = ref<ProfileFieldSection[]>([])
  const enabledSections = computed(() =>
    fieldSections.value
      .filter((s) => s.enabled)
      .map((s) => ({ ...s, fields: s.fields.filter((f) => f.enabled) }))
      .filter((s) => s.fields.length > 0)
  )

  async function loadFieldConfig() {
    try {
      const res = await profileFieldConfigGet()
      const data = (res as any)?.data?.config || (res as any)?.config
      const raw = Array.isArray(data?.sections) ? data.sections : []
      fieldSections.value = raw.map((s: any) => ({
        ...s,
        fields: Array.isArray(s.fields)
          ? s.fields.map((f: any) => ({
              ...f,
              type: f.type || 'text',
              options: Array.isArray(f.options) ? f.options : [],
              placeholder: f.placeholder || ''
            }))
          : []
      }))
    } catch {
      fieldSections.value = []
    }
  }

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const schoolOptions = ref<{ school: string; class_name: string }[]>([])
  onMounted(async () => {
    loadFieldConfig()
    const res = await schoolClassesList({ page: 1, page_size: 500 }) as { list?: { school?: string; class_name?: string }[] }
    schoolOptions.value = res.list?.map((x) => ({ school: x.school ?? '', class_name: x.class_name ?? '' })) ?? []
  })

  const searchForm = ref({ q: undefined, school: undefined, class_name: undefined })
  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '姓名/手机号/子编号' } },
    { label: '学校', key: 'school', type: 'input', props: { placeholder: '学校' } },
    { label: '班级', key: 'class_name', type: 'input', props: { placeholder: '班级' } }
  ]

  const dialogVisible = ref(false)
  const editId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const form = reactive({
    name: '',
    gender: '男',
    dob: '',
    school: '',
    class_name: '',
    parent_phone: '',
    height: null as number | null,
    weight: null as number | null
  })

  const dynamicForm = reactive<Record<string, any>>({})

  const formRules: FormRules = {
    name: [{ required: true, message: '请输入姓名', trigger: 'blur' }, { max: 20, message: '1-20字', trigger: 'blur' }],
    gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
    dob: [{ required: true, message: '请选择出生日期', trigger: 'change' }],
    school: [{ required: true, message: '请输入学校', trigger: 'blur' }],
    class_name: [{ required: true, message: '请输入班级', trigger: 'blur' }]
  }

  const {
    columns, columnChecks, data, loading, pagination,
    getData, searchParams, resetSearchParams,
    handleSizeChange, handleCurrentChange, refreshData
  } = useTable({
    core: {
      apiFn: childrenList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'name', label: '姓名', width: 90 },
        { prop: 'gender', label: '性别', width: 60 },
        { prop: 'dob', label: '出生日期', width: 110 },
        { prop: 'school', label: '学校', width: 120 },
        { prop: 'class_name', label: '班级', width: 100 },
        { prop: 'parent_phone', label: '家长手机号', width: 120 },
        { prop: 'vision_r', label: '右眼视力', width: 90 },
        { prop: 'vision_l', label: '左眼视力', width: 90 },
        { prop: 'risk_level', label: '风险等级', width: 110 },
        { prop: 'updated_at', label: '更新时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 280,
          fixed: 'right',
          formatter: (row: Record<string, unknown>) =>
            h('div', { class: 'flex gap-1', style: 'align-items:center' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(
                'span',
                {
                  class: 'el-link el-link--primary',
                  style: 'margin-left:8px;cursor:pointer',
                  onClick: () => openAssignDialog(row)
                },
                () => '分配部门'
              ),
              h(
                'span',
                {
                  class: 'el-link el-link--success',
                  style: 'margin-left:8px;cursor:pointer',
                  onClick: () => openAnalysisDrawer(row)
                },
                () => 'AI 分析'
              ),
              h(ArtButtonTable, { type: 'delete', onClick: () => del(row as { _id: string }) })
            ])
        }
      ]
    }
  })

  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    name: '姓名', gender: '性别', dob: '出生日期',
    school: '学校', class_name: '班级', parent_phone: '家长手机号',
    vision_r: '右眼视力', vision_l: '左眼视力', vision_both: '双眼视力',
    risk_level: '风险等级', updated_at: '更新时间'
  }

  function openDialog(type: 'add' | 'edit', row?: Record<string, unknown>) {
    editId.value = type === 'edit' && row?._id ? String(row._id) : null
    form.name = (row?.name as string) ?? ''
    form.gender = (row?.gender as string) ?? '男'
    form.dob = (row?.dob as string) ?? ''
    form.school = (row?.school as string) ?? ''
    form.class_name = (row?.class_name as string) ?? ''
    form.parent_phone = (row?.parent_phone as string) ?? ''
    form.height = row?.height != null ? Number(row.height) : null
    form.weight = row?.weight != null ? Number(row.weight) : null

    const newDynamic: Record<string, any> = {}
    fieldSections.value.forEach((section) => {
      section.fields.forEach((field) => {
        const val = row ? readChildFieldValue(row, field.key) : ''
        if (field.type === 'multi_select') {
          newDynamic[field.key] = Array.isArray(val) ? [...val as string[]] : []
        } else {
          newDynamic[field.key] = val != null ? String(val) : ''
        }
      })
    })
    Object.keys(dynamicForm).forEach((k) => delete dynamicForm[k])
    Object.assign(dynamicForm, newDynamic)

    dialogVisible.value = true
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: form.name,
      gender: form.gender,
      dob: form.dob,
      school: form.school,
      class_name: form.class_name,
      parent_phone: form.parent_phone,
      height: form.height,
      weight: form.weight
    }

    const nestedAccum: Record<string, Record<string, unknown>> = {}
    const customFields: Record<string, unknown> = {}

    fieldSections.value.forEach((section) => {
      if (!section.enabled) return
      section.fields.forEach((field) => {
        if (!field.enabled) return
        const val = dynamicForm[field.key]

        if (NESTED_FIELD_MAP[field.key]) {
          const { parent, subkey } = NESTED_FIELD_MAP[field.key]
          if (!nestedAccum[parent]) nestedAccum[parent] = {}
          nestedAccum[parent][subkey] = field.type === 'multi_select' ? (Array.isArray(val) ? val : []) : (val ?? '')
        } else if (ALIAS_FIELD_MAP[field.key]) {
          const dbKey = ALIAS_FIELD_MAP[field.key]
          payload[dbKey] = field.type === 'multi_select' ? (Array.isArray(val) ? val : []) : (val ?? '')
        } else if (COMPOUND_FIELDS.has(field.key)) {
          payload[field.key] = typeof val === 'string' ? stringToCompound(val) : (val || { s: '', c: '', a: '' })
        } else if (KNOWN_CHILD_COLUMNS.has(field.key)) {
          payload[field.key] = field.type === 'multi_select' ? (Array.isArray(val) ? val : []) : (val ?? '')
        } else {
          if (val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0)) {
            customFields[field.key] = val
          }
        }
      })
    })

    Object.entries(nestedAccum).forEach(([k, v]) => { payload[k] = v })
    if (Object.keys(customFields).length > 0) payload.custom_fields_json = customFields

    return payload
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      const payload = buildPayload()
      if (editId.value) {
        await childrenUpdate({ child_id: editId.value, patch: payload })
        ElMessage.success('已保存')
      } else {
        await childrenCreate(payload)
        ElMessage.success('已新增')
      }
      dialogVisible.value = false
      refreshData()
    } finally {
      submitting.value = false
    }
  }

  async function del(row: { _id: string }) {
    await ElMessageBox.confirm('确定删除该孩子档案？', '提示', { type: 'warning' })
    await childrenDelete({ child_id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  // ===== 分配部门 =====
  const assignVisible = ref(false)
  const assignSaving = ref(false)
  const assignDepts = ref<DepartmentRow[]>([])
  const assignSelected = ref<number[]>([])
  const assignTargetId = ref<string | null>(null)
  const assignTargetName = ref('')

  const assignTitle = computed(() =>
    assignTargetName.value ? `分配部门 — ${assignTargetName.value}` : '分配部门'
  )

  async function openAssignDialog(row: Record<string, unknown>) {
    const childId = String((row?._id as string) || (row?.id as number) || '')
    if (!childId) return
    assignTargetId.value = childId
    assignTargetName.value = String(row?.name || '')

    try {
      // 并发拉部门列表 + 当前归属
      const [deptRes, curRes]: [any, any] = await Promise.all([
        departmentsList({ page: 1, page_size: 200, active: true }),
        adminListChildAssignments({ child_id: childId })
      ])
      assignDepts.value = (deptRes?.list || deptRes?.data?.list || []) as DepartmentRow[]
      const ids = (curRes?.department_ids || curRes?.data?.department_ids || []) as number[]
      assignSelected.value = [...ids]
      assignVisible.value = true
    } catch (e: any) {
      ElMessage.error(e?.message || '加载失败')
    }
  }

  async function confirmAssign() {
    if (!assignTargetId.value) return
    assignSaving.value = true
    try {
      await adminSetChildAssignments({
        child_id: assignTargetId.value,
        dept_ids: assignSelected.value
      })
      ElMessage.success('已保存')
      assignVisible.value = false
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      assignSaving.value = false
    }
  }

  // ===== AI 分析 Drawer =====
  const analysisVisible = ref(false)
  const analysisTargetId = ref<string | null>(null)
  const analysisTargetName = ref('')
  const analysisList = ref<ChildAnalysisRow[]>([])
  const analysisMode = ref<string>('')
  const generating = ref(false)
  const writeVisible = ref(false)
  const writeContent = ref('')
  const writeSaving = ref(false)

  const analysisTitle = computed(() =>
    analysisTargetName.value ? `AI 分析 — ${analysisTargetName.value}` : 'AI 分析'
  )

  async function openAnalysisDrawer(row: Record<string, unknown>) {
    const childId = String((row?._id as string) || (row?.id as number) || '')
    if (!childId) return
    analysisTargetId.value = childId
    analysisTargetName.value = String(row?.name || '')
    analysisVisible.value = true
    await loadAnalyses()
  }

  async function loadAnalyses() {
    if (!analysisTargetId.value) return
    try {
      const r: any = await adminListChildAnalyses({ child_id: analysisTargetId.value })
      const data = r?.data || r
      analysisMode.value = data?.mode || ''
      analysisList.value = (data?.list || []) as ChildAnalysisRow[]
    } catch (e: any) {
      ElMessage.error(e?.message || '加载失败')
    }
  }

  function onWriteHuman() {
    writeContent.value = ''
    writeVisible.value = true
  }

  async function confirmWrite() {
    if (!analysisTargetId.value) return
    if (!writeContent.value.trim()) {
      ElMessage.warning('内容不能为空')
      return
    }
    writeSaving.value = true
    try {
      await adminCreateChildAnalysis({
        child_id: analysisTargetId.value,
        content: writeContent.value.trim()
      })
      ElMessage.success('已保存')
      writeVisible.value = false
      await loadAnalyses()
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      writeSaving.value = false
    }
  }

  async function onGenerateAi() {
    if (!analysisTargetId.value) return
    generating.value = true
    try {
      ElMessage.info('调用 GPT 中，约 5-15 秒...')
      await adminGenerateChildAnalysis({ child_id: analysisTargetId.value })
      ElMessage.success('AI 分析已生成')
      await loadAnalyses()
    } catch (e: any) {
      ElMessage.error(e?.message || 'AI 生成失败')
    } finally {
      generating.value = false
    }
  }

  async function onDeactivate(id: number) {
    try {
      await ElMessageBox.confirm('确定撤回该分析？撤回后家长 / 员工不再展示。', '撤回', { type: 'warning' })
    } catch { return }
    try {
      await adminDeactivateAnalysis({ id })
      ElMessage.success('已撤回')
      await loadAnalyses()
    } catch (e: any) {
      ElMessage.error(e?.message || '撤回失败')
    }
  }
</script>

<style scoped>
.analysis-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.analysis-item.inactive { opacity: 0.5; }
.ai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ai-time { color: #909399; font-size: 12px; }
.ai-model { color: #c0c4cc; font-size: 12px; }
.ai-tag-muted { color: #f56c6c; font-size: 12px; }
.ai-content {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
