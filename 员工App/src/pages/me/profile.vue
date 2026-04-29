<template>
  <view class="profile-page">
    <!-- 头像区 -->
    <view class="avatar-card card" @click="onPickAvatar">
      <view class="row-label">
        <svg-icon name="camera" :size="28" color="#1677FF" />
        <text class="row-label-text">头像</text>
      </view>
      <view class="avatar-right">
        <image
          v-if="profile?.avatar_url"
          class="avatar-thumb"
          :src="profile.avatar_url"
          mode="aspectFill"
        />
        <view v-else class="avatar-thumb avatar-fallback">{{ avatarInitial }}</view>
        <view class="row-arrow">
          <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
        </view>
      </view>
    </view>

    <!-- 字段列表 -->
    <view class="card field-list">
      <view class="row" @click="onEditName">
        <view class="row-label">姓名</view>
        <view class="row-value editable">
          <text>{{ profile?.display_name || '-' }}</text>
          <view class="row-arrow">
            <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          </view>
        </view>
      </view>

      <view class="row">
        <view class="row-label">手机号</view>
        <view class="row-value">{{ profile?.phone || '-' }}</view>
      </view>

      <view class="row">
        <view class="row-label">部门</view>
        <view class="row-value">{{ departmentLabel || '-' }}</view>
      </view>

      <view class="row">
        <view class="row-label">角色</view>
        <view class="row-value">{{ roleLabel || '-' }}</view>
      </view>

      <view class="row">
        <view class="row-label">职位</view>
        <view class="row-value">{{ profile?.position || '-' }}</view>
      </view>

      <view class="row" v-if="hireDate">
        <view class="row-label">入职时间</view>
        <view class="row-value">{{ hireDate }}</view>
      </view>

      <view class="row">
        <view class="row-label">最近登录</view>
        <view class="row-value">{{ lastLogin || '-' }}</view>
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
  } catch (e) {
    // 拦截器已 toast
  }
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
  } catch (e) {
    // 拦截器已 toast
  } finally {
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
      } catch (e) {
        // 拦截器/upload 已 toast
      } finally {
        uni.hideLoading()
      }
    }
  })
}

onShow(() => {
  if (auth.token) load()
})
</script>

<style lang="scss" scoped>
.profile-page {
  padding: 24rpx;
}

.card {
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}

.avatar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 24rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.avatar-right {
  display: flex;
  align-items: center;
}
.avatar-thumb {
  width: 96rpx;
  height: 96rpx;
  border-radius: 48rpx;
  background: #F2F3F5;
  margin-right: 16rpx;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #4E5969;
  font-weight: 600;
}

.field-list {
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #F2F3F5;

  &:last-child {
    border-bottom: none;
  }
}
.row-label {
  color: #4E5969;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.row-label-text { color: #4E5969; font-size: 28rpx; }
.row-value {
  color: #1F2329;
  font-size: 28rpx;
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}
.row-value.editable {
  color: #1F2329;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.row-arrow {
  margin-left: 8rpx;
  display: flex;
  align-items: center;
}
</style>
