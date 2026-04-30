<template>
  <view class="page">
    <view v-if="loading && !members.length" class="state">加载中...</view>

    <view v-else-if="members.length">
      <view class="page-tip">点击同事可查看联系方式（{{ members.length }} 人）</view>

      <view class="member-list">
        <view
          v-for="m in members"
          :key="m.id"
          class="member-item"
          @click="onTapMember(m)"
        >
          <view class="avatar-wrap">
            <image
              v-if="m.avatar_url"
              class="avatar"
              :src="m.avatar_url"
              mode="aspectFill"
            />
            <view v-else class="avatar avatar-fallback" :class="`bg-${tone(m.id)}`">
              {{ initial(m.display_name) }}
            </view>
          </view>
          <view class="info">
            <view class="line1">
              <text class="name">{{ m.display_name || '未命名' }}</text>
              <text class="role-pill" :class="`role-${m.role}`">{{ roleLabel(m.role) }}</text>
            </view>
            <view class="position">{{ m.position || '—' }}</view>
          </view>
          <view class="action">
            <svg-icon name="phone" :size="26" color="#1677FF" />
          </view>
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
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()
const teamStore = useTeamStore()

const loading = ref(false)
const members = computed(() => teamStore.memberList || [])

function initial(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}
function tone(id: number | string) {
  const n = Number(id) || 0
  return ['blue', 'orange', 'green', 'purple', 'red'][n % 5]
}

function roleLabel(role: string): string {
  if (role === 'manager') return '主管'
  if (role === 'staff') return '员工'
  return role || ''
}

async function load(force = false) {
  loading.value = true
  try {
    await teamStore.loadMembers(force)
  } catch (e) { /* */ } finally {
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

onShow(() => { if (auth.token) load() })
onPullDownRefresh(async () => {
  await load(true)
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 80rpx;
}
.page-tip {
  padding: 24rpx 32rpx 0;
  font-size: 24rpx;
  color: #86909C;
}
.state {
  text-align: center;
  color: #86909C;
  padding: 80rpx 0;
  font-size: 26rpx;
}

.member-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.member-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
  transition: transform 0.15s, opacity 0.15s;
  &:active { opacity: 0.85; transform: scale(0.99); }
}
.avatar-wrap { flex-shrink: 0; }
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: #F2F3F5;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #ffffff;
  font-weight: 600;
}
.bg-blue { background: linear-gradient(135deg, #1677FF, #4096FF); }
.bg-orange { background: linear-gradient(135deg, #FA8C16, #FFB264); }
.bg-green { background: linear-gradient(135deg, #00B42A, #4ED365); }
.bg-purple { background: linear-gradient(135deg, #722ED1, #9254DE); }
.bg-red { background: linear-gradient(135deg, #F53F3F, #FF7875); }

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
  font-weight: 600;
  color: #1F2329;
}
.role-pill {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  background: #F2F3F5;
  color: #4E5969;
  &.role-manager { background: #FFF7E6; color: #FA8C16; }
  &.role-staff { background: #E8F3FF; color: #1677FF; }
}
.position {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #86909C;
}
.action {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  background: #E8F3FF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
