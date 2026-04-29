<template>
  <view class="home-page">
    <view class="hero card">
      <view class="hero-row">
        <view class="hero-left">
          <view class="hello">你好，{{ auth.employee?.display_name || '员工' }}</view>
          <view class="role">{{ roleLabel }}</view>
        </view>
        <sync-indicator />
      </view>
    </view>
    <view class="quick-bar">
      <text class="quick-bar-title">快捷入口</text>
      <text v-if="!editMode" class="quick-bar-action" @click="enterEdit">长按调整</text>
      <text v-else class="quick-bar-action active" @click="exitEdit">完成</text>
    </view>
    <view class="quick-grid">
      <view
        v-for="(item, idx) in orderedQuickItems"
        :key="item.key"
        class="quick-item card"
        :class="{ wobble: editMode }"
        @click="onQuickTap(item, idx)"
        @longpress="enterEdit"
      >
        <view class="quick-icon">
          <svg-icon :name="item.icon" :size="48" color="#1677FF" />
        </view>
        <view class="quick-text">
          {{ item.text }}
          <text v-if="item.badgeKey && (dash as any)[item.badgeKey]" class="badge">
            {{ (dash as any)[item.badgeKey] }}
          </text>
        </view>
        <view v-if="editMode" class="quick-edit-overlay">
          <view
            class="qe-btn"
            :class="{ disabled: idx === 0 }"
            @click.stop="moveLeft(idx)"
          >
            <svg-icon name="chevron-right" :size="28" color="#ffffff" style="transform: rotate(180deg);" />
          </view>
          <view
            class="qe-btn"
            :class="{ disabled: idx === orderedQuickItems.length - 1 }"
            @click.stop="moveRight(idx)"
          >
            <svg-icon name="chevron-right" :size="28" color="#ffffff" />
          </view>
        </view>
      </view>
    </view>

    <view class="data-grid">
      <view class="data-card card">
        <view class="data-label">客户总数</view>
        <view class="data-value">{{ dash.customers_total }}</view>
      </view>
      <view class="data-card card">
        <view class="data-label">本月新增</view>
        <view class="data-value">{{ dash.customers_new_this_month }}</view>
      </view>
      <view class="data-card card">
        <view class="data-label">本月跟进</view>
        <view class="data-value">{{ dash.follow_ups_this_month }}</view>
      </view>
      <view class="data-card card">
        <view class="data-label">待跟进</view>
        <view class="data-value">{{ dash.customers_pending_follow_up }}</view>
      </view>
    </view>

    <view v-if="auth.isManager" class="card mgr-card" @click="go('/pages/transfer/pending')">
      <view class="flex-between mgr-row">
        <text>待审批转出</text>
        <view class="mgr-go">
          <text class="text-primary">查看</text>
          <svg-icon name="chevron-right" :size="24" color="#1677FF" />
        </view>
      </view>
    </view>

    <view class="card" v-if="announcements.length">
      <view class="card-title">公告通知</view>
      <view class="ann-item" v-for="a in announcements" :key="a.id">
        <text class="dot" v-if="a.is_top"></text>
        <text class="ann-title">{{ a.title }}</text>
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

// 快捷入口配置：稳定 key，本地排序持久化只存 key 顺序，便于改图标/文字不影响用户排序
interface QuickItem {
  key: string
  icon: string
  text: string
  url: string
  badgeKey?: string
}
const QUICK_ITEMS: QuickItem[] = [
  { key: 'new_customer', icon: 'plus', text: '新增客户', url: '/pages/customer/new' },
  {
    key: 'follow_up_tasks',
    icon: 'alarm-clock',
    text: '跟进任务',
    url: '/pages/customer/list?filter=needs_follow_up',
    badgeKey: 'customers_pending_follow_up'
  },
  { key: 'todo', icon: 'inbox', text: '待办', url: '/pages/notification/list?type=todo' },
  { key: 'search', icon: 'search', text: '客户搜索', url: '/pages/customer/search' },
  { key: 'child_profile', icon: 'clipboard-list', text: '孩子档案', url: '/pages/child/list' }
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
    // 把缺失的 key 追加到末尾、丢弃不认识的 key
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

function enterEdit() {
  if (editMode.value) return
  editMode.value = true
}

function exitEdit() {
  editMode.value = false
  saveQuickOrder()
}

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

async function load() {
  try {
    const [d, a] = await Promise.all([getDashboard(), getAnnouncements()])
    dash.value = d
    announcements.value = Array.isArray(a) ? a.slice(0, 5) : []
  } catch (e) {
    // http 拦截器已 toast
  }
}

// 浮动 tabBar 模式下：5 个 tab 路径用 reLaunch 跳转（清栈，模拟 tabBar 单页切换）
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
    // 浮动 tabBar：reLaunch 清栈跳转，query 通过 storage 传给目标页 onShow 读取
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

onShow(() => {
  if (auth.token) load()
})

onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.home-page { padding: 24rpx; padding-bottom: 180rpx; }
.hero {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  color: #ffffff;
}
.hero-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.hero-left { flex: 1; min-width: 0; }
.hello { font-size: 36rpx; font-weight: 600; }
.role { margin-top: 8rpx; opacity: 0.85; font-size: 24rpx; }

.quick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx 12rpx;
}
.quick-bar-title {
  font-size: 24rpx;
  color: #86909C;
}
.quick-bar-action {
  font-size: 24rpx;
  color: #1677FF;
  padding: 4rpx 12rpx;
}
.quick-bar-action.active {
  color: #ffffff;
  background: #1677FF;
  border-radius: 16rpx;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.quick-item {
  position: relative;
  text-align: center;
  padding: 32rpx 0;
  margin-bottom: 0;
  background: #FFFFFF;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.98); }
}
.quick-item.wobble {
  animation: wobble 0.6s ease-in-out infinite alternate;
}
@keyframes wobble {
  from { transform: rotate(-1.2deg); }
  to { transform: rotate(1.2deg); }
}
.quick-edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 16rpx;
}
.qe-btn {
  width: 48rpx; height: 48rpx;
  border-radius: 50%;
  background: #1677FF;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 600;
  line-height: 44rpx;
  text-align: center;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  &:active { opacity: 0.85; }
}
.qe-btn.disabled {
  background: #C9CDD4;
}
.quick-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
}
.quick-text {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #4E5969;
  position: relative;
}
.badge {
  position: absolute;
  top: -8rpx;
  margin-left: 8rpx;
  background: #FF4D4F;
  color: #ffffff;
  font-size: 20rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  line-height: 28rpx;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.data-card { margin-bottom: 0; }
.data-label { font-size: 24rpx; color: #86909C; }
.data-value { font-size: 48rpx; font-weight: 600; color: #1F2329; margin-top: 8rpx; }

.mgr-card {
  background: #FFF4E6;
  &:active { opacity: 0.85; }
}
.mgr-row { display: flex; align-items: center; justify-content: space-between; }
.mgr-go { display: flex; align-items: center; gap: 4rpx; }

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.ann-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  &:last-child { border-bottom: none; }
}
.dot { display: inline-block; width: 12rpx; height: 12rpx; border-radius: 6rpx; background: #FF4D4F; margin-right: 12rpx; vertical-align: middle; }
.ann-title { font-size: 28rpx; }
</style>
