<template>
  <view class="home-page">
    <!-- ===== Hero ===== -->
    <view class="hero">
      <view class="hero-bg-deco" />
      <view class="hero-content">
        <view class="hero-row">
          <view class="hero-left">
            <view class="hero-greet">{{ greeting }}</view>
            <view class="hero-name">{{ auth.employee?.display_name || '员工' }}</view>
            <view class="hero-meta">
              <text class="hero-role-pill">{{ roleLabel || '员工' }}</text>
              <text class="hero-date">{{ todayLabel }}</text>
            </view>
          </view>
          <sync-indicator />
        </view>
      </view>
    </view>

    <!-- ===== 数据概览 ===== -->
    <view class="data-grid">
      <view class="data-card">
        <view class="data-icon di-blue">
          <svg-icon name="users" :size="36" color="#1677FF" />
        </view>
        <view class="data-text">
          <view class="data-label">客户总数</view>
          <view class="data-value">{{ dash.customers_total }}</view>
        </view>
      </view>
      <view class="data-card">
        <view class="data-icon di-green">
          <svg-icon name="trending-up" :size="36" color="#00B42A" />
        </view>
        <view class="data-text">
          <view class="data-label">本月新增</view>
          <view class="data-value">{{ dash.customers_new_this_month }}</view>
        </view>
      </view>
      <view class="data-card">
        <view class="data-icon di-orange">
          <svg-icon name="clipboard-check" :size="36" color="#FA8C16" />
        </view>
        <view class="data-text">
          <view class="data-label">本月跟进</view>
          <view class="data-value">{{ dash.follow_ups_this_month }}</view>
        </view>
      </view>
      <view class="data-card" :class="{ 'is-warn': dash.customers_pending_follow_up > 0 }">
        <view class="data-icon di-red">
          <svg-icon name="alarm-clock" :size="36" color="#F53F3F" />
        </view>
        <view class="data-text">
          <view class="data-label">待跟进</view>
          <view class="data-value">{{ dash.customers_pending_follow_up }}</view>
        </view>
      </view>
    </view>

    <!-- ===== 快捷入口 ===== -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">快捷入口</text>
        <text v-if="!editMode" class="section-action" @click="enterEdit">长按调整</text>
        <text v-else class="section-action active" @click="exitEdit">完成</text>
      </view>
      <view class="quick-grid card">
        <view
          v-for="(item, idx) in orderedQuickItems"
          :key="item.key"
          class="quick-item"
          :class="{ wobble: editMode }"
          @click="onQuickTap(item, idx)"
          @longpress="enterEdit"
        >
          <view class="quick-icon" :class="`qi-${item.color || 'blue'}`">
            <svg-icon :name="item.icon" :size="40" :color="quickIconColor(item.color)" />
            <text v-if="item.badgeKey && (dash as any)[item.badgeKey]" class="quick-badge">
              {{ (dash as any)[item.badgeKey] > 99 ? '99+' : (dash as any)[item.badgeKey] }}
            </text>
          </view>
          <view class="quick-text">{{ item.text }}</view>
          <view v-if="editMode" class="quick-edit-overlay">
            <view class="qe-btn" :class="{ disabled: idx === 0 }" @click.stop="moveLeft(idx)">
              <svg-icon name="chevron-right" :size="24" color="#ffffff" style="transform: rotate(180deg);" />
            </view>
            <view class="qe-btn" :class="{ disabled: idx === orderedQuickItems.length - 1 }" @click.stop="moveRight(idx)">
              <svg-icon name="chevron-right" :size="24" color="#ffffff" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== 主管：待审批 ===== -->
    <view v-if="auth.isManager" class="section">
      <view class="mgr-card" @click="go('/pages/transfer/pending')">
        <view class="mgr-icon">
          <svg-icon name="clipboard-list" :size="40" color="#FA8C16" />
        </view>
        <view class="mgr-text">
          <view class="mgr-title">待审批转出</view>
          <view class="mgr-sub">部门内待你处理的转移申请</view>
        </view>
        <svg-icon name="chevron-right" :size="28" color="#FA8C16" />
      </view>
    </view>

    <!-- ===== 公告 ===== -->
    <view v-if="announcements.length" class="section">
      <view class="section-head">
        <text class="section-title">公告通知</text>
      </view>
      <view class="card">
        <view class="ann-item" v-for="(a, i) in announcements" :key="a.id">
          <view class="ann-row">
            <view class="ann-tag" v-if="a.is_top">置顶</view>
            <text class="ann-title">{{ a.title }}</text>
          </view>
          <view v-if="i < announcements.length - 1" class="ann-divider" />
        </view>
      </view>
    </view>

    <floating-tabbar active="/pages/home/index" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { getDashboard, getAnnouncements } from '@/api/employee'
import SyncIndicator from '@/components/sync-indicator.vue'
import SvgIcon from '@/components/svg-icon.vue'

const auth = useAuthStore()

interface QuickItem {
  key: string
  icon: string
  text: string
  url: string
  badgeKey?: string
  color?: 'blue' | 'orange' | 'purple' | 'green' | 'red'
}
const QUICK_ITEMS: QuickItem[] = [
  { key: 'new_customer', icon: 'plus', text: '新增客户', url: '/pages/customer/new', color: 'blue' },
  {
    key: 'follow_up_tasks',
    icon: 'alarm-clock',
    text: '跟进任务',
    url: '/pages/customer/list?filter=needs_follow_up',
    badgeKey: 'customers_pending_follow_up',
    color: 'red'
  },
  { key: 'todo', icon: 'inbox', text: '待办', url: '/pages/notification/list?type=todo', color: 'orange' },
  { key: 'search', icon: 'search', text: '客户搜索', url: '/pages/customer/search', color: 'purple' },
  { key: 'child_profile', icon: 'clipboard-list', text: '孩子档案', url: '/pages/child/list', color: 'green' }
]
const QUICK_ORDER_KEY = 'home_quick_order_v1'

const editMode = ref(false)
const quickOrder = ref<string[]>(loadQuickOrder())

function loadQuickOrder(): string[] {
  try {
    const raw = uni.getStorageSync(QUICK_ORDER_KEY) as string | undefined
    if (!raw) return QUICK_ITEMS.map((i) => i.key)
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return QUICK_ITEMS.map((i) => i.key)
    const valid = parsed.filter((k) => QUICK_ITEMS.some((i) => i.key === k))
    QUICK_ITEMS.forEach((i) => { if (!valid.includes(i.key)) valid.push(i.key) })
    return valid
  } catch {
    return QUICK_ITEMS.map((i) => i.key)
  }
}

function saveQuickOrder() {
  try {
    uni.setStorageSync(QUICK_ORDER_KEY, JSON.stringify(quickOrder.value))
  } catch {}
}

const orderedQuickItems = computed<QuickItem[]>(() => {
  const map = new Map(QUICK_ITEMS.map((i) => [i.key, i]))
  return quickOrder.value
    .map((k) => map.get(k))
    .filter((x): x is QuickItem => !!x)
})

function quickIconColor(c?: string) {
  return ({
    blue: '#1677FF',
    orange: '#FA8C16',
    purple: '#722ED1',
    green: '#00B42A',
    red: '#F53F3F'
  } as any)[c || 'blue']
}

function enterEdit() { if (!editMode.value) editMode.value = true }
function exitEdit() { editMode.value = false; saveQuickOrder() }

function moveLeft(idx: number) {
  if (idx <= 0) return
  const arr = [...quickOrder.value]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  quickOrder.value = arr
  saveQuickOrder()
}
function moveRight(idx: number) {
  if (idx >= quickOrder.value.length - 1) return
  const arr = [...quickOrder.value]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  quickOrder.value = arr
  saveQuickOrder()
}

function onQuickTap(item: QuickItem, _idx: number) {
  if (editMode.value) return
  go(item.url)
}

const dash = ref({
  customers_total: 0,
  customers_new_this_month: 0,
  follow_ups_this_month: 0,
  customers_pending_follow_up: 0
})
const announcements = ref<Array<any>>([])

const roleLabel = computed(() => {
  if (auth.employee?.role === 'manager') return '部门主管'
  if (auth.employee?.role === 'staff') return '员工'
  return ''
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const todayLabel = computed(() => {
  const d = new Date()
  const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${wk}`
})

async function load() {
  try {
    const [d, a] = await Promise.all([getDashboard(), getAnnouncements()])
    dash.value = d
    announcements.value = Array.isArray(a) ? a.slice(0, 5) : []
  } catch (e) {
    // http 拦截器已 toast
  }
}

const TAB_BAR_PAGES = [
  '/pages/home/index',
  '/pages/customer/list',
  '/pages/follow-up/list',
  '/pages/notification/list',
  '/pages/me/index'
]

function go(url: string) {
  const qIdx = url.indexOf('?')
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url
  const query = qIdx >= 0 ? url.slice(qIdx + 1) : ''

  if (TAB_BAR_PAGES.includes(path)) {
    if (query) {
      uni.setStorageSync('quick_entry_query__' + path, query)
    } else {
      uni.removeStorageSync('quick_entry_query__' + path)
    }
    uni.reLaunch({ url: path })
    return
  }
  uni.navigateTo({ url })
}

onShow(() => { if (auth.token) load() })
onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #F5F7FA;
  padding-bottom: 200rpx;
}

/* ===== Hero ===== */
.hero {
  position: relative;
  background: linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #5B9CFF 100%);
  padding: 80rpx 32rpx 60rpx;
  border-radius: 0 0 32rpx 32rpx;
  overflow: hidden;
}
.hero-bg-deco {
  position: absolute;
  top: -120rpx;
  right: -120rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.hero-bg-deco::after {
  content: '';
  position: absolute;
  top: 60rpx;
  left: -180rpx;
  width: 240rpx;
  height: 240rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}
.hero-content { position: relative; z-index: 1; }
.hero-row { display: flex; justify-content: space-between; align-items: flex-start; }
.hero-left { flex: 1; min-width: 0; color: #ffffff; }
.hero-greet { font-size: 26rpx; opacity: 0.85; }
.hero-name { font-size: 44rpx; font-weight: 700; margin-top: 8rpx; letter-spacing: 1rpx; }
.hero-meta { margin-top: 16rpx; display: flex; align-items: center; gap: 16rpx; }
.hero-role-pill {
  background: rgba(255, 255, 255, 0.22);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #ffffff;
}
.hero-date { font-size: 24rpx; opacity: 0.85; color: #ffffff; }

/* ===== 数据概览 ===== */
.data-grid {
  margin: -32rpx 24rpx 16rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  position: relative;
  z-index: 2;
}
.data-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.06);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.data-card.is-warn {
  background: linear-gradient(135deg, #FFF7F7 0%, #FFFFFF 100%);
}
.data-icon {
  width: 72rpx; height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.di-blue { background: #E8F3FF; }
.di-green { background: #E6F7ED; }
.di-orange { background: #FFF4E6; }
.di-red { background: #FFECEB; }
.data-text { flex: 1; min-width: 0; }
.data-label { font-size: 24rpx; color: #86909C; }
.data-value { font-size: 40rpx; font-weight: 700; color: #1F2329; margin-top: 4rpx; line-height: 1.1; }

/* ===== 通用 section ===== */
.section { margin: 24rpx 24rpx 0; }
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx 16rpx;
}
.section-title { font-size: 28rpx; font-weight: 600; color: #1F2329; }
.section-action {
  font-size: 24rpx;
  color: #1677FF;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.section-action.active {
  color: #ffffff;
  background: #1677FF;
}

.card {
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}

/* ===== 快捷入口 ===== */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  padding: 24rpx 16rpx;
}
.quick-item {
  position: relative;
  text-align: center;
  padding: 12rpx 0;
  border-radius: 16rpx;
  transition: transform 0.15s ease, background 0.15s ease;
  &:active { transform: scale(0.94); background: #F2F3F5; }
}
.quick-item.wobble { animation: wobble 0.6s ease-in-out infinite alternate; }
@keyframes wobble {
  from { transform: rotate(-1.5deg); }
  to { transform: rotate(1.5deg); }
}
.quick-icon {
  position: relative;
  width: 88rpx; height: 88rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.qi-blue { background: #E8F3FF; }
.qi-orange { background: #FFF4E6; }
.qi-purple { background: #F4ECFF; }
.qi-green { background: #E6F7ED; }
.qi-red { background: #FFECEB; }
.quick-badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: #F53F3F;
  color: #ffffff;
  font-size: 20rpx;
  line-height: 32rpx;
  text-align: center;
  box-shadow: 0 0 0 3rpx #ffffff;
}
.quick-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #4E5969;
}
.quick-edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 16rpx;
}
.qe-btn {
  width: 44rpx; height: 44rpx;
  border-radius: 50%;
  background: #1677FF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
}
.qe-btn.disabled { background: #C9CDD4; }

/* ===== 主管卡片 ===== */
.mgr-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: linear-gradient(135deg, #FFF4E6 0%, #FFFCF5 100%);
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(250, 140, 22, 0.08);
  transition: transform 0.15s;
  &:active { transform: scale(0.99); }
}
.mgr-icon {
  width: 80rpx; height: 80rpx;
  border-radius: 20rpx;
  background: rgba(250, 140, 22, 0.15);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mgr-text { flex: 1; min-width: 0; }
.mgr-title { font-size: 30rpx; font-weight: 600; color: #1F2329; }
.mgr-sub { font-size: 24rpx; color: #86909C; margin-top: 4rpx; }

/* ===== 公告 ===== */
.ann-item { padding: 0 24rpx; }
.ann-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 0;
}
.ann-tag {
  font-size: 20rpx;
  color: #ffffff;
  background: #F53F3F;
  border-radius: 8rpx;
  padding: 2rpx 10rpx;
  flex-shrink: 0;
}
.ann-title {
  flex: 1;
  font-size: 28rpx;
  color: #1F2329;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ann-divider {
  height: 1rpx;
  background: #F2F3F5;
  margin: 0 -24rpx;
}
</style>
