<template>
  <view class="page">
    <view v-if="items.length === 0 && !loading" class="empty-wrap">
      <empty-state text="暂无待审批的转出申请" icon="check-circle" />
    </view>
    <view v-else class="list">
      <view v-for="it in items" :key="it.id" class="item-card">
        <view class="row top">
          <view class="left-info">
            <text class="cust">{{ it.customer_name || `客户#${it.customer_id}` }}</text>
            <text class="time">{{ it.from_employee_name || '—' }} · {{ fmtDateTime(it.created_at) }}</text>
          </view>
          <view class="badge b-pending">待审批</view>
        </view>

        <view class="reason-block">
          <text class="reason-label">转出原因</text>
          <text class="reason-text">{{ it.reason || '—' }}</text>
        </view>

        <view class="actions">
          <view class="btn btn-reject" @tap="onRejectClick(it)">
            <svg-icon name="x-circle" :size="24" color="#F53F3F" />
            <text>驳回</text>
          </view>
          <view class="btn btn-approve" @tap="onApproveClick(it)">
            <svg-icon name="check-circle" :size="24" color="#ffffff" />
            <text>通过</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="loading-tip">加载中…</view>
      <view v-else-if="!hasMore && items.length > 0" class="loading-tip">— 没有更多了 —</view>
    </view>

    <!-- 通过弹窗 -->
    <view v-if="approveDialog.show" class="mask" @tap="closeApprove">
      <view class="dialog" @tap.stop>
        <view class="d-head">
          <view class="d-icon d-icon-green">
            <svg-icon name="check-circle" :size="36" color="#00B42A" />
          </view>
          <text class="d-title">通过转出申请</text>
        </view>
        <view class="d-body">
          <view class="d-row">
            <text class="d-label">转给员工 <text class="req">*</text></text>
            <picker :range="memberRange" :value="approveDialog.memberIdx" @change="onMemberChange">
              <view class="d-picker">
                <text :class="{ ph: approveDialog.memberIdx < 0 }">
                  {{ memberRange[approveDialog.memberIdx] || '请选择员工' }}
                </text>
                <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
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
            />
          </view>
        </view>
        <view class="d-footer">
          <view class="d-btn d-cancel" @tap="closeApprove">取消</view>
          <view class="d-btn d-ok-green" :class="{ disabled: approveDialog.submitting }" @tap="confirmApprove">
            {{ approveDialog.submitting ? '提交中…' : '确认通过' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 驳回弹窗 -->
    <view v-if="rejectDialog.show" class="mask" @tap="closeReject">
      <view class="dialog" @tap.stop>
        <view class="d-head">
          <view class="d-icon d-icon-red">
            <svg-icon name="x-circle" :size="36" color="#F53F3F" />
          </view>
          <text class="d-title">驳回转出申请</text>
        </view>
        <view class="d-body">
          <view class="d-row col">
            <text class="d-label">驳回原因 <text class="req">*</text></text>
            <textarea
              v-model="rejectDialog.remark"
              class="d-textarea"
              placeholder="请输入驳回原因（必填）"
              :maxlength="200"
            />
          </view>
        </view>
        <view class="d-footer">
          <view class="d-btn d-cancel" @tap="closeReject">取消</view>
          <view
            class="d-btn d-ok-red"
            :class="{ disabled: rejectDialog.submitting || !rejectDialog.remark.trim() }"
            @tap="confirmReject"
          >
            {{ rejectDialog.submitting ? '提交中…' : '确认驳回' }}
          </view>
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
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()
const items = ref<any[]>([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(true)
const loading = ref(false)

const members = ref<any[]>([])
const memberRange = computed(() =>
  members.value.map((m) => `${m.display_name || m.name || '员工'}（${m.position || (m.role === 'manager' ? '主管' : '员工')}）`)
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
  } catch (e) { /* */ }
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
  if (approveDialog.value.submitting) return
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
  } catch (e) { /* */ } finally {
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
  if (rejectDialog.value.submitting) return
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
  } catch (e) { /* */ } finally {
    rejectDialog.value.submitting = false
  }
}

function removeItem(id: any) {
  items.value = items.value.filter((x) => x.id !== id)
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

.list { display: flex; flex-direction: column; gap: 16rpx; }
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
.cust { font-size: 32rpx; font-weight: 600; color: #1F2329; }
.time { display: block; margin-top: 6rpx; font-size: 22rpx; color: #86909C; }
.badge {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
  font-weight: 500;
  &.b-pending { background: #FFF7E6; color: #FA8C16; }
}

.reason-block {
  background: #F7F8FA;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
}
.reason-label {
  font-size: 22rpx;
  color: #86909C;
  display: block;
  margin-bottom: 6rpx;
}
.reason-text {
  font-size: 26rpx;
  color: #1F2329;
  line-height: 1.6;
  word-break: break-all;
}

.actions {
  display: flex;
  gap: 12rpx;
}
.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  font-weight: 500;
  transition: all 0.15s;
  &:active { transform: scale(0.98); }
}
.btn-reject {
  background: #FFF1F0;
  color: #F53F3F;
}
.btn-approve {
  background: linear-gradient(135deg, #00B42A, #4ED365);
  color: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(0, 180, 42, 0.3);
}
.btn-approve text { color: #ffffff; }

.loading-tip { text-align: center; font-size: 24rpx; color: #86909C; padding: 32rpx 0; }

/* dialog */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 0 32rpx;
}
.dialog {
  width: 100%;
  max-width: 640rpx;
  background: #ffffff;
  border-radius: 32rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.d-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 40rpx 32rpx 16rpx;
}
.d-icon {
  width: 96rpx; height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-icon-green { background: #E6F7ED; }
.d-icon-red { background: #FFECEB; }
.d-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2329;
}

.d-body {
  padding: 8rpx 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.d-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  &.col { /* 默认就是 col */ }
}
.d-label {
  font-size: 26rpx;
  color: #4E5969;
}
.req { color: #F53F3F; margin-left: 4rpx; }
.d-picker {
  background: #F7F8FA;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #1F2329;
  display: flex;
  align-items: center;
  justify-content: space-between;
  &:active { opacity: 0.7; }
}
.d-picker .ph { color: #C9CDD4; }
.d-textarea {
  background: #F7F8FA;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 26rpx;
  color: #1F2329;
  min-height: 160rpx;
  width: 100%;
  box-sizing: border-box;
}

.d-footer {
  display: flex;
  gap: 12rpx;
  padding: 0 32rpx 32rpx;
}
.d-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 500;
  transition: all 0.15s;
  &:active { transform: scale(0.98); }
  &.disabled { opacity: 0.5; }
}
.d-cancel { background: #F2F3F5; color: #4E5969; }
.d-ok-green {
  background: linear-gradient(135deg, #00B42A, #4ED365);
  color: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(0, 180, 42, 0.3);
}
.d-ok-red {
  background: linear-gradient(135deg, #F53F3F, #FF7875);
  color: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(245, 63, 63, 0.3);
}
</style>
