<template>
  <div v-if="loading" class="detail-skeleton">
    <el-skeleton :rows="5" animated />
  </div>
  <div v-else-if="detail" class="solution-detail">
    <header class="detail-header">
      <div class="author-section">
        <el-avatar :size="48" :src="detail.userDto?.avatarUrl">
          {{ detail.userDto?.userName?.charAt(0) }}
        </el-avatar>
        <div>
          <strong>{{ detail.userDto?.userName }}</strong>
          <time>{{ formatTime(detail.createTime) }}</time>
        </div>
      </div>
      <el-tag :type="getStatusType(detail.status)" size="large">
        {{ getStatusLabel(detail.status) }}
      </el-tag>
    </header>

    <div class="detail-body">
      <div class="question-badge">
        <el-icon><Document /></el-icon>
        <span>题目 #{{ detail.questionId }}</span>
      </div>
      <h2>{{ detail.title }}</h2>
      <div class="content-text" v-html="renderMarkdown(detail.content)"></div>
    </div>

    <footer class="detail-footer">
      <div class="meta-row">
        <span><el-icon><View /></el-icon>{{ detail.likeCount || 0 }} 点赞</span>
        <span><el-icon><Clock /></el-icon>{{ formatFullTime(detail.createTime) }}</span>
      </div>

      <div class="action-row">
        <el-button :icon="Link" @click="openContentPage">
          在新页面查看
        </el-button>
        <div v-if="detail.status === 0" class="review-actions">
          <el-popconfirm
            title="确认拒绝这篇题解？"
            confirm-button-text="确认拒绝"
            cancel-button-text="取消"
            @confirm="showRejectDialog"
          >
            <template #reference>
              <el-button
                type="danger"
                :loading="processing === 2"
              >
                拒绝审核
              </el-button>
            </template>
          </el-popconfirm>
          <el-button
            type="success"
            :loading="processing === 1"
            @click="handleReview(1)"
          >
            通过审核
          </el-button>
        </div>
      </div>
    </footer>

    <!-- 拒绝理由对话框 -->
    <el-dialog
      v-model="rejectDialogVisible"
      title="填写拒绝理由"
      width="500px"
    >
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="4"
        placeholder="请输入拒绝理由（必填）"
        maxlength="200"
        show-word-limit
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button
          type="danger"
          :loading="processing === 2"
          :disabled="!rejectReason.trim()"
          @click="confirmReject"
        >
          确认拒绝
        </el-button>
      </template>
    </el-dialog>
  </div>
  <el-empty v-else description="加载失败" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Clock, Document, Link } from '@element-plus/icons-vue'
import { marked } from 'marked'
import adminModerationApi, { type CheckDetail, CONTENT_STATUS } from '@/api/adminModerationApi'

const props = defineProps<{
  solutionId: string
}>()

const emit = defineEmits<{
  reviewed: []
}>()

const detail = ref<CheckDetail | null>(null)
const loading = ref(false)
const processing = ref<number | null>(null)
const rejectDialogVisible = ref(false)
const rejectReason = ref('')

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await adminModerationApi.getSolutionDetail(props.solutionId)
    detail.value = res
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载详情失败')
  } finally {
    loading.value = false
  }
}

const showRejectDialog = () => {
  rejectDialogVisible.value = true
  rejectReason.value = ''
}

const confirmReject = async () => {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝理由')
    return
  }
  await handleReview(2, rejectReason.value)
  rejectDialogVisible.value = false
}

const handleReview = async (status: number, reason?: string) => {
  processing.value = status
  try {
    await adminModerationApi.checkSolution(props.solutionId, status, reason)
    ElMessage.success(status === 1 ? '已通过审核' : '已拒绝')
    emit('reviewed')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  } finally {
    processing.value = null
  }
}

const openContentPage = () => {
  const url = `/content-render?type=SOLUTION&id=${props.solutionId}`
  window.open(url, '_blank')
}

const getStatusType = (status: number) => {
  if (status === CONTENT_STATUS.PENDING) return 'warning'
  if (status === CONTENT_STATUS.NORMAL) return 'success'
  return 'danger'
}

const getStatusLabel = (status: number) => {
  if (status === CONTENT_STATUS.PENDING) return '待审核'
  if (status === CONTENT_STATUS.NORMAL) return '正常'
  return '已下架'
}

const formatTime = (time?: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return date.toLocaleDateString('zh-CN')
}

const formatFullTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

const renderMarkdown = (content: string) => {
  return marked(content || '')
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.detail-skeleton {
  padding: 24px;
}

.solution-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--cw-border);
}

.author-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.author-section > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-section strong {
  font-size: 16px;
  font-weight: 600;
  color: var(--cw-text-1);
}

.author-section time {
  font-size: 13px;
  color: var(--cw-text-3);
}

.question-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--cw-brand-soft);
  border-radius: 999px;
  font-size: 13px;
  color: var(--cw-brand-dark);
  margin-bottom: 16px;
}

.detail-body h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--cw-text-1);
  margin: 0 0 20px;
}

.content-text {
  font-size: 15px;
  line-height: 1.8;
  color: var(--cw-text-1);
}

.content-text :deep(h1),
.content-text :deep(h2),
.content-text :deep(h3) {
  color: var(--cw-text-1);
  margin-top: 24px;
  margin-bottom: 12px;
}

.content-text :deep(code) {
  background: var(--cw-bg-page);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--cw-font-mono);
  font-size: 0.9em;
  color: var(--cw-danger);
}

.content-text :deep(pre) {
  background: var(--cw-bg-page);
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

.content-text :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--cw-text-1);
}

.detail-footer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid var(--cw-border);
}

.meta-row {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--cw-text-3);
}

.meta-row span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.review-actions {
  display: flex;
  gap: 12px;
}
</style>
