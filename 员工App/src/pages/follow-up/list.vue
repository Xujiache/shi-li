<template>
  <view class="page">
    <view class="filter-bar">
      <view class="search-box">
        <input
          class="search-input"
          v-model="q"
          placeholder="搜索客户姓名 / 手机 / 跟进内容"
          confirm-type="search"
          @confirm="onRefresh"
        />
        <view v-if="q" class="search-clear" @click="clearQ">
          <svg-icon name="x" :size="28" color="#86909C" />
        </view>
      </view>
      <view class="filter-row">
        <picker mode="selector" :value="typeIdx" :range="typeOptions" range-key="label" @change="onTypeChange">
          <view class="filter-pick">
            <text>{{ typeOptions[typeIdx].label }}</text>
            <text class="caret">▾</text>
          </view>
        </picker>
        <picker mode="date" :value="startDate" @change="onStartChange">
          <view class="filter-pick">
            <text>{{ startDate || '开始日期' }}</text>
          </view>
        </picker>
        <picker mode="date" :value="endDate" @change="onEndChange">
          <view class="filter-pick">
            <text>{{ endDate || '结束日期' }}</text>
          </view>
        </picker>
      </view>
    </view>

    <view class="timeline">
      <view v-for="f in store.list" :key="f.id" @click="goDetail(f)">
        <follow-up-card :follow-up="f" />
      </view>
      <empty-state v-if="!store.loading && store.list.length === 0" text="暂无跟进记录" />
      <view v-if="store.loading" class="state">加载中...</view>
      <view v-else-if="store.finished && store.list.length > 0" class="state">已全部加载</view>
    </view>

    <view class="fab" @click="goNew">
      <svg-icon name="plus" :size="48" color="#ffffff" />
    </view>

    <floating-tabbar active="/pages/follow-up/list" />
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useFollowUpsStore } from '@/stores/followUps'
import SvgIcon from '@/components/svg-icon.vue'

const store = useFollowUpsStore()

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '电话', value: 'phone' },
  { label: '微信', value: 'wechat' },
  { label: '当面', value: 'face' },
  { label: '其他', value: 'other' }
]

const q = ref('')
const typeIdx = ref(0)
const startDate = ref('')
const endDate = ref('')

function onRefresh() {
  store.refresh({
    type: typeOptions[typeIdx.value].value || undefined,
    start_date: startDate.value || undefined,
    end_date: endDate.value || undefined,
    q: q.value || undefined
  } as any)
}

function onTypeChange(e: any) { typeIdx.value = e.detail.value; onRefresh() }
function onStartChange(e: any) { startDate.value = e.detail.value; onRefresh() }
function onEndChange(e: any) { endDate.value = e.detail.value; onRefresh() }

function clearQ() { q.value = '' }

// 实时搜索：v-model 变化时防抖 400ms 后自动 refresh
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
.page { padding: 16rpx; padding-bottom: 200rpx; }

.filter-bar {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}
.search-box {
  background: #F2F3F5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  margin-bottom: 12rpx;
  display: flex;
  align-items: center;
}
.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
}
.search-clear {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:active { opacity: 0.85; }
}
.filter-row {
  display: flex;
  gap: 12rpx;
}
.filter-pick {
  flex: 1;
  background: #F2F3F5;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: #4E5969;
}
.caret { margin-left: 6rpx; font-size: 20rpx; color: #86909C; }

.timeline { padding: 0 8rpx; }
.state {
  text-align: center;
  padding: 24rpx 0;
  font-size: 24rpx;
  color: #86909C;
}

.fab {
  position: fixed;
  right: 32rpx;
  bottom: 200rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #1677FF;
  color: #ffffff;
  font-size: 56rpx;
  line-height: 96rpx;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(22, 119, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.95); }
}
</style>
