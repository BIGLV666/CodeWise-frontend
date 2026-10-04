<template>
  <div class="inbox-page">
    <AppNavBar active="inbox">
      <template #actions>
        <el-tooltip content="刷新消息" placement="bottom">
          <el-button :icon="Refresh" circle size="small" :loading="loading" @click="reload" />
        </el-tooltip>
      </template>
    </AppNavBar>

    <div class="page-heading">
      <div>
        <div class="title-line">
          <h1>收件箱</h1>
          <span v-if="notificationStore.unreadCount" class="unread-count">
            {{ notificationStore.unreadCount }} 条未读
          </span>
        </div>
        <p>{{ headingSummary }}</p>
      </div>
      <el-button
        :icon="Check"
        :disabled="notificationStore.unreadCount === 0"
        @click="readAll"
      >
        全部标为已读
      </el-button>
    </div>

    <main class="inbox-workspace" :class="{ 'show-detail': Boolean(detail) }">
      <aside class="message-list-panel">
        <div class="list-tools">
          <el-segmented
            v-model="activeType"
            :options="typeOptions"
            size="small"
            @change="reload"
          />
          <el-checkbox v-model="unreadOnly" label="只看未读" @change="reload" />
        </div>

        <div v-loading="loading && notifications.length === 0" class="message-scroll">
          <div v-if="errorMessage && notifications.length === 0" class="list-state error-state">
            <el-icon><WarningFilled /></el-icon>
            <strong>消息加载失败</strong>
            <el-button text type="primary" @click="reload">重新加载</el-button>
          </div>
          <div v-else-if="!loading && notifications.length === 0" class="list-state">
            <span class="state-icon"><Bell /></span>
            <strong>{{ unreadOnly ? '没有未读消息' : '收件箱是空的' }}</strong>
            <small>新的复习提醒、互动消息和审核结果会出现在这里</small>
          </div>

          <template v-else>
            <button
              v-for="item in primaryNotifications"
              :key="item.notificationCenterId"
              class="message-row"
              :class="{
                active: selectedId === item.notificationCenterId,
                unread: item.isRead === 0,
              }"
              type="button"
              @click="selectNotification(item)"
            >
              <span class="type-icon" :class="item.type.toLowerCase()">
                <el-icon>
                  <Calendar v-if="item.type === 'REVIEW'" />
                  <Trophy v-else-if="item.type === 'REVIEW_MASTERED'" />
                  <CircleCheck v-else-if="item.type === 'CHECKED'" />
                  <Pointer v-else />
                </el-icon>
              </span>
              <span class="message-copy">
                <span class="message-meta">
                  <span>{{ typeLabel(item.type) }}</span>
                  <time>{{ formatListTime(item.createTime) }}</time>
                </span>
                <strong>{{ item.title || fallbackTitle(item.type) }}</strong>
              </span>
              <span v-if="item.isRead === 0" class="message-dot" aria-label="未读"></span>
            </button>

            <div v-if="activeType === 'ALL' && likeNotifications.length" class="like-group">
              <button class="like-group-toggle" type="button" @click="likesExpanded = !likesExpanded">
                <span class="type-icon like"><el-icon><Pointer /></el-icon></span>
                <span><strong>点赞消息</strong><small>{{ likeNotifications.length }} 条</small></span>
                <el-icon class="group-arrow" :class="{ expanded: likesExpanded }"><ArrowRight /></el-icon>
              </button>
              <div v-show="likesExpanded" class="like-group-list">
                <button
                  v-for="item in likeNotifications"
                  :key="item.notificationCenterId"
                  class="message-row compact"
                  :class="{
                    active: selectedId === item.notificationCenterId,
                    unread: item.isRead === 0,
                  }"
                  type="button"
                  @click="selectNotification(item)"
                >
                  <span class="message-copy">
                    <strong>{{ item.title || fallbackTitle(item.type) }}</strong>
                    <time>{{ formatListTime(item.createTime) }}</time>
                  </span>
                  <span v-if="item.isRead === 0" class="message-dot" aria-label="未读"></span>
                </button>
              </div>
            </div>

            <div class="load-more">
              <el-button v-if="hasNext" text :loading="loading" @click="loadNotifications">
                加载更早的消息
              </el-button>
              <span v-else>已经到底了</span>
            </div>
          </template>
        </div>
      </aside>

      <section class="message-detail-panel">
        <el-skeleton v-if="detailLoading" :rows="6" animated />
        <div v-else-if="!detail" class="detail-empty">
          <span class="detail-empty-icon"><Message /></span>
          <h2>选择一条消息</h2>
          <p>消息正文和相关操作会显示在这里</p>
        </div>
        <article v-else class="message-detail">
          <div class="detail-toolbar">
            <button class="mobile-back" type="button" @click="closeDetail">
              <el-icon><ArrowLeft /></el-icon><span>返回消息列表</span>
            </button>
            <el-tooltip content="删除消息" placement="bottom">
              <el-button :icon="Delete" circle text @click="removeSelected" />
            </el-tooltip>
          </div>

          <div class="detail-heading">
            <span class="detail-type-icon" :class="detail.type.toLowerCase()">
              <el-icon>
                <Calendar v-if="detail.type === 'REVIEW'" />
                <Trophy v-else-if="detail.type === 'REVIEW_MASTERED'" />
                <CircleCheck v-else-if="detail.type === 'CHECKED'" />
                <Pointer v-else />
              </el-icon>
            </span>
            <div>
              <span class="detail-kind">{{ typeLabel(detail.type) }}</span>
              <h2>{{ detail.title || fallbackTitle(detail.type) }}</h2>
              <time>{{ formatDetailTime(detail.createTime) }}</time>
            </div>
          </div>

          <div class="detail-content">{{ detail.content || '暂无详细内容' }}</div>

          <div class="detail-footer">
            <span>{{ actionHint }}</span>
            <el-button v-if="canOpenBusiness" type="primary" @click="openBusiness">
              {{ actionLabel }}<el-icon class="action-arrow"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CircleCheck,
  Delete,
  Message,
  Pointer,
  Refresh,
  Trophy,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import notificationApi, {
  type NotificationDetail,
  type NotificationLikeExtraData,
  type NotificationSummary,
  type NotificationType,
} from '@/api/notificationApi'
import { useNotificationStore } from '@/stores/notification'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import { navigateTopLevel } from '@/utils/navigation'

const router = useRouter()
const notificationStore = useNotificationStore()
const typeOptions = [
  { label: '全部', value: 'ALL' },
  { label: '复习', value: 'REVIEW' },
  { label: '点赞', value: 'LIKE' },
  { label: '审核', value: 'CHECKED' },
]
const activeType = ref<'ALL' | NotificationType>('ALL')
const unreadOnly = ref(false)
const likesExpanded = ref(false)
const notifications = ref<NotificationSummary[]>([])
const loading = ref(false)
const detailLoading = ref(false)
const detail = ref<NotificationDetail | null>(null)
const selectedId = ref('')
const nextCursor = ref<string | null>(null)
const hasNext = ref(false)
const errorMessage = ref('')

const reviewNotifications = computed(() => notifications.value.filter((item) => item.type === 'REVIEW'))
const likeNotifications = computed(() => notifications.value.filter((item) => item.type === 'LIKE'))
const checkedNotifications = computed(() => notifications.value.filter((item) => item.type === 'CHECKED'))
const primaryNotifications = computed(() =>
  activeType.value === 'LIKE'
    ? likeNotifications.value
    : activeType.value === 'CHECKED'
      ? checkedNotifications.value
      : activeType.value === 'ALL'
        ? notifications.value.filter((item) => item.type !== 'LIKE')
        : reviewNotifications.value,
)
const headingSummary = computed(() => {
  if (notificationStore.unreadCount > 0) return '你有新的复习计划、互动消息或审核结果'
  return '所有消息都已处理'
})

const likeExtra = computed<NotificationLikeExtraData>(() => detail.value?.extraData || {})
const rootId = computed(() => likeExtra.value.rootId || detail.value?.businessId || '')
const canOpenBusiness = computed(() => {
  if (!detail.value) return false
  if (detail.value.type === 'REVIEW') return true
  if (detail.value.type === 'REVIEW_MASTERED') return Boolean(detail.value.businessId)
  if (likeExtra.value.rootType === 'POST') return Boolean(rootId.value)
  if (likeExtra.value.rootType === 'SOLUTION') {
    return Boolean(rootId.value && likeExtra.value.questionId)
  }
  return Boolean(detail.value.businessId)
})
const actionLabel = computed(() => {
  if (detail.value?.type === 'REVIEW') return '前往复习'
  if (detail.value?.type === 'REVIEW_MASTERED') return '查看题目'
  if (detail.value?.type === 'CHECKED') {
    if (detail.value.businessType === 'COMMENT') return '查看评论'
    if (likeExtra.value.rootType === 'SOLUTION') return '查看题解'
    return '查看帖子'
  }
  if (detail.value?.businessType === 'COMMENT') return '查看评论'
  if (likeExtra.value.rootType === 'SOLUTION' || detail.value?.businessType === 'SOLUTION') {
    return '查看题解'
  }
  return '查看帖子'
})
const actionHint = computed(() => {
  if (detail.value?.type === 'REVIEW') return '打开今日复习计划继续学习'
  if (detail.value?.type === 'REVIEW_MASTERED') return '回顾这道你已经掌握的题目'
  if (detail.value?.type === 'CHECKED') return '查看审核内容及完整上下文'
  return '前往相关内容查看完整上下文'
})

const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T

function normalizeExtraData(raw: any): NotificationLikeExtraData | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    userId: raw.userId == null ? undefined : String(raw.userId),
    userName: raw.userName,
    nickName: raw.nickName,
    avatarUrl: raw.avatarUrl,
    rootId: raw.rootId == null ? undefined : String(raw.rootId),
    rootType: raw.rootType,
    rootCommentId: raw.rootCommentId == null ? undefined : String(raw.rootCommentId),
    questionId: raw.questionId == null ? undefined : String(raw.questionId),
  }
}

function mapSummary(raw: any): NotificationSummary {
  return {
    notificationCenterId: String(raw.notificationCenterId),
    messageId: raw.messageId,
    title: raw.title || '未命名通知',
    type: raw.type,
    businessType: raw.businessType,
    businessId: raw.businessId == null ? undefined : String(raw.businessId),
    userId: raw.userId == null ? undefined : String(raw.userId),
    isRead: Number(raw.isRead || 0),
    createTime: raw.createTime,
  }
}

function mapDetail(raw: any): NotificationDetail {
  return {
    ...mapSummary(raw),
    content: raw.content,
    extraData: normalizeExtraData(raw.extraData),
  }
}

async function loadNotifications() {
  if (loading.value || (notifications.value.length > 0 && !hasNext.value)) return
  loading.value = true
  errorMessage.value = ''
  try {
    const data = unwrap<any>(
      await notificationApi.list({
        pageSize: 20,
        lastId: nextCursor.value,
        type: activeType.value === 'ALL' ? undefined : activeType.value,
        unreadOnly: unreadOnly.value,
      }),
      {},
    )
    const records = Array.isArray(data.records) ? data.records.map(mapSummary) : []
    notifications.value.push(
      ...records.filter(
        (item: NotificationSummary) =>
          !notifications.value.some((old) => old.notificationCenterId === item.notificationCenterId),
      ),
    )
    nextCursor.value = data.nextCursor == null ? null : String(data.nextCursor)
    hasNext.value = Boolean(data.hasNext)
  } catch (error) {
    errorMessage.value = '消息加载失败，请稍后重试'
    console.error('通知列表加载失败:', error)
  } finally {
    loading.value = false
  }
}

async function reload() {
  notifications.value = []
  nextCursor.value = null
  hasNext.value = false
  detail.value = null
  selectedId.value = ''
  await Promise.all([loadNotifications(), notificationStore.refreshUnreadCount()])
}

async function selectNotification(item: NotificationSummary) {
  selectedId.value = item.notificationCenterId
  detailLoading.value = true
  const wasUnread = item.isRead === 0
  try {
    const raw = unwrap<any>(await notificationApi.getDetail(item.notificationCenterId), null)
    detail.value = raw ? mapDetail(raw) : null
    if (wasUnread) {
      item.isRead = 1
      notificationStore.markOneRead()
    }
  } catch (error) {
    ElMessage.error('消息详情加载失败，请稍后重试')
    console.error('通知详情加载失败:', error)
  } finally {
    detailLoading.value = false
  }
}

async function readAll() {
  try {
    await notificationApi.markAllAsRead(activeType.value === 'ALL' ? undefined : activeType.value)
    notifications.value.forEach((item) => {
      if (activeType.value === 'ALL' || item.type === activeType.value) item.isRead = 1
    })
    await notificationStore.refreshUnreadCount()
    ElMessage.success('已全部标记为已读')
  } catch (error) {
    console.error('全部已读失败:', error)
  }
}

async function removeSelected() {
  if (!detail.value) return
  try {
    await ElMessageBox.confirm('删除后无法恢复，确定继续吗？', '删除消息', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const id = detail.value.notificationCenterId
    await notificationApi.remove(id)
    notifications.value = notifications.value.filter((item) => item.notificationCenterId !== id)
    closeDetail()
    ElMessage.success('消息已删除')
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') console.error('删除通知失败:', error)
  }
}

function closeDetail() {
  detail.value = null
  selectedId.value = ''
}

function openBusiness() {
  if (!detail.value) return
  if (detail.value.type === 'REVIEW') {
    navigateTopLevel(router, '/review')
    return
  }

  // 掌握祝贺消息：businessId 即题目 ID，跳转到题目详情页
  if (detail.value.type === 'REVIEW_MASTERED') {
    const questionId = detail.value.businessId
    if (questionId) {
      router.push({ path: '/questiondetailview', query: { questionId, from: '/inbox' } })
    }
    return
  }

  if (likeExtra.value.rootType === 'POST' && rootId.value) {
    router.push({
      path: `/discuss/${rootId.value}`,
      query: likeExtra.value.rootCommentId ? { commentId: likeExtra.value.rootCommentId } : undefined,
    })
    return
  }

  if (likeExtra.value.rootType === 'SOLUTION' && rootId.value && likeExtra.value.questionId) {
    router.push({
      path: '/questiondetailview',
      query: {
        questionId: likeExtra.value.questionId,
        tab: 'solution',
        solutionId: rootId.value,
        from: '/inbox',
      },
    })
    return
  }

  const id = detail.value.businessId
  if (detail.value.businessType === 'POST' && id) router.push(`/discuss/${id}`)
  else if (detail.value.businessType === 'SOLUTION' && id && likeExtra.value.questionId) {
    router.push({
      path: '/questiondetailview',
      query: { questionId: likeExtra.value.questionId, tab: 'solution', solutionId: id, from: '/inbox' },
    })
  }
}

const typeLabel = (type: NotificationType) => {
  if (type === 'REVIEW') return '复习提醒'
  if (type === 'REVIEW_MASTERED') return '掌握祝贺'
  if (type === 'CHECKED') return '审核结果'
  return '互动消息'
}
const fallbackTitle = (type: NotificationType) => {
  if (type === 'REVIEW') return '新的复习提醒'
  if (type === 'REVIEW_MASTERED') return '恭喜掌握一道题目'
  if (type === 'CHECKED') return '内容审核状态已更新'
  return '收到新的点赞'
}

function formatListTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const formatDetailTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN') : '')

onMounted(reload)
</script>

<style scoped>
.inbox-page {
  min-height: 100vh;
  background: #f5f6f8;
  color: var(--cw-text-1);
}
.navbar {
  height: 58px;
  padding: 0 32px;
  border-bottom: 1px solid var(--cw-border);
  background: #fff;
  display: flex;
  align-items: center;
  gap: 36px;
}
.brand {
  padding: 0;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--cw-text-1);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--cw-brand);
  color: #fff;
  display: grid;
  place-items: center;
}
.navbar nav {
  flex: 1;
  align-self: stretch;
  display: flex;
  gap: 26px;
}
.navbar nav button {
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #666b73;
  cursor: pointer;
}
.navbar nav button:hover,
.navbar nav button.active {
  color: var(--cw-brand-dark);
}
.navbar nav button.active {
  border-bottom-color: var(--cw-brand);
}
.page-heading {
  width: min(1240px, calc(100% - 64px));
  margin: 0 auto;
  padding: 34px 0 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-heading h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: 0;
}
.page-heading p {
  margin: 8px 0 0;
  color: var(--cw-text-3);
  font-size: 14px;
}
.unread-count {
  padding: 3px 8px;
  border-radius: 4px;
  background: #fff1f0;
  color: var(--cw-danger);
  font-size: 12px;
  font-weight: 600;
}
.inbox-workspace {
  width: min(1240px, calc(100% - 64px));
  height: calc(100vh - 164px);
  min-height: 590px;
  margin: 0 auto 28px;
  border: 1px solid #e2e5e9;
  border-radius: 8px;
  background: #fff;
  display: grid;
  grid-template-columns: 390px minmax(0, 1fr);
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(27, 31, 36, 0.04);
}
.message-list-panel {
  min-width: 0;
  border-right: 1px solid var(--cw-border);
  display: flex;
  flex-direction: column;
}
.list-tools {
  min-height: 62px;
  padding: 0 16px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  background: #fbfbfc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.message-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.message-row {
  width: 100%;
  min-height: 82px;
  padding: 14px 16px;
  border: 0;
  border-bottom: 1px solid #eff0f2;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}
.message-row:hover {
  background: var(--cw-bg-page);
}
.message-row.active {
  background: #fff8eb;
  box-shadow: inset 3px 0 var(--cw-brand);
}
.type-icon,
.detail-type-icon,
.state-icon,
.detail-empty-icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
}
.type-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 17px;
}
.type-icon.review {
  background: #eaf7ef;
  color: var(--cw-success);
}
.type-icon.review_mastered,
.detail-type-icon.review_mastered {
  background: #fdf3e7;
  color: var(--cw-brand-dark);
}
.type-icon.like {
  background: #fff2e3;
  color: var(--cw-brand-dark);
}
.type-icon.checked {
  background: #edf3ff;
  color: #4776d0;
}
.message-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #8b9098;
  font-size: 11px;
}
.message-copy strong {
  overflow: hidden;
  color: #555a62;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message-row.unread .message-copy strong {
  color: var(--cw-text-1);
  font-weight: 650;
}
.message-copy time {
  color: #9b9fa6;
  font-size: 11px;
}
.message-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--cw-danger);
  flex: 0 0 auto;
}
.like-group {
  border-bottom: 1px solid var(--cw-bg-subtle);
}
.like-group-toggle {
  width: 100%;
  min-height: 66px;
  padding: 12px 16px;
  border: 0;
  background: #fbfbfc;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}
.like-group-toggle > span:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.like-group-toggle strong {
  font-size: 13px;
}
.like-group-toggle small {
  color: #999da4;
  font-size: 11px;
}
.group-arrow {
  color: #969ba3;
  transition: transform 160ms ease;
}
.group-arrow.expanded {
  transform: rotate(90deg);
}
.like-group-list {
  border-top: 1px solid var(--cw-bg-subtle);
}
.message-row.compact {
  min-height: 64px;
  padding-left: 64px;
}
.message-row.compact .message-copy {
  gap: 4px;
}
.load-more {
  min-height: 50px;
  color: var(--cw-text-3);
  font-size: 12px;
  display: grid;
  place-items: center;
}
.list-state {
  min-height: 320px;
  padding: 32px;
  color: #7c8189;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.list-state strong {
  color: #4c5158;
  font-size: 14px;
}
.list-state small {
  font-size: 12px;
}
.state-icon {
  width: 44px;
  height: 44px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: var(--cw-bg-page);
  color: #8d9299;
  font-size: 20px;
}
.error-state > .el-icon {
  color: var(--cw-danger);
  font-size: 24px;
}
.message-detail-panel {
  min-width: 0;
  padding: 0;
  overflow-y: auto;
}
.message-detail-panel > .el-skeleton {
  padding: 52px;
}
.detail-empty {
  height: 100%;
  color: #8f949c;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.detail-empty-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  background: var(--cw-bg-page);
  color: #9a9fa6;
  font-size: 27px;
}
.detail-empty h2 {
  margin: 18px 0 6px;
  color: #4d5259;
  font-size: 18px;
}
.detail-empty p {
  margin: 0;
  font-size: 13px;
}
.message-detail {
  min-height: 100%;
  padding: 24px 52px 38px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.detail-toolbar {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.detail-heading {
  padding: 44px 0 30px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: flex-start;
  gap: 18px;
}
.detail-type-icon {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  font-size: 21px;
}
.detail-type-icon.review {
  background: #eaf7ef;
  color: var(--cw-success);
}
.detail-type-icon.like {
  background: #fff2e3;
  color: var(--cw-brand-dark);
}
.detail-type-icon.checked {
  background: #edf3ff;
  color: #4776d0;
}
.detail-kind {
  color: #8a8f97;
  font-size: 12px;
}
.detail-heading h2 {
  max-width: 720px;
  margin: 8px 0 9px;
  color: var(--cw-text-1);
  font-size: 26px;
  line-height: 1.42;
  letter-spacing: 0;
}
.detail-heading time {
  color: #a0a4aa;
  font-size: 12px;
}
.detail-content {
  flex: 1;
  padding: 34px 0 46px 64px;
  color: #454a51;
  font-size: 16px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.detail-footer {
  min-height: 76px;
  padding: 18px 0 18px 64px;
  border-top: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.detail-footer > span {
  color: #8b9097;
  font-size: 12px;
}
.action-arrow {
  margin-left: 6px;
}
.mobile-back {
  display: none;
}
.inbox-page :deep(.el-segmented) {
  --el-segmented-item-selected-bg-color: #fff;
}
.inbox-page :deep(.el-button--primary) {
  --el-button-bg-color: var(--cw-brand-dark);
  --el-button-border-color: var(--cw-brand-dark);
  --el-button-hover-bg-color: var(--cw-brand-dark);
  --el-button-hover-border-color: var(--cw-brand-dark);
}
@media (max-width: 820px) {
  .navbar {
    padding: 0 16px;
  }
  .navbar nav {
    display: none;
  }
  .page-heading {
    width: calc(100% - 32px);
    padding: 24px 0 16px;
  }
  .page-heading h1 {
    font-size: 24px;
  }
  .page-heading p {
    display: none;
  }
  .page-heading > .el-button {
    padding: 8px 10px;
  }
  .inbox-workspace {
    width: calc(100% - 20px);
    height: calc(100vh - 132px);
    min-height: 520px;
    margin: 0 10px 10px;
    grid-template-columns: 1fr;
  }
  .message-list-panel {
    border-right: 0;
  }
  .message-detail-panel {
    display: none;
  }
  .inbox-workspace.show-detail .message-list-panel {
    display: none;
  }
  .inbox-workspace.show-detail .message-detail-panel {
    display: block;
  }
  .message-detail {
    padding: 18px 22px 28px;
  }
  .detail-toolbar {
    justify-content: space-between;
  }
  .mobile-back {
    padding: 0;
    border: 0;
    background: transparent;
    color: #686d74;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .detail-heading {
    padding: 28px 0 24px;
  }
  .detail-heading h2 {
    font-size: 21px;
  }
  .detail-content,
  .detail-footer {
    padding-left: 0;
  }
  .detail-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
