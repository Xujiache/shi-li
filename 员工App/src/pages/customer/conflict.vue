<template>
  <view class="cf-page">
    <view v-if="loading" class="state">加载中...</view>

    <view v-else-if="!op" class="state empty">
      <view class="empty-icon">
        <svg-icon name="x-circle" :size="80" color="#C9CDD4" />
      </view>
      <view>未找到该冲突记录</view>
    </view>

    <view v-else class="cf-body">
      <!-- 顶部警示卡 -->
      <view class="cf-tip">
        <view class="cf-tip-head">
          <view class="cf-tip-icon">
            <svg-icon name="alarm-clock" :size="40" color="#F53F3F" />
          </view>
          <view class="cf-tip-title">数据冲突</view>
        </view>
        <view class="cf-tip-desc">本地修改与服务器数据存在冲突，请选择处理方式</view>
        <view class="cf-tip-meta">
          <text class="meta-tag">{{ typeLabel }}</text>
          <text class="meta-tag">{{ opLabel }}</text>
          <text class="meta-text" v-if="serverVersion">服务器版本 v{{ serverVersion }}</text>
        </view>
      </view>

      <view v-if="diffs.length === 0" class="card no-diff">
        <view class="no-diff-icon">
          <svg-icon name="check-circle" :size="48" color="#86909C" />
        </view>
        <text>未发现字段差异（可能是版本号变化引起，建议保留服务器值）</text>
      </view>

      <view v-else>
        <view class="cf-section-title">差异字段（{{ diffs.length }}）</view>
        <view class="diffs">
          <conflict-row
            v-for="d in diffs"
            :key="d.field"
            :field="d.field"
            :label="d.label"
            :mine="d.mine"
            :server="d.server"
          />
        </view>
      </view>
    </view>

    <view v-if="op" class="cf-bar">
      <view class="btn btn-default" @click="onCancel">取消</view>
      <view class="btn btn-mine" @click="onUseMine">保留我的</view>
      <view class="btn btn-primary" @click="onUseServer">用服务器值</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { repo } from '@/db'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { defaultSchemaForType, diffFields, type DiffRow } from '@/utils/conflict'
import ConflictRow from '@/components/conflict-row.vue'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()
const sync = useSyncStore()

const loading = ref(true)
const opId = ref<number>(0)
const op = ref<any>(null)
const minePayload = ref<any>({})
const serverPayload = ref<any>({})
const serverVersion = ref<string>('')

const diffs = ref<DiffRow[]>([])

const typeLabel = computed(() => {
  const t = op.value?.type
  if (t === 'customer') return '客户'
  if (t === 'follow_up') return '跟进'
  if (t === 'transfer') return '转出'
  return t || '未知'
})

const opLabel = computed(() => {
  const o = String(op.value?.op || '').toLowerCase()
  if (o === 'create') return '新建'
  if (o === 'update') return '修改'
  if (o === 'delete') return '删除'
  return o
})

onLoad((q: any) => {
  const id = Number(q?.pending_op_id || 0)
  opId.value = id
  load()
})

async function load() {
  loading.value = true
  try {
    if (!opId.value) {
      op.value = null
      return
    }
    const row = await repo.pendingOp.getById(opId.value)
    if (!row) {
      op.value = null
      return
    }
    op.value = row

    let payload: any = {}
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {})
    } catch (e) {
      payload = {}
    }

    let server: any = {}
    let curVer = ''
    try {
      const cur = row.last_error ? JSON.parse(row.last_error) : null
      if (cur && typeof cur === 'object') {
        server = cur.current_payload || {}
        curVer = cur.current_version || ''
      }
    } catch (e) {
      server = {}
    }
    if ((!server || Object.keys(server).length === 0) && payload && payload.__server) {
      server = payload.__server.current_payload || {}
      curVer = curVer || payload.__server.current_version || ''
    }

    const mine: any = {}
    for (const k of Object.keys(payload || {})) {
      if (k === '__server') continue
      mine[k] = payload[k]
    }
    minePayload.value = mine
    serverPayload.value = server
    serverVersion.value = String(curVer || '')

    const schema = defaultSchemaForType(row.type)
    diffs.value = diffFields(mine, server, schema)
  } catch (e) {
    console.warn('[conflict] load failed', e)
    op.value = null
  } finally {
    loading.value = false
  }
}

function actor() {
  const eid = auth.employee?.id
  if (!eid) return null
  return { employee_id: eid }
}

async function onUseServer() {
  const a = actor()
  if (!a || !op.value) return
  try {
    const t = op.value.type
    const server = serverPayload.value || {}
    if (t === 'customer') {
      const uuid = op.value.client_uuid
      await repo.customers.upsert(a, {
        ...server,
        client_uuid: uuid,
        server_id: op.value.server_id || server.id || null,
        base_version: serverVersion.value,
        dirty: 0
      })
    } else if (t === 'follow_up') {
      const uuid = op.value.client_uuid
      await repo.followUps.upsert(a, {
        ...server,
        client_uuid: uuid,
        server_id: op.value.server_id || server.id || null,
        base_version: serverVersion.value,
        dirty: 0
      })
    }
    await repo.pendingOp.deleteById(op.value.id)
    await sync.refreshCounts(a)
    uni.showToast({ title: '已使用服务器值', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    console.warn('[conflict.useServer] failed', e)
    uni.showToast({ title: '处理失败：' + (e?.message || ''), icon: 'none' })
  }
}

async function onUseMine() {
  const a = actor()
  if (!a || !op.value) return
  try {
    const row = op.value
    let payload: any = {}
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {})
    } catch (e) {
      payload = {}
    }
    if (payload && payload.__server) delete payload.__server

    await repo.pendingOp.deleteById(row.id)
    await repo.pendingOp.add(a, {
      owner_employee_id: a.employee_id,
      client_uuid: row.client_uuid,
      type: row.type,
      op: row.op,
      payload,
      base_version: serverVersion.value || row.base_version || '',
      server_id: row.server_id || null,
      status: 'pending',
      retry_count: 0,
      next_retry_at: 0,
      last_error: ''
    })
    await sync.refreshCounts(a)
    sync.kick('manual_resolve')
    uni.showToast({ title: '已保留我的修改', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    console.warn('[conflict.useMine] failed', e)
    uni.showToast({ title: '处理失败：' + (e?.message || ''), icon: 'none' })
  }
}

function onCancel() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.cf-page {
  min-height: 100vh;
  background: #F5F7FA;
  padding: 24rpx 24rpx 200rpx;
}

.state {
  text-align: center;
  padding: 120rpx 32rpx;
  color: #86909C;
  font-size: 26rpx;
}
.empty .empty-icon {
  margin-bottom: 24rpx;
  display: flex;
  justify-content: center;
}

.cf-tip {
  background: linear-gradient(135deg, #FFF1F0 0%, #FFFFFF 100%);
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
  border-left: 6rpx solid #F53F3F;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(245, 63, 63, 0.08);
}
.cf-tip-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;
}
.cf-tip-icon {
  width: 64rpx; height: 64rpx;
  border-radius: 16rpx;
  background: rgba(245, 63, 63, 0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cf-tip-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #F53F3F;
}
.cf-tip-desc {
  font-size: 26rpx;
  color: #4E5969;
  line-height: 1.5;
}
.cf-tip-meta {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}
.meta-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: #ffffff;
  color: #1677FF;
  border: 1rpx solid #91D5FF;
}
.meta-text { font-size: 22rpx; color: #86909C; }

.no-diff {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 48rpx 32rpx;
  text-align: center;
  font-size: 26rpx;
  color: #86909C;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.no-diff-icon {
  margin-bottom: 16rpx;
  display: flex;
  justify-content: center;
}

.cf-section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 16rpx 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.diffs {
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

.cf-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: flex;
  gap: 12rpx;
  padding: 20rpx 24rpx 32rpx;
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(20, 30, 60, 0.05);
}
.btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.btn-default {
  background: #F2F3F5;
  color: #4E5969;
}
.btn-mine {
  background: #FFF7E6;
  color: #FA8C16;
  border: 1rpx solid #FFE7BA;
}
.btn-primary {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(22, 119, 255, 0.3);
}
</style>
