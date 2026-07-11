<template>
  <div class="discussion-view">
    <header class="navbar">
      <div class="navbar-left">
        <button class="logo" type="button" @click="goHome">
          <span class="logo-icon">C</span>
          <span class="logo-text">CodeWise</span>
        </button>
        <nav class="nav-menu">
          <button class="nav-item" type="button" @click="goHome">题库</button>
          <button class="nav-item" type="button">竞赛</button>
          <button class="nav-item active" type="button">讨论</button>
          <button class="nav-item" type="button" @click="goReview">复习</button>
        </nav>
      </div>

      <div class="navbar-right">
        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="搜索帖子、标签、题目..."
          :prefix-icon="Search"
          size="small"
          clearable
        />
        <el-button :icon="Bell" circle size="small" />
        <button class="avatar-entry" type="button" @click="goProfile" aria-label="进入个人主页">
          <el-avatar :size="32" :src="avatarUrl">{{ avatarText }}</el-avatar>
        </button>
      </div>
    </header>

    <main class="discussion-shell">
      <section class="feed-panel">
        <div class="tabs-row">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="tab-item"
            :class="{ active: activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="composer-card">
          <div>
            <h1>讨论</h1>
            <p>分享刷题经验、面试复盘、系统设计和学习计划。</p>
          </div>
          <el-button type="primary" :icon="EditPen" @click="openCreatePage">发布帖子</el-button>
        </div>

        <div v-if="(loading && posts.length === 0) || postSearchLoading" class="state-line">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>{{ postSearchLoading ? '搜索帖子中...' : '加载讨论中...' }}</span>
        </div>

        <el-empty v-else-if="filteredPosts.length === 0" description="暂无讨论" />

        <div v-else class="post-list">
          <article
            v-for="post in filteredPosts"
            :key="post.postId"
            class="post-card"
            @click="openPost(post)"
          >
            <div class="post-main">
              <div class="post-meta">
                <el-avatar :size="34" :src="getPostAvatar(post)">{{ getAvatarText(post.userName) }}</el-avatar>
                <div>
                  <strong>{{ post.userName || 'CodeWise 用户' }}</strong>
                  <span>{{ formatDate(post.createTime) }}</span>
                </div>
              </div>

              <h2>{{ post.postTitle }}</h2>
              <p>{{ post.postContent || getPostPreview(post) }}</p>

              <div v-if="post.tags.length" class="tag-row">
                <el-tag v-for="tag in post.tags" :key="tag" size="small" effect="plain">
                  {{ tag }}
                </el-tag>
              </div>

              <div class="post-stats">
                <span><el-icon><Pointer /></el-icon>{{ post.likeCount || 0 }} 点赞</span>
                <span><el-icon><ChatDotRound /></el-icon>{{ post.commentCount || 0 }} 评论</span>
                <span><el-icon><View /></el-icon>{{ post.viewCount || 0 }} 浏览</span>
              </div>
            </div>

            <div class="post-cover" :class="post.coverTone">
              <span>{{ post.coverText }}</span>
            </div>
          </article>

          <div v-if="hasMore && !isSearchActive" class="load-more">
            <el-button :loading="loadingMore" @click="loadPosts(false)">加载更多</el-button>
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <section class="side-card search-card">
          <el-input v-model="keyword" placeholder="搜索帖子、标签、题目" :prefix-icon="Search" clearable />

          <div v-if="keyword.trim()" class="search-groups">
            <div class="search-group">
              <div class="search-group-title">
                <span>匹配标签</span>
                <small>{{ filteredTags.length }}</small>
              </div>
              <div v-if="filteredTags.length" class="tag-cloud compact">
                <button
                  v-for="tag in filteredTags"
                  :key="tag"
                  type="button"
                  :class="{ active: selectedTag === tag }"
                  @click="selectTag(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <p v-else class="empty-tip">暂无匹配标签</p>
            </div>

            <div class="search-group">
              <div class="search-group-title">
                <span>相关题目</span>
                <small v-if="questionSearchLoading">搜索中</small>
                <small v-else>{{ questionResults.length }}</small>
              </div>
              <div v-if="questionResults.length" class="question-result-list">
                <button
                  v-for="question in questionResults"
                  :key="question.questionId"
                  type="button"
                  class="question-result"
                  @click="openQuestion(question.questionId)"
                >
                  <span>{{ question.questionTitle }}</span>
                  <el-tag :type="getDifficultyType(question.difficulty)" size="small">
                    {{ getDifficultyLabel(question.difficulty) }}
                  </el-tag>
                </button>
              </div>
              <p v-else-if="!questionSearchLoading" class="empty-tip">暂无相关题目</p>
            </div>
          </div>
        </section>

        <section class="side-card">
          <div class="side-title">
            <h2>发现</h2>
            <span>热门标签</span>
          </div>
          <div class="tag-cloud">
            <button
              v-for="tag in hotTags"
              :key="tag"
              type="button"
              :class="{ active: selectedTag === tag }"
              @click="selectTag(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </section>

        <section class="side-card">
          <div class="side-title">
            <h2>热度最高</h2>
            <span>Top 10 帖子</span>
          </div>
          <button
            v-for="(post, index) in hottestPosts"
            :key="post.postId"
            type="button"
            class="trend-item"
            @click="openPost(post)"
          >
            <i>{{ index + 1 }}</i>
            <span class="trend-copy">
              <strong>{{ post.postTitle }}</strong>
              <span>{{ getHeatScore(post) }} 热度 · {{ post.commentCount || 0 }} 评论 · {{ post.likeCount || 0 }} 点赞</span>
            </span>
          </button>
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ChatDotRound, EditPen, Loading, Pointer, Search, View } from '@element-plus/icons-vue'
import communityApi from '@/api/communityApi'
import questionApi from '@/api/questionApi'
import { normalizeAvatarUrl } from '@/utils/avatar'

interface CommunityPost {
  postId: string
  postTitle: string
  postContent?: string
  tags: string[]
  userId?: string
  userName?: string
  avatar?: string
  likeCount: number
  commentCount: number
  viewCount: number
  isLike?: boolean
  createTime?: string
  updateTime?: string
  coverText: string
  coverTone: string
}

interface QuestionResult {
  questionId: number
  questionTitle: string
  difficulty: number
  tags?: string
}

const router = useRouter()
const keyword = ref('')
const selectedTag = ref('')
const activeTab = ref('recommended')
const posts = ref<CommunityPost[]>([])
const hotPosts = ref<CommunityPost[]>([])
const searchPostResults = ref<CommunityPost[]>([])
const questionResults = ref<QuestionResult[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const postSearchLoading = ref(false)
const questionSearchLoading = ref(false)
const lastId = ref<string | null>(null)
const hasMore = ref(true)
let postSearchTimer: number | undefined
let questionSearchTimer: number | undefined

const tabs = [
  { label: '推荐', value: 'recommended' },
  { label: '面试复盘', value: 'interview' },
  { label: '内推信息', value: 'referral' },
  { label: '技术交流', value: 'tech' },
]

const fallbackPosts: CommunityPost[] = [
  {
    postId: 'mock-1',
    postTitle: '如何系统准备动态规划题型？',
    postContent: '最近刷到背包、区间 DP 和状态压缩，经常知道要用 DP 但想不清状态定义，大家有什么训练路径？',
    tags: ['Algorithm', 'DP', 'Interview'],
    userName: 'CodeWise',
    likeCount: 18,
    commentCount: 7,
    viewCount: 2400,
    createTime: '2026-07-10 09:20:00',
    coverText: 'DP',
    coverTone: 'orange',
  },
  {
    postId: 'mock-2',
    postTitle: '我的 100 天刷题复盘',
    postContent: '坚持记录每天的通过题目和错题原因，比单纯追数量更有效。这里分享一下我做复盘表的方法。',
    tags: ['Review', '100Days'],
    userName: 'Dev_Alex',
    likeCount: 31,
    commentCount: 12,
    viewCount: 3100,
    createTime: '2026-07-09 21:10:00',
    coverText: '100 Days',
    coverTone: 'green',
  },
  {
    postId: 'mock-3',
    postTitle: '前端面试怎么准备手写题？',
    postContent: '防抖节流、Promise、深拷贝、虚拟列表这些题怎么练比较扎实？想听听大家的经验。',
    tags: ['Frontend', 'Interview'],
    userName: 'SaraK',
    likeCount: 9,
    commentCount: 4,
    viewCount: 860,
    createTime: '2026-07-10 12:30:00',
    coverText: 'FE',
    coverTone: 'blue',
  },
]

const avatarUrl = computed(() => normalizeAvatarUrl(localStorage.getItem('avatarUrl') || ''))
const avatarText = computed(() => (localStorage.getItem('userName') || 'CW').slice(0, 2).toUpperCase())
const isSearchActive = computed(() => Boolean(keyword.value.trim() || selectedTag.value))

const allTags = computed(() => {
  const tags = new Map<string, number>()
  ;[...posts.value, ...hotPosts.value, ...searchPostResults.value].forEach((post) => {
    post.tags.forEach((tag) => tags.set(tag, (tags.get(tag) || 0) + 1))
  })
  return [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag)
})

const hotTags = computed(() => allTags.value.slice(0, 12))

const filteredTags = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return hotTags.value
  return allTags.value.filter((tag) => tag.toLowerCase().includes(text)).slice(0, 12)
})

const filteredPosts = computed(() => {
  const source = isSearchActive.value ? searchPostResults.value : posts.value
  return source.filter((post) => {
    const matchedTab =
      activeTab.value === 'recommended' ||
      (activeTab.value === 'interview' && post.tags.some((tag) => /interview|面试/i.test(tag))) ||
      (activeTab.value === 'referral' && post.tags.some((tag) => /referral|内推/i.test(tag))) ||
      (activeTab.value === 'tech' && post.tags.some((tag) => /algorithm|frontend|backend|system|tech|技术/i.test(tag)))
    return matchedTab
  })
})

const hottestPosts = computed(() => {
  if (hotPosts.value.length) return hotPosts.value.slice(0, 10)
  return [...posts.value].sort((a, b) => getHeatScore(b) - getHeatScore(a)).slice(0, 10)
})

const unwrapData = <T,>(res: any, fallback: T): T => {
  return (res?.data ?? res ?? fallback) as T
}

const normalizeTags = (rawTags: unknown): string[] => {
  if (Array.isArray(rawTags)) return rawTags.map(String).filter(Boolean)
  if (typeof rawTags === 'string') {
    return rawTags
      .split(/[,，#\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

const mapPost = (raw: any, index = 0): CommunityPost => {
  const tags = normalizeTags(raw.tags ?? raw.tagList ?? raw.tag_list)
  return {
    postId: String(raw.postId ?? raw.post_id),
    postTitle: raw.postTitle ?? raw.post_title ?? '未命名帖子',
    postContent: raw.postContent ?? raw.post_content,
    tags,
    userId: raw.userId !== undefined && raw.userId !== null ? String(raw.userId) : undefined,
    userName: raw.userName ?? raw.user_name ?? 'CodeWise 用户',
    avatar: raw.avatar ?? raw.avatarUrl ?? raw.avatar_url,
    likeCount: Number(raw.likeCount ?? raw.like_count ?? 0),
    commentCount: Number(raw.commentCount ?? raw.comment_count ?? 0),
    viewCount: Number(raw.viewCount ?? raw.view_count ?? 0),
    isLike: Boolean(raw.isLike ?? raw.is_like ?? false),
    createTime: raw.createTime ?? raw.create_time,
    updateTime: raw.updateTime ?? raw.update_time,
    coverText: getCoverText(tags, index),
    coverTone: ['orange', 'green', 'blue', 'dark'][index % 4],
  }
}

const mapQuestion = (raw: any): QuestionResult => ({
  questionId: Number(raw.questionId ?? raw.question_id),
  questionTitle: raw.questionTitle ?? raw.title ?? raw.question_title ?? '未命名题目',
  difficulty: Number(raw.difficulty ?? 1),
  tags: raw.tags,
})

const getCoverText = (tags: string[], index: number) => {
  return tags[0] || ['Discuss', 'Code', 'Interview', 'Idea'][index % 4]
}

const getHeatScore = (post: CommunityPost) => {
  return post.likeCount * 3 + post.commentCount * 5 + Math.floor(post.viewCount / 50)
}

const loadPosts = async (refresh = true) => {
  if (refresh) {
    loading.value = true
    lastId.value = null
    hasMore.value = true
  } else {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
  }

  try {
    const res: any = await communityApi.listPosts({
      pageSize: 20,
      lastId: refresh ? null : lastId.value,
    })
    const data = unwrapData<any>(res, {})
    const records = Array.isArray(data.records) ? data.records.map(mapPost) : []
    posts.value = refresh ? records : [...posts.value, ...records]
    lastId.value = data.nextCursor !== undefined && data.nextCursor !== null ? String(data.nextCursor) : null
    hasMore.value = Boolean(data.hasNext)

    if (posts.value.length === 0) {
      posts.value = fallbackPosts
      hasMore.value = false
    }
  } catch (error) {
    console.warn('讨论接口暂不可用，使用本地示例数据', error)
    if (refresh) {
      posts.value = fallbackPosts
      hasMore.value = false
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadHotPosts = async () => {
  try {
    const res: any = await communityApi.hotPosts()
    const data = unwrapData<any[]>(res, [])
    hotPosts.value = Array.isArray(data) ? data.map(mapPost).slice(0, 10) : []
  } catch (error) {
    console.warn('加载热榜帖子失败:', error)
    hotPosts.value = []
  }
}

const searchPosts = async () => {
  const text = keyword.value.trim()
  if (!text) {
    if (!selectedTag.value) searchPostResults.value = []
    postSearchLoading.value = false
    return
  }

  postSearchLoading.value = true
  try {
    const res: any = await communityApi.searchPosts({ keyword: text, limit: 20 })
    const data = unwrapData<any[]>(res, [])
    searchPostResults.value = Array.isArray(data) ? data.map(mapPost) : []
    console.log(searchPostResults.value)
  } catch (error) {
    console.warn('搜索帖子失败:', error)
    searchPostResults.value = []
  } finally {
    postSearchLoading.value = false
  }
}

const loadPostsByTag = async (tag: string) => {
  if (!tag) {
    searchPostResults.value = []
    return
  }

  postSearchLoading.value = true
  try {
    const res: any = await communityApi.postsByTag({ tag, limit: 20 })
    const data = unwrapData<any[]>(res, [])
    searchPostResults.value = Array.isArray(data) ? data.map(mapPost) : []
  } catch (error) {
    console.warn('按标签搜索帖子失败:', error)
    searchPostResults.value = []
  } finally {
    postSearchLoading.value = false
  }
}

const searchQuestions = async () => {
  const title = keyword.value.trim()
  if (!title) {
    questionResults.value = []
    questionSearchLoading.value = false
    return
  }

  questionSearchLoading.value = true
  try {
    const res: any = await questionApi.cursorquestions({ pageSize: 8, title })
    const data = unwrapData<any>(res, {})
    questionResults.value = Array.isArray(data.records) ? data.records.map(mapQuestion) : []
  } catch (error) {
    console.warn('题目搜索失败:', error)
    questionResults.value = []
  } finally {
    questionSearchLoading.value = false
  }
}

const selectTag = (tag: string) => {
  const nextTag = selectedTag.value === tag ? '' : tag
  selectedTag.value = nextTag
  keyword.value = ''
  loadPostsByTag(nextTag)
}

const openCreatePage = () => router.push({ name: 'discussion-create' })
const openPost = async (post: CommunityPost) => {
  await router.push({ name: 'discussion-detail', params: { postId: post.postId } })
}
const openQuestion = (questionId: number) => {
  router.push({ path: '/questiondetailview', query: { questionId } })
}

const getAvatarText = (name?: string) => (name || 'CW').slice(0, 2).toUpperCase()
const getPostAvatar = (post: CommunityPost) => normalizeAvatarUrl(post.avatar || '')

const getPostPreview = (post: CommunityPost) => {
  if (post.tags.length) return `关于 ${post.tags.join('、')} 的讨论`
  return '这里还没有正文摘要，点击查看详情。'
}

const getDifficultyType = (difficulty: number) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' } as const
  return map[difficulty as 1 | 2 | 3] || 'info'
}

const getDifficultyLabel = (difficulty: number) => {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[difficulty] || '未知'
}

const formatDate = (date?: string) => {
  if (!date) return '刚刚'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const goHome = () => router.push('/home')
const goReview = () => router.push('/review')
const goProfile = () => router.push('/profile')

watch(keyword, () => {
  selectedTag.value = ''
  if (postSearchTimer) window.clearTimeout(postSearchTimer)
  if (questionSearchTimer) window.clearTimeout(questionSearchTimer)
  postSearchTimer = window.setTimeout(searchPosts, 240)
  questionSearchTimer = window.setTimeout(searchQuestions, 240)
})

onMounted(() => {
  loadPosts(true)
  loadHotPosts()
})

onBeforeUnmount(() => {
  if (postSearchTimer) window.clearTimeout(postSearchTimer)
  if (questionSearchTimer) window.clearTimeout(questionSearchTimer)
})
</script>

<style scoped>
.discussion-view {
  min-height: 100vh;
  background: #f6f7f9;
  color: #191c1e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 58px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #e8ecf1;
}

.navbar-left,
.navbar-right,
.nav-menu {
  display: flex;
  align-items: center;
}

.navbar-left {
  gap: 32px;
}

.navbar-right {
  gap: 14px;
}

.logo,
.nav-item,
.tab-item,
.trend-item,
.tag-cloud button,
.avatar-entry,
.question-result {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a1a2e;
  font-size: 18px;
  font-weight: 700;
}

.logo-icon,
.nav-item.active {
  color: #ffa116;
}

.logo-icon {
  font-size: 22px;
  font-weight: 800;
}

.nav-menu {
  gap: 4px;
}

.nav-item {
  padding: 7px 15px;
  border-radius: 6px;
  color: #4a4a4a;
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover,
.nav-item.active {
  background: #fff8f0;
  color: #ffa116;
}

.search-input {
  width: 250px;
}

.avatar-entry {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 999px;
}

.discussion-shell {
  width: min(1320px, calc(100% - 64px));
  margin: 0 auto;
  padding: 24px 0 42px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 24px;
  align-items: start;
}

.feed-panel {
  min-width: 0;
}

.tabs-row {
  position: sticky;
  top: 58px;
  z-index: 20;
  padding-top: 10px;
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #e8ecf1;
  background: #f6f7f9;
}

.tab-item {
  padding: 0 0 12px;
  border-bottom: 2px solid transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
}

.tab-item.active {
  border-bottom-color: #262626;
  color: #1a1a2e;
}

.composer-card,
.post-card,
.side-card {
  background: #ffffff;
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.composer-card {
  margin: 18px 0;
  padding: 20px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.composer-card h1 {
  margin: 0 0 5px;
  color: #1a1a2e;
  font-size: 24px;
}

.composer-card p,
.post-card p,
.side-title span,
.post-meta span,
.post-stats,
.trend-copy > span,
.empty-tip {
  color: #6b7280;
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.post-card {
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 138px;
  gap: 18px;
  align-items: start;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.post-card:hover {
  border-color: #ffe1b8;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.post-card:hover h2 {
  color: #ffa116;
}

.post-main {
  min-width: 0;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
}

.post-meta strong,
.post-meta span {
  display: block;
}

.post-card h2 {
  margin: 0 0 8px;
  color: #1a1a2e;
  font-size: 18px;
  line-height: 1.35;
  transition: color 0.18s ease;
}

.post-card p {
  margin: 0 0 12px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 14px;
  line-height: 1.65;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.post-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
}

.post-stats span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.post-cover {
  height: 86px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
}

.post-cover.orange {
  background: linear-gradient(135deg, #262626, #9a5b00);
}

.post-cover.green {
  background: linear-gradient(135deg, #1f2937, #047857);
}

.post-cover.blue {
  background: linear-gradient(135deg, #1f2937, #2563eb);
}

.post-cover.dark {
  background: #262626;
}

.load-more,
.state-line {
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #8c8c8c;
}

.side-panel {
  position: sticky;
  top: 82px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.side-card {
  padding: 16px;
}

.search-groups {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #1a1a2e;
  font-size: 13px;
  font-weight: 700;
}

.search-group-title small,
.empty-tip {
  font-size: 12px;
  font-weight: 400;
}

.empty-tip {
  margin: 0;
}

.side-title h2 {
  margin: 0;
  color: #1a1a2e;
  font-size: 16px;
}

.side-title span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tag-cloud.compact {
  margin-top: 0;
}

.tag-cloud button {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f5f7fa;
  color: #4a4a4a;
  font-size: 12px;
}

.tag-cloud button.active,
.tag-cloud button:hover {
  background: #fff8f0;
  color: #d98200;
}

.question-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-result {
  width: 100%;
  min-height: 38px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #edf0f3;
  color: #24292f;
  text-align: left;
}

.question-result span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-result:hover {
  color: #d98200;
}

.trend-item {
  width: 100%;
  padding: 12px 0;
  border-bottom: 1px solid #edf0f3;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
}

.trend-item:last-child {
  border-bottom: 0;
}

.trend-item i {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: #f5f7fa;
  color: #8a8f98;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.trend-item:nth-of-type(1) i,
.trend-item:nth-of-type(2) i,
.trend-item:nth-of-type(3) i {
  background: #fff8f0;
  color: #d98200;
}

.trend-copy {
  min-width: 0;
  display: block;
}

.trend-copy strong,
.trend-copy > span {
  display: block;
}

.trend-copy strong {
  color: #1a1a2e;
  font-size: 13px;
  line-height: 1.45;
}

.trend-copy > span {
  margin-top: 4px;
  font-size: 12px;
}

.trend-item:hover .trend-copy strong {
  color: #ffa116;
}

@media (max-width: 980px) {
  .discussion-shell {
    grid-template-columns: 1fr;
  }

  .side-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-menu,
  .navbar-right .search-input {
    display: none;
  }

  .discussion-shell {
    width: calc(100% - 24px);
    padding-top: 14px;
  }

  .composer-card,
  .post-card {
    grid-template-columns: 1fr;
  }

  .composer-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .post-cover {
    display: none;
  }
}
</style>
