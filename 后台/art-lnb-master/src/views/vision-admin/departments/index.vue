<template>
  <div class="vision-departments-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="handleReset"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增部门</ElButton>
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

      <ElDialog
        v-model="dialogVisible"
        :title="editId ? '编辑部门' : '新增部门'"
        width="460px"
        destroy-on-close
      >
        <ElForm ref="formRef" :model="form" :rules="formRules" label-width="100px">
          <ElFormItem label="部门名称" prop="name">
            <ElInput v-model="form.name" placeholder="请输入部门名称" />
          </ElFormItem>
          <ElFormItem label="上级部门" prop="parent_id">
            <ElSelect v-model="form.parent_id" placeholder="无（顶级部门）" clearable style="width:100%">
              <ElOption
                v-for="d in departmentOptions"
                :key="d.id"
                :label="d.name"
                :value="d.id"
                :disabled="editId !== null && d.id === editId"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="负责人" prop="manager_id">
            <ElSelect v-model="form.manager_id" placeholder="可选" clearable style="width:100%">
              <ElOption
                v-for="m in managerOptions"
                :key="m.id"
                :label="`${m.display_name} (${m.phone})`"
                :value="m.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="排序" prop="sort_order">
            <ElInputNumber v-model="form.sort_order" :min="0" :step="1" />
          </ElFormItem>
          <ElFormItem v-if="editId" label="启用" prop="active">
            <ElSwitch v-model="form.active" />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, reactive, onMounted } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    departmentsList,
    departmentsCreate,
    departmentsUpdate,
    departmentsDelete,
    employeesList,
    type DepartmentRow,
    type EmployeeRow
  } from '@/api/vision-admin'
  import {
    ElCard,
    ElTag,
    ElMessageBox,
    ElMessage,
    ElButton,
    ElDialog,
    ElForm,
    ElFormItem,
    ElInput,
    ElInputNumber,
    ElSelect,
    ElOption,
    ElSwitch
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminDepartments' })

  const searchForm = ref({
    q: undefined as string | undefined,
    active: undefined as boolean | undefined
  })

  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '部门名称' } },
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
  const editId = ref<number | null>(null)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const form = reactive<{
    name: string
    parent_id: number | null
    manager_id: number | null
    sort_order: number
    active: boolean
  }>({
    name: '',
    parent_id: null,
    manager_id: null,
    sort_order: 0,
    active: true
  })

  const formRules: FormRules = {
    name: [
      { required: true, message: '请输入部门名称', trigger: 'blur' },
      { max: 50, message: '1-50字', trigger: 'blur' }
    ]
  }

  const departmentOptions = ref<DepartmentRow[]>([])
  const managerOptions = ref<EmployeeRow[]>([])

  async function loadDepartments() {
    try {
      const res: any = await departmentsList({ page: 1, page_size: 200 })
      departmentOptions.value = (res?.list ?? res?.data?.list ?? []) as DepartmentRow[]
    } catch (_) {
      departmentOptions.value = []
    }
  }

  async function loadManagers() {
    try {
      const res: any = await employeesList({ role: 'manager', page: 1, page_size: 200 })
      managerOptions.value = (res?.list ?? res?.data?.list ?? []) as EmployeeRow[]
    } catch (_) {
      managerOptions.value = []
    }
  }

  function findDepartmentName(id: number | null | undefined): string {
    if (id == null) return '-'
    const d = departmentOptions.value.find((x) => x.id === id)
    return d ? d.name : `#${id}`
  }

  function findManagerName(id: number | null | undefined): string {
    if (id == null) return '-'
    const m = managerOptions.value.find((x) => x.id === id)
    return m ? m.display_name : `#${id}`
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
      apiFn: departmentsList as (p: Record<string, unknown>) => Promise<{ list?: DepartmentRow[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'name', label: '部门名称' },
        {
          prop: 'parent_id',
          label: '上级部门',
          width: 160,
          formatter: (row: DepartmentRow) => findDepartmentName(row.parent_id)
        },
        {
          prop: 'manager_id',
          label: '负责人',
          width: 140,
          formatter: (row: DepartmentRow) => findManagerName(row.manager_id)
        },
        { prop: 'sort_order', label: '排序', width: 80 },
        {
          prop: 'active',
          label: '状态',
          width: 80,
          formatter: (row: DepartmentRow) =>
            h(ElTag, { type: row.active ? 'success' : 'info', size: 'small' }, () =>
              row.active ? '启用' : '停用'
            )
        },
        { prop: 'created_at', label: '创建时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: DepartmentRow) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(ArtButtonTable, { type: 'delete', onClick: () => del(row) })
            ])
        }
      ]
    }
  })

  function handleSearch() {
    Object.assign(searchParams, searchForm.value)
    getData()
  }

  function handleReset() {
    resetSearchParams()
    searchForm.value = { q: undefined, active: undefined }
  }

  function openDialog(type: 'add' | 'edit', row?: DepartmentRow) {
    if (type === 'edit' && row) {
      editId.value = row.id
      form.name = row.name
      form.parent_id = row.parent_id
      form.manager_id = row.manager_id
      form.sort_order = row.sort_order ?? 0
      form.active = row.active
    } else {
      editId.value = null
      form.name = ''
      form.parent_id = null
      form.manager_id = null
      form.sort_order = 0
      form.active = true
    }
    dialogVisible.value = true
  }

  async function submit() {
    await formRef.value?.validate()
    submitting.value = true
    try {
      if (editId.value) {
        await departmentsUpdate({
          id: editId.value,
          patch: {
            name: form.name,
            parent_id: form.parent_id,
            manager_id: form.manager_id,
            sort_order: form.sort_order,
            active: form.active
          }
        })
        ElMessage.success('已保存')
      } else {
        await departmentsCreate({
          name: form.name,
          parent_id: form.parent_id,
          manager_id: form.manager_id,
          sort_order: form.sort_order
        })
        ElMessage.success('已新增')
      }
      dialogVisible.value = false
      refreshData()
      loadDepartments()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    } finally {
      submitting.value = false
    }
  }

  async function del(row: DepartmentRow) {
    await ElMessageBox.confirm(`确定删除部门「${row.name}」？`, '删除部门', { type: 'warning' })
    try {
      await departmentsDelete({ id: row.id })
      ElMessage.success('已删除')
      refreshData()
      loadDepartments()
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败')
    }
  }

  onMounted(() => {
    loadDepartments()
    loadManagers()
  })
</script>
