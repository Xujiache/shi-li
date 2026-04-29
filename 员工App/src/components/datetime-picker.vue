<template>
  <view v-if="visible" class="dtp-mask" @click.self="onCancel">
    <view class="dtp-panel">
      <view class="dtp-head">
        <text class="dtp-cancel" @click="onCancel">取消</text>
        <text class="dtp-title">{{ title || '选择时间' }}</text>
        <text class="dtp-confirm" @click="onConfirm">确定</text>
      </view>

      <view class="dtp-body">
        <view class="dtp-row">
          <text class="dtp-label">日期</text>
          <picker
            mode="date"
            :value="date"
            :start="startDate"
            @change="(e: any) => date = e.detail.value"
          >
            <view class="dtp-pick">{{ date || '点击选择' }}</view>
          </picker>
        </view>
        <view class="dtp-row">
          <text class="dtp-label">时间</text>
          <picker
            mode="time"
            :value="time"
            @change="(e: any) => time = e.detail.value"
          >
            <view class="dtp-pick">{{ time || '点击选择' }}</view>
          </picker>
        </view>
      </view>

      <view v-if="allowClear && initialValue" class="dtp-clear" @click="onClear">
        清除提醒
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  modelValue?: string | null  // 'YYYY-MM-DD HH:mm:ss' 或 'YYYY-MM-DD HH:mm'
  title?: string
  allowClear?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm', v: string | null): void
}>()

const date = ref('')
const time = ref('')
const initialValue = ref<string | null>(null)

const today = new Date()
function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }
const startDate = `${today.getFullYear() - 1}-01-01`

function parseInit(v?: string | null) {
  if (!v) {
    // 默认：今天 10:00
    date.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    time.value = '10:00'
    return
  }
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  if (m) {
    date.value = m[1]
    time.value = `${m[2]}:${m[3]}`
  } else {
    date.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    time.value = '10:00'
  }
}

watch(() => props.visible, (v) => {
  if (v) {
    initialValue.value = props.modelValue || null
    parseInit(props.modelValue)
  }
})

function onCancel() {
  emit('update:visible', false)
}

function onConfirm() {
  if (!date.value || !time.value) {
    uni.showToast({ title: '请选择日期和时间', icon: 'none' })
    return
  }
  // 输出标准格式 YYYY-MM-DD HH:mm:00
  const v = `${date.value} ${time.value}:00`
  emit('confirm', v)
  emit('update:visible', false)
}

function onClear() {
  emit('confirm', null)
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.dtp-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}
.dtp-panel {
  width: 100%;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  padding-bottom: env(safe-area-inset-bottom);
}
.dtp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.dtp-title { font-size: 30rpx; font-weight: 600; color: #1F2329; }
.dtp-cancel { font-size: 28rpx; color: #86909C; }
.dtp-confirm { font-size: 28rpx; color: #1677FF; font-weight: 600; }

.dtp-body {
  padding: 24rpx;
}
.dtp-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  &:last-child { border-bottom: none; }
}
.dtp-label {
  width: 120rpx;
  font-size: 28rpx;
  color: #4E5969;
  flex-shrink: 0;
}
.dtp-pick {
  flex: 1;
  font-size: 28rpx;
  color: #1677FF;
  text-align: right;
}

.dtp-clear {
  margin: 0 24rpx 24rpx;
  padding: 24rpx;
  background: #FFF1F0;
  color: #F5222D;
  border-radius: 12rpx;
  font-size: 28rpx;
  text-align: center;
}
</style>
