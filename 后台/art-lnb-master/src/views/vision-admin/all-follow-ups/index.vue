<template>
  <div class="all-follow-ups art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="handleReset"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="success" :loading="exportLoading" @click="handleExport" v-ripple>
            导出 CSV
          </ElButton>
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
  </div>
</template>

<script setup lang="ts">
  import { h, ref, onMounted } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    adminListAllFollowUps,
    adminExportAllFollowUps,
    employeesList,
    departmentsList,
    type AdminFollowUpRow,
    type EmployeeRow,
    type DepartmentRow
  } from '@/api/vision-admin'
  import { ElCard, ElTag, ElButton, ElMessage } from 'element-plus'

  defineOptions({ name: 'VisionAdminAllFollowUps' })

  const exportLoading = ref(false)
  const employeeOptions = ref<EmployeeRow[]>([])
  const departmentOptions = ref<DepartmentRow[]>([])

  async function loadOptions() {
    try {
      const [eRes, dRes]: [any, any] = await Promise.all([
        employeesList({ page: 1, page_size: 500, active: true }),
        departmentsList({ page: 1, page_size: 200, active: true })
      ])
      employeeOptions.value = (eRes?.list || eRes?.data?.list || []) as EmployeeRow[]
      departmentOptions.value = (dRes?.list || dRes?.data?.list || []) as DepartmentRow[]
    } catch (_) {
      employeeOptions.value = []
      departmentOptions.value = []
    }
  }

  const searchForm = ref({
    q: undefined as string | undefined,
    employee_id: undefined as number | undefined,
    department_id: undefined as number | undefined,
    type: undefined as string | undefined,
    result: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined
  })

  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '客户名/手机/跟进内容' } },
    {
      label: '员工',
      key: 'employee_id',
      type: 'select',
      props: {
        filterable: true,
        options: () => [
          { label: '全部', value: undefined },
          ...employeeOptions.value.map((e) => ({ label: `${e.display_name}(${e.phone})`, value: e.id }))
        ]
      }
    },
    {
      label: '部门',
      key: 'department_id',
      type: 'select',
      props: {
        options: () => [
          { label: '全部', value: undefined },
          ...departmentOptions.value.map((d) => ({ label: d.name, value: d.id }))
        ]
      }
    },
    {
      label: '类型',
      key: 'type',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '电话', value: 'phone' },
          { label: '微信', value: 'wechat' },
          { label: '当面', value: 'face' },
          { label: '其他', value: 'other' }
        ]
      }
    },
    {
      label: '结果',
      key: 'result',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '无进展', value: 'no_progress' },
          { label: '有意向', value: 'interested' },
          { label: '需复跟', value: 'follow_up' },
          { label: '已成交', value: 'signed' },
          { label: '已流失', value: 'lost' }
        ]
      }
    },
    { label: '开始日期', key: 'start_date', type: 'date' },
    { label: '结束日期', key: 'end_date', type: 'date' }
  ]

  const TYPE_ZH: Record<string, string> = { phone: '电话', wechat: '微信', face: '当面', other: '其他' }
  const RESULT_ZH: Record<string, string> = {
    no_progress: '无进展', interested: '有意向', follow_up: '需复跟',
    signed: '已成交', lost: '已流失'
  }
  const RESULT_TAG: Record<string, string> = {
    no_progress: 'info', interested: 'warning', follow_up: '',
    signed: 'success', lost: 'danger'
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
      apiFn: adminListAllFollowUps as (p: Record<string, unknown>) => Promise<{ list?: AdminFollowUpRow[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'customer_name', label: '客户', width: 120 },
        { prop: 'customer_phone', label: '客户手机', width: 130 },
        { prop: 'employee_name', label: '跟进员工', width: 120 },
        { prop: 'department_name', label: '部门', width: 120 },
        {
          prop: 'type', label: '类型', width: 80,
          formatter: (row: AdminFollowUpRow) => TYPE_ZH[row.type] || row.type
        },
        {
          prop: 'result', label: '结果', width: 90,
          formatter: (row: AdminFollowUpRow) =>
            h(ElTag, { type: (RESULT_TAG[row.result] || 'info') as any, size: 'small' }, () =>
              RESULT_ZH[row.result] || row.result
            )
        },
        {
          prop: 'content', label: '内容', minWidth: 280, showOverflowTooltip: true,
          formatter: (row: AdminFollowUpRow) => String(row.content || '').slice(0, 200)
        },
        { prop: 'follow_at', label: '跟进时间', width: 170 },
        {
          prop: 'next_follow_up_at', label: '下次跟进', width: 170,
          formatter: (row: AdminFollowUpRow) => row.next_follow_up_at || '-'
        },
        { prop: 'created_at', label: '创建时间', width: 170 }
      ]
    }
  })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }
  function handleReset() {
    resetSearchParams()
    Object.keys(searchForm.value).forEach((k) => { (searchForm.value as any)[k] = undefined })
  }

  async function handleExport() {
    exportLoading.value = true
    try {
      await adminExportAllFollowUps({ ...searchForm.value })
      ElMessage.success('已导出')
    } catch (e: any) {
      ElMessage.error(e?.message || '导出失败')
    } finally {
      exportLoading.value = false
    }
  }

  onMounted(() => loadOptions())
</script>
