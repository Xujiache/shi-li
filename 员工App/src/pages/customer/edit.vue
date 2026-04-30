<template>
  <view class="page" v-if="loaded">
    <view class="page-tip">编辑客户资料，*为必填</view>

    <view class="section">
      <view class="section-title">基本资料</view>
      <view class="section-card">
        <view class="form-row">
          <text class="label">姓名 <text class="req">*</text></text>
          <input class="input" v-model="form.display_name" placeholder="请输入姓名" />
        </view>
        <view class="form-row">
          <text class="label">手机号 <text class="req">*</text></text>
          <input class="input" type="number" v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
        </view>
        <view class="form-row">
          <text class="label">性别</text>
          <picker mode="selector" :value="genderIdx" :range="genderOptions" range-key="label" @change="(e) => genderIdx = e.detail.value">
            <view class="picker">
              <text>{{ genderOptions[genderIdx].label }}</text>
              <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
            </view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">年龄</text>
          <input class="input" type="number" v-model="form.age" placeholder="请输入年龄" />
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">学校信息</view>
      <view class="section-card">
        <view class="form-row">
          <text class="label">学校</text>
          <input class="input" v-model="form.school" placeholder="请输入学校" />
        </view>
        <view class="form-row">
          <text class="label">班级</text>
          <input class="input" v-model="form.class_name" placeholder="请输入班级" />
        </view>
        <view class="form-row">
          <text class="label">来源</text>
          <input class="input" v-model="form.source" placeholder="如：抖音 / 转介绍" />
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">状态与等级</view>
      <view class="section-card">
        <view class="seg-row">
          <text class="seg-label">状态</text>
          <view class="seg-chips">
            <view
              v-for="(s, i) in statusOptions"
              :key="s.value"
              class="seg-chip"
              :class="{ [`seg-${s.tone}`]: statusIdx === i }"
              @click="statusIdx = i"
            >{{ s.label }}</view>
          </view>
        </view>
        <view class="seg-row">
          <text class="seg-label">等级</text>
          <view class="seg-chips">
            <view
              v-for="(l, i) in levelOptions"
              :key="l.value"
              class="seg-chip"
              :class="{ [`level-${l.value}`]: levelIdx === i }"
              @click="levelIdx = i"
            >{{ l.label }}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">客户标签</view>
      <view class="section-card">
        <view class="chip-pool">
          <text
            v-for="t in tagPool"
            :key="t"
            class="chip"
            :class="{ active: form.tags.includes(t) }"
            @click="toggleTag(t)"
          >{{ t }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">备注</view>
      <view class="section-card">
        <textarea class="textarea" v-model="form.remark" placeholder="请输入备注（选填）" maxlength="500" />
      </view>
    </view>

    <view class="submit-bar">
      <view class="btn-primary" :class="{ disabled: submitting }" @click="onSubmit">
        {{ submitting ? '保存中...' : '保 存' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as customerApi from '@/api/customer'
import { useCustomersStore } from '@/stores/customers'
import { v4 } from '@/utils/uuid'
import SvgIcon from '@/components/svg-icon.vue'

const customersStore = useCustomersStore()

const genderOptions = [
  { label: '请选择', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' }
]
const statusOptions = [
  { label: '潜在', value: 'potential', tone: 'gray' },
  { label: '意向', value: 'interested', tone: 'orange' },
  { label: '成交', value: 'signed', tone: 'green' },
  { label: '流失', value: 'lost', tone: 'red' }
]
const levelOptions = [
  { label: 'C', value: 'C' },
  { label: 'B', value: 'B' },
  { label: 'A', value: 'A' }
]
const tagPool = ['近视', '散光', '高度近视', '配镜', '复诊', '高需求', '价格敏感']

const id = ref<string>('')
const loaded = ref(false)
const submitting = ref(false)

const genderIdx = ref(0)
const statusIdx = ref(0)
const levelIdx = ref(0)

const form = reactive({
  display_name: '',
  phone: '',
  age: '' as any,
  school: '',
  class_name: '',
  source: '',
  remark: '',
  tags: [] as string[]
})

function toggleTag(t: string) {
  const idx = form.tags.indexOf(t)
  if (idx >= 0) form.tags.splice(idx, 1)
  else form.tags.push(t)
}

function indexOfValue<T extends { value: string }>(opts: T[], v: any): number {
  const i = opts.findIndex((o) => o.value === v)
  return i >= 0 ? i : 0
}

function parseTags(t: any): string[] {
  if (!t) return []
  if (Array.isArray(t)) return t
  try {
    const p = JSON.parse(t)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

async function loadDetail() {
  try {
    const c = await customerApi.detail(id.value)
    form.display_name = c.display_name || ''
    form.phone = c.phone || ''
    form.age = c.age || ''
    form.school = c.school || ''
    form.class_name = c.class_name || ''
    form.source = c.source || ''
    form.remark = c.remark || ''
    form.tags = parseTags(c.tags)
    genderIdx.value = indexOfValue(genderOptions, c.gender)
    statusIdx.value = indexOfValue(statusOptions, c.status)
    levelIdx.value = indexOfValue(levelOptions, c.level)
    loaded.value = true
  } catch (e) { /* */ }
}

async function onSubmit() {
  if (!form.display_name.trim()) {
    return uni.showToast({ title: '请填写姓名', icon: 'none' })
  }
  if (!/^1\d{10}$/.test(form.phone)) {
    return uni.showToast({ title: '请填写有效手机号', icon: 'none' })
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const payload: any = {
      display_name: form.display_name.trim(),
      phone: form.phone.trim(),
      status: statusOptions[statusIdx.value].value,
      level: levelOptions[levelIdx.value].value,
      tags: form.tags,
      client_uuid: v4()
    }
    if (genderOptions[genderIdx.value].value) payload.gender = genderOptions[genderIdx.value].value
    payload.age = form.age ? Number(form.age) : null
    payload.school = form.school
    payload.class_name = form.class_name
    payload.source = form.source
    payload.remark = form.remark

    const res = await customersStore.updateCustomer(id.value, payload)
    if (res.status === 'ok') {
      uni.showToast({ title: '已保存', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) { /* */ } finally {
    submitting.value = false
  }
}

onLoad((q: any) => {
  id.value = String(q?.id || '')
  if (id.value) loadDetail()
})
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
.label { width: 160rpx; color: #4E5969; font-size: 28rpx; flex-shrink: 0; }
.req { color: #F53F3F; margin-left: 4rpx; }
.input { flex: 1; font-size: 28rpx; color: #1F2329; text-align: right; background: transparent; }
.picker { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 6rpx; font-size: 28rpx; color: #1F2329; }
.seg-row { padding: 24rpx 0; border-bottom: 1rpx solid #F2F3F5; &:last-child { border-bottom: none; } }
.seg-label { font-size: 28rpx; color: #4E5969; display: block; margin-bottom: 16rpx; }
.seg-chips { display: flex; gap: 12rpx; flex-wrap: wrap; }
.seg-chip {
  padding: 12rpx 32rpx;
  border-radius: 24rpx;
  background: #F2F3F5;
  font-size: 26rpx;
  color: #4E5969;
  transition: all 0.15s;
  &:active { opacity: 0.8; }
}
.seg-gray { background: #4E5969 !important; color: #fff !important; }
.seg-orange { background: #FA8C16 !important; color: #fff !important; }
.seg-green { background: #00B42A !important; color: #fff !important; }
.seg-red { background: #F53F3F !important; color: #fff !important; }
.level-A { background: #F53F3F !important; color: #fff !important; }
.level-B { background: #FA8C16 !important; color: #fff !important; }
.level-C { background: #1677FF !important; color: #fff !important; }
.chip-pool { display: flex; flex-wrap: wrap; gap: 12rpx; padding: 24rpx 0; }
.chip {
  background: #F2F3F5; color: #4E5969;
  padding: 10rpx 22rpx; border-radius: 24rpx;
  font-size: 24rpx; transition: all 0.15s;
  &:active { transform: scale(0.96); }
  &.active { background: #1677FF; color: #ffffff; }
}
.textarea {
  width: 100%; margin: 16rpx 0;
  background: #F7F8FA; border-radius: 16rpx;
  padding: 20rpx; height: 180rpx;
  font-size: 28rpx; color: #1F2329;
  box-sizing: border-box;
}
.submit-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding: 16rpx 24rpx 32rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(20, 30, 60, 0.05);
}
.btn-primary {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff; text-align: center;
  padding: 28rpx; border-radius: 24rpx;
  font-size: 32rpx; font-weight: 600; letter-spacing: 8rpx;
  box-shadow: 0 6rpx 20rpx rgba(22, 119, 255, 0.35);
  transition: transform 0.15s, opacity 0.15s;
  &:active { transform: scale(0.98); }
  &.disabled { opacity: 0.6; box-shadow: none; }
}
</style>
