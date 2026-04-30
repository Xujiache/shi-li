<template>
  <view class="page">
    <view class="top-bar">
      <view class="top-title">孩子档案</view>
      <view class="search-box">
        <view class="search-icon">
          <svg-icon name="search" :size="28" color="#86909C" />
        </view>
        <input
          class="search-input"
          v-model="q"
          placeholder="搜索 姓名 / 家长手机 / 编号"
          confirm-type="search"
          @confirm="reload"
        />
        <view v-if="q" class="search-clear" @click="clearQ">
          <svg-icon name="x" :size="24" color="#86909C" />
        </view>
      </view>
    </view>

    <view class="list">
      <empty-state v-if="!loading && !items.length" text="暂无可查看的孩子档案" icon="clipboard-list" />

      <view v-else>
        <view class="list-meta" v-if="total">共 {{ total }} 个孩子档案</view>
        <view
          v-for="(c, i) in items"
          :key="c.id"
          class="child-card"
          @click="onTap(c)"
        >
          <view class="cc-avatar" :class="`tone-${tone(i)}`">{{ initial(c.name) }}</view>
          <view class="cc-main">
            <view class="cc-name-row">
              <text class="cc-name">{{ c.name || '未命名' }}</text>
              <text v-if="c.gender" class="cc-meta-tag">{{ c.gender }}</text>
              <text v-if="c.age != null" class="cc-meta-tag">{{ c.age }}岁</text>
            </view>
            <view class="cc-sub">
              <svg-icon name="book-open" :size="22" color="#86909C" />
              <text>{{ c.school || '未填写' }} {{ c.grade_name || '' }}{{ c.class_name || '' }}</text>
            </view>
            <view class="cc-meta-row" v-if="c.parent_phone || c.updated_at">
              <view v-if="c.parent_phone" class="cc-meta-item">
                <svg-icon name="phone" :size="20" color="#C9CDD4" />
                <text>{{ fmtPhone(c.parent_phone) }}</text>
              </view>
              <view v-if="c.updated_at" class="cc-meta-item">
                <svg-icon name="clock" :size="20" color="#C9CDD4" />
                <text>{{ fmtRelativeTime(c.updated_at) }}</text>
              </view>
            </view>
          </view>
          <view class="cc-go">
            <svg-icon name="chevron-right" :size="28" color="#C9CDD4" />
          </view>
        </view>

        <view v-if="hasMore" class="load-more" @click="loadMore">
          {{ loading ? '加载中...' : '加载更多' }}
        </view>
        <view v-else-if="items.length" class="load-end">— 没有更多 —</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import * as childApi from '@/api/child'
import { fmtPhone, fmtRelativeTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()

const items = ref<any[]>([])
const q = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const hasMore = ref(true)

function initial(name: string) {
  const n = String(name || '').trim()
  return n ? n.charAt(0) : '?'
}
function tone(i: number) {
  return ['blue', 'orange', 'green', 'purple', 'red'][i % 5]
}

async function load(reset: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await childApi.list({ q: q.value || undefined, page: page.value, page_size: pageSize })
    const newItems = res.items || []
    items.value = reset ? newItems : items.value.concat(newItems)
    total.value = Number(res.total) || 0
    hasMore.value = items.value.length < total.value
  } catch (e) { /* */ } finally {
    loading.value = false
  }
}

async function reload() {
  page.value = 1
  hasMore.value = true
  await load(true)
}

async function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value += 1
  await load(false)
}

function clearQ() { q.value = ''; reload() }

function onTap(c: any) {
  uni.navigateTo({ url: `/pages/child/detail?id=${c.id}` })
}

onShow(() => { if (auth.token) reload() })
onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})
onReachBottom(loadMore)
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 80rpx;
}

.top-bar {
  background: #ffffff;
  padding: 24rpx 24rpx 16rpx;
  border-radius: 0 0 24rpx 24rpx;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2rpx 8rpx rgba(20, 30, 60, 0.04);
}
.top-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1F2329;
  margin-bottom: 16rpx;
}
.search-box {
  background: #F2F3F5;
  border-radius: 24rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.search-icon { display: flex; align-items: center; flex-shrink: 0; }
.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 26rpx;
  background: transparent;
  color: #1F2329;
}
.search-clear {
  width: 40rpx; height: 40rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  &:active { background: #E5E6EB; }
}

.list { padding: 16rpx; }
.list-meta {
  padding: 8rpx 12rpx 12rpx;
  font-size: 22rpx;
  color: #86909C;
}

.child-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.99); }
}
.cc-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}
.tone-blue { background: linear-gradient(135deg, #1677FF, #4096FF); }
.tone-orange { background: linear-gradient(135deg, #FA8C16, #FFB264); }
.tone-green { background: linear-gradient(135deg, #00B42A, #4ED365); }
.tone-purple { background: linear-gradient(135deg, #722ED1, #9254DE); }
.tone-red { background: linear-gradient(135deg, #F53F3F, #FF7875); }

.cc-main { flex: 1; min-width: 0; }
.cc-name-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.cc-name {
  font-size: 30rpx;
  color: #1F2329;
  font-weight: 600;
  max-width: 280rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cc-meta-tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #F2F3F5;
  color: #86909C;
}
.cc-sub {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: #4E5969;
}
.cc-sub text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cc-meta-row {
  margin-top: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.cc-meta-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
  font-size: 22rpx;
  color: #86909C;
}
.cc-go {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.load-more, .load-end {
  text-align: center;
  padding: 24rpx 0;
  font-size: 24rpx;
  color: #86909C;
}
.load-more {
  background: #ffffff;
  border-radius: 24rpx;
  margin-top: 16rpx;
  &:active { opacity: 0.7; }
}
</style>
