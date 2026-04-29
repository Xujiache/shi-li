<template>
  <view class="team-page">
    <view v-if="loading && !members.length" class="loading-tip">加载中...</view>

    <view v-else-if="members.length" class="member-list">
      <view
        v-for="m in members"
        :key="m.id"
        class="member-item card"
        @click="onTapMember(m)"
      >
        <view class="avatar-wrap">
          <image
            v-if="m.avatar_url"
            class="avatar"
            :src="m.avatar_url"
            mode="aspectFill"
          />
          <view v-else class="avatar avatar-fallback">{{ initial(m.display_name) }}</view>
        </view>
        <view class="info">
          <view class="line1">
            <text class="name">{{ m.display_name || '未命名' }}</text>
            <text class="role-badge" :class="roleBadgeClass(m.role)">{{ roleLabel(m.role) }}</text>
          </view>
          <view class="position">{{ m.position || '—' }}</view>
        </view>
        <view class="arrow">
          <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
        </view>
      </view>
    </view>

    <empty-state v-else text="暂无同事" icon="users" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useTeamStore } from '@/stores/team'
import { useAuthStore } from '@/stores/auth'
import { fmtPhone } from '@/utils/format'

const auth = useAuthStore()
const teamStore = useTeamStore()

const loading = ref(false)
const members = computed(() => teamStore.memberList || [])

function initial(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

function roleLabel(role: string): string {
  if (role === 'manager') return '主管'
  if (role === 'staff') return '员工'
  return role || ''
}

function roleBadgeClass(role: string) {
  return {
    'role-mgr': role === 'manager',
    'role-staff': role === 'staff'
  }
}

async function load(force = false) {
  loading.value = true
  try {
    await teamStore.loadMembers(force)
  } catch (e) {
    // 拦截器已 toast
  } finally {
    loading.value = false
  }
}

function onTapMember(m: any) {
  const phone = m?.phone
  if (!phone) {
    uni.showToast({ title: '该同事暂无电话', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: [`拨打 ${fmtPhone(phone)}`, '复制号码'],
    success: (r) => {
      if (r.tapIndex === 0) {
        // #ifdef H5
        window.location.href = `tel:${phone}`
        // #endif
        // #ifndef H5
        uni.makePhoneCall({ phoneNumber: String(phone), fail: () => {} })
        // #endif
      } else if (r.tapIndex === 1) {
        uni.setClipboardData({ data: String(phone) })
      }
    }
  })
}

onShow(() => {
  if (auth.token) load()
})

onPullDownRefresh(async () => {
  await load(true)
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.team-page {
  padding: 24rpx;
  min-height: 100vh;
}
.loading-tip {
  text-align: center;
  color: #86909C;
  padding: 80rpx 0;
  font-size: 26rpx;
}

.member-list {
  display: flex;
  flex-direction: column;
}
.member-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 16rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.avatar-wrap {
  margin-right: 24rpx;
}
.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 44rpx;
  background: #F2F3F5;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #4E5969;
  font-weight: 600;
}
.info {
  flex: 1;
  min-width: 0;
}
.line1 {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.name {
  font-size: 30rpx;
  font-weight: 500;
  color: #1F2329;
}
.role-badge {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 14rpx;
  background: #F2F3F5;
  color: #4E5969;
}
.role-mgr {
  background: #FFF7E6;
  color: #D46B08;
}
.role-staff {
  background: #E6F4FF;
  color: #1677FF;
}
.position {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #86909C;
}
.arrow {
  margin-left: 8rpx;
  display: flex;
  align-items: center;
}
</style>
