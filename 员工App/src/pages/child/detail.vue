<template>
  <view class="page" v-if="child">
    <!-- ===== 简洁头部 ===== -->
    <view class="header">
      <view class="header-row">
        <view class="avatar">{{ initial(child.name) }}</view>
        <view class="header-info">
          <view class="name">{{ child.name || '-' }}</view>
          <view class="meta-line">
            <text v-if="child.gender" class="meta-tag">{{ genderText }}</text>
            <text v-if="child.age != null" class="meta-tag">{{ child.age }}岁</text>
            <text v-if="child.dob" class="meta-tag light">{{ child.dob }}</text>
          </view>
        </view>
      </view>

      <!-- 快速信息 chips（学校/年级/家长） -->
      <view class="quick-info" v-if="quickInfoItems.length">
        <view v-for="it in quickInfoItems" :key="it.key" class="qi-item">
          <svg-icon :name="it.icon" :size="22" color="#86909C" />
          <text>{{ it.value }}</text>
        </view>
      </view>
    </view>

    <!-- ===== 空授权状态 ===== -->
    <view v-if="!editableSections.length" class="group">
      <view class="empty-card">
        <view class="empty-icon">
          <svg-icon name="lock" :size="64" color="#C9CDD4" />
        </view>
        <view class="empty-title">本部门暂无可填字段授权</view>
        <view class="empty-hint">请联系管理员到「部门字段授权」配置</view>
      </view>
    </view>

    <!-- ===== 字段分组 ===== -->
    <view v-for="sec in editableSections" :key="sec.key" class="group">
      <view class="group-title">{{ sec.label }}</view>
      <view class="group-card">
        <view
          v-for="(f, i) in visibleFields(sec)"
          :key="f.key"
          class="field"
          :class="{ 'is-block': isBlockField(f) }"
        >
          <view class="field-head">
            <text class="field-label">{{ f.label }}</text>
            <text v-if="f.required" class="field-req">必填</text>
          </view>

          <view class="field-control">
            <input
              v-if="f.type === 'text' || f.type === 'number'"
              class="ctl-input"
              :type="f.type === 'number' ? 'number' : 'text'"
              :placeholder="f.placeholder || '请输入'"
              :value="String(form[f.key] == null ? '' : form[f.key])"
              @input="(e: any) => form[f.key] = e.detail.value"
            />

            <picker
              v-else-if="f.type === 'date'"
              mode="date"
              :value="form[f.key] || ''"
              @change="(e: any) => form[f.key] = e.detail.value"
            >
              <view class="ctl-picker">
                <text :class="{ ph: !form[f.key] }">{{ form[f.key] || '请选择日期' }}</text>
                <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
              </view>
            </picker>

            <picker
              v-else-if="f.type === 'select'"
              mode="selector"
              :range="f.options || []"
              @change="(e: any) => form[f.key] = (f.options || [])[e.detail.value]"
            >
              <view class="ctl-picker">
                <text :class="{ ph: !form[f.key] }">{{ form[f.key] || '请选择' }}</text>
                <svg-icon name="chevron-right" :size="22" color="#C9CDD4" />
              </view>
            </picker>

            <view v-else-if="f.type === 'multi_select'" class="ctl-chips">
              <text
                v-for="opt in (f.options || [])"
                :key="opt"
                class="chip"
                :class="{ active: isChecked(form[f.key], opt) }"
                @click="toggleMulti(f.key, opt)"
              >{{ opt }}</text>
            </view>

            <textarea
              v-else-if="f.type === 'textarea'"
              class="ctl-textarea"
              :placeholder="f.placeholder || '请输入'"
              :value="String(form[f.key] == null ? '' : form[f.key])"
              @input="(e: any) => form[f.key] = e.detail.value"
            />

            <text v-else class="ctl-input readonly">{{ form[f.key] || '-' }}</text>
          </view>

          <view v-if="i < visibleFields(sec).length - 1" class="field-divider" />
        </view>
      </view>
    </view>

    <!-- ===== 档案分析 ===== -->
    <view v-if="id" class="group">
      <view class="group-title">档案分析</view>
      <ai-analysis-card :child-id="id" />
    </view>

    <!-- 底部占位（避免最后一组被悬浮按钮遮挡） -->
    <view v-if="editableSections.length" class="float-spacer" />

    <!-- ===== 浮动保存按钮（透明底） ===== -->
    <view v-if="editableSections.length" class="float-save">
      <view class="float-btn" :class="{ disabled: saving }" @click="onSave">
        <svg-icon v-if="!saving" name="check-circle" :size="28" color="#ffffff" />
        <text>{{ saving ? '保存中…' : '保存' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as childApi from '@/api/child'
import type { ChildSection, ChildSectionField } from '@/api/child'
import SvgIcon from '@/components/svg-icon.vue'

const id = ref<string>('')
const child = ref<any>(null)
const editableSections = ref<ChildSection[]>([])
const allowedFieldKeys = ref<Set<string>>(new Set())
const form = reactive<Record<string, any>>({})
const saving = ref(false)

function initial(name: string) {
  const n = String(name || '').trim()
  return n ? n.charAt(0) : '?'
}
const genderText = computed(() => {
  const g = String(child.value?.gender || '')
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return g || '未知'
})

const quickInfoItems = computed(() => {
  const out: { key: string; icon: string; value: string }[] = []
  const c = child.value
  if (!c) return out
  const school = [c.school, c.grade_name, c.class_name].filter(Boolean).join(' · ')
  if (school) out.push({ key: 'school', icon: 'book-open', value: school })
  if (c.parent_phone) out.push({ key: 'phone', icon: 'phone', value: c.parent_phone })
  return out
})

function isBlockField(f: ChildSectionField) {
  return f.type === 'textarea' || f.type === 'multi_select'
}

function visibleFields(sec: ChildSection) {
  return (sec.fields || []).filter((f: ChildSectionField) => {
    if (f.enabled === false) return false
    if (f.readonly) return false
    return allowedFieldKeys.value.has(f.key)
  })
}

function isChecked(cur: any, val: string) {
  if (!cur) return false
  if (Array.isArray(cur)) return cur.includes(val)
  if (typeof cur === 'string') {
    try {
      const arr = JSON.parse(cur)
      return Array.isArray(arr) && arr.includes(val)
    } catch { return false }
  }
  return false
}

function toggleMulti(key: string, val: string) {
  let cur = form[key]
  if (!Array.isArray(cur)) {
    if (typeof cur === 'string' && cur.startsWith('[')) {
      try { cur = JSON.parse(cur) } catch { cur = [] }
    } else {
      cur = []
    }
  }
  const idx = cur.indexOf(val)
  if (idx >= 0) cur.splice(idx, 1)
  else cur.push(val)
  form[key] = [...cur]
}

async function load() {
  try {
    const r: any = await childApi.detail(id.value)
    if (!r) return
    child.value = r.child
    editableSections.value = (r.allowed_sections || []) as ChildSection[]
    allowedFieldKeys.value = new Set<string>((r.allowed_field_keys || []).map(String))
    for (const k of allowedFieldKeys.value) {
      const v = (r.child as any)?.[k]
      if (typeof v === 'string' && v.startsWith('[')) {
        try { form[k] = JSON.parse(v) }
        catch { form[k] = v }
      } else {
        form[k] = v == null ? '' : v
      }
    }
  } catch (e) { /* */ }
}

async function onSave() {
  if (saving.value) return
  saving.value = true
  try {
    const patch: Record<string, any> = {}
    for (const k of allowedFieldKeys.value) {
      patch[k] = form[k]
    }
    const r: any = await childApi.update(id.value, patch)
    if (r) {
      const dropped = r.dropped_fields || []
      if (dropped.length > 0) {
        uni.showToast({ title: `已保存（丢弃 ${dropped.length} 个无授权字段）`, icon: 'none' })
      } else {
        uni.showToast({ title: '保存成功', icon: 'success' })
      }
    }
  } catch (e) { /* */ } finally { saving.value = false }
}

onLoad((q: any) => { id.value = String(q?.id || '') })
onShow(() => { if (id.value) load() })
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F4F5F7;
  padding-bottom: 64rpx;
}

/* ===== Header（白底简洁版） ===== */
.header {
  background: #ffffff;
  padding: 32rpx 24rpx 24rpx;
  margin-bottom: 16rpx;
}
.header-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: #F2F3F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 600;
  color: #4E5969;
  flex-shrink: 0;
}
.header-info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 36rpx;
  font-weight: 600;
  color: #1F2329;
}
.meta-line {
  margin-top: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.meta-tag {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  background: #F2F3F5;
  color: #4E5969;
  &.light { background: transparent; color: #86909C; padding: 2rpx 0; }
}

.quick-info {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #F0F1F3;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.qi-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: #4E5969;
}

/* ===== 字段分组（飞书风格小标题 + 白卡） ===== */
.group {
  padding: 0 16rpx;
  margin-bottom: 16rpx;
}
.group-title {
  padding: 0 12rpx 8rpx;
  font-size: 22rpx;
  color: #86909C;
  letter-spacing: 1rpx;
}
.group-card {
  background: #ffffff;
  border-radius: 12rpx;
  overflow: hidden;
}

/* 空授权 */
.empty-card {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 64rpx 24rpx;
  text-align: center;
}
.empty-icon { display: flex; justify-content: center; margin-bottom: 16rpx; }
.empty-title {
  font-size: 28rpx;
  color: #1F2329;
  font-weight: 500;
}
.empty-hint {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #86909C;
}

/* ===== 字段行（紧凑 inline 版 / 块状 block 版） ===== */
.field {
  position: relative;
  padding: 24rpx;
}
.field-head {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.field-label {
  font-size: 22rpx;
  color: #86909C;
  letter-spacing: 0.5rpx;
}
.field-req {
  font-size: 18rpx;
  color: #F53F3F;
  background: #FFECEB;
  padding: 0 8rpx;
  border-radius: 4rpx;
}

.field-control {
  margin-top: 8rpx;
}

.ctl-input {
  width: 100%;
  font-size: 28rpx;
  color: #1F2329;
  background: transparent;
  padding: 4rpx 0;
}
.ctl-input.readonly {
  color: #86909C;
}
.ctl-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  color: #1F2329;
  padding: 4rpx 0;
  &:active { opacity: 0.7; }
}
.ctl-picker .ph { color: #C9CDD4; }

.ctl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 4rpx;
}
.chip {
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-size: 24rpx;
  transition: all 0.15s;
  &:active { transform: scale(0.96); }
  &.active {
    background: #E8F3FF;
    color: #1677FF;
    border: 1rpx solid #91CAFF;
  }
}

.ctl-textarea {
  width: 100%;
  margin-top: 4rpx;
  min-height: 140rpx;
  padding: 16rpx;
  background: #FAFBFC;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #1F2329;
  line-height: 1.6;
  box-sizing: border-box;
}

.field-divider {
  position: absolute;
  bottom: 0;
  left: 24rpx;
  right: 0;
  height: 1rpx;
  background: #F0F1F3;
}

/* ===== 浮动保存（无白底，按钮自带阴影） ===== */
.float-spacer {
  height: 200rpx;
}
.float-save {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 50;
}
.float-btn {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  min-width: 360rpx;
  padding: 26rpx 80rpx;
  border-radius: 100rpx;
  background: #1677FF;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  box-shadow:
    0 8rpx 24rpx rgba(22, 119, 255, 0.35),
    0 2rpx 8rpx rgba(22, 119, 255, 0.18);
  transition: all 0.2s;
  &:active {
    transform: translateY(2rpx) scale(0.98);
    box-shadow: 0 4rpx 12rpx rgba(22, 119, 255, 0.3);
  }
  &.disabled {
    opacity: 0.7;
    pointer-events: none;
    box-shadow: none;
  }
}
.float-btn text { color: #ffffff; }
</style>
