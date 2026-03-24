<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增用户' : '编辑用户'"
    width="420px"
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
    usersUpdate
  } from '@/api/vision-admin'
  import CloudImageField from '@/components/business/cloudbase/cloud-image-field.vue'

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
