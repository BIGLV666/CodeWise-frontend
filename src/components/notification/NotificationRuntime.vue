<template></template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElNotification } from 'element-plus'
import websocketService from '@/utils/WebSocket'
import { useUserStore } from '@/stores/User'
import { useNotificationStore } from '@/stores/notification'

interface ReviewNotification {
  notificationCenterId?: string | number
  messageId?: string
  title?: string
  content?: string
  createTime?: string
}

const REVIEW_EVENT = 'inbox-review'
const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { token, userDto } = storeToRefs(userStore)
const seenMessageIds = new Set<string>()
const seenMessageOrder: string[] = []

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

function rememberMessage(message: ReviewNotification) {
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

function handleReviewNotification(message: ReviewNotification) {
  if (!rememberMessage(message)) return

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

const stopReviewListener = websocketService.on(REVIEW_EVENT, handleReviewNotification)

watch(
  [token, () => userDto.value?.userId],
  async ([currentToken, currentUserId]) => {
    websocketService.unsubscribe(REVIEW_EVENT)

    if (!currentToken || !currentUserId) {
      await websocketService.disconnect(true)
      return
    }

    websocketService.subscribe(REVIEW_EVENT, `/queue/INBOX_REVIEW-${String(currentUserId)}`)
    await websocketService.connect(websocketUrl(currentToken), currentToken)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopReviewListener()
  websocketService.unsubscribe(REVIEW_EVENT)
  websocketService.disconnect(true)
})
</script>
