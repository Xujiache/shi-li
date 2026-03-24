<template>
  <div class="vision-appointment-records art-full-height">
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
            filename="预约记录"
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

    <ElDialog v-model="dialogVisible" :title="editId ? '编辑记录' : '新增记录'" width="620px">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <ElFormItem label="孩子ID" prop="child_id">
          <ElInput v-model="form.child_id" placeholder="children._id" :disabled="!!editId" />
        </ElFormItem>
        <ElFormItem label="孩子姓名" prop="child_name">
          <ElInput v-model="form.child_name" placeholder="如：张三" />
        </ElFormItem>
        <ElFormItem label="班级" prop="class_name">
          <ElInput v-model="form.class_name" placeholder="如：一年二班" />
        </ElFormItem>
        <ElFormItem label="预约项目" prop="item_name">
          <ElInput v-model="form.item_name" placeholder="如：视力复查" />
        </ElFormItem>
        <ElFormItem label="日期" prop="date">
          <ElInput v-model="form.date" placeholder="YYYY-MM-DD" />
        </ElFormItem>
        <ElFormItem label="时段" prop="time_slot">
          <ElInput v-model="form.time_slot" placeholder="如：09:00-10:00" />
        </ElFormItem>
        <ElFormItem label="手机号" prop="phone">
          <ElInput v-model="form.phone" placeholder="家长手机号" />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSelect v-model="form.status" placeholder="请选择" style="width: 100%">
            <ElOption label="已确认" value="confirmed" />
            <ElOption label="已取消" value="cancelled" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="排班ID" prop="schedule_id">
          <ElInput v-model="form.schedule_id" placeholder="选填（appointment_schedules._id）" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    appointmentRecordsList,
    appointmentRecordsDetail,
    appointmentRecordsCreate,
    appointmentRecordsUpdate,
    appointmentRecordsDelete,
    appointmentRecordsSetStatus
  } from '@/api/vision-admin'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminAppointmentRecords' })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const searchForm = ref({ child_id: undefined, phone: undefined, status: undefined, date: undefined })
  const searchItems = [
    { label: '孩子ID', key: 'child_id', type: 'input', props: { placeholder: 'child_id' } },
    { label: '手机号', key: 'phone', type: 'input', props: { placeholder: '手机号' } },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '已确认', value: 'confirmed' },
          { label: '已取消', value: 'cancelled' }
        ]
      }
    },
    { label: '日期', key: 'date', type: 'input', props: { placeholder: 'YYYY-MM-DD' } }
  ]

  // —— 记录编辑弹窗 ——
  const dialogVisible = ref(false)
  const editId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const form = reactive({
    child_id: '',
    child_name: '',
    class_name: '',
    item_name: '',
    date: '',
    time_slot: '',
    phone: '',
    status: 'confirmed',
    schedule_id: ''
  })

  const formRules: FormRules = {
    child_id: [{ required: true, message: '请输入孩子ID', trigger: 'blur' }],
    child_name: [{ required: true, message: '请输入孩子姓名', trigger: 'blur' }],
    item_name: [{ required: true, message: '请输入预约项目', trigger: 'blur' }],
    date: [{ required: true, message: '请输入日期', trigger: 'blur' }],
    time_slot: [{ required: true, message: '请输入时段', trigger: 'blur' }],
    phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }]
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
      apiFn: appointmentRecordsList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: '_id', label: '记录ID', width: 260, showOverflowTooltip: true },
        { prop: 'child_id', label: '孩子ID', width: 260, showOverflowTooltip: true },
        { prop: 'child_name', label: '孩子姓名', width: 100 },
        { prop: 'class_name', label: '班级', width: 100 },
        { prop: 'item_name', label: '项目名称', width: 120 },
        { prop: 'date', label: '日期', width: 110 },
        { prop: 'time_slot', label: '时段', width: 110 },
        { prop: 'phone', label: '手机号', width: 120 },
        {
          prop: 'status',
          label: '状态',
          width: 100,
          formatter: (row: any) =>
            h(
              ElTag,
              { type: String(row?.status) === 'confirmed' ? 'success' : 'info', size: 'small' },
              () => (String(row?.status) === 'confirmed' ? '已确认' : '已取消')
            )
        },
        { prop: 'created_at', label: '创建时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(ArtButtonTable, { type: 'delete', onClick: () => del(row) }),
              h(
                'span',
                { class: 'el-link el-link--primary', onClick: () => toggleStatus(row) },
                () => (String(row?.status) === 'confirmed' ? '取消' : '恢复')
              )
            ])
        }
      ]
    }
  })

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: '记录ID',
    child_id: '孩子ID',
    child_name: '孩子姓名',
    class_name: '班级',
    item_name: '项目名称',
    date: '日期',
    time_slot: '时段',
    phone: '手机号',
    status: '状态',
    created_at: '创建时间'
  }

  function resetForm() {
    form.child_id = ''
    form.child_name = ''
    form.class_name = ''
    form.item_name = ''
    form.date = ''
    form.time_slot = ''
    form.phone = ''
    form.status = 'confirmed'
    form.schedule_id = ''
  }

  async function openDialog(type: 'add' | 'edit', row?: any) {
    resetForm()
    editId.value = type === 'edit' && row && row._id ? String(row._id) : null
    dialogVisible.value = true
    if (!editId.value) return
    try {
      const res = (await appointmentRecordsDetail({ _id: editId.value })) as any
      const r = res?.row || {}
      form.child_id = String(r.child_id ?? '')
      form.child_name = String(r.child_name ?? '')
      form.class_name = String(r.class_name ?? '')
      form.item_name = String(r.item_name ?? '')
      form.date = String(r.date ?? '')
      form.time_slot = String(r.time_slot ?? '')
      form.phone = String(r.phone ?? '')
      form.status = String(r.status ?? 'confirmed')
      form.schedule_id = String(r.schedule_id ?? '')
    } catch (e) {
      // ignore
    }
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await appointmentRecordsUpdate({
          _id: editId.value,
          patch: {
            child_name: form.child_name,
            class_name: form.class_name,
            item_name: form.item_name,
            date: form.date,
            time_slot: form.time_slot,
            phone: form.phone,
            status: form.status,
            schedule_id: form.schedule_id
          }
        })
        ElMessage.success('已保存')
      } else {
        await appointmentRecordsCreate({
          record: {
            child_id: form.child_id,
            child_name: form.child_name,
            class_name: form.class_name,
            item_name: form.item_name,
            date: form.date,
            time_slot: form.time_slot,
            phone: form.phone,
            status: form.status,
            schedule_id: form.schedule_id
          }
        })
        ElMessage.success('已新增')
      }
      dialogVisible.value = false
      refreshData()
    } finally {
      submitting.value = false
    }
  }

  async function del(row: any) {
    const id = row && row._id ? String(row._id) : ''
    if (!id) return
    await ElMessageBox.confirm('确定删除该预约记录？', '提示', { type: 'warning' })
    await appointmentRecordsDelete({ _id: id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function toggleStatus(row: any) {
    const id = row && row._id ? String(row._id) : ''
    if (!id) return
    const cur = String(row?.status ?? '')
    const next = cur === 'cancelled' ? 'confirmed' : 'cancelled'
    await appointmentRecordsSetStatus({ _id: id, status: next })
    ElMessage.success('已更新')
    refreshData()
  }
</script>
