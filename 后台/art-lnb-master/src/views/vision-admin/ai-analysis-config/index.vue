<template>
  <div class="ai-config-page art-full-height">
    <!-- ===== Hero：模式切换 ===== -->
    <ElCard class="hero-card" shadow="never" body-style="padding: 0;">
      <div class="hero-grid">
        <div class="hero-mode" :class="{ 'is-ai': config?.mode === 'ai' }">
          <div class="hero-label">当前工作模式</div>
          <div class="hero-mode-value">
            {{ config?.mode === 'ai' ? 'AI 模式' : '人工模式' }}
          </div>
          <div class="hero-mode-hint">
            {{ config?.mode === 'ai'
              ? 'GPT 自动生成档案分析；员工在 AI 报告基础上修订并反馈'
              : '只展示员工写的人工分析；不调用 AI' }}
          </div>
          <ElSwitch
            v-model="modeIsAi"
            :loading="modeSaving"
            active-text="AI"
            inactive-text="人工"
            inline-prompt
            class="hero-switch"
            @change="onToggleMode"
          />
          <div v-if="bulkState && bulkState.running" class="bulk-tip">
            <span>批量生成中：{{ bulkState.done }} / {{ bulkState.total }} (成功 {{ bulkState.ok }} · 失败 {{ bulkState.failed }})</span>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-cell">
            <div class="stat-num">{{ stats?.analyses.human_active ?? '—' }}</div>
            <div class="stat-label">人工分析（生效）</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">{{ stats?.analyses.ai_active ?? '—' }}</div>
            <div class="stat-label">AI 分析（生效）</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">{{ stats?.analyses.children_with_analysis ?? '—' }}</div>
            <div class="stat-label">已建档孩子</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">{{ stats?.corrections.total ?? '—' }}</div>
            <div class="stat-label">修订反馈累计</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">{{ formatTokens(stats?.analyses.tokens_total) }}</div>
            <div class="stat-label">AI 累计 token</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">
              {{ stats?.style_pack.active_version != null ? 'v' + stats.style_pack.active_version : '—' }}
            </div>
            <div class="stat-label">风格包版本</div>
          </div>
        </div>
      </div>
      <div class="hero-recent">
        <span>近 7 天：</span>
        <ElTag size="small" effect="plain">AI {{ stats?.recent_7d.ai_count ?? 0 }} 条</ElTag>
        <ElTag size="small" effect="plain" type="success">人工 {{ stats?.recent_7d.human_count ?? 0 }} 条</ElTag>
        <ElTag size="small" effect="plain" type="info">token {{ formatTokens(stats?.recent_7d.tokens_used) }}</ElTag>
        <ElButton link size="small" @click="loadAll" :loading="loading">刷新数据</ElButton>
      </div>
    </ElCard>

    <!-- ===== 分页 Tab ===== -->
    <ElCard class="tabs-card" shadow="never">
      <ElTabs v-model="activeTab" class="config-tabs">
        <!-- ===== Tab 1: 基础配置 ===== -->
        <ElTabPane label="基础配置" name="basic">
          <ElForm v-if="config" label-width="140px" style="max-width: 720px;">
            <ElFormItem label="使用模型">
              <ElSelect
                v-model="config.model"
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入模型名"
                style="width: 360px;"
              >
                <ElOption
                  v-for="m in modelOptions"
                  :key="m.value"
                  :value="m.value"
                  :label="m.value"
                >
                  <span>{{ m.value }}</span>
                  <span v-if="m.tag" class="model-tag" :class="`tag-${m.tag.color}`">{{ m.tag.label }}</span>
                </ElOption>
              </ElSelect>
              <div class="form-hint">
                网关：aizhiwen.top；不在列表里的可直接输入名字回车
              </div>
            </ElFormItem>

            <ElFormItem label="few-shot 范例数">
              <ElInputNumber v-model="config.few_shot_count" :min="0" :max="20" />
              <div class="form-hint">
                没有风格包时，每次调 GPT 取最近 N 条人工分析作为风格示例。0 = 自由生成
              </div>
            </ElFormItem>

            <ElFormItem label="AI 缓存时长">
              <ElInputNumber v-model="config.stale_hours" :min="1" :max="720" />
              <span style="margin-left: 8px; color: #606266;">小时</span>
              <div class="form-hint">
                同一孩子的 AI 报告在缓存期内不重复调用；档案数据更新后会强制重新生成
              </div>
            </ElFormItem>

            <ElFormItem>
              <ElButton type="primary" :loading="saving" @click="onSave">保存基础配置</ElButton>
              <ElButton :disabled="saving" @click="onReset">重置默认</ElButton>
            </ElFormItem>

            <ElFormItem label="批量生成" v-if="config?.mode === 'ai'">
              <ElButton
                type="warning"
                :loading="bulkLoading"
                :disabled="bulkState?.running"
                @click="onBulkGenerate"
              >
                {{ bulkState?.running ? `运行中 (${bulkState.done}/${bulkState.total})` : '为所有未分析孩子生成' }}
              </ElButton>
              <div style="color:#909399; font-size:12px; margin-top:6px;">
                扫描所有未生成 active 分析的孩子，限速依次调 GPT 生成。开 AI 模式时已自动触发一次；可随时再点。
              </div>
              <div v-if="bulkState?.finishedAt && !bulkState.running" style="margin-top: 8px; font-size: 12px; color: #4E5969;">
                上次完成：成功 {{ bulkState.ok }} · 失败 {{ bulkState.failed }} ·
                <span v-if="bulkState.failed">失败示例：</span>
                <span v-if="bulkState.errors?.length">{{ bulkState.errors[0].message }}</span>
              </div>
            </ElFormItem>
          </ElForm>
        </ElTabPane>

        <!-- ===== Tab 2: 系统 Prompt ===== -->
        <ElTabPane label="系统 Prompt" name="prompt">
          <div class="prompt-toolbar">
            <ElTag size="small" type="info">
              当前 {{ (config?.system_prompt || '').length }} / 4000 字
            </ElTag>
            <div class="prompt-actions">
              <ElButton size="small" @click="onLoadDefaultPrompt">载入默认</ElButton>
              <ElButton size="small" @click="onCopyPrompt">复制</ElButton>
              <ElButton type="primary" size="small" :loading="saving" @click="onSave">保存</ElButton>
            </div>
          </div>
          <ElInput
            v-if="config"
            v-model="config.system_prompt"
            type="textarea"
            :rows="16"
            resize="vertical"
            placeholder="决定 AI 的角色、输出格式、字数。每次生成都会拼上 few-shot 范例（或风格包）。"
            class="prompt-textarea"
            maxlength="4000"
            show-word-limit
          />
          <ElAlert
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 12px;"
            title="可用变量提示"
          >
            <template #default>
              在 prompt 里用自然语言描述即可，无需占位符。系统会自动把孩子档案的视力、屈光、TCM、风险等字段以 JSON 格式拼接到 user message 里。
            </template>
          </ElAlert>
        </ElTabPane>

        <!-- ===== Tab 3: 风格包 ===== -->
        <ElTabPane :label="stylePackTabLabel" name="pack">
          <ElAlert
            type="info"
            :closable="false"
            show-icon
            :title="alertTitle"
            style="margin-bottom: 16px;"
          />

          <div class="pack-actions">
            <ElButton size="small" @click="loadStylePack" :loading="packLoading">刷新</ElButton>
            <ElButton
              size="small"
              type="primary"
              :loading="regenerating"
              :disabled="regenerating || packLoading"
              @click="onRegeneratePack"
            >立即重新提炼</ElButton>
          </div>

          <div v-if="!activePack" class="empty-pack">
            <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
            <div>当前没有风格包</div>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              人工分析累计 ≥ 3 条后，写入新人工分析会自动触发蒸馏（防抖 1 分钟）
            </div>
          </div>

          <div v-else>
            <div class="pack-card">
              <div class="pack-header">
                <ElTag type="success" size="small">v{{ activePack.version }} 生效中</ElTag>
                <span class="pack-meta">基于 {{ activePack.based_on_count }} 条人工分析</span>
                <span class="pack-meta">{{ activePack.created_at }}</span>
                <span class="pack-meta" v-if="activePack.tokens_used">耗 {{ activePack.tokens_used }} tokens</span>
                <span class="pack-meta">模型：{{ activePack.model || '-' }}</span>
              </div>
              <div class="pack-content">{{ activePack.content }}</div>
            </div>
          </div>

          <div v-if="history.length > 0" class="pack-history">
            <div class="pack-history-title">历史版本（最多 20 条）</div>
            <ElTable :data="history" size="small" border>
              <ElTableColumn prop="version" label="版本" width="90">
                <template #default="{ row }">
                  <ElTag :type="row.active ? 'success' : 'info'" size="small">v{{ row.version }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="based_on_count" label="基于人工分析" width="120" align="center" />
              <ElTableColumn prop="model" label="模型" width="180" />
              <ElTableColumn prop="tokens_used" label="token" width="90" align="right" />
              <ElTableColumn prop="created_at" label="创建时间" width="170" />
              <ElTableColumn label="状态" width="90">
                <template #default="{ row }">
                  <ElTag :type="row.active ? 'success' : 'info'" size="small">
                    {{ row.active ? '生效' : '已废弃' }}
                  </ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn label="" min-width="60">
                <template #default="{ row }">
                  <ElButton link size="small" @click="onViewPack(row)">查看内容</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- ===== 历史风格包内容查看 dialog ===== -->
    <ElDialog
      v-model="dialogVisible"
      :title="dialogPack ? `风格包 v${dialogPack.version}` : '风格包'"
      width="720px"
    >
      <div v-if="dialogPack" class="pack-meta-line">
        <span>基于 {{ dialogPack.based_on_count }} 条 · {{ dialogPack.model || '-' }} · {{ dialogPack.created_at }}</span>
      </div>
      <div v-if="dialogPack" class="pack-content" style="max-height: 480px;">
        {{ dialogPack.content }}
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import {
  adminGetAiAnalysisConfig,
  adminSetAiAnalysisConfig,
  adminGetAiStylePack,
  adminRegenerateAiStylePack,
  adminGetAiAnalysisOverview,
  adminBulkGenerateAiAnalyses,
  adminGetAiBulkStatus,
  type AiAnalysisConfig,
  type AiStylePack,
  type AiAnalysisOverview,
  type AiBulkState
} from '@/api/vision-admin'
import {
  ElCard,
  ElAlert,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElButton,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTabs,
  ElTabPane,
  ElSwitch,
  ElDialog
} from 'element-plus'

defineOptions({ name: 'VisionAdminAiAnalysisConfig' })

const DEFAULT_PROMPT = '你是一名儿童视力健康顾问。请根据下方孩子档案数据，写一段 200-400 字的中文分析报告，重点关注视力变化、屈光、中医证型、风险等级，给出 3-5 条具体建议。语气专业而温和，避免使用 markdown 标题，分段自然。'

const modelOptions: { value: string; tag?: { label: string; color: 'green' | 'blue' | 'gray' } }[] = [
  { value: 'gpt-5.5', tag: { label: '最新', color: 'green' } },
  { value: 'gpt-5.4', tag: { label: '推荐', color: 'blue' } },
  { value: 'gpt-5.4-mini', tag: { label: '便宜', color: 'gray' } },
  { value: 'gpt-5.3-codex', tag: { label: '代码', color: 'gray' } },
  { value: 'gpt-5.2' }
]

const loading = ref(false)
const saving = ref(false)
const modeSaving = ref(false)
const config = ref<AiAnalysisConfig | null>(null)
const stats = ref<AiAnalysisOverview | null>(null)
const activeTab = ref('basic')

const modeIsAi = ref(false)
watch(() => config.value?.mode, (v) => { modeIsAi.value = v === 'ai' })

const stylePackTabLabel = computed(() => {
  const v = stats.value?.style_pack.active_version
  return v != null ? `风格包 (v${v})` : '风格包'
})

function formatTokens(n: number | null | undefined) {
  if (n == null) return '—'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k'
  return (n / 1_000_000).toFixed(2) + 'M'
}

async function loadConfig() {
  loading.value = true
  try {
    const r: any = await adminGetAiAnalysisConfig()
    config.value = (r?.config || r?.data?.config) as AiAnalysisConfig
    modeIsAi.value = config.value?.mode === 'ai'
  } catch (e: any) {
    ElMessage.error(e?.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const r: any = await adminGetAiAnalysisOverview()
    stats.value = (r?.stats || r?.data?.stats) as AiAnalysisOverview
  } catch (e: any) {
    // 静默：仪表板加载失败不卡主流程
    console.warn('overview load failed', e?.message)
  }
}

async function loadAll() {
  await Promise.all([loadConfig(), loadStats(), loadStylePack(), loadBulkStatus()])
}

// ===== 批量生成 =====
const bulkLoading = ref(false)
const bulkState = ref<AiBulkState | null>(null)
let bulkTimer: any = null

async function loadBulkStatus() {
  try {
    const r: any = await adminGetAiBulkStatus()
    bulkState.value = (r?.state || r?.data?.state) as AiBulkState
  } catch { /* 静默 */ }
}

function startBulkPolling() {
  if (bulkTimer) return
  bulkTimer = setInterval(async () => {
    await loadBulkStatus()
    if (!bulkState.value?.running && bulkTimer) {
      clearInterval(bulkTimer)
      bulkTimer = null
      // 跑完顺手刷新 stats
      loadStats()
    }
  }, 2000)
}

async function onBulkGenerate() {
  if (bulkLoading.value || bulkState.value?.running) return
  try {
    await ElMessageBox.confirm(
      '将为所有"既无人工分析也无 AI 分析"的孩子调用 GPT 批量生成（每个间隔 1.5s 限速）。确认继续？',
      '批量生成',
      { type: 'warning' }
    )
  } catch { return }
  bulkLoading.value = true
  try {
    const r: any = await adminBulkGenerateAiAnalyses({})
    const status = r?.status || r?.data?.status
    const total = r?.total ?? r?.data?.total ?? 0
    if (status === 'started') {
      ElMessage.success(`已启动批量生成 ${total} 个孩子`)
      await loadBulkStatus()
      startBulkPolling()
    } else if (status === 'already_running') {
      ElMessage.warning('已有批量任务在运行')
      await loadBulkStatus()
      startBulkPolling()
    } else if (status === 'ai_not_configured') {
      ElMessage.error('AI 服务未配置，请先在 .env 配置 AI_API_BASE / AI_API_KEY')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '启动失败')
  } finally {
    bulkLoading.value = false
  }
}

async function persistConfig(silent = false): Promise<void> {
  if (!config.value) return
  const r: any = await adminSetAiAnalysisConfig({ ...config.value })
  config.value = (r?.config || r?.data?.config) as AiAnalysisConfig
  modeIsAi.value = config.value?.mode === 'ai'
  if (!silent) ElMessage.success('已保存')
}

async function onSave() {
  if (!config.value || saving.value) return
  saving.value = true
  try { await persistConfig() }
  catch (e: any) { ElMessage.error(e?.message || '保存失败') }
  finally { saving.value = false }
}

async function onToggleMode(val: boolean | string | number) {
  if (!config.value || modeSaving.value) return
  const next = val === true || val === 'true'
  const wasAi = config.value.mode === 'ai'

  // 切到 AI 模式时弹确认（会触发批量调 GPT，烧 token）
  if (!wasAi && next) {
    try {
      await ElMessageBox.confirm(
        '切换到 AI 模式后，系统会自动为所有未生成分析的孩子调 GPT 批量生成（每个 ~$0.02），最多 5000 个；并且员工首次打开档案也会自动触发生成（受每日 token 配额限制）。确定吗？',
        '切换到 AI 模式',
        {
          type: 'warning',
          confirmButtonText: '确定切换并开始批量生成',
          cancelButtonText: '取消'
        }
      )
    } catch {
      // 用户取消 → 还原开关
      modeIsAi.value = false
      return
    }
  }

  config.value.mode = next ? 'ai' : 'human'
  modeSaving.value = true
  try {
    await persistConfig(true)
    ElMessage.success(`已切换到${next ? ' AI ' : '人工'}模式`)
    if (!wasAi && next) {
      setTimeout(async () => {
        await loadBulkStatus()
        if (bulkState.value?.running) startBulkPolling()
      }, 500)
    }
  } catch (e: any) {
    config.value.mode = next ? 'human' : 'ai'
    modeIsAi.value = !next
    ElMessage.error(e?.message || '切换失败')
  } finally {
    modeSaving.value = false
  }
}

async function onReset() {
  try {
    await ElMessageBox.confirm(
      '将恢复模型 = gpt-5.4、few-shot=5、缓存=24h、system_prompt=默认；当前模式不会改。确定？',
      '重置默认',
      { type: 'warning' }
    )
  } catch { return }
  if (!config.value) return
  config.value.model = 'gpt-5.4'
  config.value.few_shot_count = 5
  config.value.system_prompt = DEFAULT_PROMPT
  config.value.stale_hours = 24
  await onSave()
}

function onLoadDefaultPrompt() {
  if (!config.value) return
  config.value.system_prompt = DEFAULT_PROMPT
  ElMessage.info('已载入默认（未保存，记得点保存）')
}

async function onCopyPrompt() {
  if (!config.value?.system_prompt) return
  try {
    await navigator.clipboard.writeText(config.value.system_prompt)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  }
}

// ===== AI 风格包 =====
const packLoading = ref(false)
const regenerating = ref(false)
const activePack = ref<AiStylePack | null>(null)
const history = ref<AiStylePack[]>([])
const dialogVisible = ref(false)
const dialogPack = ref<AiStylePack | null>(null)

const alertTitle = computed(() => {
  if (!activePack.value) return '人工分析 ≥ 3 条后开始蒸馏；新写入会自动触发增量提炼（防抖 1 分钟）。AI 生成时优先使用风格包。'
  return `当前 v${activePack.value.version} 已基于 ${activePack.value.based_on_count} 条人工分析蒸馏。新增人工分析会触发自动重新提炼。`
})

async function loadStylePack() {
  packLoading.value = true
  try {
    const r: any = await adminGetAiStylePack()
    activePack.value = (r?.active || r?.data?.active) as AiStylePack | null
    history.value = ((r?.history || r?.data?.history) || []) as AiStylePack[]
  } catch (e: any) {
    ElMessage.error(e?.message || '加载风格包失败')
  } finally {
    packLoading.value = false
  }
}

async function onRegeneratePack() {
  if (regenerating.value) return
  try {
    await ElMessageBox.confirm(
      '将基于全部 active 人工分析（最多 50 条）调用一次 GPT 蒸馏新风格包，会消耗 token。确认继续？',
      '重新提炼风格包',
      { type: 'warning' }
    )
  } catch { return }
  regenerating.value = true
  try {
    const r: any = await adminRegenerateAiStylePack({})
    const pack = (r?.pack || r?.data?.pack) as AiStylePack
    ElMessage.success(`已蒸馏 v${pack.version}（基于 ${pack.based_on_count} 条）`)
    await Promise.all([loadStylePack(), loadStats()])
  } catch (e: any) {
    ElMessage.error(e?.message || '提炼失败')
  } finally {
    regenerating.value = false
  }
}

function onViewPack(p: AiStylePack) {
  dialogPack.value = p
  dialogVisible.value = true
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped lang="scss">
.ai-config-page {
  padding: 16px;
}

.hero-card {
  margin-bottom: 16px;
  border: 1px solid #e4e7ed;
}

.hero-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 0;
  min-height: 180px;
}

.hero-mode {
  padding: 24px;
  background: linear-gradient(135deg, #f0f2f5 0%, #f7f8fa 100%);
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  &.is-ai {
    background: linear-gradient(135deg, #f3eaff 0%, #ede2ff 100%);
  }
}
.hero-label {
  font-size: 12px;
  color: #86909c;
  letter-spacing: 1px;
}
.hero-mode-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2329;
  margin-top: 8px;
}
.is-ai .hero-mode-value { color: #722ED1; }
.hero-mode-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
  max-width: 320px;
}
.hero-switch { margin-top: 16px; }

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: #ebeef5;
}
.stat-cell {
  background: #fff;
  padding: 18px 16px;
  text-align: center;
}
.stat-num {
  font-size: 22px;
  font-weight: 600;
  color: #1f2329;
  line-height: 1.2;
}
.stat-label {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}

.hero-recent {
  padding: 10px 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fafbfc;
  font-size: 13px;
  color: #4e5969;
}

.bulk-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #722ED1;
  background: rgba(114, 46, 209, 0.08);
  padding: 6px 12px;
  border-radius: 6px;
  display: inline-block;
}

.tabs-card {
  border: 1px solid #e4e7ed;
}

.config-tabs :deep(.el-tabs__nav-wrap)::after { display: none; }

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.model-tag {
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  &.tag-green { background: #e6f7ed; color: #00b42a; }
  &.tag-blue { background: #e8f3ff; color: #1677FF; }
  &.tag-gray { background: #f2f3f5; color: #86909c; }
}

.prompt-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.prompt-actions { display: flex; gap: 8px; }
.prompt-textarea :deep(textarea) {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}

.pack-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.empty-pack {
  padding: 60px 24px;
  text-align: center;
  background: #fafbfc;
  border-radius: 8px;
  color: #4e5969;
  font-size: 14px;
}

.pack-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.pack-header {
  padding: 12px 16px;
  background: #f0f9ff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.pack-meta { font-size: 12px; color: #4e5969; }

.pack-content {
  padding: 16px;
  background: #fff;
  font-size: 13px;
  line-height: 1.8;
  color: #1f2329;
  white-space: pre-wrap;
  max-height: 360px;
  overflow-y: auto;
}

.pack-history {
  margin-top: 24px;
}
.pack-history-title {
  font-size: 14px;
  color: #4e5969;
  margin-bottom: 8px;
  font-weight: 500;
}

.pack-meta-line {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 12px;
}
</style>
