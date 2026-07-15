<template>
  <div class="detail-page">
    <header class="navbar">
      <div class="nav-left">
        <button class="logo" type="button" @click="navigateTopLevel(router, '/home')">
          <span class="logo-mark">C</span><span>CodeWise</span>
        </button>
        <nav>
          <button type="button" @click="navigateTopLevel(router, '/home')">题库</button>
          <button type="button">竞赛</button>
          <button class="active" type="button" @click="navigateTopLevel(router, '/discuss')">讨论</button>
          <button type="button" @click="navigateTopLevel(router, '/review')">复习</button>
        </nav>
      </div>
      <button class="avatar-entry" type="button" aria-label="进入个人主页" @click="navigateTopLevel(router, '/profile')">
        <el-avatar :size="32" :src="avatarUrl">{{ avatarText }}</el-avatar>
      </button>
    </header>

    <main class="page-shell">
      <section class="main-column">
        <button class="back-link" type="button" @click="navigateTopLevel(router, '/discuss')">
          <el-icon><ArrowLeft /></el-icon><span>返回讨论</span>
        </button>

        <div v-if="loading" class="loading-panel">
          <el-icon class="is-loading"><Loading /></el-icon><span>加载帖子中...</span>
        </div>
        <el-result v-else-if="!post" icon="warning" title="帖子不存在" sub-title="内容可能已被删除或暂时无法访问">
          <template #extra><el-button @click="navigateTopLevel(router, '/discuss')">返回讨论</el-button></template>
        </el-result>

        <template v-else>
          <article class="thread-card">
            <div class="post-heading-row">
              <div class="author-row">
                <el-avatar :size="46" :src="postAuthorAvatar">{{ getAvatarText(postAuthorName) }}</el-avatar>
                <div class="author-copy">
                  <strong>{{ postAuthorName }}</strong>
                  <span>{{ formatDate(post.createTime) }} 发布</span>
                </div>
              </div>
              <div v-if="isPostOwner" class="owner-actions">
                <el-button text :icon="Edit" @click="goToEdit">修改</el-button>
                <el-button text type="danger" :icon="Delete" :loading="deletingPost" @click="deletePost">删除</el-button>
              </div>
            </div>

            <h1>{{ post.postTitle }}</h1>
            <div v-if="post.tags.length" class="tag-row">
              <el-tag v-for="tag in post.tags" :key="tag" size="small" effect="plain">#{{ tag }}</el-tag>
            </div>

            <div class="markdown-body" v-html="renderedContent"></div>

            <footer class="thread-actions">
              <button
                type="button"
                class="like-action"
                :class="{ liked: post.isLike }"
                :disabled="liking"
                :aria-pressed="Boolean(post.isLike)"
                @click="togglePostLike"
              >
                <el-icon :class="{ 'is-loading': liking }"><Loading v-if="liking" /><Pointer v-else /></el-icon>
                <span>{{ post.likeCount || 0 }}</span>
              </button>
              <span class="comment-count"><el-icon><ChatDotRound /></el-icon>{{ post.commentCount || 0 }} 条评论</span>
            </footer>
          </article>

          <section class="comments-panel">
            <h2>评论 <span>{{ post.commentCount || 0 }}</span></h2>
            <div class="comment-editor">
              <el-avatar :size="34" :src="avatarUrl">{{ avatarText }}</el-avatar>
              <div class="editor-main">
                <el-input v-model="commentText" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="写下你的看法..." />
                <el-button type="primary" :loading="commenting" @click="createComment">发表评论</el-button>
              </div>
            </div>

            <div v-if="commentsLoading" class="comments-state"><el-icon class="is-loading"><Loading /></el-icon>加载评论中...</div>
            <el-empty v-else-if="comments.length === 0" description="暂无评论，来发表第一条吧" />
            <div v-else class="comment-list">
              <article v-for="thread in commentThreads" :key="thread.root.commentId" class="comment-thread">
                <div class="comment-item">
                <el-avatar :size="34">{{ getAvatarText(thread.root.userName) }}</el-avatar>
                <div class="comment-main">
                  <div class="comment-meta"><strong>{{ thread.root.userName || 'CodeWise 用户' }}</strong><span>{{ formatDate(thread.root.createTime) }}</span></div>
                  <p>{{ thread.root.comment }}</p>
                  <div class="comment-actions">
                    <button type="button" class="like-action small" :class="{ liked: thread.root.isLike }" :aria-pressed="Boolean(thread.root.isLike)" @click="toggleCommentLike(thread.root)">
                      <el-icon><Pointer /></el-icon><span>{{ thread.root.likeCount || 0 }}</span>
                    </button>
                    <button type="button" class="reply-button" @click="openReply(thread.root, thread.root)">回复</button>
                    <button v-if="isCommentOwner(thread.root)" type="button" class="delete-comment-button" @click="deleteComment(thread.root)">删除</button>
                  </div>

                  <button
                    v-if="thread.replies.length"
                    type="button"
                    class="reply-toggle"
                    :aria-expanded="isRepliesExpanded(thread.root.commentId)"
                    @click="toggleReplies(thread.root.commentId)"
                  >
                    <el-icon><ArrowUp v-if="isRepliesExpanded(thread.root.commentId)" /><ArrowDown v-else /></el-icon>
                    <span>{{ isRepliesExpanded(thread.root.commentId) ? '收起回复' : `展开 ${thread.replies.length} 条回复` }}</span>
                  </button>

                  <div v-if="thread.replies.length && isRepliesExpanded(thread.root.commentId)" class="reply-list">
                    <div v-for="reply in thread.replies" :key="reply.commentId" class="reply-item">
                      <el-avatar :size="28">{{ getAvatarText(reply.userName) }}</el-avatar>
                      <div class="reply-main">
                        <div class="comment-meta"><strong>{{ reply.userName || 'CodeWise 用户' }}</strong><span>{{ formatDate(reply.createTime) }}</span></div>
                        <p><span v-if="reply.replyUserName" class="reply-target">回复 @{{ reply.replyUserName }}：</span>{{ reply.comment }}</p>
                        <div class="comment-actions">
                          <button type="button" class="like-action small" :class="{ liked: reply.isLike }" :aria-pressed="Boolean(reply.isLike)" @click="toggleCommentLike(reply)"><el-icon><Pointer /></el-icon><span>{{ reply.likeCount || 0 }}</span></button>
                          <button type="button" class="reply-button" @click="openReply(thread.root, reply)">回复</button>
                          <button v-if="isCommentOwner(reply)" type="button" class="delete-comment-button" @click="deleteComment(reply)">删除</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="replyingTo?.rootId === thread.root.commentId" class="reply-editor">
                    <el-input v-model="replyText" type="textarea" :rows="2" maxlength="500" show-word-limit :placeholder="`回复 @${replyingTo.userName}`" />
                    <div><el-button text @click="cancelReply">取消</el-button><el-button type="primary" :loading="replying" @click="submitReply">回复</el-button></div>
                  </div>
                </div>
                </div>
              </article>
            </div>
          </section>
        </template>
      </section>

      <aside v-if="post" class="side-column">
        <section class="side-panel">
          <h2>关于作者</h2>
          <div class="side-author">
            <el-avatar :size="48" :src="postAuthorAvatar">{{ getAvatarText(postAuthorName) }}</el-avatar>
            <div><strong>{{ postAuthorName }}</strong><span v-if="post.userDto?.userName">@{{ post.userDto.userName }}</span></div>
          </div>
          <p class="author-bio">{{ post.userDto?.bio || '这个用户还没有填写个人简介。' }}</p>
          <div class="author-stats">
            <div><span>通过</span><strong>{{ post.userDto?.totalAc ?? 0 }}</strong></div>
            <div><span>提交</span><strong>{{ post.userDto?.totalSubmit ?? 0 }}</strong></div>
            <div><span>评分</span><strong>{{ post.userDto?.rating ?? 0 }}</strong></div>
          </div>
        </section>
        <section v-if="relatedPosts.length" class="side-panel">
          <h2>相关讨论</h2>
          <button v-for="item in relatedPosts" :key="item.postId" type="button" class="topic-link" @click="openRelatedPost(item.postId)">
            <span><small># {{ item.tag }}</small>{{ item.title }}</span><el-icon><ArrowRight /></el-icon>
          </button>
        </section>
      </aside>
    </main>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChatDotRound, Delete, Edit, Loading, Pointer } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import communityApi from '@/api/communityApi'
import { normalizeAvatarUrl } from '@/utils/avatar'
import { renderMarkdown } from '@/utils/markdown'
import { navigateTopLevel } from '@/utils/navigation'
import type UserDto from '@/types/UserDto'

interface CommunityPost {
  postId: string
  postTitle: string
  postContent: string
  tags: string[]
  userId?: string
  userName?: string
  userDto?: UserDto
  relatedPost?: Record<string, Record<string, string>>
  likeCount: number
  commentCount: number
  isLike?: boolean
  createTime?: string
}

interface CommunityComment {
  commentId: string
  comment: string
  userId?: string
  userName?: string
  rootCommentId?: string
  replyUserId?: string
  replyUserName?: string
  likeCount: number
  isLike?: boolean
  createTime?: string
}

const route = useRoute()
const router = useRouter()
const post = ref<CommunityPost | null>(null)
const comments = ref<CommunityComment[]>([])
const loading = ref(true)
const commentsLoading = ref(false)
const liking = ref(false)
const commenting = ref(false)
const replying = ref(false)
const deletingPost = ref(false)
const commentText = ref('')
const replyText = ref('')
const replyingTo = ref<{ rootId: string; userId?: string; userName: string } | null>(null)
const expandedReplyIds = ref<Set<string>>(new Set())

const mockPosts: Record<string, CommunityPost> = {
  'mock-1': { postId: 'mock-1', postTitle: '如何系统准备动态规划题型？', postContent: '最近刷到背包、区间 DP 和状态压缩，经常知道要用 DP 但想不清状态定义。\n\n## 我的困惑\n\n- 状态应该怎么定义？\n- 什么时候需要压缩空间？\n- 有推荐的训练顺序吗？\n\n欢迎大家分享自己的方法。', tags: ['Algorithm', 'DP', 'Interview'], userName: 'CodeWise', likeCount: 18, commentCount: 7, createTime: '2026-07-10 09:20:00' },
  'mock-2': { postId: 'mock-2', postTitle: '我的 100 天刷题复盘', postContent: '坚持记录每天的通过题目和错题原因，比单纯追数量更有效。\n\n> 不要只记录答案，也要记录第一次为什么没有想到。\n\n```text\n题目 -> 错误思路 -> 正确突破口 -> 一周后重做\n```', tags: ['Review', '100Days'], userName: 'Dev_Alex', likeCount: 31, commentCount: 12, createTime: '2026-07-09 21:10:00' },
  'mock-3': { postId: 'mock-3', postTitle: '前端面试怎么准备手写题？', postContent: '防抖节流、Promise、深拷贝、虚拟列表这些题怎么练比较扎实？\n\n### 当前计划\n\n1. 先理解核心原理\n2. 不看答案独立实现\n3. 补边界测试\n4. 一周后重新手写', tags: ['Frontend', 'Interview'], userName: 'SaraK', likeCount: 9, commentCount: 4, createTime: '2026-07-10 12:30:00' },
}

const avatarUrl = computed(() => normalizeAvatarUrl(localStorage.getItem('avatarUrl') || ''))
const avatarText = computed(() => (localStorage.getItem('userName') || 'CW').slice(0, 2).toUpperCase())
const currentUserId = computed(() => String(localStorage.getItem('userId') || ''))
const isPostOwner = computed(() => Boolean(post.value?.userId && currentUserId.value && String(post.value.userId) === currentUserId.value))
const renderedContent = computed(() => renderMarkdown(post.value?.postContent || ''))
const postAuthorName = computed(() => post.value?.userDto?.nickName || post.value?.userDto?.userName || post.value?.userName || 'CodeWise 用户')
const postAuthorAvatar = computed(() => normalizeAvatarUrl(post.value?.userDto?.avatarUrl || ''))
const relatedPosts = computed(() => {
  const result: Array<{ postId: string; title: string; tag: string }> = []
  Object.entries(post.value?.relatedPost || {}).forEach(([tag, posts]) => {
    Object.entries(posts || {}).forEach(([postId, title]) => {
      if (postId !== post.value?.postId && !result.some((item) => item.postId === postId)) result.push({ postId, title, tag })
    })
  })
  return result.slice(0, 8)
})
const commentThreads = computed(() => {
  const roots = comments.value.filter((comment) => !comment.rootCommentId || comment.rootCommentId === '-1')
  const replies = comments.value.filter((comment) => comment.rootCommentId && comment.rootCommentId !== '-1')
  return roots.map((root) => ({ root, replies: replies.filter((reply) => reply.rootCommentId === root.commentId) }))
})

const unwrapData = <T,>(res: any, fallback: T): T => (res?.data ?? res ?? fallback) as T

const mapPost = (raw: any): CommunityPost => {
  const tags = raw.tags ?? raw.tagList ?? []
  return {
    postId: String(raw.postId ?? raw.post_id),
    postTitle: raw.postTitle ?? raw.post_title ?? '未命名帖子',
    postContent: raw.postContent ?? raw.post_content ?? '',
    tags: Array.isArray(tags) ? tags : [],
    userId: raw.userId != null ? String(raw.userId) : undefined,
    userName: raw.userName ?? raw.user_name ?? 'CodeWise 用户',
    userDto: raw.userDto ?? raw.user_dto,
    relatedPost: raw.relatedPost ?? raw.related_post ?? {},
    likeCount: Number(raw.likeCount ?? raw.like_count ?? 0),
    commentCount: Number(raw.commentCount ?? raw.comment_count ?? 0),
    isLike: Boolean(raw.isLike ?? raw.is_like ?? false),
    createTime: raw.createTime ?? raw.create_time,
  }
}

const mapComment = (raw: any): CommunityComment => ({
  commentId: String(raw.commentId ?? raw.comment_id),
  comment: raw.comment ?? '',
  userId: raw.userId != null ? String(raw.userId) : undefined,
  userName: raw.userName ?? raw.user_name ?? 'CodeWise 用户',
  rootCommentId: raw.rootCommentId != null ? String(raw.rootCommentId) : undefined,
  replyUserId: raw.replyUserId != null ? String(raw.replyUserId) : undefined,
  replyUserName: raw.replyUserName ?? raw.reply_user_name,
  likeCount: Number(raw.likeCount ?? raw.like_count ?? 0),
  isLike: Boolean(raw.isLike ?? raw.is_like ?? false),
  createTime: raw.createTime ?? raw.create_time,
})

const loadComments = async (postId: string) => {
  if (postId.startsWith('mock-')) return
  commentsLoading.value = true
  try {
    const res: any = await communityApi.listComments({ postId, rootCommentId: -1, pageSize: 20 })
    const data = unwrapData<any>(res, {})
    comments.value = Array.isArray(data.records) ? data.records.map(mapComment) : []
  } catch (error) {
    console.warn('评论加载失败:', error)
  } finally {
    commentsLoading.value = false
  }
}

const loadPost = async () => {
  const postId = String(route.params.postId || '')
  loading.value = true
  try {
    if (mockPosts[postId]) post.value = mockPosts[postId]
    else post.value = mapPost(unwrapData<any>(await communityApi.getPost(postId), null))
    if (post.value) await loadComments(post.value.postId)
  } catch (error) {
    console.error('帖子详情加载失败:', error)
    post.value = null
  } finally {
    loading.value = false
  }
}

const togglePostLike = async () => {
  if (!post.value || liking.value) return
  const previous = Boolean(post.value.isLike)
  if (post.value.postId.startsWith('mock-')) {
    post.value.isLike = !previous
  } else {
    liking.value = true
    try {
      post.value.isLike = Boolean(unwrapData<boolean>(await communityApi.togglePostLike(post.value.postId), false))
    } finally {
      liking.value = false
    }
  }
  if (post.value.isLike !== previous) post.value.likeCount = Math.max(0, post.value.likeCount + (post.value.isLike ? 1 : -1))
}

const toggleCommentLike = async (comment: CommunityComment) => {
  const previous = Boolean(comment.isLike)
  comment.isLike = comment.commentId.startsWith('mock-') ? !previous : Boolean(unwrapData<boolean>(await communityApi.toggleCommentLike(comment.commentId), false))
  if (comment.isLike !== previous) comment.likeCount = Math.max(0, comment.likeCount + (comment.isLike ? 1 : -1))
}

const isCommentOwner = (comment: CommunityComment) => Boolean(comment.userId && currentUserId.value && String(comment.userId) === currentUserId.value)

const goToEdit = () => {
  if (!post.value || !isPostOwner.value) return
  router.push({ name: 'discussion-create', query: { postId: post.value.postId } })
}

const deletePost = async () => {
  if (!post.value || !isPostOwner.value || deletingPost.value) return
  try {
    await ElMessageBox.confirm('帖子及其评论会一起删除，确定继续吗？', '删除帖子', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
      type: 'warning',
    })
    deletingPost.value = true
    await communityApi.deletePost(post.value.postId)
    ElMessage.success('帖子已删除')
    await router.replace('/discuss')
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') console.error('删除帖子失败:', error)
  } finally {
    deletingPost.value = false
  }
}

const deleteComment = async (comment: CommunityComment) => {
  if (!post.value || !isCommentOwner(comment)) return
  try {
    await ElMessageBox.confirm(
      comment.rootCommentId && comment.rootCommentId !== '-1' ? '确定删除这条回复吗？' : '删除该评论会同时删除下面的回复，确定继续吗？',
      '删除评论',
      { confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger', type: 'warning' },
    )
    await communityApi.deleteComment(comment.commentId)
    if (replyingTo.value?.rootId === comment.commentId) cancelReply()
    post.value = mapPost(unwrapData<any>(await communityApi.getPost(post.value.postId), null))
    await loadComments(post.value.postId)
    ElMessage.success('评论已删除')
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') console.error('删除评论失败:', error)
  }
}

const createComment = async () => {
  if (!post.value || !commentText.value.trim()) {
    ElMessage.warning('评论不能为空')
    return
  }
  if (post.value.postId.startsWith('mock-')) {
    ElMessage.info('示例帖子暂不支持发表评论')
    return
  }
  commenting.value = true
  try {
    const requestIdRes: any = await communityApi.getRequestId()
    const requestId = typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.message
    if (!requestId) throw new Error('requestId 获取失败')
    await communityApi.createComment({ comment: commentText.value.trim(), postId: post.value.postId, rootCommentId: -1 }, requestId)
    commentText.value = ''
    post.value.commentCount += 1
    await loadComments(post.value.postId)
    ElMessage.success('评论已发表')
  } catch (error) {
    console.error('发表评论失败:', error)
  } finally {
    commenting.value = false
  }
}

const openReply = (root: CommunityComment, target: CommunityComment) => {
  expandedReplyIds.value = new Set(expandedReplyIds.value).add(root.commentId)
  replyingTo.value = { rootId: root.commentId, userId: target.userId, userName: target.userName || 'CodeWise 用户' }
  replyText.value = ''
}

const isRepliesExpanded = (rootId: string) => expandedReplyIds.value.has(rootId)

const toggleReplies = (rootId: string) => {
  const next = new Set(expandedReplyIds.value)
  if (next.has(rootId)) next.delete(rootId)
  else next.add(rootId)
  expandedReplyIds.value = next
}

const cancelReply = () => {
  replyingTo.value = null
  replyText.value = ''
}

const submitReply = async () => {
  if (!post.value || !replyingTo.value || !replyText.value.trim()) {
    ElMessage.warning('回复内容不能为空')
    return
  }
  replying.value = true
  try {
    const requestIdRes: any = await communityApi.getRequestId()
    const requestId = typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.message
    if (!requestId) throw new Error('requestId 获取失败')
    await communityApi.createComment({
      comment: replyText.value.trim(),
      postId: post.value.postId,
      rootCommentId: replyingTo.value.rootId,
      replyUserId: replyingTo.value.userId,
      replyUserName: replyingTo.value.userName,
    }, requestId)
    post.value.commentCount += 1
    cancelReply()
    await loadComments(post.value.postId)
    ElMessage.success('回复已发表')
  } catch (error) {
    console.error('发表回复失败:', error)
  } finally {
    replying.value = false
  }
}

const goToTag = (tag: string) => router.push({ path: '/discuss', query: { tag } })
const openRelatedPost = (postId: string) => router.push({ name: 'discussion-detail', params: { postId } })
const getAvatarText = (name?: string) => (name || 'CW').slice(0, 2).toUpperCase()
const formatDate = (date?: string) => {
  if (!date) return '刚刚'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(loadPost)
watch(() => route.params.postId, () => {
  comments.value = []
  expandedReplyIds.value = new Set()
  cancelReply()
  loadPost()
})
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #f6f7f9; color: #262626; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.navbar { position: sticky; top: 0; z-index: 20; height: 58px; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.96); border-bottom: 1px solid #e8ecf1; }
.nav-left, .nav-left nav, .logo { display: flex; align-items: center; }
.nav-left { gap: 34px; }.nav-left nav { height: 58px; gap: 26px; }
button { border: 0; background: transparent; font: inherit; cursor: pointer; }
.logo { gap: 9px; color: #262626; font-size: 18px; font-weight: 700; }.logo-mark { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; background: #ffa116; color: #fff; }
.nav-left nav button { height: 100%; color: #65676b; }.nav-left nav button:hover, .nav-left nav button.active { color: #d98200; }.nav-left nav button.active { border-bottom: 2px solid #ffa116; }
.avatar-entry { padding: 0; border-radius: 50%; }
.page-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 24px 0 56px; display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: start; }
.main-column { min-width: 0; }.back-link { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; color: #6b7280; }.back-link:hover { color: #d98200; }
.thread-card, .comments-panel, .side-panel, .loading-panel { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.thread-card { padding: 26px 30px 0; }.post-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }.author-row { display: flex; align-items: center; gap: 12px; }.author-copy, .side-author div { display: flex; flex-direction: column; gap: 3px; }.author-copy strong { font-size: 15px; }.author-copy span, .side-author span { color: #8a8f98; font-size: 12px; }.owner-actions { display: flex; align-items: center; flex-shrink: 0; }.owner-actions :deep(.el-button + .el-button) { margin-left: 2px; }
h1 { margin: 25px 0 12px; color: #1f2328; font-size: 28px; line-height: 1.35; letter-spacing: 0; }.tag-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 24px; }
.tag-row :deep(.el-tag) { border-color: #e6e8eb; background: #f6f7f9; color: #5f6368; }
.markdown-body { min-height: 180px; color: #30343b; font-size: 16px; line-height: 1.85; overflow-wrap: anywhere; }
.markdown-body :deep(h2), .markdown-body :deep(h3), .markdown-body :deep(h4) { margin: 28px 0 12px; color: #202124; line-height: 1.4; letter-spacing: 0; }.markdown-body :deep(h2) { padding-bottom: 8px; border-bottom: 1px solid #edf0f3; font-size: 21px; }.markdown-body :deep(h3) { font-size: 18px; }
.markdown-body :deep(p) { margin: 0 0 16px; }.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 0 0 18px; padding-left: 26px; }.markdown-body :deep(blockquote) { margin: 18px 0; padding: 10px 16px; border-left: 3px solid #ffa116; background: #fff9f0; color: #5c6470; }
.markdown-body :deep(pre) { margin: 18px 0; padding: 16px; border-radius: 6px; background: #f5f6f7; overflow-x: auto; }.markdown-body :deep(code) { padding: 2px 5px; border-radius: 4px; background: #f2f3f5; color: #c7254e; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 13px; }.markdown-body :deep(pre code) { padding: 0; background: transparent; color: #30343b; }
.markdown-body :deep(.katex-display) { overflow-x: auto; overflow-y: hidden; padding: 4px 0; }.markdown-body :deep(.task-list-item) { list-style: none; }.markdown-body :deep(.task-list-item input) { margin: 0 8px 0 -20px; }
.markdown-body :deep(a) { color: #0969da; text-decoration: none; }.markdown-body :deep(a:hover) { text-decoration: underline; }.markdown-body :deep(img) { max-width: 100%; border-radius: 6px; }.markdown-body :deep(table) { width: 100%; margin: 18px 0; border-collapse: collapse; }.markdown-body :deep(th), .markdown-body :deep(td) { padding: 9px 12px; border: 1px solid #dfe2e5; text-align: left; }
.thread-actions { min-height: 58px; margin-top: 28px; border-top: 1px solid #edf0f3; display: flex; align-items: center; gap: 24px; }.like-action { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 4px; color: #7a7f87; transition: color .16s ease, transform .16s ease; }.like-action:hover, .like-action.liked { color: #e5484d; }.like-action:active { transform: scale(.94); }.like-action:disabled { cursor: wait; opacity: .7; }.comment-count { display: inline-flex; align-items: center; gap: 6px; color: #7a7f87; font-size: 14px; }
.comments-panel { margin-top: 18px; padding: 24px 28px; }.comments-panel h2, .side-panel h2 { margin: 0; font-size: 16px; letter-spacing: 0; }.comments-panel h2 span { color: #9ca3af; font-size: 13px; font-weight: 400; }.comment-editor { display: flex; align-items: flex-start; gap: 11px; margin-top: 18px; padding-bottom: 22px; border-bottom: 1px solid #edf0f3; }.editor-main { flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.comment-list { display: flex; flex-direction: column; }.comment-thread { border-bottom: 1px solid #edf0f3; }.comment-thread:last-child { border-bottom: 0; }.comment-item { display: flex; gap: 11px; padding: 20px 0; }.comment-main { flex: 1; min-width: 0; }.comment-meta { display: flex; align-items: baseline; gap: 10px; }.comment-meta strong { font-size: 14px; }.comment-meta span { color: #9ca3af; font-size: 12px; }.comment-item p, .reply-item p { margin: 10px 0 7px; line-height: 1.7; white-space: pre-wrap; }.comment-actions { display: flex; align-items: center; gap: 14px; }.like-action.small { min-height: 25px; font-size: 13px; }.reply-button, .delete-comment-button { padding: 3px 2px; color: #818690; font-size: 13px; }.reply-button:hover { color: #d98200; }.delete-comment-button:hover { color: #e5484d; }.reply-toggle { margin-top: 10px; padding: 5px 2px; display: inline-flex; align-items: center; gap: 5px; color: #737982; font-size: 13px; }.reply-toggle:hover { color: #d98200; }.reply-list { margin-top: 9px; display: flex; flex-direction: column; gap: 12px; }.reply-item { display: flex; gap: 10px; padding: 16px; border-radius: 8px; background: #f2f3f4; }.reply-main { flex: 1; min-width: 0; }.reply-target { color: #1683e8; }.reply-editor { margin-top: 12px; padding: 12px; border-radius: 8px; background: #f2f3f4; }.reply-editor > div { margin-top: 8px; display: flex; justify-content: flex-end; gap: 6px; }.comments-state, .loading-panel { min-height: 120px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #8a8f98; }
.side-column { position: sticky; top: 82px; display: flex; flex-direction: column; gap: 16px; }.side-panel { padding: 18px; }.side-panel h2 { padding-bottom: 12px; border-bottom: 1px solid #edf0f3; }.side-author { display: flex; align-items: center; gap: 11px; padding-top: 16px; }.side-author strong { font-size: 14px; }.author-bio { margin: 14px 0; color: #737982; font-size: 13px; line-height: 1.6; }.author-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }.author-stats div { padding: 9px 4px; border-radius: 6px; background: #f6f7f9; display: flex; flex-direction: column; align-items: center; gap: 3px; }.author-stats span { color: #8a8f98; font-size: 11px; }.author-stats strong { font-size: 14px; }.topic-link { width: 100%; padding: 12px 2px; border-bottom: 1px solid #f0f1f3; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #555b65; text-align: left; }.topic-link > span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.topic-link small { color: #d98200; }.topic-link:last-child { border-bottom: 0; }.topic-link:hover { color: #d98200; }
@media (max-width: 900px) { .page-shell { grid-template-columns: 1fr; }.side-column { position: static; }.nav-left nav { display: none; } }
@media (max-width: 640px) { .navbar { padding: 0 16px; }.page-shell { width: calc(100% - 24px); padding-top: 14px; }.thread-card { padding: 20px 18px 0; }.post-heading-row { align-items: center; }.owner-actions :deep(.el-button span) { display: none; }.comments-panel { padding: 20px 18px; }h1 { font-size: 23px; }.comment-editor > .el-avatar { display: none; } }
</style>
