<template>
  <view class="me-page">
    <!-- ===== 顶部用户卡 ===== -->
    <view class="header">
      <view class="header-bg-deco" />
      <view class="header-content">
        <view class="avatar-wrap">
          <image
            v-if="auth.employee?.avatar_url"
            class="avatar"
            :src="auth.employee.avatar_url"
            mode="aspectFill"
          />
          <view v-else class="avatar avatar-fallback">{{ avatarInitial }}</view>
        </view>
        <view class="info">
          <view class="name-row">
            <text class="name">{{ auth.employee?.display_name || '员工' }}</text>
            <text class="role-badge" :class="roleBadgeClass">{{ roleLabel }}</text>
          </view>
          <view class="dept" v-if="departmentLabel">
            <svg-icon name="users" :size="22" color="rgba(255,255,255,0.85)" />
            <text>{{ departmentLabel }}</text>
          </view>
          <view class="phone">
            <svg-icon name="phone" :size="22" color="rgba(255,255,255,0.85)" />
            <text>{{ phoneMasked }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== 菜单分组 ===== -->
    <view class="menu-section">
      <view class="menu-group-title">账号</view>
      <view class="menu-group card">
        <view
          v-for="(it, i) in groupAccount"
          :key="it.key"
          class="menu-item"
          @click="go(it.url)"
        >
          <view class="menu-icon" :class="`mi-${it.tone}`">
            <svg-icon :name="it.icon" :size="34" :color="iconColor(it.tone)" />
          </view>
          <view class="menu-text">
            <text class="menu-label">{{ it.label }}</text>
            <text v-if="it.hint" class="menu-hint">{{ it.hint }}</text>
          </view>
          <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          <view v-if="i < groupAccount.length - 1" class="menu-divider" />
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-group-title">工具</view>
      <view class="menu-group card">
        <view
          v-for="(it, i) in groupTools"
          :key="it.key"
          class="menu-item"
          @click="go(it.url)"
        >
          <view class="menu-icon" :class="`mi-${it.tone}`">
            <svg-icon :name="it.icon" :size="34" :color="iconColor(it.tone)" />
          </view>
          <view class="menu-text">
            <text class="menu-label">{{ it.label }}</text>
            <text v-if="it.hint" class="menu-hint">{{ it.hint }}</text>
          </view>
          <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          <view v-if="i < groupTools.length - 1" class="menu-divider" />
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-group-title">安全</view>
      <view class="menu-group card">
        <view
          v-for="(it, i) in groupSecurity"
          :key="it.key"
          class="menu-item"
          @click="go(it.url)"
        >
          <view class="menu-icon" :class="`mi-${it.tone}`">
            <svg-icon :name="it.icon" :size="34" :color="iconColor(it.tone)" />
          </view>
          <view class="menu-text">
            <text class="menu-label">{{ it.label }}</text>
            <text v-if="it.hint" class="menu-hint">{{ it.hint }}</text>
          </view>
          <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          <view v-if="i < groupSecurity.length - 1" class="menu-divider" />
        </view>
      </view>
    </view>

    <!-- ===== 退出登录 ===== -->
    <view class="logout-wrap">
      <view class="btn-logout" @click="onLogout">退出登录</view>
    </view>

    <view class="footer-text">视力管理 · 员工版</view>

    <floating-tabbar active="/pages/me/index" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { logout, getMe } from '@/api/employee'
import { fmtPhone } from '@/utils/format'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()

interface MenuItem {
  key: string
  label: string
  hint?: string
  icon: string
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'gray' | 'red'
  url: string
}

const groupAccount: MenuItem[] = [
  { key: 'profile', label: '个人信息', hint: '头像 / 姓名 / 联系方式', icon: 'user', tone: 'blue', url: '/pages/me/profile' },
  { key: 'team', label: '我的团队', hint: '部门成员与归属', icon: 'users', tone: 'purple', url: '/pages/me/team' }
]
const groupTools: MenuItem[] = [
  { key: 'stats', label: '数据统计', hint: '客户 / 跟进概览', icon: 'bar-chart-3', tone: 'orange', url: '/pages/me/stats' },
  { key: 'sync', label: '同步状态', hint: '本地未上传操作', icon: 'refresh-cw', tone: 'green', url: '/pages/me/sync-status' },
  { key: 'settings', label: '设置', icon: 'settings', tone: 'gray', url: '/pages/me/settings' }
]
const groupSecurity: MenuItem[] = [
  { key: 'pwd', label: '修改密码', icon: 'lock', tone: 'red', url: '/pages/login/change-password' }
]

function iconColor(tone: string) {
  return ({
    blue: '#1677FF',
    green: '#00B42A',
    orange: '#FA8C16',
    purple: '#722ED1',
    gray: '#4E5969',
    red: '#F53F3F'
  } as any)[tone] || '#1677FF'
}

const avatarInitial = computed(() => {
  const n = auth.employee?.display_name || ''
  return n ? n.slice(0, 1).toUpperCase() : '员'
})

const roleLabel = computed(() => {
  if (auth.employee?.role === 'manager') return '部门主管'
  if (auth.employee?.role === 'staff') return '员工'
  return ''
})

const roleBadgeClass = computed(() => ({
  'role-mgr': auth.employee?.role === 'manager',
  'role-staff': auth.employee?.role === 'staff'
}))

const departmentLabel = computed(() => {
  const e: any = auth.employee
  if (!e) return ''
  return e.department_name || (e.department_id != null ? `部门 #${e.department_id}` : '')
})

const phoneMasked = computed(() => fmtPhone(auth.employee?.phone || ''))

function go(url: string) {
  uni.navigateTo({ url })
}

async function refreshMe() {
  try {
    const me = await getMe()
    if (me) auth.setEmployee(me)
  } catch (e) {
    // 拦截器已 toast
  }
}

async function onLogout() {
  const sync = useSyncStore()
  const actor = auth.employee?.id ? { employee_id: Number(auth.employee.id) } : null
  if (actor) {
    try { await sync.refreshCounts(actor) } catch (e) { /* ignore */ }
  }
  const pending = sync.pendingCount || 0

  if (pending > 0) {
    uni.showModal({
      title: '检测到未同步数据',
      content: `还有 ${pending} 条本地操作未上传。继续退出会丢弃这些数据，是否先去同步？`,
      confirmText: '去同步',
      cancelText: '丢弃退出',
      success: async (r) => {
        if (r.confirm) {
          uni.navigateTo({ url: '/pages/me/sync-status' })
        } else {
          uni.showModal({
            title: '确认丢弃',
            content: `${pending} 条数据将被永久丢弃，无法恢复。确定继续？`,
            confirmText: '确认丢弃',
            cancelText: '取消',
            confirmColor: '#FF4D4F',
            success: async (r2) => {
              if (!r2.confirm) return
              if (actor) {
                try { await sync.clearAll(actor) } catch (e) { /* ignore */ }
              }
              try { await logout() } catch (e) { /* */ }
              auth.clear()
              uni.reLaunch({ url: '/pages/login/login' })
            }
          })
        }
      }
    })
    return
  }

  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (r) => {
      if (!r.confirm) return
      try { await logout() } catch (e) { /* ignore */ }
      auth.clear()
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
}

onShow(() => { if (auth.token) refreshMe() })
</script>

<style lang="scss" scoped>
.me-page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

/* ===== Header ===== */
.header {
  position: relative;
  background: linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #5B9CFF 100%);
  padding: 80rpx 32rpx 80rpx;
  border-radius: 0 0 32rpx 32rpx;
  overflow: hidden;
}
.header-bg-deco {
  position: absolute;
  top: -100rpx;
  right: -120rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 24rpx;
  color: #ffffff;
}
.avatar-wrap { flex-shrink: 0; }
.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 64rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 6rpx solid rgba(255, 255, 255, 0.5);
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  color: #ffffff;
  font-weight: 600;
}
.info { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.name {
  font-size: 38rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
}
.role-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.role-mgr { background: rgba(255, 196, 65, 0.95) !important; color: #5C3D00 !important; }
.role-staff { background: rgba(255, 255, 255, 0.25) !important; }

.dept, .phone {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.92);
}

/* ===== Menu groups ===== */
.menu-section {
  margin: 32rpx 24rpx 0;
}
.menu-section:first-of-type { margin-top: -40rpx; position: relative; z-index: 2; }
.menu-group-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.card {
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.menu-group { padding: 0 24rpx; }
.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 0;
  transition: background 0.15s;
  &:active { background: #F8F9FB; }
}
.menu-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mi-blue { background: #E8F3FF; }
.mi-green { background: #E6F7ED; }
.mi-orange { background: #FFF4E6; }
.mi-purple { background: #F4ECFF; }
.mi-gray { background: #F2F3F5; }
.mi-red { background: #FFECEB; }

.menu-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.menu-label {
  font-size: 30rpx;
  color: #1F2329;
  font-weight: 500;
}
.menu-hint {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #86909C;
}
.menu-divider {
  position: absolute;
  bottom: 0;
  left: 92rpx;
  right: 0;
  height: 1rpx;
  background: #F2F3F5;
}

/* ===== 退出 ===== */
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

.footer-text {
  margin-top: 32rpx;
  text-align: center;
  font-size: 22rpx;
  color: #C9CDD4;
}
</style>
