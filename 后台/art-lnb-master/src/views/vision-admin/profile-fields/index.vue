<template>
  <div class="pf-page">
    <!-- ====== 左侧：配置编辑区 ====== -->
    <div class="pf-editor" v-loading="loading">
      <div class="pf-editor-header">
        <div>
          <div class="pf-editor-title">档案字段配置</div>
          <div class="pf-editor-desc">配置小程序「孩子档案」页中的字段分区、字段类型与选项，右侧可实时预览效果</div>
        </div>
        <div class="pf-editor-actions">
          <ElButton @click="showPreview = !showPreview" v-ripple>
            {{ showPreview ? '隐藏预览' : '显示预览' }}
          </ElButton>
          <ElButton @click="addSection" v-ripple>新增分区</ElButton>
          <ElButton @click="reload" :loading="loading" v-ripple>刷新</ElButton>
          <ElButton type="primary" @click="save" :loading="saving" v-ripple>保存</ElButton>
        </div>
      </div>

      <div class="pf-editor-body">
        <div
          v-for="(section, si) in sections"
          :key="section.key"
          class="ed-section"
          :class="{ 'ed-section--disabled': !section.enabled }"
        >
          <div class="ed-section-bar" :style="{ borderLeftColor: sectionColors[si % sectionColors.length] }">
            <div class="ed-section-left">
              <ElSwitch v-model="section.enabled" size="small" />
              <ElInput v-model="section.label" size="small" class="ed-section-name" placeholder="分区名称" />
              <ElTag size="small" :type="section.enabled ? 'success' : 'info'" effect="light">
                {{ section.enabled ? '启用' : '停用' }}
              </ElTag>
            </div>
            <div class="ed-section-right">
              <ElButtonGroup size="small">
                <ElButton :icon="ArrowUp" :disabled="si === 0" @click="moveSection(si, -1)" />
                <ElButton :icon="ArrowDown" :disabled="si === sections.length - 1" @click="moveSection(si, 1)" />
              </ElButtonGroup>
              <ElPopconfirm title="确定删除该分区及其所有字段？" @confirm="deleteSection(si)">
                <template #reference>
                  <ElButton size="small" type="danger" text>删除分区</ElButton>
                </template>
              </ElPopconfirm>
            </div>
          </div>

          <template v-if="section.enabled">
            <div v-if="section.fields.length === 0" class="ed-empty-fields">
              暂无字段，点击下方按钮添加
            </div>
            <div v-for="(field, fi) in section.fields" :key="field.key" class="ed-field">
              <div class="ed-field-row">
                <div class="ed-field-sort">
                  <ElButton link size="small" :icon="ArrowUp" :disabled="fi === 0" @click="moveField(section, fi, -1)" />
                  <ElButton link size="small" :icon="ArrowDown" :disabled="fi === section.fields.length - 1" @click="moveField(section, fi, 1)" />
                </div>
                <div class="ed-field-name">
                  <ElInput v-model="field.label" size="small" placeholder="字段名称" />
                  <span class="ed-field-key">{{ field.key }}</span>
                </div>
                <div class="ed-field-type">
                  <ElSelect v-model="field.type" size="small" @change="onTypeChange(field)">
                    <ElOption v-for="t in fieldTypeOptions" :key="t.value" :label="t.label" :value="t.value">
                      <span>{{ t.icon }} {{ t.label }}</span>
                    </ElOption>
                  </ElSelect>
                </div>
                <div class="ed-field-ph">
                  <ElInput v-model="field.placeholder" size="small" placeholder="占位文字" :disabled="field.type === 'readonly'" />
                </div>
                <div class="ed-field-toggles">
                  <ElTooltip content="启用" placement="top">
                    <ElSwitch v-model="field.enabled" size="small" />
                  </ElTooltip>
                  <ElTooltip content="必填" placement="top">
                    <ElSwitch v-model="field.required" size="small" :disabled="!field.enabled || field.readonly" active-color="#ff4d4f" />
                  </ElTooltip>
                </div>
                <ElPopconfirm title="删除该字段？" @confirm="deleteField(section, fi)">
                  <template #reference>
                    <ElButton size="small" type="danger" link>删除</ElButton>
                  </template>
                </ElPopconfirm>
              </div>

              <div v-if="field.type === 'select' || field.type === 'multi_select'" class="ed-field-options">
                <span class="ed-options-label">选项列表：</span>
                <ElTag
                  v-for="(opt, oi) in field.options"
                  :key="oi"
                  closable
                  size="small"
                  round
                  class="ed-opt-tag"
                  @close="removeOption(field, oi)"
                >{{ opt }}</ElTag>
                <div class="ed-opt-add">
                  <ElInput
                    v-model="optionInputs[field.key]"
                    size="small"
                    placeholder="新选项，回车添加"
                    @keyup.enter="addOption(field)"
                    class="ed-opt-input"
                  />
                  <ElButton size="small" type="primary" plain @click="addOption(field)">添加</ElButton>
                </div>
              </div>
            </div>

            <div class="ed-add-field">
              <ElButton size="small" type="primary" plain @click="addField(section)" v-ripple>+ 新增字段</ElButton>
            </div>
          </template>
        </div>

        <div v-if="!sections.length && !loading" class="ed-empty">
          <div class="ed-empty-icon">📋</div>
          <div class="ed-empty-text">暂无配置数据</div>
          <div class="ed-empty-hint">点击上方「新增分区」开始配置</div>
        </div>
      </div>
    </div>

    <!-- ====== 右侧：手机预览 ====== -->
    <div v-if="showPreview" class="pf-preview-wrap">
      <div class="pf-preview-label">小程序实时预览</div>
      <div class="pf-phone">
        <div class="pf-phone-notch"></div>
        <div class="pf-phone-statusbar">
          <span>9:41</span>
          <span class="pf-phone-statusbar-icons">
            <svg width="16" height="10" viewBox="0 0 16 10"><path d="M1 6h2v4H1zM5 4h2v6H5zM9 2h2v8H9zM13 0h2v10h-2z" fill="currentColor"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 3a5.5 5.5 0 0 1 3.9 1.6l1-1A7 7 0 0 0 7 1a7 7 0 0 0-4.9 2l1 1A5.5 5.5 0 0 1 7 3zm0 3c.8 0 1.6.3 2.1.9l1-1a4.2 4.2 0 0 0-6.2 0l1 1c.5-.6 1.3-.9 2.1-.9zM6 9a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" fill="currentColor"/></svg>
            <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0" y="1" width="18" height="8" rx="1.5" stroke="currentColor" fill="none" stroke-width="1"/><rect x="2" y="3" width="13" height="4" rx="0.5" fill="currentColor"/><rect x="19" y="3.5" width="2" height="3" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>
        <div class="pf-phone-navbar">
          <span class="pf-phone-navbar-back">&lt;</span>
          <span>个人档案</span>
          <span></span>
        </div>
        <div class="pf-phone-body">
          <!-- Hero -->
          <div class="mp-hero">
            <div class="mp-hero-top">
              <div class="mp-hero-title">青少年健康档案</div>
              <div class="mp-hero-sub">"近视防控光明行动"</div>
            </div>
            <div class="mp-hero-card">
              <div class="mp-hero-left">
                <div class="mp-hero-name">张小明</div>
                <div class="mp-hero-meta">年龄：8岁</div>
              </div>
              <div class="mp-hero-right">
                <div class="mp-hero-status">可提交</div>
              </div>
            </div>
          </div>

          <!-- 基础信息（固定展示，可折叠） -->
          <div class="mp-card">
            <div class="mp-card-header" @click="previewOpen.basic = !previewOpen.basic">
              <span class="mp-card-title">一、基础信息</span>
              <span class="mp-card-arrow" :class="{ open: previewOpen.basic }">▸</span>
            </div>
            <div class="mp-card-body" :class="previewOpen.basic ? 'show' : 'hide'">
              <!-- 姓名 -->
              <div class="mp-ui-field">
                <div class="mp-label-row"><span class="mp-label">姓名</span><span class="mp-required">*</span></div>
                <div class="mp-control"><div class="mp-control-input">张小明</div></div>
              </div>
              <!-- 性别 -->
              <div class="mp-ui-field">
                <div class="mp-label-row"><span class="mp-label">性别</span><span class="mp-required">*</span></div>
                <div class="mp-control mp-control-radio">
                  <span class="mp-radio-item on">● 男</span>
                  <span class="mp-radio-item">○ 女</span>
                </div>
              </div>
              <!-- 出生日期 -->
              <div class="mp-ui-field">
                <div class="mp-label-row"><span class="mp-label">出生日期</span><span class="mp-required">*</span></div>
                <div class="mp-control mp-control-picker"><span class="mp-picker-text">2018-03-15</span><span class="mp-picker-arr">&gt;</span></div>
              </div>
              <!-- 学校 + 班级 -->
              <div class="mp-row-2">
                <div class="mp-col">
                  <div class="mp-ui-field">
                    <div class="mp-label-row"><span class="mp-label">学校</span><span class="mp-required">*</span></div>
                    <div class="mp-control mp-control-picker"><span class="mp-picker-text">光明小学</span><span class="mp-picker-arr">&gt;</span></div>
                  </div>
                </div>
                <div class="mp-col">
                  <div class="mp-ui-field">
                    <div class="mp-label-row"><span class="mp-label">班级</span><span class="mp-required">*</span></div>
                    <div class="mp-control mp-control-picker"><span class="mp-picker-text">三年级1班</span><span class="mp-picker-arr">&gt;</span></div>
                  </div>
                </div>
              </div>
              <!-- 身高 + 体重 -->
              <div class="mp-row-2">
                <div class="mp-col">
                  <div class="mp-ui-field">
                    <div class="mp-label-row"><span class="mp-label">身高(cm)</span></div>
                    <div class="mp-control"><div class="mp-control-input">132</div></div>
                  </div>
                </div>
                <div class="mp-col">
                  <div class="mp-ui-field">
                    <div class="mp-label-row"><span class="mp-label">体重(kg)</span></div>
                    <div class="mp-control"><div class="mp-control-input">28</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 动态分区预览（可折叠） -->
          <div v-for="ps in previewSections" :key="ps.key" class="mp-card">
            <div class="mp-card-header" @click="togglePreviewSection(ps.key)">
              <div class="mp-card-title-row">
                <span class="mp-card-title">{{ ps.label || '未命名分区' }}</span>
              </div>
              <span class="mp-card-arrow" :class="{ open: previewOpen[ps.key] !== false }">▸</span>
            </div>
            <div class="mp-card-body" :class="previewOpen[ps.key] !== false ? 'show' : 'hide'">
              <template v-for="pf in ps.fields" :key="pf.key">
                <!-- text / number -->
                <div v-if="pf.type === 'text' || pf.type === 'number'" class="mp-ui-field">
                  <div class="mp-label-row">
                    <span class="mp-label">{{ pf.label || '未命名' }}</span>
                    <span v-if="pf.required" class="mp-required">*</span>
                  </div>
                  <div class="mp-control">
                    <div class="mp-control-input placeholder">{{ pf.placeholder || (pf.type === 'number' ? '请输入数字' : '请输入') }}</div>
                  </div>
                </div>

                <!-- select -->
                <div v-else-if="pf.type === 'select'" class="mp-ui-field">
                  <div class="mp-label-row">
                    <span class="mp-label">{{ pf.label || '未命名' }}</span>
                    <span v-if="pf.required" class="mp-required">*</span>
                  </div>
                  <div class="mp-control mp-control-picker">
                    <span class="mp-picker-text placeholder">{{ pf.placeholder || '请选择' }}</span>
                    <span class="mp-picker-arr">&gt;</span>
                  </div>
                </div>

                <!-- multi_select -->
                <div v-else-if="pf.type === 'multi_select'" class="mp-ui-field">
                  <div class="mp-label-row">
                    <span class="mp-label">{{ pf.label || '未命名' }}（可多选）</span>
                    <span v-if="pf.required" class="mp-required">*</span>
                  </div>
                  <div class="mp-pill-row">
                    <span
                      v-for="(opt, oi) in (pf.options || []).slice(0, 6)"
                      :key="oi"
                      class="mp-pill"
                      :class="{ on: oi < 2 }"
                    >
                      <span class="mp-pill-check">{{ oi < 2 ? '✓' : '' }}</span>
                      {{ opt }}
                    </span>
                    <span v-if="(pf.options || []).length === 0" class="mp-pill-empty">暂无选项</span>
                  </div>
                </div>

                <!-- date -->
                <div v-else-if="pf.type === 'date'" class="mp-ui-field">
                  <div class="mp-label-row">
                    <span class="mp-label">{{ pf.label || '未命名' }}</span>
                    <span v-if="pf.required" class="mp-required">*</span>
                  </div>
                  <div class="mp-control mp-control-picker">
                    <span class="mp-picker-text placeholder">{{ pf.placeholder || '请选择日期' }}</span>
                    <span class="mp-picker-arr">&gt;</span>
                  </div>
                </div>

                <!-- textarea -->
                <div v-else-if="pf.type === 'textarea'" class="mp-ui-field">
                  <div class="mp-label-row">
                    <span class="mp-label">{{ pf.label || '未命名' }}</span>
                    <span v-if="pf.required" class="mp-required">*</span>
                  </div>
                  <div class="mp-textarea">{{ pf.placeholder || '请输入' }}</div>
                </div>

                <!-- readonly -->
                <div v-else-if="pf.type === 'readonly'" class="mp-readonly-block">
                  <div class="mp-readonly-title">{{ pf.label || '未命名' }}（由专业人员填写）</div>
                  <div class="mp-readonly-content">暂无内容</div>
                </div>
              </template>

              <div v-if="ps.fields.length === 0" class="mp-empty-section">暂无启用的字段</div>
            </div>
          </div>

          <div v-if="previewSections.length === 0" class="mp-no-sections">
            暂无启用的分区
          </div>

          <!-- 底部按钮 -->
          <div class="mp-footer">
            <div class="mp-btn-primary">提交档案</div>
            <div class="mp-footer-tip">请完善姓名、性别、出生日期、学校、班级后提交</div>
          </div>
          <div class="mp-bottom-spacer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'
  import {
    profileFieldConfigGet,
    profileFieldConfigUpdate,
    type ProfileFieldSection,
    type ProfileFieldType
  } from '@/api/vision-admin'

  defineOptions({ name: 'VisionAdminProfileFields' })

  const sectionColors = ['#0077C2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const fieldTypeOptions: { value: ProfileFieldType; label: string; icon: string }[] = [
    { value: 'text', label: '文本输入', icon: '✏️' },
    { value: 'number', label: '数字输入', icon: '🔢' },
    { value: 'select', label: '单选下拉', icon: '📋' },
    { value: 'multi_select', label: '多选标签', icon: '☑️' },
    { value: 'date', label: '日期选择', icon: '📅' },
    { value: 'textarea', label: '多行文本', icon: '📝' },
    { value: 'readonly', label: '只读展示', icon: '🔒' }
  ]

  const loading = ref(false)
  const saving = ref(false)
  const showPreview = ref(true)
  const previewOpen = ref<Record<string, boolean>>({ basic: true })
  const sections = ref<ProfileFieldSection[]>([])
  const optionInputs = ref<Record<string, string>>({})

  const previewSections = computed(() =>
    sections.value
      .filter((s) => s.enabled)
      .map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.enabled)
      }))
      .filter((s) => s.fields.length > 0)
  )

  async function reload() {
    loading.value = true
    try {
      const res = await profileFieldConfigGet()
      const data = (res as any)?.data?.config || (res as any)?.config
      const raw = Array.isArray(data?.sections) ? data.sections : []
      sections.value = raw.map((s: any) => ({
        ...s,
        fields: Array.isArray(s.fields)
          ? s.fields.map((f: any) => ({
              ...f,
              type: f.type || 'text',
              options: Array.isArray(f.options) ? f.options : [],
              placeholder: f.placeholder || ''
            }))
          : []
      }))
    } catch (e: any) {
      ElMessage.error(e?.message || '加载失败')
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    try {
      const payload = {
        sections: sections.value.map((s, si) => ({
          ...s,
          sort_order: si + 1,
          fields: s.fields.map((f, fi) => ({
            ...f,
            sort_order: fi + 1,
            required: f.enabled ? f.required : false
          }))
        }))
      }
      await profileFieldConfigUpdate(payload)
      ElMessage.success('保存成功')
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      saving.value = false
    }
  }

  function generateKey(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}`
  }

  function addSection() {
    sections.value.push({
      key: generateKey('section'),
      label: '新分区',
      enabled: true,
      sort_order: sections.value.length + 1,
      fields: []
    })
    ElMessage.success('已添加新分区')
  }

  function deleteSection(index: number) {
    sections.value.splice(index, 1)
    ElMessage.success('分区已删除，保存后生效')
  }

  function addField(section: ProfileFieldSection) {
    section.fields.push({
      key: generateKey('field'),
      label: '',
      type: 'text',
      options: [],
      placeholder: '',
      enabled: true,
      required: false,
      sort_order: section.fields.length + 1
    })
  }

  function deleteField(section: ProfileFieldSection, index: number) {
    section.fields.splice(index, 1)
  }

  function onTypeChange(field: any) {
    if (field.type !== 'select' && field.type !== 'multi_select') field.options = []
    if (field.type === 'readonly') field.required = false
  }

  function addOption(field: any) {
    const val = (optionInputs.value[field.key] || '').trim()
    if (!val) return
    if (!Array.isArray(field.options)) field.options = []
    if (field.options.includes(val)) { ElMessage.warning('选项已存在'); return }
    field.options.push(val)
    optionInputs.value[field.key] = ''
  }

  function removeOption(field: any, index: number) {
    field.options.splice(index, 1)
  }

  function togglePreviewSection(key: string) {
    previewOpen.value[key] = previewOpen.value[key] === false ? true : false
  }

  function moveSection(index: number, dir: number) {
    const t = index + dir
    if (t < 0 || t >= sections.value.length) return
    const a = [...sections.value]; [a[index], a[t]] = [a[t], a[index]]
    sections.value = a
  }

  function moveField(section: ProfileFieldSection, index: number, dir: number) {
    const t = index + dir
    if (t < 0 || t >= section.fields.length) return
    const a = [...section.fields]; [a[index], a[t]] = [a[t], a[index]]
    section.fields = a
  }

  onMounted(() => { reload() })
</script>

<style scoped lang="scss">
  /* ═══════════════════════════════════════
     页面整体双栏布局
     ═══════════════════════════════════════ */
  .pf-page {
    display: flex;
    gap: 24px;
    height: var(--art-full-height, calc(100vh - 120px));
    min-height: 0;
    padding: 16px;
    box-sizing: border-box;
  }

  /* ═══════════════════════════════════════
     左侧编辑区
     ═══════════════════════════════════════ */
  .pf-editor {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--el-bg-color);
    border-radius: 12px;
    border: 1px solid var(--el-border-color-lighter);
    overflow: hidden;
  }

  .pf-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-lighter);
    flex-shrink: 0;
  }

  .pf-editor-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .pf-editor-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }

  .pf-editor-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .pf-editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  /* ── 分区 ── */
  .ed-section {
    margin-bottom: 20px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    overflow: hidden;
    transition: opacity 0.2s;
  }

  .ed-section--disabled {
    opacity: 0.55;
  }

  .ed-section-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--el-fill-color-lighter);
    border-left: 4px solid #0077C2;
    gap: 12px;
  }

  .ed-section-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .ed-section-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .ed-section-name {
    width: 180px;

    :deep(.el-input__inner) {
      font-weight: 600;
    }
  }

  .ed-empty-fields {
    padding: 24px;
    text-align: center;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  /* ── 字段行 ── */
  .ed-field {
    border-bottom: 1px solid var(--el-border-color-extra-light);

    &:last-child {
      border-bottom: none;
    }
  }

  .ed-field-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
  }

  .ed-field-sort {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 28px;
    flex-shrink: 0;
  }

  .ed-field-name {
    flex: 1;
    min-width: 120px;
  }

  .ed-field-key {
    display: block;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    margin-top: 2px;
  }

  .ed-field-type {
    width: 130px;
    flex-shrink: 0;
  }

  .ed-field-ph {
    width: 140px;
    flex-shrink: 0;
  }

  .ed-field-toggles {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  /* ── 选项编辑区 ── */
  .ed-field-options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 4px 16px 12px 54px;
    background: var(--el-fill-color-extra-light);
  }

  .ed-options-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ed-opt-tag {
    margin: 0 !important;
  }

  .ed-opt-add {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .ed-opt-input {
    width: 150px;
  }

  .ed-add-field {
    padding: 8px 16px;
    background: var(--el-fill-color-extra-light);
    border-top: 1px solid var(--el-border-color-extra-light);
  }

  /* ── 空状态 ── */
  .ed-empty {
    text-align: center;
    padding: 60px 20px;
  }

  .ed-empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .ed-empty-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .ed-empty-hint {
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    margin-top: 6px;
  }

  /* ═══════════════════════════════════════
     右侧预览区
     ═══════════════════════════════════════ */
  .pf-preview-wrap {
    width: 400px;
    flex-shrink: 0;
    position: sticky;
    top: 16px;
    align-self: flex-start;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
  }

  .pf-preview-label {
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin-bottom: 10px;
    letter-spacing: 1px;
  }

  /* ── 手机外框 ── */
  .pf-phone {
    width: 375px;
    height: 720px;
    margin: 0 auto;
    border-radius: 40px;
    border: 6px solid #1a1a1a;
    background: #f5f5f5;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .pf-phone-notch {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 28px;
    background: #1a1a1a;
    border-radius: 0 0 16px 16px;
    z-index: 10;
  }

  .pf-phone-statusbar {
    height: 44px;
    padding: 0 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    background: #0077C2;
    flex-shrink: 0;
    padding-bottom: 4px;
  }

  .pf-phone-statusbar-icons {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #fff;
  }

  .pf-phone-navbar {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    background: #0077C2;
    flex-shrink: 0;
  }

  .pf-phone-navbar-back {
    font-size: 20px;
    width: 30px;
  }

  .pf-phone-body {
    flex: 1;
    overflow-y: auto;
    background: #f5f5f5;
    padding: 10px;

    &::-webkit-scrollbar {
      width: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 3px;
    }
  }

  /* ═══════════════════════════════════════
     小程序预览样式 — 1:1 还原 (1rpx = 0.5px)
     ═══════════════════════════════════════ */

  /* ── Hero ── */
  .mp-hero {
    background: linear-gradient(180deg, rgba(0,119,194,1) 0%, rgba(89,165,245,0.98) 55%, rgba(245,245,245,1) 100%);
    border-bottom-left-radius: 24px;
    border-bottom-right-radius: 24px;
    padding: 14px 12px 12px;
    margin: -10px -10px 9px;
  }
  .mp-hero-top { padding: 6px 3px 9px; }
  .mp-hero-title { font-size: 21px; font-weight: 800; color: #fff; }
  .mp-hero-sub { margin-top: 5px; font-size: 13px; color: rgba(255,255,255,0.88); }
  .mp-hero-card {
    width: 100%; background: rgba(255,255,255,0.98); border-radius: 10px;
    padding: 12px; display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 5px 15px rgba(0,0,0,0.10); box-sizing: border-box;
  }
  .mp-hero-left { flex: 1; min-width: 0; }
  .mp-hero-right { margin-left: 8px; flex-shrink: 0; }
  .mp-hero-name { font-size: 17px; font-weight: 800; color: #333; }
  .mp-hero-meta { margin-top: 5px; font-size: 12px; color: #888; }
  .mp-hero-status { font-size: 12px; font-weight: 700; color: #0077c2; }

  /* ── Card（可折叠） ── */
  .mp-card {
    background: #fff; border-radius: 10px; margin-bottom: 8px;
    box-shadow: 0 3px 9px rgba(0,0,0,0.05); overflow: hidden;
  }
  .mp-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px; cursor: pointer; user-select: none;
  }
  .mp-card-title { font-size: 15px; font-weight: 800; color: #333; }
  .mp-card-title-row { display: flex; align-items: center; gap: 6px; flex: 1; }
  .mp-card-arrow {
    font-size: 14px; color: #999; transition: transform 0.25s; display: inline-block;
    &.open { transform: rotate(90deg); }
  }
  .mp-card-body {
    padding: 0 12px;
    &.show { padding-bottom: 12px; max-height: 5000px; opacity: 1; transition: max-height 0.35s ease, opacity 0.25s ease; }
    &.hide { max-height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; opacity: 0; transition: max-height 0.3s ease, opacity 0.2s ease; }
  }

  /* ── ui-field 还原 ── */
  .mp-ui-field { margin-bottom: 7px; }
  .mp-label-row { display: flex; align-items: center; margin-bottom: 5px; }
  .mp-label { font-size: 13px; color: #888; }
  .mp-required { margin-left: 3px; color: #ff4d4f; font-size: 13px; }
  .mp-control {
    background: #ffffff; border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 3px 8px rgba(0,0,0,0.04);
    height: 44px; display: flex; align-items: center;
    padding: 0 12px; box-sizing: border-box;
  }
  .mp-control-input {
    font-size: 16px; color: #333; flex: 1;
    &.placeholder { color: rgba(0,0,0,0.35); font-size: 14px; }
  }

  /* ── ui-picker-field 还原 ── */
  .mp-control-picker {
    justify-content: space-between;
  }
  .mp-picker-text {
    font-size: 16px; color: #333;
    &.placeholder { color: rgba(0,0,0,0.35); font-size: 14px; }
  }
  .mp-picker-arr { color: rgba(0,0,0,0.35); font-size: 17px; margin-left: 10px; }

  /* ── 性别 radio ── */
  .mp-control-radio {
    gap: 16px; font-size: 14px; color: #333;
  }
  .mp-radio-item { font-size: 14px; color: #333; }
  .mp-radio-item.on { color: #0077C2; font-weight: 600; }

  /* ── pill 多选标签 ── */
  .mp-pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
  .mp-pill {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 8px; border-radius: 7px;
    border: 1px solid rgba(0,0,0,0.08); background: #fff;
    font-size: 13px; color: #333;
    &.on { border-color: rgba(0,119,194,0.45); background: rgba(0,119,194,0.04); }
  }
  .mp-pill-check {
    width: 15px; height: 15px; border-radius: 4px;
    border: 1px solid rgba(0,0,0,0.15); display: flex;
    align-items: center; justify-content: center;
    font-size: 10px; color: #fff; flex-shrink: 0;
    .mp-pill.on & { border-color: rgba(0,119,194,0.8); background: #0077C2; }
  }
  .mp-pill-empty { font-size: 12px; color: #c0c4cc; padding: 4px 0; }

  /* ── textarea ── */
  .mp-textarea {
    width: 100%; min-height: 70px;
    border: 1px solid rgba(0,0,0,0.08); border-radius: 8px;
    padding: 10px; font-size: 14px; background: #ffffff;
    color: rgba(0,0,0,0.35); box-sizing: border-box;
    box-shadow: 0 3px 8px rgba(0,0,0,0.04);
  }

  /* ── readonly ── */
  .mp-readonly-block {
    background: rgba(0,119,194,0.03); border-radius: 7px;
    padding: 10px; margin-bottom: 7px;
    border: 1px dashed rgba(0,119,194,0.15);
  }
  .mp-readonly-title { font-size: 12px; font-weight: 700; color: #0077c2; margin-bottom: 6px; }
  .mp-readonly-content { font-size: 12px; color: #999; line-height: 1.6; }

  /* ── 两列布局 ── */
  .mp-row-2 { display: flex; gap: 7px; margin-bottom: 7px; }
  .mp-col { flex: 1; min-width: 0; }
  .mp-row-2 .mp-ui-field { margin-bottom: 0; }

  /* ── 空态 / 底部 ── */
  .mp-empty-section { padding: 10px; text-align: center; font-size: 12px; color: #c0c4cc; }
  .mp-no-sections { text-align: center; padding: 30px 10px; color: #c0c4cc; font-size: 13px; }
  .mp-footer { margin-top: 6px; }
  .mp-btn-primary {
    width: 100%; height: 44px; line-height: 44px; text-align: center;
    background: #0077c2; color: #fff; border-radius: 500px;
    font-size: 16px; font-weight: 800;
    box-shadow: 0 5px 13px rgba(0,119,194,0.25);
  }
  .mp-footer-tip { margin-top: 7px; text-align: center; color: #888; font-size: 12px; }
  .mp-bottom-spacer { height: 30px; }
</style>
