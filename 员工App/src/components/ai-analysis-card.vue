<template>
  <view class="aa-card">
    <view class="aa-head-row">
      <view class="aa-title">
        <svg-icon name="sparkles" :size="28" color="#1677FF" />
        <text class="aa-title-text">档案分析</text>
      </view>
      <text v-if="loading" class="aa-loading">加载中…</text>
    </view>

    <view v-if="current" class="aa-current">
      <view class="aa-meta-row">
        <view class="aa-tag" :class="current.source === 'ai' ? 'tag-ai' : 'tag-human'">
          {{ currentLabel }}
        </view>
        <text class="aa-time">{{ fmtDateTime(current.created_at) }}</text>
      </view>
      <view class="aa-content">{{ current.content }}</view>
      <view class="aa-note">
        {{ current.prompt_meta?.analysis_kind === 'ai_correction'
          ? '这是员工基于 AI 报告修订后的版本，会作为后续蒸馏样本。'
          : 'AI 报告如果不够准确或不够好用，可以直接修订并反馈原因。' }}
      </view>
    </view>
    <view v-else-if="!loading" class="aa-empty">
      <view class="aa-empty-icon">
        <svg-icon name="sparkles" :size="56" color="#C9CDD4" />
      </view>
      <text class="aa-empty-text">
        {{ mode === 'ai' ? '尚未生成 AI 分析' : '暂无人工分析' }}
      </text>
      <text class="aa-empty-sub">
        {{ mode === 'ai' ? '管理员可在后台触发批量生成' : '点下方按钮添加一条' }}
      </text>
    </view>

    <view v-if="!loading" class="aa-actions">
      <view v-if="canEditAi" class="aa-btn outline" @click="openEditAi">
        <svg-icon name="edit-3" :size="22" color="#1677FF" />
        <text>修订 AI</text>
      </view>
      <view v-if="canWriteHuman" class="aa-btn primary" @click="openWrite">
        <svg-icon name="edit-3" :size="22" color="#ffffff" />
        <text>写一条分析</text>
      </view>
      <view v-if="list.length > 1" class="aa-btn ghost" @click="historyVisible = true">
        历史 {{ list.length }}
      </view>
    </view>

    <!-- ===== Sheet 1: 写人工分析 ===== -->
    <view v-if="writeVisible" class="sheet-mask" @click.self="writeVisible = false">
      <view class="sheet" @click.stop>
        <view class="sheet-header">
          <view class="sheet-close" @click="writeVisible = false">
            <svg-icon name="x" :size="28" color="#4E5969" />
          </view>
          <text class="sheet-title">写一条人工分析</text>
          <view
            class="sheet-confirm"
            :class="{ disabled: savingHuman }"
            @click="confirmWrite"
          >{{ savingHuman ? '保存中…' : '保存' }}</view>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-tip">
            AI 模式时，这条分析会作为 GPT 模仿的范例风格之一。
          </view>
          <textarea
            class="sheet-textarea"
            v-model="writeContent"
            placeholder="请输入分析内容（200~400 字为宜）"
            maxlength="5000"
            :auto-height="false"
          />
          <view class="sheet-counter">{{ writeContent.length }} / 5000</view>
        </scroll-view>
      </view>
    </view>

    <!-- ===== Sheet 2: 修订 AI 报告（2 步骤） ===== -->
    <view v-if="editVisible" class="sheet-mask" @click.self="closeEditFlow">
      <view class="sheet sheet-large" @click.stop>
        <view class="sheet-header">
          <view class="sheet-close" @click="closeEditFlow">
            <svg-icon name="x" :size="28" color="#4E5969" />
          </view>
          <view class="sheet-title-wrap">
            <text class="sheet-title">修订 AI 报告</text>
            <view class="step-pills">
              <view class="step-pill" :class="{ active: editStep === 'edit', done: editStep === 'reason' }">1</view>
              <view class="step-line" :class="{ done: editStep === 'reason' }" />
              <view class="step-pill" :class="{ active: editStep === 'reason' }">2</view>
            </view>
          </view>
          <view
            class="sheet-confirm"
            :class="{ disabled: promptLoading || submittingCorrection }"
            @click="goNextStep"
          >{{ promptLoading ? '生成中…' : nextButtonText }}</view>
        </view>

        <scroll-view scroll-y class="sheet-body">
          <view v-if="editStep === 'edit'">
            <view class="sheet-tip">第一步：修改报告内容</view>

            <view class="block">
              <view class="block-title">{{ editSourceTitle }}</view>
              <view class="block-preview">{{ aiOriginalContent }}</view>
            </view>

            <view class="block">
              <view class="block-title">修订后的报告</view>
              <textarea
                class="sheet-textarea sheet-textarea-lg"
                v-model="editedContent"
                placeholder="请在 AI 报告基础上修改内容"
                maxlength="5000"
              />
              <view class="sheet-counter">{{ editedContent.length }} / 5000</view>
            </view>
          </view>

          <view v-else>
            <view class="sheet-tip">第二步：告诉 AI 你为什么这样改</view>

            <view class="question-card">
              <view class="question-title">{{ promptData.prompt || '你主要为什么修改这份 AI 分析？' }}</view>
              <view v-if="promptData.summary" class="question-summary">{{ promptData.summary }}</view>
            </view>

            <view class="block">
              <view class="block-title">通用原因</view>
              <view class="chip-group">
                <text
                  v-for="opt in promptData.base_options"
                  :key="`base-${opt.code || opt.label}`"
                  class="chip"
                  :class="{ active: isOptionSelected(opt) }"
                  @click="toggleOption(opt)"
                >{{ opt.label }}</text>
              </view>
            </view>

            <view v-if="promptData.suggested_options.length" class="block">
              <view class="block-title">
                <text>本次建议追问</text>
                <text class="block-tag">AI 实时生成</text>
              </view>
              <view class="chip-group">
                <text
                  v-for="opt in promptData.suggested_options"
                  :key="`ai-${opt.code || opt.label}`"
                  class="chip chip-ai"
                  :class="{ active: isOptionSelected(opt) }"
                  @click="toggleOption(opt)"
                >{{ opt.label }}</text>
              </view>
            </view>

            <view class="block">
              <view class="block-title">补充说明（可选）</view>
              <textarea
                class="sheet-textarea"
                v-model="customReason"
                placeholder="如果选项不够，可以补充真正的修改原因"
                maxlength="1000"
              />
              <view class="sheet-counter">{{ customReason.length }} / 1000</view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- ===== Sheet 3: 历史 ===== -->
    <view v-if="historyVisible" class="sheet-mask" @click.self="historyVisible = false">
      <view class="sheet" @click.stop>
        <view class="sheet-header">
          <view class="sheet-close" @click="historyVisible = false">
            <svg-icon name="x" :size="28" color="#4E5969" />
          </view>
          <text class="sheet-title">分析历史 · {{ list.length }} 条</text>
          <text></text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view v-for="a in list" :key="a.id" class="history-card">
            <view class="aa-meta-row">
              <view class="aa-tag" :class="a.source === 'ai' ? 'tag-ai' : 'tag-human'">
                {{ getAnalysisLabel(a) }}
              </view>
              <text class="aa-time">{{ fmtDateTime(a.created_at) }}</text>
            </view>
            <view class="aa-content">{{ a.content }}</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getCorrectionPrompt,
  listAnalyses,
  submitAnalysisCorrection,
  writeHumanAnalysis,
  type ChildAnalysis,
  type CorrectionOption,
  type CorrectionPromptResp
} from '@/api/child'
import { fmtDateTime } from '@/utils/format'

const props = defineProps<{ childId: number | string }>()

const loading = ref(false)
const current = ref<ChildAnalysis | null>(null)
const list = ref<ChildAnalysis[]>([])
const mode = ref<string>('human')

const writeVisible = ref(false)
const writeContent = ref('')
const savingHuman = ref(false)
const historyVisible = ref(false)

const editVisible = ref(false)
const editStep = ref<'edit' | 'reason'>('edit')
const promptLoading = ref(false)
const submittingCorrection = ref(false)
const editedContent = ref('')
const aiOriginalContent = ref('')
const aiAnalysisId = ref<number | null>(null)
const promptData = ref<CorrectionPromptResp>({
  prompt: '',
  summary: '',
  base_options: [],
  suggested_options: []
})
const selectedOptions = ref<CorrectionOption[]>([])
const customReason = ref('')

const canWriteHuman = computed(() => !!props.childId)
const editableAiAnalysis = computed<ChildAnalysis | null>(() => {
  if (!current.value && !list.value.length) return null
  if (current.value?.source === 'ai') return current.value
  if (current.value?.prompt_meta?.analysis_kind === 'ai_correction') return current.value
  return list.value.find((item) => item.source === 'ai') || null
})
const canEditAi = computed(() => !!props.childId && !!editableAiAnalysis.value)
const currentLabel = computed(() => getAnalysisLabel(current.value))
const nextButtonText = computed(() => {
  if (editStep.value === 'edit') return '下一步'
  return submittingCorrection.value ? '提交中...' : '提交修订'
})
const editSourceTitle = computed(() => {
  if (current.value?.prompt_meta?.analysis_kind === 'ai_correction') return '当前报告内容'
  return '原始 AI 报告'
})

function getAnalysisLabel(analysis: ChildAnalysis | null | undefined) {
  if (!analysis) return '分析'
  if (analysis.prompt_meta?.analysis_kind === 'ai_correction') return 'AI 修订版'
  return analysis.source === 'ai' ? 'AI 分析' : '人工分析'
}

async function load() {
  if (!props.childId) return
  loading.value = true
  try {
    const r: any = await listAnalyses(props.childId)
    if (r) {
      mode.value = r.mode || 'human'
      current.value = r.current || null
      list.value = r.list || []
    }
  } catch (e) {
    // http 拦截器 toast
  } finally {
    loading.value = false
  }
}

function openWrite() {
  writeContent.value = ''
  writeVisible.value = true
}

function openEditAi() {
  const editable = editableAiAnalysis.value
  if (!editable) {
    uni.showToast({ title: '当前没有可修订的 AI 报告', icon: 'none' })
    return
  }
  const originalAiId = editable.source === 'ai'
    ? editable.id
    : Number(editable.prompt_meta?.corrected_from_analysis_id || 0)
  if (!originalAiId) {
    uni.showToast({ title: '当前没有可修订的 AI 报告', icon: 'none' })
    return
  }
  editVisible.value = true
  editStep.value = 'edit'
  aiAnalysisId.value = originalAiId
  aiOriginalContent.value = editable.content || ''
  editedContent.value = editable.content || ''
  promptData.value = { prompt: '', summary: '', base_options: [], suggested_options: [] }
  selectedOptions.value = []
  customReason.value = ''
}

function closeEditFlow() {
  if (promptLoading.value || submittingCorrection.value) return
  editVisible.value = false
  editStep.value = 'edit'
}

function optionKey(opt: CorrectionOption) {
  return `${opt.source || 'selected'}:${opt.code || ''}:${opt.label}`
}

function isOptionSelected(opt: CorrectionOption) {
  const key = optionKey(opt)
  return selectedOptions.value.some((item) => optionKey(item) === key)
}

function toggleOption(opt: CorrectionOption) {
  const key = optionKey(opt)
  const idx = selectedOptions.value.findIndex((item) => optionKey(item) === key)
  if (idx >= 0) {
    selectedOptions.value.splice(idx, 1)
  } else {
    selectedOptions.value.push({ ...opt })
  }
}

async function confirmWrite() {
  const text = writeContent.value.trim()
  if (!text) {
    uni.showToast({ title: '内容不能为空', icon: 'none' })
    return
  }
  savingHuman.value = true
  try {
    await writeHumanAnalysis(props.childId, text)
    uni.showToast({ title: '已保存', icon: 'success' })
    writeVisible.value = false
    await load()
  } catch (e) {
    // handled by interceptor
  } finally {
    savingHuman.value = false
  }
}

async function goNextStep() {
  if (editStep.value === 'edit') {
    const text = editedContent.value.trim()
    if (!aiAnalysisId.value) {
      uni.showToast({ title: '当前没有可修订的 AI 报告', icon: 'none' })
      return
    }
    if (!text) {
      uni.showToast({ title: '修订内容不能为空', icon: 'none' })
      return
    }
    if (text === aiOriginalContent.value.trim()) {
      uni.showToast({ title: '请先修改内容再继续', icon: 'none' })
      return
    }
    promptLoading.value = true
    try {
      const prompt = await getCorrectionPrompt(props.childId, aiAnalysisId.value, text)
      promptData.value = {
        prompt: prompt?.prompt || '你主要为什么修改这份 AI 分析？',
        summary: prompt?.summary || '',
        base_options: prompt?.base_options || [],
        suggested_options: prompt?.suggested_options || []
      }
      selectedOptions.value = []
      customReason.value = ''
      editStep.value = 'reason'
    } catch (e) {
      // handled by interceptor
    } finally {
      promptLoading.value = false
    }
    return
  }

  if (!selectedOptions.value.length && !customReason.value.trim()) {
    uni.showToast({ title: '请至少选择一个原因或填写补充说明', icon: 'none' })
    return
  }
  if (!aiAnalysisId.value) return

  submittingCorrection.value = true
  try {
    await submitAnalysisCorrection(props.childId, aiAnalysisId.value, {
      edited_content: editedContent.value.trim(),
      selected_options: selectedOptions.value,
      custom_reason: customReason.value.trim(),
      question_prompt: promptData.value.prompt,
      question_summary: promptData.value.summary,
      generated_options: [...(promptData.value.base_options || []), ...(promptData.value.suggested_options || [])]
    })
    uni.showToast({ title: '修订已保存并纳入优化样本', icon: 'success' })
    closeEditFlow()
    await load()
  } catch (e) {
    // handled by interceptor
  } finally {
    submittingCorrection.value = false
  }
}

onShow(() => { load() })
</script>

<style lang="scss" scoped>
/* ===== 卡片本体 ===== */
.aa-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
}
.aa-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.aa-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.aa-title-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2329;
}
.aa-loading {
  font-size: 22rpx;
  color: #86909C;
}

.aa-current { padding-top: 20rpx; }
.aa-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}
.aa-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
  &.tag-ai { background: #E8F3FF; color: #1677FF; }
  &.tag-human { background: #F2F3F5; color: #4E5969; }
}
.aa-time {
  font-size: 22rpx;
  color: #86909C;
}
.aa-content {
  font-size: 26rpx;
  line-height: 1.7;
  color: #1F2329;
  white-space: pre-wrap;
  word-break: break-word;
}
.aa-note {
  margin-top: 16rpx;
  padding: 14rpx 18rpx;
  border-radius: 10rpx;
  background: #FAFBFC;
  color: #4E5969;
  font-size: 22rpx;
  line-height: 1.6;
  border-left: 3rpx solid #1677FF;
}

.aa-empty {
  padding: 48rpx 0 24rpx;
  text-align: center;
}
.aa-empty-icon { display: flex; justify-content: center; margin-bottom: 12rpx; }
.aa-empty-text {
  display: block;
  font-size: 26rpx;
  color: #1F2329;
  font-weight: 500;
}
.aa-empty-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #86909C;
}

.aa-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F2F3F5;
}
.aa-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 18rpx 0;
  border-radius: 12rpx;
  font-size: 26rpx;
  font-weight: 500;
  transition: opacity 0.15s;
  &:active { opacity: 0.85; }
  &.primary {
    background: #1677FF;
    color: #ffffff;
  }
  &.primary text { color: #ffffff; }
  &.outline {
    background: #ffffff;
    color: #1677FF;
    border: 1rpx solid #91CAFF;
  }
  &.outline text { color: #1677FF; }
  &.ghost {
    flex: 0 0 auto;
    padding: 18rpx 24rpx;
    background: #F2F3F5;
    color: #4E5969;
  }
}

/* ===== Sheet（抽屉式）===== */
.sheet-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-end;
  z-index: 999;
  animation: mask-fade 0.2s ease;
}
@keyframes mask-fade {
  from { background: rgba(0, 0, 0, 0); }
  to { background: rgba(0, 0, 0, 0.5); }
}
.sheet {
  width: 100%;
  background: #F4F5F7;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  animation: sheet-up 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.sheet-large { max-height: 92vh; }
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 20rpx 16rpx;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  border-bottom: 1rpx solid #F0F1F3;
}
.sheet-close {
  width: 64rpx; height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:active { background: #F2F3F5; }
}
.sheet-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1F2329;
  flex: 1;
  text-align: center;
}
.step-pills {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.step-pill {
  width: 32rpx; height: 32rpx;
  border-radius: 50%;
  background: #F2F3F5;
  color: #86909C;
  font-size: 20rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  &.active { background: #1677FF; color: #ffffff; }
  &.done { background: #00B42A; color: #ffffff; }
}
.step-line {
  width: 32rpx; height: 2rpx;
  background: #E5E6EB;
  &.done { background: #00B42A; }
}
.sheet-confirm {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  background: #1677FF;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 600;
  border-radius: 8rpx;
  &:active { opacity: 0.85; }
  &.disabled {
    opacity: 0.5;
  }
}

.sheet-body {
  flex: 1;
  padding: 16rpx;
  background: #F4F5F7;
}
.sheet-tip {
  margin-bottom: 16rpx;
  padding: 14rpx 16rpx;
  border-radius: 8rpx;
  background: #E8F3FF;
  color: #1677FF;
  font-size: 22rpx;
  line-height: 1.5;
}

.block {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #1F2329;
  margin-bottom: 12rpx;
}
.block-tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  background: #FFF7E6;
  color: #FA8C16;
  font-weight: 400;
}
.block-preview {
  padding: 16rpx;
  background: #FAFBFC;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 1.7;
  color: #4E5969;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280rpx;
  overflow-y: auto;
}

.sheet-textarea {
  width: 100%;
  box-sizing: border-box;
  background: #FAFBFC;
  border-radius: 8rpx;
  padding: 14rpx 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  min-height: 200rpx;
  color: #1F2329;
}
.sheet-textarea-lg { min-height: 320rpx; }
.sheet-counter {
  text-align: right;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #86909C;
}

.question-card {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-left: 4rpx solid #1677FF;
}
.question-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2329;
  line-height: 1.5;
}
.question-summary {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4E5969;
  line-height: 1.6;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.chip {
  padding: 12rpx 20rpx;
  border-radius: 24rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-size: 24rpx;
  line-height: 1.2;
  border: 1rpx solid transparent;
  transition: all 0.15s;
  &:active { transform: scale(0.96); }
  &.active {
    background: #E8F3FF;
    color: #1677FF;
    border-color: #91CAFF;
  }
}
.chip.chip-ai {
  background: #FFF7E6;
  color: #B96A00;
  &.active {
    background: #FFEFD0;
    color: #B96A00;
    border-color: #FFD591;
  }
}

.history-card {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
}
</style>
