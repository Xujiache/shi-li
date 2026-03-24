<template>
  <div class="vision-appointment-schedules art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="resetSearchParams"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增排班</ElButton>
          <ArtExcelExport
            :data="exportData"
            filename="预约排班"
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
    <ElDialog v-model="dialogVisible" :title="editId ? '编辑排班' : '新增排班'" width="480px">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <ElFormItem label="预约项目" prop="item_id">
          <ElSelect v-model="form.item_id" placeholder="请选择" filterable style="width:100%">
            <ElOption v-for="it in itemOptions" :key="it._id" :label="it.name" :value="it._id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="日期" prop="date"><ElDatePicker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></ElFormItem>
        <ElFormItem label="时段" prop="time_slot"><ElInput v-model="form.time_slot" placeholder="如 09:00-10:00" /></ElFormItem>
        <ElFormItem label="最大容量" prop="max_count"><ElInputNumber v-model="form.max_count" :min="0" style="width:100%" /></ElFormItem>
        <ElFormItem label="已预约数" prop="booked_count"><ElInputNumber v-model="form.booked_count" :min="0" style="width:100%" /></ElFormItem>
        <ElFormItem label="启用" prop="active"><ElSwitch v-model="form.active" /></ElFormItem>
      </ElForm>
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
  import {
    appointmentSchedulesList,
    appointmentSchedulesCreate,
    appointmentSchedulesUpdate,
    appointmentSchedulesDelete,
    appointmentSchedulesToggle,
    appointmentItemsList
  } from '@/api/vision-admin'
  import { ElMessageBox, ElMessage, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminAppointmentSchedules' })

  const itemOptions = ref<{ _id: string; name?: string }[]>([])
  onMounted(async () => {
    const res = await appointmentItemsList({}) as { list?: { _id: string; name?: string }[] }
    itemOptions.value = res.list || []
  })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const searchForm = ref({ item_id: undefined, date: undefined, active: undefined })
  const searchItems = [
    { label: '日期', key: 'date', type: 'input', props: { placeholder: 'YYYY-MM-DD' } },
    {
      label: '状态',
      key: 'active',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '启用', value: true },
          { label: '停用', value: false }
        ]
      }
    }
  ]

  const dialogVisible = ref(false)
  const editId = ref<string | null>(null)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const form = reactive({
    item_id: '',
    date: '',
    time_slot: '',
    max_count: 0,
    booked_count: 0,
    active: true
  })
  const formRules: FormRules = {
    item_id: [{ required: true, message: '请选择预约项目', trigger: 'change' }],
    date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    time_slot: [{ required: true, message: '请输入时段', trigger: 'blur' }],
    max_count: [{ required: true, message: '请输入最大容量', trigger: 'blur' }]
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
      apiFn: appointmentSchedulesList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'item_id', label: '项目ID', width: 260, showOverflowTooltip: true },
        { prop: 'date', label: '日期', width: 120 },
        { prop: 'time_slot', label: '时段', width: 120 },
        { prop: 'max_count', label: '最大容量', width: 90 },
        { prop: 'booked_count', label: '已预约', width: 90 },
        {
          prop: 'active',
          label: '启用',
          width: 80,
          formatter: (row: { active?: boolean }) => h(ElTag, { type: row.active !== false ? 'success' : 'info', size: 'small' }, () => (row.active !== false ? '是' : '否'))
        },
        { prop: 'updated_at', label: '更新时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: { _id: string; active?: boolean }) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(ArtButtonTable, { type: 'delete', onClick: () => del(row) }),
              h('span', { class: 'el-link el-link--primary', onClick: () => toggle(row) }, () => (row.active !== false ? '停用' : '启用'))
            ])
        }
      ]
    }
  })

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: 'ID',
    item_id: '项目ID',
    date: '日期',
    time_slot: '时段',
    max_count: '最大容量',
    booked_count: '已预约',
    active: '启用状态',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  function openDialog(type: 'add' | 'edit', row?: Record<string, unknown>) {
    editId.value = type === 'edit' && row?._id ? String(row._id) : null
    form.item_id = (row?.item_id as string) ?? ''
    form.date = (row?.date as string) ?? ''
    form.time_slot = (row?.time_slot as string) ?? ''
    form.max_count = (row?.max_count as number) ?? 0
    form.booked_count = (row?.booked_count as number) ?? 0
    form.active = (row?.active !== false)
    dialogVisible.value = true
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await appointmentSchedulesUpdate({
          _id: editId.value,
          patch: { item_id: form.item_id, date: form.date, time_slot: form.time_slot, max_count: form.max_count, booked_count: form.booked_count, active: form.active }
        })
        ElMessage.success('已保存')
      } else {
        await appointmentSchedulesCreate({
          item_id: form.item_id,
          date: form.date,
          time_slot: form.time_slot,
          max_count: form.max_count,
          booked_count: form.booked_count,
          active: form.active
        })
        ElMessage.success('已新增')
      }
      dialogVisible.value = false
      refreshData()
    } finally {
      submitting.value = false
    }
  }

  async function del(row: { _id: string }) {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await appointmentSchedulesDelete({ _id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function toggle(row: { _id: string; active?: boolean }) {
    await appointmentSchedulesToggle({ _id: row._id, active: !(row.active !== false) })
    ElMessage.success('已更新')
    refreshData()
  }
</script>
