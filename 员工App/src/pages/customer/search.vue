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
        <svg-icon name="x" :size="28" color="#86909C" />
      </view>
    </view>

    <view v-if="loading" class="state">搜索中...</view>
    <view v-else>
      <view v-if="q.length < 2" class="state">请输入至少 2 个字符</view>
      <view v-else>
        <view v-for="item in results" :key="item.id">
          <customer-card :customer="item" @tap="onTap(item)" @call="onCall(item)" />
        </view>
        <empty-state v-if="results.length === 0" text="未找到匹配客户" />
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

// watch 替代 @input，避免某些 H5 浏览器 input 事件不触发
watch(q, () => {
  if (timer) clearTimeout(timer)
  if (q.value.length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(doSearchNow, 300)
})

function onInput() { /* 由 watch 接管，保留兼容 */ }

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
.page { padding: 16rpx; }

.search-bar {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
}
.search-icon {
  display: flex;
  align-items: center;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
  color: #1F2329;
}
.clear {
  width: 48rpx; height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:active { opacity: 0.85; }
}

.state {
  text-align: center;
  padding: 64rpx 0;
  color: #86909C;
  font-size: 26rpx;
}
</style>
