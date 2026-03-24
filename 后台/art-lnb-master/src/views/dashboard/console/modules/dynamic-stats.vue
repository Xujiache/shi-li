<template>
  <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>动态</h4>
        <p>最近事件<span class="text-success">+{{ list.length }}</span></p>
      </div>
    </div>

    <div class="h-9/10 mt-2 overflow-hidden">
      <ElScrollbar>
        <div
          class="h-17.5 leading-17.5 border-b border-g-300 text-sm overflow-hidden last:border-b-0"
          v-for="(item, index) in list"
          :key="index"
        >
          <span class="text-g-800 font-medium">{{ item.username }}</span>
          <span class="mx-2 text-g-600">{{ item.type }}</span>
          <span class="text-theme">{{ item.target }}</span>
        </div>
      </ElScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { DashboardStatsResponse } from '@/api/vision-admin'

  interface DynamicItem {
    username: string
    type: string
    target: string
  }

  const props = defineProps<{
    stats: DashboardStatsResponse | null
    loading?: boolean
  }>()

  const list = computed<DynamicItem[]>(() => {
    const rows = props.stats?.dynamics
    if (!Array.isArray(rows)) return []
    return rows.map((r) => ({
      username: String((r as Record<string, unknown>).username || ''),
      type: String((r as Record<string, unknown>).type || ''),
      target: String((r as Record<string, unknown>).target || '')
    }))
  })
</script>
