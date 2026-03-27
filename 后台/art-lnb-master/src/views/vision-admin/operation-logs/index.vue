<template>
  <div class="vision-logs-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSelect v-model="filterAction" placeholder="操作类型" clearable style="width:120px;margin-right:8px" @change="handleFilter">
            <ElOption label="新增" value="create" />
            <ElOption label="修改" value="update" />
            <ElOption label="删除" value="delete" />
            <ElOption label="导出" value="export" />
          </ElSelect>
          <ElSelect v-model="filterResource" placeholder="资源类型" clearable style="width:140px" @change="handleFilter">
            <ElOption label="管理员" value="admin" />
            <ElOption label="用户" value="user" />
            <ElOption label="孩子" value="child" />
            <ElOption label="检测记录" value="checkup_record" />
            <ElOption label="轮播图" value="banner" />
            <ElOption label="学校班级" value="school_class" />
            <ElOption label="预约项目" value="appointment_item" />
            <ElOption label="系统配置" value="system_config" />
          </ElSelect>
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
  import { h, ref } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import { operationLogsList } from '@/api/vision-admin'
  import { ElCard, ElTag, ElSelect, ElOption } from 'element-plus'

  defineOptions({ name: 'VisionAdminOperationLogs' })

  interface LogRow {
    id: number
    admin_id: number
    admin_phone: string
    admin_name: string
    action: string
    resource: string
    resource_id?: string
    detail?: Record<string, any>
    ip: string
    created_at: string
  }

  const actionLabelMap: Record<string, string> = {
    create: '新增',
    update: '修改',
    delete: '删除',
    export: '导出'
  }
  const actionTagMap: Record<string, string> = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    export: 'primary'
  }
  const resourceLabelMap: Record<string, string> = {
    admin: '管理员',
    admin_role: '管理员角色',
    user: '用户',
    child: '孩子',
    checkup_record: '检测记录',
    banner: '轮播图',
    school_class: '学校班级',
    appointment_item: '预约项目',
    appointment_schedule: '预约排班',
    appointment_record: '预约记录',
    system_config: '系统配置',
    questionnaire: '问卷'
  }

  const filterAction = ref<string>('')
  const filterResource = ref<string>('')

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    searchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: operationLogsList as (params: Record<string, unknown>) => Promise<{
        list?: LogRow[]
        page?: number
        page_size?: number
        total?: number
      }>,
      apiParams: { current: 1, size: 20 },
      paginationKey: { current: 'current', size: 'size' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'admin_name', label: '操作人', width: 120 },
        { prop: 'admin_phone', label: '手机号', width: 130 },
        {
          prop: 'action',
          label: '操作类型',
          width: 100,
          formatter: (row: LogRow) =>
            h(
              ElTag,
              { type: (actionTagMap[row.action] || 'info') as any, size: 'small' },
              () => actionLabelMap[row.action] || row.action
            )
        },
        {
          prop: 'resource',
          label: '资源类型',
          width: 120,
          formatter: (row: LogRow) => resourceLabelMap[row.resource] || row.resource
        },
        { prop: 'resource_id', label: '资源ID', width: 80 },
        {
          prop: 'detail',
          label: '操作详情',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row: LogRow) => {
            try {
              return row.detail ? JSON.stringify(row.detail) : '—'
            } catch {
              return '—'
            }
          }
        },
        { prop: 'ip', label: 'IP', width: 130 },
        { prop: 'created_at', label: '操作时间', width: 170 }
      ]
    }
  })

  function handleFilter() {
    const params: Record<string, any> = {}
    if (filterAction.value) params.action = filterAction.value
    if (filterResource.value) params.resource = filterResource.value
    Object.assign(searchParams, params)
    getData()
  }
</script>
