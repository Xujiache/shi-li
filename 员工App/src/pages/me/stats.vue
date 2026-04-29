<template>
  <view class="stats-page">
    <!-- range 切换 -->
    <view class="segmented card">
      <view
        v-for="opt in ranges"
        :key="opt.value"
        class="seg-item"
        :class="{ active: range === opt.value }"
        @click="onChangeRange(opt.value)"
      >
        {{ opt.label }}
      </view>
    </view>

    <!-- 三个数据卡 -->
    <view class="kpi-grid">
      <view class="kpi card">
        <view class="kpi-label">本期新增客户</view>
        <view class="kpi-value">{{ stats.new_customers || 0 }}</view>
      </view>
      <view class="kpi card">
        <view class="kpi-label">本期跟进次数</view>
        <view class="kpi-value">{{ stats.follow_ups || 0 }}</view>
      </view>
      <view class="kpi card">
        <view class="kpi-label">本期成交数</view>
        <view class="kpi-value">{{ stats.signed_customers || 0 }}</view>
      </view>
    </view>

    <!-- 趋势图（折线） -->
    <view class="trend card">
      <view class="trend-title">每日跟进趋势</view>
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
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStats } from '@/api/employee'
import { useAuthStore } from '@/stores/auth'

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
      query
        .select('#trendChart')
        .boundingClientRect((rect: any) => {
          if (rect && rect.width) {
            resolve({ w: Math.floor(rect.width), h: Math.floor(rect.height || 160) })
          } else {
            resolve({ w: 320, h: 160 })
          }
        })
        .exec()
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
  const ctx: any = (uni as any).createCanvasContext
    ? (uni as any).createCanvasContext('trendChart')
    : null
  if (!ctx) return

  const padL = 36
  const padR = 16
  const padT = 16
  const padB = 28
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

  // 横向网格 + 纵轴刻度（4 段）
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

  // X 轴标签：首、末、中点（避免重叠）
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

  // 折线 + 圆点
  ctx.setStrokeStyle('#1677FF')
  ctx.setLineWidth(2)
  ctx.beginPath()
  list.forEach((d, i) => {
    const x = padL + i * stepX
    const y = padT + innerH - (Number(d.count) || 0) / max * innerH
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.setFillStyle('#1677FF')
  list.forEach((d, i) => {
    const x = padL + i * stepX
    const y = padT + innerH - (Number(d.count) || 0) / max * innerH
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
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

onShow(() => {
  if (auth.token) load()
})
</script>

<style lang="scss" scoped>
.stats-page {
  padding: 24rpx;
  min-height: 100vh;
}

.segmented {
  display: flex;
  padding: 8rpx;
  background: #F2F3F5;
  box-shadow: none;
}
.seg-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: #4E5969;
  border-radius: 12rpx;
  transition: background 0.15s;
}
.seg-item.active {
  background: #ffffff;
  color: #1677FF;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.kpi {
  margin-bottom: 0;
  padding: 24rpx 16rpx;
  text-align: center;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.kpi-label {
  font-size: 22rpx;
  color: #86909C;
}
.kpi-value {
  margin-top: 8rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #1F2329;
}

.trend {
  padding: 24rpx;
}
.trend-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  color: #1F2329;
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
