<template>
  <view class="page" v-if="customer">
    <!-- ===== 顶部客户卡 ===== -->
    <view class="hero-card">
      <view class="hero-top">
        <view class="hero-avatar">{{ avatarChar }}</view>
        <view class="hero-info">
          <view class="hero-name-row">
            <text class="hero-name">{{ customer.display_name || '-' }}</text>
            <text class="hero-status" :class="'st-' + customer.status">{{ statusText }}</text>
          </view>
          <view class="hero-tags-line">
            <text v-if="customer.level" class="hero-level" :class="'lv-' + customer.level">{{ customer.level }}级</text>
            <text v-if="genderText !== '-'" class="hero-meta">{{ genderText }}</text>
            <text v-if="customer.age" class="hero-meta">{{ customer.age }}岁</text>
            <text v-if="customer.customer_no" class="hero-meta">No.{{ customer.customer_no }}</text>
          </view>
          <view v-if="customer.phone" class="hero-phone-row">
            <svg-icon name="phone" :size="22" color="#86909C" />
            <text class="hero-phone">{{ customer.phone }}</text>
            <view class="hero-call" @click="onCall">
              <svg-icon name="phone" :size="22" color="#ffffff" />
              <text>呼叫</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== Tab ===== -->
    <view class="tabs-wrap">
      <view class="tabs">
        <view
          v-for="(t, i) in tabs"
          :key="i"
          class="tab"
          :class="{ active: tab === i }"
          @click="tab = i"
        >{{ t }}</view>
      </view>
    </view>

    <!-- ===== 基本信息 ===== -->
    <view v-if="tab === 0" class="section">
      <view class="section-card">
        <view class="row" v-if="customer.school || customer.class_name">
          <text class="label">学校 / 班级</text>
          <text class="val">{{ [customer.school, customer.class_name].filter(Boolean).join(' · ') || '-' }}</text>
        </view>
        <view class="row">
          <text class="label">来源</text>
          <text class="val">{{ customer.source || '-' }}</text>
        </view>
        <view class="row col" v-if="tagList.length">
          <text class="label">标签</text>
          <view class="val">
            <text v-for="(t, i) in tagList" :key="i" class="tag">{{ t }}</text>
          </view>
        </view>
        <view class="row col" v-if="customer.remark">
          <text class="label">备注</text>
          <text class="val">{{ customer.remark }}</text>
        </view>
        <view class="row" v-if="customer.created_at">
          <text class="label">建档时间</text>
          <text class="val">{{ customer.created_at }}</text>
        </view>
      </view>
      <view class="action-pad">
        <view class="btn-default" @click="goEdit">
          <svg-icon name="edit-3" :size="26" color="#1677FF" />
          <text>编辑客户信息</text>
        </view>
      </view>
    </view>

    <!-- ===== 跟进记录 ===== -->
    <view v-if="tab === 1" class="section">
      <view class="toolbar">
        <text class="toolbar-meta">共 {{ followUps.length }} 条记录</text>
        <view class="add-btn" @click="goNewFollow">
          <svg-icon name="plus" :size="22" color="#ffffff" />
          <text>新建跟进</text>
        </view>
      </view>
      <view v-for="f in followUps" :key="f.id" @click="goFollowDetail(f)">
        <follow-up-card :follow-up="f" />
      </view>
      <empty-state v-if="!followUps.length" text="暂无跟进记录" />
    </view>

    <!-- ===== 档案附件 ===== -->
    <view v-if="tab === 2" class="section">
      <view class="grid">
        <view v-for="a in attachments" :key="a.id" class="grid-item">
          <image :src="a.upload_url || a.url" mode="aspectFill" class="att-img" @click="previewImg(a)" />
          <view class="att-del" @click.stop="removeAttachment(a)">
            <svg-icon name="x" :size="22" color="#ffffff" />
          </view>
        </view>
        <view class="grid-item add-item" @click="onAddAttachment">
          <view class="add-plus">
            <svg-icon name="camera" :size="56" color="#C9CDD4" />
            <text class="add-plus-text">添加附件</text>
          </view>
        </view>
      </view>
      <empty-state v-if="!attachments.length" text="暂无附件，点击右上角空位添加" />
    </view>

    <!-- ===== 跟进提醒 ===== -->
    <view v-if="tab === 3" class="section">
      <view class="section-card">
        <view class="row">
          <text class="label">下次跟进</text>
          <text class="val">{{ customer.next_follow_up_at || '未设置' }}</text>
        </view>
        <view class="row col" v-if="customer.next_follow_up_text">
          <text class="label">提醒备注</text>
          <text class="val">{{ customer.next_follow_up_text }}</text>
        </view>
        <view class="row">
          <text class="label">上次跟进</text>
          <text class="val">{{ customer.last_follow_up_at || '-' }}</text>
        </view>
      </view>
      <view class="action-pad">
        <view class="btn-default" @click="editReminder">
          <svg-icon name="alarm-clock" :size="26" color="#1677FF" />
          <text>编辑提醒时间</text>
        </view>
      </view>
    </view>

    <!-- ===== 孩子档案 ===== -->
    <view v-if="tab === 4" class="section">
      <view v-if="linkedLoading" class="state">加载中...</view>
      <view v-else-if="!linkedChildrenList.length" class="state empty">
        <view class="empty-icon">
          <svg-icon name="clipboard-list" :size="80" color="#C9CDD4" />
        </view>
        <view class="empty-title">未关联到孩子档案</view>
        <view class="empty-hint">该客户手机号 {{ customer.phone || '' }} 在家长档案中没有匹配的孩子记录</view>
      </view>

      <view
        v-for="ch in linkedChildrenList"
        :key="ch.id"
        class="child-profile"
      >
        <view class="cp-head">
          <view class="cp-avatar">{{ String(ch.name || '?').charAt(0) }}</view>
          <view class="cp-name-wrap">
            <view class="cp-name">{{ ch.name }}</view>
            <view class="cp-sub">{{ genderZh(ch.gender) }} · {{ ageText(ch) }}</view>
          </view>
        </view>

        <view class="cp-row" v-if="ch.dob">
          <text class="cp-label">出生日期</text>
          <text class="cp-val">{{ ch.dob }}</text>
        </view>
        <view class="cp-row" v-if="ch.school || ch.grade_name || ch.class_name">
          <text class="cp-label">学校</text>
          <text class="cp-val">{{ [ch.school, ch.grade_name, ch.class_name].filter(Boolean).join(' · ') }}</text>
        </view>
        <view class="cp-row" v-if="ch.parent_phone">
          <text class="cp-label">家长手机</text>
          <text class="cp-val">{{ ch.parent_phone }}</text>
        </view>
        <view class="cp-row" v-if="ch.height != null || ch.weight != null">
          <text class="cp-label">身高 / 体重</text>
          <text class="cp-val">
            {{ ch.height != null ? ch.height + ' cm' : '-' }} / {{ ch.weight != null ? ch.weight + ' kg' : '-' }}
          </text>
        </view>
        <view v-if="(ch.symptoms || []).length" class="cp-row col">
          <text class="cp-label">症状</text>
          <view class="cp-tags">
            <text v-for="(s, i) in ch.symptoms" :key="i" class="cp-tag">{{ s }}</text>
          </view>
        </view>
        <view v-if="ch.symptom_other" class="cp-row col">
          <text class="cp-label">其他症状</text>
          <text class="cp-val">{{ ch.symptom_other }}</text>
        </view>
        <view v-if="ch.additional_note" class="cp-row col">
          <text class="cp-label">备注</text>
          <text class="cp-val">{{ ch.additional_note }}</text>
        </view>

        <view class="cp-link" @click="goChildDetail(ch.id)">
          <svg-icon name="clipboard-list" :size="26" color="#1677FF" />
          <text>查看完整档案 (视力 / 中医 / 诊断)</text>
          <svg-icon name="chevron-right" :size="24" color="#1677FF" />
        </view>
      </view>
    </view>

    <!-- ===== 底部操作栏 ===== -->
    <view class="bottom-bar">
      <view class="bb-btn" @click="goTransfer">
        <svg-icon name="share-2" :size="26" color="#4E5969" />
        <text>转出</text>
      </view>
      <view class="bb-btn primary" @click="goNewFollow">
        <svg-icon name="edit-3" :size="26" color="#ffffff" />
        <text>写跟进</text>
      </view>
    </view>

    <datetime-picker
      v-model:visible="reminderPickerVisible"
      :model-value="customer?.next_follow_up_at || null"
      title="编辑提醒时间"
      :allow-clear="true"
      @confirm="onReminderConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as customerApi from '@/api/customer'
import * as followUpApi from '@/api/followUp'
import { uploadImage, uploadFileBlob } from '@/api/upload'
import { useCustomersStore } from '@/stores/customers'
import SvgIcon from '@/components/svg-icon.vue'

const customersStore = useCustomersStore()

const tabs = ['基本信息', '跟进记录', '档案附件', '跟进提醒', '孩子档案']
const tab = ref(0)

const id = ref<string>('')
const customer = ref<any>(null)
const followUps = ref<any[]>([])
const attachments = ref<any[]>([])
const linkedChildrenList = ref<any[]>([])
const linkedLoading = ref(false)

const avatarChar = computed(() => {
  const n = customer.value?.display_name || ''
  return n ? n.slice(0, 1).toUpperCase() : '客'
})

const statusText = computed(() => {
  const m: Record<string, string> = {
    potential: '潜在', interested: '意向', signed: '成交', lost: '流失'
  }
  return m[customer.value?.status] || customer.value?.status || '-'
})
const genderText = computed(() => {
  const m: Record<string, string> = { male: '男', female: '女', other: '其他' }
  return m[customer.value?.gender] || customer.value?.gender || '-'
})
const tagList = computed(() => {
  const t = customer.value?.tags
  if (!t) return []
  if (Array.isArray(t)) return t
  try {
    const p = JSON.parse(t)
    return Array.isArray(p) ? p : []
  } catch { return [] }
})

async function loadDetail() {
  try {
    customer.value = await customerApi.detail(id.value)
  } catch (e) { /* */ }
}

async function loadFollowUps() {
  try {
    const r = await followUpApi.list({ customer_id: id.value, page: 1, page_size: 50 })
    followUps.value = r?.items || []
  } catch (e) { /* */ }
}

async function loadAttachments() {
  try {
    const r = await customerApi.listAttachments(id.value)
    attachments.value = Array.isArray(r) ? r : []
  } catch (e) { /* */ }
}

function genderZh(g: string) {
  if (g === 'male' || g === '男') return '男'
  if (g === 'female' || g === '女') return '女'
  return g || '未知'
}

function ageText(ch: any) {
  if (ch?.age != null) return `${ch.age} 岁`
  if (ch?.dob) {
    const m = String(ch.dob).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      const now = new Date()
      let years = now.getFullYear() - Number(m[1])
      const md = (now.getMonth() + 1) * 100 + now.getDate()
      const bd = Number(m[2]) * 100 + Number(m[3])
      if (md < bd) years--
      return `${years} 岁`
    }
  }
  return '-'
}

async function loadLinkedChildren() {
  if (!id.value) return
  linkedLoading.value = true
  try {
    const r = await customerApi.linkedChildren(id.value)
    linkedChildrenList.value = Array.isArray(r) ? r : []
  } catch (e) {
    linkedChildrenList.value = []
  } finally {
    linkedLoading.value = false
  }
}

function goChildDetail(childId: number | string) {
  uni.navigateTo({ url: `/pages/child/detail?id=${childId}` })
}

function onCall() {
  if (!customer.value?.phone) return
  // #ifdef H5
  window.location.href = `tel:${customer.value.phone}`
  // #endif
  // #ifndef H5
  uni.makePhoneCall({ phoneNumber: String(customer.value.phone) })
  // #endif
}

function goEdit() {
  uni.navigateTo({ url: `/pages/customer/edit?id=${id.value}` })
}

function goNewFollow() {
  uni.navigateTo({ url: `/pages/follow-up/new?customer_id=${id.value}` })
}

function goFollowDetail(f: any) {
  uni.navigateTo({ url: `/pages/follow-up/detail?id=${f.id}` })
}

function goTransfer() {
  uni.navigateTo({ url: `/pages/transfer/new?customer_id=${id.value}` })
}

function previewImg(a: any) {
  const urls = attachments.value.map((x) => x.upload_url || x.url).filter(Boolean)
  uni.previewImage({ urls, current: a.upload_url || a.url })
}

async function attachUploadResult(up: any) {
  if (!up || !up.id) {
    uni.showToast({ title: '上传响应缺少 id', icon: 'none' })
    return
  }
  await customerApi.addAttachment(id.value, {
    upload_id: up.id,
    file_type: 'image',
    url: up.url,
    name: up.name,
    type: up.type,
    size: up.size
  })
}

function onAddAttachment() {
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.style.display = 'none'
  document.body.appendChild(input)
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || [])
    document.body.removeChild(input)
    if (!files.length) return
    uni.showLoading({ title: '上传中' })
    try {
      for (const f of files) {
        const up = await uploadFileBlob(f, f.name || 'image.jpg')
        await attachUploadResult(up)
      }
      await loadAttachments()
      uni.showToast({ title: '上传成功', icon: 'success' })
    } catch (e) {
      /* */
    } finally {
      uni.hideLoading()
    }
  })
  input.click()
  return
  // #endif
  // #ifndef H5
  uni.chooseImage({
    count: 9,
    success: async (res) => {
      uni.showLoading({ title: '上传中' })
      try {
        for (const fp of res.tempFilePaths) {
          const up = await uploadImage(fp)
          await attachUploadResult(up)
        }
        await loadAttachments()
        uni.showToast({ title: '上传成功', icon: 'success' })
      } catch (e) { /* */ } finally {
        uni.hideLoading()
      }
    }
  })
  // #endif
}

function removeAttachment(a: any) {
  uni.showModal({
    title: '删除附件',
    content: '确定删除该附件？',
    success: async (r) => {
      if (r.confirm) {
        try {
          await customerApi.deleteAttachment(id.value, a.id)
          await loadAttachments()
        } catch (e) { /* */ }
      }
    }
  })
}

const reminderPickerVisible = ref(false)

function editReminder() {
  reminderPickerVisible.value = true
}

async function onReminderConfirm(v: string | null) {
  try {
    const ret = await customersStore.setReminder(id.value, { remind_at: v })
    if (ret.status === 'ok') {
      await loadDetail()
      uni.showToast({ title: v ? '已保存' : '已清除', icon: 'success' })
    }
  } catch (e) { /* */ }
}

onLoad((q: any) => {
  id.value = String(q?.id || '')
})

onShow(() => {
  if (!id.value) return
  loadDetail()
  loadFollowUps()
  loadAttachments()
  loadLinkedChildren()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

/* ===== Hero ===== */
.hero-card {
  background: linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #5B9CFF 100%);
  padding: 48rpx 32rpx 56rpx;
  border-radius: 0 0 32rpx 32rpx;
  color: #ffffff;
  margin-bottom: -28rpx;
}
.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}
.hero-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.22);
  border: 3rpx solid rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}
.hero-info { flex: 1; min-width: 0; }
.hero-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.hero-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
}
.hero-status {
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}
.hero-status.st-potential { background: rgba(255,255,255,0.22); }
.hero-status.st-interested { background: rgba(250, 140, 22, 0.85); }
.hero-status.st-signed { background: rgba(0, 180, 42, 0.9); }
.hero-status.st-lost { background: rgba(245, 63, 63, 0.85); }

.hero-tags-line {
  margin-top: 12rpx;
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
  align-items: center;
}
.hero-level {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 12rpx;
  background: rgba(255,255,255,0.25);
  color: #ffffff;
  font-weight: 600;
}
.hero-level.lv-A { background: rgba(245, 63, 63, 0.95); }
.hero-level.lv-B { background: rgba(250, 140, 22, 0.95); }
.hero-level.lv-C { background: rgba(255, 255, 255, 0.25); }
.hero-meta {
  font-size: 22rpx;
  opacity: 0.85;
}

.hero-phone-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16rpx;
  padding: 8rpx 12rpx 8rpx 16rpx;
}
.hero-phone {
  flex: 1;
  font-size: 26rpx;
  color: #ffffff;
}
.hero-call {
  display: flex;
  align-items: center;
  gap: 4rpx;
  background: rgba(255,255,255,0.95);
  color: #1677FF;
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  font-weight: 600;
  &:active { opacity: 0.85; }
  text { color: #1677FF; }
}

/* ===== Tabs ===== */
.tabs-wrap {
  position: relative;
  z-index: 1;
  padding: 0 24rpx;
}
.tabs {
  display: flex;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.06);
  overflow-x: auto;
  white-space: nowrap;
  &::-webkit-scrollbar { display: none; }
}
.tab {
  flex-shrink: 0;
  padding: 16rpx 24rpx;
  font-size: 26rpx;
  color: #4E5969;
  border-radius: 16rpx;
  transition: all 0.15s;
  &.active {
    background: linear-gradient(135deg, #1677FF, #4096FF);
    color: #ffffff;
    font-weight: 600;
  }
}

/* ===== Sections ===== */
.section {
  padding: 24rpx;
}
.section-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.row {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
  &.col { flex-direction: column; }
}
.label {
  width: 180rpx;
  color: #86909C;
  flex-shrink: 0;
}
.val {
  flex: 1;
  color: #1F2329;
  word-break: break-all;
  text-align: right;
}
.row.col .val { text-align: left; margin-top: 12rpx; }
.tag {
  display: inline-block;
  background: #E8F3FF;
  color: #1677FF;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  margin: 4rpx 8rpx 4rpx 0;
}

.action-pad { padding: 16rpx 0 0; }
.btn-default {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: #ffffff;
  color: #1677FF;
  text-align: center;
  padding: 24rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
  &:active { opacity: 0.85; }
}

/* toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8rpx 16rpx;
}
.toolbar-meta { font-size: 24rpx; color: #86909C; }
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  padding: 10rpx 20rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(22, 119, 255, 0.3);
  &:active { opacity: 0.85; }
}

/* attachments */
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
  border-radius: 20rpx;
  overflow: hidden;
}
.att-img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}
.att-del {
  position: absolute;
  top: 8rpx; right: 8rpx;
  width: 40rpx; height: 40rpx;
  background: rgba(0,0,0,0.55);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.add-item { background: #ffffff; border: 2rpx dashed #E5E6EB; }
.add-plus {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
}
.add-plus-text { font-size: 22rpx; color: #C9CDD4; }

/* state / empty */
.state {
  text-align: center;
  padding: 80rpx 32rpx;
  color: #86909C;
  font-size: 26rpx;
}
.empty .empty-icon { display: flex; justify-content: center; margin-bottom: 16rpx; }
.empty-title { font-size: 28rpx; color: #1F2329; font-weight: 600; }
.empty-hint { margin-top: 8rpx; font-size: 24rpx; color: #86909C; }

/* child profile */
.child-profile {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.cp-head {
  display: flex;
  align-items: center;
  padding-bottom: 20rpx;
  margin-bottom: 8rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.cp-avatar {
  width: 88rpx; height: 88rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.cp-name-wrap { flex: 1; min-width: 0; }
.cp-name { font-size: 32rpx; font-weight: 700; color: #1F2329; }
.cp-sub { margin-top: 6rpx; font-size: 24rpx; color: #86909C; }
.cp-row {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 26rpx;
  &:last-child { border-bottom: none; }
  &.col { flex-direction: column; }
}
.cp-label { width: 200rpx; flex-shrink: 0; color: #86909C; }
.cp-val { flex: 1; color: #1F2329; word-break: break-all; text-align: right; }
.cp-row.col .cp-val { text-align: left; margin-top: 12rpx; }
.cp-tags { margin-top: 12rpx; display: flex; flex-wrap: wrap; gap: 12rpx; }
.cp-tag {
  padding: 6rpx 16rpx;
  background: #E8F3FF;
  color: #1677FF;
  border-radius: 14rpx;
  font-size: 22rpx;
}
.cp-link {
  margin-top: 16rpx;
  padding: 20rpx;
  background: linear-gradient(135deg, #F0F9FF, #FFFFFF);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #1677FF;
  font-size: 26rpx;
  font-weight: 500;
  border: 1rpx solid #E8F3FF;
  &:active { opacity: 0.85; }
}
.cp-link text { flex: 1; color: #1677FF; }

/* bottom bar */
.bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: #ffffff;
  padding: 16rpx 24rpx 32rpx;
  box-shadow: 0 -4rpx 16rpx rgba(20, 30, 60, 0.05);
  gap: 16rpx;
  z-index: 10;
}
.bb-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-weight: 500;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
  &.primary {
    background: linear-gradient(135deg, #1677FF, #4096FF);
    color: #ffffff;
    box-shadow: 0 4rpx 16rpx rgba(22, 119, 255, 0.35);
  }
  &.primary text { color: #ffffff; }
}
</style>
