<template>
  <view class="cf-row">
    <view class="cf-label">{{ label }}</view>
    <view class="cf-cells">
      <view class="cf-cell mine">
        <view class="cf-tag mine">我的</view>
        <view class="cf-val">{{ display(mine) }}</view>
      </view>
      <view class="cf-cell server">
        <view class="cf-tag server">服务器</view>
        <view class="cf-val">{{ display(server) }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  field: string
  label: string
  mine: any
  server: any
}>()

function display(v: any): string {
  if (v == null || v === '') return '（空）'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch (e) { return String(v) }
  }
  return String(v)
}
</script>

<style lang="scss" scoped>
.cf-row {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cf-label {
  font-size: 26rpx;
  color: #4E5969;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.cf-cells {
  display: flex;
  gap: 16rpx;
}
.cf-cell {
  flex: 1;
  min-width: 0;
  border-radius: 8rpx;
  padding: 16rpx;
  background: #FFFBE6;
  border: 1rpx solid #FFE58F;
}
.cf-cell.server {
  background: #E6F4FF;
  border-color: #91D5FF;
}
.cf-tag {
  display: inline-block;
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
}
.cf-tag.mine { background: #FAAD14; color: #ffffff; }
.cf-tag.server { background: #1677FF; color: #ffffff; }
.cf-val {
  font-size: 28rpx;
  color: #1F2329;
  word-break: break-all;
  line-height: 1.5;
}
</style>
