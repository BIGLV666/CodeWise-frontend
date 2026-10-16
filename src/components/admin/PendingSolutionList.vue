<template>
  <div class="pending-list">
    <div v-if="loading" class="skeleton-wrapper">
      <el-skeleton v-for="i in 3" :key="i" :rows="3" animated />
    </div>

    <el-empty v-else-if="solutions.length === 0" description="暂无待审核题解" />

    <div v-else class="content-list">
      <article v-for="solution in solutions" :key="solution.solutionId" class="content-card">
        <div class="card-header">
          <div class="author-info">
            <el-avatar :size="32" :src="solution.avatarUrl">{{ solution.userName?.charAt(0) }}</el-avatar>
            <div>
              <strong>{{ solution.userName }}</strong>
              <time>{{ formatTime(solution.createTime) }}</time>
            </div>
          </div>
          <el-tag v-if="solution.status === 0" type="warning" size="small">待审核</el-tag>
        </div>

        <div class="card-body">
          <div class="question-badge">
            <el-icon><Document /></el-icon>
            <span>题目 #{{ solution.questionId }}</span>
          </div>
          <h3>{{ solution.solutionTitle }}</h3>
          <p class="content-preview">{{ truncate(solution.solutionContent, 200) }}</p>
        </div>

        <div class="card-footer">
          <div class="meta-info">
            <span><el-icon><View /></el-icon>{{ solution.likeCount || 0 }} 点赞</span>
          </div>
          <div class="action-buttons">
            <el-button size="small" @click="viewDetail(solution.solutionId)">查看详情</el-button>
            <el-button
              type="danger"
              size="small"
              :loading="isProcessing(solution.solutionId, 2)"
              @click="handleCheck(solution.solutionId, 2)"
            >
              拒绝
            </el-button>
            <el-button
              type="success"
              size="small"
              :loading="isProcessing(solution.solutionId, 1)"
              @click="handleCheck(solution.solutionId, 1)"
            >
              通过
            </el-button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="hasNext && !loading" class="load-more">
      <el-button :loading="loadingMore" @click="loadMore">加载更多</el-button>
    </div>

    <el-dialog v-model="detailVisible" title="题解详情" width="800px" destroy-on-close>
      <SolutionDetail
        v-if="currentSolutionId"
        :solution-id="currentSolutionId"
        @reviewed="handleReviewed"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View, Document } from '@element-plus/icons-vue'
import adminModerationApi, { type PendingSolution } from '@/api/adminModerationApi'
import SolutionDetail from './SolutionDetail.vue'

const solutions = ref<PendingSolution[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasNext = ref(false)
const nextCursor = ref<string | null>(null)
const processingItems = ref<Map<string, number>>(new Map())
const detailVisible = ref(false)
const currentSolutionId = ref<string | null>(null)

const loadSolutions = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const params: any = { pageSize: 20 }
    if (isLoadMore && nextCursor.value) {
      params.lastId = nextCursor.value
    }

    const res = await adminModerationApi.listPendingSolutions(params)
    const data = res

    if (isLoadMore) {
      solutions.value.push(...data.records)
    } else {
      solutions.value = data.records
    }

    hasNext.value = data.hasNext
    nextCursor.value = data.nextCursor == null ? null : String(data.nextCursor)
  } catch (error: any) {
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  loadSolutions(true)
}

const isProcessing = (solutionId: string, status: number) => {
  return processingItems.value.get(solutionId) === status
}

const handleCheck = async (solutionId: string, status: number) => {
  processingItems.value.set(solutionId, status)

  try {
    let reason: string | undefined
    
    if (status === 2) {
      const result = await ElMessageBox.prompt('请输入拒绝理由', '拒绝审核', {
        confirmButtonText: '确定',
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
    }
    
    await adminModerationApi.checkSolution(solutionId, status, reason)
    ElMessage.success(status === 1 ? '已通过审核' : '已拒绝')
    solutions.value = solutions.value.filter((s) => s.solutionId !== solutionId)
  } catch (error: any) {
    if (error === 'cancel') return
  } finally {
    processingItems.value.delete(solutionId)
  }
}

const viewDetail = (solutionId: string) => {
  currentSolutionId.value = solutionId
  detailVisible.value = true
}

const handleReviewed = () => {
  detailVisible.value = false
  solutions.value = solutions.value.filter((s) => s.solutionId !== currentSolutionId.value)
  currentSolutionId.value = null
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

const truncate = (text?: string, length = 100) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

onMounted(() => {
  loadSolutions()
})
</script>

<style scoped>
.pending-list {
  min-height: 400px;
}

.skeleton-wrapper > * + * {
  margin-top: 16px;
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  padding: 20px;
  transition: border-color 0.2s;
}

.content-card:hover {
  border-color: var(--cw-text-faint);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-info > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-info strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--cw-text-1);
}

.author-info time {
  font-size: 12px;
  color: var(--cw-text-3);
}

.question-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--cw-brand-soft);
  border-radius: 999px;
  font-size: 12px;
  color: var(--cw-brand);
  margin-bottom: 12px;
}

.card-body h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--cw-text-1);
  margin: 0 0 12px;
}

.content-preview {
  font-size: 14px;
  color: var(--cw-text-2);
  line-height: 1.6;
  margin: 0;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--cw-border);
}

.meta-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--cw-text-3);
}

.meta-info span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
  margin-top: 24px;
}

@media (max-width: 768px) {
  /* 窄屏下 meta 与操作按钮换行，避免把卡片顶宽 */
  .card-footer {
    flex-wrap: wrap;
    row-gap: 8px;
  }
}
</style>
