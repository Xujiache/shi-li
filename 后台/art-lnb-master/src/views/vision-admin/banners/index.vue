<template>
  <div class="vision-banners art-full-height">
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
            filename="轮播图列表"
            :headers="exportHeaders"
            button-text="导出"
            type="default"
          />
        </template>
      </ArtTableHeader>
      <ArtTable
        :loading="loading"
        :data="tableData"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
    <ElDialog v-model="dialogVisible" :title="editId ? '编辑' : '新增'" width="440px">
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <ElFormItem label="轮播图" prop="image_url">
          <CloudImageField v-model="form.image_url" prefix="vision-admin/banners" />
        </ElFormItem>
        <ElFormItem label="主标题" prop="title">
          <ElInput v-model="form.title" placeholder="选填（最多30字）" maxlength="30" show-word-limit />
        </ElFormItem>
        <ElFormItem label="副标题" prop="sub_title">
          <ElInput v-model="form.sub_title" placeholder="选填（最多60字）" maxlength="60" show-word-limit />
        </ElFormItem>
        <ElFormItem label="排序" prop="order"><ElInputNumber v-model="form.order" :min="1" /></ElFormItem>
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
  import { h, watch, computed, reactive, ref } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import CloudImageField from '@/components/business/cloudbase/cloud-image-field.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    bannersList,
    bannersCreate,
    bannersUpdate,
    bannersDelete,
    bannersToggle
  } from '@/api/vision-admin'
  import { ElMessageBox, ElMessage, ElTag, ElImage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { getTempFileURLs, isCloudFileId } from '@/utils/cloudbase-storage'

  defineOptions({ name: 'VisionAdminBanners' })

  const tempUrlMap = reactive<Record<string, string>>({})

  const searchForm = ref({ active: undefined })
  const searchItems = [
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
  const form = reactive({ image_url: '', title: '', sub_title: '', order: 1, active: true })
  const formRules: FormRules = {
    image_url: [{ required: true, message: '请上传轮播图', trigger: 'change' }],
    title: [{ max: 30, message: '最多30字', trigger: 'blur' }],
    sub_title: [{ max: 60, message: '最多60字', trigger: 'blur' }],
    order: [{ required: true, message: '请输入排序', trigger: 'blur' }]
  }

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
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
      apiFn: bannersList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: '_preview_url',
          label: '轮播图',
          width: 160,
          formatter: (row: { _preview_url?: string }) => {
            const src = row._preview_url || ''
            if (!src) {
              return h('div', {
                style: 'width:120px;height:68px;border-radius:10px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.35);font-size:12px'
              }, '加载中...')
            }
            return h(
              ElImage,
              {
                src,
                fit: 'cover',
                previewSrcList: [src],
                style: 'width:120px;height:68px;border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.04)'
              },
              {}
            )
          }
        },
        { prop: 'title', label: '主标题', minWidth: 160, showOverflowTooltip: true },
        { prop: 'sub_title', label: '副标题', minWidth: 220, showOverflowTooltip: true },
        { prop: 'order', label: '排序', width: 80 },
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

  // 将 cloud:// fileID 异步解析为临时 URL，填入 tempUrlMap
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

  // 计算属性：将原始 data 与 tempUrlMap 合并，生成带 _preview_url 的表格数据
  // tempUrlMap 是 reactive，所以当它更新后 tableData 会自动重新计算，表格自动刷新
  const tableData = computed(() => {
    if (!Array.isArray(data.value)) return []
    return data.value.map((row: any) => {
      const raw = row?.image_url || ''
      let previewUrl = ''
      if (isCloudFileId(raw)) {
        previewUrl = tempUrlMap[raw] || ''
      } else {
        previewUrl = raw
      }
      return { ...row, _preview_url: previewUrl }
    })
  })

  // 导出 Excel 配置
  const exportData = computed(() => (Array.isArray(data.value) ? data.value : []))
  const exportHeaders: Record<string, string> = {
    _id: 'ID',
    title: '主标题',
    sub_title: '副标题',
    image_url: '图片地址',
    order: '排序',
    active: '启用状态',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  function openDialog(type: 'add' | 'edit', row?: { _id: string; image_url?: string; title?: string; sub_title?: string; order?: number; active?: boolean }) {
    editId.value = type === 'edit' && row ? row._id : null
    form.image_url = row?.image_url ?? ''
    form.title = row?.title ?? ''
    form.sub_title = row?.sub_title ?? ''
    form.order = row?.order ?? 1
    form.active = row?.active !== false
    dialogVisible.value = true
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await bannersUpdate({
          _id: editId.value,
          patch: {
            image_url: form.image_url,
            title: form.title,
            sub_title: form.sub_title,
            order: form.order,
            active: form.active
          }
        })
        ElMessage.success('已保存')
      } else {
        await bannersCreate({
          image_url: form.image_url,
          title: form.title,
          sub_title: form.sub_title,
          order: form.order,
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
    await bannersDelete({ _id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function toggle(row: { _id: string; active?: boolean }) {
    await bannersToggle({ _id: row._id, active: !(row.active !== false) })
    ElMessage.success('已更新')
    refreshData()
  }
</script>
