<template>
  <view class="page">
    <!-- range 切换 -->
    <view class="seg-card">
      <view class="seg-bg">
        <view
          v-for="opt in ranges"
          :key="opt.value"
          class="seg-item"
          :class="{ active: range === opt.value }"
          @click="onChangeRange(opt.value)"
        >{{ opt.label }}</view>
      </view>
    </view>

    <!-- KPI 卡 -->
    <view class="kpi-grid">
      <view class="kpi kpi-blue">
        <view class="kpi-icon">
          <svg-icon name="users" :size="32" color="#1677FF" />
        </view>
        <view class="kpi-label">本期新增客户</view>
        <view class="kpi-value">{{ stats.new_customers || 0 }}</view>
      </view>
      <view class="kpi kpi-orange">
        <view class="kpi-icon">
          <svg-icon name="clipboard-check" :size="32" color="#FA8C16" />
        </view>
        <view class="kpi-label">本期跟进次数</view>
        <view class="kpi-value">{{ stats.follow_ups || 0 }}</view>
      </view>
      <view class="kpi kpi-green">
        <view class="kpi-icon">
          <svg-icon name="check-circle" :size="32" color="#00B42A" />
        </view>
        <view class="kpi-label">本期成交数</view>
        <view class="kpi-value">{{ stats.signed_customers || 0 }}</view>
      </view>
    </view>

    <!-- 趋势图 -->
    <view class="section">
      <view class="section-title">每日跟进趋势</view>
      <view class="trend-card">
        <view v-if="trend.length" class="trend-canvas-wrap">
          <canvas
            canvas-id="trendChart"
            id="trendChart"
            class="trend-canvas"
          ></canvas>
        </view>
        <empty-state v-else text="暂无趋势数据" icon="trending-up" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStats } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'
import SvgIcon from '@/components/svg-icon.vue'

type RangeKey = 'week' | 'month' | 'quarter'

const auth = useAuthStore()

const ranges: { label: string; value: RangeKey }[] = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本季度', value: 'quarter' }
]

const range = ref<RangeKey>('month')
const stats = ref<{
  new_customers?: number
  follow_ups?: number
  signed_customers?: number
  trend?: Array<{ date: string; count: number }>
}>({})

const trend = computed(() => stats.value.trend || [])

function shortDate(s: string): string {
  if (!s) return ''
  const m = String(s).match(/(\d{2})-(\d{2})$/)
  return m ? `${m[1]}-${m[2]}` : String(s)
}

function getCanvasSize(): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    // @ts-ignore
    const query = (uni as any).createSelectorQuery
      ? (uni as any).createSelectorQuery().in((globalThis as any).$instance || undefined)
      : null
    if (query) {
      query.select('#trendChart').boundingClientRect((rect: any) => {
        if (rect && rect.width) resolve({ w: Math.floor(rect.width), h: Math.floor(rect.height || 160) })
        else resolve({ w: 320, h: 160 })
      }).exec()
    } else {
      resolve({ w: 320, h: 160 })
    }
  })
}

async function drawTrend() {
  const list = trend.value
  if (!list.length) return
  await nextTick()
  const { w, h } = await getCanvasSize()
  const W = w || 320
  const H = h || 160
  // @ts-ignore
  const ctx: any = (uni as any).createCanvasContext ? (uni as any).createCanvasContext('trendChart') : null
  if (!ctx) return

  const padL = 36, padR = 16, padT = 16, padB = 28
  const innerW = Math.max(10, W - padL - padR)
  const innerH = Math.max(10, H - padT - padB)
  const counts = list.map((d) => Number(d.count) || 0)
  const max = Math.max(1, ...counts)
  const stepX = list.length > 1 ? innerW / (list.length - 1) : 0

  // 坐标轴
  ctx.setStrokeStyle('#E5E6EB')
  ctx.setLineWidth(1)
  ctx.beginPath()
  ctx.moveTo(padL, padT)
  ctx.lineTo(padL, padT + innerH)
  ctx.lineTo(padL + innerW, padT + innerH)
  ctx.stroke()

  // 网格 + 纵轴刻度
  ctx.setFillStyle('#86909C')
  ctx.setFontSize(10)
  ctx.setStrokeStyle('#F2F3F5')
  for (let i = 0; i <= 4; i++) {
    const y = padT + (innerH * i) / 4
    const v = Math.round((max * (4 - i)) / 4)
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(padL + innerW, y)
    ctx.stroke()
    ctx.setTextAlign('right')
    ctx.setTextBaseline('middle')
    ctx.fillText(String(v), padL - 6, y)
  }

  // X 轴标签
  const labelIdx = list.length <= 7
    ? list.map((_, i) => i)
    : [0, Math.floor(list.length / 2), list.length - 1]
  ctx.setFillStyle('#86909C')
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  labelIdx.forEach((i) => {
    const x = padL + i * stepX
    ctx.fillText(shortDate(list[i].date), x, padT + innerH + 6)
  })

  // 渐变填充区
  if (ctx.createLinearGradient) {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH)
    grad.addColorStop(0, 'rgba(22, 119, 255, 0.25)')
    grad.addColorStop(1, 'rgba(22, 119, 255, 0)')
    ctx.setFillStyle(grad)
    ctx.beginPath()
    list.forEach((d, i) => {
      const x = padL + i * stepX
      const y = padT + innerH - (Number(d.count) || 0) / max * innerH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(padL + (list.length - 1) * stepX, padT + innerH)
    ctx.lineTo(padL, padT + innerH)
    ctx.closePath()
    ctx.fill()
  }

  // 折线
  ctx.setStrokeStyle('#1677FF')
  ctx.setLineWidth(2.5)
  ctx.beginPath()
  list.forEach((d, i) => {
    const x = padL + i * stepX
    const y = padT + innerH - (Number(d.count) || 0) / max * innerH
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  // 圆点
  ctx.setFillStyle('#1677FF')
  list.forEach((d, i) => {
    const x = padL + i * stepX
    const y = padT + innerH - (Number(d.count) || 0) / max * innerH
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.setFillStyle('#ffffff')
  list.forEach((d, i) => {
    const x = padL + i * stepX
    const y = padT + innerH - (Number(d.count) || 0) / max * innerH
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.draw()
}

async function load() {
  try {
    const res = await getStats(range.value)
    stats.value = res || {}
  } catch (e) {
    stats.value = {}
  }
  drawTrend()
}

function onChangeRange(v: RangeKey) {
  if (range.value === v) return
  range.value = v
  load()
}

onShow(() => { if (auth.token) load() })
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F7FA;
  padding: 24rpx;
  padding-bottom: 80rpx;
}

.seg-card { margin-bottom: 16rpx; }
.seg-bg {
  display: flex;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.seg-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
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

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.kpi {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx 16rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
  position: relative;
  overflow: hidden;
}
.kpi-blue::before, .kpi-orange::before, .kpi-green::before {
  content: '';
  position: absolute;
  top: -40rpx;
  right: -40rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  opacity: 0.5;
}
.kpi-blue::before { background: #E8F3FF; }
.kpi-orange::before { background: #FFF4E6; }
.kpi-green::before { background: #E6F7ED; }

.kpi-icon {
  position: relative;
  z-index: 1;
  width: 64rpx;
  height: 64rpx;
  margin: 0 auto 12rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kpi-blue .kpi-icon { background: #E8F3FF; }
.kpi-orange .kpi-icon { background: #FFF4E6; }
.kpi-green .kpi-icon { background: #E6F7ED; }

.kpi-label {
  position: relative;
  z-index: 1;
  font-size: 22rpx;
  color: #86909C;
}
.kpi-value {
  position: relative;
  z-index: 1;
  margin-top: 6rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: #1F2329;
  line-height: 1.1;
}

.section { margin-top: 16rpx; }
.section-title {
  font-size: 24rpx;
  color: #86909C;
  margin: 0 8rpx 12rpx;
  letter-spacing: 1rpx;
}
.trend-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 30, 60, 0.04);
}
.trend-canvas-wrap {
  width: 100%;
  height: 360rpx;
}
.trend-canvas {
  width: 100%;
  height: 360rpx;
  display: block;
}
</style>
