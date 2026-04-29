<template>
  <view class="ss-page">
    <!-- 状态卡 -->
    <view class="status-card card" :class="statusClass">
      <view class="status-row">
        <view class="status-dot" :class="statusClass" />
        <view class="status-text">{{ statusLabel }}</view>
      </view>
      <view class="status-meta">
        <view class="meta-item">
          <view class="meta-label">待同步</view>
          <view class="meta-value">{{ sync.pendingCount }}</view>
        </view>
        <view class="meta-item">
          <view class="meta-label">冲突</view>
          <view class="meta-value" :class="{ danger: sync.conflictCount > 0 }">{{ sync.conflictCount }}</view>
        </view>
        <view class="meta-item">
          <view class="meta-label">最近同步</view>
          <view class="meta-value-sm">{{ lastSyncText }}</view>
        </view>
      </view>
      <view v-if="sync.lastError" class="status-error">
        <text>错误：{{ sync.lastError }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions-card card">
      <view class="action-btn primary" @click="onManualSync">
        <svg-icon
          name="refresh-cw"
          :size="28"
          color="#ffffff"
          :class="{ 'spinning': sync.isSyncing }"
        />
        <text class="btn-label">{{ sync.isSyncing ? '同步中...' : '立即同步' }}</text>
      </view>
      <view class="action-btn default" @click="onClearDone">清空已完成</view>
      <view v-if="sync.pendingCount > 0" class="action-tip">
        切换账号前请先完成所有同步（{{ sync.pendingCount }} 条待同步）
      </view>
    </view>

    <!-- 队列 -->
    <view class="list-section">
      <view class="list-title">同步队列（{{ ops.length }}）</view>

      <view v-if="ops.length === 0" class="empty-state">
        <text>队列为空</text>
      </view>

      <view v-for="row in ops" :key="row.id" class="op-card card">
        <view class="op-head">
          <text class="op-tag" :class="'type-' + row.type">{{ typeLabel(row.type) }}</text>
          <text class="op-tag op-act">{{ opLabel(row.op) }}</text>
          <text class="op-status" :class="'st-' + row.status">{{ statusBadge(row.status) }}</text>
        </view>
        <view class="op-body">
          <view class="op-info">
            <text class="op-uuid">#{{ row.id }}</text>
            <text v-if="row.retry_count" class="op-retry">重试 {{ row.retry_count }} 次</text>
            <text class="op-time">{{ fmtRelativeTime(row.updated_at) }}</text>
          </view>
          <view v-if="row.last_error && row.status !== 'conflict'" class="op-error">
            {{ row.last_error }}
          </view>
        </view>
        <view class="op-actions">
          <view v-if="row.status === 'conflict'" class="op-btn primary" @click="onResolve(row)">解决冲突</view>
          <view v-if="row.status === 'dead_letter'" class="op-btn default" @click="onRetry(row)">手动重试</view>
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
import { fmtRelativeTime, fmtDateTime } from '@/utils/format'

const auth = useAuthStore()
const sync = useSyncStore()

const ops = ref<any[]>([])

const statusClass = computed(() => {
  if (sync.conflictCount > 0) return 'failed'
  if (sync.state === 'syncing') return 'syncing'
  if (sync.state === 'failed') return 'failed'
  if (sync.pendingCount === 0) return 'ok'
  return 'idle'
})

const statusLabel = computed(() => {
  if (sync.conflictCount > 0) return `有 ${sync.conflictCount} 条冲突待处理`
  if (sync.state === 'syncing') return '正在同步...'
  if (sync.state === 'failed') return '同步失败'
  if (sync.pendingCount === 0) return '全部已同步'
  return `待同步 ${sync.pendingCount} 条`
})

const lastSyncText = computed(() => {
  if (!sync.lastSyncAt) return '从未'
  return fmtRelativeTime(sync.lastSyncAt)
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
    // 按 status 优先级排序：conflict / dead_letter / processing / pending / ok
    const order: Record<string, number> = {
      conflict: 0,
      dead_letter: 1,
      processing: 2,
      pending: 3,
      ok: 4
    }
    ops.value = (rows || []).slice().sort((a: any, b: any) => {
      const oa = order[a.status] ?? 9
      const ob = order[b.status] ?? 9
      if (oa !== ob) return oa - ob
      return (b.updated_at || 0) - (a.updated_at || 0)
    })
  } catch (e) {
    console.warn('[sync-status] loadList failed', e)
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
        uni.showToast({ title: `清空 ${n} 条`, icon: 'success' })
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
.ss-page {
  padding: 24rpx;
  min-height: 100vh;
  background: #F5F7FA;
}

.status-card {
  &.ok { background: linear-gradient(135deg, #F6FFED, #D9F7BE); }
  &.idle { background: linear-gradient(135deg, #E6F4FF, #BAE0FF); }
  &.syncing { background: linear-gradient(135deg, #FFF7E6, #FFE7BA); }
  &.failed { background: linear-gradient(135deg, #FFF1F0, #FFCCC7); }
}
.status-row {
  display: flex;
  align-items: center;
}
.status-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%;
  margin-right: 12rpx;
  &.ok { background: #52C41A; }
  &.idle { background: #1677FF; }
  &.syncing { background: #FAAD14; animation: blink 1s infinite; }
  &.failed { background: #FF4D4F; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.status-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2329;
}
.status-meta {
  display: flex;
  margin-top: 20rpx;
}
.meta-item {
  flex: 1;
  text-align: center;
}
.meta-label {
  font-size: 22rpx;
  color: #86909C;
}
.meta-value {
  margin-top: 4rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: #1F2329;
  &.danger { color: #FF4D4F; }
}
.meta-value-sm {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #1F2329;
}
.status-error {
  margin-top: 16rpx;
  padding: 12rpx 16rpx;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #FF4D4F;
  word-break: break-all;
}

.actions-card {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.action-btn {
  flex: 1;
  min-width: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 22rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &.primary { background: #1677FF; color: #ffffff; }
  &.default { background: #ffffff; color: #1F2329; border: 2rpx solid #E5E6EB; }
}
.btn-label { line-height: 1; }
.spinning { animation: spin 1.2s linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.action-tip {
  width: 100%;
  font-size: 24rpx;
  color: #FAAD14;
}

.list-section {
  margin-top: 16rpx;
}
.list-title {
  font-size: 26rpx;
  color: #86909C;
  margin: 16rpx 8rpx;
}
.empty-state {
  padding: 80rpx 32rpx;
  text-align: center;
  color: #86909C;
}

.op-card {
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 16rpx;
}
.op-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}
.op-tag {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  background: #F2F3F5;
  color: #4E5969;
}
.op-tag.type-customer { background: #E6F4FF; color: #1677FF; }
.op-tag.type-follow_up { background: #F0F5FF; color: #2F54EB; }
.op-tag.type-transfer { background: #FFF7E6; color: #FA8C16; }
.op-tag.type-attachment_upload { background: #F9F0FF; color: #722ED1; }
.op-tag.op-act { background: #FAFAFA; color: #4E5969; }
.op-status {
  margin-left: auto;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  &.st-pending { background: #FFF7E6; color: #FA8C16; }
  &.st-processing { background: #E6F4FF; color: #1677FF; }
  &.st-conflict { background: #FFF1F0; color: #FF4D4F; }
  &.st-dead_letter { background: #F5F5F5; color: #86909C; border: 1rpx solid #C9CDD4; }
  &.st-ok { background: #F6FFED; color: #52C41A; }
}

.op-body { margin-top: 12rpx; }
.op-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  font-size: 22rpx;
  color: #86909C;
}
.op-retry { color: #FAAD14; }
.op-error {
  margin-top: 8rpx;
  padding: 8rpx 12rpx;
  background: #FFF1F0;
  border-radius: 6rpx;
  font-size: 22rpx;
  color: #FF4D4F;
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
  padding: 16rpx 0;
  border-radius: 8rpx;
  font-size: 26rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &.primary { background: #1677FF; color: #ffffff; }
  &.default { background: #ffffff; color: #1F2329; border: 2rpx solid #E5E6EB; }
  &.danger { background: #ffffff; color: #FF4D4F; border: 2rpx solid #FFCCC7; }
}
</style>
