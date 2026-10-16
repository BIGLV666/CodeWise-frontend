<template>
  <div class="content-render-view">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <el-icon><Warning /></el-icon>
      <div class="error-message">{{ error }}</div>
      <el-button @click="goBack">返回</el-button>
    </div>

    <div v-else class="content-container">
      <header class="content-header">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <div class="header-info">
          <div v-if="contentData.title" class="content-title">{{ contentData.title }}</div>
          <div class="content-meta">
            <el-tag :type="getStatusType(contentData.status)">
              {{ getStatusText(contentData.status) }}
            </el-tag>
            <span v-if="contentData.createTime" class="meta-time">
              {{ formatTime(contentData.createTime) }}
            </span>
          </div>
        </div>
      </header>

      <article class="markdown-body" v-html="renderedContent" />

      <footer v-if="contentData.checkReason" class="content-footer">
        <div class="reason-block">
          <div class="reason-label">审核/下架原因</div>
          <div class="reason-text">{{ contentData.checkReason }}</div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading, Warning, ArrowLeft } from '@element-plus/icons-vue'
import adminModerationApi from '@/api/adminModerationApi'
import { errorText } from '@/api/request'
import { renderMarkdown } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
// 内容为 null（已被删除等）时退化成空对象，避免模板访问 .title 抛错
const contentData = ref<Record<string, any>>({})

const renderedContent = computed(() => {
  if (!contentData.value.content) return ''
  return renderMarkdown(contentData.value.content)
})

const getStatusType = (status: number) => {
  if (status === 0) return 'warning'
  if (status === 1) return 'success'
  return 'danger'
}

const getStatusText = (status: number) => {
  if (status === 0) return '待审核'
  if (status === 1) return '已通过'
  return '已下架'
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const goBack = () => {
  router.replace('/home')
}

const loadContent = async () => {
  const type = route.query.type as string
  const id = route.query.id as string

  if (!type || !id) {
    error.value = '缺少必要参数'
    loading.value = false
    return
  }

  try {
    let res: any
    if (type === 'POST') {
      res = await adminModerationApi.getPostDetail(id)
    } else if (type === 'SOLUTION') {
      res = await adminModerationApi.getSolutionDetail(id)
    } else if (type === 'COMMENT') {
      res = await adminModerationApi.getCommentDetail(id)
    } else {
      throw new Error('不支持的内容类型')
    }

    contentData.value = res ?? {}
  } catch (err) {
    // 提示已由 request 拦截器统一弹出，这里只落地内联错误态
    error.value = errorText(err, '内容加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadContent()
})
</script>

<style scoped>
.content-render-view {
  min-height: 100vh; min-height: 100dvh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
  padding: clamp(1.5rem, 3vw, 2rem);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1rem;
  color: var(--cw-text-3);
}

.loading-state .el-icon,
.error-state .el-icon {
  font-size: 3rem;
}

.error-message {
  font-size: 1rem;
  color: var(--cw-danger);
}

.content-container {
  max-width: 900px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.content-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: clamp(1.5rem, 3vw, 2rem);
  border-bottom: 1px solid var(--cw-border);
  background: var(--cw-bg-page);
}

.header-info {
  flex: 1;
}

.content-title {
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 600;
  color: var(--cw-text-1);
  margin-bottom: 0.75rem;
  line-height: 1.3;
}

.content-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta-time {
  font-size: 0.875rem;
  color: var(--cw-text-3);
}

.markdown-body {
  padding: clamp(1.5rem, 3vw, 2.5rem);
  color: var(--cw-text-1);
  line-height: 1.8;
  font-size: clamp(0.9375rem, 2vw, 1rem);
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  font-weight: 600;
  color: var(--cw-text-1);
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 1.875rem;
  border-bottom: 2px solid var(--cw-border);
  padding-bottom: 0.5rem;
}

.markdown-body :deep(h2) {
  font-size: 1.5rem;
  border-bottom: 1px solid var(--cw-border);
  padding-bottom: 0.375rem;
}

.markdown-body :deep(h3) {
  font-size: 1.25rem;
}

.markdown-body :deep(p) {
  margin-bottom: 1em;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-body :deep(li) {
  margin-bottom: 0.5em;
}

.markdown-body :deep(pre) {
  background: var(--cw-bg-page);
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 1em;
}

.markdown-body :deep(code) {
  font-family: var(--cw-font-mono);
  font-size: 0.875em;
}

.markdown-body :deep(p code) {
  background: var(--cw-bg-page);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  color: var(--cw-danger);
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #38bdf8;
  padding-left: 1rem;
  margin-left: 0;
  margin-bottom: 1em;
  color: var(--cw-text-3);
  font-style: italic;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--cw-border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--cw-bg-page);
  font-weight: 600;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1em 0;
}

.markdown-body :deep(a) {
  color: #0ea5e9;
  text-decoration: none;
  transition: color 0.2s;
}

.markdown-body :deep(a:hover) {
  color: var(--cw-brand-dark);
  text-decoration: underline;
}

.content-footer {
  padding: clamp(1.5rem, 3vw, 2rem);
  background: #fef2f2;
  border-top: 1px solid #fecaca;
}

.reason-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reason-label {
  font-weight: 600;
  color: var(--cw-danger);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.reason-text {
  color: #7f1d1d;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
