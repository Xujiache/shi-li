<template>
  <view class="page" v-if="child">
    <!-- 通用基础信息（始终可见，不可编辑） -->
    <view class="card profile-header">
      <view class="ph-row">
        <view class="ph-avatar">{{ initial(child.name) }}</view>
        <view class="ph-main">
          <view class="ph-name">{{ child.name || '-' }}</view>
          <view class="ph-sub">
            {{ genderText }} · {{ ageText }} · {{ child.school || '-' }} {{ child.grade_name || '' }}{{ child.class_name || '' }}
          </view>
          <view class="ph-meta" v-if="child.parent_phone">家长手机：{{ child.parent_phone }}</view>
          <view class="ph-meta" v-if="child.dob">出生日期：{{ child.dob }}</view>
        </view>
      </view>
    </view>

    <!-- 空授权状态 -->
    <view v-if="!editableSections.length" class="card empty-state">
      <view class="es-icon">
        <svg-icon name="lock" :size="80" color="#C9CDD4" />
      </view>
      <view class="es-text">管理员未给本部门授权可填字段</view>
      <view class="es-hint">请联系管理员到【部门字段授权】页配置</view>
    </view>

    <!-- 按 section 渲染 -->
    <view v-for="sec in editableSections" :key="sec.key" class="card section-card">
      <view class="section-title">{{ sec.label }}</view>

      <view
        v-for="f in visibleFields(sec)"
        :key="f.key"
        class="field-row"
        :class="{ col: f.type === 'textarea' || f.type === 'multi_select' }"
      >
        <text class="field-label">{{ f.label }}{{ f.required ? ' *' : '' }}</text>

        <!-- text / number -->
        <input
          v-if="f.type === 'text' || f.type === 'number'"
          class="field-input"
          :type="f.type === 'number' ? 'number' : 'text'"
          :placeholder="f.placeholder || '请输入'"
          :value="String(form[f.key] == null ? '' : form[f.key])"
          @input="(e: any) => form[f.key] = e.detail.value"
        />

        <!-- date -->
        <picker
          v-else-if="f.type === 'date'"
          mode="date"
          class="field-input picker"
          :value="form[f.key] || ''"
          @change="(e: any) => form[f.key] = e.detail.value"
        >
          <text>{{ form[f.key] || '请选择日期' }}</text>
        </picker>

        <!-- select -->
        <picker
          v-else-if="f.type === 'select'"
          mode="selector"
          :range="f.options || []"
          class="field-input picker"
          @change="(e: any) => form[f.key] = (f.options || [])[e.detail.value]"
        >
          <text>{{ form[f.key] || '请选择' }}</text>
        </picker>

        <!-- multi_select：复选 chips -->
        <view v-else-if="f.type === 'multi_select'" class="chips">
          <text
            v-for="opt in (f.options || [])"
            :key="opt"
            class="chip"
            :class="{ active: isChecked(form[f.key], opt) }"
            @click="toggleMulti(f.key, opt)"
          >{{ opt }}</text>
        </view>

        <!-- textarea -->
        <textarea
          v-else-if="f.type === 'textarea'"
          class="field-textarea"
          :placeholder="f.placeholder || '请输入'"
          :value="String(form[f.key] == null ? '' : form[f.key])"
          @input="(e: any) => form[f.key] = e.detail.value"
        />

        <!-- 兜底（unsupported type 显示纯文本）-->
        <text v-else class="field-input readonly">{{ form[f.key] || '-' }}</text>
      </view>
    </view>

    <!-- 档案分析（AI / 人工） -->
    <ai-analysis-card v-if="id" :child-id="id" />

    <view v-if="editableSections.length" class="submit-bar">
      <view class="btn-primary" :class="{ disabled: saving }" @click="onSave">
        {{ saving ? '保存中...' : '保存' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import * as childApi from '@/api/child'
import type { ChildSection, ChildSectionField } from '@/api/child'

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
const ageText = computed(() => {
  const a = child.value?.age
  return a == null ? '-' : `${a}岁`
})

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
    // 初始化 form：把 child 上每个允许字段的值带入
    for (const k of allowedFieldKeys.value) {
      const v = (r.child as any)?.[k]
      // multi_select 的字段如果是 JSON 数组字符串，反序列化
      if (typeof v === 'string' && v.startsWith('[')) {
        try { form[k] = JSON.parse(v) }
        catch { form[k] = v }
      } else {
        form[k] = v == null ? '' : v
      }
    }
  } catch (e) { /* http 拦截器已 toast */ }
}

async function onSave() {
  if (saving.value) return
  saving.value = true
  try {
    // 收集已编辑字段（仅 allowedFieldKeys 内的，避免误传）
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
  padding: 16rpx;
  padding-bottom: 160rpx;
  min-height: 100vh;
  background: #F5F7FA;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}

/* 通用基础信息头 */
.profile-header { padding: 24rpx; }
.ph-row { display: flex; align-items: flex-start; }
.ph-avatar {
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: #1677FF; color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; font-weight: 600;
  margin-right: 24rpx; flex-shrink: 0;
}
.ph-main { flex: 1; min-width: 0; }
.ph-name {
  font-size: 36rpx; font-weight: 600; color: #1F2329;
}
.ph-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4E5969;
}
.ph-meta {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #86909C;
}

/* 空授权 */
.empty-state {
  text-align: center;
  padding: 48rpx 24rpx;
}
.es-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}
.es-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #1F2329;
  font-weight: 600;
}
.es-hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #86909C;
}

/* section */
.section-card { padding: 0; overflow: hidden; }
.section-title {
  padding: 24rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2329;
  border-bottom: 1rpx solid #F2F3F5;
  background: #FAFBFC;
}

.field-row {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
  &:last-child { border-bottom: none; }
  &.col {
    flex-direction: column;
    align-items: flex-start;
  }
}
.field-label {
  width: 200rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  color: #4E5969;
}
.field-input {
  flex: 1;
  font-size: 26rpx;
  color: #1F2329;
  text-align: right;
  padding: 8rpx 0;
}
.field-input.picker {
  text-align: right;
  color: #4E5969;
}
.field-input.readonly {
  color: #86909C;
}
.field-textarea {
  width: 100%;
  margin-top: 12rpx;
  min-height: 120rpx;
  padding: 16rpx;
  background: #F7F8FA;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.chips {
  width: 100%;
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.chip {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-size: 24rpx;
  &.active {
    background: #E8F3FF;
    color: #1677FF;
  }
}

/* 提交栏 */
.submit-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  padding: 16rpx 24rpx;
  background: #ffffff;
  border-top: 1rpx solid #F2F3F5;
}
.btn-primary {
  background: #1677FF;
  color: #ffffff;
  text-align: center;
  padding: 24rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &.disabled { opacity: 0.5; }
}
</style>
