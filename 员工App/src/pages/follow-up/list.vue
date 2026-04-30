<template>
  <view class="page">
    <!-- ===== 顶部条 ===== -->
    <view class="top-bar">
      <view class="top-title-row">
        <view class="top-title">跟进记录</view>
        <view v-if="hasDateFilter" class="top-date" @click="clearDate">
          <text>{{ dateLabel }}</text>
          <svg-icon name="x" :size="22" color="#4E5969" />
        </view>
      </view>

      <view class="search-box">
        <view class="search-icon">
          <svg-icon name="search" :size="28" color="#86909C" />
        </view>
        <input
          class="search-input"
          v-model="q"
          placeholder="搜索客户姓名 / 内容"
          confirm-type="search"
          @confirm="onRefresh"
        />
        <view v-if="q" class="search-clear" @click="clearQ">
          <svg-icon name="x" :size="24" color="#86909C" />
        </view>
      </view>

      <view class="filter-row">
        <picker mode="date" :value="startDate" @change="onStartChange" class="date-picker">
          <view class="date-pick" :class="{ active: !!startDate }">
            <svg-icon name="calendar" :size="22" :color="startDate ? '#1677FF' : '#86909C'" />
            <text>{{ startDate || '开始日期' }}</text>
          </view>
        </picker>
        <text class="date-sep">→</text>
        <picker mode="date" :value="endDate" @change="onEndChange" class="date-picker">
          <view class="date-pick" :class="{ active: !!endDate }">
            <svg-icon name="calendar" :size="22" :color="endDate ? '#1677FF' : '#86909C'" />
            <text>{{ endDate || '结束日期' }}</text>
          </view>
        </picker>
      </view>

      <view class="chip-row">
        <view
          v-for="(t, i) in typeOptions"
          :key="t.value || 'all'"
          class="chip"
          :class="{ active: typeIdx === i }"
          @click="onTypeChip(i)"
        >
          <svg-icon
            v-if="t.icon"
            :name="t.icon"
            :size="22"
            :color="typeIdx === i ? '#ffffff' : '#86909C'"
            style="margin-right: 4rpx; vertical-align: middle;"
          />
          <text>{{ t.label }}</text>
        </view>
      </view>
    </view>

    <!-- ===== Timeline ===== -->
    <view class="timeline">
      <view v-for="f in store.list" :key="f.id" class="tl-row" @click="goDetail(f)">
        <view class="tl-spine">
          <view class="tl-dot" :class="`dot-${typeColor(f.type)}`" />
        </view>
        <view class="tl-card-wrap">
          <follow-up-card :follow-up="f" />
        </view>
      </view>
      <empty-state v-if="!store.loading && store.list.length === 0" text="暂无跟进记录" />
      <view v-if="store.loading && store.list.length > 0" class="state">加载中...</view>
      <view v-else-if="store.finished && store.list.length > 0" class="state">— 没有更多了 —</view>
    </view>

    <view class="fab" @click="goNew">
      <svg-icon name="plus" :size="44" color="#ffffff" />
    </view>

    <floating-tabbar active="/pages/follow-up/list" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useFollowUpsStore } from '@/stores/followUps'
import SvgIcon from '@/components/svg-icon.vue'

const store = useFollowUpsStore()

const typeOptions = [
  { label: '全部', value: '', icon: '' },
  { label: '电话', value: 'phone', icon: 'phone' },
  { label: '微信', value: 'wechat', icon: 'send' },
  { label: '当面', value: 'face', icon: 'user' },
  { label: '其他', value: 'other', icon: 'more-horizontal' }
]

const q = ref('')
const typeIdx = ref(0)
const startDate = ref('')
const endDate = ref('')

const hasDateFilter = computed(() => !!(startDate.value || endDate.value))
const dateLabel = computed(() => {
  if (startDate.value && endDate.value) return `${shortDate(startDate.value)} → ${shortDate(endDate.value)}`
  if (startDate.value) return `≥ ${shortDate(startDate.value)}`
  if (endDate.value) return `≤ ${shortDate(endDate.value)}`
  return ''
})

function shortDate(s: string) { return s ? s.slice(5) : '' }
function clearDate() { startDate.value = ''; endDate.value = ''; onRefresh() }
function onStartChange(e: any) { startDate.value = e.detail.value; onRefresh() }
function onEndChange(e: any) { endDate.value = e.detail.value; onRefresh() }

function typeColor(t: string) {
  return ({
    phone: 'blue',
    wechat: 'green',
    face: 'purple',
    other: 'gray'
  } as any)[t] || 'gray'
}

function onRefresh() {
  store.refresh({
    type: typeOptions[typeIdx.value].value || undefined,
    start_date: startDate.value || undefined,
    end_date: endDate.value || undefined,
    q: q.value || undefined
  } as any)
}

function onTypeChip(i: number) { typeIdx.value = i; onRefresh() }
function clearQ() { q.value = '' }

let qTimer: any = null
watch(q, () => {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(onRefresh, 400)
})

function goDetail(f: any) {
  uni.navigateTo({ url: `/pages/follow-up/detail?id=${f.id}` })
}
function goNew() {
  uni.navigateTo({ url: '/pages/follow-up/new' })
}

onShow(() => onRefresh())
onPullDownRefresh(async () => { await store.refresh(); uni.stopPullDownRefresh() })
onReachBottom(() => store.loadMore())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

/* ===== 顶部条 ===== */
.top-bar {
  background: #ffffff;
  padding: 24rpx 24rpx 16rpx;
  border-radius: 0 0 24rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(20, 30, 60, 0.04);
  position: sticky;
  top: 0;
  z-index: 10;
}
.top-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.top-title { font-size: 36rpx; font-weight: 700; color: #1F2329; }
.top-date {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  color: #4E5969;
  padding: 6rpx 14rpx;
  border-radius: 16rpx;
  background: #E8F3FF;
  &:active { opacity: 0.7; }
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}
.date-picker { flex: 1; }
.date-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 14rpx 16rpx;
  background: #F2F3F5;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #4E5969;
  &:active { opacity: 0.7; }
  &.active {
    background: #E8F3FF;
    color: #1677FF;
  }
}
.date-sep { color: #C9CDD4; font-size: 24rpx; }

.search-box {
  background: #F2F3F5;
  border-radius: 24rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}
.search-icon { display: flex; align-items: center; flex-shrink: 0; }
.search-input { flex: 1; height: 64rpx; font-size: 26rpx; background: transparent; }
.search-clear {
  width: 40rpx; height: 40rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  &:active { background: #E5E6EB; }
}

.chip-row {
  display: flex;
  gap: 10rpx;
  overflow-x: auto;
  white-space: nowrap;
  &::-webkit-scrollbar { display: none; }
}
.chip {
  flex-shrink: 0;
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
  background: #F2F3F5;
  font-size: 24rpx;
  color: #4E5969;
  display: flex;
  align-items: center;
  gap: 4rpx;
  transition: all 0.15s;
  &:active { opacity: 0.7; }
  &.active {
    background: #1677FF;
    color: #ffffff;
    font-weight: 500;
  }
}

/* ===== Timeline ===== */
.timeline { padding: 16rpx 16rpx 0; }
.tl-row {
  display: flex;
  align-items: stretch;
  gap: 12rpx;
}
.tl-spine {
  width: 28rpx;
  position: relative;
  flex-shrink: 0;
}
.tl-spine::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0; bottom: 0;
  width: 2rpx;
  background: #E5E6EB;
  transform: translateX(-50%);
}
.tl-row:first-child .tl-spine::before { top: 32rpx; }
.tl-row:last-child .tl-spine::before { bottom: calc(100% - 32rpx); }
.tl-dot {
  position: absolute;
  top: 32rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 16rpx; height: 16rpx;
  border-radius: 50%;
  border: 4rpx solid #ffffff;
  background: #1677FF;
  z-index: 1;
}
.dot-blue { background: #1677FF; }
.dot-green { background: #00B42A; }
.dot-purple { background: #722ED1; }
.dot-gray { background: #86909C; }
.tl-card-wrap { flex: 1; min-width: 0; }

.state {
  text-align: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #86909C;
}

/* ===== FAB ===== */
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 220rpx;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.45);
  transition: transform 0.15s ease;
  z-index: 50;
  &:active { transform: scale(0.92); }
}
</style>
