<template>
  <view class="page">
    <view class="search-bar card">
      <input
        class="search-input"
        v-model="q"
        placeholder="搜索 姓名 / 家长手机 / 编号"
        confirm-type="search"
        @confirm="reload"
      />
      <view class="search-btn" @click="reload">
        <svg-icon name="search" :size="24" color="#ffffff" />
        <text class="search-btn-text">搜索</text>
      </view>
    </view>

    <empty-state v-if="!loading && !items.length" text="暂无可查看的孩子档案" icon="clipboard-list" />

    <view v-else>
      <view
        v-for="c in items"
        :key="c.id"
        class="child-card card"
        @click="onTap(c)"
      >
        <view class="cc-row">
          <view class="cc-avatar">{{ initial(c.name) }}</view>
          <view class="cc-main">
            <view class="cc-name-row">
              <text class="cc-name">{{ c.name || '未命名' }}</text>
              <text class="cc-gender">{{ c.gender || '' }}</text>
              <text class="cc-age" v-if="c.age != null">{{ c.age }}岁</text>
            </view>
            <view class="cc-sub">
              <text>{{ c.school || '-' }} {{ c.grade_name || '' }}{{ c.class_name || '' }}</text>
            </view>
            <view class="cc-meta" v-if="c.parent_phone">
              家长：{{ fmtPhone(c.parent_phone) }}
            </view>
            <view class="cc-meta" v-if="c.updated_at">
              上次更新：{{ fmtRelativeTime(c.updated_at) }}
            </view>
          </view>
          <view class="cc-go">
            <svg-icon name="chevron-right" :size="32" color="#C9CDD4" />
          </view>
        </view>
      </view>

      <view v-if="hasMore" class="load-more" @click="loadMore">
        {{ loading ? '加载中...' : '加载更多' }}
      </view>
      <view v-else class="load-end">— 没有更多 —</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import * as childApi from '@/api/child'
import { fmtPhone, fmtRelativeTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

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

async function load(reset: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    const res = await childApi.list({ q: q.value || undefined, page: page.value, page_size: pageSize })
    const newItems = res.items || []
    items.value = reset ? newItems : items.value.concat(newItems)
    total.value = Number(res.total) || 0
    hasMore.value = items.value.length < total.value
  } catch (e) {
    // http 拦截器已 toast
  } finally {
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

function onTap(c: any) {
  uni.navigateTo({ url: `/pages/child/detail?id=${c.id}` })
}

onShow(() => {
  if (auth.token) reload()
})

onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})

onReachBottom(loadMore)
</script>

<style lang="scss" scoped>
.page {
  padding: 16rpx;
  min-height: 100vh;
  background: #F5F7FA;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx;
}
.search-input {
  flex: 1;
  height: 64rpx;
  background: #F2F3F5;
  border-radius: 32rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
}
.search-btn {
  padding: 12rpx 28rpx;
  background: #1677FF;
  color: #ffffff;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.search-btn-text { color: #ffffff; line-height: 1; }

.child-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.cc-row { display: flex; align-items: flex-start; }
.cc-avatar {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: #E8F3FF; color: #1677FF;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.cc-main { flex: 1; min-width: 0; }
.cc-name-row { display: flex; align-items: center; gap: 12rpx; }
.cc-name {
  font-size: 30rpx; color: #1F2329; font-weight: 600;
  max-width: 260rpx;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.cc-gender { font-size: 22rpx; color: #86909C; }
.cc-age { font-size: 22rpx; color: #86909C; }
.cc-sub { margin-top: 8rpx; font-size: 24rpx; color: #4E5969; }
.cc-meta { margin-top: 6rpx; font-size: 22rpx; color: #C9CDD4; }
.cc-go {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  align-self: center;
}

.load-more, .load-end {
  text-align: center;
  padding: 24rpx 0;
  font-size: 24rpx;
  color: #86909C;
}
</style>
