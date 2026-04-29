<template>
  <view class="page">
    <view v-if="loading" class="loading-tip">加载中…</view>
    <view v-else-if="!noti" class="empty-wrap">
      <empty-state text="消息不存在或已被删除" icon="inbox" />
    </view>
    <view v-else class="card">
      <view v-if="isAnnouncement" class="ann-tag">系统公告</view>
      <text class="title">{{ noti.title || typeLabel(noti.type) }}</text>
      <view class="meta">
        <text class="type">{{ typeLabel(noti.type) }}</text>
        <text class="time">{{ fmtDateTime(noti.created_at) }}</text>
      </view>
      <view class="divider" />
      <text class="body">{{ noti.body || '（无内容）' }}</text>
      <view v-if="payloadEntries.length > 0" class="payload">
        <text class="payload-title">附加信息</text>
        <view v-for="kv in payloadEntries" :key="kv[0]" class="kv">
          <text class="k">{{ kv[0] }}</text>
          <text class="v">{{ kv[1] }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as notificationApi from '@/api/notification'
import { useNotificationsStore } from '@/stores/notifications'
import { fmtDateTime } from '@/utils/format'

const noti = ref<any>(null)
const loading = ref(true)
const isAnnouncement = ref(false)
const notiStore = useNotificationsStore()

const payloadEntries = computed<Array<[string, string]>>(() => {
  const p = noti.value?.payload
  if (!p || typeof p !== 'object') return []
  return Object.keys(p).map((k) => [k, typeof p[k] === 'object' ? JSON.stringify(p[k]) : String(p[k])])
})

onLoad(async (q: any) => {
  isAnnouncement.value = q?.type === 'announcement'
  const id = q?.id
  if (!id) {
    loading.value = false
    return
  }
  await load(id)
})

async function load(id: string | number) {
  loading.value = true
  try {
    // 通过 list + only_unread=false 拉一页，匹配 id（通用情况）
    // 优先尝试逐页查；通常详情页是从列表跳来已带数据，这里兜底从 list 中找
    const res: any = await notificationApi.list({ page: 1, page_size: 50 })
    const list = res?.items || res || []
    const found = list.find((x: any) => String(x.id) === String(id))
    if (found) {
      noti.value = found
      if (!found.is_read) {
        try {
          await notificationApi.markRead(found.id)
          found.is_read = true
          notiStore.decrement(1)
        } catch (_) { /* 静默 */ }
      }
    }
  } catch (e) {
    // http.ts 已 toast
  } finally {
    loading.value = false
  }
}

function typeLabel(t: string) {
  switch (t) {
    case 'customer_assigned': return '客户分配'
    case 'customer_transfer_in': return '客户转入'
    case 'customer_transfer_result': return '转出结果'
    case 'customer_modified': return '客户变更'
    case 'follow_up_reminder': return '跟进提醒'
    case 'pending_approval': return '待审批'
    case 'system_announcement': return '系统公告'
    default: return '通知'
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; min-height: 100vh; background: #F5F7FA; }
.loading-tip { text-align: center; font-size: 26rpx; color: #86909C; padding: 80rpx 0; }
.empty-wrap { padding-top: 80rpx; }
.card {
  background: #fff; border-radius: 16rpx; padding: 32rpx;
  display: flex; flex-direction: column; gap: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.ann-tag {
  align-self: flex-start;
  font-size: 22rpx; color: #1677FF; background: #E8F3FF;
  padding: 4rpx 16rpx; border-radius: 20rpx;
}
.title { font-size: 34rpx; font-weight: 600; color: #1F2329; line-height: 1.4; }
.meta { display: flex; gap: 16rpx; align-items: center; }
.type { font-size: 22rpx; color: #1677FF; background: #E8F3FF; padding: 2rpx 12rpx; border-radius: 16rpx; }
.time { font-size: 24rpx; color: #86909C; }
.divider { height: 1rpx; background: #F0F2F5; margin: 8rpx 0; }
.body { font-size: 28rpx; color: #1F2329; line-height: 1.7; word-break: break-all; }
.payload {
  margin-top: 16rpx; background: #F7F8FA; border-radius: 12rpx; padding: 20rpx;
  display: flex; flex-direction: column; gap: 8rpx;
}
.payload-title { font-size: 24rpx; color: #86909C; margin-bottom: 8rpx; }
.kv { display: flex; gap: 16rpx; font-size: 24rpx; }
.k { color: #86909C; min-width: 160rpx; }
.v { color: #1F2329; flex: 1; word-break: break-all; }
</style>
