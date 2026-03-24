<template>
  <div class="art-card p-5 h-128 overflow-hidden mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>新用户</h4>
        <p>最近注册用户（实时数据）</p>
      </div>
    </div>
    <ArtTable
      class="w-full"
      :data="tableData"
      style="width: 100%"
      size="large"
      :border="false"
      :stripe="false"
      :header-cell-style="{ background: 'transparent' }"
    >
      <template #default>
        <ElTableColumn label="用户" prop="display_name" min-width="220px">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              <img
                v-if="scope.row.avatar_url && scope.row.avatar_url.startsWith('http')"
                class="size-9 rounded-lg"
                :src="scope.row.avatar_url"
                alt="avatar"
              />
              <div
                v-else
                class="size-9 rounded-lg flex-cc"
                style="background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.55)"
              >
                —
              </div>
              <div class="ml-2">
                <div class="text-g-800 font-medium">{{ scope.row.display_name || '—' }}</div>
                <div class="text-xs text-g-500">{{ scope.row.user_id }}</div>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="手机号" prop="phone" width="140px" />
        <ElTableColumn label="创建时间" prop="created_at" min-width="170px" show-overflow-tooltip />
      </template>
    </ArtTable>
  </div>
</template>

<script setup lang="ts">
  import type { DashboardStatsResponse } from '@/api/vision-admin'
  import { getTempFileURLs, isCloudFileId } from '@/utils/cloudbase-storage'

  const props = defineProps<{
    stats: DashboardStatsResponse | null
    loading?: boolean
  }>()

  const avatarUrlMap = reactive<Record<string, string>>({})

  const rawUsers = computed<any[]>(() => {
    const list = props.stats?.new_users_list
    return Array.isArray(list) ? list : []
  })

  function formatDateTime(v: any): string {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return new Date(v).toLocaleString()
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ')
    const ms = v?.$date || v?.date || v?.timestamp
    if (typeof ms === 'number') return new Date(ms).toLocaleString()
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }

  watch(
    () => rawUsers.value.map((u) => u && u.avatar_file_id).filter(Boolean),
    async (urls) => {
      const ids = (urls || []).filter(isCloudFileId)
      if (ids.length === 0) return
      const map = await getTempFileURLs(ids)
      Object.assign(avatarUrlMap, map)
    },
    { immediate: true }
  )

  const tableData = computed(() => {
    return rawUsers.value.map((u) => {
      const user_id = String(u.user_id || u._id || '')
      const phone = String(u.phone || '')
      const display_name = String(u.display_name || phone || user_id)
      const rawAvatar = String(u.avatar_file_id || '')
      const avatar_url = isCloudFileId(rawAvatar) ? (avatarUrlMap[rawAvatar] || '') : rawAvatar
      return {
        user_id,
        phone,
        display_name,
        avatar_url,
        created_at: formatDateTime(u.created_at)
      }
    })
  })
</script>

<style lang="scss" scoped>
  .art-card {
    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      color: var(--el-color-primary) !important;
      background: transparent !important;
    }
  }
</style>
