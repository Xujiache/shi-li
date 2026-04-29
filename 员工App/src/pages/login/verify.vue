<template>
  <view class="vf-page">
    <view class="brand">
      <view class="brand-title">异地登录验证</view>
      <view class="brand-sub">检测到设备/IP 变化，请输入手机收到的验证码</view>
    </view>
    <view class="form card">
      <view class="form-row">
        <text class="label">手机号</text>
        <input class="input" type="number" maxlength="11" v-model="phone" placeholder="请输入手机号" />
      </view>
      <view class="form-row">
        <text class="label">验证码</text>
        <input class="input" type="number" maxlength="6" v-model="code" placeholder="6 位验证码" />
        <view
          class="resend"
          :class="{disabled: countdown > 0}"
          @click="onResend"
        >
          {{ countdown > 0 ? `${countdown}s 后重发` : '重新发送' }}
        </view>
      </view>
      <view class="btn-primary" :class="{disabled: loading}" @click="onSubmit">
        {{ loading ? '验证中...' : '确认验证' }}
      </view>
      <view class="hint">如长时间未收到验证码，请联系管理员</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { verifyCode as apiVerifyCode, resendVerifyCode as apiResendVerifyCode } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'

const phone = ref('')
const code = ref('')
const loading = ref(false)
const countdown = ref(0)
const auth = useAuthStore()
let timer: any = null

onLoad((q: any) => {
  if (q?.phone) phone.value = String(q.phone)
})

onMounted(() => {
  // 进入页面默认进入 60s 倒计时（假定上一步已下发过验证码）
  startCountdown()
})

onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null }
})

function startCountdown() {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      countdown.value = 0
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function onResend() {
  if (countdown.value > 0) return
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请先输入手机号', icon: 'none' })
    return
  }
  try {
    const r: any = await apiResendVerifyCode({ phone: phone.value })
    // 后端会真实告诉前端是否启用了短信网关
    uni.showToast({
      title: r?.message || (r?.sms_enabled ? '验证码已下发' : '短信网关未配置'),
      icon: 'none',
      duration: 2500
    })
    if (r?.sms_enabled) startCountdown()
  } catch (e) {
    // http 拦截器已 toast
  }
}

async function onSubmit() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return
  }
  if (!/^\d{6}$/.test(code.value)) {
    uni.showToast({ title: '请输入 6 位验证码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const data = await apiVerifyCode({ phone: phone.value, code: code.value })
    auth.setToken(data.token, data.expires_in)
    if (data.employee) auth.setEmployee(data.employee)
    if (data.must_change_password || data.employee?.must_change_password) {
      uni.redirectTo({ url: '/pages/login/change-password' })
    } else {
      uni.reLaunch({ url: '/pages/home/index' })
    }
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
.vf-page {
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
.resend {
  font-size: 26rpx; color: #1677FF;
  padding: 8rpx 16rpx;
  &.disabled { color: #C9CDD4; }
}
.btn-primary {
  margin-top: 48rpx;
  background: #1677FF; color: #ffffff;
  border-radius: 12rpx; text-align: center;
  padding: 24rpx 0; font-size: 32rpx;
  &.disabled { opacity: 0.6; }
}
.hint { margin-top: 24rpx; text-align: center; color: #86909C; font-size: 22rpx; }
</style>
