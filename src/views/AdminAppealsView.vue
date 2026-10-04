<template>
  <div class="appeal-page">
      <main class="page-content">
        <section class="page-heading">
          <div>
            <span class="eyebrow">ADMIN · APPEAL MANAGEMENT</span>
            <h1>申诉处理台</h1>
            <p>处理用户对下架内容的申诉请求</p>
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

      <div class="filter-bar">
        <el-radio-group v-model="filterStatus" @change="onFilterChange">
          <el-radio-button :label="null">全部</el-radio-button>
          <el-radio-button :label="APPEAL_STATUS.PENDING">待处理</el-radio-button>
          <el-radio-button :label="APPEAL_STATUS.APPROVED">已通过</el-radio-button>
          <el-radio-button :label="APPEAL_STATUS.REJECTED">已拒绝</el-radio-button>
        </el-radio-group>
      </div>

      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
        class="load-alert"
      />

      <section class="list-section" aria-label="申诉列表">
        <div v-if="loading && rows.length === 0" class="skeleton-list">
          <el-skeleton v-for="index in 4" :key="index" :rows="4" animated />
        </div>

        <el-empty v-else-if="rows.length === 0" description="暂无申诉记录" />

        <div v-else class="row-list">
          <article v-for="row in rows" :key="row.appealId" class="appeal-row">
            <div class="row-main">
              <div class="row-head">
                <el-tag :type="typeTag(row.rootType)" size="small" effect="plain">
                  {{ typeLabel(row.rootType) }}
                </el-tag>
                <strong class="row-title">{{ row.title || `${typeLabel(row.rootType)} ID: ${row.rootId}` }}</strong>
                <el-tag :type="statusTag(row.status).type" size="small" effect="plain">
                  {{ statusTag(row.status).label }}
                </el-tag>
              </div>
              
              <div class="appeal-content">
                <div class="content-section">
                  <span class="label">申诉理由：</span>
                  <p class="text">{{ row.reason || '（未填写）' }}</p>
                </div>
                <div v-if="row.takeDownReason" class="content-section">
                  <span class="label">原下架原因：</span>
                  <p class="text">{{ row.takeDownReason }}</p>
                </div>
                <div v-if="row.adminReason" class="content-section">
                  <span class="label">处理说明：</span>
                  <p class="text">{{ row.adminReason }}</p>
                </div>
              </div>

              <div class="row-meta">
                <span>{{ row.userName || `用户 ${row.userId}` }}</span>
                <span v-if="row.createTime">{{ formatTime(row.createTime) }}</span>
                <code class="row-id" :title="String(row.appealId)">#{{ row.appealId }}</code>
              </div>
            </div>

            <div class="row-actions">
              <el-button size="small" plain @click="openDetail(row)">查看详情</el-button>
              <el-button
                v-if="row.status === APPEAL_STATUS.PENDING"
                type="success"
                size="small"
                plain
                :loading="pendingIds.has(row.appealId)"
                @click="handleAppeal(row, true)"
              >
                通过并恢复
              </el-button>
              <el-button
                v-if="row.status === APPEAL_STATUS.PENDING"
                type="danger"
                size="small"
                plain
                :loading="pendingIds.has(row.appealId)"
                @click="handleAppeal(row, false)"
              >
                拒绝申诉
              </el-button>
              <el-tag v-else :type="statusTag(row.status).type" effect="plain">
                {{ statusTag(row.status).label }}
              </el-tag>
            </div>
          </article>
        </div>

        <div v-if="hasNext" class="load-more">
          <el-button :loading="loadingMore" text @click="loadMore">加载更多</el-button>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="replyDialogVisible"
      :title="replyDialogTitle"
      width="500px"
      @close="onReplyDialogClose"
    >
      <el-form :model="replyForm" label-width="80px">
        <el-form-item label="处理说明">
          <el-input
            v-model="replyForm.adminReason"
            type="textarea"
            :rows="4"
            placeholder="选填：向用户说明处理原因"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="replyDialogVisible = false">取消</el-button>
        <el-button
          :type="replyForm.pass ? 'success' : 'danger'"
          :loading="submitting"
          @click="submitHandle"
        >
          确认{{ replyForm.pass ? '通过' : '拒绝' }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="申诉内容详情" size="52%">
      <el-skeleton v-if="detailLoading" :rows="8" animated />
      <el-empty v-else-if="!detail" description="内容详情加载失败" />
      <article v-else class="appeal-detail">
        <div class="detail-meta">
          <span>{{ typeLabel(detail.type) }}</span>
          <strong>{{ detail.title || `内容 ID: ${detail.targetId}` }}</strong>
          <el-tag :type="detail.status === 0 ? 'warning' : detail.status === 2 ? 'danger' : 'success'" size="small">
            {{ detail.status === 0 ? '待审核' : detail.status === 2 ? '已下架' : '正常' }}
          </el-tag>
        </div>
        <div class="detail-author">作者：{{ detail.userDto?.userName || detail.userId || '未知用户' }}</div>
        <div v-if="detail.tags?.length" class="detail-tags">
          <el-tag v-for="tag in detail.tags" :key="tag" size="small" effect="plain">#{{ tag }}</el-tag>
        </div>
        <div class="detail-content" v-html="renderedDetail"></div>
      </article>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import adminAppealApi, { APPEAL_STATUS, type AppealItem } from '@/api/adminAppealApi'
import type { AppealRootType } from '@/api/adminAppealApi'
import adminModerationApi, { type CheckDetail } from '@/api/adminModerationApi'
import { errorText } from '@/api/request'
import { renderMarkdown } from '@/utils/markdown'

type TagType = 'success' | 'warning' | 'danger' | 'info'

const PAGE_SIZE = 20

const router = useRouter()
const filterStatus = ref<number | null>(null)
const rows = ref<AppealItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const hasNext = ref(false)
const nextCursor = ref<number | null>(null)
const lastUpdatedAt = ref<Date | null>(null)
const pendingIds = ref(new Set<number>())
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<CheckDetail | null>(null)

const replyDialogVisible = ref(false)
const replyDialogTitle = ref('')
const submitting = ref(false)
const replyForm = ref({
  appealId: 0,
  pass: false,
  adminReason: '',
})

const renderedDetail = computed(() => renderMarkdown(detail.value?.content || ''))

const lastUpdatedText = computed(() => lastUpdatedAt.value
  ? `更新于 ${lastUpdatedAt.value.toLocaleTimeString('zh-CN', { hour12: false })}`
  : '尚未更新')

function statusTag(status: number): { label: string; type: TagType } {
  if (status === APPEAL_STATUS.PENDING) return { label: '待处理', type: 'warning' }
  if (status === APPEAL_STATUS.APPROVED) return { label: '已通过', type: 'success' }
  if (status === APPEAL_STATUS.REJECTED) return { label: '已拒绝', type: 'danger' }
  return { label: '未知', type: 'info' }
}

function typeLabel(type: AppealRootType): string {
  if (type === 'POST') return '帖子'
  if (type === 'SOLUTION') return '题解'
  if (type === 'COMMENT') return '评论'
  return type
}

function typeTag(type: AppealRootType): TagType {
  if (type === 'POST') return 'info'
  if (type === 'SOLUTION') return 'success'
  if (type === 'COMMENT') return 'warning'
  return 'info'
}

async function openDetail(row: AppealItem) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await adminModerationApi.getDetail(row.rootType, row.rootId)
  } catch (error) {
    ElMessage.error(errorText(error, '详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function loadList(reset = false) {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const page = await adminAppealApi.listAppeals({
      lastId: reset ? null : nextCursor.value,
      pageSize: PAGE_SIZE,
      status: filterStatus.value,
    })
    
    const list = page.list || []
    rows.value = reset ? list : [...rows.value, ...list]
    
    // 计算下一个游标（列表最后一项的 appealId）
    if (list.length > 0) {
      const lastItem = list[list.length - 1]
      nextCursor.value = Number(lastItem.appealId)
    }
    
    hasNext.value = Boolean(page.hasMore)
    lastUpdatedAt.value = new Date()
  } catch (error) {
    loadError.value = errorText(error, '申诉列表加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasNext.value) return
  loadingMore.value = true
  try {
    const page = await adminAppealApi.listAppeals({
      lastId: nextCursor.value,
      pageSize: PAGE_SIZE,
      status: filterStatus.value,
    })
    
    const list = page.list || []
    rows.value = [...rows.value, ...list]
    
    // 计算下一个游标
    if (list.length > 0) {
      const lastItem = list[list.length - 1]
      nextCursor.value = Number(lastItem.appealId)
    }
    
    hasNext.value = Boolean(page.hasMore)
  } catch (error) {
    ElMessage.error(errorText(error, '加载更多失败'))
  } finally {
    loadingMore.value = false
  }
}

function onFilterChange() {
  rows.value = []
  nextCursor.value = null
  hasNext.value = false
  loadList(true)
}

function markPending(id: number, active: boolean) {
  const next = new Set(pendingIds.value)
  active ? next.add(id) : next.delete(id)
  pendingIds.value = next
}

function handleAppeal(row: AppealItem, pass: boolean) {
  replyForm.value = {
    appealId: row.appealId,
    pass,
    adminReason: '',
  }
  replyDialogTitle.value = pass ? '通过申诉并恢复内容' : '拒绝申诉'
  replyDialogVisible.value = true
}

function onReplyDialogClose() {
  replyForm.value = {
    appealId: 0,
    pass: false,
    adminReason: '',
  }
}

async function submitHandle() {
  submitting.value = true
  markPending(replyForm.value.appealId, true)
  try {
    await adminAppealApi.handleAppeal({
      appealId: replyForm.value.appealId,
      pass: replyForm.value.pass,
      adminReason: replyForm.value.adminReason || undefined,
    })
    ElMessage.success(replyForm.value.pass ? '已通过申诉并恢复内容' : '已拒绝申诉')
    replyDialogVisible.value = false
    
    // 更新本地状态
    const newStatus = replyForm.value.pass ? APPEAL_STATUS.APPROVED : APPEAL_STATUS.REJECTED
    rows.value = rows.value.map((item) => 
      item.appealId === replyForm.value.appealId 
        ? { ...item, status: newStatus } 
        : item
    )
  } catch (error) {
    ElMessage.error(errorText(error, '操作失败'))
  } finally {
    markPending(replyForm.value.appealId, false)
    submitting.value = false
  }
}

onMounted(() => loadList(true))
</script>

<style scoped>
.appeal-page {
  min-height: 100vh;
  background: var(--cw-bg-page);
}

.page-content {
  max-width: 1080px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 32px);
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.eyebrow {
  font-size: clamp(10px, 2vw, 12px);
  letter-spacing: 0.08em;
  color: var(--cw-text-3);
}

.page-heading h1 {
  margin: 4px 0;
  font-size: clamp(20px, 4vw, 28px);
  color: var(--cw-text-1);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.page-heading p {
  margin: 0;
  font-size: clamp(12px, 2.5vw, 14px);
  color: var(--cw-text-2);
  line-height: 1.6;
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

.filter-bar {
  margin-bottom: 16px;
}

.load-alert {
  margin-bottom: 16px;
}

.list-section {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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

.appeal-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 0;
  border-bottom: 1px solid var(--cw-border);
}

.appeal-row:last-child {
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
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.row-title {
  font-size: clamp(14px, 3vw, 16px);
  color: var(--cw-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.appeal-content {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.content-section .label {
  font-size: 12px;
  color: var(--cw-text-3);
  font-weight: 500;
}

.content-section .text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--cw-text-2);
  word-break: break-word;
  padding: 8px 12px;
  background: var(--cw-bg-page);
  border-radius: 6px;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--cw-text-3);
  flex-wrap: wrap;
}

.row-id {
  font-family: inherit;
  color: var(--cw-text-3);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.appeal-detail {
  color: var(--cw-text-1);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.detail-meta strong {
  font-size: 18px;
}

.detail-author {
  margin-bottom: 14px;
  color: var(--cw-text-3);
  font-size: 13px;
}

.detail-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.detail-content {
  padding: 16px;
  border-radius: 8px;
  background: var(--cw-bg-page);
  line-height: 1.75;
  word-break: break-word;
}
</style>
