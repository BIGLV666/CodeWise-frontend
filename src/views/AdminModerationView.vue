<template>
  <div class="moderation-page">
      <main class="page-content">
        <section class="page-heading">
          <div>
            <span class="eyebrow">ADMIN · CONTENT MODERATION</span>
            <h1>内容审核台</h1>
            <p>帖子与题解先审后发，评论即时发布可下架</p>
          </div>
          <div class="heading-actions">
            <div class="refresh-state">
              <span>{{ lastUpdatedText }}</span>
            </div>
            <el-tooltip content="刷新" placement="bottom">
              <el-button
                :icon="Refresh"
                circle
                :loading="loading"
                aria-label="刷新当前列表"
                @click="loadList(true)"
              />
            </el-tooltip>
          </div>
        </section>

      <el-tabs v-model="activeTab" class="moderation-tabs" @tab-change="onTabChange">
        <el-tab-pane name="POST">
          <template #label>
            <span class="tab-label">待审帖子</span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="SOLUTION">
          <template #label>
            <span class="tab-label">待审题解</span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="COMMENT">
          <template #label>
            <span class="tab-label">已发布评论</span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <el-alert
        v-if="activeTab === 'COMMENT'"
        title="评论采用即时发布，此处列出的是已发布评论，仅支持下架与恢复。"
        type="info"
        :closable="false"
        show-icon
        class="mode-alert"
      />

      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
        class="load-alert"
      />

      <section class="list-section" aria-label="审核列表">
        <div v-if="loading && rows.length === 0" class="skeleton-list">
          <el-skeleton v-for="index in 4" :key="index" :rows="3" animated />
        </div>

        <el-empty v-else-if="rows.length === 0" :description="emptyText" />

        <div v-else class="row-list">
          <article v-for="row in rows" :key="row.id" class="content-row">
            <div class="row-main">
              <div class="row-head">
                <strong class="row-title">{{ row.title || '（无标题）' }}</strong>
                <el-tag :type="statusTag(row.status).type" size="small" effect="plain">
                  {{ statusTag(row.status).label }}
                </el-tag>
              </div>
              <p class="row-excerpt">{{ excerpt(row.content) }}</p>
              <div class="row-meta">
                <span>{{ row.userName || `用户 ${row.userId ?? '未知'}` }}</span>
                <span v-if="row.createTime">{{ formatTime(row.createTime) }}</span>
                <code class="row-id" :title="row.id">#{{ row.id }}</code>
              </div>
            </div>

            <div class="row-actions">
              <el-button text :icon="View" size="small" @click="openDetail(row)">详情</el-button>

              <template v-if="activeTab !== 'COMMENT'">
                <el-button
                  type="success"
                  size="small"
                  plain
                  :loading="pendingIds.has(row.id)"
                  @click="review(row, CONTENT_STATUS.NORMAL)"
                >
                  通过
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  plain
                  :loading="pendingIds.has(row.id)"
                  @click="review(row, CONTENT_STATUS.TAKE_DOWN)"
                >
                  拒绝
                </el-button>
              </template>

              <template v-else>
                <el-button
                  v-if="row.status !== CONTENT_STATUS.TAKE_DOWN"
                  type="danger"
                  size="small"
                  plain
                  :loading="pendingIds.has(row.id)"
                  @click="changeStatus(row, CONTENT_STATUS.TAKE_DOWN)"
                >
                  下架
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  size="small"
                  plain
                  :loading="pendingIds.has(row.id)"
                  @click="changeStatus(row, CONTENT_STATUS.NORMAL)"
                >
                  恢复
                </el-button>
              </template>
            </div>
          </article>
        </div>

        <div v-if="hasNext" class="load-more">
          <el-button :loading="loadingMore" text @click="loadMore">加载更多</el-button>
        </div>
      </section>
    </main>

    <el-drawer v-model="detailVisible" :title="detailTitle" size="46%">
      <el-skeleton v-if="detailLoading" :rows="6" animated />
      <div v-else-if="detail" class="detail-body">
        <div class="detail-field">
          <span>作者</span>
          <strong>{{ detail.userDto?.userName || detail.userId || '未知' }}</strong>
        </div>
        <div class="detail-field">
          <span>状态</span>
          <el-tag :type="statusTag(detail.status).type" size="small" effect="plain">
            {{ statusTag(detail.status).label }}
          </el-tag>
        </div>
        <div v-if="detail.tags?.length" class="detail-field">
          <span>标签</span>
          <div class="detail-tags">
            <el-tag v-for="tag in detail.tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
          </div>
        </div>
        <div v-if="detail.createTime" class="detail-field">
          <span>发布时间</span>
          <strong>{{ formatTime(detail.createTime) }}</strong>
        </div>
        <div class="detail-content">
          <span class="detail-content-label">正文</span>
          <pre>{{ detail.content }}</pre>
        </div>
      </div>
      <el-empty v-else description="详情加载失败" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminModerationApi, {
  CONTENT_STATUS,
  type CheckDetail,
  type ModerationTargetType,
} from '@/api/adminModerationApi'
import { errorText } from '@/api/request'

type TagType = 'success' | 'warning' | 'danger' | 'info'

/** 三种内容归一化后的列表行，避免模板里到处判类型。 */
interface ModerationRow {
  id: string
  type: ModerationTargetType
  title: string | null
  content: string
  userId: string | null
  userName: string | null
  status: number
  createTime: string | null
}

const PAGE_SIZE = 20

const router = useRouter()
const activeTab = ref<ModerationTargetType>('POST')
const rows = ref<ModerationRow[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const hasNext = ref(false)
const nextCursor = ref<string | null>(null)
const lastUpdatedAt = ref<Date | null>(null)
const pendingIds = ref(new Set<string>())

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<CheckDetail | null>(null)

const emptyText = computed(() => {
  if (activeTab.value === 'COMMENT') return '暂无评论'
  return '没有待审核内容'
})

const detailTitle = computed(() => {
  if (!detail.value) return '内容详情'
  const typeText = { POST: '帖子', SOLUTION: '题解', COMMENT: '评论' }[detail.value.type] ?? '内容'
  return `${typeText}详情`
})

const lastUpdatedText = computed(() => lastUpdatedAt.value
  ? `更新于 ${lastUpdatedAt.value.toLocaleTimeString('zh-CN', { hour12: false })}`
  : '尚未更新')

function statusTag(status: number): { label: string; type: TagType } {
  if (status === CONTENT_STATUS.PENDING) return { label: '待审核', type: 'warning' }
  if (status === CONTENT_STATUS.TAKE_DOWN) return { label: '已下架', type: 'danger' }
  if (status === CONTENT_STATUS.NORMAL) return { label: '正常', type: 'success' }
  return { label: '未知', type: 'info' }
}

function excerpt(content: string) {
  const text = (content || '').replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || '（无正文）'
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function toRow(raw: any, type: ModerationTargetType): ModerationRow {
  if (type === 'POST') {
    return {
      id: String(raw.postId),
      type,
      title: raw.postTitle ?? null,
      content: raw.postContent ?? '',
      userId: raw.userId != null ? String(raw.userId) : null,
      userName: raw.userName ?? null,
      status: Number(raw.status ?? CONTENT_STATUS.PENDING),
      createTime: raw.createTime ?? null,
    }
  }
  if (type === 'SOLUTION') {
    const author = raw.solutionUserId ?? raw.userId
    return {
      id: String(raw.solutionId),
      type,
      title: raw.solutionTitle ?? null,
      content: raw.solutionContent ?? '',
      userId: author != null ? String(author) : null,
      userName: raw.userName ?? null,
      status: Number(raw.status ?? CONTENT_STATUS.PENDING),
      createTime: raw.createTime ?? null,
    }
  }
  return {
    id: String(raw.commentId),
    type,
    title: null,
    content: raw.comment ?? '',
    userId: raw.userId != null ? String(raw.userId) : null,
    userName: raw.userName ?? null,
    status: Number(raw.status ?? CONTENT_STATUS.NORMAL),
    createTime: raw.createTime ?? null,
  }
}

function fetchPage(type: ModerationTargetType, lastId: string | null) {
  const params = { lastId, pageSize: PAGE_SIZE }
  if (type === 'POST') return adminModerationApi.listPendingPosts(params)
  if (type === 'SOLUTION') return adminModerationApi.listPendingSolutions(params)
  return adminModerationApi.listComments(params)
}

async function loadList(reset = false) {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  const type = activeTab.value
  try {
    const response: any = await fetchPage(type, reset ? null : nextCursor.value)
    const page = response?.data ?? response ?? {}
    const list = Array.isArray(page.list) ? page.list : []
    // 切页期间用户可能已切换标签，丢弃过期响应。
    if (type !== activeTab.value) return
    rows.value = list.map((item: any) => toRow(item, type))
    
    // 计算下一个游标（最后一项的 ID）
    if (list.length > 0) {
      const lastItem = list[list.length - 1]
      if (type === 'POST') nextCursor.value = String(lastItem.postId)
      else if (type === 'SOLUTION') nextCursor.value = String(lastItem.solutionId)
      else nextCursor.value = String(lastItem.commentId)
    }
    
    hasNext.value = Boolean(page.hasMore)
    lastUpdatedAt.value = new Date()
  } catch (error) {
    loadError.value = errorText(error, '审核列表加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasNext.value) return
  loadingMore.value = true
  const type = activeTab.value
  try {
    const response: any = await fetchPage(type, nextCursor.value)
    const page = response?.data ?? response ?? {}
    const list = Array.isArray(page.list) ? page.list : []
    if (type !== activeTab.value) return
    rows.value = [...rows.value, ...list.map((item: any) => toRow(item, type))]
    
    // 计算下一个游标
    if (list.length > 0) {
      const lastItem = list[list.length - 1]
      if (type === 'POST') nextCursor.value = String(lastItem.postId)
      else if (type === 'SOLUTION') nextCursor.value = String(lastItem.solutionId)
      else nextCursor.value = String(lastItem.commentId)
    }
    
    hasNext.value = Boolean(page.hasMore)
  } catch (error) {
  } finally {
    loadingMore.value = false
  }
}

function onTabChange() {
  rows.value = []
  nextCursor.value = null
  hasNext.value = false
  loadList(true)
}

function markPending(id: string, active: boolean) {
  const next = new Set(pendingIds.value)
  active ? next.add(id) : next.delete(id)
  pendingIds.value = next
}

/** 待审内容的通过/拒绝。 */
async function review(row: ModerationRow, status: number) {
  const passing = status === CONTENT_STATUS.NORMAL
  let reason: string | undefined
  
  if (!passing) {
    try {
      const result = await ElMessageBox.prompt('请输入拒绝理由', '拒绝内容', {
        confirmButtonText: '拒绝',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '请说明拒绝原因，将通知用户',
        inputValidator: (value) => {
          if (!value || value.trim().length === 0) {
            return '请输入拒绝理由'
          }
          return true
        },
      })
      reason = result.value
    } catch {
      return
    }
  }

  markPending(row.id, true)
  try {
    if (row.type === 'POST') await adminModerationApi.checkPost(row.id, status, reason)
    else await adminModerationApi.checkSolution(row.id, status, reason)
    ElMessage.success(passing ? '已通过' : '已拒绝')
    // 处理完即离开待审列表，本地移除比整页重载更省一次请求。
    rows.value = rows.value.filter((item) => item.id !== row.id)
  } catch (error) {
  } finally {
    markPending(row.id, false)
  }
}

/** 已发布内容的下架/恢复。 */
async function changeStatus(row: ModerationRow, status: number) {
  const takingDown = status === CONTENT_STATUS.TAKE_DOWN
  let reason: string | undefined
  
  if (takingDown) {
    try {
      const result = await ElMessageBox.prompt('请输入下架理由', '下架内容', {
        confirmButtonText: '下架',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '请说明下架原因，将通知用户',
        inputValidator: (value) => {
          if (!value || value.trim().length === 0) {
            return '请输入下架理由'
          }
          return true
        },
      })
      reason = result.value
    } catch {
      return
    }
  }

  markPending(row.id, true)
  try {
    if (row.type === 'POST') await adminModerationApi.updatePostStatus(row.id, status, reason)
    else if (row.type === 'SOLUTION') await adminModerationApi.updateSolutionStatus(row.id, status, reason)
    else await adminModerationApi.updateCommentStatus(row.id, status, reason)
    ElMessage.success(takingDown ? '已下架' : '已恢复')
    // 状态原地更新，管理员可以立刻撤销刚才的操作。
    rows.value = rows.value.map((item) => (item.id === row.id ? { ...item, status } : item))
  } catch (error) {
  } finally {
    markPending(row.id, false)
  }
}

async function openDetail(row: ModerationRow) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const response: any = await adminModerationApi.getDetail(row.type, row.id)
    detail.value = response?.data ?? response ?? null
  } catch (error) {
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => loadList(true))
</script>

<style scoped>
.moderation-page {
  min-height: 100vh; min-height: 100dvh;
  background: var(--cw-bg-page);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.brand-button {
  display: inline-flex;
  align-items: center;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

.topbar-divider {
  width: 1px;
  height: 20px;
  background: var(--cw-border-strong);
}

.page-name {
  font-weight: 600;
  color: var(--cw-text-1);
  margin-right: auto;
}

.page-content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--cw-text-3);
}

.page-heading h1 {
  margin: 4px 0;
  font-size: 22px;
  color: var(--cw-text-1);
}

.page-heading p {
  margin: 0;
  font-size: 13px;
  color: var(--cw-text-3);
}

.heading-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-state {
  font-size: 12px;
  color: var(--cw-text-3);
}

.mode-alert,
.load-alert {
  margin-bottom: 16px;
}

.list-section {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 16px;
}

.skeleton-list {
  display: grid;
  gap: 16px;
  padding: 16px 0;
}

.row-list {
  display: flex;
  flex-direction: column;
}

.content-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #f2f6fc;
}

@media (max-width: 768px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .content-row {
    flex-direction: column;
    /* 纵排时必须 stretch：父级原本是 align-items: flex-start，
       否则子项按内容宽度撑开，长摘要会把整页顶宽 */
    align-items: stretch;
    gap: 10px;
  }

  .content-row .row-actions {
    align-self: flex-start;
  }
}

.content-row:last-child {
  border-bottom: none;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.row-title {
  font-size: 15px;
  color: var(--cw-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-excerpt {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--cw-text-2);
  word-break: break-word;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--cw-text-3);
}

.row-id {
  font-family: inherit;
  color: var(--cw-text-faint);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.detail-body {
  display: grid;
  gap: 16px;
}

.detail-field {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.detail-field > span:first-child {
  width: 64px;
  color: var(--cw-text-3);
  flex-shrink: 0;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-content-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--cw-text-3);
}

.detail-content pre {
  margin: 0;
  padding: 12px;
  background: var(--cw-bg-page);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  color: var(--cw-text-1);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
