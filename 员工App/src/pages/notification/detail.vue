<template>
  <view class="page">
    <view v-if="loading" class="loading-tip">加载中…</view>
    <view v-else-if="!noti" class="empty-wrap">
      <empty-state text="消息不存在或已被删除" icon="inbox" />
    </view>
    <view v-else>
      <!-- Hero -->
      <view class="hero" :class="`hero-${typeColor(noti.type)}`">
        <view class="hero-icon">
          <svg-icon :name="typeIcon(noti.type)" :size="44" color="#ffffff" />
        </view>
        <view class="hero-tag" v-if="isAnnouncement">系统公告</view>
        <view class="hero-tag" v-else>{{ typeLabel(noti.type) }}</view>
        <view class="hero-title">{{ noti.title || typeLabel(noti.type) }}</view>
        <view class="hero-time">{{ fmtDateTime(noti.created_at) }}</view>
      </view>

      <!-- 正文 -->
      <view class="section">
        <view class="section-card">
          <view class="content-text">{{ noti.body || '（无内容）' }}</view>
        </view>
      </view>

      <!-- 附加信息 -->
      <view v-if="payloadEntries.length > 0" class="section">
        <view class="section-title">附加信息</view>
        <view class="section-card">
          <view v-for="(kv, i) in payloadEntries" :key="kv[0]" class="kv">
            <text class="k">{{ kv[0] }}</text>
            <text class="v">{{ kv[1] }}</text>
            <view v-if="i < payloadEntries.length - 1" class="kv-divider" />
          </view>
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
import SvgIcon from '@/components/svg-icon.vue'

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
        } catch (_) { /* */ }
      }
    }
  } catch (e) { /* */ } finally {
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

function typeColor(t: string) {
  switch (t) {
    case 'customer_assigned':
    case 'customer_transfer_in': return 'green'
    case 'customer_transfer_result': return 'blue'
    case 'customer_modified':
    case 'customer_updated': return 'purple'
    case 'follow_up_reminder': return 'orange'
    case 'follow_up_shared': return 'blue'
    case 'pending_approval': return 'red'
    case 'system_announcement': return 'gray'
    default: return 'gray'
  }
}

function typeIcon(t: string) {
  switch (t) {
    case 'customer_assigned':
    case 'customer_transfer_in':
    case 'customer_transfer_result': return 'users'
    case 'customer_modified':
    case 'customer_updated': return 'edit-3'
    case 'follow_up_reminder': return 'alarm-clock'
    case 'follow_up_shared': return 'share-2'
    case 'pending_approval': return 'clipboard-check'
    case 'system_announcement': return 'bell'
    default: return 'bell'
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 80rpx;
}

.loading-tip {
  text-align: center;
  font-size: 26rpx;
  color: #86909C;
  padding: 80rpx 0;
}
.empty-wrap { padding-top: 80rpx; }

.hero {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  padding: 56rpx 32rpx 56rpx;
  border-radius: 0 0 32rpx 32rpx;
  color: #ffffff;
  text-align: center;
  margin-bottom: -28rpx;
}
.hero-blue { background: linear-gradient(135deg, #1677FF, #4096FF); }
.hero-orange { background: linear-gradient(135deg, #FA8C16, #FFB264); }
.hero-green { background: linear-gradient(135deg, #00B42A, #4ED365); }
.hero-purple { background: linear-gradient(135deg, #722ED1, #9254DE); }
.hero-red { background: linear-gradient(135deg, #F53F3F, #FF7875); }
.hero-gray { background: linear-gradient(135deg, #4E5969, #86909C); }

.hero-icon {
  width: 112rpx; height: 112rpx;
  margin: 0 auto 20rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.22);
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-tag {
  display: inline-block;
  padding: 4rpx 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  font-size: 22rpx;
}
.hero-title {
  margin-top: 16rpx;
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.4;
  color: #ffffff;
}
.hero-time {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
}

.section {
  padding: 24rpx;
  position: relative;
  z-index: 1;
}
.section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.section-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.content-text {
  font-size: 28rpx;
  color: #1F2329;
  line-height: 1.7;
  word-break: break-all;
  white-space: pre-wrap;
}

.kv {
  position: relative;
  display: flex;
  gap: 16rpx;
  font-size: 24rpx;
  padding: 16rpx 0;
}
.k { color: #86909C; min-width: 160rpx; flex-shrink: 0; }
.v { color: #1F2329; flex: 1; word-break: break-all; }
.kv-divider {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1rpx;
  background: #F2F3F5;
}
</style>
