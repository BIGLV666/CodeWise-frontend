<template>
  <section class="ai-panel" :class="{ visible }" aria-label="AI 编程助手">
    <header class="ai-header">
      <div class="ai-title">
        <span class="ai-mark"><el-icon><MagicStick /></el-icon></span>
        <strong>CodeWise AI</strong>
      </div>
      <el-tooltip content="关闭 AI 助手" placement="bottom">
        <el-button :icon="Close" circle text size="small" @click="$emit('close')" />
      </el-tooltip>
    </header>

    <div ref="messageAreaRef" class="message-area">
      <el-button
        v-if="hasMore && conversationId"
        class="older-button"
        text
        :loading="historyLoading"
        @click="loadMessages(true)"
      >
        查看更早的消息
      </el-button>

      <div v-if="conversationLoading || (historyLoading && messages.length === 0)" class="panel-loading">
        <el-icon class="is-loading"><Loading /></el-icon><span>正在载入会话</span>
      </div>

      <div v-else-if="!conversationId" class="locked-state">
        <span class="locked-mark"><el-icon><MagicStick /></el-icon></span>
        <h2>提交后开启 AI 助手</h2>
        <p>提交代码后，AI 会结合判题结果分析关键问题并给出下一步建议。</p>
      </div>

      <div v-else-if="messages.length === 0" class="waiting-state">
        <span class="waiting-dot"></span>
        <strong>会话已创建</strong>
        <p>AI 建议生成后会自动显示在这里。</p>
      </div>

      <div v-else class="message-list">
        <article
          v-for="message in visibleMessages"
          :key="String(message.messageId)"
          class="chat-message"
          :class="message.role === 'USER' ? 'user' : 'assistant'"
        >
          <div v-if="message.role !== 'USER'" class="assistant-avatar">
            <el-icon><MagicStick /></el-icon>
          </div>
          <div class="message-body">
            <div
              v-if="message.role !== 'USER' && String(message.messageId) === streamingMessageId"
              class="streaming-text"
            >{{ message.content }}</div>
            <div
              v-else-if="message.role !== 'USER'"
              class="ai-markdown"
              v-html="renderMessageMarkdown(message)"
            ></div>
            <p v-else>{{ message.content }}</p>
          </div>
        </article>

        <div v-if="sending" class="chat-message assistant">
          <div class="assistant-avatar"><el-icon><MagicStick /></el-icon></div>
          <div class="thinking"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>

    <footer class="composer">
      <el-input
        v-model="question"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        maxlength="1000"
        resize="none"
        placeholder="询问当前代码中的问题"
        @keydown.enter.exact.prevent="sendQuestion"
      />
      <div class="composer-actions">
        <el-popover
          v-model:visible="modelPickerVisible"
          placement="top-start"
          :width="420"
          trigger="click"
          popper-class="ai-model-picker-popper"
        >
          <template #reference>
            <button class="model-button" type="button">
              <el-icon><Cpu /></el-icon><span>{{ currentModelLabel }}</span><el-icon><ArrowDown /></el-icon>
            </button>
          </template>

          <div class="model-picker">
            <div class="model-groups">
              <div class="model-group-scroll">
                <button
                  class="model-group-item"
                  :class="{ selected: currentModel === 'auto' }"
                  type="button"
                  @click="selectAutoModel"
                >
                  <span class="group-mark auto"><el-icon><MagicStick /></el-icon></span>
                  <span>Auto</span>
                </button>
                <button
                  v-if="platformModels.length"
                  class="model-group-item"
                  :class="{ active: bindingPlatform }"
                  type="button"
                  @mouseenter="bindingPlatform = true"
                  @focus="bindingPlatform = true"
                  @click="bindingPlatform = true"
                >
                  <span class="group-mark platform"><el-icon><Platform /></el-icon></span>
                  <span class="group-name">平台模型</span>
                  <el-icon class="group-arrow"><ArrowRight /></el-icon>
                </button>
                <button
                  v-for="config in modelConfigs"
                  :key="config.userConfigId"
                  class="model-group-item"
                  :class="{ active: !bindingPlatform && activeConfigId === config.userConfigId }"
                  type="button"
                  @mouseenter="showGroupModels(config.userConfigId)"
                  @focus="showGroupModels(config.userConfigId)"
                  @click="showGroupModels(config.userConfigId)"
                >
                  <span class="group-mark"><el-icon><Cpu /></el-icon></span>
                  <span class="group-name">{{ config.groupName }}</span>
                  <el-icon class="group-arrow"><ArrowRight /></el-icon>
                </button>
              </div>

              <div class="model-menu-actions">
                <button type="button" @click="openCreateConfig">
                  <el-icon><Plus /></el-icon><span>添加模型</span>
                </button>
                <button type="button" @click="openModelSettings">
                  <el-icon><Setting /></el-icon><span>管理模型</span>
                </button>
              </div>
            </div>

            <div class="model-list-panel">
              <template v-if="bindingPlatform">
                <div class="model-list-heading">
                  <strong>平台模型</strong>
                  <span>{{ platformModels.length }} 个模型</span>
                </div>
                <div class="model-list">
                  <button
                    v-for="modelName in platformModels"
                    :key="modelName"
                    class="model-list-item"
                    :class="{ selected: isPlatformModelSelected(modelName) }"
                    type="button"
                    @click="selectPlatformModel(modelName)"
                  >
                    <span>{{ modelName }}</span>
                    <el-icon v-if="isPlatformModelSelected(modelName)"><Check /></el-icon>
                  </button>
                </div>
              </template>
              <template v-else-if="activeModelConfig">
                <div class="model-list-heading">
                  <strong>{{ activeModelConfig.groupName }}</strong>
                  <span>{{ activeModelConfig.modelNames.length }} 个模型</span>
                </div>
                <div class="model-list">
                  <button
                    v-for="modelName in activeModelConfig.modelNames"
                    :key="modelName"
                    class="model-list-item"
                    :class="{
                      selected:
                        selectedConfigId === activeModelConfig.userConfigId &&
                        selectedModelName === modelName,
                    }"
                    type="button"
                    @click="selectCustomModel(activeModelConfig, modelName)"
                  >
                    <span>{{ modelName }}</span>
                    <el-icon v-if="selectedConfigId === activeModelConfig.userConfigId && selectedModelName === modelName">
                      <Check />
                    </el-icon>
                  </button>
                </div>
              </template>
              <div v-else class="model-list-empty">
                <el-icon><Cpu /></el-icon>
                <span>选择一个模型分组</span>
              </div>
            </div>
          </div>
        </el-popover>

        <el-tooltip :content="conversationId ? '发送' : '提交代码后开启'" placement="top">
          <el-button
            :icon="Top"
            circle
            type="primary"
            :loading="sending"
            :disabled="!question.trim()"
            aria-label="发送问题"
            @click="sendQuestion"
          />
        </el-tooltip>
      </div>
    </footer>

    <AiModelConfigDialog v-model="configDialogVisible" mode="create" @saved="handleConfigSaved" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowRight,
  Check,
  Close,
  Cpu,
  Loading,
  MagicStick,
  Platform,
  Plus,
  Setting,
  Top,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import aiApi, {
  type AiAdvicePush,
  type AiConversation,
  type AiMessage,
  type UserAiConfigSummary,
} from '@/api/aiApi'
import websocketService from '@/utils/WebSocket'
import { renderMarkdown } from '@/utils/markdown'
import { buildAiModelParams } from '@/utils/aiModelSelection'
import AiModelConfigDialog from '@/components/ai/AiModelConfigDialog.vue'
import { logWarn } from '@/utils/logger'

const props = defineProps<{
  visible: boolean
  questionId: string | number
  getCurrentCode: () => string
}>()
const router = useRouter()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'advice-ready'): void
}>()

const AI_EVENT = 'ai-advice'
const conversationId = ref('')
const messages = ref<AiMessage[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const historyLoading = ref(false)
const conversationLoading = ref(false)
const loadedQuestionId = ref('')
const sending = ref(false)
const streamingMessageId = ref('')
const question = ref('')
const messageAreaRef = ref<HTMLElement>()
const currentModel = ref('auto')
const modelConfigs = ref<UserAiConfigSummary[]>([])
const platformModels = ref<string[]>([])
// 右侧面板当前展示的是「平台模型」还是某个用户分组；两个来源互斥
const bindingPlatform = ref(false)
const configDialogVisible = ref(false)
const modelPickerVisible = ref(false)
const activeConfigId = ref<number | undefined>()
const selectedConfigId = ref<number | undefined>()
const selectedModelName = ref('')
const markdownCache = new Map<string, { source: string; html: string }>()

// 空内容 ASSISTANT 行（历史遗留的空响应/生成中断占位）不渲染，避免出现空胶囊
const visibleMessages = computed(() =>
  messages.value.filter(
    (message) =>
      message.role !== 'SYSTEM' &&
      !(message.role === 'ASSISTANT' && !(message.content || '').trim())
  )
)
const modelOptions = computed(() => [
  { label: 'Auto', value: 'auto', configId: undefined, modelName: '' },
  ...platformModels.value.map((modelName) => ({
    label: `平台 · ${modelName}`,
    value: `platform:${modelName}`,
    configId: undefined,
    modelName,
  })),
  ...modelConfigs.value.flatMap((config) =>
    (config.modelNames || []).map((modelName) => ({
      label: `${config.groupName} · ${modelName}`,
      value: `${config.userConfigId}:${modelName}`,
      configId: config.userConfigId,
      modelName,
    })),
  ),
])
const currentModelLabel = computed(
  () => modelOptions.value.find((option) => option.value === currentModel.value)?.label || 'Auto',
)
const activeModelConfig = computed(
  () => modelConfigs.value.find((config) => config.userConfigId === activeConfigId.value) || null,
)

const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T

function mapConversation(raw: any): AiConversation {
  return {
    conversationId: String(raw.conversationId),
    questionId: String(raw.questionId),
    userId: String(raw.userId),
    conversationName: raw.conversationName,
  }
}

function mapMessage(raw: any): AiMessage {
  return {
    messageId: String(raw.messageId),
    conversationId: String(raw.conversationId),
    content: raw.content || '',
    userId: raw.userId == null ? undefined : String(raw.userId),
    currentCode: raw.currentCode,
    role: raw.role,
    createTime: raw.createTime,
  }
}

function renderMessageMarkdown(message: AiMessage) {
  const key = String(message.messageId)
  const source = message.content || ''
  const cached = markdownCache.get(key)
  if (cached?.source === source) return cached.html

  const html = renderMarkdown(source)
  markdownCache.set(key, { source, html })
  return html
}

function appendMessage(message: AiMessage) {
  if (messages.value.some((item) => String(item.messageId) === String(message.messageId))) return
  messages.value.push(message)
}

async function loadModelConfigs() {
  try {
    const data = unwrap<UserAiConfigSummary[]>(await aiApi.listConfigs(), [])
    modelConfigs.value = data.map((config) => ({
      ...config,
      userConfigId: Number(config.userConfigId),
      modelNames: config.modelNames || [],
    }))
    if (!activeConfigId.value || !modelConfigs.value.some((config) => config.userConfigId === activeConfigId.value)) {
      activeConfigId.value = selectedConfigId.value || modelConfigs.value[0]?.userConfigId
    }
    resetSelectionIfMissing()
  } catch (error) {
    logWarn('AI 模型配置加载失败:', error)
  }
}

/** 当前选择已不存在（比如平台模型目录变了）时回落到 AUTO，避免标签显示与实际发送的参数不一致。 */
function resetSelectionIfMissing() {
  if (modelOptions.value.some((option) => option.value === currentModel.value)) return
  currentModel.value = 'auto'
  selectedConfigId.value = undefined
  selectedModelName.value = ''
  bindingPlatform.value = false
}

async function loadPlatformModels() {
  try {
    const data = unwrap<string[]>(await aiApi.listPlatformModels(), [])
    platformModels.value = (data || [])
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => name.trim())
  } catch (error) {
    // 目录拿不到就只是隐藏「平台模型」一节：用户自己的分组仍然可用，不该整块报错
    logWarn('平台模型目录加载失败:', error)
    platformModels.value = []
  }
  resetSelectionIfMissing()
}

function compareMessages(left: AiMessage, right: AiMessage) {
  const leftTime = left.createTime ? Date.parse(left.createTime) : Number.NaN
  const rightTime = right.createTime ? Date.parse(right.createTime) : Number.NaN
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime
  }

  try {
    return BigInt(String(left.messageId)).toString() === String(left.messageId) &&
      BigInt(String(right.messageId)).toString() === String(right.messageId)
      ? Number(BigInt(String(left.messageId)) - BigInt(String(right.messageId)))
      : String(left.messageId).localeCompare(String(right.messageId))
  } catch {
    return String(left.messageId).localeCompare(String(right.messageId))
  }
}

function sortMessagesChronologically(records: AiMessage[]) {
  return [...records].sort(compareMessages)
}

async function scrollToBottom() {
  await nextTick()
  if (messageAreaRef.value) messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
}

async function findConversation() {
  const questionId = String(props.questionId || '')
  if (!questionId || conversationLoading.value || loadedQuestionId.value === questionId) return
  conversationLoading.value = true
  try {
    const raw = unwrap<any[]>(await aiApi.listConversations(), [])
    const match = raw
      .map(mapConversation)
      .find((item) => String(item.questionId) === questionId)
    loadedQuestionId.value = questionId
    if (!match) {
      conversationId.value = ''
      messages.value = []
      return
    }
    if (conversationId.value !== String(match.conversationId)) {
      conversationId.value = String(match.conversationId)
      await loadMessages(false)
    }
  } catch (error) {
    loadedQuestionId.value = ''
    logWarn('AI 会话加载失败:', error)
  } finally {
    conversationLoading.value = false
  }
}

async function loadMessages(loadOlder: boolean) {
  if (!conversationId.value || historyLoading.value) return
  historyLoading.value = true
  const previousScrollHeight = messageAreaRef.value?.scrollHeight || 0
  const previousScrollTop = messageAreaRef.value?.scrollTop || 0
  try {
    const data = unwrap<any>(
      await aiApi.getMessages(conversationId.value, {
        cursor: loadOlder ? nextCursor.value : undefined,
        size: 20,
      }),
      {},
    )
    const records = Array.isArray(data.items) ? data.items.map(mapMessage) : []
    messages.value = loadOlder
      ? sortMessagesChronologically([...records, ...messages.value])
      : sortMessagesChronologically(records)
    nextCursor.value = data.nextCursor == null ? null : String(data.nextCursor)
    hasMore.value = Boolean(data.hasMore)
    await nextTick()
    if (messageAreaRef.value) {
      if (loadOlder) {
        messageAreaRef.value.scrollTop =
          previousScrollTop + messageAreaRef.value.scrollHeight - previousScrollHeight
      } else {
        messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
      }
    }
  } catch (error) {
    logWarn('AI 消息加载失败:', error)
  } finally {
    historyLoading.value = false
  }
}

function handleAdvice(raw: unknown) {
  const payload = raw && typeof raw === 'object' && 'result' in raw
    ? (raw as { result?: unknown }).result
    : raw
  if (!payload || typeof payload !== 'object') return

  const advice = payload as AiAdvicePush
  if (!advice.questionId || !advice.conversationId || !advice.aiResponse) return
  if (String(advice.questionId) !== String(props.questionId)) return

  conversationId.value = String(advice.conversationId)
  loadedQuestionId.value = String(props.questionId)
  appendMessage({
    messageId: String(advice.messageId),
    conversationId: String(advice.conversationId),
    content: advice.aiResponse || '',
    role: 'ASSISTANT',
  })
  emit('advice-ready')
  scrollToBottom()
}

async function sendQuestion() {
  const content = question.value.trim()
  if (!content) return
  if (!conversationId.value) {
    ElMessage.info('提交代码后开启 AI 助手')
    return
  }
  if (sending.value) return

  const optimisticId = `local-${Date.now()}`
  appendMessage({
    messageId: optimisticId,
    conversationId: conversationId.value,
    content,
    role: 'USER',
  })
  question.value = ''
  sending.value = true
  await scrollToBottom()
  const streamingId = `stream-${Date.now()}`
  let streamedContent = ''
  let pendingContent = ''
  let streamFrame: number | undefined

  const flushStream = () => {
    streamFrame = undefined
    if (!pendingContent) return

    streamedContent += pendingContent
    pendingContent = ''
    const streamingMessage = messages.value.find(
      (message) => String(message.messageId) === streamingId,
    )
    if (streamingMessage) {
      streamingMessage.content = streamedContent
    } else {
      streamingMessageId.value = streamingId
      messages.value.push({
        messageId: streamingId,
        conversationId: conversationId.value,
        content: streamedContent,
        role: 'ASSISTANT',
      })
    }
    scrollToBottom()
  }

  try {
    const response = await aiApi.askStream(
      {
        conversationId: conversationId.value,
        question: content,
        code: props.getCurrentCode(),
        // 三选一的线上契约见 buildAiModelParams（有单测钉住）
        ...buildAiModelParams({
          userConfigId: selectedConfigId.value,
          modelName: selectedModelName.value,
        }),
      },
      {
        onChunk: (chunk) => {
          pendingContent += chunk
          if (!streamFrame) streamFrame = requestAnimationFrame(flushStream)
        },
      },
    )
    if (streamFrame) cancelAnimationFrame(streamFrame)
    flushStream()
    messages.value = messages.value.filter((message) => String(message.messageId) !== streamingId)
    if (response) appendMessage(mapMessage(response))
  } catch (error) {
    if (streamFrame) cancelAnimationFrame(streamFrame)
    pendingContent = ''
    messages.value = messages.value.filter((message) => String(message.messageId) !== optimisticId)
    messages.value = messages.value.filter((message) => String(message.messageId) !== streamingId)
    question.value = content
    logWarn('AI 追问失败:', error)
    // 必须报给用户：原来这里只写控制台，用户侧表现是"点了发送什么都没发生"
    // （后端其实已经把 ASSISTANT 行置为 FAILED，并回了一个带原因的 error 事件）。
    // 消息文本取服务端下发的枚举文案，例如「该模型暂时无法响应，请更换模型或稍后重试」。
    const text = error instanceof Error ? error.message?.trim() : ''
    ElMessage.error(text || 'AI 生成失败，请稍后重试')
  } finally {
    if (streamingMessageId.value === streamingId) streamingMessageId.value = ''
    sending.value = false
    await scrollToBottom()
  }
}

function selectAutoModel() {
  currentModel.value = 'auto'
  selectedConfigId.value = undefined
  selectedModelName.value = ''
  bindingPlatform.value = false
  modelPickerVisible.value = false
}

function selectPlatformModel(modelName: string) {
  currentModel.value = `platform:${modelName}`
  // 关键：清掉 userAiConfigId，后端才会走「平台指定模型」而不是用户自带配置
  selectedConfigId.value = undefined
  selectedModelName.value = modelName
  bindingPlatform.value = true
  modelPickerVisible.value = false
}

function isPlatformModelSelected(modelName: string) {
  return selectedConfigId.value === undefined && selectedModelName.value === modelName
}

/** 只切换右侧预览的分组，不改动已选模型——避免"只是看了一眼"就把选择改掉。 */
function showGroupModels(configId: number) {
  activeConfigId.value = configId
  bindingPlatform.value = false
}

function selectCustomModel(config: UserAiConfigSummary, modelName: string) {
  currentModel.value = `${config.userConfigId}:${modelName}`
  selectedConfigId.value = config.userConfigId
  selectedModelName.value = modelName
  bindingPlatform.value = false
  modelPickerVisible.value = false
}

function openCreateConfig() {
  modelPickerVisible.value = false
  configDialogVisible.value = true
}

function openModelSettings() {
  modelPickerVisible.value = false
  router.push({ path: '/profile', query: { section: 'ai' } })
}

async function handleConfigSaved() {
  await loadModelConfigs()
}

const stopAdviceListener = websocketService.on(AI_EVENT, handleAdvice)

watch(
  () => props.questionId,
  () => {
    conversationId.value = ''
    messages.value = []
    nextCursor.value = null
    hasMore.value = false
    loadedQuestionId.value = ''
    if (props.visible) findConversation()
  },
)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadModelConfigs()
      loadPlatformModels()
      findConversation()
      scrollToBottom()
    }
  },
)

watch(modelPickerVisible, (visible) => {
  if (!visible) return
  // 打开时预览"当前选中项"所在的那一栏：选了平台模型就亮平台栏，
  // 选了分组就亮该分组，都没选（AUTO）保持上次浏览的分组
  bindingPlatform.value = selectedConfigId.value === undefined && !!selectedModelName.value
  activeConfigId.value = selectedConfigId.value || activeConfigId.value || modelConfigs.value[0]?.userConfigId
})

onBeforeUnmount(() => {
  stopAdviceListener()
})
</script>

<style scoped>
.ai-panel {
  width: 100%;
  height: 100%;
  border: 1px solid #dedfe3;
  border-radius: 6px 6px 0 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}
.ai-header {
  height: 48px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
}
.ai-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #30333a;
  font-size: 14px;
}
.ai-mark,
.assistant-avatar,
.locked-mark {
  display: grid;
  place-items: center;
  color: var(--cw-accent-ai);
}
.ai-mark {
  font-size: 18px;
}
.message-area {
  flex: 1;
  min-height: 0;
  padding: 18px 16px;
  overflow-y: auto;
  scroll-behavior: smooth;
}
.older-button {
  width: 100%;
  margin-bottom: 12px;
}
.panel-loading,
.locked-state,
.waiting-state {
  height: 100%;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.panel-loading {
  gap: 8px;
  color: var(--cw-text-3);
  font-size: 13px;
}
.locked-mark {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: var(--cw-accent-ai-soft);
  font-size: 25px;
}
.locked-state h2,
.waiting-state strong {
  margin: 18px 0 7px;
  color: #444850;
  font-size: 16px;
}
.locked-state p,
.waiting-state p {
  max-width: 260px;
  margin: 0;
  color: var(--cw-text-3);
  font-size: 13px;
  line-height: 1.7;
}
.waiting-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--cw-success);
  box-shadow: 0 0 0 6px #e7f6ed;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.chat-message.user {
  justify-content: flex-end;
}
.assistant-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--cw-accent-ai-soft);
  flex: 0 0 auto;
}
.message-body {
  max-width: calc(100% - 40px);
  color: #34373d;
  font-size: 14px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.user .message-body {
  padding: 9px 12px;
  border-radius: 8px 8px 2px 8px;
  background: #f0f1f3;
}
.message-body > p {
  margin: 0;
  white-space: pre-wrap;
}
.streaming-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ai-markdown :deep(p) {
  margin: 0 0 10px;
}
.ai-markdown :deep(p:last-child),
.ai-markdown :deep(ul:last-child),
.ai-markdown :deep(ol:last-child) {
  margin-bottom: 0;
}
.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  margin: 6px 0 12px;
  padding-left: 20px;
}
.ai-markdown :deep(pre) {
  padding: 10px;
  border-radius: 6px;
  background: var(--cw-bg-page);
  overflow-x: auto;
}
.ai-markdown :deep(code) {
  font-family: var(--cw-font-mono);
  font-size: 12px;
}
.thinking {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: #f5f5f6;
  display: flex;
  align-items: center;
  gap: 4px;
}
.thinking span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #999ea6;
  animation: thinking 1.2s infinite ease-in-out;
}
.thinking span:nth-child(2) {
  animation-delay: 120ms;
}
.thinking span:nth-child(3) {
  animation-delay: 240ms;
}
.composer {
  margin: 0 12px 12px;
  padding: 10px;
  border: 1px solid #d9dce1;
  border-radius: 8px;
  background: #fff;
  flex: 0 0 auto;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.composer:focus-within {
  border-color: #8b73ef;
  box-shadow: 0 0 0 2px rgba(114, 87, 232, 0.1);
}
.composer :deep(.el-textarea__inner) {
  padding: 0;
  border: 0;
  box-shadow: none;
  font-size: 13px;
}
.composer-actions {
  min-height: 32px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.model-button {
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: 5px;
  background: #f4f4f5;
  color: #747982;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  cursor: pointer;
}
.model-button span {
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:global(.ai-model-picker-popper.el-popover) {
  padding: 0;
  overflow: hidden;
}
.model-picker {
  height: clamp(240px, 46vh, 360px);
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  overflow: hidden;
}
.model-groups {
  min-width: 0;
  min-height: 0;
  padding: 6px;
  border-right: 1px solid var(--cw-bg-subtle);
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.model-group-scroll {
  min-height: 0;
  padding-right: 2px;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  overflow-y: scroll;
  scrollbar-gutter: stable;
}
.model-group-item,
.model-menu-actions button,
.model-list-item {
  border: 0;
  background: transparent;
  color: #444850;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.model-group-item {
  width: 100%;
  min-height: 38px;
  padding: 5px 7px;
  border-radius: 5px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}
.model-group-item:hover,
.model-group-item.active {
  background: #f4f5f7;
}
.model-group-item.selected {
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
}
.group-mark {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: var(--cw-accent-ai-soft);
  color: var(--cw-accent-ai);
  display: grid;
  place-items: center;
}
.group-mark.auto {
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
}
.group-mark.platform {
  background: var(--cw-bg-subtle);
  color: var(--cw-info);
}
.group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-arrow {
  color: #a3a7ae;
  font-size: 12px;
}
.model-menu-actions {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--cw-bg-subtle);
  background: #fff;
  flex: 0 0 auto;
}
.model-menu-actions button {
  width: 100%;
  min-height: 32px;
  padding: 0 7px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6f747c;
  font-size: 12px;
}
.model-menu-actions button:hover {
  background: var(--cw-bg-page);
  color: var(--cw-brand-dark);
}
.model-list-panel {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.model-list-heading {
  min-height: 38px;
  padding: 0 4px 10px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
}
.model-list-heading strong {
  min-width: 0;
  color: #30333a;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-list-heading span {
  color: var(--cw-text-3);
  font-size: 11px;
  flex: 0 0 auto;
}
.model-list {
  min-height: 0;
  margin-top: 6px;
  padding-right: 3px;
  flex: 1 1 auto;
  overflow-y: scroll;
  scrollbar-gutter: stable;
}
.model-list-item {
  width: 100%;
  min-height: 36px;
  padding: 7px 8px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.model-list-item span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.model-list-item:hover {
  background: var(--cw-bg-page);
}
.model-list-item.selected {
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
}
.model-list-empty {
  height: 100%;
  color: var(--cw-text-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
}
.model-list-empty .el-icon {
  font-size: 24px;
}
.model-group-scroll::-webkit-scrollbar,
.model-list::-webkit-scrollbar {
  width: 6px;
}
.model-group-scroll::-webkit-scrollbar-track,
.model-list::-webkit-scrollbar-track {
  background: transparent;
}
.model-group-scroll::-webkit-scrollbar-thumb,
.model-list::-webkit-scrollbar-thumb {
  border-radius: 6px;
  background: #cfd3d9;
}
.model-group-scroll::-webkit-scrollbar-thumb:hover,
.model-list::-webkit-scrollbar-thumb:hover {
  background: #adb3bc;
}
.composer :deep(.el-button--primary) {
  --el-button-bg-color: var(--cw-accent-ai);
  --el-button-border-color: var(--cw-accent-ai);
  --el-button-hover-bg-color: #6549dc;
  --el-button-hover-border-color: #6549dc;
}
@keyframes thinking {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  30% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .thinking span {
    animation: none;
  }
}
</style>
