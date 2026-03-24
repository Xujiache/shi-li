<template>
  <div class="vision-appointment-items art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="resetSearchParams"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增</ElButton>
          <ArtExcelExport
            :data="exportData"
            filename="预约项目"
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
    <ElDialog v-model="dialogVisible" :title="editId ? '编辑' : '新增'" width="400px">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <ElFormItem label="项目名称" prop="name"><ElInput v-model="form.name" placeholder="1-50字" /></ElFormItem>
        <ElFormItem label="项目图片" prop="image_url">
          <CloudImageField v-model="form.image_url" prefix="vision-admin/appointment-items" />
          <div class="mt-1 text-xs text-g-600">不填则小程序使用默认占位图</div>
        </ElFormItem>
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
  import { h, watch } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import CloudImageField from '@/components/business/cloudbase/cloud-image-field.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    appointmentItemsList,
    appointmentItemsCreate,
    appointmentItemsUpdate,
    appointmentItemsDelete,
    appointmentItemsToggle
  } from '@/api/vision-admin'
  import { ElMessageBox, ElMessage, ElTag, ElImage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { getTempFileURLs, isCloudFileId } from '@/utils/cloudbase-storage'

  defineOptions({ name: 'VisionAdminAppointmentItems' })

  const tempUrlMap = reactive<Record<string, string>>({})

  const searchForm = ref({ q: undefined, active: undefined })
  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '项目名称' } },
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
  const form = reactive({ name: '', image_url: '', active: true })
  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  const formRules: FormRules = {
    name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }, { max: 50, message: '1-50字', trigger: 'blur' }]
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
      apiFn: appointmentItemsList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'name', label: '项目名称' },
        {
          prop: 'image_url',
          label: '图片',
          width: 140,
          formatter: (row: { image_url?: string }) => {
            const raw = row.image_url || ''
            const src = isCloudFileId(raw) ? (tempUrlMap[raw] || '') : raw
            if (!src) {
              return h('div', {
                style: 'width:120px;height:68px;border-radius:10px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.35);font-size:12px'
              }, '暂无图片')
            }
            return h(
              ElImage,
              {
                src,
                fit: 'cover',
                style: 'width:120px;height:68px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.04)'
              },
              {}
            )
          }
        },
        {
          prop: 'active',
          label: '启用',
          width: 80,
          formatter: (row: { active?: boolean }) => h(ElTag, { type: row.active !== false ? 'success' : 'info', size: 'small' }, () => (row.active !== false ? '是' : '否'))
        },
        { prop: 'created_at', label: '创建时间', width: 170 },
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

  watch(
    () => (Array.isArray(data.value) ? data.value.map((r: any) => r?.image_url).filter(Boolean) : []),
    async (urls) => {
      const ids = (urls || []).filter(isCloudFileId)
      if (ids.length === 0) return
      const map = await getTempFileURLs(ids)
      Object.assign(tempUrlMap, map)
    },
    { immediate: true }
  )

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: 'ID',
    name: '项目名称',
    image_url: '图片地址',
    active: '启用状态',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  function openDialog(type: 'add' | 'edit', row?: { _id: string; name?: string; image_url?: string; active?: boolean }) {
    editId.value = type === 'edit' && row ? row._id : null
    form.name = row?.name ?? ''
    form.image_url = row?.image_url ?? ''
    form.active = row?.active !== false
    dialogVisible.value = true
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await appointmentItemsUpdate({ _id: editId.value, patch: { name: form.name, image_url: form.image_url, active: form.active } })
        ElMessage.success('已保存')
      } else {
        await appointmentItemsCreate({ name: form.name, image_url: form.image_url || undefined, active: form.active })
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
    await appointmentItemsDelete({ _id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function toggle(row: { _id: string; active?: boolean }) {
    await appointmentItemsToggle({ _id: row._id, active: !(row.active !== false) })
    ElMessage.success('已更新')
    refreshData()
  }
</script>
