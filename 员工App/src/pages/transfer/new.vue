<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="label">客户</text>
        <view class="value-wrap" @tap="onPickCustomer">
          <text v-if="customerName" class="value">{{ customerName }}</text>
          <text v-else class="value placeholder">点击选择客户</text>
          <view class="arrow">
            <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          </view>
        </view>
      </view>
      <view class="row col">
        <text class="label">转出原因 <text class="req">*</text></text>
        <textarea
          v-model="reason"
          class="textarea"
          placeholder="请详细说明转出原因（必填）"
          :maxlength="500"
          auto-height
        />
        <text class="counter">{{ reason.length }} / 500</text>
      </view>
    </view>
    <view class="actions">
      <button class="btn-primary" :disabled="submitting || !canSubmit" @tap="onSubmit">
        {{ submitting ? '提交中…' : '提交申请' }}
      </button>
    </view>

    <!-- 客户选择弹层（与写跟进页共用样式） -->
    <view v-if="pickerVisible" class="picker-mask" @click.self="pickerVisible = false">
      <view class="picker-panel">
        <view class="picker-head">
          <text class="picker-title">选择要转出的客户</text>
          <view class="picker-close" @click="pickerVisible = false">
            <svg-icon name="x" :size="36" color="#86909C" />
          </view>
        </view>
        <view class="picker-search">
          <input
            class="picker-input"
            v-model="pickerQ"
            placeholder="搜索 姓名 / 手机 / 编号"
            confirm-type="search"
          />
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

const auth = useAuthStore()

const customerId = ref<string | number>('')
const customerName = ref<string>('')
const reason = ref<string>('')
const submitting = ref(false)

const canSubmit = computed(() => !!customerId.value && reason.value.trim().length > 0)

onLoad((q: any) => {
  if (q && q.customer_id) {
    customerId.value = q.customer_id
    if (q.customer_name) {
      customerName.value = decodeURIComponent(q.customer_name)
    } else {
      loadCustomer(q.customer_id)
    }
  }
})

async function loadCustomer(id: string | number) {
  try {
    const data = await customerApi.detail(id)
    customerName.value = data?.name || data?.full_name || `客户#${id}`
  } catch (e) {
    customerName.value = `客户#${id}`
  }
}

// ===== 客户选择器 =====
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
  } catch (e) {
    // http.ts 拦截器已 toast
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; min-height: 100vh; background: #F5F7FA; }
.card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  display: flex; flex-direction: column; gap: 24rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16rpx 0; border-bottom: 1rpx solid #F0F2F5;
  &.col { flex-direction: column; align-items: stretch; gap: 12rpx; border-bottom: none; }
  &:last-child { border-bottom: none; }
}
.label { font-size: 28rpx; color: #1F2329; font-weight: 500; }
.req { color: #F53F3F; }
.value-wrap { flex: 1; text-align: right; }
.value { font-size: 28rpx; color: #1F2329; }
.select-btn { font-size: 24rpx; color: #1677FF; background: #E8F3FF; }
.textarea {
  background: #F7F8FA; border-radius: 12rpx; padding: 20rpx;
  font-size: 28rpx; min-height: 200rpx; width: 100%; box-sizing: border-box;
}
.counter { font-size: 22rpx; color: #86909C; text-align: right; }
.actions { padding: 40rpx 24rpx; }
.btn-primary {
  background: #1677FF; color: #fff; border-radius: 48rpx;
  font-size: 30rpx; height: 88rpx; line-height: 88rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &[disabled] { background: #C9CDD4; color: #fff; }
}
.placeholder { color: #C9CDD4; }
.arrow {
  margin-left: 8rpx;
  display: inline-flex;
  align-items: center;
}

/* ===== 客户选择弹层 ===== */
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
  height: 70vh;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
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
.picker-title { font-size: 30rpx; font-weight: 600; color: #1F2329; }
.picker-close {
  padding: 8rpx 12rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.picker-search {
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.picker-input {
  height: 64rpx;
  background: #F2F3F5;
  border-radius: 32rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
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
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: #E8F3FF; color: #1677FF;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.pi-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pi-name { font-size: 28rpx; color: #1F2329; }
.pi-sub { margin-top: 4rpx; font-size: 22rpx; color: #86909C; }
</style>
