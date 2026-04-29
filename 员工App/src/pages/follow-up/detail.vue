<template>
  <view class="page" v-if="record">
    <view class="card">
      <view class="head">
        <text class="type-tag" :class="'t-' + record.type">{{ typeText }}</text>
        <text class="time">{{ record.follow_at || record.created_at }}</text>
      </view>
      <view class="row">
        <text class="label">客户</text>
        <text class="val">{{ record.customer_name || ('#' + record.customer_id) }}</text>
      </view>
      <view class="row">
        <text class="label">结果</text>
        <text class="val">{{ resultText }}</text>
      </view>
      <view class="row">
        <text class="label">跟进员工</text>
        <text class="val">{{ record.employee_name || record.employee_id || '-' }}</text>
      </view>
      <view class="row" v-if="record.next_follow_up_at">
        <text class="label">下次跟进</text>
        <text class="val warn">{{ record.next_follow_up_at }}</text>
      </view>
      <view class="row col">
        <text class="label">内容</text>
        <view class="content">{{ record.content || '-' }}</view>
      </view>
      <view class="row col" v-if="attList.length">
        <text class="label">附件</text>
        <view class="grid">
          <view v-for="(a, i) in attList" :key="i" class="grid-item">
            <image :src="a.url" mode="aspectFill" class="att-img" @click="preview(i)" />
          </view>
        </view>
      </view>
    </view>

    <view v-if="canEdit" class="actions">
      <view class="btn-default" @click="onEdit">
        <svg-icon name="edit-3" :size="24" color="#4E5969" />
        <text>编辑</text>
      </view>
      <view class="btn-default" @click="openShare">
        <svg-icon name="share-2" :size="24" color="#4E5969" />
        <text>分享</text>
      </view>
      <view class="btn-danger" @click="onDelete">
        <svg-icon name="trash-2" :size="24" color="#F5222D" />
        <text>删除</text>
      </view>
    </view>

    <!-- 分享同事选择弹层 -->
    <view v-if="shareVisible" class="share-mask" @click.self="closeShare">
      <view class="share-panel" @click.stop>
        <view class="share-title">选择同部门同事</view>
        <view v-if="!shareCandidates.length" class="share-empty">
          没有可分享的同事
        </view>
        <scroll-view scroll-y class="share-list" v-else>
          <view
            v-for="m in shareCandidates"
            :key="m.id"
            class="share-item"
            @click="confirmShare(m)"
          >
            <view class="share-avatar">{{ String(m.display_name || '?').charAt(0) }}</view>
            <view class="share-meta">
              <text class="share-name">{{ m.display_name }}</text>
              <text class="share-role">{{ m.position || roleZh(m.role) }}</text>
            </view>
            <view class="share-go">
              <text>分享</text>
              <svg-icon name="chevron-right" :size="22" color="#1677FF" />
            </view>
          </view>
        </scroll-view>
        <view class="share-cancel" @click="closeShare">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as followUpApi from '@/api/followUp'
import { useAuthStore } from '@/stores/auth'
import { useFollowUpsStore } from '@/stores/followUps'
import { useTeamStore } from '@/stores/team'
import SvgIcon from '@/components/svg-icon.vue'

const followUpsStore = useFollowUpsStore()
const teamStore = useTeamStore()

const auth = useAuthStore()
const id = ref<string>('')
const record = ref<any>(null)

const typeMap: Record<string, string> = {
  phone: '电话', wechat: '微信', face: '当面', other: '其他'
}
const resultMap: Record<string, string> = {
  no_progress: '无进展',
  interested: '有意向',
  follow_up: '需复跟',
  signed: '已成交',
  lost: '已流失'
}

const typeText = computed(() => typeMap[record.value?.type] || record.value?.type || '-')
const resultText = computed(() => resultMap[record.value?.result] || record.value?.result || '-')

const attList = computed(() => {
  const a = record.value?.attachments
  if (!a) return []
  if (Array.isArray(a)) return a
  try {
    const p = JSON.parse(a)
    return Array.isArray(p) ? p : []
  } catch { return [] }
})

const canEdit = computed(() => {
  if (!record.value) return false
  return Number(auth.employee?.id) === Number(record.value.employee_id)
})

async function load() {
  try {
    record.value = await followUpApi.detail(id.value)
  } catch (e) { /* */ }
}

function preview(i: number) {
  uni.previewImage({
    urls: attList.value.map((x: any) => x.url),
    current: attList.value[i].url
  })
}

function onEdit() {
  uni.navigateTo({ url: `/pages/follow-up/new?id=${id.value}` })
}

// 分享给同事 ===========================================
const shareVisible = ref(false)
const shareCandidates = ref<any[]>([])

function roleZh(r: string) {
  return r === 'manager' ? '主管' : r === 'staff' ? '员工' : ''
}

async function openShare() {
  shareVisible.value = true
  try {
    const list = await teamStore.loadMembers()
    const myId = Number(auth.employee?.id)
    shareCandidates.value = (list || []).filter((m: any) => Number(m.id) !== myId)
  } catch (e) {
    shareCandidates.value = []
  }
}

function closeShare() {
  shareVisible.value = false
}

async function confirmShare(m: any) {
  try {
    await followUpApi.share(id.value, Number(m.id))
    uni.showToast({ title: '已分享给 ' + (m.display_name || ''), icon: 'success' })
    shareVisible.value = false
  } catch (e) {
    // http 拦截器已 toast
  }
}

function onDelete() {
  uni.showModal({
    title: '删除跟进',
    content: '确定删除这条跟进记录？该操作不可撤销。',
    success: async (r) => {
      if (r.confirm) {
        try {
          const ret = await followUpsStore.deleteFollowUp(id.value)
          if (ret.status === 'ok') {
            uni.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => uni.navigateBack(), 600)
          }
        } catch (e) { /* */ }
      }
    }
  })
}

onLoad((q: any) => { id.value = String(q?.id || '') })
onShow(() => { if (id.value) load() })
</script>

<style lang="scss" scoped>
.page { padding: 16rpx; padding-bottom: 120rpx; }

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.type-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: #E8F3FF;
  color: #1677FF;
  &.t-phone { background: #F0F9EB; color: #67C23A; }
  &.t-wechat { background: #E1F3D8; color: #07C160; }
  &.t-face { background: #FDF6EC; color: #E6A23C; }
  &.t-other { background: #F2F3F5; color: #4E5969; }
}
.time { font-size: 24rpx; color: #86909C; }

.row {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
  &.col { flex-direction: column; align-items: flex-start; }
}
.label {
  width: 160rpx;
  color: #86909C;
  flex-shrink: 0;
}
.val { flex: 1; color: #1F2329; word-break: break-all; }
.warn { color: #FA8C16; }
.content {
  margin-top: 12rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: #1F2329;
  white-space: pre-wrap;
}

.grid {
  margin-top: 12rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  width: 100%;
}
.grid-item {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #F2F3F5;
  border-radius: 12rpx;
  overflow: hidden;
}
.att-img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}

.actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
}
.btn-default,
.btn-danger {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.btn-default {
  background: #F2F3F5;
  color: #1F2329;
}
.btn-danger {
  background: #FFF1F0;
  color: #F5222D;
}

/* 分享弹层 */
.share-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end;
  z-index: 999;
}
.share-panel {
  width: 100%;
  max-height: 70vh;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}
.share-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  color: #1F2329;
}
.share-list { max-height: 50vh; }
.share-item {
  display: flex;
  align-items: center;
  padding: 20rpx 12rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.share-avatar {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  background: #E8F3FF; color: #1677FF;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600;
  margin-right: 16rpx; flex-shrink: 0;
}
.share-meta {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
}
.share-name { font-size: 28rpx; color: #1F2329; }
.share-role { font-size: 22rpx; color: #86909C; margin-top: 4rpx; }
.share-go {
  font-size: 24rpx;
  color: #1677FF;
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.share-empty {
  padding: 64rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #86909C;
}
.share-cancel {
  margin-top: 16rpx;
  padding: 24rpx;
  background: #F2F3F5;
  border-radius: 12rpx;
  text-align: center;
  font-size: 28rpx;
  color: #4E5969;
}
</style>
