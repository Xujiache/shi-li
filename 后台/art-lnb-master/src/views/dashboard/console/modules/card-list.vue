<template>
  <ElRow :gutter="20" class="flex">
    <ElCol v-for="(item, index) in dataList" :key="index" :sm="12" :md="6" :lg="6">
      <div class="art-card relative flex flex-col justify-center h-35 px-5 mb-5 max-sm:mb-4">
        <span class="text-g-700 text-sm">{{ item.des }}</span>
        <ArtCountTo class="text-[26px] font-medium mt-2" :target="item.num" :duration="1300" />
        <div class="flex-c mt-1">
          <span class="text-xs text-g-600">较上周</span>
          <span
            class="ml-1 text-xs font-semibold"
            :class="[item.change.indexOf('+') === -1 ? 'text-danger' : 'text-success']"
          >
            {{ item.change }}
          </span>
        </div>
        <div
          class="absolute top-0 bottom-0 right-5 m-auto size-12.5 rounded-xl flex-cc bg-theme/10"
        >
          <ArtSvgIcon :icon="item.icon" class="text-xl text-theme" />
        </div>
      </div>
    </ElCol>
  </ElRow>
</template>

<script setup lang="ts">
  import type { DashboardStatsResponse } from '@/api/vision-admin'

  interface CardDataItem {
    des: string
    icon: string
    startVal: number
    duration: number
    num: number
    change: string
  }

  const props = defineProps<{
    stats: DashboardStatsResponse | null
    loading?: boolean
  }>()

  /**
   * 卡片统计数据列表
   * 展示总访问次数、在线访客数、点击量和新用户等核心数据指标
   */
  const dataList = computed<CardDataItem[]>(() => {
    const cards = props.stats?.cards || {}
    const changes = props.stats?.changes || {}
    return [
      {
        des: '总访问次数',
        icon: 'ri:pie-chart-line',
        startVal: 0,
        duration: 1000,
        num: Number(cards.total_visits || 0),
        change: String((changes as any).total_visits ?? '--')
      },
      {
        des: '在线访客数',
        icon: 'ri:group-line',
        startVal: 0,
        duration: 1000,
        num: Number(cards.online_visitors || 0),
        change: '--'
      },
      {
        des: '点击量',
        icon: 'ri:fire-line',
        startVal: 0,
        duration: 1000,
        num: Number(cards.click_count || 0),
        change: String((changes as any).click_count ?? '--')
      },
      {
        des: '新用户(近7天)',
        icon: 'ri:progress-2-line',
        startVal: 0,
        duration: 1000,
        num: Number(cards.new_users_7d || 0),
        change: String((changes as any).new_users_7d ?? '--')
      }
    ]
  })
</script>
