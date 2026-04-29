<template>
  <view class="page">
    <view v-if="items.length === 0 && !loading" class="empty-wrap">
      <empty-state text="暂无待审批的转出申请" icon="check-circle" />
    </view>
    <view v-else class="list">
      <view v-for="it in items" :key="it.id" class="card">
        <view class="row top">
          <text class="cust">{{ it.customer_name || `客户#${it.customer_id}` }}</text>
          <view class="badge b-pending">待审批</view>
        </view>
        <view class="row meta">
          <text class="time">{{ it.from_employee_name || '—' }} · {{ fmtDateTime(it.created_at) }}</text>
        </view>
        <view class="row">
          <text class="lbl">原因</text>
          <text class="val multi">{{ it.reason || '—' }}</text>
        </view>
        <view class="row btns">
          <button class="btn-approve" size="mini" @tap="onApproveClick(it)">通过</button>
          <button class="btn-reject" size="mini" @tap="onRejectClick(it)">驳回</button>
        </view>
      </view>
      <view v-if="loading" class="loading-tip">加载中…</view>
      <view v-else-if="!hasMore && items.length > 0" class="loading-tip">— 没有更多了 —</view>
    </view>

    <!-- 通过弹窗 -->
    <view v-if="approveDialog.show" class="mask" @tap="closeApprove">
      <view class="dialog" @tap.stop>
        <view class="d-title">通过转出</view>
        <view class="d-body">
          <view class="d-row">
            <text class="d-label">转给</text>
            <picker
              :range="memberRange"
              :value="approveDialog.memberIdx"
              @change="onMemberChange"
            >
              <view class="d-picker">
                {{ memberRange[approveDialog.memberIdx] || '请选择员工' }}
              </view>
            </picker>
          </view>
          <view class="d-row col">
            <text class="d-label">审批备注</text>
            <textarea
              v-model="approveDialog.remark"
              class="d-textarea"
              placeholder="可选"
              :maxlength="200"
              auto-height
            />
          </view>
        </view>
        <view class="d-footer">
          <button class="d-cancel" size="mini" @tap="closeApprove">取消</button>
          <button class="d-ok" size="mini" :disabled="approveDialog.submitting" @tap="confirmApprove">
            {{ approveDialog.submitting ? '提交中…' : '确认通过' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 驳回弹窗 -->
    <view v-if="rejectDialog.show" class="mask" @tap="closeReject">
      <view class="dialog" @tap.stop>
        <view class="d-title">驳回转出</view>
        <view class="d-body">
          <view class="d-row col">
            <text class="d-label">驳回原因 <text class="req">*</text></text>
            <textarea
              v-model="rejectDialog.remark"
              class="d-textarea"
              placeholder="请输入驳回原因（必填）"
              :maxlength="200"
              auto-height
            />
          </view>
        </view>
        <view class="d-footer">
          <button class="d-cancel" size="mini" @tap="closeReject">取消</button>
          <button class="d-ok" size="mini" :disabled="rejectDialog.submitting || !rejectDialog.remark.trim()" @tap="confirmReject">
            {{ rejectDialog.submitting ? '提交中…' : '确认驳回' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import * as transferApi from '@/api/transfer'
import { getTeamMembers } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'
import { fmtDateTime } from '@/utils/format'
import { v4 } from '@/utils/uuid'

const auth = useAuthStore()
const items = ref<any[]>([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(true)
const loading = ref(false)

const members = ref<any[]>([])
const memberRange = computed(() =>
  members.value.map((m) => `${m.display_name || m.name || '员工'}（${m.role || 'staff'}）`)
)

const approveDialog = ref<{ show: boolean; id: any; memberIdx: number; remark: string; submitting: boolean }>({
  show: false, id: null, memberIdx: -1, remark: '', submitting: false
})
const rejectDialog = ref<{ show: boolean; id: any; remark: string; submitting: boolean }>({
  show: false, id: null, remark: '', submitting: false
})

onLoad(() => {
  if (!auth.isManager) {
    uni.showToast({ title: '仅经理可查看', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  loadMembers()
  reload()
})

async function loadMembers() {
  try {
    const data = await getTeamMembers()
    const list = Array.isArray(data) ? data : ((data as any)?.items || [])
    members.value = list.filter((m: any) => m.role === 'staff' && m.id !== auth.employee?.id)
  } catch (e) {
    // 静默
  }
}

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
    const res: any = await transferApi.pending({ page: page.value, page_size: pageSize })
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

function onApproveClick(it: any) {
  approveDialog.value = { show: true, id: it.id, memberIdx: -1, remark: '', submitting: false }
}
function closeApprove() {
  if (approveDialog.value.submitting) return
  approveDialog.value.show = false
}
function onMemberChange(e: any) {
  approveDialog.value.memberIdx = Number(e.detail.value)
}
async function confirmApprove() {
  const idx = approveDialog.value.memberIdx
  if (idx < 0 || !members.value[idx]) {
    uni.showToast({ title: '请选择转给的员工', icon: 'none' })
    return
  }
  approveDialog.value.submitting = true
  try {
    await transferApi.approve(approveDialog.value.id, {
      to_employee_id: members.value[idx].id,
      approval_remark: approveDialog.value.remark.trim(),
      client_uuid: v4()
    } as any)
    uni.showToast({ title: '已通过', icon: 'success' })
    removeItem(approveDialog.value.id)
    approveDialog.value.show = false
  } catch (e) {
    // http.ts 已 toast
  } finally {
    approveDialog.value.submitting = false
  }
}

function onRejectClick(it: any) {
  rejectDialog.value = { show: true, id: it.id, remark: '', submitting: false }
}
function closeReject() {
  if (rejectDialog.value.submitting) return
  rejectDialog.value.show = false
}
async function confirmReject() {
  const remark = rejectDialog.value.remark.trim()
  if (!remark) {
    uni.showToast({ title: '请输入驳回原因', icon: 'none' })
    return
  }
  rejectDialog.value.submitting = true
  try {
    await transferApi.reject(rejectDialog.value.id, {
      approval_remark: remark,
      client_uuid: v4()
    } as any)
    uni.showToast({ title: '已驳回', icon: 'success' })
    removeItem(rejectDialog.value.id)
    rejectDialog.value.show = false
  } catch (e) {
    // http.ts 已 toast
  } finally {
    rejectDialog.value.submitting = false
  }
}

function removeItem(id: any) {
  items.value = items.value.filter((x) => x.id !== id)
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
}
.meta .time { font-size: 24rpx; color: #86909C; }
.lbl { font-size: 26rpx; color: #86909C; min-width: 80rpx; }
.val { flex: 1; font-size: 26rpx; color: #1F2329; word-break: break-all; }
.val.multi { line-height: 1.5; }
.btns { gap: 16rpx; padding-top: 8rpx; }
.btn-approve {
  background: #00A65A; color: #fff; font-size: 24rpx; border-radius: 32rpx; padding: 0 32rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.btn-reject {
  background: #F53F3F; color: #fff; font-size: 24rpx; border-radius: 32rpx; padding: 0 32rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
}
.loading-tip { text-align: center; font-size: 24rpx; color: #86909C; padding: 24rpx 0; }

/* dialog */
.mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 999;
}
.dialog {
  width: 600rpx; background: #fff; border-radius: 16rpx;
  display: flex; flex-direction: column; overflow: hidden;
}
.d-title { font-size: 32rpx; font-weight: 600; color: #1F2329; padding: 32rpx 32rpx 16rpx; }
.d-body { padding: 16rpx 32rpx; display: flex; flex-direction: column; gap: 24rpx; }
.d-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.d-row.col { flex-direction: column; align-items: stretch; gap: 12rpx; }
.d-label { font-size: 26rpx; color: #1F2329; }
.req { color: #F53F3F; }
.d-picker {
  background: #F7F8FA; border-radius: 8rpx; padding: 12rpx 20rpx;
  font-size: 26rpx; color: #1F2329; min-width: 280rpx; text-align: right;
}
.d-textarea {
  background: #F7F8FA; border-radius: 8rpx; padding: 16rpx;
  font-size: 26rpx; min-height: 160rpx; width: 100%; box-sizing: border-box;
}
.d-footer {
  display: flex; gap: 16rpx; padding: 16rpx 32rpx 32rpx; justify-content: flex-end;
}
.d-cancel { background: #F2F3F5; color: #4E5969; font-size: 26rpx; border-radius: 32rpx; padding: 0 32rpx; }
.d-ok {
  background: #1677FF; color: #fff; font-size: 26rpx; border-radius: 32rpx; padding: 0 32rpx;
  &[disabled] { background: #C9CDD4; color: #fff; }
}
</style>
