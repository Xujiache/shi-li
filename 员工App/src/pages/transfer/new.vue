<template>
  <view class="page">
    <view class="page-tip">填写转出申请，提交后由部门主管审批</view>

    <view class="section">
      <view class="section-title">客户</view>
      <view class="section-card">
        <view class="form-row tap" @tap="onPickCustomer">
          <text class="label">要转出的客户</text>
          <view class="picker">
            <text v-if="customerName" class="val">{{ customerName }}</text>
            <text v-else class="ph">点击选择</text>
            <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">转出原因 <text class="req">*</text></view>
      <view class="section-card">
        <textarea
          v-model="reason"
          class="textarea"
          placeholder="请详细说明转出原因（必填，便于审批）"
          :maxlength="500"
        />
        <view class="counter-row">
          <text class="counter">{{ reason.length }} / 500</text>
        </view>
      </view>
    </view>

    <view class="submit-bar">
      <view class="btn-primary" :class="{ disabled: submitting || !canSubmit }" @tap="onSubmit">
        {{ submitting ? '提交中...' : '提交申请' }}
      </view>
    </view>

    <!-- 客户选择弹层 -->
    <view v-if="pickerVisible" class="picker-mask" @click.self="pickerVisible = false">
      <view class="picker-panel">
        <view class="picker-head">
          <text class="picker-title">选择要转出的客户</text>
          <view class="picker-close" @click="pickerVisible = false">
            <svg-icon name="x" :size="32" color="#86909C" />
          </view>
        </view>
        <view class="picker-search">
          <view class="picker-search-box">
            <svg-icon name="search" :size="26" color="#86909C" />
            <input class="picker-input" v-model="pickerQ" placeholder="搜索 姓名 / 手机 / 编号" confirm-type="search" />
          </view>
        </view>
        <scroll-view scroll-y class="picker-list">
          <view v-if="pickerLoading" class="picker-state">加载中...</view>
          <view v-else-if="!pickerCandidates.length" class="picker-state">暂无客户</view>
          <view
            v-else
            v-for="c in pickerCandidates"
            :key="c.id"
            class="picker-item"
            @click="confirmPick(c)"
          >
            <view class="pi-avatar">{{ String(c.display_name || '?').charAt(0) }}</view>
            <view class="pi-main">
              <text class="pi-name">{{ c.display_name }}</text>
              <text class="pi-sub">{{ c.phone || '-' }} · {{ statusZh(c.status) }} · {{ c.level }}级</text>
            </view>
            <svg-icon name="chevron-right" :size="24" color="#C9CDD4" />
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as transferApi from '@/api/transfer'
import * as customerApi from '@/api/customer'
import { useAuthStore } from '@/stores/auth'
import { v4 } from '@/utils/uuid'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()

const customerId = ref<string | number>('')
const customerName = ref<string>('')
const reason = ref<string>('')
const submitting = ref(false)

const canSubmit = computed(() => !!customerId.value && reason.value.trim().length > 0)

onLoad((q: any) => {
  if (q && q.customer_id) {
    customerId.value = q.customer_id
    if (q.customer_name) customerName.value = decodeURIComponent(q.customer_name)
    else loadCustomer(q.customer_id)
  }
})

async function loadCustomer(id: string | number) {
  try {
    const data = await customerApi.detail(id)
    customerName.value = data?.display_name || data?.name || `客户#${id}`
  } catch (e) {
    customerName.value = `客户#${id}`
  }
}

const pickerVisible = ref(false)
const pickerQ = ref('')
const pickerLoading = ref(false)
const pickerAll = ref<any[]>([])

const STATUS_ZH: Record<string, string> = {
  potential: '潜在', interested: '意向', signed: '成交', lost: '流失'
}
function statusZh(s: string) { return STATUS_ZH[s] || s || '-' }

const pickerCandidates = computed(() => {
  const kw = pickerQ.value.trim().toLowerCase()
  if (!kw) return pickerAll.value
  return pickerAll.value.filter((c: any) => {
    const name = String(c.display_name || '').toLowerCase()
    const phone = String(c.phone || '')
    const no = String(c.customer_no || '')
    return name.includes(kw) || phone.includes(kw) || no.includes(kw)
  })
})

async function loadPickerCustomers() {
  if (pickerAll.value.length > 0) return
  pickerLoading.value = true
  try {
    const r: any = await customerApi.list({ page: 1, page_size: 200 })
    pickerAll.value = r?.items || r?.list || []
  } catch (e) {
    pickerAll.value = []
  } finally {
    pickerLoading.value = false
  }
}

async function onPickCustomer() {
  pickerVisible.value = true
  pickerQ.value = ''
  await loadPickerCustomers()
}

function confirmPick(c: any) {
  customerId.value = c.id
  customerName.value = c.display_name || `客户#${c.id}`
  pickerVisible.value = false
}

async function onSubmit() {
  if (!canSubmit.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const actor = auth.employee && auth.employee.id ? { employee_id: auth.employee.id } : null
    if (!actor) throw new Error('未登录')
    const ret = await transferApi.submitOffline(actor, {
      customer_id: customerId.value,
      reason: reason.value.trim(),
      client_uuid: v4()
    } as any)
    if (ret.status === 'ok') {
      uni.showToast({ title: '提交成功', icon: 'success' })
    } else {
      uni.showToast({ title: '已离线保存，联网后自动提交', icon: 'none' })
    }
    setTimeout(() => uni.redirectTo({ url: '/pages/transfer/mine' }), 600)
  } catch (e) { /* */ } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}
.page-tip {
  padding: 24rpx 32rpx;
  font-size: 24rpx;
  color: #86909C;
}

.section { margin: 0 24rpx 24rpx; }
.section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.section-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx 24rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.form-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  &.tap:active { opacity: 0.7; }
}
.label { width: 200rpx; color: #4E5969; flex-shrink: 0; }
.req { color: #F53F3F; margin-left: 4rpx; }
.picker {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6rpx;
  font-size: 28rpx;
  color: #1F2329;
}
.val { color: #1F2329; }
.ph { color: #C9CDD4; }

.textarea {
  width: 100%;
  margin: 16rpx 0 8rpx;
  background: #F7F8FA;
  border-radius: 16rpx;
  padding: 20rpx;
  height: 240rpx;
  font-size: 28rpx;
  color: #1F2329;
  box-sizing: border-box;
}
.counter-row { text-align: right; }
.counter { font-size: 22rpx; color: #86909C; }

.submit-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding: 16rpx 24rpx 32rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(20, 30, 60, 0.05);
}
.btn-primary {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  text-align: center;
  padding: 28rpx;
  border-radius: 24rpx;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 8rpx;
  box-shadow: 0 6rpx 20rpx rgba(22, 119, 255, 0.35);
  transition: transform 0.15s, opacity 0.15s;
  &:active { transform: scale(0.98); }
  &.disabled {
    opacity: 0.6;
    box-shadow: none;
    background: #C9CDD4;
  }
}

.picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}
.picker-panel {
  width: 100%;
  height: 75vh;
  background: #ffffff;
  border-top-left-radius: 32rpx;
  border-top-right-radius: 32rpx;
  display: flex;
  flex-direction: column;
}
.picker-head {
  padding: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #F2F3F5;
}
.picker-title { font-size: 30rpx; font-weight: 700; color: #1F2329; }
.picker-close {
  display: flex; align-items: center; justify-content: center;
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  &:active { background: #F2F3F5; }
}
.picker-search { padding: 16rpx 24rpx; border-bottom: 1rpx solid #F2F3F5; }
.picker-search-box {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #F2F3F5;
  border-radius: 24rpx;
  padding: 0 20rpx;
  height: 80rpx;
}
.picker-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
  color: #1F2329;
  background: transparent;
}
.picker-list { flex: 1; overflow-y: auto; }
.picker-state { padding: 64rpx 0; text-align: center; color: #86909C; font-size: 26rpx; }
.picker-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
  &:active { background: #F7F8FA; }
}
.pi-avatar {
  width: 80rpx; height: 80rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.pi-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pi-name { font-size: 28rpx; color: #1F2329; font-weight: 500; }
.pi-sub { margin-top: 6rpx; font-size: 22rpx; color: #86909C; }
</style>
