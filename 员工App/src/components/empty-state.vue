<template>
  <view class="empty">
    <view class="empty-icon">
      <svg-icon
        :name="iconName"
        :size="96"
        color="#C9CDD4"
      />
    </view>
    <text class="empty-text">{{ text || '暂无数据' }}</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text?: string; icon?: string }>()

// 全员统一使用 svg-icon。若 props.icon 仍为 emoji（历史调用），转换为合理默认 svg name。
const EMOJI_TO_NAME: Record<string, string> = {
  '📭': 'inbox',
  '📋': 'clipboard-list',
  '🔔': 'bell',
  '🔒': 'lock',
  '📈': 'trending-up',
  '👤': 'user',
  '👥': 'users',
  '📊': 'bar-chart-3',
  '⚙️': 'settings',
  '🔍': 'search',
  '✅': 'check-circle',
  '📷': 'camera',
  '📝': 'share-2'
}

const iconName = computed(() => {
  const v = (props.icon || '').trim()
  if (!v) return 'inbox'
  if (/^[a-z0-9-]+$/i.test(v)) return v
  return EMOJI_TO_NAME[v] || 'inbox'
})
</script>

<style lang="scss" scoped>
.empty {
  padding: 120rpx 40rpx;
  display: flex; flex-direction: column; align-items: center;
  color: #86909C;
}
.empty-icon {
  margin-bottom: 16rpx;
  opacity: 0.85;
  font-size: 96rpx;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-text { font-size: 26rpx; color: #86909C; }
</style>
