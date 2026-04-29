<template>
  <view class="page">
    <view class="topbar">
      <scroll-view class="chips" scroll-x>
        <view
          v-for="c in chips"
          :key="c.key"
          class="chip"
          :class="{ active: filter === c.key }"
          @tap="onFilterChange(c.key)"
        >{{ c.label }}</view>
      </scroll-view>
      <view class="actions">
        <text class="act-btn" @tap="onMarkAllRead">全部已读</text>
        <text class="act-btn danger" @tap="onClearRead">清空已读</text>
      </view>
    </view>

    <view v-if="items.length === 0 && !loading" class="empty-wrap">
      <empty-state text="暂无消息" icon="bell" />
    </view>
    <view v-else class="list">
      <view
        v-for="it in items"
        :key="it.id"
        class="item"
        :class="{ unread: !it.is_read }"
        @tap="onItemTap(it)"
      >
        <view class="dot-wrap">
          <view v-if="!it.is_read" class="dot" />
        </view>
        <view class="body">
          <view class="row top">
            <text class="title">{{ it.title || typeLabel(it.type) }}</text>
            <text class="time">{{ fmtRelativeTime(it.created_at) }}</text>
          </view>
          <text class="summary">{{ it.body || '—' }}</text>
          <view class="row meta">
            <text class="type-tag">{{ typeLabel(it.type) }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="loading-tip">加载中…</view>
      <view v-else-if="!hasMore && items.length > 0" class="loading-tip">— 没有更多了 —</view>
    </view>

    <floating-tabbar active="/pages/notification/list" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import * as notificationApi from '@/api/notification'
import { useNotificationsStore } from '@/stores/notifications'
import { fmtRelativeTime } from '@/utils/format'

const notiStore = useNotificationsStore()

const chips = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'transfer', label: '转出审批' },
  { key: 'assigned', label: '客户分配' },
  { key: 'follow_up', label: '跟进提醒' }
]
const filter = ref<'all' | 'unread' | 'transfer' | 'assigned' | 'follow_up'>('all')

const rawItems = ref<any[]>([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(true)
const loading = ref(false)

const items = computed(() => {
  const list = rawItems.value
  switch (filter.value) {
    case 'unread': return list.filter((i) => !i.is_read)
    case 'transfer': return list.filter((i) => i.type === 'pending_approval' || i.type === 'customer_transfer_result' || i.type === 'customer_transfer_in')
    case 'assigned': return list.filter((i) =>
      i.type === 'customer_assigned'
      || i.type === 'customer_modified'
      || i.type === 'customer_updated'
    )
    case 'follow_up': return list.filter((i) =>
      i.type === 'follow_up_reminder' || i.type === 'follow_up_shared'
    )
    default: return list
  }
})

onShow(() => {
  // 来自首页快捷入口的 query：?type=todo 等
  try {
    const raw = uni.getStorageSync('quick_entry_query__/pages/notification/list')
    if (raw) {
      uni.removeStorageSync('quick_entry_query__/pages/notification/list')
      const params = new URLSearchParams(raw)
      const t = params.get('type')
      if (t === 'todo') {
        // "待办" 默认切到未读
        filter.value = 'unread'
      } else if (t) {
        filter.value = t
      }
    }
  } catch (_) { /* */ }
  reload()
})

function onFilterChange(k: any) {
  filter.value = k
  if (k === 'unread' && rawItems.value.filter((i) => !i.is_read).length === 0) {
    reload()
  }
}

async function reload() {
  page.value = 1
  hasMore.value = true
  rawItems.value = []
  await fetchPage()
}

async function fetchPage() {
  if (!hasMore.value || loading.value) return
  loading.value = true
  try {
    const params: any = { page: page.value, page_size: pageSize }
    if (filter.value === 'unread') params.only_unread = true
    const res: any = await notificationApi.list(params)
    const list = res?.items || res || []
    if (page.value === 1) rawItems.value = list
    else rawItems.value = rawItems.value.concat(list)
    const total = res?.total ?? rawItems.value.length
    hasMore.value = rawItems.value.length < total && list.length > 0
    if (list.length < pageSize) hasMore.value = false
    page.value += 1
  } catch (e) {
    // http.ts 已处理
  } finally {
    loading.value = false
  }
}

onPullDownRefresh(async () => {
  await reload()
  await notiStore.refreshUnread()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  if (hasMore.value && !loading.value) fetchPage()
})

async function onItemTap(it: any) {
  if (!it.is_read) {
    try {
      await notificationApi.markRead(it.id)
      it.is_read = true
      it.read_at = new Date().toISOString()
      notiStore.decrement(1)
    } catch (e) {
      // 静默
    }
  }
  routeByType(it)
}

function routeByType(it: any) {
  const t = it.type
  const payload = it.payload || {}
  if (
    t === 'customer_assigned'
    || t === 'customer_modified'
    || t === 'customer_updated'
    || t === 'customer_transfer_in'
  ) {
    if (payload.customer_id) {
      uni.navigateTo({ url: `/pages/customer/detail?id=${payload.customer_id}` })
    }
  } else if (t === 'follow_up_shared') {
    if (payload.follow_up_id) {
      uni.navigateTo({ url: `/pages/follow-up/detail?id=${payload.follow_up_id}` })
    } else if (payload.customer_id) {
      uni.navigateTo({ url: `/pages/customer/detail?id=${payload.customer_id}&tab=follow_up` })
    }
  } else if (t === 'customer_transfer_result') {
    uni.navigateTo({ url: '/pages/transfer/mine' })
  } else if (t === 'pending_approval') {
    uni.navigateTo({ url: '/pages/transfer/pending' })
  } else if (t === 'follow_up_reminder') {
    if (payload.customer_id) {
      uni.navigateTo({ url: `/pages/customer/detail?id=${payload.customer_id}&tab=follow_up` })
    }
  } else if (t === 'system_announcement') {
    uni.navigateTo({ url: `/pages/notification/detail?id=${it.id}&type=announcement` })
  } else {
    uni.navigateTo({ url: `/pages/notification/detail?id=${it.id}` })
  }
}

async function onMarkAllRead() {
  try {
    await notificationApi.markAllRead()
    rawItems.value = rawItems.value.map((i) => ({ ...i, is_read: true, read_at: i.read_at || new Date().toISOString() }))
    notiStore.clear()
    uni.showToast({ title: '已全部标记已读', icon: 'success' })
  } catch (e) {
    // http.ts 已 toast
  }
}

function onClearRead() {
  uni.showModal({
    title: '清空已读消息',
    content: '此操作将删除所有已读消息，无法恢复。是否继续？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await notificationApi.clearRead()
        rawItems.value = rawItems.value.filter((i) => !i.is_read)
        uni.showToast({ title: '已清空', icon: 'success' })
      } catch (e) {
        // http.ts 已 toast
      }
    }
  })
}

function typeLabel(t: string) {
  switch (t) {
    case 'customer_assigned': return '客户分配'
    case 'customer_transfer_in': return '客户转入'
    case 'customer_transfer_result': return '转出结果'
    case 'customer_modified': return '客户变更'
    case 'customer_updated': return '客户变更'
    case 'follow_up_reminder': return '跟进提醒'
    case 'follow_up_shared': return '跟进分享'
    case 'pending_approval': return '待审批'
    case 'system_announcement': return '系统公告'
    default: return '通知'
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #F5F7FA; padding-bottom: 200rpx; }
.topbar {
  background: #fff; padding: 16rpx 24rpx; position: sticky; top: 0; z-index: 10;
  display: flex; flex-direction: column; gap: 12rpx;
  border-bottom: 1rpx solid #F0F2F5;
}
.chips { white-space: nowrap; }
.chip {
  display: inline-block; padding: 8rpx 24rpx; margin-right: 12rpx;
  background: #F2F3F5; color: #4E5969; border-radius: 28rpx; font-size: 24rpx;
  &.active { background: #1677FF; color: #fff; }
}
.actions { display: flex; gap: 24rpx; justify-content: flex-end; }
.act-btn {
  font-size: 24rpx; color: #1677FF;
  &.danger { color: #F53F3F; }
}
.empty-wrap { padding-top: 80rpx; }
.list { padding: 20rpx 24rpx; display: flex; flex-direction: column; gap: 16rpx; }
.item {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  display: flex; gap: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &.unread { background: #F0F7FF; }
}
.dot-wrap { width: 16rpx; padding-top: 12rpx; }
.dot {
  width: 16rpx; height: 16rpx; border-radius: 50%; background: #F53F3F;
}
.body { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.row.top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 28rpx; font-weight: 600; color: #1F2329; }
.time { font-size: 22rpx; color: #86909C; }
.summary {
  font-size: 26rpx; color: #4E5969; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.row.meta { padding-top: 4rpx; }
.type-tag {
  font-size: 22rpx; color: #1677FF; background: #E8F3FF;
  padding: 2rpx 12rpx; border-radius: 16rpx;
}
.loading-tip { text-align: center; font-size: 24rpx; color: #86909C; padding: 24rpx 0; }
</style>
