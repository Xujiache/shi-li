<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增用户' : '编辑用户'"
    width="560px"
    align-center
    @closed="formRef?.resetFields()"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem label="头像" prop="avatar_file_id">
        <CloudImageField v-model="formData.avatar_file_id" prefix="vision-admin/avatars" />
      </ElFormItem>
      <ElFormItem label="手机号" prop="phone">
        <ElInput v-model="formData.phone" placeholder="请输入手机号" maxlength="11" />
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'add'" label="密码" prop="password">
        <ElInput v-model="formData.password" type="password" placeholder="6-32位" show-password />
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'edit'" label="新密码" prop="password">
        <ElInput v-model="formData.password" type="password" placeholder="不修改请留空" show-password />
      </ElFormItem>
      <ElFormItem label="昵称" prop="display_name">
        <ElInput v-model="formData.display_name" placeholder="选填，1-20字" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="管理员" prop="is_admin">
        <ElSwitch v-model="formData.is_admin" />
      </ElFormItem>
      <ElFormItem label="启用" prop="active">
        <ElSwitch v-model="formData.active" />
      </ElFormItem>
    </ElForm>

    <!-- 编辑模式下显示家长↔孩子绑定与客户档案，便于排查"小程序建档了员工App搜不到"的问题 -->
    <template v-if="dialogType === 'edit'">
      <ElDivider content-position="left">名下孩子档案</ElDivider>
      <div v-if="detailLoading" class="relation-empty">加载中...</div>
      <div v-else-if="!children.length" class="relation-empty">
        该家长名下还没有孩子档案
      </div>
      <ElTable v-else :data="children" size="small" border>
        <ElTableColumn prop="child_no" label="档案编号" width="110" />
        <ElTableColumn prop="name" label="姓名" width="80" />
        <ElTableColumn prop="gender" label="性别" width="60" />
        <ElTableColumn prop="dob" label="出生日期" width="110" />
        <ElTableColumn label="学校 / 班级">
          <template #default="{ row }">
            {{ [row.school, row.grade_name, row.class_name].filter(Boolean).join(' / ') || '-' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="updated_at" label="更新时间" width="160" />
      </ElTable>

      <ElDivider content-position="left">客户档案 (CRM)</ElDivider>
      <div v-if="!customer" class="relation-empty">
        尚未生成 CRM 客户档案 (家长重新登录小程序后会自动生成)
      </div>
      <div v-else class="customer-box">
        <div class="row"><span class="label">客户编号</span><span>{{ customer.customer_no }}</span></div>
        <div class="row">
          <span class="label">归属员工</span>
          <span v-if="customer.assigned_employee_name">
            {{ customer.assigned_employee_name }}
            <span class="muted">（{{ customer.department_name || '无部门' }}）</span>
          </span>
          <ElTag v-else type="warning" size="small">待分配</ElTag>
        </div>
        <div class="row"><span class="label">来源</span><span>{{ sourceLabel(customer.source) }}</span></div>
        <div class="row"><span class="label">创建时间</span><span>{{ customer.created_at }}</span></div>
      </div>
    </template>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    usersCreate,
    usersUpdate,
    usersDetail
  } from '@/api/vision-admin'
  import CloudImageField from '@/components/business/cloudbase/cloud-image-field.vue'

  interface ChildRow {
    id: number
    _id?: string
    child_no?: string
    name?: string
    gender?: string
    dob?: string
    school?: string
    grade_name?: string
    class_name?: string
    updated_at?: string
  }

  interface CustomerSummary {
    id: number
    customer_no: string
    display_name: string
    phone: string
    status: string
    level: string
    source: string
    assigned_employee_id: number | null
    assigned_employee_name: string
    department_name: string
    created_at?: string
    updated_at?: string
  }

  const children = ref<ChildRow[]>([])
  const customer = ref<CustomerSummary | null>(null)
  const detailLoading = ref(false)

  function sourceLabel(s: string) {
    const m: Record<string, string> = {
      miniprogram: '小程序注册',
      employee: '员工建档',
      transferred: '转入'
    }
    return m[s] || s || '-'
  }

  async function loadRelations(userId: string) {
    if (!userId) {
      children.value = []
      customer.value = null
      return
    }
    detailLoading.value = true
    try {
      const r: any = await usersDetail({ user_id: userId })
      const data = r?.data ?? r
      children.value = Array.isArray(data?.children) ? data.children : []
      customer.value = data?.customer || null
    } catch {
      children.value = []
      customer.value = null
    } finally {
      detailLoading.value = false
    }
  }

  interface UserRow {
    _id?: string
    phone?: string
    display_name?: string
    avatar_file_id?: string
    is_admin?: boolean
    active?: boolean
  }

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    userData?: Partial<UserRow>
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
  })
  const dialogType = computed(() => props.type)
  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const formData = reactive({
    avatar_file_id: '',
    phone: '',
    password: '',
    display_name: '',
    is_admin: true,
    active: true
  })

  const rules: FormRules = {
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
    ],
    password: [
      {
        required: true,
        validator: (_: unknown, v: string, cb: (e?: Error) => void) => {
          if (dialogType.value === 'add' && !v) return cb(new Error('请输入密码'))
          if (v && (v.length < 6 || v.length > 32)) return cb(new Error('密码长度6-32'))
          cb()
        },
        trigger: 'blur'
      }
    ]
  }

  watch(
    () => [props.visible, props.userData, props.type],
    ([visible, userData, type]) => {
      if (visible) {
        const row = userData as Partial<UserRow> | undefined
        Object.assign(formData, {
          avatar_file_id: type === 'edit' && row?.avatar_file_id ? row.avatar_file_id : '',
          phone: type === 'edit' && row?.phone ? row.phone : '',
          password: '',
          display_name: type === 'edit' && row?.display_name ? row.display_name : '',
          is_admin: type === 'edit' ? (row?.is_admin != null ? row.is_admin : true) : true,
          active: type === 'edit' && row?.active != null ? row.active : true
        })
        nextTick(() => formRef.value?.clearValidate())
        if (type === 'edit' && row?._id) {
          loadRelations(String(row._id))
        } else {
          children.value = []
          customer.value = null
        }
      }
    },
    { immediate: true }
  )

  async function handleSubmit() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitting.value = true
      try {
        if (dialogType.value === 'add') {
          await usersCreate({
            avatar_file_id: formData.avatar_file_id || undefined,
            phone: formData.phone,
            password: formData.password,
            display_name: formData.display_name || undefined,
            is_admin: formData.is_admin,
            active: formData.active
          })
          ElMessage.success('新增成功')
        } else {
          const patch: Record<string, unknown> = {
            phone: formData.phone,
            display_name: formData.display_name || undefined,
            avatar_file_id: formData.avatar_file_id
          }
          if (formData.password) (patch as Record<string, string>).password = formData.password
          await usersUpdate({
            user_id: (props.userData as UserRow)._id!,
            patch
          })
          ElMessage.success('保存成功')
        }
        dialogVisible.value = false
        emit('submit')
      } finally {
        submitting.value = false
      }
    })
  }
</script>

<style scoped>
.relation-empty {
  padding: 12px 0;
  color: #909399;
  font-size: 13px;
}
.customer-box {
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
}
.customer-box .row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 8px;
}
.customer-box .label {
  width: 80px;
  color: #909399;
  flex-shrink: 0;
}
.customer-box .muted {
  color: #c0c4cc;
  font-size: 12px;
}
</style>
