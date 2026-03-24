<!-- 工作台页面 -->
<template>
  <div>
    <CardList :stats="stats" :loading="loading" />

    <ElRow :gutter="20">
      <ElCol :sm="24" :md="12" :lg="10">
        <ActiveUser :stats="stats" :loading="loading" />
      </ElCol>
      <ElCol :sm="24" :md="12" :lg="14">
        <SalesOverview :stats="stats" :loading="loading" />
      </ElCol>
    </ElRow>

    <ElRow :gutter="20">
      <ElCol :sm="24" :md="24" :lg="12">
        <NewUser :stats="stats" :loading="loading" />
      </ElCol>
      <ElCol :sm="24" :md="12" :lg="6">
        <Dynamic :stats="stats" :loading="loading" />
      </ElCol>
      <ElCol :sm="24" :md="12" :lg="6">
        <TodoList :stats="stats" :loading="loading" />
      </ElCol>
    </ElRow>

    <!-- <AboutProject /> -->
  </div>
</template>

<script setup lang="ts">
  import CardList from './modules/card-list.vue'
  import ActiveUser from './modules/active-user.vue'
  import SalesOverview from './modules/sales-overview.vue'
  import NewUser from './modules/new-user.vue'
  import Dynamic from './modules/dynamic-stats.vue'
  import TodoList from './modules/todo-list.vue'
  import { dashboardStats, type DashboardStatsResponse } from '@/api/vision-admin'
  // import AboutProject from './modules/about-project.vue'

  defineOptions({ name: 'Console' })

  const stats = ref<DashboardStatsResponse | null>(null)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      stats.value = await dashboardStats()
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    load()
  })
</script>
