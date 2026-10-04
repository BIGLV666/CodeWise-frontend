<template>
  <el-dialog
    v-model="masteredVisible"
    align-center
    width="420px"
    class="mastered-dialog"
    append-to-body
    @closed="showNextMastered"
  >
    <div class="mastered-body">
      <span class="mastered-icon"><el-icon><Trophy /></el-icon></span>
      <h3>恭喜掌握！</h3>
      <p>{{ masteredContent }}</p>
      <div class="mastered-actions">
        <el-button v-if="masteredQuestionId" type="primary" @click="openMasteredQuestion">
          查看题目<el-icon class="mastered-action-arrow"><ArrowRight /></el-icon>
        </el-button>
        <el-button @click="masteredVisible = false">继续加油</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowRight, Trophy } from '@element-plus/icons-vue'
import { ElNotification } from 'element-plus'
import websocketService from '@/utils/WebSocket'
import { useUserStore } from '@/stores/User'
import { useNotificationStore } from '@/stores/notification'

interface InboxNotification {
  notificationCenterId?: string | number
  messageId?: string
  title?: string
  content?: string
  createTime?: string
}

interface AiAdviceNotification {
  eventId?: string | number
  messageId?: string | number
  conversationId?: string | number
  questionId?: string | number
  judgeStatus?: string
  aiResponse?: string
  createTime?: string
}

/** INBOX_REVIEW 队列推送的“复习掌握祝贺”消息体（后端 ReviewMasteredDto，原始 DTO，不含入库模板文案） */
interface ReviewMasteredMessage {
  messageId?: string
  userId?: string | number
  questionId?: string | number
  questionTitle?: string
  masteredTime?: string
  joinTime?: string
  totalReviewCount?: number | string | null
}

/** 同一队列可能推送每日复习提醒或掌握祝贺，这里取两者字段的最宽结构 */
type ReviewQueueMessage = InboxNotification & Partial<ReviewMasteredMessage>

/** 掌握祝贺幂等键前缀，格式为 review:mastered:{userId}:{questionId} */
const MASTERED_MESSAGE_PREFIX = 'review:mastered:'

const REVIEW_EVENT = 'inbox-review'
const CHECKED_EVENT = 'inbox-checked'
const AI_EVENT = 'ai-advice'
const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { token, userDto } = storeToRefs(userStore)
const seenMessageIds = new Set<string>()
const seenMessageOrder: string[] = []
let unreadRefreshTimer: number | undefined

function refreshUnreadWhenVisible() {
  if (document.visibilityState === 'visible' && token.value) {
    void notificationStore.refreshUnreadCount()
  }
}

function websocketUrl(authToken: string) {
  const configuredUrl = String(import.meta.env.VITE_WS_URL || '').trim()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const baseUrl =
    configuredUrl ||
    (import.meta.env.DEV
      ? 'ws://localhost:8082/websocket'
      : `${protocol}//${window.location.host}/websocket`)
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}token=${encodeURIComponent(authToken)}`
}

function rememberMessage(message: InboxNotification) {
  const key = String(
    message.messageId ??
      message.notificationCenterId ??
      `${message.title || ''}:${message.createTime || ''}`,
  )
  if (seenMessageIds.has(key)) return false

  seenMessageIds.add(key)
  seenMessageOrder.push(key)
  if (seenMessageOrder.length > 100) {
    const oldest = seenMessageOrder.shift()
    if (oldest) seenMessageIds.delete(oldest)
  }
  return true
}

/**
 * 前端按后端入库模板同款规则拼装祝福文案。
 * WebSocket 推送的是原始 DTO，收件箱入库模板不随推送下发，需要前端自行渲染。
 */
function buildMasteredContent(dto: ReviewMasteredMessage): string {
  const joinTime = typeof dto.joinTime === 'string' ? dto.joinTime : ''
  const joinDate = joinTime.length >= 10 ? joinTime.slice(0, 10) : ''
  const joinPhrase = joinDate ? `从 ${joinDate} 开始坚持到现在` : '从加入复习计划以来坚持到现在'
  const count = Number(dto.totalReviewCount)
  const questionTitle = dto.questionTitle && dto.questionTitle.trim() ? dto.questionTitle.trim() : '这道题'
  return `🎉 恭喜！你已掌握《${questionTitle}》，共复习 ${
    Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  } 次。${joinPhrase}，继续保持！`
}

/** 掌握祝贺弹窗：同一时刻只展示一条，多条到达时排队依次展示 */
const masteredQueue = ref<ReviewMasteredMessage[]>([])
const masteredVisible = ref(false)
const masteredContent = ref('')
const masteredQuestionId = ref('')

function showNextMastered() {
  const next = masteredQueue.value.shift()
  if (!next) {
    masteredVisible.value = false
    masteredContent.value = ''
    masteredQuestionId.value = ''
    return
  }
  masteredContent.value = buildMasteredContent(next)
  masteredQuestionId.value = next.questionId == null ? '' : String(next.questionId)
  masteredVisible.value = true
}

function handleReviewMastered(message: ReviewQueueMessage) {
  if (!rememberMessage(message)) return

  notificationStore.refreshUnreadCount()
  masteredQueue.value.push(message as ReviewMasteredMessage)
  if (!masteredVisible.value) showNextMastered()
}

function openMasteredQuestion() {
  const questionId = masteredQuestionId.value
  masteredVisible.value = false
  if (!questionId) return
  // 题目详情页返回键只识别 review/profile/inbox，命中时带上 from 让用户回到原页面
  const currentPath = router.currentRoute.value.path
  const from = ['/review', '/profile', '/inbox'].includes(currentPath) ? currentPath : undefined
  router.push({
    path: '/questiondetailview',
    query: { questionId, ...(from ? { from } : {}) },
  })
}

/**
 * 区分 INBOX_REVIEW 队列的两类消息体：
 * 掌握祝贺是原始 ReviewMasteredDto（messageId 幂等键 review:mastered:*，无 title/content）；
 * 每日复习提醒带 title/content。特征不匹配时按原提醒逻辑兜底。
 */
function isReviewMastered(message: ReviewQueueMessage): boolean {
  const messageId = typeof message.messageId === 'string' ? message.messageId : ''
  if (messageId.startsWith(MASTERED_MESSAGE_PREFIX)) return true
  return !message.title && !message.content && message.questionId != null
}

function handleReviewNotification(message: ReviewQueueMessage) {
  if (isReviewMastered(message)) {
    handleReviewMastered(message)
    return
  }

  notificationStore.refreshUnreadCount()
  const notification = ElNotification({
    title: message.title || '复习提醒',
    message: message.content || '你有新的复习任务，点击查看。',
    type: 'warning',
    position: 'top-right',
    duration: 10000,
    onClick: () => {
      notification.close()
      router.push('/review')
    },
  })
}

function handleCheckedNotification(message: InboxNotification) {
  if (!rememberMessage(message)) return

  notificationStore.refreshUnreadCount()
  const notification = ElNotification({
    title: message.title || '内容审核结果',
    message: message.content || '你的内容审核状态已更新，点击查看详情。',
    type: 'info',
    position: 'top-right',
    duration: 10000,
    onClick: () => {
      notification.close()
      router.push('/inbox')
    },
  })
}

function handleAiAdviceNotification(message: unknown) {
  const payload = message && typeof message === 'object' && 'result' in message
    ? (message as { result?: unknown }).result
    : message
  if (!payload || typeof payload !== 'object') return

  const advice = payload as AiAdviceNotification
  if (!advice.questionId || !advice.conversationId || !advice.aiResponse) return
  if (!rememberMessage(advice as InboxNotification)) return

  ElNotification({
    title: 'AI 建议已生成',
    message: '你的提交已经完成分析，打开 AI 助手查看建议。',
    type: 'info',
    position: 'top-right',
    duration: 6000,
    onClick: () => {
      const questionId = advice.questionId == null ? '' : String(advice.questionId)
      if (questionId) router.push({ path: '/questiondetailview', query: { questionId } })
    },
  })
}

const stopReviewListener = websocketService.on(REVIEW_EVENT, handleReviewNotification)
const stopCheckedListener = websocketService.on(CHECKED_EVENT, handleCheckedNotification)
const stopAiAdviceListener = websocketService.on(AI_EVENT, handleAiAdviceNotification)

watch(
  [token, () => userDto.value?.userId],
  async ([currentToken, currentUserId]) => {
    websocketService.unsubscribe(REVIEW_EVENT)
    websocketService.unsubscribe(CHECKED_EVENT)
    websocketService.unsubscribe(AI_EVENT)

    if (!currentToken || !currentUserId) {
      await websocketService.disconnect(true)
      return
    }

    websocketService.subscribe(REVIEW_EVENT, `/queue/INBOX_REVIEW-${String(currentUserId)}`)
    websocketService.subscribe(CHECKED_EVENT, `/queue/INBOX_CHECKED-${String(currentUserId)}`)
    websocketService.subscribe(AI_EVENT, `/queue/AI_ADVICE-${String(currentUserId)}`)
    await websocketService.connect(websocketUrl(currentToken), currentToken)
  },
  { immediate: true },
)


onMounted(() => {
  refreshUnreadWhenVisible()
  window.addEventListener('focus', refreshUnreadWhenVisible)
  document.addEventListener('visibilitychange', refreshUnreadWhenVisible)
  unreadRefreshTimer = window.setInterval(refreshUnreadWhenVisible, 30_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshUnreadWhenVisible)
  document.removeEventListener('visibilitychange', refreshUnreadWhenVisible)
  if (unreadRefreshTimer) window.clearInterval(unreadRefreshTimer)
  stopReviewListener()
  stopCheckedListener()
  stopAiAdviceListener()
  websocketService.unsubscribe(REVIEW_EVENT)
  websocketService.unsubscribe(CHECKED_EVENT)
  websocketService.disconnect(true)
  websocketService.unsubscribe(AI_EVENT)
})
</script>

<style scoped>
.mastered-body {
  padding: 10px 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.mastered-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fff7e6;
  color: var(--cw-brand-dark);
  font-size: 30px;
  display: grid;
  place-items: center;
}
.mastered-body h3 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 20px;
}
.mastered-body p {
  margin: 0;
  color: #555a62;
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.mastered-actions {
  margin-top: 6px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
.mastered-action-arrow {
  margin-left: 6px;
}
</style>

<style>
/* 弹窗挂载在 body 下，壳层样式需全局声明；主题色与收件箱主按钮保持一致 */
.mastered-dialog {
  border-radius: 12px;
}
.mastered-dialog .el-dialog__header {
  display: none;
}
.mastered-dialog .el-dialog__body {
  padding: 28px 30px 26px;
}
.mastered-dialog .el-button--primary {
  --el-button-bg-color: var(--cw-brand-dark);
  --el-button-border-color: var(--cw-brand-dark);
  --el-button-hover-bg-color: var(--cw-brand-dark);
  --el-button-hover-border-color: var(--cw-brand-dark);
}
</style>
