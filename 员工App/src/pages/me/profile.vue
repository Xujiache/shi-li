<template>
  <view class="page">
    <!-- 头像与名字（白底，无渐变） -->
    <view class="profile-card" @click="onPickAvatar">
      <view class="avatar-wrap">
        <image
          v-if="profile?.avatar_url"
          class="avatar"
          :src="profile.avatar_url"
          mode="aspectFill"
        />
        <view v-else class="avatar avatar-fallback">{{ avatarInitial }}</view>
        <view class="avatar-camera">
          <svg-icon name="camera" :size="22" color="#ffffff" />
        </view>
      </view>
      <view class="profile-info">
        <view class="profile-name">{{ profile?.display_name || '员工' }}</view>
        <view class="profile-meta">
          <text class="role-pill" :class="`role-${profile?.role}`">{{ roleLabel }}</text>
          <text v-if="departmentLabel" class="dept">{{ departmentLabel }}</text>
        </view>
      </view>
      <view class="profile-arrow">
        <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
      </view>
    </view>

    <!-- 基本资料 -->
    <view class="list-group">
      <view class="list-title">基本资料</view>
      <view class="list-card">
        <view class="row tap" @click="onEditName">
          <text class="row-label">姓名</text>
          <view class="row-right">
            <text class="row-value">{{ profile?.display_name || '-' }}</text>
            <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
          </view>
        </view>
        <view class="row">
          <text class="row-label">手机号</text>
          <text class="row-value">{{ profile?.phone || '-' }}</text>
        </view>
        <view class="row">
          <text class="row-label">部门</text>
          <text class="row-value">{{ departmentLabel || '-' }}</text>
        </view>
        <view class="row">
          <text class="row-label">角色</text>
          <text class="row-value">{{ roleLabel || '-' }}</text>
        </view>
        <view class="row">
          <text class="row-label">职位</text>
          <text class="row-value">{{ profile?.position || '-' }}</text>
        </view>
      </view>
    </view>

    <!-- 登录信息 -->
    <view class="list-group">
      <view class="list-title">登录信息</view>
      <view class="list-card">
        <view class="row" v-if="hireDate">
          <text class="row-label">入职时间</text>
          <text class="row-value">{{ hireDate }}</text>
        </view>
        <view class="row">
          <text class="row-label">最近登录</text>
          <text class="row-value">{{ lastLogin || '-' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore, type EmployeeProfile } from '@/stores/auth'
import { getMe, updateMe } from '@/api/employee'
import { uploadImage } from '@/api/upload'
import { fmtDateTime } from '@/utils/format'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()
const profile = ref<EmployeeProfile | null>(auth.employee)

const avatarInitial = computed(() => {
  const n = profile.value?.display_name || ''
  return n ? n.slice(0, 1).toUpperCase() : '员'
})
const roleLabel = computed(() => {
  if (profile.value?.role === 'manager') return '部门主管'
  if (profile.value?.role === 'staff') return '员工'
  return ''
})
const departmentLabel = computed(() => {
  const p: any = profile.value
  if (!p) return ''
  return p.department_name || (p.department_id != null ? `部门 #${p.department_id}` : '')
})
const hireDate = computed(() => {
  const p: any = profile.value
  if (!p) return ''
  return fmtDateTime(p.hire_date || p.hired_at || p.created_at, 'YYYY-MM-DD')
})
const lastLogin = computed(() => fmtDateTime(profile.value?.last_login_at))

async function load() {
  try {
    const me = await getMe()
    if (me) {
      profile.value = me
      auth.setEmployee(me)
    }
  } catch (e) { /* */ }
}

function onEditName() {
  const cur = profile.value?.display_name || ''
  uni.showModal({
    title: '修改姓名',
    editable: true,
    placeholderText: '请输入姓名',
    content: cur,
    success: (r) => {
      if (r.confirm) saveName(String(r.content || '').trim())
    }
  })
}

async function saveName(name: string) {
  if (!name) {
    uni.showToast({ title: '姓名不能为空', icon: 'none' })
    return
  }
  if (name === profile.value?.display_name) return
  uni.showLoading({ title: '保存中', mask: true })
  try {
    const updated = await updateMe({ display_name: name })
    if (updated) {
      profile.value = updated
      auth.setEmployee(updated)
      uni.showToast({ title: '已保存', icon: 'success' })
    }
  } catch (e) { /* */ } finally {
    uni.hideLoading()
  }
}

function onPickAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      uni.showLoading({ title: '上传中', mask: true })
      try {
        const up = await uploadImage(path)
        if (up?.url) {
          const updated = await updateMe({ avatar_url: up.url })
          if (updated) {
            profile.value = updated
            auth.setEmployee(updated)
            uni.showToast({ title: '已更新', icon: 'success' })
          }
        }
      } catch (e) { /* */ } finally {
        uni.hideLoading()
      }
    }
  })
}

onShow(() => { if (auth.token) load() })
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F4F5F7;
  padding-bottom: 80rpx;
}

/* ===== 顶部头像区（白底，参考飞书 / 钉钉个人页）===== */
.profile-card {
  background: #ffffff;
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  &:active { background: #FAFBFC; }
}
.avatar-wrap {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  flex-shrink: 0;
  margin-right: 24rpx;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background: #F2F3F5;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #4E5969;
  font-weight: 600;
  background: #F2F3F5;
}
.avatar-camera {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #1677FF;
  border: 3rpx solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.profile-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #1F2329;
}
.profile-meta {
  margin-top: 10rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.role-pill {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  background: #F2F3F5;
  color: #4E5969;
  &.role-manager { background: #FFF7E6; color: #FA8C16; }
  &.role-staff { background: #F2F3F5; color: #4E5969; }
}
.dept {
  font-size: 22rpx;
  color: #86909C;
}
.profile-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ===== 列表组（飞书风格小标题 + 白卡）===== */
.list-group {
  margin-top: 24rpx;
  padding: 0 16rpx;
}
.list-title {
  padding: 0 12rpx 8rpx;
  font-size: 22rpx;
  color: #86909C;
}
.list-card {
  background: #ffffff;
  border-radius: 12rpx;
  overflow: hidden;
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 24rpx;
  font-size: 28rpx;
  &::after {
    content: '';
    position: absolute;
    left: 24rpx;
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: #F0F1F3;
  }
  &:last-child::after { display: none; }
  &.tap:active { background: #FAFBFC; }
}
.row-label {
  color: #86909C;
}
.row-right {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.row-value {
  color: #1F2329;
  max-width: 420rpx;
  text-align: right;
  word-break: break-all;
}
</style>
