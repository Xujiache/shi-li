<template>
  <div class="vision-admins-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton type="primary" @click="showDialog('add')" v-ripple>新增管理员</ElButton>
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

      <!-- 新增/编辑弹窗 -->
      <ElDialog
        v-model="dialogVisible"
        :title="dialogType === 'add' ? '新增管理员' : '编辑管理员'"
        width="500px"
        destroy-on-close
      >
        <ElForm ref="formRef" :model="formData" :rules="formRules" label-width="80px">
          <ElFormItem label="手机号" prop="phone">
            <ElInput v-model="formData.phone" placeholder="请输入手机号" />
          </ElFormItem>
          <ElFormItem label="姓名" prop="display_name">
            <ElInput v-model="formData.display_name" placeholder="请输入姓名" />
          </ElFormItem>
          <ElFormItem label="密码" :prop="dialogType === 'add' ? 'password' : undefined">
            <ElInput
              v-model="formData.password"
              type="password"
              show-password
              :placeholder="dialogType === 'add' ? '请输入密码' : '留空则不修改'"
            />
          </ElFormItem>
          <ElFormItem label="角色" prop="role">
            <ElSelect v-model="formData.role" placeholder="请选择角色" style="width:100%">
              <ElOption label="超级管理员" value="super_admin" />
              <ElOption label="普通管理员" value="admin" />
            </ElSelect>
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">确定</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, nextTick } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { adminsList, adminsCreate, adminsUpdate, adminsDelete } from '@/api/vision-admin'
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
    ElSelect,
    ElOption
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  defineOptions({ name: 'VisionAdminAdmins' })

  interface AdminRow {
    _id: string
    id: number
    phone: string
    display_name: string
    role: string
    active: boolean
    last_login_at?: string
    created_at?: string
    updated_at?: string
  }

  const dialogType = ref<'add' | 'edit'>('add')
  const dialogVisible = ref(false)
  const submitLoading = ref(false)
  const formRef = ref<FormInstance>()
  const formData = ref<Record<string, any>>({
    phone: '',
    display_name: '',
    password: '',
    role: 'admin'
  })

  const formRules: FormRules = {
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
    ],
    display_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, message: '密码不少于6位', trigger: 'blur' }
    ],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }

  const roleTagMap: Record<string, string> = {
    super_admin: 'danger',
    admin: 'primary'
  }
  const roleLabelMap: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '普通管理员'
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: adminsList as (params: Record<string, unknown>) => Promise<{
        list?: AdminRow[]
        page?: number
        page_size?: number
        total?: number
      }>,
      apiParams: { current: 1, size: 20 },
      paginationKey: { current: 'current', size: 'size' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'phone', label: '手机号', width: 140 },
        { prop: 'display_name', label: '姓名', width: 140 },
        {
          prop: 'role',
          label: '角色',
          width: 130,
          formatter: (row: AdminRow) =>
            h(
              ElTag,
              { type: (roleTagMap[row.role] || 'info') as any, size: 'small' },
              () => roleLabelMap[row.role] || row.role
            )
        },
        {
          prop: 'active',
          label: '状态',
          width: 80,
          formatter: (row: AdminRow) =>
            h(ElTag, { type: row.active ? 'success' : 'danger', size: 'small' }, () =>
              row.active ? '正常' : '禁用'
            )
        },
        { prop: 'last_login_at', label: '最后登录', width: 170 },
        { prop: 'created_at', label: '创建时间', width: 170 },
        {
          prop: 'operation',
          label: '操作',
          width: 150,
          fixed: 'right',
          formatter: (row: AdminRow) =>
            h('div', { class: 'flex gap-1' }, [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              }),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => handleDelete(row)
              })
            ])
        }
      ]
    }
  })

  function showDialog(type: 'add' | 'edit', row?: AdminRow) {
    dialogType.value = type
    if (type === 'edit' && row) {
      formData.value = {
        _id: row._id,
        phone: row.phone,
        display_name: row.display_name,
        password: '',
        role: row.role
      }
    } else {
      formData.value = { phone: '', display_name: '', password: '', role: 'admin' }
    }
    nextTick(() => (dialogVisible.value = true))
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
        await adminsCreate({
          phone: formData.value.phone,
          password: formData.value.password,
          display_name: formData.value.display_name,
          role: formData.value.role
        })
        ElMessage.success('创建成功')
      } else {
        const patch: Record<string, any> = {
          phone: formData.value.phone,
          display_name: formData.value.display_name,
          role: formData.value.role
        }
        if (formData.value.password) {
          patch.password = formData.value.password
        }
        await adminsUpdate({ admin_id: formData.value._id, patch })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    } finally {
      submitLoading.value = false
    }
  }

  async function handleDelete(row: AdminRow) {
    await ElMessageBox.confirm(`确定要删除管理员「${row.display_name}」吗？`, '删除管理员', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    try {
      await adminsDelete({ admin_id: row._id })
      ElMessage.success('已删除')
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败')
    }
  }
</script>
