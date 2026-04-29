<template>
  <div class="ai-config-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:16px; font-weight:600;">AI 分析配置</div>
          <ElButton size="small" @click="loadConfig" :loading="loading">刷新</ElButton>
        </div>
      </template>

      <ElAlert
        type="info"
        :closable="false"
        show-icon
        title="切换『模式』决定家长小程序 / 员工 APP / 后台展示哪种分析。AI 模式下系统会按『模仿历史人工分析』风格调用 GPT 自动生成。"
        style="margin-bottom: 16px;"
      />

      <ElForm v-if="config" label-width="160px" style="max-width: 800px;">
        <ElFormItem label="工作模式">
          <ElRadioGroup v-model="config.mode">
            <ElRadioButton value="human">人工模式（只展示人工写的分析）</ElRadioButton>
            <ElRadioButton value="ai">AI 模式（GPT 自动生成，模仿历史人工风格）</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>

        <ElFormItem label="使用模型">
          <ElInput v-model="config.model" placeholder="如 gpt-4o-mini" style="max-width: 320px;" />
          <div style="color:#909399; font-size:12px; margin-top:4px;">
            模型由 aizhiwen.top 网关支持的模型决定，可填 gpt-4o-mini / gpt-4o / claude-3-haiku 等
          </div>
        </ElFormItem>

        <ElFormItem label="few-shot 样本数">
          <ElInputNumber v-model="config.few_shot_count" :min="0" :max="20" />
          <div style="color:#909399; font-size:12px; margin-top:4px;">
            每次调 GPT 时取最近 N 条人工分析作为风格范例，0 表示不模仿（自由生成）
          </div>
        </ElFormItem>

        <ElFormItem label="AI 缓存时长">
          <ElInputNumber v-model="config.stale_hours" :min="1" :max="720" /> 小时
          <div style="color:#909399; font-size:12px; margin-top:4px;">
            同一孩子的 AI 分析在缓存期内不会重复调用，节省 token；超时后下次访问自动重新生成
          </div>
        </ElFormItem>

        <ElFormItem label="系统 Prompt 模板">
          <ElInput v-model="config.system_prompt" type="textarea" :rows="8" />
          <div style="color:#909399; font-size:12px; margin-top:4px;">
            决定 GPT 的角色 + 输出风格 + 字数。每次调用都会拼上 few-shot 范例。
          </div>
        </ElFormItem>

        <ElFormItem>
          <ElButton
            type="primary"
            :loading="saving"
            :disabled="saving || loading"
            @click="onSave"
          >保存</ElButton>
          <ElButton
            :disabled="saving || loading"
            @click="onReset"
          >重置默认</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- AI 风格包（蒸馏后的人工分析知识库）-->
    <ElCard class="art-table-card" shadow="never" style="margin-top: 16px;">
      <template #header>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:16px; font-weight:600;">AI 风格包（持续学习人工分析）</div>
          <div>
            <ElButton size="small" @click="loadStylePack" :loading="packLoading">刷新</ElButton>
            <ElButton
              size="small"
              type="primary"
              :loading="regenerating"
              :disabled="regenerating || packLoading"
              @click="onRegeneratePack"
            >立即重新提炼</ElButton>
          </div>
        </div>
      </template>

      <ElAlert
        type="info"
        :closable="false"
        show-icon
        :title="alertTitle"
        style="margin-bottom: 16px;"
      />

      <div v-if="!activePack" class="empty-pack">
        当前无风格包。人工分析累计 ≥ 3 条后，写新人工分析会自动触发蒸馏；也可点上方"立即重新提炼"。
      </div>

      <div v-else>
        <div class="pack-meta">
          <span><b>当前版本：</b>v{{ activePack.version }}</span>
          <span><b>基于：</b>{{ activePack.based_on_count }} 条人工分析</span>
          <span><b>更新时间：</b>{{ activePack.created_at }}</span>
          <span v-if="activePack.tokens_used"><b>消耗 token：</b>{{ activePack.tokens_used }}</span>
          <span><b>模型：</b>{{ activePack.model || '-' }}</span>
        </div>
        <div class="pack-content-label">蒸馏出的风格指南：</div>
        <div class="pack-content">{{ activePack.content }}</div>
      </div>

      <div v-if="history.length > 0" style="margin-top: 16px;">
        <div style="font-size:14px;color:#606266;margin-bottom:8px;">历史版本（最多保留 20 条）</div>
        <ElTable :data="history" size="small" border>
          <ElTableColumn prop="version" label="版本" width="80">
            <template #default="{ row }">
              <ElTag :type="row.active ? 'success' : 'info'" size="small">v{{ row.version }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="based_on_count" label="基于条数" width="100" />
          <ElTableColumn prop="model" label="模型" width="160" />
          <ElTableColumn prop="tokens_used" label="token" width="100" />
          <ElTableColumn prop="created_at" label="创建时间" width="170" />
          <ElTableColumn label="状态" width="80">
            <template #default="{ row }">
              <ElTag :type="row.active ? 'success' : 'info'" size="small">
                {{ row.active ? '生效' : '已废弃' }}
              </ElTag>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { computed } from 'vue'
  import {
    adminGetAiAnalysisConfig,
    adminSetAiAnalysisConfig,
    adminGetAiStylePack,
    adminRegenerateAiStylePack,
    type AiAnalysisConfig,
    type AiStylePack
  } from '@/api/vision-admin'
  import {
    ElCard,
    ElAlert,
    ElForm,
    ElFormItem,
    ElInput,
    ElInputNumber,
    ElRadioGroup,
    ElRadioButton,
    ElButton,
    ElMessage,
    ElMessageBox,
    ElTable,
    ElTableColumn,
    ElTag
  } from 'element-plus'

  defineOptions({ name: 'VisionAdminAiAnalysisConfig' })


  const loading = ref(false)
  const saving = ref(false)
  const config = ref<AiAnalysisConfig | null>(null)

  async function loadConfig() {
    loading.value = true
    try {
      const r: any = await adminGetAiAnalysisConfig()
      config.value = (r?.config || r?.data?.config) as AiAnalysisConfig
    } catch (e: any) {
      ElMessage.error(e?.message || '加载失败')
    } finally {
      loading.value = false
    }
  }

  async function onSave() {
    if (!config.value) return
    if (saving.value) return  // 防双击 / 重复触发
    saving.value = true
    try {
      const r: any = await adminSetAiAnalysisConfig({ ...config.value })
      config.value = (r?.config || r?.data?.config) as AiAnalysisConfig
      ElMessage.success('已保存')
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      saving.value = false
    }
  }

  async function onReset() {
    try {
      await ElMessageBox.confirm('确定恢复默认配置？将重置 prompt 与样本数。', '重置默认', { type: 'warning' })
    } catch { return }
    if (!config.value) return
    config.value.mode = 'human'
    config.value.model = 'gpt-4o-mini'
    config.value.few_shot_count = 5
    config.value.system_prompt = '你是一名儿童视力健康顾问。请根据下方孩子档案数据，写一段 200-400 字的中文分析报告，重点关注视力变化、屈光、中医证型、风险等级，给出 3-5 条具体建议。语气专业而温和，避免使用 markdown 标题，分段自然。'
    config.value.stale_hours = 24
    onSave()
  }

  // ===== AI 风格包 =====
  const packLoading = ref(false)
  const regenerating = ref(false)
  const activePack = ref<AiStylePack | null>(null)
  const history = ref<AiStylePack[]>([])

  const alertTitle = computed(() => {
    if (!activePack.value) return '风格包说明：人工分析≥3 条后开始蒸馏；新写一条人工分析会自动触发增量提炼（防抖 1 分钟）。AI 生成时优先使用风格包。'
    return `当前 v${activePack.value.version} 已基于 ${activePack.value.based_on_count} 条人工分析蒸馏；新增人工分析会自动触发新版本提炼。`
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
      await loadStylePack()
    } catch (e: any) {
      ElMessage.error(e?.message || '提炼失败')
    } finally {
      regenerating.value = false
    }
  }

  onMounted(() => {
    loadConfig()
    loadStylePack()
  })
</script>

<style scoped>
.empty-pack {
  padding: 24px;
  background: #FAFBFC;
  border-radius: 8px;
  color: #909399;
  text-align: center;
  font-size: 14px;
}
.pack-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 16px;
  background: #F0F9FF;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #4E5969;
}
.pack-meta b { color: #1F2329; margin-right: 4px; }
.pack-content-label {
  font-size: 14px;
  color: #606266;
  margin: 12px 0 8px;
}
.pack-content {
  background: #FAFBFC;
  border-left: 3px solid #1677FF;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.7;
  color: #1F2329;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
}
</style>
