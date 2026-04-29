<template>
  <view class="page">
    <view v-if="items.length === 0 && !loading" class="empty-wrap">
      <empty-state text="还没有提交过转出申请" icon="share-2" />
    </view>
    <view v-else class="list">
      <view v-for="it in items" :key="it.id" class="card">
        <view class="row top">
          <text class="cust">{{ it.customer_name || `客户#${it.customer_id}` }}</text>
          <view class="badge" :class="`b-${it.status}`">{{ statusText(it.status) }}</view>
        </view>
        <view class="row meta">
          <text class="time">提交于 {{ fmtDateTime(it.created_at) }}</text>
        </view>
        <view v-if="it.to_employee_name" class="row">
          <text class="lbl">转给</text>
          <text class="val">{{ it.to_employee_name }}</text>
        </view>
        <view class="row">
          <text class="lbl">原因</text>
          <text class="val multi">{{ it.reason || '—' }}</text>
        </view>
        <view v-if="it.approval_remark" class="row">
          <text class="lbl">审批备注</text>
          <text class="val multi">{{ it.approval_remark }}</text>
        </view>
        <view v-if="it.approved_at" class="row meta">
          <text class="time">审批于 {{ fmtDateTime(it.approved_at) }}</text>
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
  } catch (e) {
    // http.ts 已处理
  } finally {
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
.page { padding: 24rpx; min-height: 100vh; background: #F5F7FA; }
.empty-wrap { padding-top: 80rpx; }
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  display: flex; flex-direction: column; gap: 12rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.row { display: flex; align-items: flex-start; gap: 16rpx; }
.row.top { justify-content: space-between; align-items: center; }
.cust { font-size: 30rpx; font-weight: 600; color: #1F2329; }
.badge {
  font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 20rpx;
  &.b-pending { background: #FFF7E8; color: #FF8800; }
  &.b-approved { background: #E8F5E9; color: #00A65A; }
  &.b-rejected { background: #FFECEC; color: #F53F3F; }
  &.b-cancelled { background: #F2F3F5; color: #86909C; }
}
.meta .time { font-size: 24rpx; color: #86909C; }
.lbl { font-size: 26rpx; color: #86909C; min-width: 120rpx; }
.val { flex: 1; font-size: 26rpx; color: #1F2329; word-break: break-all; }
.val.multi { line-height: 1.5; }
.loading-tip { text-align: center; font-size: 24rpx; color: #86909C; padding: 24rpx 0; }
</style>
