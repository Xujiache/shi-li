<template>
  <view class="sync" :class="dotClass" @click="onTap">
    <view class="dot" :class="dotClass" />
    <svg-icon
      v-if="isSyncing"
      class="sync-svg"
      name="refresh-cw"
      :size="22"
      color="#ffffff"
    />
    <text class="label">{{ label }}</text>
    <text v-if="sync.conflictCount > 0" class="badge">{{ sync.conflictCount }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
const isOnline = ref<boolean>(true)

const isSyncing = computed(() => isOnline.value && sync.state === 'syncing')

const dotClass = computed(() => {
  if (!isOnline.value) return 'offline'
  if (sync.state === 'failed' || sync.conflictCount > 0 || sync.pendingCount > 5) return 'red'
  if (sync.state === 'syncing') return 'yellow'
  if (sync.state === 'idle' && sync.pendingCount === 0) return 'green'
  // 中间态：有 pending 但不在 syncing
  if (sync.pendingCount > 0) return 'yellow'
  return 'green'
})

const label = computed(() => {
  if (!isOnline.value) return '离线'
  if (sync.conflictCount > 0) return `冲突 ${sync.conflictCount}`
  if (sync.state === 'syncing') return '同步中'
  if (sync.state === 'failed') return '同步失败'
  if (sync.pendingCount > 0) return `待同步 ${sync.pendingCount}`
  return '已同步'
})

function refresh() {
  uni.getNetworkType({
    success: (res) => {
      isOnline.value = !!res.networkType && res.networkType !== 'none'
    }
  })
}

let unbind: (() => void) | null = null

onMounted(() => {
  refresh()
  const cb = (res: any) => { isOnline.value = !!res?.isConnected }
  try {
    uni.onNetworkStatusChange(cb)
    unbind = () => {
      try { (uni as any).offNetworkStatusChange?.(cb) } catch {}
    }
  } catch (e) {
    // 静默
  }
})

onUnmounted(() => {
  if (unbind) unbind()
})

function onTap() {
  uni.navigateTo({ url: '/pages/me/sync-status' })
}
</script>

<style lang="scss" scoped>
.sync {
  display: inline-flex;
  align-items: center;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.15);
  position: relative;
}
.sync .dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}
.sync .dot.green { background: #52C41A; }
.sync .dot.yellow { background: #FAAD14; animation: blink 1s infinite; }
.sync .dot.red { background: #FF4D4F; }
.sync .dot.offline { background: #C9CDD4; }
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.label {
  color: #ffffff;
}
.sync.green .label { color: #ffffff; }
.sync.yellow .label { color: #ffffff; }
.sync.red .label { color: #ffffff; }
.sync.offline .label { color: #C9CDD4; }

.sync-svg {
  margin-right: 6rpx;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.badge {
  margin-left: 8rpx;
  background: #FF4D4F;
  color: #ffffff;
  font-size: 20rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  line-height: 28rpx;
  min-width: 28rpx;
  text-align: center;
}
</style>
