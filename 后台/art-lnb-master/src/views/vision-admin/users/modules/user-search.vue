<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    @reset="handleReset"
    @search="handleSearch"
  />
</template>

<script setup lang="ts">
  interface Props {
    modelValue: Record<string, unknown>
  }
  interface Emits {
    (e: 'update:modelValue', value: Record<string, unknown>): void
    (e: 'search', params: Record<string, unknown>): void
    (e: 'reset'): void
  }
  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const formItems = [
    { label: '关键词', key: 'q', type: 'input', props: { placeholder: '手机号/昵称/用户编号' } },
    {
      label: '管理员',
      key: 'is_admin',
      type: 'select',
      props: {
        placeholder: '全部',
        options: [
          { label: '全部', value: undefined },
          { label: '是', value: true },
          { label: '否', value: false }
        ]
      }
    },
    {
      label: '启用状态',
      key: 'active',
      type: 'select',
      props: {
        placeholder: '全部',
        options: [
          { label: '全部', value: undefined },
          { label: '启用', value: true },
          { label: '禁用', value: false }
        ]
      }
    }
  ]

  function handleReset() {
    emit('reset')
  }

  async function handleSearch() {
    await searchBarRef.value?.validate()
    emit('search', { ...formData.value })
  }
</script>
