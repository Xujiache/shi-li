<template>
  <div class="art-card h-105 p-4 box-border mb-5 max-sm:mb-4">
    <ArtBarChart
      class="box-border p-2"
      barWidth="50%"
      height="13.7rem"
      :showAxisLine="false"
      :data="chartData"
      :xAxisData="xAxisLabels"
    />
    <div class="ml-1">
      <h3 class="mt-5 text-lg font-medium">用户概述</h3>
      <p class="mt-1 text-sm">比上周 <span class="text-success font-medium">+23%</span></p>
      <p class="mt-1 text-sm">我们为您创建了多个选项，可将它们组合在一起并定制为像素完美的页面</p>
    </div>
    <div class="flex-b mt-2">
      <div class="flex-1" v-for="(item, index) in list" :key="index">
        <p class="text-2xl text-g-900">{{ item.num }}</p>
        <p class="text-xs text-g-500">{{ item.name }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { DashboardStatsResponse } from '@/api/vision-admin'

  interface UserStatItem {
    name: string
    num: string
  }

  const props = defineProps<{
    stats: DashboardStatsResponse | null
    loading?: boolean
  }>()

  // 最近 9 个月访问量（来自埋点）
  const xAxisLabels = computed(() => {
    const x = props.stats?.visits_series?.xAxis || []
    return x.length >= 9 ? x.slice(-9) : x
  })

  const chartData = computed(() => {
    const d = props.stats?.visits_series?.data || []
    return d.length >= 9 ? d.slice(-9) : d
  })

  /**
   * 用户统计数据列表
   * 包含总用户量、总访问量、日访问量和周同比等关键指标
   */
  const list = computed<UserStatItem[]>(() => {
    const o = props.stats?.overview || {}
    const totalUsers = Number((o as any).total_users || 0)
    const totalChildren = Number((o as any).total_children || 0)
    const totalAppointments = Number((o as any).total_appointments || 0)
    const totalCheckups = Number((o as any).total_checkups || 0)
    return [
      { name: '总用户量', num: String(totalUsers) },
      { name: '孩子档案', num: String(totalChildren) },
      { name: '预约记录', num: String(totalAppointments) },
      { name: '检测记录', num: String(totalCheckups) }
    ]
  })
</script>
