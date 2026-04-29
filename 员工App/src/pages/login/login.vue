<template>
  <view class="login-page">
    <view class="brand">
      <view class="brand-title">视力员工</view>
      <view class="brand-sub">客户管理 · 员工版</view>
    </view>
    <view class="form card">
      <view class="form-row">
        <text class="label">手机号</text>
        <input class="input" type="number" maxlength="11" v-model="phone" placeholder="请输入手机号" />
      </view>
      <view class="form-row">
        <text class="label">密码</text>
        <input class="input" type="password" v-model="password" placeholder="请输入密码" />
      </view>
      <view class="btn-primary" :class="{disabled: loading}" @click="onLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </view>
      <view class="hint">首次登录请联系管理员开通账号</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login as apiLogin } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'

const phone = ref('')
const password = ref('')
const loading = ref(false)
const auth = useAuthStore()

async function onLogin() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return
  }
  if (!password.value || password.value.length < 6) {
    uni.showToast({ title: '密码至少 6 位', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const data = await apiLogin({ phone: phone.value, password: password.value })
    auth.setToken(data.token, data.expires_in)
    auth.setEmployee(data.employee)
    if (data.must_change_password || data.employee?.must_change_password) {
      uni.redirectTo({ url: '/pages/login/change-password' })
    } else {
      uni.reLaunch({ url: '/pages/home/index' })
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1677FF 0%, #4096FF 35%, #F5F7FA 60%);
  padding: 120rpx 48rpx 48rpx;
  box-sizing: border-box;
}
.brand {
  text-align: center;
  margin-bottom: 80rpx;
  color: #ffffff;
}
.brand-title {
  font-size: 56rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
}
.brand-sub {
  margin-top: 12rpx;
  opacity: 0.85;
  font-size: 26rpx;
}
.form {
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
}
.form-row {
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid #F2F3F5;
  padding: 24rpx 0;
}
.label {
  width: 130rpx;
  color: #4E5969;
  font-size: 28rpx;
}
.input {
  flex: 1;
  font-size: 30rpx;
  color: #1F2329;
}
.btn-primary {
  margin-top: 48rpx;
  background: #1677FF;
  color: #ffffff;
  border-radius: 12rpx;
  text-align: center;
  padding: 24rpx 0;
  font-size: 32rpx;
  &.disabled { opacity: 0.6; }
}
.hint {
  margin-top: 24rpx;
  text-align: center;
  color: #86909C;
  font-size: 24rpx;
}
</style>
