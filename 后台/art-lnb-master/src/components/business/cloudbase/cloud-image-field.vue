<template>
  <div class="cloud-image-field">
    <div class="flex items-start gap-3">
      <div class="preview">
        <ElImage
          v-if="previewUrl"
          :src="previewUrl"
          :preview-src-list="[previewUrl]"
          fit="cover"
          class="preview-img"
        />
        <div v-else class="preview-empty">暂无图片</div>
      </div>

      <div class="flex flex-col gap-2">
        <ElUpload
          :disabled="disabled"
          accept="image/*"
          :show-file-list="false"
          :http-request="handleUpload"
        >
          <ElButton type="primary" :loading="uploading" v-ripple>
            <ElIcon class="mr-1"><Plus /></ElIcon>
            上传图片
          </ElButton>
        </ElUpload>

        <ElButton v-if="modelValue" :disabled="disabled || uploading" @click="clear" v-ripple>
          清除
        </ElButton>
      </div>
    </div>

    <ElInput
      v-if="showInput"
      v-model="innerValue"
      class="mt-2"
      :disabled="disabled"
      :placeholder="placeholder"
      clearable
    />
  </div>
</template>

<script setup lang="ts">
  import { Plus } from '@element-plus/icons-vue'
  import type { UploadRequestOptions } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { uploadCloudImage, resolveCloudImageUrl } from '@/utils/cloudbase-storage'

  defineOptions({ name: 'CloudImageField' })

  interface Props {
    modelValue: string
    /** 云存储路径前缀，如：vision-admin/banners */
    prefix?: string
    /** 是否显示可手工编辑的输入框 */
    showInput?: boolean
    placeholder?: string
    disabled?: boolean
    /** 最大体积（MB） */
    maxSizeMB?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    prefix: 'vision-admin',
    showInput: true,
    placeholder: 'cloud:// fileID 或 URL',
    disabled: false,
    maxSizeMB: 5
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void
  }>()

  const innerValue = computed({
    get: () => props.modelValue || '',
    set: (v) => emit('update:modelValue', v)
  })

  const previewUrl = ref('')
  const uploading = ref(false)

  async function refreshPreview(v: string) {
    try {
      previewUrl.value = v ? await resolveCloudImageUrl(v) : ''
    } catch {
      previewUrl.value = v || ''
    }
  }

  watch(
    () => props.modelValue,
    (v) => {
      refreshPreview(v || '')
    },
    { immediate: true }
  )

  function clear() {
    emit('update:modelValue', '')
  }

  async function handleUpload(options: UploadRequestOptions) {
    const file = options.file as File
    const maxSize = props.maxSizeMB * 1024 * 1024
    if (file && file.size > maxSize) {
      ElMessage.error(`图片过大，请上传不超过 ${props.maxSizeMB}MB 的图片`)
      options.onError?.(new Error('文件过大') as any)
      return
    }

    uploading.value = true
    try {
      const fileID = await uploadCloudImage(file, { prefix: props.prefix })
      emit('update:modelValue', fileID)
      await refreshPreview(fileID)
      options.onSuccess?.({ fileID } as any)
      ElMessage.success('上传成功')
    } catch (e: any) {
      ElMessage.error(e?.message || '上传失败')
      options.onError?.(e as any)
    } finally {
      uploading.value = false
    }
  }
</script>

<style scoped>
  .preview {
    width: 140px;
    height: 88px;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }

  .preview-img {
    width: 140px;
    height: 88px;
  }

  .preview-empty {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
  }
</style>

