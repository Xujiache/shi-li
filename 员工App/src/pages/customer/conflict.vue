<template>
  <view class="cf-page">
    <view v-if="loading" class="loading">加载中...</view>

    <view v-else-if="!op" class="empty-state">
      <view>未找到该冲突记录</view>
    </view>

    <view v-else class="cf-body">
      <view class="cf-tip card">
        <view class="cf-tip-title">数据冲突</view>
        <view class="cf-tip-desc">本地修改与服务器数据存在冲突，请选择处理方式</view>
        <view class="cf-tip-meta">
          <text class="meta-tag">{{ typeLabel }}</text>
          <text class="meta-tag">{{ opLabel }}</text>
          <text class="meta-text" v-if="serverVersion">服务器版本: v{{ serverVersion }}</text>
        </view>
      </view>

      <view v-if="diffs.length === 0" class="card no-diff">
        <view class="text-secondary">未发现字段差异（可能是版本号变化引起，建议保留服务器值）</view>
      </view>

      <view v-else class="diffs">
        <view class="cf-section-title">差异字段（{{ diffs.length }}）</view>
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

    <view v-if="op" class="cf-bar">
      <view class="btn btn-default" @click="onCancel">取消</view>
      <view class="btn btn-default" @click="onUseMine">保留我的</view>
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
    // markConflict 把服务端 current 写到 last_error 字段（JSON）
    try {
      const cur = row.last_error ? JSON.parse(row.last_error) : null
      if (cur && typeof cur === 'object') {
        server = cur.current_payload || {}
        curVer = cur.current_version || ''
      }
    } catch (e) {
      server = {}
    }
    // 兼容：早期实现可能把 __server 放在 payload 里
    if ((!server || Object.keys(server).length === 0) && payload && payload.__server) {
      server = payload.__server.current_payload || {}
      curVer = curVer || payload.__server.current_version || ''
    }

    // 剔除 mine 中的内部字段
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
    // 删除 pending_op（服务端值已生效，不需要再提交）
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
    // 解析当前 payload，移除 __server
    let payload: any = {}
    try {
      payload = typeof row.payload === 'string' ? JSON.parse(row.payload || '{}') : (row.payload || {})
    } catch (e) {
      payload = {}
    }
    if (payload && payload.__server) delete payload.__server

    // "用我的" = 把 base_version 改成 server.current_version 重提
    // 因为 repo.pendingOp 没有暴露 update payload 的方法，
    // 这里采用 delete + add 的策略（client_uuid 仍然唯一，UNIQUE 约束允许）
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
  padding: 24rpx;
  padding-bottom: 180rpx;
  min-height: 100vh;
  background: #F5F7FA;
}
.loading {
  text-align: center;
  padding: 80rpx;
  color: #86909C;
  font-size: 28rpx;
}
.empty-state {
  text-align: center;
  padding: 120rpx 32rpx;
  color: #86909C;
}

.cf-tip {
  background: linear-gradient(135deg, #FFF1F0, #FFE4E1);
  border: 1rpx solid #FFCCC7;
}
.cf-tip-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #FF4D4F;
}
.cf-tip-desc {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #4E5969;
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
  padding: 2rpx 14rpx;
  border-radius: 12rpx;
  background: #ffffff;
  color: #1677FF;
  border: 1rpx solid #91D5FF;
}
.meta-text {
  font-size: 22rpx;
  color: #86909C;
}

.cf-section-title {
  font-size: 26rpx;
  color: #86909C;
  margin: 16rpx 8rpx;
}
.no-diff {
  text-align: center;
  padding: 32rpx;
}

.cf-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: #ffffff;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.06);
}
.btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 12rpx;
  font-size: 28rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.btn-default {
  background: #ffffff;
  color: #1F2329;
  border: 2rpx solid #E5E6EB;
}
.btn-primary {
  background: #1677FF;
  color: #ffffff;
}
</style>
