<template>
  <div class="vision-terms-and-privacy art-full-height">
    <ElCard class="art-table-card" shadow="never" v-loading="loading">
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-base font-medium">协议与隐私</div>
            <div class="text-xs text-g-500 mt-1">
              配置小程序登录页弹窗内容（数据库：<span class="font-mono">system_config</span>，key：<span
                class="font-mono"
              >terms_and_privacy</span>）
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <ElButton @click="reload" :loading="loading" v-ripple>刷新</ElButton>
            <ElButton type="primary" @click="save" :loading="saving" v-ripple>保存</ElButton>
          </div>
        </div>
      </template>

      <ElForm ref="formRef" :model="form" label-width="110px">
        <ElFormItem label="用户协议">
          <ElInput
            v-model="form.user_agreement"
            type="textarea"
            :rows="8"
            placeholder="请输入《用户协议》内容"
            maxlength="20000"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="隐私政策">
          <ElInput
            v-model="form.privacy_policy"
            type="textarea"
            :rows="8"
            placeholder="请输入《隐私政策》内容"
            maxlength="20000"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="儿童隐私政策">
          <ElInput
            v-model="form.child_privacy_policy"
            type="textarea"
            :rows="8"
            placeholder="请输入《儿童隐私政策》内容"
            maxlength="20000"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="第三方共享清单">
          <ElInput
            v-model="form.third_party_share_list"
            type="textarea"
            :rows="8"
            placeholder="请输入《第三方信息共享清单》内容"
            maxlength="20000"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import type { FormInstance } from 'element-plus'
  import { systemConfigTermsGet, systemConfigTermsUpdate } from '@/api/vision-admin'

  defineOptions({ name: 'VisionAdminTermsAndPrivacy' })

  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const saving = ref(false)

  const form = reactive({
    user_agreement: '',
    privacy_policy: '',
    child_privacy_policy: '',
    third_party_share_list: ''
  })

  function applyRow(row: any) {
    form.user_agreement = String(row?.user_agreement ?? '')
    form.privacy_policy = String(row?.privacy_policy ?? '')
    form.child_privacy_policy = String(row?.child_privacy_policy ?? '')
    form.third_party_share_list = String(row?.third_party_share_list ?? '')
  }

  async function reload() {
    loading.value = true
    try {
      const res = await systemConfigTermsGet()
      applyRow((res as any).row)
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    try {
      await systemConfigTermsUpdate({ patch: { ...form } })
      ElMessage.success('已保存')
      await reload()
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    reload()
  })
</script>
