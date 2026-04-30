<template>
  <view class="login-page">
    <view class="bg-deco-1" />
    <view class="bg-deco-2" />

    <view class="brand">
      <view class="brand-logo">
        <svg-icon name="lock" :size="64" color="#ffffff" />
      </view>
      <view class="brand-title">修改密码</view>
      <view class="brand-sub">首次登录或密码已过期，请设置新密码</view>
    </view>

    <view class="form-card">
      <view class="form-title">设置新密码</view>
      <view class="form-tip">≥ 8 位，必须同时包含字母和数字</view>

      <view class="form-row">
        <view class="row-icon"><svg-icon name="lock" :size="32" color="#86909C" /></view>
        <input
          class="input"
          type="password"
          v-model="oldPassword"
          placeholder="请输入原密码"
          :password="true"
        />
      </view>

      <view class="form-row">
        <view class="row-icon"><svg-icon name="unlock" :size="32" color="#86909C" /></view>
        <input
          class="input"
          type="password"
          v-model="newPassword"
          placeholder="≥ 8 位，含字母+数字"
          :password="true"
        />
      </view>

      <view class="form-row">
        <view class="row-icon"><svg-icon name="check-circle" :size="32" color="#86909C" /></view>
        <input
          class="input"
          type="password"
          v-model="confirmPassword"
          placeholder="再次输入新密码"
          :password="true"
        />
      </view>

      <view class="btn-primary" :class="{disabled: loading}" @click="onSubmit">
        {{ loading ? '提交中...' : '确认修改' }}
      </view>
      <view class="hint">为保障账号安全，新密码至少 8 位且必须同时包含字母和数字</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { changePassword as apiChangePassword } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'
import SvgIcon from '@/components/svg-icon.vue'

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const auth = useAuthStore()

function validate(): string | null {
  if (!oldPassword.value) return '请输入原密码'
  if (!newPassword.value) return '请输入新密码'
  if (newPassword.value.length < 8) return '新密码至少 8 位'
  if (!/[A-Za-z]/.test(newPassword.value) || !/\d/.test(newPassword.value)) {
    return '新密码必须同时包含字母和数字'
  }
  if (newPassword.value === oldPassword.value) return '新密码不能与原密码相同'
  if (confirmPassword.value !== newPassword.value) return '两次输入的新密码不一致'
  return null
}

async function onSubmit() {
  const msg = validate()
  if (msg) {
    uni.showToast({ title: msg, icon: 'none' })
    return
  }
  loading.value = true
  try {
    const data = await apiChangePassword({
      old_password: oldPassword.value,
      new_password: newPassword.value
    })
    if (data && data.token) {
      auth.setToken(data.token, 0)
    }
    if (auth.employee) {
      auth.setEmployee({ ...auth.employee, must_change_password: false })
    }
    uni.showToast({ title: '修改成功', icon: 'success' })
    setTimeout(() => uni.reLaunch({ url: '/pages/home/index' }), 600)
  } catch (err: any) {
    if (err && err.message && !err.code) {
      uni.showToast({ title: err.message, icon: 'none' })
    }
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(160deg, #1677FF 0%, #4096FF 40%, #F5F7FA 70%);
  padding: 140rpx 48rpx 48rpx;
  box-sizing: border-box;
  overflow: hidden;
}
.bg-deco-1 {
  position: absolute;
  top: -120rpx; right: -180rpx;
  width: 480rpx; height: 480rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.bg-deco-2 {
  position: absolute;
  top: 240rpx; left: -160rpx;
  width: 320rpx; height: 320rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.brand {
  position: relative;
  text-align: center;
  margin-bottom: 80rpx;
  color: #ffffff;
}
.brand-logo {
  width: 128rpx; height: 128rpx;
  margin: 0 auto 24rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.18);
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
}
.brand-title { font-size: 48rpx; font-weight: 700; letter-spacing: 4rpx; }
.brand-sub { margin-top: 12rpx; opacity: 0.9; font-size: 26rpx; }

.form-card {
  position: relative;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 48rpx 32rpx 40rpx;
  box-shadow: 0 12rpx 48rpx rgba(20, 30, 60, 0.08);
}
.form-title { font-size: 36rpx; font-weight: 700; color: #1F2329; }
.form-tip { margin-top: 8rpx; font-size: 24rpx; color: #86909C; margin-bottom: 32rpx; }

.form-row {
  display: flex;
  align-items: center;
  background: #F7F8FA;
  border-radius: 20rpx;
  padding: 0 24rpx;
  margin-top: 16rpx;
  height: 96rpx;
}
.row-icon { display: flex; align-items: center; margin-right: 16rpx; flex-shrink: 0; }
.input { flex: 1; font-size: 30rpx; color: #1F2329; background: transparent; }

.btn-primary {
  margin-top: 48rpx;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  border-radius: 24rpx;
  text-align: center;
  padding: 28rpx 0;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
  box-shadow: 0 6rpx 20rpx rgba(22, 119, 255, 0.35);
  transition: transform 0.15s, opacity 0.15s;
  &:active { transform: scale(0.98); opacity: 0.95; }
  &.disabled { opacity: 0.6; box-shadow: none; }
}
.hint {
  margin-top: 24rpx;
  text-align: center;
  color: #86909C;
  font-size: 22rpx;
  line-height: 1.6;
}
</style>
