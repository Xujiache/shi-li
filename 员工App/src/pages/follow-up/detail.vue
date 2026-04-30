<template>
  <view class="page" v-if="record">
    <!-- ===== Hero ===== -->
    <view class="hero" :class="`hero-${record.type}`">
      <view class="hero-row">
        <view class="hero-icon">
          <svg-icon :name="typeIcon" :size="40" color="#ffffff" />
        </view>
        <view class="hero-meta">
          <view class="hero-tags">
            <text class="hero-tag">{{ typeText }}</text>
            <text class="hero-tag" :class="`res-${record.result}`">{{ resultText }}</text>
          </view>
          <view class="hero-time">{{ record.follow_at || record.created_at }}</view>
        </view>
      </view>
    </view>

    <!-- 详情卡 -->
    <view class="section">
      <view class="section-card">
        <view class="row">
          <text class="label">客户</text>
          <text class="val">{{ record.customer_name || ('#' + record.customer_id) }}</text>
        </view>
        <view class="row">
          <text class="label">跟进员工</text>
          <text class="val">{{ record.employee_name || record.employee_id || '-' }}</text>
        </view>
        <view class="row" v-if="record.next_follow_up_at">
          <text class="label">下次跟进</text>
          <text class="val warn">{{ record.next_follow_up_at }}</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">沟通内容</view>
      <view class="section-card">
        <view class="content-text">{{ record.content || '-' }}</view>
      </view>
    </view>

    <view v-if="attList.length" class="section">
      <view class="section-title">附件 ({{ attList.length }})</view>
      <view class="section-card pad-grid">
        <view class="grid">
          <view v-for="(a, i) in attList" :key="i" class="grid-item">
            <image :src="a.url" mode="aspectFill" class="att-img" @click="preview(i)" />
          </view>
        </view>
      </view>
    </view>

    <!-- ===== 操作栏 ===== -->
    <view v-if="canEdit" class="bottom-bar">
      <view class="bb-btn" @click="onEdit">
        <svg-icon name="edit-3" :size="26" color="#4E5969" />
        <text>编辑</text>
      </view>
      <view class="bb-btn" @click="openShare">
        <svg-icon name="share-2" :size="26" color="#4E5969" />
        <text>分享</text>
      </view>
      <view class="bb-btn danger" @click="onDelete">
        <svg-icon name="trash-2" :size="26" color="#F53F3F" />
        <text>删除</text>
      </view>
    </view>

    <!-- 分享弹层 -->
    <view v-if="shareVisible" class="share-mask" @click.self="closeShare">
      <view class="share-panel" @click.stop>
        <view class="share-head">
          <text class="share-title">分享给同事</text>
          <view class="share-close" @click="closeShare">
            <svg-icon name="x" :size="32" color="#86909C" />
          </view>
        </view>
        <view v-if="!shareCandidates.length" class="share-empty">
          <view class="share-empty-icon">
            <svg-icon name="users" :size="80" color="#C9CDD4" />
          </view>
          <text>没有可分享的同事</text>
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
            <svg-icon name="chevron-right" :size="24" color="#1677FF" />
          </view>
        </scroll-view>
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

const typeMap: Record<string, string> = { phone: '电话', wechat: '微信', face: '当面', other: '其他' }
const resultMap: Record<string, string> = {
  no_progress: '无进展',
  interested: '有意向',
  follow_up: '需复跟',
  signed: '已成交',
  lost: '已流失'
}
const typeIconMap: Record<string, string> = {
  phone: 'phone', wechat: 'send', face: 'user', other: 'more-horizontal'
}

const typeText = computed(() => typeMap[record.value?.type] || record.value?.type || '-')
const resultText = computed(() => resultMap[record.value?.result] || record.value?.result || '-')
const typeIcon = computed(() => typeIconMap[record.value?.type] || 'edit-3')

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
  } catch (e) { /* */ }
}

function onDelete() {
  uni.showModal({
    title: '删除跟进',
    content: '确定删除这条跟进记录？该操作不可撤销。',
    confirmColor: '#F53F3F',
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
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

.hero {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  padding: 40rpx 32rpx 56rpx;
  border-radius: 0 0 32rpx 32rpx;
  color: #ffffff;
  margin-bottom: -28rpx;
}
.hero-phone { background: linear-gradient(135deg, #00B42A, #4ED365); }
.hero-wechat { background: linear-gradient(135deg, #07C160, #4EE194); }
.hero-face { background: linear-gradient(135deg, #FA8C16, #FFB264); }
.hero-other { background: linear-gradient(135deg, #4E5969, #86909C); }

.hero-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.hero-icon {
  width: 96rpx; height: 96rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.22);
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.hero-meta { flex: 1; min-width: 0; }
.hero-tags {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}
.hero-tag {
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.hero-tag.res-no_progress { background: rgba(255, 255, 255, 0.2); }
.hero-tag.res-interested { background: rgba(250, 140, 22, 0.85); }
.hero-tag.res-follow_up { background: rgba(22, 119, 255, 0.85); }
.hero-tag.res-signed { background: rgba(0, 180, 42, 0.9); }
.hero-tag.res-lost { background: rgba(245, 63, 63, 0.85); }
.hero-time {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.95);
}

.section {
  padding: 24rpx;
  position: relative;
  z-index: 1;
}
.section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.section-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.section-card.pad-grid { padding: 16rpx; }

.row {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
}
.label { width: 180rpx; color: #86909C; flex-shrink: 0; }
.val { flex: 1; color: #1F2329; word-break: break-all; text-align: right; }
.val.warn { color: #FA8C16; }

.content-text {
  padding: 24rpx 0;
  font-size: 28rpx;
  line-height: 1.7;
  color: #1F2329;
  white-space: pre-wrap;
  word-break: break-all;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}
.grid-item {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #F2F3F5;
  border-radius: 16rpx;
  overflow: hidden;
}
.att-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

.bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: #ffffff;
  padding: 16rpx 24rpx 32rpx;
  box-shadow: 0 -4rpx 16rpx rgba(20, 30, 60, 0.05);
  gap: 12rpx;
  z-index: 10;
}
.bb-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 20rpx;
  font-size: 26rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-weight: 500;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
  &.danger {
    background: #FFF1F0;
    color: #F53F3F;
  }
  &.danger text { color: #F53F3F; }
}

/* 分享弹层 */
.share-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end;
  z-index: 999;
}
.share-panel {
  width: 100%;
  max-height: 70vh;
  background: #ffffff;
  border-top-left-radius: 32rpx;
  border-top-right-radius: 32rpx;
  display: flex;
  flex-direction: column;
}
.share-head {
  padding: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #F2F3F5;
}
.share-title { font-size: 30rpx; font-weight: 700; color: #1F2329; }
.share-close {
  display: flex; align-items: center; justify-content: center;
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  &:active { background: #F2F3F5; }
}
.share-empty {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #86909C;
}
.share-empty-icon { display: flex; justify-content: center; margin-bottom: 16rpx; }
.share-list { max-height: 50vh; padding: 8rpx 0; }
.share-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  &:active { background: #F7F8FA; }
}
.share-avatar {
  width: 72rpx; height: 72rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600;
  margin-right: 16rpx; flex-shrink: 0;
}
.share-meta {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
}
.share-name { font-size: 28rpx; color: #1F2329; font-weight: 500; }
.share-role { font-size: 22rpx; color: #86909C; margin-top: 4rpx; }
</style>
