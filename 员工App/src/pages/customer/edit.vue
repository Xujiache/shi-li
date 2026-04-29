<template>
  <view class="page">
    <view class="card" v-if="loaded">
      <view class="row">
        <text class="label">姓名 *</text>
        <input class="input" v-model="form.display_name" placeholder="请输入姓名" />
      </view>
      <view class="row">
        <text class="label">手机号 *</text>
        <input class="input" type="number" v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
      </view>
      <view class="row">
        <text class="label">性别</text>
        <picker class="input" mode="selector" :value="genderIdx" :range="genderOptions" range-key="label" @change="(e) => genderIdx = e.detail.value">
          <text>{{ genderOptions[genderIdx].label }}</text>
        </picker>
      </view>
      <view class="row">
        <text class="label">年龄</text>
        <input class="input" type="number" v-model="form.age" placeholder="请输入年龄" />
      </view>
      <view class="row">
        <text class="label">学校</text>
        <input class="input" v-model="form.school" placeholder="请输入学校" />
      </view>
      <view class="row">
        <text class="label">班级</text>
        <input class="input" v-model="form.class_name" placeholder="请输入班级" />
      </view>
      <view class="row">
        <text class="label">来源</text>
        <input class="input" v-model="form.source" placeholder="如：抖音 / 转介绍" />
      </view>
      <view class="row">
        <text class="label">状态</text>
        <picker class="input" mode="selector" :value="statusIdx" :range="statusOptions" range-key="label" @change="(e) => statusIdx = e.detail.value">
          <text>{{ statusOptions[statusIdx].label }}</text>
        </picker>
      </view>
      <view class="row">
        <text class="label">等级</text>
        <picker class="input" mode="selector" :value="levelIdx" :range="levelOptions" range-key="label" @change="(e) => levelIdx = e.detail.value">
          <text>{{ levelOptions[levelIdx].label }}</text>
        </picker>
      </view>
      <view class="row col">
        <text class="label">标签</text>
        <view class="chips">
          <text
            v-for="t in tagPool"
            :key="t"
            class="chip"
            :class="{ active: form.tags.includes(t) }"
            @click="toggleTag(t)"
          >{{ t }}</text>
        </view>
      </view>
      <view class="row col">
        <text class="label">备注</text>
        <textarea class="textarea" v-model="form.remark" placeholder="请输入备注" />
      </view>
    </view>

    <view class="submit-bar">
      <view class="btn-primary" :class="{ disabled: submitting }" @click="onSubmit">
        {{ submitting ? '提交中...' : '保存' }}
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

const customersStore = useCustomersStore()

const genderOptions = [
  { label: '请选择', value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '其他', value: 'other' }
]
const statusOptions = [
  { label: '潜在', value: 'potential' },
  { label: '意向', value: 'interested' },
  { label: '成交', value: 'signed' },
  { label: '流失', value: 'lost' }
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
.page { padding: 16rpx; padding-bottom: 160rpx; }

.card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
  margin-bottom: 16rpx;
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
.textarea {
  width: 100%;
  margin-top: 12rpx;
  background: #F7F8FA;
  border-radius: 8rpx;
  padding: 16rpx;
  height: 160rpx;
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
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.96); }
  &.active {
    background: #1677FF;
    color: #ffffff;
  }
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
</style>
