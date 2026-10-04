<template>
  <div class="agent-view">
    <AppNavBar active="agent" />

    <main class="agent-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <aside class="agent-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="logo-row">
          <button class="brand" type="button" @click="goHome">
            <BrandLogo :size="24" />
            <span class="brand-text">Agent</span>
          </button>
          <el-tooltip :content="sidebarCollapsed ? '展开侧栏' : '收起侧栏'" placement="bottom">
            <button class="icon-btn" type="button" @click="sidebarCollapsed = !sidebarCollapsed">
              <el-icon><Expand v-if="sidebarCollapsed" /><Fold v-else /></el-icon>
            </button>
          </el-tooltip>
        </div>

        <button class="new-session" type="button" @click="createConversation">
          <el-icon><Plus /></el-icon>
          <span class="new-session-label">新建会话</span>
        </button>

        <div class="session-area">
          <div v-if="conversationsLoading" class="sidebar-loading">
            <el-icon class="is-loading"><Loading /></el-icon><span>加载会话...</span>
          </div>
          <el-empty v-else-if="conversations.length === 0" :image-size="42" description="暂无会话" />
          <template v-else>
            <div v-for="group in groupedConversations" :key="group.key" class="session-group">
              <button class="group-header" type="button" @click="toggleGroup(group.key)">
                <el-icon class="group-chevron" :class="{ open: !collapsedGroups.has(group.key) }"><CaretRight /></el-icon>
                <span class="group-label">{{ group.label }}</span>
                <span class="group-count">{{ group.items.length }}</span>
              </button>
              <template v-if="!collapsedGroups.has(group.key)">
                <button
                  v-for="conversation in group.items"
                  :key="conversation.agent_conversation_id"
                  class="session-row"
                  :class="{ selected: activeConversationId === conversation.agent_conversation_id }"
                  type="button"
                  @click="selectConversation(conversation.agent_conversation_id)"
                >
                  <span class="session-name">{{ conversation.agent_conversation_name || '新对话' }}</span>
                  <span class="session-actions">
                    <el-tooltip content="重命名" placement="top">
                      <el-icon @click.stop="renameConversation(conversation)"><EditPen /></el-icon>
                    </el-tooltip>
                    <el-tooltip content="删除" placement="top">
                      <el-icon @click.stop="removeConversation(conversation)"><Delete /></el-icon>
                    </el-tooltip>
                  </span>
                </button>
              </template>
            </div>
          </template>
        </div>

        <div class="sidebar-foot">
          <div class="foot-models">
            <span class="foot-caption">模型</span>
            <el-select
              v-model="selectedConfigId"
              size="small"
              placeholder="选择模型分组"
              :loading="configsLoading"
              @change="handleConfigChange"
            >
              <el-option
                v-for="config in configs"
                :key="config.userConfigId"
                :label="config.groupName"
                :value="config.userConfigId"
              />
            </el-select>
            <el-select
              v-model="selectedModel"
              size="small"
              placeholder="选择模型"
              :disabled="!selectedConfig"
            >
              <el-option v-for="model in selectedConfig?.modelNames || []" :key="model" :label="model" :value="model" />
            </el-select>
          </div>
          <button class="foot-row" type="button" @click="manageModels">
            <el-icon><Setting /></el-icon>
            <span>管理模型配置</span>
          </button>
        </div>
      </aside>

      <section class="chat-surface">
        <header class="chat-header">
          <strong>{{ activeConversation?.agent_conversation_name || '选择或新建一个会话' }}</strong>
          <el-button :icon="Delete" text :disabled="messages.length === 0 || sending" @click="clearMessages">清空页面</el-button>
        </header>

        <div ref="scrollRef" class="transcript">
          <div class="column">
            <div v-if="messagesLoading" class="chat-loading">
              <el-icon class="is-loading"><Loading /></el-icon><span>加载对话记录...</span>
            </div>

            <div v-else-if="!activeConversationId" class="welcome-state">
              <span class="welcome-mark"><el-icon><ChatLineRound /></el-icon></span>
              <h2>开始一段新对话</h2>
              <p>从左侧选择已有会话，或点击加号新建会话。</p>
              <el-button type="primary" :icon="Plus" :loading="creatingConversation" @click="createConversation">新建会话</el-button>
            </div>

            <div v-else-if="messages.length === 0 && !sending" class="welcome-state">
              <span class="welcome-mark"><el-icon><MagicStick /></el-icon></span>
              <h2>今天想了解什么？</h2>
              <p>Agent 可以调用工具读取真实学习数据，再结合你的问题给出回答。</p>
              <div class="suggestion-list">
                <button v-for="suggestion in suggestions" :key="suggestion" type="button" @click="useSuggestion(suggestion)">
                  {{ suggestion }}
                  <el-icon><ArrowRight /></el-icon>
                </button>
              </div>
            </div>

            <template v-else>
              <article v-for="message in messages" :key="message.id" class="message" :class="message.role.toLowerCase()">
                <div v-if="message.role === 'USER'" class="user-row">
                  <div class="user-bubble">{{ message.content }}</div>
                </div>
                <div v-else class="assistant-body">
                  <div v-if="message.trace?.length" class="live-block">
                    <template v-for="block in message.trace" :key="block.callId">
                      <div
                        class="tool-row"
                        :data-state="block.status"
                        role="button"
                        :aria-expanded="block.expanded"
                        @click="toggleTool(block)"
                      >
                        <span class="row-leading">
                          <span v-if="block.status === 'success'" class="state-dot done"></span>
                          <span v-else-if="block.status === 'error'" class="state-dot error"></span>
                          <el-icon v-else><component :is="toolIcon(block.name)" /></el-icon>
                        </span>
                        <span class="row-title">{{ block.label }}</span>
                        <span v-if="summarizeArgs(block.argsText)" class="row-dot">·</span>
                        <span class="row-summary" :class="{ 'error-summary': block.status === 'error' }">{{ summarizeArgs(block.argsText) }}</span>
                      </div>

                      <div v-if="block.expanded" class="io-card">
                        <div class="io-section">
                          <span class="io-label">IN</span>
                          <span class="io-text">{{ prettyIo(block.argsText) }}</span>
                        </div>
                        <template v-if="block.preview">
                          <div class="io-divider"></div>
                          <div class="io-section">
                            <span class="io-label">OUT</span>
                            <span class="io-text">{{ block.preview }}</span>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                  <div class="markdown-body" v-html="renderMarkdown(message.content)"></div>
                </div>
              </article>

              <article v-if="sending" class="message assistant live-turn">
                <div class="assistant-body">
                  <div v-if="liveStatus && !hasLiveText" class="status-shimmer">{{ liveStatus }}</div>

                  <div
                    v-for="(block, index) in liveBlocks"
                    :key="index"
                    class="live-block"
                  >
                    <div
                      v-if="block.kind === 'tool'"
                      class="tool-row"
                      :data-state="block.status"
                      role="button"
                      :aria-expanded="block.expanded"
                      @click="toggleTool(block)"
                    >
                      <span class="row-leading">
                        <span v-if="block.status === 'success'" class="state-dot done"></span>
                        <span v-else-if="block.status === 'error'" class="state-dot error"></span>
                        <el-icon v-else><component :is="toolIcon(block.name)" /></el-icon>
                      </span>
                      <span class="row-title">{{ block.label }}</span>
                      <span v-if="summarizeArgs(block.argsText)" class="row-dot">·</span>
                      <span class="row-summary" :class="{ 'error-summary': block.status === 'error' }">{{ summarizeArgs(block.argsText) }}</span>
                    </div>

                    <div v-if="block.kind === 'tool' && block.expanded" class="io-card">
                      <div class="io-section">
                        <span class="io-label">IN</span>
                        <span class="io-text">{{ prettyIo(block.argsText) }}</span>
                      </div>
                      <template v-if="block.preview">
                        <div class="io-divider"></div>
                        <div class="io-section">
                          <span class="io-label">OUT</span>
                          <span class="io-text">{{ block.preview }}</span>
                        </div>
                      </template>
                    </div>

                    <div v-else-if="block.kind === 'text'" class="markdown-body" v-html="renderMarkdown(block.text)"></div>
                  </div>
                </div>
              </article>
            </template>
          </div>
        </div>

        <div class="composer-seat">
          <div class="composer-card">
            <el-input
              v-model="question"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 8 }"
              resize="none"
              maxlength="2000"
              :disabled="!activeConversationId || sending"
              :placeholder="activeConversationId ? '询问提交记录、学习情况或编程问题' : '请先选择或新建会话'"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <div class="composer-row">
              <span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>
              <button
                class="send-btn"
                type="button"
                :disabled="!question.trim() || !activeConversationId || sending"
                aria-label="发送"
                @click="sendMessage"
              >
                <el-icon v-if="sending" class="is-loading"><Loading /></el-icon>
                <svg v-else viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                  <path d="M10 3.5v11M5 8.5l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Calendar,
  CaretRight,
  ChatLineRound,
  Clock,
  Delete,
  Document,
  EditPen,
  Expand,
  Fold,
  Loading,
  MagicStick,
  Notebook,
  Plus,
  Search,
  Setting,
  Tickets,
  User,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import agentApi, { type AgentConversation, type AgentMessage } from '@/api/agentApi'
import aiApi, { type UserAiConfigSummary } from '@/api/aiApi'
import { errorText } from '@/api/request'
import { renderMarkdown } from '@/utils/markdown'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import { navigateTopLevel } from '@/utils/navigation'

interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  /** 本次 turn 的工具调用轨迹（对齐 dsh：结束后工具行保留在对话中，可展开查看）。 */
  trace?: ToolBlock[]
}

interface ToolBlock {
  kind: 'tool'
  callId: string
  name: string
  label: string
  argsText: string
  preview: string
  status: 'running' | 'success' | 'error'
  expanded: boolean
}

interface TextBlock {
  kind: 'text'
  text: string
}

type LiveBlock = ToolBlock | TextBlock

/** 与 dsh 插件 codewise-tools 的 presentCall 标题保持一致。 */
const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取当前时间',
  get_recent_submissions: '查询最近提交',
  get_submission_by_id: '查询提交详情',
  get_submissions_by_ids: '批量查询提交详情',
  get_user_info: '查询用户信息',
  search_question: '搜索题目',
  get_review_record: '查询复习记录',
  get_user_review_config: '查询复习配置',
  get_question_by_id: '查询题目详情',
  get_all_review: '查询复习计划',
  update_review_config: '更新复习配置',
}

const TOOL_ICONS: Record<string, any> = {
  get_current_time: Clock,
  get_user_info: User,
  search_question: Search,
  get_question_by_id: Document,
  get_recent_submissions: Tickets,
  get_submission_by_id: Tickets,
  get_submissions_by_ids: Tickets,
  get_review_record: Calendar,
  get_user_review_config: Setting,
  get_all_review: Notebook,
  update_review_config: EditPen,
}

const router = useRouter()
const configs = ref<UserAiConfigSummary[]>([])
const configsLoading = ref(false)
const conversations = ref<AgentConversation[]>([])
const conversationsLoading = ref(false)
const creatingConversation = ref(false)
const activeConversationId = ref<number>()
const selectedConfigId = ref<number>()
const selectedModel = ref('')
const question = ref('')
const sending = ref(false)
const messagesLoading = ref(false)
const messages = ref<ChatMessage[]>([])
const liveStatus = ref('')
const liveBlocks = ref<LiveBlock[]>([])
const scrollRef = ref<HTMLElement>()
const suggestions = ['分析我最近的提交情况', '我最近有哪些没有通过的题目？', '现在几点？']

const selectedConfig = computed(() => configs.value.find((config) => config.userConfigId === selectedConfigId.value))
const activeConversation = computed(() =>
  conversations.value.find((conversation) => conversation.agent_conversation_id === activeConversationId.value),
)
const hasLiveText = computed(() => liveBlocks.value.some((block) => block.kind === 'text'))
const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T

// ---- 侧栏：折叠 + 会话按时间分组 ----

const sidebarCollapsed = ref(false)
const collapsedGroups = ref<Set<string>>(new Set())

interface ConversationGroup {
  key: string
  label: string
  items: AgentConversation[]
}

const GROUP_ORDER = ['今天', '昨天', '7 天内', '30 天内', '更早'] as const
const DAY_MS = 86_400_000

function conversationTime(conversation: AgentConversation): number {
  const raw = conversation.update_time || conversation.create_time
  if (!raw) return 0
  // MySQL DATETIME 形如 "YYYY-MM-DD HH:mm:ss"，转成 ISO 便于解析
  const time = new Date(String(raw).replace(' ', 'T')).getTime()
  return Number.isNaN(time) ? 0 : time
}

function timeBucketLabel(timestamp: number): string {
  if (!timestamp) return '更早'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (timestamp >= startOfToday) return '今天'
  if (timestamp >= startOfToday - DAY_MS) return '昨天'
  if (timestamp >= startOfToday - 7 * DAY_MS) return '7 天内'
  if (timestamp >= startOfToday - 30 * DAY_MS) return '30 天内'
  return '更早'
}

/** 会话按时间分组；conversations 本身按 update_time 倒序，组内保持新→旧。 */
const groupedConversations = computed<ConversationGroup[]>(() => {
  const buckets = new Map<string, AgentConversation[]>()
  for (const conversation of conversations.value) {
    const label = timeBucketLabel(conversationTime(conversation))
    const bucket = buckets.get(label)
    if (bucket) bucket.push(conversation)
    else buckets.set(label, [conversation])
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: key,
    items: buckets.get(key)!,
  }))
})

function toggleGroup(key: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

function toolIcon(name: string) {
  return TOOL_ICONS[name] || MagicStick
}

function summarizeArgs(argsText: string): string {
  if (!argsText) return ''
  try {
    const parsed = JSON.parse(argsText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const text = Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => `${key}=${Array.isArray(value) ? `[${value.length}]` : String(value)}`)
        .join('  ')
      return text.length > 64 ? `${text.slice(0, 64)}…` : text
    }
    return argsText.length > 64 ? `${argsText.slice(0, 64)}…` : argsText
  } catch {
    return argsText
  }
}

function toggleTool(block: ToolBlock) {
  block.expanded = !block.expanded
}

/** 展开卡 IN 区内容：JSON 美化缩进，解析失败时原样展示。 */
function prettyIo(argsText: string): string {
  if (!argsText) return '(无参数)'
  try {
    return JSON.stringify(JSON.parse(argsText), null, 2)
  } catch {
    return argsText
  }
}

async function loadConfigs() {
  configsLoading.value = true
  try {
    const records = unwrap<any[]>(await aiApi.listConfigs(), [])
    configs.value = records.map((config) => ({
      ...config,
      userConfigId: Number(config.userConfigId),
      modelNames: config.modelNames || [],
    }))
    if (configs.value.length) {
      const storedConfigId = Number(localStorage.getItem('agentConfigId'))
      selectedConfigId.value = configs.value.some((item) => item.userConfigId === storedConfigId)
        ? storedConfigId
        : configs.value[0].userConfigId
      handleConfigChange()
    }
  } catch (error) {
    console.error('Agent 模型配置加载失败:', error)
  } finally {
    configsLoading.value = false
  }
}

function handleConfigChange() {
  const config = selectedConfig.value
  const storedModel = localStorage.getItem(`agentModel:${selectedConfigId.value}`) || ''
  selectedModel.value = config?.modelNames.includes(storedModel) ? storedModel : config?.modelNames[0] || ''
  if (selectedConfigId.value) localStorage.setItem('agentConfigId', String(selectedConfigId.value))
}

function mapConversation(raw: any): AgentConversation {
  return {
    agent_conversation_id: Number(raw.agent_conversation_id),
    user_id: String(raw.user_id),
    agent_conversation_name: raw.agent_conversation_name || '新对话',
    create_time: raw.create_time,
    update_time: raw.update_time,
  }
}

function mapMessage(raw: AgentMessage): ChatMessage {
  return {
    id: String(raw.agent_message_id),
    role: raw.role === 'USER' ? 'USER' : 'ASSISTANT',
    content: raw.content || '',
  }
}

async function loadConversations() {
  conversationsLoading.value = true
  try {
    const records = await agentApi.listConversations()
    conversations.value = (Array.isArray(records) ? records : []).map(mapConversation)
    const storedId = Number(localStorage.getItem('agentConversationId'))
    const initialId = conversations.value.some((item) => item.agent_conversation_id === storedId)
      ? storedId
      : conversations.value[0]?.agent_conversation_id
    if (initialId) await selectConversation(initialId)
  } catch (error) {
    ElMessage.error(errorText(error, '会话加载失败'))
  } finally {
    conversationsLoading.value = false
  }
}

async function createConversation() {
  if (creatingConversation.value) return
  creatingConversation.value = true
  try {
    const conversation = mapConversation(await agentApi.createConversation())
    conversations.value.unshift(conversation)
    await selectConversation(conversation.agent_conversation_id)
  } catch (error) {
    ElMessage.error(errorText(error, '新建会话失败'))
  } finally {
    creatingConversation.value = false
  }
}

async function selectConversation(conversationId: number) {
  if (sending.value || (activeConversationId.value === conversationId && messages.value.length)) return
  activeConversationId.value = conversationId
  localStorage.setItem('agentConversationId', String(conversationId))
  messagesLoading.value = true
  messages.value = []
  liveBlocks.value = []
  liveStatus.value = ''
  try {
    const records = await agentApi.getMessages(conversationId)
    messages.value = (Array.isArray(records) ? records : [])
      .slice()
      .reverse()
      .filter((message) => message.role !== 'SYSTEM')
      .map(mapMessage)
    await scrollToBottom()
  } catch (error) {
    ElMessage.error(errorText(error, '消息加载失败'))
  } finally {
    messagesLoading.value = false
  }
}

async function renameConversation(conversation: AgentConversation) {
  try {
    const result = await ElMessageBox.prompt('输入新的会话名称', '重命名会话', {
      inputValue: conversation.agent_conversation_name,
      inputPattern: /\S+/,
      inputErrorMessage: '会话名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    const name = result.value.trim()
    await agentApi.renameConversation(conversation.agent_conversation_id, name)
    conversation.agent_conversation_name = name
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorText(error, '重命名失败'))
  }
}

async function removeConversation(conversation: AgentConversation) {
  try {
    await ElMessageBox.confirm(`确定删除“${conversation.agent_conversation_name}”及其全部消息吗？`, '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await agentApi.deleteConversation(conversation.agent_conversation_id)
    conversations.value = conversations.value.filter(
      (item) => item.agent_conversation_id !== conversation.agent_conversation_id,
    )
    if (activeConversationId.value === conversation.agent_conversation_id) {
      activeConversationId.value = undefined
      messages.value = []
      localStorage.removeItem('agentConversationId')
      const nextConversation = conversations.value[0]
      if (nextConversation) await selectConversation(nextConversation.agent_conversation_id)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorText(error, '删除失败'))
  }
}

async function scrollToBottom() {
  await nextTick()
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

function useSuggestion(value: string) {
  question.value = value
}

function appendTextDelta(text: string) {
  const last = liveBlocks.value[liveBlocks.value.length - 1]
  if (last && last.kind === 'text') last.text += text
  else liveBlocks.value.push({ kind: 'text', text })
}

function upsertToolCall(callId: string, name: string, argsText: string) {
  if (liveBlocks.value.some((block) => block.kind === 'tool' && block.callId === callId)) return
  liveBlocks.value.push({
    kind: 'tool',
    callId,
    name,
    label: TOOL_LABELS[name] || name,
    argsText,
    preview: '',
    status: 'running',
    expanded: false,
  })
}

function finishToolCall(callId: string, isError: boolean, preview: string) {
  const block = liveBlocks.value.find((item): item is ToolBlock => item.kind === 'tool' && item.callId === callId)
  if (!block) return
  block.status = isError ? 'error' : 'success'
  block.preview = preview
}

async function sendMessage() {
  const content = question.value.trim()
  if (!content || sending.value) return
  if (!selectedConfigId.value || !selectedModel.value) {
    ElMessage.warning('请先选择模型配置')
    return
  }
  if (!activeConversationId.value) {
    ElMessage.warning('请先选择或新建会话')
    return
  }

  messages.value.push({ id: `user-${Date.now()}`, role: 'USER', content })
  question.value = ''
  sending.value = true
  liveBlocks.value = []
  liveStatus.value = '正在连接 Agent'
  localStorage.setItem(`agentModel:${selectedConfigId.value}`, selectedModel.value)
  await scrollToBottom()

  try {
    const result = await agentApi.stream(
      {
        user_config_id: selectedConfigId.value,
        conversation_id: activeConversationId.value,
        model_name: selectedModel.value,
        question: content,
      },
      {
        onTextDelta(text) {
          liveStatus.value = ''
          appendTextDelta(text)
          scrollToBottom()
        },
        onStatus(message) {
          if (!hasLiveText.value) liveStatus.value = message
          scrollToBottom()
        },
        onToolCall(event) {
          liveStatus.value = ''
          upsertToolCall(event.callId, event.name, event.argsText)
          scrollToBottom()
        },
        onToolResult(event) {
          finishToolCall(event.callId, event.isError, event.preview)
          scrollToBottom()
        },
      },
    )

    const finalContent = result.content || collectText()
    if (!finalContent) throw new Error('Agent 未返回内容')
    // 工具轨迹冻结进消息（dsh 行为：turn 结束后工具行仍可展开查看）；
    // 轨迹不落 MySQL，历史重新加载后只显示文本。
    const trace = liveBlocks.value
      .filter((block): block is ToolBlock => block.kind === 'tool')
      .map((block) => ({ ...block }))
    messages.value.push({ id: `assistant-${Date.now()}`, role: 'ASSISTANT', content: finalContent, trace })
  } catch (error) {
    const message = errorText(error, 'Agent 调用失败')
    ElMessage.error(message)
    question.value = content
  } finally {
    liveBlocks.value = []
    liveStatus.value = ''
    sending.value = false
    await scrollToBottom()
  }
}

function collectText(): string {
  return liveBlocks.value
    .filter((block): block is TextBlock => block.kind === 'text')
    .map((block) => block.text)
    .join('')
}

function clearMessages() {
  messages.value = []
}

const goHome = () => navigateTopLevel(router, '/home')
const manageModels = () => router.push({ path: '/profile', query: { section: 'ai' } })

onMounted(async () => {
  await Promise.all([loadConfigs(), loadConversations()])
})
</script>

<style scoped>
* { box-sizing: border-box; }
.agent-view {
  --accent: var(--cw-brand-dark);
  --accent-hover: var(--cw-brand-dark);
  --accent-soft: #fff3e0;
  --text-primary: var(--cw-text-1);
  --text-secondary: #61666b;
  --text-tertiary: #81858c;
  --text-caption: #adb2b8;
  --border-l2: rgba(0, 0, 0, 0.1);
  --border-l1: rgba(0, 0, 0, 0.04);
  --code-bg: #f9fafb;
  --success: var(--cw-success);
  --error: var(--cw-danger);
  height: 100vh;
  overflow: hidden;
  background: var(--cw-bg-page);
  color: var(--text-primary);
  font-family: var(--cw-font-sans);
}
.agent-shell { width: min(1380px, calc(100% - 56px)); height: calc(100vh - 58px); margin: 0 auto; padding: 24px 0; display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 20px; transition: grid-template-columns 0.2s var(--ease-in-out, ease); }
.agent-shell.sidebar-collapsed { grid-template-columns: 56px minmax(0, 1fr); }
.agent-sidebar { min-height: 0; border: 1px solid #e6e9ee; border-radius: 8px; background: #fff; padding: 8px 10px; display: flex; flex-direction: column; overflow: hidden; }
.logo-row { height: 44px; flex: none; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.brand { min-width: 0; display: inline-flex; align-items: center; gap: 8px; padding: 4px 6px; border: 0; border-radius: 8px; background: transparent; color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer; overflow: hidden; }
.brand-text { white-space: nowrap; }
.icon-btn { flex: none; width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--text-secondary); display: grid; place-items: center; cursor: pointer; }
.icon-btn:hover { background: rgba(0, 0, 0, 0.05); color: var(--text-primary); }
.new-session { flex: none; height: 38px; margin: 0 2px 8px; padding: 0 16px; border: 1px solid var(--border-l2); border-radius: 12px; background: #fff; color: var(--text-primary); font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; overflow: hidden; }
.new-session:hover { background: var(--accent-soft); border-color: var(--cw-brand-border); }
.session-area { min-height: 0; flex: 1; padding-right: 2px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.session-area::-webkit-scrollbar, .transcript::-webkit-scrollbar { width: 8px; }
.session-area::-webkit-scrollbar-thumb, .transcript::-webkit-scrollbar-thumb { border-radius: 4px; background: #e0e3e8; }
.session-group { display: flex; flex-direction: column; gap: 2px; }
.group-header { flex: none; height: 30px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--text-tertiary); font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; text-align: left; }
.group-header:hover { background: rgba(0, 0, 0, 0.04); color: var(--text-secondary); }
.group-chevron { font-size: 12px; color: var(--text-caption); transition: transform 0.15s ease; }
.group-chevron.open { transform: rotate(90deg); }
.group-label { min-width: 0; flex: 1; }
.group-count { font-size: 11px; font-weight: 400; color: var(--text-caption); }
.session-row { flex: none; height: 32px; padding: 0 8px 0 24px; border: 0; border-radius: 8px; background: transparent; color: var(--text-primary); font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; text-align: left; }
.session-row:hover { background: rgba(0, 0, 0, 0.05); }
.session-row.selected { background: var(--accent-soft); color: var(--accent-hover); font-weight: 500; }
.session-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-actions { flex: none; display: flex; align-items: center; gap: 6px; color: var(--cw-text-3); opacity: 0; }
.session-row:hover .session-actions, .session-row.selected .session-actions { opacity: 1; }
.session-actions .el-icon:hover { color: var(--accent); }
.sidebar-foot { flex: none; border-top: 1px solid var(--cw-bg-subtle); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.foot-caption { padding: 0 4px; color: #555b64; font-size: 11px; font-weight: 600; }
.foot-models { display: flex; flex-direction: column; gap: 6px; }
.foot-models :deep(.el-select) { width: 100%; }
.foot-row { height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--text-secondary); font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; text-align: left; }
.foot-row:hover { background: rgba(0, 0, 0, 0.05); color: var(--text-primary); }
/* 收起态：56px 图标栏，隐藏文字与列表 */
.agent-sidebar.collapsed { padding: 8px 8px; }
.agent-sidebar.collapsed .logo-row { height: auto; flex-direction: column; gap: 8px; margin-bottom: 8px; justify-content: center; }
.agent-sidebar.collapsed .brand { display: none; }
.agent-sidebar.collapsed .new-session-label,
.agent-sidebar.collapsed .session-area,
.agent-sidebar.collapsed .foot-models,
.agent-sidebar.collapsed .foot-row span { display: none; }
.agent-sidebar.collapsed .new-session { width: 36px; padding: 0; margin: 0 auto 8px; }
.agent-sidebar.collapsed .foot-row { justify-content: center; }
.sidebar-loading { min-height: 80px; color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 12px; }

.chat-surface { min-height: 0; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.chat-header { height: 46px; padding: 0 4px; display: flex; align-items: center; justify-content: space-between; }
.chat-header strong { max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; color: var(--text-secondary); font-weight: 600; }
.transcript { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; padding: 8px 16px 16px; }
.column { max-width: 748px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.chat-loading { height: 100%; color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; }
.welcome-state { min-height: 60vh; max-width: 660px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.welcome-mark { width: 52px; height: 52px; border-radius: 9px; font-size: 25px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.welcome-state h2 { margin: 18px 0 7px; font-size: 26px; line-height: 32px; font-weight: 500; }
.welcome-state > p { margin: 0 0 18px; color: var(--text-tertiary); font-size: 13px; line-height: 1.7; }
.welcome-state :deep(.el-button--primary) { --el-button-bg-color: var(--accent); --el-button-border-color: var(--accent); }
.welcome-state :deep(.el-button--primary:hover:not(:disabled)) { --el-button-bg-color: var(--accent-hover); --el-button-border-color: var(--accent-hover); }
.welcome-state :deep(.el-button--primary:focus-visible) { outline: 2px solid rgba(217, 130, 0, 0.35); outline-offset: 1px; }
.suggestion-list { width: min(520px, 100%); margin-top: 24px; display: grid; gap: 8px; }
.suggestion-list button { min-height: 42px; padding: 0 13px; border: 1px solid var(--border-l1); border-radius: 12px; background: var(--cw-bg-page); color: #555b64; display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left; }
.suggestion-list button:hover { border-color: var(--cw-brand-border); background: var(--accent-soft); color: var(--accent-hover); }

.message { display: block; }
.message.user { display: flex; justify-content: flex-end; }
.user-row { display: flex; justify-content: flex-end; }
.user-bubble { max-width: min(525px, 82%); padding: 10px 16px; border-radius: 22px; background: var(--accent-soft); color: var(--text-primary); font-size: 16px; line-height: 24px; white-space: pre-wrap; overflow-wrap: anywhere; }
.assistant-body { font-size: 16px; line-height: 28px; color: var(--text-primary); overflow-wrap: anywhere; }
.assistant-body :deep(p) { margin: 0 0 14px; }
.assistant-body :deep(pre) { padding: 12px 16px; border-radius: 12px; background: var(--code-bg); overflow-x: auto; }
.assistant-body :deep(code) { font-family: var(--cw-font-mono); }
.assistant-body :deep(p code) { padding: 0 5px; border-radius: 6px; background: var(--code-bg); font-size: 0.875em; }
.assistant-body :deep(a) { color: var(--accent); text-decoration: none; }
.assistant-body :deep(blockquote) { margin: 0 0 14px; padding-left: 14px; border-left: 2px solid var(--text-caption); color: var(--text-secondary); }

.live-turn .assistant-body { display: flex; flex-direction: column; gap: 8px; }
.status-shimmer { height: 26px; font-size: 14px; line-height: 26px; font-weight: 500;
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent) 40%, var(--cw-brand-border) 50%, var(--accent) 60%, var(--accent) 100%);
  background-size: 250% 100%; background-clip: text; -webkit-background-clip: text; color: transparent;
  animation: status-shimmer 1.8s linear infinite; }
@keyframes status-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.live-block { display: flex; flex-direction: column; }
.assistant-body .live-block { margin-bottom: 10px; }
.assistant-body .live-block:only-child { margin-bottom: 0; }
.tool-row { position: relative; height: 24px; display: flex; align-items: center; gap: 6px; cursor: pointer; overflow: hidden; }
.tool-row .row-leading { width: 16px; height: 16px; display: grid; place-items: center; color: var(--text-tertiary); font-size: 14px; }
.tool-row .row-title { font-size: 14px; line-height: 24px; color: var(--text-secondary); white-space: nowrap; }
.tool-row .row-dot { color: var(--text-caption); }
.tool-row .row-summary { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 24px; color: var(--text-tertiary); }
.tool-row .row-summary.error-summary { color: var(--error); }
.tool-row[data-state='running']::after {
  content: ''; position: absolute; inset-block: 0; width: 300px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 243, 224, 0.7) 55%, transparent 100%);
  animation: tool-sweep 2.6s ease-out infinite; pointer-events: none; }
@keyframes tool-sweep { 0% { left: -300px; } 90% { left: 100%; } 100% { left: 100%; } }
.state-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
.state-dot.done { background: var(--success); box-shadow: 0 0 0 3px rgba(79, 157, 105, 0.15); }
.state-dot.error { background: var(--error); box-shadow: 0 0 0 3px rgba(217, 83, 79, 0.15); }

.io-card { margin: 4px 0 4px 22px; border: 1px solid var(--border-l1); border-radius: 12px; background: var(--code-bg); font-family: var(--cw-font-mono); font-size: 12px; line-height: 18px; overflow: hidden; }
.io-section { display: grid; grid-template-columns: max-content 1fr; column-gap: 14px; padding: 10px 14px; max-height: 150px; overflow-y: auto; }
.io-label { position: sticky; top: 0; color: var(--text-caption); }
.io-divider { height: 1px; background: var(--border-l2); }
.io-text { white-space: pre-wrap; word-break: break-word; color: var(--text-secondary); }

.composer-seat { position: sticky; bottom: 0; z-index: 7; padding: 16px 16px 20px; background: linear-gradient(180deg, rgba(246, 247, 249, 0) 0%, var(--cw-bg-page) 36px); }
.composer-card { max-width: 780px; margin: 0 auto; padding: 12px 16px 8px; border: 1px solid var(--border-l2); border-radius: 22px; background: #fff; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.02), 0 2px 8px 0 rgba(0, 0, 0, 0.04); }
.composer-card :deep(.el-textarea__inner) { padding: 0; border: 0; box-shadow: none; background: transparent; font-size: 16px; line-height: 24px; }
.composer-row { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; }
.composer-hint { color: var(--text-caption); font-size: 11px; }
.send-btn { width: 34px; height: 34px; border: 0; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; transition: background-color 100ms ease; }
.send-btn:hover:not(:disabled) { background: var(--accent-hover); }
.send-btn:disabled { opacity: 0.4; cursor: default; }

@media (max-width: 820px) { .agent-shell { width: calc(100% - 24px); padding: 12px 0; grid-template-columns: 1fr; } .agent-sidebar { display: none; } .composer-hint { display: none; } }
@media (prefers-reduced-motion: reduce) { .status-shimmer, .tool-row[data-state='running']::after { animation: none; } }
</style>
