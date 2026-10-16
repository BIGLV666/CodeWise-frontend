<template>
  <div class="comment-list">
    <div class="filter-bar">
      <el-select v-model="filterType" placeholder="筛选类型" clearable @change="handleFilterChange">
        <el-option label="帖子评论" value="POST" />
        <el-option label="题解评论" value="SOLUTION" />
      </el-select>
    </div>

    <div v-if="loading" class="skeleton-wrapper">
      <el-skeleton v-for="i in 3" :key="i" :rows="2" animated />
    </div>

    <el-empty v-else-if="comments.length === 0" description="暂无评论" />

    <div v-else class="content-list">
      <article v-for="comment in comments" :key="comment.commentId" class="content-card">
        <div class="card-header">
          <div class="author-info">
            <el-avatar :size="32" :src="comment.avatarUrl">{{ comment.userName?.charAt(0) }}</el-avatar>
            <div>
              <strong>{{ comment.userName }}</strong>
              <time>{{ formatTime(comment.createTime) }}</time>
            </div>
          </div>
          <el-tag v-if="comment.status === 1" type="success" size="small">正常</el-tag>
          <el-tag v-else-if="comment.status === 2" type="danger" size="small">已下架</el-tag>
        </div>

        <div class="card-body">
          <p class="comment-text">{{ comment.comment }}</p>
          <div class="comment-context">
            <span>评论对象: {{ comment.postId ? `#${comment.postId}` : '未知' }}</span>
          </div>
        </div>

        <div class="card-footer">
          <div class="meta-info">
            <span><el-icon><View /></el-icon>{{ comment.likeCount || 0 }} 点赞</span>
          </div>
          <div class="action-buttons">
            <el-button
              v-if="comment.status === 1"
              type="danger"
              size="small"
              :loading="isProcessing(comment.commentId, 2)"
              @click="handleUpdateStatus(comment.commentId, 2)"
            >
              下架
            </el-button>
            <el-button
              v-if="comment.status === 2"
              type="success"
              size="small"
              :loading="isProcessing(comment.commentId, 1)"
              @click="handleUpdateStatus(comment.commentId, 1)"
            >
              恢复
            </el-button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="hasNext && !loading" class="load-more">
      <el-button :loading="loadingMore" @click="loadMore">加载更多</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View } from '@element-plus/icons-vue'
import adminModerationApi, { type PendingComment, type ModerationTargetType } from '@/api/adminModerationApi'

const comments = ref<PendingComment[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasNext = ref(false)
const nextCursor = ref<string | null>(null)
const processingItems = ref<Map<string, number>>(new Map())
const filterType = ref<ModerationTargetType | ''>('')

const loadComments = async (isLoadMore = false) => {
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
    if (filterType.value) {
      params.type = filterType.value
    }

    const res = await adminModerationApi.listComments(params)
    const data = res

    if (isLoadMore) {
      comments.value.push(...data.records)
    } else {
      comments.value = data.records
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
  loadComments(true)
}

const handleFilterChange = () => {
  nextCursor.value = null
  loadComments()
}

const isProcessing = (commentId: string, status: number) => {
  return processingItems.value.get(commentId) === status
}

const handleUpdateStatus = async (commentId: string, status: number) => {
  processingItems.value.set(commentId, status)

  try {
    let reason: string | undefined
    
    if (status === 2) {
      const result = await ElMessageBox.prompt('请输入下架理由', '下架评论', {
        confirmButtonText: '确定',
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
    }
    
    await adminModerationApi.updateCommentStatus(commentId, status, reason)
    ElMessage.success(status === 1 ? '已恢复' : '已下架')
    const comment = comments.value.find((c) => c.commentId === commentId)
    if (comment) {
      comment.status = status
    }
  } catch (error: any) {
    if (error === 'cancel') return
  } finally {
    processingItems.value.delete(commentId)
  }
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

onMounted(() => {
  loadComments()
})
</script>

<style scoped>
.comment-list {
  min-height: 400px;
}

.filter-bar {
  margin-bottom: 16px;
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

.card-body {
  margin-bottom: 16px;
}

.comment-text {
  font-size: 14px;
  color: var(--cw-text-1);
  line-height: 1.6;
  margin: 0 0 8px;
}

.comment-context {
  font-size: 12px;
  color: var(--cw-text-3);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

@media (max-width: 768px) {
  /* 窄屏下 meta 与操作按钮换行，避免把卡片顶宽 */
  .card-footer {
    flex-wrap: wrap;
    row-gap: 8px;
  }
}
</style>
