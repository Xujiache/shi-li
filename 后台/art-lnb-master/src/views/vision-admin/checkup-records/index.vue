<template>
  <div class="vision-checkup-records art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="resetSearchParams"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增记录</ElButton>
          <ArtExcelExport
            :data="exportData"
            filename="检测记录"
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

    <ElDialog v-model="dialogVisible" :title="editId ? '编辑记录' : '新增记录'" width="760px">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <ElFormItem label="孩子" prop="child_id">
          <ElInput
            :model-value="selectedChildLabel"
            placeholder="点击选择孩子（支持姓名/用户8位编号模糊搜索）"
            readonly
            clearable
            :disabled="!!editId"
            @clear="clearSelectedChild"
            @click="openChildPicker"
          >
            <template #append>
              <ElButton :disabled="!!editId" @click="openChildPicker">选择</ElButton>
            </template>
          </ElInput>
        </ElFormItem>

        <ElFormItem label="检测日期" prop="date">
          <ElDatePicker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </ElFormItem>

        <ElRow :gutter="12">
          <ElCol :span="12">
            <ElFormItem label="身高(cm)" prop="height">
              <ElInput v-model="form.height" placeholder="选填" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="12">
            <ElFormItem label="体重(kg)" prop="weight">
              <ElInput v-model="form.weight" placeholder="选填" />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElDivider content-position="left">舌诊观察</ElDivider>
        <ElRow :gutter="12">
          <ElCol :span="8">
            <ElFormItem label="舌形" prop="tongue_shape">
              <ElSelect v-model="form.tongue_shape" clearable placeholder="请选择">
                <ElOption v-for="option in tongueShapeOptions" :key="option" :label="option" :value="option" />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="舌色" prop="tongue_color">
              <ElSelect v-model="form.tongue_color" clearable placeholder="请选择">
                <ElOption v-for="option in tongueColorOptions" :key="option" :label="option" :value="option" />
              </ElSelect>
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="舌苔" prop="tongue_coating">
              <ElSelect v-model="form.tongue_coating" clearable placeholder="请选择">
                <ElOption v-for="option in tongueCoatingOptions" :key="option" :label="option" :value="option" />
              </ElSelect>
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElRow :gutter="12">
          <ElCol :span="8">
            <ElFormItem label="左眼视力" prop="vision_l">
              <ElInput v-model="form.vision_l" placeholder="如：4.8" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="右眼视力" prop="vision_r">
              <ElInput v-model="form.vision_r" placeholder="如：4.9" />
            </ElFormItem>
          </ElCol>
          <ElCol :span="8">
            <ElFormItem label="双眼视力" prop="vision_both">
              <ElInput v-model="form.vision_both" placeholder="如：5.0" />
            </ElFormItem>
          </ElCol>
        </ElRow>

        <ElDivider content-position="left">屈光度（右眼）</ElDivider>
        <ElRow :gutter="12">
          <ElCol :span="8"><ElFormItem label="S"><ElInput v-model="form.refraction_r_s" placeholder="-0.50" /></ElFormItem></ElCol>
          <ElCol :span="8"><ElFormItem label="C"><ElInput v-model="form.refraction_r_c" placeholder="-0.25" /></ElFormItem></ElCol>
          <ElCol :span="8"><ElFormItem label="A"><ElInput v-model="form.refraction_r_a" placeholder="180" /></ElFormItem></ElCol>
        </ElRow>

        <ElDivider content-position="left">屈光度（左眼）</ElDivider>
        <ElRow :gutter="12">
          <ElCol :span="8"><ElFormItem label="S"><ElInput v-model="form.refraction_l_s" placeholder="-0.75" /></ElFormItem></ElCol>
          <ElCol :span="8"><ElFormItem label="C"><ElInput v-model="form.refraction_l_c" placeholder="-0.25" /></ElFormItem></ElCol>
          <ElCol :span="8"><ElFormItem label="A"><ElInput v-model="form.refraction_l_a" placeholder="180" /></ElFormItem></ElCol>
        </ElRow>

        <ElDivider content-position="left">视光诊断</ElDivider>
        <ElRow :gutter="12">
          <ElCol :span="12"><ElFormItem label="裸眼视力"><ElInput v-model="form.diagnosis_vision_status" placeholder="正常/不正常" /></ElFormItem></ElCol>
          <ElCol :span="12"><ElFormItem label="屈光度"><ElInput v-model="form.diagnosis_refraction_status" placeholder="正常/不正常" /></ElFormItem></ElCol>
          <ElCol :span="12"><ElFormItem label="眼位"><ElInput v-model="form.diagnosis_axis_status" placeholder="正常" /></ElFormItem></ElCol>
          <ElCol :span="12"><ElFormItem label="角膜曲率"><ElInput v-model="form.diagnosis_cornea_status" placeholder="正常" /></ElFormItem></ElCol>
        </ElRow>

        <ElFormItem label="结论/建议" prop="conclusion">
          <ElInput v-model="form.conclusion" type="textarea" :rows="3" placeholder="选填" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 选择孩子弹窗：按姓名/用户8位编号（user_no）模糊搜索 -->
    <ElDialog v-model="childPickerVisible" title="选择孩子" width="920px">
      <div class="flex items-center gap-3" style="margin-bottom: 12px">
        <ElInput
          v-model="childPickerKeyword"
          placeholder="输入孩子姓名 / 用户8位编号（ID）/ 手机号 / 子编号"
          clearable
          @keyup.enter="doChildPickerSearch"
        />
        <ElButton type="primary" :loading="childPickerLoading" @click="doChildPickerSearch">搜索</ElButton>
      </div>

      <ElTable
        v-loading="childPickerLoading"
        :data="childPickerList"
        height="420"
        style="width: 100%"
        @row-dblclick="pickChild"
      >
        <ElTableColumn prop="name" label="姓名" width="110" />
        <ElTableColumn prop="parent_user_no" label="用户ID(8位)" width="130" />
        <ElTableColumn prop="parent_phone" label="手机号" width="130" />
        <ElTableColumn prop="child_no" label="子编号" width="120" />
        <ElTableColumn prop="school" label="学校" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="class_name" label="班级" width="120" show-overflow-tooltip />
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="pickChild(row)">选择</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="text-xs text-g-500" style="margin-top: 10px">
        共 {{ childPickerTotal }} 条结果（双击行也可选择）
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    checkupRecordsList,
    checkupRecordsDetail,
    checkupRecordsCreate,
    checkupRecordsUpdate,
    checkupRecordsDelete,
    childrenSearch
  } from '@/api/vision-admin'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminCheckupRecords' })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const searchForm = ref({
    q: undefined,
    school: undefined,
    class_name: undefined,
    date_from: undefined,
    date_to: undefined
  })
  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '孩子姓名/手机号/子编号' } },
    { label: '学校', key: 'school', type: 'input', props: { placeholder: '学校' } },
    { label: '班级', key: 'class_name', type: 'input', props: { placeholder: '班级' } },
    { label: '开始日期', key: 'date_from', type: 'input', props: { placeholder: 'YYYY-MM-DD' } },
    { label: '结束日期', key: 'date_to', type: 'input', props: { placeholder: 'YYYY-MM-DD' } }
  ]

  // —— 记录编辑弹窗 ——
  const dialogVisible = ref(false)
  const editId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  interface ChildPickerRow {
    _id: string
    name?: string
    school?: string
    class_name?: string
    parent_phone?: string
    parent_user_no?: string
    child_no?: string
  }

  const selectedChild = ref<ChildPickerRow | null>(null)
  const selectedChildLabel = computed(() => {
    const c = selectedChild.value
    if (!c) return ''
    const schoolClass = `${c.school || '—'} ${c.class_name || '—'}`.trim()
    const phone = c.parent_phone ? String(c.parent_phone) : ''
    const userNo = c.parent_user_no ? String(c.parent_user_no) : ''
    const childNo = c.child_no ? String(c.child_no) : ''
    const tail = [
      userNo ? `ID:${userNo}` : '',
      phone ? `手机:${phone}` : '',
      childNo ? `子编号:${childNo}` : ''
    ].filter(Boolean).join(' / ')
    return `${c.name || '—'} · ${schoolClass}${tail ? ` · ${tail}` : ''}`
  })

  const childPickerVisible = ref(false)
  const childPickerKeyword = ref('')
  const childPickerLoading = ref(false)
  const childPickerList = ref<ChildPickerRow[]>([])
  const childPickerTotal = ref(0)

  let childPickerTimer: any = null
  watch(
    () => childPickerKeyword.value,
    (val) => {
      if (!childPickerVisible.value) return
      if (childPickerTimer) clearTimeout(childPickerTimer)
      childPickerTimer = setTimeout(() => {
        // 输入为空时清空列表
        if (!String(val || '').trim()) {
          childPickerList.value = []
          childPickerTotal.value = 0
          return
        }
        doChildPickerSearch()
      }, 300)
    }
  )

  function openChildPicker() {
    if (editId.value) return
    childPickerVisible.value = true
    // 打开弹窗时若已有关键字则执行一次搜索
    if (String(childPickerKeyword.value || '').trim()) {
      doChildPickerSearch()
    }
  }

  function clearSelectedChild() {
    if (editId.value) return
    selectedChild.value = null
    form.child_id = ''
    try {
      formRef.value?.clearValidate(['child_id'])
    } catch {
      // ignore
    }
  }

  async function doChildPickerSearch() {
    const q = String(childPickerKeyword.value || '').trim()
    if (!q) {
      childPickerList.value = []
      childPickerTotal.value = 0
      return
    }
    childPickerLoading.value = true
    try {
      const res = (await childrenSearch({ q, page: 1, page_size: 50 })) as any
      const list = Array.isArray(res?.list) ? res.list : []
      childPickerList.value = list.map((c: any) => ({
        _id: String(c._id),
        name: c.name || '',
        school: c.school || '',
        class_name: c.class_name || '',
        parent_phone: c.parent_phone || '',
        parent_user_no: c.parent_user_no || '',
        child_no: c.child_no || ''
      }))
      childPickerTotal.value = typeof res?.total === 'number' ? res.total : childPickerList.value.length
    } finally {
      childPickerLoading.value = false
    }
  }

  async function pickChild(row: ChildPickerRow) {
    if (!row || !row._id) return
    selectedChild.value = { ...row }
    form.child_id = String(row._id)
    childPickerVisible.value = false
    await nextTick()
    try {
      formRef.value?.validateField('child_id')
    } catch {
      // ignore
    }
  }

  const form = reactive({
    child_id: '',
    date: '',
    height: '',
    weight: '',
    tongue_shape: '',
    tongue_color: '',
    tongue_coating: '',
    vision_l: '',
    vision_r: '',
    vision_both: '',
    refraction_r_s: '',
    refraction_r_c: '',
    refraction_r_a: '',
    refraction_l_s: '',
    refraction_l_c: '',
    refraction_l_a: '',
    diagnosis_vision_status: '',
    diagnosis_refraction_status: '',
    diagnosis_axis_status: '',
    diagnosis_cornea_status: '',
    conclusion: ''
  })

  const formRules: FormRules = {
    child_id: [{ required: true, message: '请选择孩子', trigger: 'change' }],
    date: [{ required: true, message: '请选择检测日期', trigger: 'change' }]
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: checkupRecordsList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: '_id', label: '记录ID', width: 260, showOverflowTooltip: true },
        { prop: 'child_name', label: '姓名', width: 90 },
        { prop: 'school', label: '学校', width: 120 },
        { prop: 'class_name', label: '班级', width: 110 },
        { prop: 'parent_phone', label: '家长手机号', width: 120 },
        { prop: 'date', label: '日期', width: 110 },
        { prop: 'vision_l', label: '左眼', width: 70 },
        { prop: 'vision_r', label: '右眼', width: 70 },
        { prop: 'vision_both', label: '双眼', width: 70 },
        { prop: 'conclusion', label: '结论', showOverflowTooltip: true },
        { prop: 'updated_at', label: '更新时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(ArtButtonTable, { type: 'delete', onClick: () => del(row) })
            ])
        }
      ]
    }
  })

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: '记录ID',
    child_name: '姓名',
    school: '学校',
    class_name: '班级',
    parent_phone: '家长手机号',
    date: '日期',
    height: '身高(cm)',
    weight: '体重(kg)',
    tongue_shape: '舌形',
    tongue_color: '舌色',
    tongue_coating: '舌苔',
    vision_l: '左眼视力',
    vision_r: '右眼视力',
    vision_both: '双眼视力',
    conclusion: '结论',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  function resetForm() {
    Object.assign(form, {
      child_id: '',
      date: '',
      height: '',
      weight: '',
      tongue_shape: '',
      tongue_color: '',
      tongue_coating: '',
      vision_l: '',
      vision_r: '',
      vision_both: '',
      refraction_r_s: '',
      refraction_r_c: '',
      refraction_r_a: '',
      refraction_l_s: '',
      refraction_l_c: '',
      refraction_l_a: '',
      diagnosis_vision_status: '',
      diagnosis_refraction_status: '',
      diagnosis_axis_status: '',
      diagnosis_cornea_status: '',
      conclusion: ''
    })
    selectedChild.value = null
  }

  async function openDialog(type: 'add' | 'edit', row?: any) {
    resetForm()
    editId.value = type === 'edit' && row?._id ? String(row._id) : null

    // 预置孩子（编辑时禁用修改）
    if (row?.child_id) {
      form.child_id = String(row.child_id)
      selectedChild.value = {
        _id: String(row.child_id),
        name: row.child_name || '',
        school: row.school || '',
        class_name: row.class_name || '',
        parent_phone: row.parent_phone || '',
        child_no: row.child_no || ''
      }
    }

    dialogVisible.value = true
    await nextTick()
    formRef.value?.clearValidate()

    if (editId.value) {
      const res = (await checkupRecordsDetail({ record_id: editId.value })) as any
      const r = res?.record || res?.row || res
      if (!r) return

      const rl = r.refraction_l && typeof r.refraction_l === 'object' ? r.refraction_l : {}
      const rr = r.refraction_r && typeof r.refraction_r === 'object' ? r.refraction_r : {}
      const d = r.diagnosis && typeof r.diagnosis === 'object' ? r.diagnosis : {}

      form.child_id = r.child_id || form.child_id
      form.date = r.date || ''
      form.height = r.height === undefined || r.height === null ? '' : String(r.height)
      form.weight = r.weight === undefined || r.weight === null ? '' : String(r.weight)
      form.tongue_shape = r.tongue_shape || ''
      form.tongue_color = r.tongue_color || ''
      form.tongue_coating = r.tongue_coating || ''
      form.vision_l = r.vision_l || ''
      form.vision_r = r.vision_r || ''
      form.vision_both = r.vision_both || ''
      form.refraction_r_s = rr.s || ''
      form.refraction_r_c = rr.c || ''
      form.refraction_r_a = rr.a || ''
      form.refraction_l_s = rl.s || ''
      form.refraction_l_c = rl.c || ''
      form.refraction_l_a = rl.a || ''
      form.diagnosis_vision_status = d.vision_status || ''
      form.diagnosis_refraction_status = d.refraction_status || ''
      form.diagnosis_axis_status = d.axis_status || ''
      form.diagnosis_cornea_status = d.cornea_status || ''
      form.conclusion = r.conclusion || ''
    }
  }

  function buildRecordPayload() {
    return {
      child_id: form.child_id,
      date: form.date,
      height: form.height,
      weight: form.weight,
      tongue_shape: form.tongue_shape,
      tongue_color: form.tongue_color,
      tongue_coating: form.tongue_coating,
      vision_l: form.vision_l,
      vision_r: form.vision_r,
      vision_both: form.vision_both,
      refraction_l: { s: form.refraction_l_s, c: form.refraction_l_c, a: form.refraction_l_a },
      refraction_r: { s: form.refraction_r_s, c: form.refraction_r_c, a: form.refraction_r_a },
      diagnosis: {
        vision_status: form.diagnosis_vision_status,
        refraction_status: form.diagnosis_refraction_status,
        axis_status: form.diagnosis_axis_status,
        cornea_status: form.diagnosis_cornea_status
      },
      conclusion: form.conclusion
    }
  }

  const tongueShapeOptions = ['正常', '胖大', '瘦薄', '裂纹', '齿痕', '不清楚']
  const tongueColorOptions = ['淡红', '红', '暗红', '淡白', '紫暗', '不清楚']
  const tongueCoatingOptions = ['薄白', '厚白', '黄苔', '少苔', '无苔', '不清楚']

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      const payload = buildRecordPayload()
      if (editId.value) {
        await checkupRecordsUpdate({ record_id: editId.value, patch: payload })
        ElMessage.success('已保存')
      } else {
        await checkupRecordsCreate({ record: payload })
        ElMessage.success('已新增')
      }
      dialogVisible.value = false
      refreshData()
    } finally {
      submitting.value = false
    }
  }

  async function del(row: any) {
    const id = row?._id ? String(row._id) : ''
    if (!id) return
    await ElMessageBox.confirm('确定删除该记录？', '提示', { type: 'warning' })
    await checkupRecordsDelete({ record_id: id })
    ElMessage.success('已删除')
    refreshData()
  }
</script>
