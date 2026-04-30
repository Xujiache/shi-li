<template>
  <view class="page">
    <!-- 状态总览（素净版：大数字 + 小色点）-->
    <view class="overview">
      <view class="ov-row">
        <view class="ov-status">
          <view class="status-dot" :class="`dot-${statusClass}`" />
          <text class="status-text">{{ statusLabel }}</text>
        </view>
        <text class="status-time">{{ lastSyncText }}</text>
      </view>

      <view class="metrics">
        <view class="metric">
          <text class="m-num">{{ sync.pendingCount }}</text>
          <text class="m-label">待同步</text>
        </view>
        <view class="m-divider" />
        <view class="metric">
          <text class="m-num" :class="{ 'm-danger': sync.conflictCount > 0 }">{{ sync.conflictCount }}</text>
          <text class="m-label">冲突</text>
        </view>
        <view class="m-divider" />
        <view class="metric">
          <text class="m-num">{{ deadLetterCount }}</text>
          <text class="m-label">失败</text>
        </view>
      </view>

      <view v-if="sync.lastError" class="ov-error">
        <text class="ov-error-text">{{ sync.lastError }}</text>
      </view>
    </view>

    <!-- 操作 -->
    <view class="action-bar">
      <view
        class="action-btn primary"
        :class="{ disabled: sync.isSyncing }"
        @click="onManualSync"
      >
        <svg-icon
          name="refresh-cw"
          :size="26"
          color="#ffffff"
          :class="{ spinning: sync.isSyncing }"
        />
        <text>{{ sync.isSyncing ? '同步中…' : '立即同步' }}</text>
      </view>
      <view class="action-btn ghost" @click="onClearDone">清空已完成</view>
    </view>

    <!-- 列表 -->
    <view class="section-head">
      <text class="section-title">同步队列</text>
      <text class="section-count">{{ ops.length }}</text>
    </view>

    <view v-if="ops.length === 0" class="empty">
      <view class="empty-icon">
        <svg-icon name="check-circle" :size="64" color="#C9CDD4" />
      </view>
      <text class="empty-text">队列为空</text>
      <text class="empty-sub">所有本地操作都已同步</text>
    </view>

    <view v-else class="op-list">
      <view v-for="row in ops" :key="row.id" class="op-card">
        <view class="op-line1">
          <view class="op-tags">
            <text class="op-pill">{{ typeLabel(row.type) }}</text>
            <text class="op-pill op-pill-ghost">{{ opLabel(row.op) }}</text>
          </view>
          <view class="op-status" :class="`s-${row.status}`">
            <view class="op-status-dot" />
            <text>{{ statusBadge(row.status) }}</text>
          </view>
        </view>

        <view class="op-line2">
          <text class="op-id">#{{ row.id }}</text>
          <text v-if="row.retry_count" class="op-retry">已重试 {{ row.retry_count }} 次</text>
          <text class="op-time">{{ fmtRelativeTime(row.updated_at) }}</text>
        </view>

        <view v-if="row.last_error && row.status !== 'conflict'" class="op-error">
          {{ row.last_error }}
        </view>

        <view
          v-if="row.status === 'conflict' || row.status === 'dead_letter'"
          class="op-actions"
        >
          <view v-if="row.status === 'conflict'" class="op-btn primary" @click="onResolve(row)">解决冲突</view>
          <view v-if="row.status === 'dead_letter'" class="op-btn" @click="onRetry(row)">重试</view>
          <view v-if="row.status === 'dead_letter'" class="op-btn danger" @click="onDrop(row)">删除</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { repo } from '@/db'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { fmtRelativeTime } from '@/utils/format'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()
const sync = useSyncStore()

const ops = ref<any[]>([])

const deadLetterCount = computed(() => ops.value.filter((r) => r.status === 'dead_letter').length)

const statusClass = computed(() => {
  if (sync.conflictCount > 0) return 'failed'
  if (sync.state === 'syncing') return 'syncing'
  if (sync.state === 'failed') return 'failed'
  if (sync.pendingCount === 0) return 'ok'
  return 'idle'
})

const statusLabel = computed(() => {
  if (sync.conflictCount > 0) return `${sync.conflictCount} 条冲突待处理`
  if (sync.state === 'syncing') return '正在同步'
  if (sync.state === 'failed') return '同步失败'
  if (sync.pendingCount === 0) return '全部已同步'
  return `${sync.pendingCount} 条待同步`
})

const lastSyncText = computed(() => {
  if (!sync.lastSyncAt) return '从未同步'
  return `上次同步 ${fmtRelativeTime(sync.lastSyncAt)}`
})

function actor() {
  const eid = auth.employee?.id
  return eid ? { employee_id: eid } : null
}

async function loadList() {
  const a = actor()
  if (!a) {
    ops.value = []
    return
  }
  try {
    const rows = await repo.pendingOp.listAll(a)
    const order: Record<string, number> = {
      conflict: 0, dead_letter: 1, processing: 2, pending: 3, ok: 4
    }
    ops.value = (rows || []).slice().sort((a: any, b: any) => {
      const oa = order[a.status] ?? 9
      const ob = order[b.status] ?? 9
      if (oa !== ob) return oa - ob
      return (b.updated_at || 0) - (a.updated_at || 0)
    })
  } catch (e) {
    ops.value = []
  }
}

function typeLabel(t: string): string {
  if (t === 'customer') return '客户'
  if (t === 'follow_up') return '跟进'
  if (t === 'transfer') return '转出'
  if (t === 'attachment_upload') return '附件'
  return t || '未知'
}
function opLabel(o: string): string {
  const s = String(o || '').toLowerCase()
  if (s === 'create') return '新建'
  if (s === 'update') return '修改'
  if (s === 'delete') return '删除'
  if (s === 'upload') return '上传'
  return s
}
function statusBadge(s: string): string {
  if (s === 'pending') return '待同步'
  if (s === 'processing') return '同步中'
  if (s === 'conflict') return '冲突'
  if (s === 'dead_letter') return '失败'
  if (s === 'ok') return '已完成'
  return s || '-'
}

async function onManualSync() {
  const a = actor()
  if (!a) return
  if (sync.isSyncing) {
    uni.showToast({ title: '正在同步中', icon: 'none' })
    return
  }
  sync.kick('manual_button')
  uni.showToast({ title: '已触发同步', icon: 'none' })
  setTimeout(async () => {
    await sync.refreshCounts(a)
    await loadList()
  }, 800)
}

async function onClearDone() {
  const a = actor()
  if (!a) return
  uni.showModal({
    title: '清空已完成',
    content: '确定要清空所有已完成的同步记录吗？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        const rows = await repo.pendingOp.listAll(a)
        let n = 0
        for (const row of rows || []) {
          if (row.status === 'ok') {
            await repo.pendingOp.deleteById(row.id)
            n++
          }
        }
        uni.showToast({ title: `已清空 ${n} 条`, icon: 'success' })
        await loadList()
      } catch (e) {
        uni.showToast({ title: '清空失败', icon: 'none' })
      }
    }
  })
}

function onResolve(row: any) {
  uni.navigateTo({ url: `/pages/customer/conflict?pending_op_id=${row.id}` })
}

async function onRetry(row: any) {
  try {
    await sync.retryDeadLetter(row.id)
    uni.showToast({ title: '已重新加入队列', icon: 'success' })
    await loadList()
  } catch (e) {
    uni.showToast({ title: '重试失败', icon: 'none' })
  }
}

function onDrop(row: any) {
  uni.showModal({
    title: '删除',
    content: '确认删除该条同步记录？删除后无法恢复。',
    confirmColor: '#F53F3F',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await sync.dropDeadLetter(row.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        await loadList()
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  })
}

onShow(async () => {
  const a = actor()
  if (!a) return
  await sync.refreshCounts(a)
  await loadList()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F4F5F7;
  padding: 16rpx 16rpx 80rpx;
}

/* ===== 状态总览 ===== */
.overview {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx 28rpx 8rpx;
  margin-bottom: 16rpx;
}
.ov-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ov-status {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.status-dot {
  width: 16rpx; height: 16rpx;
  border-radius: 50%;
  background: #C9CDD4;
}
.dot-ok { background: #00B42A; }
.dot-idle { background: #1677FF; }
.dot-syncing { background: #FA8C16; animation: blink 1.2s infinite; }
.dot-failed { background: #F53F3F; }
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.status-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2329;
}
.status-time {
  font-size: 22rpx;
  color: #86909C;
}

.metrics {
  display: flex;
  align-items: center;
  margin-top: 28rpx;
  padding: 20rpx 0 24rpx;
}
.metric {
  flex: 1;
  text-align: center;
}
.m-num {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  color: #1F2329;
  line-height: 1.1;
}
.m-num.m-danger { color: #F53F3F; }
.m-label {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #86909C;
}
.m-divider {
  width: 1rpx;
  height: 56rpx;
  background: #EFF1F4;
}

.ov-error {
  margin-top: 8rpx;
  padding: 12rpx 16rpx 20rpx;
  border-top: 1rpx solid #F2F3F5;
}
.ov-error-text {
  font-size: 22rpx;
  color: #F53F3F;
  word-break: break-all;
}

/* ===== 操作按钮 ===== */
.action-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 24rpx;
}
.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  transition: opacity 0.15s;
  &:active { opacity: 0.85; }
  &.primary {
    background: #1677FF;
    color: #ffffff;
  }
  &.primary text { color: #ffffff; }
  &.ghost {
    background: #ffffff;
    color: #4E5969;
  }
  &.disabled { opacity: 0.6; }
}

/* ===== 队列 ===== */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 12rpx;
}
.section-title {
  font-size: 26rpx;
  color: #1F2329;
  font-weight: 600;
}
.section-count {
  font-size: 22rpx;
  color: #86909C;
}

.empty {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 80rpx 24rpx;
  text-align: center;
}
.empty-icon { display: flex; justify-content: center; }
.empty-text {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #1F2329;
  font-weight: 500;
}
.empty-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #86909C;
}

.op-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.op-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}
.op-line1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.op-tags {
  display: flex;
  gap: 8rpx;
}
.op-pill {
  font-size: 22rpx;
  color: #1F2329;
  background: #F2F3F5;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
}
.op-pill-ghost {
  background: #FAFBFC;
  color: #86909C;
}
.op-status {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
}
.op-status-dot {
  width: 10rpx; height: 10rpx;
  border-radius: 50%;
  background: #86909C;
}
.s-pending { color: #FA8C16; .op-status-dot { background: #FA8C16; } }
.s-processing { color: #1677FF; .op-status-dot { background: #1677FF; } }
.s-conflict { color: #F53F3F; .op-status-dot { background: #F53F3F; } }
.s-dead_letter { color: #86909C; .op-status-dot { background: #86909C; } }
.s-ok { color: #00B42A; .op-status-dot { background: #00B42A; } }

.op-line2 {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  font-size: 22rpx;
  color: #86909C;
}
.op-retry { color: #FA8C16; }

.op-error {
  margin-top: 12rpx;
  padding: 10rpx 14rpx;
  background: #FFF6F6;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #F53F3F;
  word-break: break-all;
}

.op-actions {
  margin-top: 16rpx;
  display: flex;
  gap: 12rpx;
}
.op-btn {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 10rpx;
  font-size: 26rpx;
  background: #F2F3F5;
  color: #4E5969;
  &:active { opacity: 0.85; }
  &.primary { background: #1677FF; color: #ffffff; }
  &.danger { background: #ffffff; color: #F53F3F; border: 1rpx solid #FFD9D9; }
}

.spinning { animation: spin 1.2s linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
