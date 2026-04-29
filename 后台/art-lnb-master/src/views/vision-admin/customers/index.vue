<template>
  <div class="vision-customers-page art-full-height">
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

      <!-- 编辑 Drawer -->
      <ElDrawer
        v-model="drawerVisible"
        title="编辑客户"
        size="520px"
        destroy-on-close
      >
        <ElForm ref="formRef" :model="formData" :rules="formRules" label-width="120px">
          <ElFormItem label="客户编号">
            <ElInput :model-value="formData.customer_no" disabled />
          </ElFormItem>
          <ElFormItem label="姓名" prop="display_name">
            <ElInput v-model="formData.display_name" placeholder="请输入姓名" />
          </ElFormItem>
          <ElFormItem label="手机号" prop="phone">
            <ElInput v-model="formData.phone" placeholder="请输入手机号" />
          </ElFormItem>
          <ElFormItem label="性别">
            <ElRadioGroup v-model="formData.gender">
              <ElRadio value="male">男</ElRadio>
              <ElRadio value="female">女</ElRadio>
              <ElRadio value="unknown">未知</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem label="年龄">
            <ElInputNumber v-model="formData.age" :min="0" :max="200" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="学校">
            <ElInput v-model="formData.school" />
          </ElFormItem>
          <ElFormItem label="班级">
            <ElInput v-model="formData.class_name" />
          </ElFormItem>
          <ElFormItem label="状态" prop="status">
            <ElSelect v-model="formData.status" style="width: 100%">
              <ElOption label="潜在" value="potential" />
              <ElOption label="意向" value="interested" />
              <ElOption label="成交" value="signed" />
              <ElOption label="流失" value="lost" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="等级" prop="level">
            <ElRadioGroup v-model="formData.level">
              <ElRadioButton value="A">A级</ElRadioButton>
              <ElRadioButton value="B">B级</ElRadioButton>
              <ElRadioButton value="C">C级</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem label="归属员工">
            <ElSelect
              v-model="formData.assigned_employee_id"
              filterable
              clearable
              placeholder="请选择归属员工"
              style="width: 100%"
            >
              <ElOption
                v-for="e in employeeOptions"
                :key="e.id"
                :label="`${e.display_name} (${e.phone})`"
                :value="e.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="下次跟进时间">
            <ElDatePicker
              v-model="formData.next_follow_up_at"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="不设置"
              style="width: 100%"
            />
          </ElFormItem>
          <ElFormItem label="提醒内容">
            <ElInput
              v-model="formData.next_follow_up_text"
              type="textarea"
              :rows="2"
              placeholder="到提醒时间会推送到员工 APP"
            />
          </ElFormItem>
          <ElFormItem label="备注">
            <ElInput v-model="formData.remark" type="textarea" :rows="3" />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="drawerVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">
            保存（员工会收到变更通知）
          </ElButton>
        </template>
      </ElDrawer>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, reactive, onMounted, nextTick } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    adminCustomersList,
    adminCustomerUpdate,
    adminCustomersExport,
    employeesList,
    type AdminCustomerRow,
    type EmployeeRow
  } from '@/api/vision-admin'
  import {
    ElCard,
    ElTag,
    ElMessage,
    ElButton,
    ElDrawer,
    ElForm,
    ElFormItem,
    ElInput,
    ElInputNumber,
    ElSelect,
    ElOption,
    ElRadio,
    ElRadioGroup,
    ElRadioButton,
    ElDatePicker
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminCustomers' })

  const drawerVisible = ref(false)
  const submitLoading = ref(false)
  const exportLoading = ref(false)
  const formRef = ref<FormInstance>()
  const formData = reactive<{
    id?: number | string
    customer_no: string
    display_name: string
    phone: string
    gender: 'male' | 'female' | 'unknown'
    age: number | null
    school: string
    class_name: string
    status: 'potential' | 'interested' | 'signed' | 'lost'
    level: 'A' | 'B' | 'C'
    remark: string
    next_follow_up_at: string | null
    next_follow_up_text: string
    assigned_employee_id: number | null
  }>({
    customer_no: '',
    display_name: '',
    phone: '',
    gender: 'unknown',
    age: null,
    school: '',
    class_name: '',
    status: 'potential',
    level: 'C',
    remark: '',
    next_follow_up_at: null,
    next_follow_up_text: '',
    assigned_employee_id: null
  })

  const formRules: FormRules = {
    display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
    ],
    status: [{ required: true, message: '请选择状态', trigger: 'change' }],
    level: [{ required: true, message: '请选择等级', trigger: 'change' }]
  }

  const employeeOptions = ref<EmployeeRow[]>([])

  async function loadEmployees() {
    try {
      const res: any = await employeesList({ page: 1, page_size: 500, active: true })
      employeeOptions.value = (res?.list ?? res?.data?.list ?? []) as EmployeeRow[]
    } catch (_) {
      employeeOptions.value = []
    }
  }

  const searchForm = ref({
    q: undefined as string | undefined,
    status: undefined as string | undefined,
    level: undefined as string | undefined,
    assigned_employee_id: undefined as number | undefined
  })

  const searchItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '姓名/手机号/编号' } },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: '潜在', value: 'potential' },
          { label: '意向', value: 'interested' },
          { label: '成交', value: 'signed' },
          { label: '流失', value: 'lost' }
        ]
      }
    },
    {
      label: '等级',
      key: 'level',
      type: 'select',
      props: {
        options: [
          { label: '全部', value: undefined },
          { label: 'A级', value: 'A' },
          { label: 'B级', value: 'B' },
          { label: 'C级', value: 'C' }
        ]
      }
    },
    {
      label: '归属员工',
      key: 'assigned_employee_id',
      type: 'select',
      props: {
        filterable: true,
        options: () => [
          { label: '全部', value: undefined },
          ...employeeOptions.value.map((e) => ({ label: `${e.display_name}(${e.phone})`, value: e.id }))
        ]
      }
    }
  ]

  const statusTagMap: Record<string, string> = {
    potential: 'info',
    interested: 'warning',
    signed: 'success',
    lost: 'danger'
  }
  const statusLabelMap: Record<string, string> = {
    potential: '潜在',
    interested: '意向',
    signed: '成交',
    lost: '流失'
  }
  const levelTagMap: Record<string, string> = {
    A: 'danger',
    B: 'warning',
    C: 'success'
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
      apiFn: adminCustomersList as (p: Record<string, unknown>) => Promise<{ list?: AdminCustomerRow[] }>,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'customer_no', label: '编号', width: 130 },
        { prop: 'display_name', label: '姓名', width: 110 },
        { prop: 'phone', label: '手机号', width: 130 },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: AdminCustomerRow) =>
            h(
              ElTag,
              { type: (statusTagMap[row.status] || 'info') as any, size: 'small' },
              () => statusLabelMap[row.status] || row.status
            )
        },
        {
          prop: 'level',
          label: '等级',
          width: 80,
          formatter: (row: AdminCustomerRow) =>
            h(ElTag, { type: (levelTagMap[row.level] || 'info') as any, size: 'small' }, () => `${row.level}级`)
        },
        {
          prop: 'assigned_employee_name',
          label: '归属员工',
          width: 130,
          formatter: (row: AdminCustomerRow) => row.assigned_employee_name || '-'
        },
        {
          prop: 'department_name',
          label: '部门',
          width: 130,
          formatter: (row: AdminCustomerRow) => row.department_name || '-'
        },
        {
          prop: 'next_follow_up_at',
          label: '下次跟进',
          width: 170,
          formatter: (row: AdminCustomerRow) => row.next_follow_up_at || '-'
        },
        {
          prop: 'last_follow_up_at',
          label: '上次跟进',
          width: 170,
          formatter: (row: AdminCustomerRow) => row.last_follow_up_at || '-'
        },
        { prop: 'created_at', label: '创建时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 100,
          fixed: 'right',
          formatter: (row: AdminCustomerRow) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, { type: 'edit', onClick: () => openEdit(row) })
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
    searchForm.value = {
      q: undefined,
      status: undefined,
      level: undefined,
      assigned_employee_id: undefined
    }
  }

  function openEdit(row: AdminCustomerRow) {
    formData.id = row.id
    formData.customer_no = row.customer_no
    formData.display_name = row.display_name
    formData.phone = row.phone
    formData.gender = row.gender
    formData.age = row.age
    formData.school = row.school
    formData.class_name = row.class_name
    formData.status = row.status
    formData.level = row.level
    formData.remark = row.remark
    formData.next_follow_up_at = row.next_follow_up_at
    formData.next_follow_up_text = row.next_follow_up_text
    formData.assigned_employee_id = row.assigned_employee_id
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
    if (formData.id == null) return
    submitLoading.value = true
    try {
      await adminCustomerUpdate({
        id: formData.id,
        patch: {
          display_name: formData.display_name,
          phone: formData.phone,
          gender: formData.gender,
          age: formData.age,
          school: formData.school,
          class_name: formData.class_name,
          status: formData.status,
          level: formData.level,
          remark: formData.remark,
          next_follow_up_at: formData.next_follow_up_at,
          next_follow_up_text: formData.next_follow_up_text,
          assigned_employee_id: formData.assigned_employee_id
        }
      })
      ElMessage.success('已保存（员工会收到变更通知）')
      drawerVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      submitLoading.value = false
    }
  }

  async function handleExport() {
    exportLoading.value = true
    try {
      await adminCustomersExport({
        q: searchForm.value.q,
        status: searchForm.value.status,
        level: searchForm.value.level,
        assigned_employee_id: searchForm.value.assigned_employee_id
      })
      ElMessage.success('导出成功')
    } catch (e: any) {
      ElMessage.error(e?.message || '导出失败')
    } finally {
      exportLoading.value = false
    }
  }

  onMounted(() => {
    loadEmployees()
  })
</script>
