<template>
  <view class="page">
    <view class="search-bar">
      <view class="search-icon">
        <svg-icon name="search" :size="32" color="#86909C" />
      </view>
      <input
        class="search-input"
        v-model="q"
        placeholder="姓名 / 手机 / 学校 / 班级 / 编号"
        focus
        confirm-type="search"
        @input="onInput"
        @confirm="doSearchNow"
      />
      <view v-if="q" class="clear" @click="clear">
        <svg-icon name="x" :size="24" color="#86909C" />
      </view>
    </view>

    <view v-if="loading" class="state-loading">
      <view class="dots"><i></i><i></i><i></i></view>
      <text>搜索中</text>
    </view>
    <view v-else>
      <view v-if="q.length < 2" class="state-hint">
        <view class="hint-icon">
          <svg-icon name="search" :size="80" color="#C9CDD4" />
        </view>
        <text class="hint-text">请输入至少 2 个字符开始搜索</text>
        <text class="hint-sub">支持姓名 / 手机号 / 学校 / 班级 / 编号</text>
      </view>
      <view v-else>
        <view v-if="results.length > 0" class="result-meta">
          找到 {{ results.length }} 条匹配
        </view>
        <view class="result-list">
          <view v-for="item in results" :key="item.id">
            <customer-card :customer="item" @tap="onTap(item)" @call="onCall(item)" />
          </view>
        </view>
        <empty-state v-if="results.length === 0" text="未找到匹配客户" icon="search" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import * as customerApi from '@/api/customer'
import SvgIcon from '@/components/svg-icon.vue'

const q = ref('')
const results = ref<any[]>([])
const loading = ref(false)

let timer: any = null

watch(q, () => {
  if (timer) clearTimeout(timer)
  if (q.value.length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(doSearchNow, 300)
})

function onInput() { /* watch 接管 */ }

async function doSearchNow() {
  if (q.value.length < 2) return
  loading.value = true
  try {
    const r = await customerApi.search(q.value.trim())
    if (Array.isArray(r)) results.value = r
    else if (r && Array.isArray((r as any).items)) results.value = (r as any).items
    else if (r && Array.isArray((r as any).list)) results.value = (r as any).list
    else results.value = []
  } catch (e) {
    results.value = []
  } finally {
    loading.value = false
  }
}

function clear() {
  q.value = ''
  results.value = []
}

function onTap(item: any) {
  uni.navigateTo({ url: `/pages/customer/detail?id=${item.id}` })
}

function onCall(item: any) {
  if (!item.phone) return
  // #ifdef H5
  window.location.href = `tel:${item.phone}`
  // #endif
  // #ifndef H5
  uni.makePhoneCall({ phoneNumber: String(item.phone) })
  // #endif
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding: 16rpx;
}

.search-bar {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.06);
  height: 96rpx;
}
.search-icon { display: flex; align-items: center; flex-shrink: 0; }
.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
  color: #1F2329;
  background: transparent;
}
.clear {
  width: 48rpx; height: 48rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  &:active { background: #F2F3F5; }
}

.state-loading {
  text-align: center;
  padding: 80rpx 0;
  color: #86909C;
  font-size: 26rpx;
}
.dots {
  display: inline-flex;
  gap: 6rpx;
  margin-bottom: 12rpx;
  i {
    width: 12rpx; height: 12rpx;
    border-radius: 50%;
    background: #1677FF;
    animation: dot-bounce 1.2s infinite ease-in-out;
  }
  i:nth-child(2) { animation-delay: 0.2s; }
  i:nth-child(3) { animation-delay: 0.4s; }
}
@keyframes dot-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.7); }
  40% { opacity: 1; transform: scale(1); }
}

.state-hint {
  text-align: center;
  padding: 120rpx 32rpx;
}
.hint-icon { margin-bottom: 24rpx; display: flex; justify-content: center; }
.hint-text { display: block; font-size: 28rpx; color: #4E5969; }
.hint-sub { display: block; font-size: 22rpx; color: #C9CDD4; margin-top: 8rpx; }

.result-meta {
  font-size: 22rpx;
  color: #86909C;
  padding: 8rpx 16rpx 12rpx;
}
.result-list { padding: 0 8rpx; }
</style>
