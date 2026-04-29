<template>
  <view class="page" v-if="customer">
    <!-- Tab 切换 -->
    <view class="tabs">
      <view
        v-for="(t, i) in tabs"
        :key="i"
        class="tab"
        :class="{ active: tab === i }"
        @click="tab = i"
      >{{ t }}</view>
    </view>

    <!-- 基本信息 -->
    <view v-if="tab === 0" class="card">
      <view class="row">
        <text class="label">姓名</text>
        <text class="val">{{ customer.display_name || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">手机号</text>
        <view class="val flex-row">
          <text>{{ customer.phone || '-' }}</text>
          <text v-if="customer.phone" class="call-btn" @click="onCall">呼叫</text>
        </view>
      </view>
      <view class="row">
        <text class="label">状态</text>
        <text class="val badge" :class="'st-' + customer.status">{{ statusText }}</text>
      </view>
      <view class="row">
        <text class="label">等级</text>
        <text class="val">{{ customer.level || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">性别</text>
        <text class="val">{{ genderText }}</text>
      </view>
      <view class="row">
        <text class="label">年龄</text>
        <text class="val">{{ customer.age || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">学校</text>
        <text class="val">{{ customer.school || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">班级</text>
        <text class="val">{{ customer.class_name || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">来源</text>
        <text class="val">{{ customer.source || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">标签</text>
        <view class="val">
          <text v-for="(t, i) in tagList" :key="i" class="tag">{{ t }}</text>
          <text v-if="!tagList.length">-</text>
        </view>
      </view>
      <view class="row">
        <text class="label">备注</text>
        <text class="val">{{ customer.remark || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">客户编号</text>
        <text class="val">{{ customer.customer_no || '-' }}</text>
      </view>
      <view class="actions">
        <view class="btn-default" @click="goEdit">编辑信息</view>
      </view>
    </view>

    <!-- 跟进记录 -->
    <view v-if="tab === 1">
      <view class="toolbar">
        <text>共 {{ followUps.length }} 条</text>
        <view class="add-btn" @click="goNewFollow">
          <svg-icon name="plus" :size="24" color="#ffffff" />
          <text>新建跟进</text>
        </view>
      </view>
      <view v-for="f in followUps" :key="f.id" @click="goFollowDetail(f)">
        <follow-up-card :follow-up="f" />
      </view>
      <empty-state v-if="!followUps.length" text="暂无跟进记录" />
    </view>

    <!-- 档案附件 -->
    <view v-if="tab === 2">
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
          </view>
        </view>
      </view>
      <empty-state v-if="!attachments.length" text="暂无附件" />
    </view>

    <!-- 孩子档案（基础字段直接展示）-->
    <view v-if="tab === 4">
      <view v-if="linkedLoading" class="loading">加载中...</view>
      <view v-else-if="!linkedChildrenList.length" class="card empty-state">
        <view class="es-icon">
          <svg-icon name="clipboard-list" :size="64" color="#C9CDD4" />
        </view>
        <view class="es-text">未关联到孩子档案</view>
        <view class="es-hint">该客户手机号 {{ customer.phone || '' }} 在家长档案中没有匹配的孩子记录</view>
      </view>

      <view
        v-for="ch in linkedChildrenList"
        :key="ch.id"
        class="card child-profile"
      >
        <!-- 头部 -->
        <view class="cp-head">
          <view class="cp-avatar">{{ String(ch.name || '?').charAt(0) }}</view>
          <view class="cp-name-wrap">
            <view class="cp-name">{{ ch.name }}</view>
            <view class="cp-sub">{{ genderZh(ch.gender) }} · {{ ageText(ch) }}</view>
          </view>
        </view>

        <!-- 基础字段 -->
        <view class="cp-row">
          <text class="cp-label">出生日期</text>
          <text class="cp-val">{{ ch.dob || '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">学校</text>
          <text class="cp-val">{{ ch.school || '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">年级</text>
          <text class="cp-val">{{ ch.grade_name || '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">班级</text>
          <text class="cp-val">{{ ch.class_name || '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">家长手机</text>
          <text class="cp-val">{{ ch.parent_phone || '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">身高 (cm)</text>
          <text class="cp-val">{{ ch.height != null ? ch.height : '-' }}</text>
        </view>
        <view class="cp-row">
          <text class="cp-label">体重 (kg)</text>
          <text class="cp-val">{{ ch.weight != null ? ch.weight : '-' }}</text>
        </view>
        <view v-if="(ch.symptoms || []).length" class="cp-row col">
          <text class="cp-label">症状</text>
          <view class="cp-tags">
            <text
              v-for="(s, i) in ch.symptoms"
              :key="i"
              class="cp-tag"
            >{{ s }}</text>
          </view>
        </view>
        <view v-if="ch.symptom_other" class="cp-row">
          <text class="cp-label">其他症状</text>
          <text class="cp-val">{{ ch.symptom_other }}</text>
        </view>
        <view v-if="ch.additional_note" class="cp-row col">
          <text class="cp-label">备注</text>
          <text class="cp-val">{{ ch.additional_note }}</text>
        </view>

        <view class="cp-actions">
          <view class="cp-btn-default" @click="goChildDetail(ch.id)">
            <text>前往完整档案（视力 / 中医 / 诊断）</text>
            <svg-icon name="chevron-right" :size="24" color="#1677FF" />
          </view>
        </view>
      </view>
    </view>

    <!-- 跟进提醒 -->
    <view v-if="tab === 3" class="card">
      <view class="row">
        <text class="label">下次跟进</text>
        <text class="val">{{ customer.next_follow_up_at || '未设置' }}</text>
      </view>
      <view class="row">
        <text class="label">提醒备注</text>
        <text class="val">{{ customer.next_follow_up_text || '-' }}</text>
      </view>
      <view class="row">
        <text class="label">上次跟进</text>
        <text class="val">{{ customer.last_follow_up_at || '-' }}</text>
      </view>
      <view class="actions">
        <view class="btn-default" @click="editReminder">编辑提醒</view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar">
      <view class="bb-btn primary" @click="goNewFollow">写跟进</view>
      <view class="bb-btn" @click="goTransfer">转出</view>
    </view>

    <!-- 编辑提醒 datetime picker -->
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
    // 简单按 dob 推算
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
  // H5：原生 input file + fetch 上传，避免 uni.chooseImage / uploadFile 异步包裹
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
      /* fetch / 后端错误已 throw 提示 */
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

// ===== 编辑提醒时间（datetime-picker）=====
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
.page { padding: 16rpx; padding-bottom: 140rpx; }

.tabs {
  display: flex;
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  padding: 8rpx;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: #4E5969;
  border-radius: 12rpx;
  &.active {
    background: #1677FF;
    color: #ffffff;
    font-weight: 600;
  }
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
}
.row {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 28rpx;
  &:last-child { border-bottom: none; }
}
.label {
  width: 160rpx;
  color: #86909C;
  flex-shrink: 0;
}
.val {
  flex: 1;
  color: #1F2329;
  word-break: break-all;
}
.flex-row { display: flex; align-items: center; gap: 16rpx; }
.call-btn {
  background: #1677FF;
  color: #ffffff;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.badge {
  display: inline-block;
  padding: 2rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  background: #F2F3F5;
  &.st-potential { background: #E8F3FF; color: #1677FF; }
  &.st-interested { background: #FDF6EC; color: #E6A23C; }
  &.st-signed { background: #F0F9EB; color: #67C23A; }
  &.st-lost { background: #FEEFEF; color: #F56C6C; }
}
.tag {
  display: inline-block;
  background: #F2F3F5;
  color: #4E5969;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  margin: 4rpx 8rpx 4rpx 0;
}

.actions {
  padding: 24rpx 0 16rpx;
}
.btn-default {
  background: #F2F3F5;
  color: #1F2329;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 8rpx;
  font-size: 24rpx;
  color: #86909C;
}
.add-btn {
  background: #1677FF;
  color: #ffffff;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  &:active { opacity: 0.85; }
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 8rpx;
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
.att-del {
  position: absolute;
  top: 4rpx; right: 4rpx;
  width: 36rpx; height: 36rpx;
  background: rgba(0,0,0,0.5);
  color: #ffffff;
  text-align: center;
  line-height: 36rpx;
  border-radius: 50%;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-item { background: #F2F3F5; &:active { opacity: 0.85; } }
.add-plus {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64rpx;
  color: #C9CDD4;
  line-height: 1;
}

.bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: #ffffff;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #F2F3F5;
  gap: 16rpx;
  z-index: 10;
}
.bb-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  background: #F2F3F5;
  color: #1F2329;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
  &.primary {
    background: #1677FF;
    color: #ffffff;
  }
}

/* 孩子档案基础字段卡片 */
.child-profile {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.cp-head {
  display: flex;
  align-items: center;
  padding-bottom: 16rpx;
  margin-bottom: 8rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.cp-avatar {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: #1677FF; color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 600;
  margin-right: 20rpx; flex-shrink: 0;
}
.cp-name-wrap { flex: 1; min-width: 0; }
.cp-name { font-size: 32rpx; font-weight: 600; color: #1F2329; }
.cp-sub { margin-top: 6rpx; font-size: 24rpx; color: #86909C; }

.cp-row {
  display: flex;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  font-size: 26rpx;
  &:last-child { border-bottom: none; }
  &.col { flex-direction: column; align-items: flex-start; }
}
.cp-label {
  width: 180rpx;
  flex-shrink: 0;
  color: #86909C;
}
.cp-val {
  flex: 1;
  color: #1F2329;
  word-break: break-all;
}
.cp-tags {
  margin-top: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.cp-tag {
  padding: 6rpx 16rpx;
  background: #E8F3FF;
  color: #1677FF;
  border-radius: 16rpx;
  font-size: 22rpx;
}
.cp-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed #F2F3F5;
}
.cp-btn-default {
  background: #F0F9FF;
  color: #1677FF;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  &:active { opacity: 0.85; }
}

.empty-state {
  text-align: center;
  padding: 64rpx 24rpx;
}
.empty-state .es-icon {
  font-size: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
}
.empty-state .es-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #1F2329;
  font-weight: 600;
}
.empty-state .es-hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #86909C;
}
.loading {
  text-align: center;
  padding: 40rpx 0;
  color: #86909C;
  font-size: 24rpx;
}
</style>
