<template>
  <view class="fu card">
    <view class="fu-head">
      <text class="fu-type" :class="'t-' + (followUp.type || 'visit')">{{ typeText }}</text>
      <text class="fu-time">{{ fmtDateTime(followUp.followed_at || followUp.created_at) }}</text>
    </view>
    <view v-if="followUp.customer_name" class="fu-customer">
      客户：{{ followUp.customer_name }}
    </view>
    <view class="fu-content">{{ followUp.content || followUp.summary || '（无内容）' }}</view>
    <view v-if="followUp.next_action_at" class="fu-next">
      下次跟进：{{ fmtDateTime(followUp.next_action_at) }}
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fmtDateTime } from '@/utils/format'

const props = defineProps<{ followUp: any }>()
const typeText = computed(() => {
  const m: Record<string, string> = {
    visit: '到店',
    call: '电话',
    wechat: '微信',
    sms: '短信',
    other: '其他'
  }
  return m[props.followUp?.type] || props.followUp?.type || '跟进'
})
</script>

<style lang="scss" scoped>
.fu {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.99); }
}
.fu-head { display: flex; align-items: center; justify-content: space-between; }
.fu-type {
  font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 8rpx;
  background: #E8F3FF; color: #1677FF;
  &.t-call { background: #F0F9EB; color: #67C23A; }
  &.t-wechat { background: #E1F3D8; color: #07C160; }
  &.t-sms { background: #FDF6EC; color: #E6A23C; }
  &.t-other { background: #F2F3F5; color: #4E5969; }
}
.fu-time { font-size: 22rpx; color: #86909C; }
.fu-customer { margin-top: 12rpx; font-size: 26rpx; color: #4E5969; }
.fu-content {
  margin-top: 12rpx; font-size: 28rpx; color: #1F2329; line-height: 1.6;
}
.fu-next {
  margin-top: 12rpx; font-size: 24rpx; color: #FA8C16;
  background: #FFF7E6; padding: 8rpx 16rpx; border-radius: 8rpx;
  display: inline-block;
}
</style>
