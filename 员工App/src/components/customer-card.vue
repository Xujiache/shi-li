<template>
  <view class="cc card" @click="onTap">
    <view class="cc-row">
      <view class="cc-avatar">{{ initial }}</view>
      <view class="cc-main">
        <view class="cc-name-row">
          <text class="cc-name">{{ customer.display_name || customer.name || '未命名客户' }}</text>
          <text v-if="customer.level" class="cc-tag" :class="'lvl-' + customer.level">{{ levelText }}</text>
        </view>
        <view class="cc-sub">
          <text class="cc-phone">{{ phoneMasked }}</text>
          <text v-if="customer.status" class="cc-status">· {{ statusText }}</text>
        </view>
        <view v-if="customer.last_follow_up_at" class="cc-meta">
          上次跟进：{{ fmtRelativeTime(customer.last_follow_up_at) }}
        </view>
        <view v-if="customer.next_follow_up_at" class="cc-meta cc-next">
          下次跟进：{{ fmtDateTime(customer.next_follow_up_at) }}
          <text v-if="overdue" class="cc-overdue">已逾期</text>
        </view>
      </view>
      <view class="cc-actions">
        <view class="cc-btn" @click.stop="onCall">呼叫</view>
        <view class="cc-btn ghost" @click.stop="onMore">更多</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fmtPhone, fmtRelativeTime, fmtDateTime } from '@/utils/format'

const props = defineProps<{ customer: any }>()
const emit = defineEmits<{
  (e: 'tap', c: any): void
  (e: 'call', c: any): void
  (e: 'more', c: any): void
}>()

const initial = computed(() => {
  const name = String(props.customer?.display_name || props.customer?.name || '').trim()
  return name ? name.charAt(0) : '?'
})
const phoneMasked = computed(() => fmtPhone(props.customer?.phone))
const statusText = computed(() => {
  // 后端 enum：potential / interested / signed / lost
  const m: Record<string, string> = {
    potential: '潜在',
    interested: '意向',
    signed: '成交',
    lost: '流失',
    // 兼容历史：active / inactive / intent / deal
    active: '活跃',
    inactive: '沉默',
    intent: '有意向',
    deal: '已成交'
  }
  return m[props.customer?.status] || props.customer?.status || ''
})
const levelText = computed(() => {
  const m: Record<string, string> = { A: 'A级', B: 'B级', C: 'C级', D: 'D级' }
  return m[props.customer?.level] || props.customer?.level || ''
})
const overdue = computed(() => {
  const t = props.customer?.next_follow_up_at
  if (!t) return false
  const ts = new Date(String(t).replace(' ', 'T')).getTime()
  return Number.isFinite(ts) && ts < Date.now()
})

function onTap() { emit('tap', props.customer) }
function onCall() { emit('call', props.customer) }
function onMore() { emit('more', props.customer) }
</script>

<style lang="scss" scoped>
.cc {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.99); }
}
.cc-row { display: flex; align-items: flex-start; }
.cc-avatar {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: #E8F3FF; color: #1677FF;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.cc-main { flex: 1; min-width: 0; }
.cc-name-row { display: flex; align-items: center; }
.cc-name {
  font-size: 30rpx; color: #1F2329; font-weight: 600;
  max-width: 280rpx;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.cc-tag {
  margin-left: 12rpx;
  font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 8rpx;
  background: #F2F3F5; color: #4E5969;
  &.lvl-A { background: #FFF1F0; color: #F5222D; }
  &.lvl-B { background: #FFF7E6; color: #FA8C16; }
  &.lvl-C { background: #E8F3FF; color: #1677FF; }
}
.cc-sub { margin-top: 8rpx; font-size: 24rpx; color: #86909C; }
.cc-phone { letter-spacing: 1rpx; }
.cc-status { margin-left: 4rpx; }
.cc-meta { margin-top: 6rpx; font-size: 22rpx; color: #C9CDD4; }
.cc-next { color: #4E5969; }
.cc-overdue { margin-left: 8rpx; color: #F5222D; font-weight: 600; }
.cc-actions {
  display: flex; flex-direction: column; align-items: stretch;
  margin-left: 16rpx; flex-shrink: 0;
}
.cc-btn {
  font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 8rpx;
  background: #1677FF; color: #ffffff; text-align: center;
  margin-bottom: 8rpx;
  &:active { opacity: 0.85; }
  &.ghost { background: #F2F3F5; color: #4E5969; margin-bottom: 0; }
}
</style>
