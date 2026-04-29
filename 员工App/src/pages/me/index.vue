<template>
  <view class="me-page">
    <!-- 顶部用户头像区 -->
    <view class="header card">
      <view class="avatar-wrap">
        <image
          v-if="auth.employee?.avatar_url"
          class="avatar"
          :src="auth.employee.avatar_url"
          mode="aspectFill"
        />
        <view v-else class="avatar avatar-fallback">
          {{ avatarInitial }}
        </view>
      </view>
      <view class="info">
        <view class="name">{{ auth.employee?.display_name || '员工' }}</view>
        <view class="meta">
          <text class="role-badge" :class="roleBadgeClass">{{ roleLabel }}</text>
          <text class="dept" v-if="departmentLabel">{{ departmentLabel }}</text>
        </view>
        <view class="phone">{{ phoneMasked }}</view>
      </view>
    </view>

    <!-- 大按钮卡片入口 -->
    <view class="menu-list">
      <view class="menu-item card" @click="go('/pages/me/profile')">
        <view class="menu-icon icon-user">
          <svg-icon name="user" :size="36" color="#1677FF" />
        </view>
        <view class="menu-text">个人信息</view>
        <view class="menu-arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
      <view class="menu-item card" @click="go('/pages/me/team')">
        <view class="menu-icon icon-team">
          <svg-icon name="users" :size="36" color="#2F54EB" />
        </view>
        <view class="menu-text">我的团队</view>
        <view class="menu-arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
      <view class="menu-item card" @click="go('/pages/me/stats')">
        <view class="menu-icon icon-stats">
          <svg-icon name="bar-chart-3" :size="36" color="#FA8C16" />
        </view>
        <view class="menu-text">数据统计</view>
        <view class="menu-arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
      <view class="menu-item card" @click="go('/pages/me/settings')">
        <view class="menu-icon icon-settings">
          <svg-icon name="settings" :size="36" color="#4E5969" />
        </view>
        <view class="menu-text">设置</view>
        <view class="menu-arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
      <view class="menu-item card" @click="go('/pages/login/change-password')">
        <view class="menu-icon icon-lock">
          <svg-icon name="lock" :size="36" color="#FF4D4F" />
        </view>
        <view class="menu-text">修改密码</view>
        <view class="menu-arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-wrap">
      <view class="btn-logout" @click="onLogout">退出登录</view>
    </view>

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

const auth = useAuthStore()

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

/**
 * 退出登录前必须先处理 pending_op：
 *   - 若有未同步的本地操作，强制弹窗让用户三选一：
 *     1) "去同步" → 跳 sync-status 页（不退出）
 *     2) "丢弃并退出" → clearAll(actor) + auth.clear() + 跳登录页
 *     3) "取消" → 留在原页
 *   - 若本地无 pending，按原流程二次确认 + 退出
 *   该拦截满足 PRD §7.6：切换账号前 pending_op 非空时，强制要求"先同步"或"主动清空"。
 */
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
          // 用户选"丢弃退出"——再二次确认
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
              try { await logout() } catch (e) { /* 后端失败也强制清本地态 */ }
              auth.clear()
              uni.reLaunch({ url: '/pages/login/login' })
            }
          })
        }
      }
    })
    return
  }

  // 无 pending — 走原流程
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

onShow(() => {
  if (auth.token) refreshMe()
})
</script>

<style lang="scss" scoped>
.me-page {
  padding: 24rpx;
  padding-bottom: 200rpx;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  padding: 32rpx 24rpx;
}
.avatar-wrap {
  margin-right: 24rpx;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.6);
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #ffffff;
  font-weight: 600;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 36rpx;
  font-weight: 600;
}
.meta {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.role-badge {
  font-size: 22rpx;
  padding: 2rpx 14rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.role-mgr { background: rgba(255, 196, 65, 0.85); color: #5C3D00; }
.role-staff { background: rgba(255, 255, 255, 0.25); }
.dept {
  font-size: 24rpx;
  opacity: 0.9;
}
.phone {
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.85;
}

.menu-list {
  margin-top: 16rpx;
}
.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.menu-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}
.icon-user { background: #E6F4FF; }
.icon-team { background: #F0F5FF; }
.icon-stats { background: #FFF7E6; }
.icon-settings { background: #F2F3F5; }
.icon-lock { background: #FFF1F0; }
.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #1F2329;
}
.menu-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
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
