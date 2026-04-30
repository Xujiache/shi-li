<template>
  <view class="page">
    <!-- ===== 顶部条 ===== -->
    <view class="top-bar">
      <view class="top-title-row">
        <view class="top-title">
          客户
          <text v-if="totalLabel" class="top-count">{{ totalLabel }}</text>
        </view>
        <view class="top-sort" @click="showSortSheet">
          <svg-icon name="bar-chart-3" :size="28" color="#4E5969" />
          <text>{{ sortOptions[sortIdx].label }}</text>
        </view>
      </view>
      <view class="search-box">
        <view class="search-icon">
          <svg-icon name="search" :size="28" color="#86909C" />
        </view>
        <input
          class="search-input"
          v-model="filters.q"
          placeholder="搜索姓名 / 手机号"
          confirm-type="search"
          @confirm="onSearch"
        />
        <view v-if="filters.q" class="search-clear" @click="clearQ">
          <svg-icon name="x" :size="24" color="#86909C" />
        </view>
      </view>
      <view class="chip-row">
        <view
          v-for="(s, i) in statusOptions"
          :key="s.value || 'all'"
          class="chip"
          :class="{ active: statusIdx === i, [`chip-${s.tone}`]: statusIdx === i && s.tone }"
          @click="onStatusChip(i)"
        >{{ s.label }}</view>
      </view>
      <view class="chip-row">
        <view
          v-for="(l, i) in levelOptions"
          :key="l.value || 'all-l'"
          class="chip chip-sm"
          :class="{ active: levelIdx === i, [`chip-level-${l.value || 'all'}`]: levelIdx === i }"
          @click="onLevelChip(i)"
        >{{ l.label }}</view>
      </view>
    </view>

    <!-- ===== 列表 ===== -->
    <view class="list">
      <view
        v-for="item in store.list"
        :key="item.id"
        @longpress="onLongPress(item)"
      >
        <customer-card
          :customer="item"
          @tap="onTap(item)"
          @call="onCall(item)"
          @more="onLongPress(item)"
        />
      </view>
      <empty-state v-if="!store.loading && store.list.length === 0" text="暂无客户" />
      <view v-if="store.loading && store.list.length > 0" class="state">加载中...</view>
      <view v-else-if="store.finished && store.list.length > 0" class="state">— 没有更多了 —</view>
    </view>

    <!-- ===== 浮动新增按钮 ===== -->
    <view class="fab" @click="goNew">
      <svg-icon name="plus" :size="44" color="#ffffff" />
    </view>

    <!-- ===== 设跟进提醒 ===== -->
    <datetime-picker
      v-model:visible="reminderPickerVisible"
      :model-value="reminderInitial"
      title="设跟进提醒"
      :allow-clear="true"
      @confirm="onReminderConfirm"
    />

    <floating-tabbar active="/pages/customer/list" />
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useCustomersStore } from '@/stores/customers'
import SvgIcon from '@/components/svg-icon.vue'

const store = useCustomersStore()

const statusOptions = [
  { label: '全部', value: '', tone: '' },
  { label: '潜在', value: 'potential', tone: 'gray' },
  { label: '意向', value: 'interested', tone: 'orange' },
  { label: '成交', value: 'signed', tone: 'green' },
  { label: '流失', value: 'lost', tone: 'red' }
]
const levelOptions = [
  { label: '全部等级', value: '' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' }
]
const sortOptions = [
  { label: '最近跟进', value: 'last_follow_up_at_desc' },
  { label: '创建时间', value: 'created_at_desc' }
]

const statusIdx = ref(0)
const levelIdx = ref(0)
const sortIdx = ref(0)

const filters = reactive({ q: store.filters.q || '' })

const totalLabel = computed(() => {
  const t = (store as any).total
  if (t == null) return ''
  return `· ${t}`
})

function applyAndRefresh() {
  store.setFilters({
    q: filters.q,
    status: statusOptions[statusIdx.value].value,
    level: levelOptions[levelIdx.value].value
  })
  store.refresh()
}

function onSearch() { applyAndRefresh() }
function onStatusChip(i: number) { statusIdx.value = i; applyAndRefresh() }
function onLevelChip(i: number) { levelIdx.value = i; applyAndRefresh() }
function clearQ() { filters.q = ''; applyAndRefresh() }

function showSortSheet() {
  uni.showActionSheet({
    itemList: sortOptions.map((s) => s.label),
    success: (r) => {
      sortIdx.value = r.tapIndex
      applyAndRefresh()
    }
  })
}

function onTap(item: any) {
  uni.navigateTo({ url: `/pages/customer/detail?id=${item.id}` })
}

function onCall(item: any) {
  if (!item.phone) {
    uni.showToast({ title: '无手机号', icon: 'none' })
    return
  }
  // #ifdef H5
  window.location.href = `tel:${item.phone}`
  // #endif
  // #ifndef H5
  uni.makePhoneCall({ phoneNumber: String(item.phone) })
  // #endif
}

function onLongPress(item: any) {
  uni.showActionSheet({
    itemList: ['写跟进', '设提醒', '转出', '删除'],
    success: async (r) => {
      if (r.tapIndex === 0) {
        uni.navigateTo({ url: `/pages/follow-up/new?customer_id=${item.id}` })
      } else if (r.tapIndex === 1) {
        promptReminder(item)
      } else if (r.tapIndex === 2) {
        uni.navigateTo({ url: `/pages/transfer/new?customer_id=${item.id}` })
      } else if (r.tapIndex === 3) {
        confirmDelete(item)
      }
    }
  })
}

const reminderPickerVisible = ref(false)
const reminderInitial = ref<string | null>(null)
const reminderTarget = ref<any>(null)

function promptReminder(item: any) {
  reminderTarget.value = item
  reminderInitial.value = item?.next_follow_up_at || null
  reminderPickerVisible.value = true
}

async function onReminderConfirm(v: string | null) {
  const target = reminderTarget.value
  if (!target) return
  try {
    const ret = await store.setReminder(target.id, { remind_at: v })
    if (ret.status === 'ok') {
      uni.showToast({ title: v ? '已设置' : '已清除', icon: 'success' })
      store.refresh()
    }
  } catch (e) { /* http 已 toast */ }
  reminderTarget.value = null
}

function confirmDelete(item: any) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除客户「${item.display_name || item.name || ''}」？`,
    success: async (r) => {
      if (r.confirm) {
        try {
          const ret = await store.deleteCustomer(item.id)
          if (ret.status === 'ok') {
            uni.showToast({ title: '已删除', icon: 'success' })
          }
        } catch (e) { /* */ }
      }
    }
  })
}

function goNew() {
  uni.navigateTo({ url: '/pages/customer/new' })
}

onShow(() => {
  try {
    const raw = uni.getStorageSync('quick_entry_query__/pages/customer/list')
    if (raw) {
      uni.removeStorageSync('quick_entry_query__/pages/customer/list')
      const params = new URLSearchParams(raw)
      if (params.get('filter') === 'needs_follow_up') {
        statusIdx.value = 0
        levelIdx.value = 0
        sortIdx.value = sortOptions.findIndex((s) => s.value === 'next_follow_up_at')
        if (sortIdx.value < 0) sortIdx.value = 0
        store.setFilters({
          q: '',
          status: '',
          level: '',
          sort: 'next_follow_up_at'
        })
      }
    }
  } catch (_) { /* */ }
  store.refresh()
})

onPullDownRefresh(async () => {
  await store.refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  store.loadMore()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

/* ===== 顶部条 ===== */
.top-bar {
  background: #ffffff;
  padding: 24rpx 24rpx 16rpx;
  border-radius: 0 0 24rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(20, 30, 60, 0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}
.top-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.top-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1F2329;
}
.top-count {
  font-size: 24rpx;
  color: #86909C;
  font-weight: 400;
  margin-left: 8rpx;
}
.top-sort {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 24rpx;
  color: #4E5969;
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  background: #F2F3F5;
  &:active { opacity: 0.7; }
}

.search-box {
  background: #F2F3F5;
  border-radius: 24rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}
.search-icon { display: flex; align-items: center; flex-shrink: 0; }
.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
  background: transparent;
}
.search-clear {
  width: 40rpx; height: 40rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  &:active { background: #E5E6EB; }
}

.chip-row {
  display: flex;
  gap: 10rpx;
  overflow-x: auto;
  padding-bottom: 12rpx;
  white-space: nowrap;
  &::-webkit-scrollbar { display: none; }
  &:last-child { padding-bottom: 0; }
}
.chip {
  flex-shrink: 0;
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
  background: #F2F3F5;
  font-size: 24rpx;
  color: #4E5969;
  transition: all 0.15s;
  &:active { opacity: 0.7; }
  &.active {
    background: #1677FF;
    color: #ffffff;
    font-weight: 500;
  }
  &.chip-orange.active { background: #FA8C16; }
  &.chip-green.active { background: #00B42A; }
  &.chip-red.active { background: #F53F3F; }
  &.chip-gray.active { background: #4E5969; }
}
.chip-sm {
  padding: 8rpx 20rpx;
  font-size: 22rpx;
}
.chip-level-A.active { background: #F53F3F; }
.chip-level-B.active { background: #FA8C16; }
.chip-level-C.active { background: #1677FF; }

/* ===== 列表 ===== */
.list { padding: 16rpx 16rpx 0; }
.state {
  text-align: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #86909C;
}

/* ===== FAB ===== */
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 220rpx;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.45);
  transition: transform 0.15s ease;
  z-index: 50;
  &:active { transform: scale(0.92); }
}
</style>
