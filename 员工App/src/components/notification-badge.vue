<template>
  <view v-if="show" class="badge" :class="{dot: dot}">
    <text v-if="!dot" class="badge-text">{{ display }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  count?: number
  max?: number
  dot?: boolean
}>(), {
  count: 0,
  max: 99,
  dot: false
})

const show = computed(() => (props.count || 0) > 0)
const display = computed(() => {
  const n = props.count || 0
  return n > props.max ? `${props.max}+` : String(n)
})
</script>

<style lang="scss" scoped>
.badge {
  position: absolute;
  top: -8rpx;
  right: -12rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: #F5222D;
  color: #ffffff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
  box-sizing: border-box;
  box-shadow: 0 1rpx 4rpx rgba(245, 34, 45, 0.3);
  border: 2rpx solid #ffffff;
}
.badge.dot {
  width: 16rpx;
  height: 16rpx;
  min-width: 16rpx;
  padding: 0;
  border-radius: 50%;
}
.badge-text { color: #ffffff; }
</style>
