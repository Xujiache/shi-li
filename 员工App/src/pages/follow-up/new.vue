<template>
  <view class="page">
    <view class="card">
      <!-- 客户 -->
      <view class="row">
        <text class="label">客户 *</text>
        <view class="input flex-row" @click="onPickCustomer">
          <text v-if="customer">{{ customer.display_name }} ({{ customer.phone }})</text>
          <text v-else class="ph">点击选择客户</text>
        </view>
      </view>

      <!-- 跟进时间 -->
      <view class="row">
        <text class="label">跟进时间</text>
        <picker class="input" mode="multiSelector" :value="dtIdx" :range="dtRange" @change="onDtChange" @columnchange="onDtColumnChange">
          <text>{{ followAt }}</text>
        </picker>
      </view>

      <!-- 类型 chip -->
      <view class="row col">
        <text class="label">类型 *</text>
        <view class="chips">
          <text
            v-for="t in typeOptions"
            :key="t.value"
            class="chip"
            :class="{ active: form.type === t.value }"
            @click="form.type = t.value"
          >{{ t.label }}</text>
        </view>
      </view>

      <!-- 结果 chip -->
      <view class="row col">
        <text class="label">结果 *</text>
        <view class="chips">
          <text
            v-for="r in resultOptions"
            :key="r.value"
            class="chip"
            :class="{ active: form.result === r.value }"
            @click="form.result = r.value"
          >{{ r.label }}</text>
        </view>
      </view>

      <!-- 内容 -->
      <view class="row col">
        <text class="label">内容 *</text>
        <textarea class="textarea" v-model="form.content" placeholder="请输入跟进内容" />
      </view>

      <!-- 下次跟进 -->
      <view class="row">
        <text class="label">下次跟进</text>
        <picker class="input" mode="date" :value="nextDate" @change="(e) => nextDate = e.detail.value">
          <text>{{ nextDate || '可选' }}</text>
        </picker>
        <text v-if="nextDate" class="clear-mini" @click.stop="nextDate = ''">清除</text>
      </view>

      <!-- 附件 -->
      <view class="row col">
        <text class="label">附件</text>
        <view class="grid">
          <view v-for="(a, i) in attachments" :key="i" class="grid-item">
            <image :src="a.url" mode="aspectFill" class="att-img" />
            <view class="att-del" @click="removeAttachment(i)">
              <svg-icon name="x" :size="20" color="#ffffff" />
            </view>
          </view>
          <view class="grid-item add-item" @click="onAddImage">
            <view class="add-plus">
              <svg-icon name="camera" :size="48" color="#C9CDD4" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="submit-bar">
      <view class="btn-primary" :class="{ disabled: submitting }" @click="onSubmit">
        {{ submitting ? '提交中...' : (editId ? '保存修改' : '保存跟进') }}
      </view>
    </view>

    <!-- 客户选择弹层 -->
    <view v-if="pickerVisible" class="picker-mask" @click.self="pickerVisible = false">
      <view class="picker-panel">
        <view class="picker-head">
          <text class="picker-title">选择客户</text>
          <view class="picker-close" @click="pickerVisible = false">
            <svg-icon name="x" :size="32" color="#86909C" />
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
import { reactive, ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as customerApi from '@/api/customer'
import * as followUpApi from '@/api/followUp'
import { uploadImage, uploadFileBlob } from '@/api/upload'
import { useFollowUpsStore } from '@/stores/followUps'
import { v4 } from '@/utils/uuid'
import SvgIcon from '@/components/svg-icon.vue'

const followUpsStore = useFollowUpsStore()

const typeOptions = [
  { label: '电话', value: 'phone' },
  { label: '微信', value: 'wechat' },
  { label: '当面', value: 'face' },
  { label: '其他', value: 'other' }
]
const resultOptions = [
  { label: '无进展', value: 'no_progress' },
  { label: '有意向', value: 'interested' },
  { label: '需复跟', value: 'follow_up' },
  { label: '已成交', value: 'signed' },
  { label: '已流失', value: 'lost' }
]

const customer = ref<any>(null)
const submitting = ref(false)
const editId = ref<number | string>('')  // 非空 = 编辑模式

const form = reactive({
  type: 'phone',
  result: 'no_progress',
  content: ''
})

// 时间选择 - 默认 now
function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }
function nowParts() {
  const d = new Date()
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes()
  }
}

const yearList = Array.from({ length: 5 }, (_, i) => `${new Date().getFullYear() - 2 + i}`)
const monthList = Array.from({ length: 12 }, (_, i) => pad(i + 1))
const dayList = Array.from({ length: 31 }, (_, i) => pad(i + 1))
const hourList = Array.from({ length: 24 }, (_, i) => pad(i))
const minList = Array.from({ length: 60 }, (_, i) => pad(i))

const dtRange = computed(() => [yearList, monthList, dayList, hourList, minList])
const dtIdx = ref<number[]>([])

;(function initDt() {
  const n = nowParts()
  dtIdx.value = [
    yearList.indexOf(`${n.year}`),
    monthList.indexOf(pad(n.month)),
    dayList.indexOf(pad(n.day)),
    hourList.indexOf(pad(n.hour)),
    minList.indexOf(pad(n.minute))
  ]
})()

const followAt = computed(() => {
  const i = dtIdx.value
  if (!i.length) return ''
  return `${yearList[i[0]]}-${monthList[i[1]]}-${dayList[i[2]]} ${hourList[i[3]]}:${minList[i[4]]}:00`
})

function onDtChange(e: any) { dtIdx.value = e.detail.value }
function onDtColumnChange(_e: any) { /* uni picker 自动维持 */ }

const nextDate = ref('')

const attachments = ref<{ url?: string; name?: string; type?: string; size?: number; localPath?: string }[]>([])

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
  customer.value = c
  pickerVisible.value = false
}

function onAddImage() {
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.style.display = 'none'
  document.body.appendChild(input)
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || [])
    document.body.removeChild(input)
    if (!files.length) return
    uni.showLoading({ title: '上传中' })
    try {
      for (const f of files) {
        try {
          const up = await uploadFileBlob(f, f.name || 'image.jpg')
          attachments.value.push({
            url: up.url, name: up.name, type: up.type, size: up.size,
            localPath: URL.createObjectURL(f)
          })
        } catch (e) {
          attachments.value.push({ localPath: URL.createObjectURL(f) })
        }
      }
    } finally {
      uni.hideLoading()
    }
  })
  input.click()
  return
  // #endif
  // #ifndef H5
  uni.chooseImage({
    count: 9,
    success: async (res) => {
      uni.showLoading({ title: '上传中' })
      try {
        for (const fp of res.tempFilePaths) {
          try {
            const up = await uploadImage(fp)
            attachments.value.push({
              url: up.url, name: up.name, type: up.type, size: up.size, localPath: fp
            })
          } catch (e) {
            attachments.value.push({ localPath: fp })
          }
        }
      } finally {
        uni.hideLoading()
      }
    }
  })
  // #endif
}

function removeAttachment(i: number) {
  attachments.value.splice(i, 1)
}

async function onSubmit() {
  if (!customer.value) return uni.showToast({ title: '请选择客户', icon: 'none' })
  if (!form.type) return uni.showToast({ title: '请选择类型', icon: 'none' })
  if (!form.result) return uni.showToast({ title: '请选择结果', icon: 'none' })
  if (!form.content.trim()) return uni.showToast({ title: '请填写内容', icon: 'none' })
  if (submitting.value) return
  submitting.value = true
  try {
    const uploaded = attachments.value.filter((a) => a.url)

    // 编辑模式：直接调 update 接口（不走离线 store；编辑通常在线）
    if (editId.value) {
      const patch: any = {
        follow_at: followAt.value,
        type: form.type,
        result: form.result,
        content: form.content.trim(),
        attachments: uploaded,
        next_follow_up_at: nextDate.value ? `${nextDate.value} 09:00:00` : null
      }
      await followUpApi.update(editId.value, patch)
      uni.showToast({ title: '已更新', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
      return
    }

    // 新建模式：走 store（含离线降级 + client_uuid 幂等）
    const localPaths = attachments.value.filter((a) => !a.url && a.localPath).map((a) => a.localPath as string)
    const payload: any = {
      customer_id: customer.value.id,
      follow_at: followAt.value,
      type: form.type,
      result: form.result,
      content: form.content.trim(),
      attachments: uploaded,
      attachments_local_paths: localPaths,
      client_uuid: v4()
    }
    if (nextDate.value) {
      payload.next_follow_up_at = `${nextDate.value} 09:00:00`
    }
    const ret = await followUpsStore.createFollowUp(payload, { uuid: payload.client_uuid })
    if (ret.status === 'ok') uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) { /* http 拦截器已 toast */ } finally {
    submitting.value = false
  }
}

/** 把 'YYYY-MM-DD HH:mm:ss' 写回 dtIdx + followAt */
function applyFollowAt(s: string) {
  if (!s) return
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return
  const yi = yearList.indexOf(m[1])
  const mi = monthList.indexOf(m[2])
  const di = dayList.indexOf(m[3])
  const hi = hourList.indexOf(m[4])
  const mni = minList.indexOf(m[5])
  if (yi >= 0 && mi >= 0 && di >= 0 && hi >= 0 && mni >= 0) {
    dtIdx.value = [yi, mi, di, hi, mni]
  }
}

onLoad(async (q: any) => {
  // 来源 1：从客户详情进 → 预填客户
  if (q?.customer_id) {
    try {
      customer.value = await customerApi.detail(q.customer_id)
    } catch (e) { /* */ }
  }
  // 来源 2：编辑某条跟进
  if (q?.id) {
    editId.value = q.id
    uni.setNavigationBarTitle({ title: '编辑跟进' })
    try {
      const fu: any = await followUpApi.detail(q.id)
      if (fu) {
        // 客户
        if (fu.customer_id) {
          try {
            customer.value = await customerApi.detail(fu.customer_id)
          } catch (e) { /* */ }
        }
        // 表单
        form.type = fu.type || 'phone'
        form.result = fu.result || 'no_progress'
        form.content = fu.content || ''
        // 跟进时间
        if (fu.follow_at) applyFollowAt(fu.follow_at)
        // 下次跟进
        if (fu.next_follow_up_at) {
          const m = String(fu.next_follow_up_at).match(/^(\d{4}-\d{2}-\d{2})/)
          if (m) nextDate.value = m[1]
        }
        // 附件
        const atts = Array.isArray(fu.attachments) ? fu.attachments : []
        attachments.value = atts.map((a: any) => ({
          url: a.url, name: a.name, type: a.type, size: a.size
        }))
      }
    } catch (e) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
</script>

<style lang="scss" scoped>
.page { padding: 16rpx; padding-bottom: 160rpx; }

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
}
.row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
  &.col { flex-direction: column; align-items: flex-start; }
}
.label {
  width: 160rpx;
  color: #86909C;
  flex-shrink: 0;
}
.input {
  flex: 1;
  font-size: 28rpx;
  color: #1F2329;
}
.flex-row { display: flex; align-items: center; gap: 16rpx; }
.ph { color: #C9CDD4; }
.textarea {
  width: 100%;
  margin-top: 12rpx;
  background: #F7F8FA;
  border-radius: 8rpx;
  padding: 16rpx;
  height: 200rpx;
  font-size: 28rpx;
}
.chips {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.chip {
  background: #F2F3F5;
  color: #4E5969;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.96); }
  &.active {
    background: #1677FF;
    color: #ffffff;
  }
}
.clear-mini { color: #1677FF; font-size: 22rpx; margin-left: 12rpx; }

.grid {
  margin-top: 12rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  width: 100%;
}
.grid-item {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #F2F3F5;
  border-radius: 12rpx;
  overflow: hidden;
}
.att-img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
.att-del {
  position: absolute;
  top: 4rpx; right: 4rpx;
  width: 32rpx; height: 32rpx;
  background: rgba(0,0,0,0.5);
  color: #ffffff;
  text-align: center;
  line-height: 32rpx;
  border-radius: 50%;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-item { background: #F2F3F5; &:active { opacity: 0.85; } }
.add-plus {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  color: #C9CDD4;
}

.submit-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding: 16rpx 24rpx;
  background: #ffffff;
  border-top: 1rpx solid #F2F3F5;
}
.btn-primary {
  background: #1677FF;
  color: #ffffff;
  text-align: center;
  padding: 24rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
  &.disabled { opacity: 0.6; }
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx; height: 56rpx;
  &:active { opacity: 0.85; }
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
