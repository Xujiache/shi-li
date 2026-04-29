<template>
  <view class="page">
    <!-- 顶部筛选条 -->
    <view class="filter-bar">
      <view class="search-box">
        <input
          class="search-input"
          v-model="filters.q"
          placeholder="搜索姓名/手机号"
          confirm-type="search"
          @confirm="onSearch"
        />
      </view>
      <view class="filter-row">
        <picker mode="selector" :value="statusIdx" :range="statusOptions" range-key="label" @change="onStatusChange">
          <view class="filter-pick">
            <text>{{ statusOptions[statusIdx].label }}</text>
            <text class="caret">▾</text>
          </view>
        </picker>
        <picker mode="selector" :value="levelIdx" :range="levelOptions" range-key="label" @change="onLevelChange">
          <view class="filter-pick">
            <text>{{ levelOptions[levelIdx].label }}</text>
            <text class="caret">▾</text>
          </view>
        </picker>
        <picker mode="selector" :value="sortIdx" :range="sortOptions" range-key="label" @change="onSortChange">
          <view class="filter-pick">
            <text>{{ sortOptions[sortIdx].label }}</text>
            <text class="caret">▾</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 列表 -->
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
      <view v-if="store.loading" class="loading">加载中...</view>
      <view v-else-if="store.finished && store.list.length > 0" class="loading">已全部加载</view>
    </view>

    <!-- 浮动新增按钮 -->
    <view class="fab" @click="goNew">
      <svg-icon name="plus" :size="48" color="#ffffff" />
    </view>

    <!-- 设跟进提醒 datetime picker -->
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
  { label: '全部状态', value: '' },
  { label: '潜在', value: 'potential' },
  { label: '意向', value: 'interested' },
  { label: '成交', value: 'signed' },
  { label: '流失', value: 'lost' }
]
const levelOptions = [
  { label: '全部等级', value: '' },
  { label: 'A级', value: 'A' },
  { label: 'B级', value: 'B' },
  { label: 'C级', value: 'C' }
]
const sortOptions = [
  { label: '最近跟进', value: 'last_follow_up_at_desc' },
  { label: '创建时间', value: 'created_at_desc' }
]

const statusIdx = ref(0)
const levelIdx = ref(0)
const sortIdx = ref(0)

const filters = reactive({ q: store.filters.q || '' })

function applyAndRefresh() {
  store.setFilters({
    q: filters.q,
    status: statusOptions[statusIdx.value].value,
    level: levelOptions[levelIdx.value].value
  })
  store.refresh()
}

function onSearch() {
  applyAndRefresh()
}
function onStatusChange(e: any) {
  statusIdx.value = e.detail.value
  applyAndRefresh()
}
function onLevelChange(e: any) {
  levelIdx.value = e.detail.value
  applyAndRefresh()
}
function onSortChange(e: any) {
  sortIdx.value = e.detail.value
  applyAndRefresh()
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

// ===== 设跟进提醒（datetime-picker）=====
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
  // 来自首页快捷入口的 query：?filter=needs_follow_up 等
  try {
    const raw = uni.getStorageSync('quick_entry_query__/pages/customer/list')
    if (raw) {
      uni.removeStorageSync('quick_entry_query__/pages/customer/list')
      const params = new URLSearchParams(raw)
      // 当前已支持的 filter：needs_follow_up（待跟进，按 next_follow_up_at <= 今天 + 排序）
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
.page { padding: 16rpx; padding-bottom: 200rpx; }

.filter-bar {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}
.search-box {
  background: #F2F3F5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  margin-bottom: 12rpx;
}
.search-input {
  height: 64rpx;
  font-size: 26rpx;
}
.filter-row {
  display: flex;
  gap: 12rpx;
}
.filter-pick {
  flex: 1;
  background: #F2F3F5;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: #4E5969;
  display: flex;
  align-items: center;
  justify-content: center;
}
.caret {
  margin-left: 6rpx;
  font-size: 20rpx;
  color: #86909C;
}

.list { padding: 0 8rpx; }
.loading {
  text-align: center;
  padding: 24rpx 0;
  font-size: 24rpx;
  color: #86909C;
}

.fab {
  position: fixed;
  right: 32rpx;
  bottom: 200rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #1677FF;
  color: #ffffff;
  font-size: 56rpx;
  line-height: 96rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(22, 119, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.95); }
}
</style>
