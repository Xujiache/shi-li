<template>
  <div class="ai-chat-page art-full-height">
    <ElCard class="ai-chat-card" shadow="never" body-style="padding: 0; height: calc(100vh - 140px); min-height: 500px;">
      <div class="chat-layout">
        <!-- 左侧：对话列表 -->
        <div class="chat-side">
          <div class="chat-side-header">
            <ElButton type="primary" size="small" @click="onCreate" :loading="creating">
              <i class="iconfont-sys" style="margin-right:4px;">+</i>
              新建对话
            </ElButton>
            <ElButton size="small" @click="loadConversations" :loading="convLoading">刷新</ElButton>
          </div>
          <div class="chat-side-body">
            <div v-if="!conversations.length && !convLoading" class="chat-empty">
              <span style="color:#909399;">暂无对话，点上方"新建对话"开始</span>
            </div>
            <div
              v-for="c in conversations"
              :key="c.id"
              class="chat-conv-item"
              :class="{ active: currentId === c.id }"
              @click="onPickConversation(c.id)"
            >
              <div class="chat-conv-title">{{ c.title || '新对话' }}</div>
              <div class="chat-conv-meta">
                <span>{{ c.message_count }} 条 · {{ fmtRelative(c.updated_at) }}</span>
                <span class="chat-conv-actions" @click.stop>
                  <ElButton link size="small" @click="onDelete(c)" type="danger">删</ElButton>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：聊天区 -->
        <div class="chat-main">
          <div v-if="!current" class="chat-placeholder">
            <div style="color:#909399; text-align:center;">
              <div style="font-size:40px;">💬</div>
              <div style="margin-top:8px;">选一个对话，或点左上"新建对话"开始</div>
            </div>
          </div>

          <template v-else>
            <!-- Header：标题 / 模型 / 操作 -->
            <div class="chat-header">
              <div class="chat-header-left">
                <ElInput
                  v-model="titleEdit"
                  size="small"
                  style="width:260px;"
                  :disabled="updating"
                  @blur="onSaveTitle"
                  @keyup.enter="onSaveTitle"
                  placeholder="对话标题"
                />
                <ElInput
                  v-model="modelEdit"
                  size="small"
                  style="width:200px; margin-left:8px;"
                  :disabled="updating"
                  @blur="onSaveModel"
                  @keyup.enter="onSaveModel"
                  placeholder="模型，如 gpt-4o-mini"
                />
                <ElButton
                  link
                  size="small"
                  style="margin-left:8px;"
                  @click="systemPromptVisible = !systemPromptVisible"
                >
                  {{ systemPromptVisible ? '收起' : '展开' }} system prompt
                </ElButton>
              </div>
              <div class="chat-header-right">
                <ElTag size="small" type="info">tokens: {{ current.total_tokens }}</ElTag>
                <ElButton size="small" @click="onClear" :loading="clearing">清空记录</ElButton>
              </div>
            </div>

            <div v-if="systemPromptVisible" class="chat-syspanel">
              <ElInput
                v-model="systemPromptEdit"
                type="textarea"
                :rows="3"
                placeholder="可选：给 AI 设定角色或风格（留空则像 ChatGPT 默认助手）"
                @blur="onSaveSystemPrompt"
              />
              <div style="font-size:12px; color:#909399; margin-top:4px;">
                修改后失焦保存。注意：system prompt 会和每轮对话一起发给模型。
              </div>
            </div>

            <!-- Messages -->
            <div ref="scrollerRef" class="chat-messages">
              <div v-if="!messages.length" class="chat-empty-msg">
                还没有消息。在下面随便问点什么吧 — 上下文会保留，每条提问都会带上前面的对话。
              </div>
              <div
                v-for="m in messages"
                :key="m.id"
                class="chat-msg-row"
                :class="m.role === 'user' ? 'is-user' : 'is-assistant'"
              >
                <div class="chat-msg-bubble" :class="`bubble-${m.role}`">
                  <div class="chat-msg-content">{{ m.content }}</div>
                  <div class="chat-msg-meta">
                    <span>{{ m.role === 'user' ? '我' : (m.model || 'AI') }}</span>
                    <span>· {{ fmtTime(m.created_at) }}</span>
                    <span v-if="m.total_tokens != null"> · {{ m.total_tokens }} tokens</span>
                  </div>
                </div>
              </div>
              <div v-if="sending" class="chat-msg-row is-assistant">
                <div class="chat-msg-bubble bubble-assistant">
                  <div class="chat-msg-content">
                    <span class="chat-typing">AI 正在思考</span>
                    <span class="chat-dots"><i></i><i></i><i></i></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Input -->
            <div class="chat-input-bar">
              <ElInput
                v-model="inputText"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="Shift+Enter 换行，Enter 发送"
                :disabled="sending"
                @keydown.enter.exact.prevent="onSend"
              />
              <div class="chat-input-actions">
                <span style="color:#909399; font-size:12px;">{{ inputText.length }} / 32000</span>
                <ElButton type="primary" :loading="sending" :disabled="!inputText.trim() || sending" @click="onSend">
                  发送
                </ElButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  adminListChatConversations,
  adminCreateChatConversation,
  adminUpdateChatConversation,
  adminDeleteChatConversation,
  adminClearChatConversation,
  adminListChatMessages,
  adminSendChatMessage,
  type AiChatConversation,
  type AiChatMessage
} from '@/api/vision-admin'

defineOptions({ name: 'VisionAdminAiChat' })

const conversations = ref<AiChatConversation[]>([])
const convLoading = ref(false)
const creating = ref(false)
const updating = ref(false)
const clearing = ref(false)
const sending = ref(false)

const currentId = ref<number | null>(null)
const current = ref<AiChatConversation | null>(null)
const messages = ref<AiChatMessage[]>([])

const titleEdit = ref('')
const modelEdit = ref('')
const systemPromptEdit = ref('')
const systemPromptVisible = ref(false)
const inputText = ref('')

const scrollerRef = ref<HTMLElement | null>(null)

function fmtTime(s: string) {
  if (!s) return ''
  try {
    const d = new Date(s)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch { return '' }
}

function fmtRelative(s: string) {
  if (!s) return ''
  try {
    const d = new Date(s).getTime()
    const diff = Date.now() - d
    if (diff < 60_000) return '刚刚'
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + '分钟前'
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + '小时前'
    if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + '天前'
    return new Date(d).toISOString().slice(0, 10)
  } catch { return '' }
}

async function scrollBottom() {
  await nextTick()
  if (scrollerRef.value) {
    scrollerRef.value.scrollTop = scrollerRef.value.scrollHeight
  }
}

async function loadConversations() {
  convLoading.value = true
  try {
    const r: any = await adminListChatConversations()
    conversations.value = (r?.list || r?.data?.list || []) as AiChatConversation[]
  } catch (e: any) {
    ElMessage.error(e?.message || '加载对话列表失败')
  } finally {
    convLoading.value = false
  }
}

async function loadCurrent(id: number) {
  try {
    const r: any = await adminListChatMessages({ id })
    const conv = (r?.conversation || r?.data?.conversation) as AiChatConversation
    const list = (r?.list || r?.data?.list || []) as AiChatMessage[]
    current.value = conv
    messages.value = list
    titleEdit.value = conv?.title || ''
    modelEdit.value = conv?.model || ''
    systemPromptEdit.value = conv?.system_prompt || ''
    await scrollBottom()
  } catch (e: any) {
    ElMessage.error(e?.message || '加载消息失败')
  }
}

async function onPickConversation(id: number) {
  if (sending.value) return
  currentId.value = id
  await loadCurrent(id)
}

async function onCreate() {
  creating.value = true
  try {
    const r: any = await adminCreateChatConversation({})
    const conv = (r?.conversation || r?.data?.conversation) as AiChatConversation
    if (conv) {
      conversations.value.unshift(conv)
      currentId.value = conv.id
      current.value = conv
      messages.value = []
      titleEdit.value = conv.title
      modelEdit.value = conv.model
      systemPromptEdit.value = conv.system_prompt
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function onDelete(c: AiChatConversation) {
  try {
    await ElMessageBox.confirm(`确定删除对话「${c.title || '新对话'}」？该对话内所有消息会一并清除。`, '删除', {
      type: 'warning'
    })
  } catch { return }
  try {
    await adminDeleteChatConversation({ id: c.id })
    conversations.value = conversations.value.filter((x) => x.id !== c.id)
    if (currentId.value === c.id) {
      currentId.value = null
      current.value = null
      messages.value = []
    }
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

async function onClear() {
  if (!current.value) return
  try {
    await ElMessageBox.confirm('清空当前对话的所有消息，但保留对话本身？', '清空', { type: 'warning' })
  } catch { return }
  clearing.value = true
  try {
    const r: any = await adminClearChatConversation({ id: current.value.id })
    const conv = (r?.conversation || r?.data?.conversation) as AiChatConversation
    if (conv) {
      current.value = conv
      const idx = conversations.value.findIndex((x) => x.id === conv.id)
      if (idx >= 0) conversations.value[idx] = conv
    }
    messages.value = []
    ElMessage.success('已清空')
  } catch (e: any) {
    ElMessage.error(e?.message || '清空失败')
  } finally {
    clearing.value = false
  }
}

async function saveConversationField(patch: Record<string, any>) {
  if (!current.value) return
  updating.value = true
  try {
    const r: any = await adminUpdateChatConversation({ id: current.value.id, ...patch })
    const conv = (r?.conversation || r?.data?.conversation) as AiChatConversation
    if (conv) {
      current.value = conv
      const idx = conversations.value.findIndex((x) => x.id === conv.id)
      if (idx >= 0) conversations.value[idx] = conv
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    updating.value = false
  }
}

async function onSaveTitle() {
  if (!current.value) return
  if ((titleEdit.value || '') === (current.value.title || '')) return
  await saveConversationField({ title: titleEdit.value })
}

async function onSaveModel() {
  if (!current.value) return
  if ((modelEdit.value || '') === (current.value.model || '')) return
  await saveConversationField({ model: modelEdit.value })
}

async function onSaveSystemPrompt() {
  if (!current.value) return
  if ((systemPromptEdit.value || '') === (current.value.system_prompt || '')) return
  await saveConversationField({ system_prompt: systemPromptEdit.value })
}

async function onSend() {
  if (!current.value) {
    ElMessage.info('请先选择或新建对话')
    return
  }
  const text = (inputText.value || '').trim()
  if (!text) return
  if (text.length > 32000) {
    ElMessage.error('消息过长（最多 32000 字）')
    return
  }
  sending.value = true
  // 乐观插入：先把用户消息显示出来
  const optimisticUser: AiChatMessage = {
    id: -Date.now(),
    conversation_id: current.value.id,
    role: 'user',
    content: text,
    model: null,
    prompt_tokens: null,
    completion_tokens: null,
    total_tokens: null,
    created_at: new Date().toISOString()
  }
  messages.value.push(optimisticUser)
  inputText.value = ''
  await scrollBottom()

  try {
    const r: any = await adminSendChatMessage({ id: current.value.id, content: text })
    const conv = (r?.conversation || r?.data?.conversation) as AiChatConversation
    const userMsg = (r?.user_message || r?.data?.user_message) as AiChatMessage
    const assistantMsg = (r?.assistant_message || r?.data?.assistant_message) as AiChatMessage

    // 替换乐观消息为真实消息
    const idx = messages.value.findIndex((m) => m.id === optimisticUser.id)
    if (idx >= 0 && userMsg) messages.value.splice(idx, 1, userMsg)
    if (assistantMsg) messages.value.push(assistantMsg)
    if (conv) {
      current.value = conv
      const ci = conversations.value.findIndex((x) => x.id === conv.id)
      if (ci >= 0) {
        conversations.value[ci] = conv
        // 把当前对话移到最前
        const [item] = conversations.value.splice(ci, 1)
        conversations.value.unshift(item)
      }
      titleEdit.value = conv.title
    }
    await scrollBottom()
  } catch (e: any) {
    // 失败时去掉乐观消息，保留输入框文本，方便重试
    messages.value = messages.value.filter((m) => m.id !== optimisticUser.id)
    inputText.value = text
    ElMessage.error(e?.message || '发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

watch(() => currentId.value, (v) => {
  if (v == null) {
    current.value = null
    messages.value = []
  }
})

onMounted(async () => {
  await loadConversations()
})
</script>

<style lang="scss" scoped>
.ai-chat-page {
  padding: 16px;
}
.ai-chat-card {
  height: 100%;
}
.chat-layout {
  display: flex;
  height: 100%;
}
.chat-side {
  width: 280px;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}
.chat-side-header {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  gap: 8px;
}
.chat-side-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.chat-empty {
  text-align: center;
  padding: 40px 12px;
}
.chat-conv-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 4px;
  &:hover { background: #f2f3f5; }
  &.active {
    background: #ecf5ff;
    .chat-conv-title { color: #1677FF; font-weight: 600; }
  }
}
.chat-conv-title {
  font-size: 14px;
  color: #1f2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chat-conv-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}
.chat-conv-actions {
  opacity: 0.6;
  &:hover { opacity: 1; }
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
}
.chat-header-left {
  display: flex;
  align-items: center;
}
.chat-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-syspanel {
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f7fa;
}
.chat-empty-msg {
  text-align: center;
  color: #909399;
  margin-top: 60px;
}
.chat-msg-row {
  display: flex;
  margin-bottom: 16px;
  &.is-user { justify-content: flex-end; }
  &.is-assistant { justify-content: flex-start; }
}
.chat-msg-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.bubble-user {
  background: #1677FF;
  color: #fff;
  border-bottom-right-radius: 2px;
}
.bubble-assistant {
  background: #fff;
  color: #1f2329;
  border-bottom-left-radius: 2px;
}
.chat-msg-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg-meta {
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  gap: 4px;
}
.bubble-user .chat-msg-meta { color: rgba(255,255,255,0.85); }
.bubble-assistant .chat-msg-meta { color: #86909c; }

.chat-typing { color: #909399; font-style: italic; }
.chat-dots {
  display: inline-block;
  margin-left: 6px;
  i {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #c9cdd4;
    margin-right: 3px;
    animation: chat-dot 1.2s infinite ease-in-out;
  }
  i:nth-child(2) { animation-delay: 0.2s; }
  i:nth-child(3) { animation-delay: 0.4s; }
}
@keyframes chat-dot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.chat-input-bar {
  border-top: 1px solid #ebeef5;
  padding: 12px 16px;
  background: #fff;
}
.chat-input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
</style>
