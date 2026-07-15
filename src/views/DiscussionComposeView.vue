<template>
  <div class="compose-page">
    <header class="navbar">
      <div class="nav-left">
        <button class="logo" type="button" @click="navigateTopLevel(router, '/home')">
          <span class="logo-mark">C</span>
          <span>CodeWise</span>
        </button>
        <nav>
          <button type="button" @click="navigateTopLevel(router, '/home')">题库</button>
          <button type="button">竞赛</button>
          <button class="active" type="button" @click="navigateTopLevel(router, '/discuss')">讨论</button>
          <button type="button" @click="navigateTopLevel(router, '/review')">复习</button>
        </nav>
      </div>

      <div class="nav-right">
        <button class="avatar-entry" type="button" aria-label="进入个人主页" @click="navigateTopLevel(router, '/profile')">
          <el-avatar :size="32" :src="avatarUrl">{{ avatarText }}</el-avatar>
        </button>
      </div>
    </header>

    <main class="compose-shell">
      <section v-loading="loadingPost" class="compose-card" element-loading-text="正在载入帖子...">
        <div class="compose-header">
          <div class="title-wrap">
            <input
              v-model.trim="postForm.postTitle"
              class="title-input"
              maxlength="80"
              placeholder="请输入标题"
            />
            <div class="topic-row">
              <el-avatar :size="28" :src="avatarUrl">{{ avatarText }}</el-avatar>
              <el-select
                v-model="postForm.tags"
                class="topic-select"
                multiple
                filterable
                allow-create
                default-first-option
                collapse-tags
                collapse-tags-tooltip
                placeholder="+ 话题"
              >
                <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
              </el-select>
            </div>
          </div>

          <div class="header-actions">
            <el-button @click="cancelCompose">取消</el-button>
            <el-button type="success" :loading="submitting" :disabled="loadingPost" @click="submitPost">{{ isEditing ? '保存修改' : '发布' }}</el-button>
          </div>
        </div>

        <div class="editor-toolbar">
          <button v-for="action in toolbarActions" :key="action.label" type="button" class="tool-chip" @click="insertSnippet(action.snippet)">
            {{ action.label }}
          </button>
          <span class="toolbar-tip">输入 Markdown，右侧实时预览</span>
        </div>

        <div class="editor-layout">
          <div class="editor-column">
            <textarea
              ref="editorRef"
              v-model="postForm.postContent"
              class="editor-area"
              placeholder="输入 “/” 快速添加内容，或直接开始写 Markdown..."
            />
          </div>

          <aside class="preview-column">
            <div class="preview-header">
              <span>预览</span>
              <span>{{ contentLength }}/5000</span>
            </div>
            <div class="markdown-body preview-body" v-html="renderedContent"></div>
            <div class="tips-card">
              <h3>常用语法</h3>
              <p><code># 标题</code> <code>**加粗**</code> <code>`代码`</code></p>
              <p><code>```language</code> 代码块 <code>```</code></p>
              <p class="tip-text">不熟悉高级语法也没关系，正文直接写内容就可以。</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import communityApi from '@/api/communityApi'
import { normalizeAvatarUrl } from '@/utils/avatar'
import { renderMarkdown } from '@/utils/markdown'
import { navigateTopLevel } from '@/utils/navigation'

const router = useRouter()
const route = useRoute()
const editorRef = ref<HTMLTextAreaElement>()
const submitting = ref(false)
const loadingPost = ref(false)

const tagOptions = ['Algorithm', 'Interview', 'Frontend', 'Backend', 'System Design', 'Review', 'JobReferral']
const toolbarActions = [
  { label: 'H1', snippet: '# 标题\n' },
  { label: '加粗', snippet: '**重点内容**' },
  { label: '引用', snippet: '> 这里写你的观点\n' },
  { label: '代码', snippet: '```ts\nconsole.log("hello")\n```\n' },
  { label: '列表', snippet: '- 第一条\n- 第二条\n' },
  { label: '链接', snippet: '[链接标题](https://example.com)' },
  { label: '公式', snippet: '$E = mc^2$' },
  { label: '公式块', snippet: '$$\n\\sum_{i=1}^{n} i\n$$\n' },
  { label: '表格', snippet: '| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n' },
]

const postForm = reactive({
  postTitle: '',
  postContent: '',
  tags: [] as string[],
})

const avatarUrl = computed(() => normalizeAvatarUrl(localStorage.getItem('avatarUrl') || ''))
const avatarText = computed(() => (localStorage.getItem('userName') || 'CW').slice(0, 2).toUpperCase())
const editingPostId = computed(() => String(route.query.postId || ''))
const isEditing = computed(() => Boolean(editingPostId.value))
const contentLength = computed(() => postForm.postContent.trim().length)
const renderedContent = computed(() => {
  const source = postForm.postContent.trim() || '### 预览区\n\n内容会实时显示在这里。'
  return renderMarkdown(source)
})

async function insertSnippet(snippet: string) {
  const element = editorRef.value
  if (!element) {
    postForm.postContent += snippet
    return
  }

  const start = element.selectionStart ?? postForm.postContent.length
  const end = element.selectionEnd ?? start
  postForm.postContent = `${postForm.postContent.slice(0, start)}${snippet}${postForm.postContent.slice(end)}`

  await nextTick()
  const cursor = start + snippet.length
  element.focus()
  element.setSelectionRange(cursor, cursor)
}

async function submitPost() {
  const title = postForm.postTitle.trim()
  const content = postForm.postContent.trim()

  if (!title) {
    ElMessage.warning('标题不能为空')
    return
  }
  if (!content) {
    ElMessage.warning('正文不能为空')
    return
  }
  if (content.length > 5000) {
    ElMessage.warning('正文请控制在 5000 字以内')
    return
  }

  submitting.value = true
  try {
    if (isEditing.value) {
      await communityApi.updatePost(editingPostId.value, {
        postTitle: title,
        postContent: content,
        tags: postForm.tags,
      })
      ElMessage.success('帖子已修改')
      await router.replace({ name: 'discussion-detail', params: { postId: editingPostId.value } })
      return
    }

    const requestIdRes: any = await communityApi.getRequestId()
    const requestId = typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.message
    if (!requestId) {
      ElMessage.error('请求标识获取失败')
      return
    }

    await communityApi.createPost(
      {
        postTitle: title,
        postContent: content,
        tags: postForm.tags,
        userId: localStorage.getItem('userId') || undefined,
        userName: localStorage.getItem('userName') || undefined,
      },
      requestId,
    )

    ElMessage.success('帖子已发布')
    await navigateTopLevel(router, '/discuss')
  } catch (error) {
    console.error('发布帖子失败:', error)
    ElMessage.error('发布失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}

async function loadEditingPost() {
  if (!isEditing.value) return
  loadingPost.value = true
  try {
    const response: any = await communityApi.getPost(editingPostId.value)
    const data = response?.data ?? response
    const currentUserId = String(localStorage.getItem('userId') || '')
    const postUserId = data?.userId == null ? '' : String(data.userId)
    if (!currentUserId || currentUserId !== postUserId) {
      ElMessage.error('你没有权限修改这个帖子')
      await router.replace({ name: 'discussion-detail', params: { postId: editingPostId.value } })
      return
    }
    postForm.postTitle = data.postTitle || ''
    postForm.postContent = data.postContent || ''
    postForm.tags = Array.isArray(data.tags) ? [...data.tags] : []
  } catch (error) {
    console.error('加载待修改帖子失败:', error)
    ElMessage.error('帖子加载失败')
    await router.replace({ name: 'discussion-detail', params: { postId: editingPostId.value } })
  } finally {
    loadingPost.value = false
  }
}

function cancelCompose() {
  if (isEditing.value) {
    router.push({ name: 'discussion-detail', params: { postId: editingPostId.value } })
    return
  }
  if (window.history.length > 1) router.back()
  else navigateTopLevel(router, '/discuss')
}

onMounted(loadEditingPost)
</script>

<style scoped>
.compose-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f7f8fb 0%, #f3f5f8 100%);
  color: #262626;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 58px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #e8ecf1;
}

.nav-left,
.nav-left nav,
.logo,
.nav-right {
  display: flex;
  align-items: center;
}

.nav-left {
  gap: 34px;
}

.nav-left nav {
  height: 58px;
  gap: 26px;
}

.logo {
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  gap: 9px;
  color: #262626;
  font-size: 18px;
  font-weight: 700;
}

.logo-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #ffa116;
  color: #fff;
}

.nav-left nav button {
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  height: 100%;
  color: #65676b;
}

.nav-left nav button:hover,
.nav-left nav button.active {
  color: #d98200;
}

.nav-left nav button.active {
  border-bottom: 2px solid #ffa116;
}

.avatar-entry {
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
}

.compose-shell {
  width: min(1240px, calc(100% - 56px));
  margin: 0 auto;
  padding: 22px 0 40px;
}

.compose-card {
  height: calc(100vh - 120px);
  min-height: 620px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.compose-header {
  flex: 0 0 auto;
  padding: 22px 24px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #edf0f3;
}

.title-wrap {
  flex: 1;
  min-width: 0;
}

.title-input {
  width: 100%;
  border: 0;
  outline: none;
  color: #25272c;
  font-size: 22px;
  line-height: 1.4;
}

.title-input::placeholder {
  color: #c1c7d0;
}

.topic-row {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.topic-select {
  width: min(460px, 100%);
}

.topic-select :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: 999px;
  background: #f7f8fa;
  box-shadow: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-toolbar {
  flex: 0 0 auto;
  min-height: 52px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #edf0f3;
  overflow-x: auto;
}

.tool-chip {
  border: 0;
  font: inherit;
  cursor: pointer;
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  color: #5f6670;
  background: #f5f6f8;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.tool-chip:hover {
  color: #d98200;
  background: #fff6ea;
  transform: translateY(-1px);
}

.toolbar-tip {
  margin-left: auto;
  color: #98a1ad;
  font-size: 13px;
  white-space: nowrap;
}

.editor-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 360px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-column {
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #edf0f3;
  overflow: hidden;
}

.editor-area {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 28px 24px 40px;
  border: 0;
  outline: none;
  resize: none;
  color: #2d3137;
  font: 15px/1.8 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}

.editor-area::placeholder {
  color: #c3c9d2;
}

.preview-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #fbfcfd;
}

.preview-header {
  min-height: 54px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #6b7280;
  font-size: 13px;
  border-bottom: 1px solid #edf0f3;
}

.preview-body {
  flex: 1;
  padding: 22px 18px 8px;
  overflow: auto;
}

.tips-card {
  margin: 0 18px 18px;
  padding: 14px 16px;
  border: 1px solid #e8ebef;
  border-radius: 8px;
  background: #fff;
}

.tips-card h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.tips-card p {
  margin: 0 0 8px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.7;
}

.tips-card code {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #c2410c;
}

.tip-text {
  margin-bottom: 0;
}

.markdown-body {
  color: #30343b;
  font-size: 15px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 24px 0 12px;
  color: #202124;
  line-height: 1.4;
}

.markdown-body :deep(h1) {
  font-size: 24px;
}

.markdown-body :deep(h2) {
  padding-bottom: 8px;
  border-bottom: 1px solid #edf0f3;
  font-size: 20px;
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(p) {
  margin: 0 0 16px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 18px;
  padding-left: 24px;
}

.markdown-body :deep(blockquote) {
  margin: 18px 0;
  padding: 10px 14px;
  border-left: 3px solid #ffa116;
  background: #fff9f0;
  color: #5c6470;
}

.markdown-body :deep(pre) {
  margin: 18px 0;
  padding: 16px;
  border-radius: 8px;
  background: #f4f6f8;
  overflow-x: auto;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f1f3f5;
  color: #c7254e;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  color: #30343b;
}

.markdown-body :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}

.markdown-body :deep(.task-list-item) {
  list-style: none;
}

.markdown-body :deep(.task-list-item input) {
  margin: 0 8px 0 -20px;
}

.markdown-body :deep(a) {
  color: #0969da;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.markdown-body :deep(table) {
  width: 100%;
  margin: 18px 0;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 9px 12px;
  border: 1px solid #dfe2e5;
  text-align: left;
}

@media (max-width: 980px) {
  .compose-card {
    height: auto;
    min-height: calc(100vh - 100px);
  }

  .editor-layout {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .editor-column {
    min-height: 480px;
    border-right: 0;
    border-bottom: 1px solid #edf0f3;
  }

  .preview-column {
    min-height: 320px;
    max-height: 560px;
  }
}

@media (max-width: 720px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-left {
    gap: 18px;
  }

  .nav-left nav {
    display: none;
  }

  .compose-shell {
    width: calc(100% - 24px);
    padding-top: 14px;
  }

  .compose-header {
    padding: 18px 16px 16px;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .editor-toolbar {
    padding: 10px 16px;
    flex-wrap: wrap;
  }

  .toolbar-tip {
    width: 100%;
    margin-left: 0;
  }

  .editor-area {
    padding: 20px 16px 32px;
  }
}
</style>
