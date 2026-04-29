<template>
  <view class="ftb-wrapper">
    <view class="ftb-bar">
      <view
        v-for="tab in tabs"
        :key="tab.path"
        class="ftb-item"
        :class="{ active: currentPath === tab.path }"
        @click="onTap(tab)"
      >
        <view class="ftb-icon-wrap">
          <svg-icon
            :name="tab.icon"
            :size="46"
            :color="currentPath === tab.path ? '#1677FF' : '#86909C'"
          />
          <view
            v-if="tab.badge !== undefined && tab.badge > 0"
            class="ftb-badge"
          >{{ tab.badge > 99 ? '99+' : tab.badge }}</view>
          <view v-if="tab.dot" class="ftb-dot" />
        </view>
        <text class="ftb-label" :class="{ active: currentPath === tab.path }">
          {{ tab.label }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SvgIcon from '@/components/svg-icon.vue'
import { useNotificationsStore } from '@/stores/notifications'

const props = defineProps<{ active: string }>()

const notiStore = useNotificationsStore()

const currentPath = computed(() => {
  // 兼容 path 前缀斜杠 / 不带斜杠
  let p = props.active || ''
  if (!p.startsWith('/')) p = '/' + p
  return p
})

const tabs = computed(() => [
  { path: '/pages/home/index', label: '工作台', icon: 'home' },
  { path: '/pages/customer/list', label: '客户', icon: 'users' },
  { path: '/pages/follow-up/list', label: '跟进', icon: 'clipboard-check' },
  { path: '/pages/notification/list', label: '消息', icon: 'bell', badge: notiStore.unreadCount },
  { path: '/pages/me/index', label: '我的', icon: 'user' }
])

function onTap(tab: { path: string; label: string }) {
  if (tab.path === currentPath.value) return
  // tab 切换：用 reLaunch 清空导航栈，模拟原生 tabBar 单页切换体验
  uni.reLaunch({ url: tab.path })
}

onMounted(() => {
  // 进入 tab 页时主动刷新一次未读数（避免显示陈旧 badge）
  try { notiStore.refreshUnread() } catch (_) { /* */ }
})
</script>

<style lang="scss" scoped>
.ftb-wrapper {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 99;
  pointer-events: none;
}
.ftb-bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 12rpx 8rpx;
  box-shadow:
    0 8rpx 24rpx rgba(22, 119, 255, 0.08),
    0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.ftb-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8rpx 0;
  border-radius: 24rpx;
  transition: background 0.18s ease, transform 0.15s ease;
  &:active { transform: scale(0.94); }
  &.active {
    background: rgba(22, 119, 255, 0.08);
  }
}
.ftb-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
}
.ftb-badge {
  position: absolute;
  top: -6rpx;
  right: -10rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: #F53F3F;
  color: #FFFFFF;
  font-size: 20rpx;
  line-height: 30rpx;
  text-align: center;
  box-shadow: 0 0 0 3rpx #FFFFFF;
}
.ftb-dot {
  position: absolute;
  top: 4rpx;
  right: 6rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #F53F3F;
  box-shadow: 0 0 0 3rpx #FFFFFF;
}
.ftb-label {
  margin-top: 2rpx;
  font-size: 20rpx;
  color: #86909C;
  transition: color 0.18s ease;
  &.active {
    color: #1677FF;
    font-weight: 600;
  }
}
</style>
