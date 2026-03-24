<template>
  <div class="vision-users-page art-full-height">
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="showDialog('add')" v-ripple>新增用户</ElButton>
          <ArtExcelExport
            :data="exportData"
            filename="用户列表"
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

      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, watch } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { usersList, usersDelete, usersToggle, usersSetAdmin } from '@/api/vision-admin'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage, ElButton, ElImage } from 'element-plus'
  import { DialogType } from '@/types'
  import { getTempFileURLs, isCloudFileId } from '@/utils/cloudbase-storage'

  defineOptions({ name: 'VisionAdminUsers' })

  interface UserRow {
    _id: string
    user_no?: string
    phone?: string
    display_name?: string
    avatar_file_id?: string
    is_admin?: boolean
    active?: boolean
    created_at?: string
    updated_at?: string
  }

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserRow>>({})

  const searchForm = ref<Record<string, unknown>>({
    q: undefined,
    is_admin: undefined,
    active: undefined
  })

  const avatarUrlMap = reactive<Record<string, string>>({})

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
      apiFn: usersList as (params: Record<string, unknown>) => Promise<{
        list?: UserRow[]
        page?: number
        page_size?: number
        total?: number
      }>,
      apiParams: {
        current: 1,
        size: 20,
        ...searchForm.value
      },
      paginationKey: { current: 'current', size: 'size' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'avatar_file_id',
          label: '头像',
          width: 90,
          formatter: (row: UserRow) => {
            const raw = row.avatar_file_id || ''
            const src = isCloudFileId(raw) ? (avatarUrlMap[raw] || '') : raw
            if (!src) {
              return h('div', {
                style: 'width:46px;height:46px;border-radius:12px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.35);font-size:12px'
              }, '—')
            }
            return h(
              ElImage,
              {
                src,
                fit: 'cover',
                style:
                  'width:46px;height:46px;border-radius:12px;overflow:hidden;background:rgba(0,0,0,0.04)'
              },
              {}
            )
          }
        },
        { prop: '_id', label: '用户ID', width: 260, showOverflowTooltip: true },
        { prop: 'user_no', label: '用户编号', width: 110 },
        { prop: 'phone', label: '手机号', width: 120 },
        { prop: 'display_name', label: '昵称', width: 120 },
        {
          prop: 'is_admin',
          label: '管理员',
          width: 80,
          formatter: (row: UserRow) =>
            h(ElTag, { type: row.is_admin ? 'success' : 'info', size: 'small' }, () =>
              row.is_admin ? '是' : '否'
            )
        },
        {
          prop: 'active',
          label: '启用',
          width: 80,
          formatter: (row: UserRow) =>
            h(ElTag, { type: row.active !== false ? 'success' : 'danger', size: 'small' }, () =>
              row.active !== false ? '启用' : '禁用'
            )
        },
        { prop: 'created_at', label: '创建时间', width: 170 },
        { prop: 'updated_at', label: '更新时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 220,
          fixed: 'right',
          formatter: (row: UserRow) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              }),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => handleDelete(row)
              }),
              h(
                ElButton,
                {
                  link: true,
                  type: 'primary',
                  size: 'small',
                  onClick: () => handleToggleActive(row)
                },
                () => (row.active !== false ? '禁用' : '启用')
              ),
              h(
                ElButton,
                {
                  link: true,
                  type: 'primary',
                  size: 'small',
                  onClick: () => handleSetAdmin(row)
                },
                () => (row.is_admin ? '取消管理员' : '设管理员')
              )
            ])
        }
      ]
    }
  })

  watch(
    () => (Array.isArray(data.value) ? data.value.map((r: any) => r?.avatar_file_id).filter(Boolean) : []),
    async (urls) => {
      const ids = (urls || []).filter(isCloudFileId)
      if (ids.length === 0) return
      const map = await getTempFileURLs(ids)
      Object.assign(avatarUrlMap, map)
      // 强制表格重新渲染以显示已加载的头像
      if (data.value && Object.keys(map).length > 0) {
        data.value = [...data.value]
      }
    },
    { immediate: true }
  )

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: '用户ID',
    user_no: '用户编号',
    phone: '手机号',
    display_name: '昵称',
    is_admin: '管理员',
    active: '启用状态',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  const handleSearch = (params: Record<string, unknown>) => {
    Object.assign(searchParams, params)
    getData()
  }

  function showDialog(type: DialogType, row?: UserRow) {
    dialogType.value = type
    currentUserData.value = row ? { ...row } : {}
    nextTick(() => (dialogVisible.value = true))
  }

  async function handleDelete(row: UserRow) {
    await ElMessageBox.confirm('确定要删除该用户吗？', '删除用户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await usersDelete({ user_id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function handleToggleActive(row: UserRow) {
    await usersToggle({ user_id: row._id, active: !(row.active !== false) })
    ElMessage.success('已更新')
    refreshData()
  }

  async function handleSetAdmin(row: UserRow) {
    await usersSetAdmin({ user_id: row._id, is_admin: !row.is_admin })
    ElMessage.success('已更新')
    refreshData()
  }

  function handleDialogSubmit() {
    dialogVisible.value = false
    currentUserData.value = {}
    refreshData()
  }
</script>
