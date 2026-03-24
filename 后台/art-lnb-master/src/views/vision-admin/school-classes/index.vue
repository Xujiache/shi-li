<template>
  <div class="vision-school-classes art-full-height">
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
            filename="学校班级字典"
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
      <ElForm ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <ElFormItem label="学校" prop="school"><ElInput v-model="form.school" placeholder="1-50字" /></ElFormItem>
        <ElFormItem label="班级" prop="class_name"><ElInput v-model="form.class_name" placeholder="1-50字" /></ElFormItem>
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
  import { h } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    schoolClassesList,
    schoolClassesCreate,
    schoolClassesUpdate,
    schoolClassesDelete,
    schoolClassesToggle
  } from '@/api/vision-admin'
  import { ElMessageBox, ElMessage, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminSchoolClasses' })

  const searchForm = ref({ q: undefined, active: undefined })
  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '学校/班级' } },
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
  const form = reactive({ school: '', class_name: '', active: true })
  const formRules: FormRules = {
    school: [{ required: true, message: '请输入学校', trigger: 'blur' }, { max: 50, message: '1-50字', trigger: 'blur' }],
    class_name: [{ required: true, message: '请输入班级', trigger: 'blur' }, { max: 50, message: '1-50字', trigger: 'blur' }]
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
      apiFn: schoolClassesList as (p: Record<string, unknown>) => Promise<{ list?: unknown[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'school', label: '学校' },
        { prop: 'class_name', label: '班级' },
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
          formatter: (row: { _id: string; school?: string; class_name?: string; active?: boolean }) =>
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
    school: '学校',
    class_name: '班级',
    active: '启用状态',
    created_at: '创建时间',
    updated_at: '更新时间'
  }

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  function openDialog(type: 'add' | 'edit', row?: { _id: string; school?: string; class_name?: string; active?: boolean }) {
    editId.value = type === 'edit' && row ? row._id : null
    form.school = row?.school ?? ''
    form.class_name = row?.class_name ?? ''
    form.active = row?.active !== false
    dialogVisible.value = true
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await schoolClassesUpdate({ _id: editId.value, patch: { school: form.school, class_name: form.class_name, active: form.active } })
        ElMessage.success('已保存')
      } else {
        await schoolClassesCreate({ school: form.school, class_name: form.class_name, active: form.active })
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
    await schoolClassesDelete({ _id: row._id })
    ElMessage.success('已删除')
    refreshData()
  }

  async function toggle(row: { _id: string; active?: boolean }) {
    await schoolClassesToggle({ _id: row._id, active: !(row.active !== false) })
    ElMessage.success('已更新')
    refreshData()
  }
</script>
