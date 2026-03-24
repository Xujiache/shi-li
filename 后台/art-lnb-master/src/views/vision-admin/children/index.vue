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

          <ElDivider content-position="left">裸眼视力</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="8"><ElFormItem label="右眼"><ElInput v-model="form.vision_r" placeholder="如 4.8" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="左眼"><ElInput v-model="form.vision_l" placeholder="如 5.0" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="双眼"><ElInput v-model="form.vision_both" placeholder="如 5.0" /></ElFormItem></ElCol>
          </ElRow>

          <ElDivider content-position="left">右眼屈光度</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="8"><ElFormItem label="S(球镜)"><ElInput v-model="form.refraction_r_s" placeholder="-1.50" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="C(柱镜)"><ElInput v-model="form.refraction_r_c" placeholder="-0.75" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="A(轴位)"><ElInput v-model="form.refraction_r_a" placeholder="180" /></ElFormItem></ElCol>
          </ElRow>

          <ElDivider content-position="left">左眼屈光度</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="8"><ElFormItem label="S(球镜)"><ElInput v-model="form.refraction_l_s" placeholder="-1.25" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="C(柱镜)"><ElInput v-model="form.refraction_l_c" placeholder="-0.50" /></ElFormItem></ElCol>
            <ElCol :span="8"><ElFormItem label="A(轴位)"><ElInput v-model="form.refraction_l_a" placeholder="175" /></ElFormItem></ElCol>
          </ElRow>

          <ElDivider content-position="left">曲率与眼轴</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="右眼曲率"><ElInput v-model="form.curvature_r" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="左眼曲率"><ElInput v-model="form.curvature_l" /></ElFormItem></ElCol>
          </ElRow>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="右眼眼轴"><ElInput v-model="form.axial_length_r" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="左眼眼轴"><ElInput v-model="form.axial_length_l" /></ElFormItem></ElCol>
          </ElRow>

          <ElDivider content-position="left">视光诊断</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="12">
              <ElFormItem label="裸眼视力">
                <ElSelect v-model="form.diag_vision" placeholder="请选择" style="width:100%">
                  <ElOption label="正常" value="正常" /><ElOption label="不正常" value="不正常" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
            <ElCol :span="12">
              <ElFormItem label="屈光度">
                <ElSelect v-model="form.diag_refraction" multiple placeholder="可多选" style="width:100%">
                  <ElOption v-for="opt in diagRefractionOpts" :key="opt" :label="opt" :value="opt" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
          </ElRow>
          <ElRow :gutter="16">
            <ElCol :span="8">
              <ElFormItem label="眼轴">
                <ElSelect v-model="form.diag_axial" placeholder="请选择" style="width:100%">
                  <ElOption v-for="opt in diagAxialOpts" :key="opt" :label="opt" :value="opt" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
            <ElCol :span="8">
              <ElFormItem label="角膜曲率">
                <ElSelect v-model="form.diag_curvature" placeholder="请选择" style="width:100%">
                  <ElOption v-for="opt in diagCurvatureOpts" :key="opt" :label="opt" :value="opt" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
            <ElCol :span="8">
              <ElFormItem label="轴率比">
                <ElSelect v-model="form.diag_axial_ratio" placeholder="请选择" style="width:100%">
                  <ElOption v-for="opt in diagAxialRatioOpts" :key="opt" :label="opt" :value="opt" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
          </ElRow>

          <ElDivider content-position="left">视光管理方案</ElDivider>
          <ElFormItem label="管理方案"><ElInput v-model="form.management_plan" type="textarea" :rows="3" placeholder="建议内容" /></ElFormItem>
          <ElRow :gutter="16">
            <ElCol :span="12"><ElFormItem label="验光师"><ElInput v-model="form.optometrist_name" /></ElFormItem></ElCol>
            <ElCol :span="12"><ElFormItem label="检查日期"><ElDatePicker v-model="form.exam_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></ElFormItem></ElCol>
          </ElRow>

          <ElDivider content-position="left">中医证候评分</ElDivider>
          <ElRow :gutter="16" v-for="item in tcmSymptomKeys" :key="item.key">
            <ElCol :span="8"><span style="line-height:32px">{{ item.label }}</span></ElCol>
            <ElCol :span="16">
              <ElRadioGroup v-model="form.tcm_symptoms[item.key]">
                <ElRadioButton v-for="s in severityOpts" :key="s" :value="s">{{ s }}</ElRadioButton>
              </ElRadioGroup>
            </ElCol>
          </ElRow>
          <ElFormItem label="其他症状" style="margin-top:12px"><ElInput v-model="form.tcm_symptom_other" /></ElFormItem>

          <ElDivider content-position="left">中医证型判定</ElDivider>
          <ElFormItem label="证型">
            <ElCheckboxGroup v-model="form.tcm_syndrome_types">
              <ElCheckbox v-for="opt in syndromeOpts" :key="opt" :label="opt" :value="opt" />
            </ElCheckboxGroup>
          </ElFormItem>
          <ElFormItem label="其他证型"><ElInput v-model="form.tcm_syndrome_other" /></ElFormItem>

          <ElDivider content-position="left">风险等级与调理方案</ElDivider>
          <ElRow :gutter="16">
            <ElCol :span="12">
              <ElFormItem label="风险等级">
                <ElSelect v-model="form.risk_level" placeholder="请选择" style="width:100%">
                  <ElOption v-for="opt in riskOpts" :key="opt" :label="opt" :value="opt" />
                </ElSelect>
              </ElFormItem>
            </ElCol>
          </ElRow>
          <ElFormItem label="调理方案">
            <ElCheckboxGroup v-model="form.treatment_plans">
              <ElCheckbox v-for="opt in treatmentOpts" :key="opt" :label="opt" :value="opt" />
            </ElCheckboxGroup>
          </ElFormItem>
          <ElFormItem label="其他方案"><ElInput v-model="form.treatment_other" /></ElFormItem>
          <ElFormItem label="医师签名"><ElInput v-model="form.doctor_name" /></ElFormItem>
        </ElForm>
      </div>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, onMounted } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { childrenList, childrenCreate, childrenUpdate, childrenDelete, schoolClassesList } from '@/api/vision-admin'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminChildren' })

  const tcmSymptomKeys = [
    { key: 'eye_fatigue', label: '眼干易疲劳' },
    { key: 'blurred', label: '视物昏花' },
    { key: 'night_vision', label: '夜视力差' },
    { key: 'waist_leg', label: '腰酸腿软' },
    { key: 'poor_sleep', label: '睡眠差多梦' },
    { key: 'fatigue_attention', label: '乏力注意力差' },
    { key: 'pale_face', label: '面色少华' },
    { key: 'tongue_pulse_a', label: '舌质淡/少苔' },
    { key: 'weak_pulse', label: '脉细弱' }
  ]
  const severityOpts = ['无', '轻', '中', '重']
  const syndromeOpts = ['肝肾亏虚证', '肾精不足证', '肝血不足证', '脾气虚弱证', '心脾两虚证']
  const riskOpts = ['低危', '中危', '高危（眼轴快涨型）']
  const treatmentOpts = ['补肾填精固轴', '养肝血明目', '健脾益气升清', '综合干预（中药+外治+训练）']
  const diagRefractionOpts = ['正常', '近视', '散光', '弱视', '原始储备低']
  const diagAxialOpts = ['正常', '眼轴长', '眼轴短']
  const diagCurvatureOpts = ['正常', '曲率陡', '曲率平']
  const diagAxialRatioOpts = ['3.0', '＞3.1', '＞3.3']

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const schoolOptions = ref<{ school: string; class_name: string }[]>([])
  onMounted(async () => {
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

  function emptyTcmSymptoms(): Record<string, string> {
    const map: Record<string, string> = {}
    tcmSymptomKeys.forEach((x) => { map[x.key] = '' })
    return map
  }

  const form = reactive({
    name: '',
    gender: '男',
    dob: '',
    school: '',
    class_name: '',
    parent_phone: '',
    height: null as number | null,
    weight: null as number | null,
    vision_r: '',
    vision_l: '',
    vision_both: '',
    refraction_r_s: '',
    refraction_r_c: '',
    refraction_r_a: '',
    refraction_l_s: '',
    refraction_l_c: '',
    refraction_l_a: '',
    curvature_r: '',
    curvature_l: '',
    axial_length_r: '',
    axial_length_l: '',
    diag_vision: '',
    diag_refraction: [] as string[],
    diag_axial: '',
    diag_curvature: '',
    diag_axial_ratio: '',
    management_plan: '',
    optometrist_name: '',
    exam_date: '',
    tcm_symptoms: emptyTcmSymptoms(),
    tcm_symptom_other: '',
    tcm_syndrome_types: [] as string[],
    tcm_syndrome_other: '',
    risk_level: '',
    treatment_plans: [] as string[],
    treatment_other: '',
    doctor_name: ''
  })

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
          width: 120,
          fixed: 'right',
          formatter: (row: Record<string, unknown>) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
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
    form.vision_r = (row?.vision_r as string) ?? ''
    form.vision_l = (row?.vision_l as string) ?? ''
    form.vision_both = (row?.vision_both as string) ?? ''

    const rrd = row?.refraction_r_detail as Record<string, string> | null
    form.refraction_r_s = rrd?.s ?? ''
    form.refraction_r_c = rrd?.c ?? ''
    form.refraction_r_a = rrd?.a ?? ''
    const rld = row?.refraction_l_detail as Record<string, string> | null
    form.refraction_l_s = rld?.s ?? ''
    form.refraction_l_c = rld?.c ?? ''
    form.refraction_l_a = rld?.a ?? ''

    form.curvature_r = (row?.curvature_r as string) ?? ''
    form.curvature_l = (row?.curvature_l as string) ?? ''
    form.axial_length_r = (row?.axial_length_r as string) ?? ''
    form.axial_length_l = (row?.axial_length_l as string) ?? ''

    const dj = row?.diagnosis_json as Record<string, unknown> | null
    form.diag_vision = (dj?.vision as string) ?? ''
    form.diag_refraction = Array.isArray(dj?.refraction) ? (dj.refraction as string[]) : []
    form.diag_axial = (dj?.axial as string) ?? ''
    form.diag_curvature = (dj?.curvature as string) ?? ''
    form.diag_axial_ratio = (dj?.axial_ratio as string) ?? ''

    form.management_plan = (row?.management_plan as string) ?? ''
    form.optometrist_name = (row?.optometrist_name as string) ?? ''
    form.exam_date = (row?.exam_date as string) ?? ''

    const tcmRaw = row?.tcm_symptoms_json as Record<string, string> | null
    form.tcm_symptoms = { ...emptyTcmSymptoms(), ...(tcmRaw ?? {}) }
    form.tcm_symptom_other = (row?.tcm_symptom_other as string) ?? ''
    form.tcm_syndrome_types = Array.isArray(row?.tcm_syndrome_types) ? (row.tcm_syndrome_types as string[]) : []
    form.tcm_syndrome_other = (row?.tcm_syndrome_other as string) ?? ''
    form.risk_level = (row?.risk_level as string) ?? ''
    form.treatment_plans = Array.isArray(row?.treatment_plans) ? (row.treatment_plans as string[]) : []
    form.treatment_other = (row?.treatment_other as string) ?? ''
    form.doctor_name = (row?.doctor_name as string) ?? ''

    dialogVisible.value = true
  }

  function buildPayload() {
    return {
      name: form.name,
      gender: form.gender,
      dob: form.dob,
      school: form.school,
      class_name: form.class_name,
      parent_phone: form.parent_phone,
      height: form.height,
      weight: form.weight,
      vision_r: form.vision_r,
      vision_l: form.vision_l,
      vision_both: form.vision_both,
      refraction_r_detail: { s: form.refraction_r_s, c: form.refraction_r_c, a: form.refraction_r_a },
      refraction_l_detail: { s: form.refraction_l_s, c: form.refraction_l_c, a: form.refraction_l_a },
      curvature_r: form.curvature_r,
      curvature_l: form.curvature_l,
      axial_length_r: form.axial_length_r,
      axial_length_l: form.axial_length_l,
      diagnosis_json: {
        vision: form.diag_vision,
        refraction: form.diag_refraction,
        axial: form.diag_axial,
        curvature: form.diag_curvature,
        axial_ratio: form.diag_axial_ratio
      },
      management_plan: form.management_plan,
      optometrist_name: form.optometrist_name,
      exam_date: form.exam_date,
      tcm_symptoms_json: form.tcm_symptoms,
      tcm_symptom_other: form.tcm_symptom_other,
      tcm_syndrome_types: form.tcm_syndrome_types,
      tcm_syndrome_other: form.tcm_syndrome_other,
      risk_level: form.risk_level,
      treatment_plans: form.treatment_plans,
      treatment_other: form.treatment_other,
      doctor_name: form.doctor_name
    }
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
</script>
