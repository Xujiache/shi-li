<template>
  <view class="login-page">
    <view class="bg-deco-1" />
    <view class="bg-deco-2" />

    <view class="brand">
      <view class="brand-logo">
        <svg-icon name="heart-pulse" :size="64" color="#ffffff" />
      </view>
      <view class="brand-title">视力员工</view>
      <view class="brand-sub">客户管理 · 员工版</view>
    </view>

    <view class="form-card">
      <view class="form-title">欢迎回来</view>
      <view class="form-tip">请输入账号信息登录</view>

      <view class="form-row">
        <view class="row-icon"><svg-icon name="phone" :size="32" color="#86909C" /></view>
        <input
          class="input"
          type="number"
          maxlength="11"
          v-model="phone"
          placeholder="请输入手机号"
        />
      </view>

      <view class="form-row">
        <view class="row-icon"><svg-icon name="lock" :size="32" color="#86909C" /></view>
        <input
          class="input"
          type="password"
          v-model="password"
          placeholder="请输入密码"
          :password="true"
        />
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
import SvgIcon from '@/components/svg-icon.vue'

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
.brand-title {
  font-size: 56rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
}
.brand-sub {
  margin-top: 12rpx;
  opacity: 0.9;
  font-size: 26rpx;
  letter-spacing: 2rpx;
}

.form-card {
  position: relative;
  background: #ffffff;
  border-radius: 32rpx;
  padding: 48rpx 32rpx 40rpx;
  box-shadow: 0 12rpx 48rpx rgba(20, 30, 60, 0.08);
}
.form-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1F2329;
}
.form-tip {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #86909C;
  margin-bottom: 32rpx;
}

.form-row {
  display: flex;
  align-items: center;
  background: #F7F8FA;
  border-radius: 20rpx;
  padding: 0 24rpx;
  margin-top: 16rpx;
  height: 96rpx;
}
.row-icon {
  display: flex;
  align-items: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.input {
  flex: 1;
  font-size: 30rpx;
  color: #1F2329;
  background: transparent;
}

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
  &.disabled {
    opacity: 0.6;
    box-shadow: none;
  }
}
.hint {
  margin-top: 24rpx;
  text-align: center;
  color: #86909C;
  font-size: 24rpx;
}
</style>
