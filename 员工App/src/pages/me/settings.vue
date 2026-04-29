<template>
  <view class="settings-page">
    <!-- 通知开关 -->
    <view class="card section">
      <view class="section-title">消息通知</view>
      <view class="row">
        <text class="row-label">跟进提醒</text>
        <switch :checked="notif.follow_up" color="#1677FF" @change="onToggle('follow_up', $event)" />
      </view>
      <view class="row">
        <text class="row-label">转入提醒</text>
        <switch :checked="notif.transfer" color="#1677FF" @change="onToggle('transfer', $event)" />
      </view>
      <view class="row">
        <text class="row-label">公告提醒</text>
        <switch :checked="notif.announcement" color="#1677FF" @change="onToggle('announcement', $event)" />
      </view>
    </view>

    <!-- 缓存 -->
    <view class="card section">
      <view class="section-title">存储</view>
      <view class="row tap" @click="onClearCache">
        <text class="row-label">清除缓存</text>
        <text class="row-extra">{{ cacheSize }}</text>
        <view class="row-arrow">
          <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
        </view>
      </view>
    </view>

    <!-- 关于 -->
    <view class="card section">
      <view class="section-title">关于</view>
      <view class="row">
        <text class="row-label">版本号</text>
        <text class="row-value">{{ appVersion }}</text>
      </view>
      <view class="row">
        <text class="row-label">公司</text>
        <text class="row-value">视力健康管理平台</text>
      </view>
      <view class="about-text">
        本应用由公司内部研发，仅供内部员工使用。如有问题请联系管理员。
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-wrap">
      <view class="btn-logout" @click="onLogout">退出登录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { logout } from '@/api/employee'

const auth = useAuthStore()

const NOTIF_KEY = 'notif_settings'
const TOKEN_KEY = 'emp_token'
const EMPLOYEE_KEY = 'emp_profile'
const KEEP_KEYS = [TOKEN_KEY, EMPLOYEE_KEY, NOTIF_KEY]

interface NotifSettings {
  follow_up: boolean
  transfer: boolean
  announcement: boolean
}

const notif = reactive<NotifSettings>({
  follow_up: true,
  transfer: true,
  announcement: true
})

const cacheSize = ref('')
const appVersion = ref('v1.0.0')

function loadNotif() {
  try {
    const v = uni.getStorageSync(NOTIF_KEY)
    if (v && typeof v === 'object') {
      Object.assign(notif, v)
    } else if (typeof v === 'string' && v) {
      try {
        Object.assign(notif, JSON.parse(v))
      } catch {}
    }
  } catch {}
}

function persistNotif() {
  uni.setStorageSync(NOTIF_KEY, { ...notif })
}

function onToggle(key: keyof NotifSettings, e: any) {
  notif[key] = !!e?.detail?.value
  persistNotif()
}

function refreshCacheSize() {
  try {
    const info = uni.getStorageInfoSync()
    const size = info?.currentSize ?? 0 // KB
    cacheSize.value = size > 1024 ? `${(size / 1024).toFixed(1)} MB` : `${size} KB`
  } catch {
    cacheSize.value = ''
  }
}

function onClearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将清除本地缓存（登录态与通知设置保留），确定继续？',
    success: (r) => {
      if (!r.confirm) return
      try {
        const info = uni.getStorageInfoSync()
        const keys: string[] = info?.keys || []
        keys.forEach((k) => {
          if (!KEEP_KEYS.includes(k)) {
            try { uni.removeStorageSync(k) } catch {}
          }
        })
        uni.showToast({ title: '已清除', icon: 'success' })
        refreshCacheSize()
      } catch (e) {
        uni.showToast({ title: '清除失败', icon: 'none' })
      }
    }
  })
}

function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await logout()
      } catch (e) {
        // 忽略后端错误，强制清本地
      }
      auth.clear()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
}

function readVersion() {
  try {
    const sys: any = uni.getSystemInfoSync()
    const v = sys?.appVersion || sys?.appWgtVersion
    if (v) {
      appVersion.value = String(v).startsWith('v') ? String(v) : `v${v}`
    }
  } catch {
    // keep default
  }
}

onMounted(() => {
  loadNotif()
  refreshCacheSize()
  readVersion()
})
</script>

<style lang="scss" scoped>
.settings-page {
  padding: 24rpx;
  min-height: 100vh;
}

.section {
  padding: 0;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-bottom: 16rpx;
}
.section-title {
  font-size: 24rpx;
  color: #86909C;
  padding: 20rpx 24rpx 8rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-top: 1rpx solid #F2F3F5;
  position: relative;

  &:first-of-type {
    border-top: none;
  }
}
.row.tap:active {
  background: #F7F8FA;
}
.row-label {
  flex: 1;
  font-size: 28rpx;
  color: #1F2329;
}
.row-extra {
  font-size: 24rpx;
  color: #86909C;
  margin-right: 8rpx;
}
.row-value {
  font-size: 26rpx;
  color: #4E5969;
}
.row-arrow {
  margin-left: 4rpx;
  display: flex;
  align-items: center;
}

.about-text {
  font-size: 24rpx;
  color: #86909C;
  padding: 16rpx 24rpx 24rpx;
  line-height: 1.6;
}

.logout-wrap {
  margin-top: 32rpx;
}
.btn-logout {
  background: #ffffff;
  color: #FF4D4F;
  border-radius: 16rpx;
  padding: 28rpx 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  transition: opacity 0.15s, transform 0.15s, background 0.15s;

  &:active {
    background: #FFF1F0;
    opacity: 0.85;
    transform: scale(0.98);
  }
}
</style>
