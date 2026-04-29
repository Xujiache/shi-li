<template>
  <view class="cp-page">
    <view class="brand">
      <view class="brand-title">修改密码</view>
      <view class="brand-sub">首次登录或密码已过期，请设置新密码</view>
    </view>
    <view class="form card">
      <view class="form-row">
        <text class="label">原密码</text>
        <input
          class="input"
          type="password"
          v-model="oldPassword"
          placeholder="请输入原密码"
          :password="true"
        />
      </view>
      <view class="form-row">
        <text class="label">新密码</text>
        <input
          class="input"
          type="password"
          v-model="newPassword"
          placeholder="≥ 8 位，含字母+数字"
          :password="true"
        />
      </view>
      <view class="form-row">
        <text class="label">确认</text>
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
    // http.ts 拦截器已 toast，这里兜底
    if (err && err.message && !err.code) {
      uni.showToast({ title: err.message, icon: 'none' })
    }
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.cp-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1677FF 0%, #4096FF 35%, #F5F7FA 60%);
  padding: 120rpx 48rpx 48rpx;
  box-sizing: border-box;
}
.brand { text-align: center; margin-bottom: 60rpx; color: #ffffff; }
.brand-title { font-size: 48rpx; font-weight: 600; letter-spacing: 4rpx; }
.brand-sub { margin-top: 12rpx; opacity: 0.85; font-size: 26rpx; }
.form {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.06);
}
.form-row {
  display: flex; align-items: center;
  border-bottom: 1rpx solid #F2F3F5;
  padding: 24rpx 0;
}
.label { width: 130rpx; color: #4E5969; font-size: 28rpx; }
.input { flex: 1; font-size: 30rpx; color: #1F2329; }
.btn-primary {
  margin-top: 48rpx;
  background: #1677FF; color: #ffffff;
  border-radius: 12rpx; text-align: center;
  padding: 24rpx 0; font-size: 32rpx;
  &.disabled { opacity: 0.6; }
}
.hint { margin-top: 24rpx; text-align: center; color: #86909C; font-size: 22rpx; line-height: 1.6; }
</style>
