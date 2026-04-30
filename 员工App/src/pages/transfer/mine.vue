<template>
  <view class="page">
    <view v-if="items.length === 0 && !loading" class="empty-wrap">
      <empty-state text="还没有提交过转出申请" icon="share-2" />
    </view>
    <view v-else class="list">
      <view v-for="it in items" :key="it.id" class="item-card">
        <view class="row top">
          <view class="left-info">
            <text class="cust">{{ it.customer_name || `客户#${it.customer_id}` }}</text>
            <text class="time">{{ fmtDateTime(it.created_at) }}</text>
          </view>
          <view class="badge" :class="`b-${it.status}`">{{ statusText(it.status) }}</view>
        </view>

        <view class="kv-block">
          <view v-if="it.to_employee_name" class="kv">
            <text class="lbl">转给</text>
            <text class="val">{{ it.to_employee_name }}</text>
          </view>
          <view class="kv">
            <text class="lbl">原因</text>
            <text class="val multi">{{ it.reason || '—' }}</text>
          </view>
          <view v-if="it.approval_remark" class="kv">
            <text class="lbl">审批备注</text>
            <text class="val multi">{{ it.approval_remark }}</text>
          </view>
          <view v-if="it.approved_at" class="kv">
            <text class="lbl">审批于</text>
            <text class="val">{{ fmtDateTime(it.approved_at) }}</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="loading-tip">加载中…</view>
      <view v-else-if="!hasMore && items.length > 0" class="loading-tip">— 没有更多了 —</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import * as transferApi from '@/api/transfer'
import { fmtDateTime } from '@/utils/format'

const items = ref<any[]>([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(true)
const loading = ref(false)

onShow(() => {
  if (items.value.length === 0) reload()
})

async function reload() {
  page.value = 1
  hasMore.value = true
  items.value = []
  await fetchPage()
}

async function fetchPage() {
  if (!hasMore.value || loading.value) return
  loading.value = true
  try {
    const res: any = await transferApi.mine({ page: page.value, page_size: pageSize })
    const list = res?.items || res || []
    if (page.value === 1) items.value = list
    else items.value = items.value.concat(list)
    const total = res?.total ?? items.value.length
    hasMore.value = items.value.length < total && list.length > 0
    if (list.length < pageSize) hasMore.value = false
    page.value += 1
  } catch (e) { /* */ } finally {
    loading.value = false
  }
}

onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  if (hasMore.value && !loading.value) fetchPage()
})

function statusText(s: string) {
  switch (s) {
    case 'pending': return '待审批'
    case 'approved': return '已通过'
    case 'rejected': return '已驳回'
    case 'cancelled': return '已取消'
    default: return s || '—'
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding: 24rpx;
  padding-bottom: 80rpx;
}
.empty-wrap { padding-top: 80rpx; }

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.item-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.row.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F2F3F5;
  margin-bottom: 16rpx;
}
.left-info { flex: 1; min-width: 0; }
.cust {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2329;
}
.time {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #86909C;
}
.badge {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
  font-weight: 500;
  &.b-pending { background: #FFF7E6; color: #FA8C16; }
  &.b-approved { background: #E6F7ED; color: #00B42A; }
  &.b-rejected { background: #FFECEB; color: #F53F3F; }
  &.b-cancelled { background: #F2F3F5; color: #86909C; }
}

.kv-block {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.kv {
  display: flex;
  gap: 16rpx;
  font-size: 26rpx;
}
.lbl { width: 120rpx; flex-shrink: 0; color: #86909C; }
.val {
  flex: 1;
  color: #1F2329;
  word-break: break-all;
}
.val.multi { line-height: 1.6; }

.loading-tip {
  text-align: center;
  font-size: 24rpx;
  color: #86909C;
  padding: 32rpx 0;
}
</style>
