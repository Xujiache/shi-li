<template>
  <view class="page">
    <view class="page-tip">{{ editId ? '编辑跟进记录' : '记录一次客户跟进' }}</view>

    <!-- 客户 + 时间 -->
    <view class="section">
      <view class="section-title">基本信息</view>
      <view class="section-card">
        <view class="form-row" @click="onPickCustomer">
          <text class="label">客户 <text class="req">*</text></text>
          <view class="picker">
            <text v-if="customer">{{ customer.display_name }} · {{ customer.phone }}</text>
            <text v-else class="ph">点击选择客户</text>
            <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
          </view>
        </view>
        <picker mode="multiSelector" :value="dtIdx" :range="dtRange" @change="onDtChange" @columnchange="onDtColumnChange">
          <view class="form-row">
            <text class="label">跟进时间</text>
            <view class="picker">
              <text>{{ followAt }}</text>
              <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
            </view>
          </view>
        </picker>
      </view>
    </view>

    <!-- 类型 -->
    <view class="section">
      <view class="section-title">跟进方式</view>
      <view class="section-card">
        <view class="seg-row">
          <view class="seg-chips">
            <view
              v-for="t in typeOptions"
              :key="t.value"
              class="seg-chip"
              :class="{ active: form.type === t.value }"
              @click="form.type = t.value"
            >
              <svg-icon
                v-if="t.icon"
                :name="t.icon"
                :size="22"
                :color="form.type === t.value ? '#ffffff' : '#86909C'"
                style="margin-right: 4rpx; vertical-align: middle;"
              />
              <text>{{ t.label }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 结果 -->
    <view class="section">
      <view class="section-title">跟进结果</view>
      <view class="section-card">
        <view class="seg-row">
          <view class="seg-chips">
            <view
              v-for="r in resultOptions"
              :key="r.value"
              class="seg-chip"
              :class="{ [`res-${r.tone}`]: form.result === r.value }"
              @click="form.result = r.value"
            >{{ r.label }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 内容 -->
    <view class="section">
      <view class="section-title">沟通内容 <text class="req">*</text></view>
      <view class="section-card">
        <textarea class="textarea" v-model="form.content" placeholder="请记录沟通要点、客户反馈、下一步计划等" maxlength="1000" />
      </view>
    </view>

    <!-- 下次跟进 + 附件 -->
    <view class="section">
      <view class="section-title">下次跟进与附件</view>
      <view class="section-card">
        <picker mode="date" :value="nextDate" @change="(e) => nextDate = e.detail.value">
          <view class="form-row">
            <text class="label">下次跟进</text>
            <view class="picker">
              <text :class="{ ph: !nextDate }">{{ nextDate || '可选' }}</text>
              <text v-if="nextDate" class="clear-mini" @click.stop="nextDate = ''">清除</text>
              <svg-icon v-else name="chevron-right" :size="22" color="#C9CDD4" />
            </view>
          </view>
        </picker>

        <view class="att-row">
          <text class="att-title">图片附件 ({{ attachments.length }})</text>
          <view class="att-grid">
            <view v-for="(a, i) in attachments" :key="i" class="att-item">
              <image :src="a.url || a.localPath" mode="aspectFill" class="att-img" />
              <view class="att-del" @click="removeAttachment(i)">
                <svg-icon name="x" :size="20" color="#ffffff" />
              </view>
            </view>
            <view class="att-item add-item" @click="onAddImage">
              <view class="add-plus">
                <svg-icon name="camera" :size="44" color="#C9CDD4" />
                <text class="add-plus-text">添加</text>
              </view>
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
          <view class="picker-search-box">
            <svg-icon name="search" :size="26" color="#86909C" />
            <input
              class="picker-input"
              v-model="pickerQ"
              placeholder="搜索 姓名 / 手机 / 编号"
              confirm-type="search"
            />
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
  { label: '电话', value: 'phone', icon: 'phone' },
  { label: '微信', value: 'wechat', icon: 'send' },
  { label: '当面', value: 'face', icon: 'user' },
  { label: '其他', value: 'other', icon: 'more-horizontal' }
]
const resultOptions = [
  { label: '无进展', value: 'no_progress', tone: 'gray' },
  { label: '有意向', value: 'interested', tone: 'orange' },
  { label: '需复跟', value: 'follow_up', tone: 'blue' },
  { label: '已成交', value: 'signed', tone: 'green' },
  { label: '已流失', value: 'lost', tone: 'red' }
]

const customer = ref<any>(null)
const submitting = ref(false)
const editId = ref<number | string>('')

const form = reactive({
  type: 'phone',
  result: 'no_progress',
  content: ''
})

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
  return `${yearList[i[0]]}-${monthList[i[1]]}-${dayList[i[2]]} ${hourList[i[3]]}:${minList[i[4]]}`
})

function onDtChange(e: any) { dtIdx.value = e.detail.value }
function onDtColumnChange(_e: any) { /* */ }

const nextDate = ref('')

const attachments = ref<{ url?: string; name?: string; type?: string; size?: number; localPath?: string }[]>([])

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

    if (editId.value) {
      const patch: any = {
        follow_at: followAt.value + ':00',
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

    const localPaths = attachments.value.filter((a) => !a.url && a.localPath).map((a) => a.localPath as string)
    const payload: any = {
      customer_id: customer.value.id,
      follow_at: followAt.value + ':00',
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
  } catch (e) { /* */ } finally {
    submitting.value = false
  }
}

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
  if (q?.customer_id) {
    try {
      customer.value = await customerApi.detail(q.customer_id)
    } catch (e) { /* */ }
  }
  if (q?.id) {
    editId.value = q.id
    uni.setNavigationBarTitle({ title: '编辑跟进' })
    try {
      const fu: any = await followUpApi.detail(q.id)
      if (fu) {
        if (fu.customer_id) {
          try {
            customer.value = await customerApi.detail(fu.customer_id)
          } catch (e) { /* */ }
        }
        form.type = fu.type || 'phone'
        form.result = fu.result || 'no_progress'
        form.content = fu.content || ''
        if (fu.follow_at) applyFollowAt(fu.follow_at)
        if (fu.next_follow_up_at) {
          const m = String(fu.next_follow_up_at).match(/^(\d{4}-\d{2}-\d{2})/)
          if (m) nextDate.value = m[1]
        }
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
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}
.page-tip { padding: 24rpx 32rpx; font-size: 24rpx; color: #86909C; }

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
  padding: 8rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.form-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
}
.label { width: 160rpx; color: #4E5969; flex-shrink: 0; }
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
.ph { color: #C9CDD4; }
.clear-mini { color: #1677FF; font-size: 22rpx; margin-left: 12rpx; }

.seg-row { padding: 24rpx 0; }
.seg-chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.seg-chip {
  padding: 12rpx 28rpx;
  border-radius: 24rpx;
  background: #F2F3F5;
  font-size: 26rpx;
  color: #4E5969;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  &:active { opacity: 0.8; }
  &.active {
    background: linear-gradient(135deg, #1677FF, #4096FF);
    color: #ffffff;
  }
}
.res-gray { background: #4E5969 !important; color: #fff !important; }
.res-orange { background: #FA8C16 !important; color: #fff !important; }
.res-blue { background: linear-gradient(135deg, #1677FF, #4096FF) !important; color: #fff !important; }
.res-green { background: #00B42A !important; color: #fff !important; }
.res-red { background: #F53F3F !important; color: #fff !important; }

.textarea {
  width: 100%;
  margin: 16rpx 0;
  background: #F7F8FA;
  border-radius: 16rpx;
  padding: 20rpx;
  height: 220rpx;
  font-size: 28rpx;
  color: #1F2329;
  box-sizing: border-box;
}

.att-row { padding: 24rpx 0; }
.att-title { font-size: 26rpx; color: #4E5969; }
.att-grid {
  margin-top: 16rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}
.att-item {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #F2F3F5;
  border-radius: 16rpx;
  overflow: hidden;
}
.att-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.att-del {
  position: absolute;
  top: 6rpx; right: 6rpx;
  width: 36rpx; height: 36rpx;
  background: rgba(0,0,0,0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-item { background: #ffffff; border: 2rpx dashed #E5E6EB; }
.add-plus {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4rpx;
}
.add-plus-text { font-size: 20rpx; color: #C9CDD4; }

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
  &.disabled { opacity: 0.6; box-shadow: none; }
}

/* 客户选择弹层 */
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
.picker-search {
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
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
