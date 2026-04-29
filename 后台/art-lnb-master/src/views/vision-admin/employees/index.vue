<template>
  <div class="vision-employees-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      @reset="handleReset"
      @search="handleSearch"
    />
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="openDialog('add')" v-ripple>新增员工</ElButton>
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

      <!-- 新增/编辑 Drawer -->
      <ElDrawer
        v-model="drawerVisible"
        :title="dialogType === 'add' ? '新增员工' : '编辑员工'"
        size="480px"
        destroy-on-close
      >
        <ElForm ref="formRef" :model="formData" :rules="formRules" label-width="90px">
          <ElFormItem label="手机号" prop="phone">
            <ElInput
              v-model="formData.phone"
              placeholder="请输入手机号"
              :disabled="dialogType === 'edit'"
            />
          </ElFormItem>
          <ElFormItem label="姓名" prop="display_name">
            <ElInput v-model="formData.display_name" placeholder="请输入姓名" />
          </ElFormItem>
          <ElFormItem label="角色" prop="role">
            <ElRadioGroup v-model="formData.role">
              <ElRadioButton value="staff">员工</ElRadioButton>
              <ElRadioButton value="manager">主管</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem label="部门" prop="department_id">
            <ElSelect
              v-model="formData.department_id"
              placeholder="请选择部门"
              clearable
              style="width: 100%"
            >
              <ElOption
                v-for="d in departmentOptions"
                :key="d.id"
                :label="d.name"
                :value="d.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="职位" prop="position">
            <ElInput v-model="formData.position" placeholder="请输入职位" />
          </ElFormItem>
          <ElFormItem v-if="dialogType === 'add'" label="密码" prop="password">
            <ElInput
              v-model="formData.password"
              type="password"
              show-password
              placeholder="留空则使用默认密码 Init@2025"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="drawerVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">确定</ElButton>
        </template>
      </ElDrawer>

      <!-- 重置密码 Dialog -->
      <ElDialog v-model="resetVisible" title="重置密码" width="420px" destroy-on-close>
        <ElForm label-width="100px">
          <ElFormItem label="新密码">
            <ElInput
              v-model="resetPwd"
              type="password"
              show-password
              placeholder="留空则重置为 Init@2025"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="resetVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="resetLoading" @click="confirmReset">确定</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, reactive, onMounted, nextTick } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    employeesList,
    employeesCreate,
    employeesUpdate,
    employeesDelete,
    employeesSetStatus,
    employeesResetPassword,
    departmentsList,
    type EmployeeRow,
    type DepartmentRow
  } from '@/api/vision-admin'
  import {
    ElCard,
    ElTag,
    ElMessageBox,
    ElMessage,
    ElButton,
    ElDialog,
    ElDrawer,
    ElForm,
    ElFormItem,
    ElInput,
    ElSelect,
    ElOption,
    ElRadioGroup,
    ElRadioButton
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminEmployees' })

  const dialogType = ref<'add' | 'edit'>('add')
  const drawerVisible = ref(false)
  const submitLoading = ref(false)
  const formRef = ref<FormInstance>()
  const formData = reactive<{
    id?: number | string
    phone: string
    display_name: string
    password: string
    role: 'staff' | 'manager'
    department_id: number | null
    position: string
  }>({
    phone: '',
    display_name: '',
    password: '',
    role: 'staff',
    department_id: null,
    position: ''
  })

  const formRules: FormRules = {
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
    ],
    display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }],
    position: [{ required: true, message: '请输入职位', trigger: 'blur' }]
  }

  const departmentOptions = ref<DepartmentRow[]>([])

  async function loadDepartments() {
    try {
      const res: any = await departmentsList({ page: 1, page_size: 200 })
      departmentOptions.value = (res?.list ?? res?.data?.list ?? []) as DepartmentRow[]
    } catch (_) {
      departmentOptions.value = []
    }
  }

  const searchForm = ref({
    q: undefined as string | undefined,
    role: undefined as string | undefined,
    department_id: undefined as number | undefined,
    active: undefined as boolean | undefined
  })

  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '手机号/姓名' } },
    {
      label: '角色',
      key: 'role',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '员工', value: 'staff' },
          { label: '主管', value: 'manager' }
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

  const roleTagMap: Record<string, string> = {
    staff: 'info',
    manager: 'warning'
  }
  const roleLabelMap: Record<string, string> = {
    staff: '员工',
    manager: '主管'
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
      apiFn: employeesList as (p: Record<string, unknown>) => Promise<{ list?: EmployeeRow[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'phone', label: '手机号', width: 130 },
        { prop: 'display_name', label: '姓名', width: 120 },
        {
          prop: 'role',
          label: '角色',
          width: 90,
          formatter: (row: EmployeeRow) =>
            h(
              ElTag,
              { type: (roleTagMap[row.role] || 'info') as any, size: 'small' },
              () => roleLabelMap[row.role] || row.role
            )
        },
        {
          prop: 'department_name',
          label: '部门',
          width: 140,
          formatter: (row: EmployeeRow) => row.department_name || '-'
        },
        { prop: 'position', label: '职位', width: 140 },
        {
          prop: 'active',
          label: '状态',
          width: 80,
          formatter: (row: EmployeeRow) =>
            h(ElTag, { type: row.active ? 'success' : 'danger', size: 'small' }, () =>
              row.active ? '启用' : '停用'
            )
        },
        { prop: 'last_login_at', label: '最近登录', width: 170 },
        { prop: 'created_at', label: '创建时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 260,
          fixed: 'right',
          formatter: (row: EmployeeRow) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openDialog('edit', row) }),
              h(
                'span',
                {
                  class: 'el-link el-link--primary',
                  style: 'margin-left:8px;cursor:pointer',
                  onClick: () => openReset(row)
                },
                () => '重置密码'
              ),
              h(
                'span',
                {
                  class: 'el-link el-link--warning',
                  style: 'margin-left:8px;cursor:pointer',
                  onClick: () => toggleActive(row)
                },
                () => (row.active ? '停用' : '启用')
              ),
              h(ArtButtonTable, { type: 'delete', onClick: () => handleDelete(row) })
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
    searchForm.value = { q: undefined, role: undefined, department_id: undefined, active: undefined }
  }

  function openDialog(type: 'add' | 'edit', row?: EmployeeRow) {
    dialogType.value = type
    if (type === 'edit' && row) {
      formData.id = row.id
      formData.phone = row.phone
      formData.display_name = row.display_name
      formData.password = ''
      formData.role = row.role
      formData.department_id = row.department_id
      formData.position = row.position
    } else {
      formData.id = undefined
      formData.phone = ''
      formData.display_name = ''
      formData.password = ''
      formData.role = 'staff'
      formData.department_id = null
      formData.position = ''
    }
    nextTick(() => (drawerVisible.value = true))
  }

  async function handleSubmit() {
    if (formRef.value) {
      try {
        await formRef.value.validate()
      } catch {
        return
      }
    }
    submitLoading.value = true
    try {
      if (dialogType.value === 'add') {
        const res: any = await employeesCreate({
          phone: formData.phone,
          password: formData.password || undefined,
          display_name: formData.display_name,
          role: formData.role,
          department_id: formData.department_id,
          position: formData.position
        })
        const dp = res?.default_password ?? res?.data?.default_password
        if (dp) {
          ElMessageBox.alert(`默认初始密码：${dp}`, '创建成功', { confirmButtonText: '我知道了' })
        } else {
          ElMessage.success('创建成功')
        }
      } else if (formData.id != null) {
        await employeesUpdate({
          id: formData.id,
          patch: {
            display_name: formData.display_name,
            role: formData.role,
            department_id: formData.department_id,
            position: formData.position
          }
        })
        ElMessage.success('更新成功')
      }
      drawerVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    } finally {
      submitLoading.value = false
    }
  }

  async function handleDelete(row: EmployeeRow) {
    await ElMessageBox.confirm(`确定要删除员工「${row.display_name}」吗？`, '删除员工', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    try {
      await employeesDelete({ id: row.id })
      ElMessage.success('已删除')
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败')
    }
  }

  async function toggleActive(row: EmployeeRow) {
    try {
      await employeesSetStatus({ id: row.id, active: !row.active })
      ElMessage.success('已更新')
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    }
  }

  // 重置密码
  const resetVisible = ref(false)
  const resetLoading = ref(false)
  const resetPwd = ref('')
  const resetTarget = ref<EmployeeRow | null>(null)

  function openReset(row: EmployeeRow) {
    resetTarget.value = row
    resetPwd.value = ''
    resetVisible.value = true
  }

  async function confirmReset() {
    if (!resetTarget.value) return
    resetLoading.value = true
    try {
      const res: any = await employeesResetPassword({
        id: resetTarget.value.id,
        password: resetPwd.value || undefined
      })
      const dp = res?.default_password ?? res?.data?.default_password
      resetVisible.value = false
      if (dp) {
        ElMessageBox.alert(`新密码：${dp}`, '重置成功', { confirmButtonText: '我知道了' })
      } else {
        ElMessage.success('密码已重置')
      }
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    } finally {
      resetLoading.value = false
    }
  }

  onMounted(() => {
    loadDepartments()
  })
</script>
