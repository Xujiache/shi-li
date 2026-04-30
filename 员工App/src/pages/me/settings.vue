<template>
  <view class="page">
    <view class="section">
      <view class="section-title">消息通知</view>
      <view class="section-card">
        <view class="row">
          <view class="row-icon mi-orange">
            <svg-icon name="alarm-clock" :size="28" color="#FA8C16" />
          </view>
          <view class="row-text">
            <text class="row-label">跟进提醒</text>
            <text class="row-hint">客户到期跟进时弹窗推送</text>
          </view>
          <switch :checked="notif.follow_up" color="#1677FF" @change="onToggle('follow_up', $event)" />
        </view>
        <view class="row">
          <view class="row-icon mi-blue">
            <svg-icon name="users" :size="28" color="#1677FF" />
          </view>
          <view class="row-text">
            <text class="row-label">转入提醒</text>
            <text class="row-hint">同事将客户转给你时通知</text>
          </view>
          <switch :checked="notif.transfer" color="#1677FF" @change="onToggle('transfer', $event)" />
        </view>
        <view class="row">
          <view class="row-icon mi-purple">
            <svg-icon name="bell" :size="28" color="#722ED1" />
          </view>
          <view class="row-text">
            <text class="row-label">公告提醒</text>
            <text class="row-hint">系统公告与重要通知</text>
          </view>
          <switch :checked="notif.announcement" color="#1677FF" @change="onToggle('announcement', $event)" />
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">存储</view>
      <view class="section-card">
        <view class="row tap" @click="onClearCache">
          <view class="row-icon mi-gray">
            <svg-icon name="refresh-cw" :size="28" color="#4E5969" />
          </view>
          <view class="row-text">
            <text class="row-label">清除缓存</text>
            <text class="row-hint">登录态会保留</text>
          </view>
          <text class="row-extra">{{ cacheSize }}</text>
          <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">关于</view>
      <view class="section-card">
        <view class="row">
          <text class="row-label">版本号</text>
          <text class="row-extra">{{ appVersion }}</text>
        </view>
        <view class="row">
          <text class="row-label">公司</text>
          <text class="row-extra">视力健康管理平台</text>
        </view>
      </view>
      <view class="about-text">本应用由公司内部研发，仅供内部员工使用。如有问题请联系管理员。</view>
    </view>

    <view class="logout-wrap">
      <view class="btn-logout" @click="onLogout">退出登录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { logout } from '@/api/employee'
import SvgIcon from '@/components/svg-icon.vue'

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
    if (v && typeof v === 'object') Object.assign(notif, v)
    else if (typeof v === 'string' && v) {
      try { Object.assign(notif, JSON.parse(v)) } catch {}
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
    const size = info?.currentSize ?? 0
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
      try { await logout() } catch (e) { /* */ }
      auth.clear()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
}

function readVersion() {
  try {
    const sys: any = uni.getSystemInfoSync()
    const v = sys?.appVersion || sys?.appWgtVersion
    if (v) appVersion.value = String(v).startsWith('v') ? String(v) : `v${v}`
  } catch { /* */ }
}

onMounted(() => {
  loadNotif()
  refreshCacheSize()
  readVersion()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 80rpx;
}

.section { margin: 24rpx 24rpx 0; }
.section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.section-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 0;
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 88rpx;
    right: 0;
    height: 1rpx;
    background: #F2F3F5;
  }
  &:last-child::after { display: none; }
  &.tap:active { background: #F8F9FB; }
}
.row-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mi-blue { background: #E8F3FF; }
.mi-orange { background: #FFF4E6; }
.mi-purple { background: #F4ECFF; }
.mi-gray { background: #F2F3F5; }
.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.row-label {
  font-size: 28rpx;
  color: #1F2329;
  font-weight: 500;
}
.row-hint {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #86909C;
}
.row-extra {
  font-size: 24rpx;
  color: #86909C;
}

.about-text {
  margin-top: 12rpx;
  padding: 0 8rpx;
  font-size: 22rpx;
  color: #86909C;
  line-height: 1.6;
}

.logout-wrap { margin: 32rpx 24rpx 0; }
.btn-logout {
  background: #ffffff;
  color: #F53F3F;
  border-radius: 24rpx;
  padding: 30rpx 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
  transition: all 0.15s;
  &:active { background: #FFF1F0; transform: scale(0.99); }
}
</style>
