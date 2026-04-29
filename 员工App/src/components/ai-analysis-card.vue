<template>
  <view class="aa-card card">
    <view class="aa-title">
      <view class="aa-title-left">
        <svg-icon name="sparkles" :size="32" color="#722ED1" />
        <text class="aa-title-text">档案分析</text>
      </view>
      <text v-if="loading" class="aa-loading">加载中...</text>
    </view>

    <view v-if="current" class="aa-current">
      <view class="aa-head">
        <view class="aa-tag" :class="current.source === 'ai' ? 'tag-ai' : 'tag-human'">
          <svg-icon
            :name="current.source === 'ai' ? 'sparkles' : 'user'"
            :size="22"
            :color="current.source === 'ai' ? '#722ED1' : '#1677FF'"
          />
          <text class="aa-tag-text">{{ currentLabel }}</text>
        </view>
        <text class="aa-time">{{ fmtDateTime(current.created_at) }}</text>
      </view>
      <view class="aa-content">{{ current.content }}</view>
      <view class="aa-note">{{ current.prompt_meta?.analysis_kind === 'ai_correction' ? '这是员工基于 AI 报告修订后的版本，会作为后续蒸馏样本。' : 'AI 报告如果不够准确或不够好用，可以直接修订并反馈原因。' }}</view>
    </view>
    <view v-else-if="!loading" class="aa-empty">
      <text>{{ mode === 'ai' ? '尚未生成 AI 分析（管理员可在后台触发）' : '暂无人工分析' }}</text>
    </view>

    <view v-if="!loading" class="aa-actions">
      <view v-if="canEditAi" class="aa-btn warning" @click="openEditAi">修订 AI 报告</view>
      <view v-if="canWriteHuman" class="aa-btn primary" @click="openWrite">写一条分析</view>
      <view v-if="list.length > 1" class="aa-btn ghost" @click="historyVisible = true">
        查看历史（{{ list.length }} 条）
      </view>
    </view>

    <view v-if="writeVisible" class="aa-mask" @click.self="writeVisible = false">
      <view class="aa-panel">
        <view class="aa-panel-head">
          <text class="aa-panel-cancel" @click="writeVisible = false">取消</text>
          <text class="aa-panel-title">写一条分析</text>
          <text class="aa-panel-confirm" @click="confirmWrite">{{ savingHuman ? '保存中...' : '保存' }}</text>
        </view>
        <textarea
          class="aa-textarea"
          v-model="writeContent"
          placeholder="请输入分析内容（AI 模式时会作为 GPT 模仿的范例风格）"
          maxlength="5000"
        />
        <text class="aa-counter">{{ writeContent.length }} / 5000</text>
      </view>
    </view>

    <view v-if="editVisible" class="aa-mask" @click.self="closeEditFlow">
      <view class="aa-panel aa-panel-large">
        <view class="aa-panel-head">
          <text class="aa-panel-cancel" @click="closeEditFlow">取消</text>
          <text class="aa-panel-title">修订 AI 报告{{ editStep === 'edit' ? '（1/2）' : '（2/2）' }}</text>
          <text class="aa-panel-confirm" @click="goNextStep">{{ promptLoading ? '生成中...' : nextButtonText }}</text>
        </view>

        <scroll-view scroll-y class="aa-scroll-body">
          <view v-if="editStep === 'edit'">
            <view class="aa-step-tip">先修改报告内容，再进入“为什么修改”的反馈步骤。</view>
            <view class="aa-section-title">{{ editSourceTitle }}</view>
            <view class="aa-preview">{{ aiOriginalContent }}</view>

            <view class="aa-section-title">修订后的报告</view>
            <textarea
              class="aa-textarea aa-textarea-lg"
              v-model="editedContent"
              placeholder="请在 AI 报告基础上修改内容"
              maxlength="5000"
            />
            <text class="aa-counter">{{ editedContent.length }} / 5000</text>
          </view>

          <view v-else>
            <view class="aa-step-tip">请选择修改原因；如果选项不够，再补充说明，系统会用这些反馈继续优化 AI。</view>
            <view class="aa-question-box">
              <view class="aa-question-title">{{ promptData.prompt || '你主要为什么修改这份 AI 分析？' }}</view>
              <view v-if="promptData.summary" class="aa-question-summary">{{ promptData.summary }}</view>
            </view>

            <view class="aa-section-title">通用原因</view>
            <view class="aa-chip-group">
              <text
                v-for="opt in promptData.base_options"
                :key="`base-${opt.code || opt.label}`"
                class="aa-chip"
                :class="{ active: isOptionSelected(opt) }"
                @click="toggleOption(opt)"
              >{{ opt.label }}</text>
            </view>

            <view v-if="promptData.suggested_options.length" class="aa-section-title">本次建议追问</view>
            <view v-if="promptData.suggested_options.length" class="aa-chip-group">
              <text
                v-for="opt in promptData.suggested_options"
                :key="`ai-${opt.code || opt.label}`"
                class="aa-chip aa-chip-ai"
                :class="{ active: isOptionSelected(opt) }"
                @click="toggleOption(opt)"
              >{{ opt.label }}</text>
            </view>

            <view class="aa-section-title">补充说明（可选）</view>
            <textarea
              class="aa-textarea aa-textarea-sm"
              v-model="customReason"
              placeholder="如果选项不全，可以补充说明真正的修改原因"
              maxlength="1000"
            />
            <text class="aa-counter">{{ customReason.length }} / 1000</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="historyVisible" class="aa-mask" @click.self="historyVisible = false">
      <view class="aa-panel">
        <view class="aa-panel-head">
          <text class="aa-panel-cancel" @click="historyVisible = false">关闭</text>
          <text class="aa-panel-title">分析历史（{{ list.length }} 条）</text>
          <text></text>
        </view>
        <scroll-view scroll-y class="aa-history-list">
          <view v-for="a in list" :key="a.id" class="aa-history-item">
            <view class="aa-head">
              <view class="aa-tag" :class="a.source === 'ai' ? 'tag-ai' : 'tag-human'">
                <svg-icon
                  :name="a.source === 'ai' ? 'sparkles' : 'user'"
                  :size="22"
                  :color="a.source === 'ai' ? '#722ED1' : '#1677FF'"
                />
                <text class="aa-tag-text">{{ getAnalysisLabel(a) }}</text>
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
.aa-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.aa-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2329;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.aa-title-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.aa-title-text { color: #1F2329; }
.aa-loading { font-size: 22rpx; font-weight: normal; color: #86909C; }

.aa-current { padding-top: 16rpx; }
.aa-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}
.aa-tag {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: 500;
  &.tag-ai { background: #F4EAFF; color: #722ED1; }
  &.tag-human { background: #E6F4FF; color: #1677FF; }
}
.aa-tag-text { line-height: 1; }
.aa-time { font-size: 22rpx; color: #86909C; }
.aa-content {
  font-size: 26rpx;
  line-height: 1.7;
  color: #1F2329;
  white-space: pre-wrap;
  word-break: break-word;
}
.aa-note {
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #FFF7E6;
  color: #8C5A11;
  font-size: 22rpx;
  line-height: 1.6;
}
.aa-empty {
  padding: 32rpx 0;
  text-align: center;
  color: #86909C;
  font-size: 24rpx;
}

.aa-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #F2F3F5;
  flex-wrap: wrap;
}
.aa-btn {
  flex: 1;
  min-width: 200rpx;
  padding: 16rpx 0;
  text-align: center;
  border-radius: 12rpx;
  font-size: 26rpx;
  transition: opacity 0.15s, transform 0.15s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &.primary {
    background: #1677FF;
    color: #ffffff;
  }
  &.warning {
    background: #FFF1F0;
    color: #CF1322;
  }
  &.ghost {
    background: #F2F3F5;
    color: #4E5969;
  }
}

.aa-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end;
  z-index: 999;
}
.aa-panel {
  width: 100%;
  background: #ffffff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.aa-panel-large { max-height: 88vh; }
.aa-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #F2F3F5;
}
.aa-panel-title { font-size: 30rpx; font-weight: 600; color: #1F2329; }
.aa-panel-cancel { font-size: 28rpx; color: #86909C; padding: 0 8rpx; }
.aa-panel-confirm { font-size: 28rpx; color: #1677FF; font-weight: 600; padding: 0 8rpx; }

.aa-step-tip {
  margin-bottom: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #F7F8FA;
  color: #4E5969;
  font-size: 22rpx;
  line-height: 1.6;
}

.aa-scroll-body {
  padding: 24rpx;
  max-height: 72vh;
}
.aa-section-title {
  margin-bottom: 16rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #1F2329;
}
.aa-preview {
  margin-bottom: 24rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #F7F8FA;
  color: #4E5969;
  font-size: 24rpx;
  line-height: 1.7;
  white-space: pre-wrap;
}
.aa-textarea {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8rpx;
  background: #F7F8FA;
  border-radius: 12rpx;
  padding: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
}
.aa-textarea-lg { min-height: 360rpx; }
.aa-textarea-sm { min-height: 180rpx; }
.aa-counter {
  display: block;
  text-align: right;
  margin-bottom: 24rpx;
  font-size: 22rpx;
  color: #86909C;
}
.aa-question-box {
  margin-bottom: 24rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  background: #F4EAFF;
}
.aa-question-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #531DAB;
  line-height: 1.5;
}
.aa-question-summary {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #722ED1;
  line-height: 1.6;
}
.aa-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 24rpx;
}
.aa-chip {
  padding: 14rpx 20rpx;
  border-radius: 999rpx;
  background: #F2F3F5;
  color: #4E5969;
  font-size: 24rpx;
  line-height: 1.2;
  &.active {
    background: #E6F4FF;
    color: #1677FF;
    border: 1rpx solid #91CAFF;
  }
}
.aa-chip-ai.active {
  background: #F4EAFF;
  color: #722ED1;
  border: 1rpx solid #D3ADF7;
}

.aa-history-list { padding: 0 24rpx; max-height: 60vh; }
.aa-history-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F2F3F5;
  &:last-child { border-bottom: none; }
}
</style>
