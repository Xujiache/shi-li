<template>
  <div class="art-card h-128 p-5 mb-5 max-sm:mb-4">
    <div class="art-card-header">
      <div class="title">
        <h4>数据概览</h4>
        <p>实时汇总<span class="text-success">+{{ list.length }}</span></p>
      </div>
    </div>

    <div class="h-[calc(100%-40px)] overflow-auto">
      <ElScrollbar>
        <div
          class="flex-cb h-17.5 border-b border-g-300 text-sm last:border-b-0"
          v-for="(item, index) in list"
          :key="index"
        >
          <div>
            <p class="text-sm">{{ item.label }}</p>
            <p class="text-g-500 mt-1">{{ item.desc }}</p>
          </div>
          <div class="text-g-800 font-medium">{{ item.value }}</div>
        </div>
      </ElScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { DashboardStatsResponse } from '@/api/vision-admin'

  const props = defineProps<{
    stats: DashboardStatsResponse | null
    loading?: boolean
  }>()

  const list = computed(() => {
    const o = props.stats?.overview || {}
    const cards = props.stats?.cards || {}
    return [
      { label: '总用户量', desc: 'users 集合（未删除）', value: Number((o as any).total_users || 0) },
      { label: '孩子档案', desc: 'children 集合', value: Number((o as any).total_children || 0) },
      { label: '预约记录', desc: 'appointments 集合', value: Number((o as any).total_appointments || 0) },
      { label: '检测记录', desc: 'checkup_records 集合', value: Number((o as any).total_checkups || 0) },
      { label: '总访问次数', desc: 'analytics_events.page_view', value: Number((cards as any).total_visits || 0) },
      { label: '在线访客数', desc: '近 5 分钟活跃 visitor', value: Number((cards as any).online_visitors || 0) }
    ]
  })
</script>
