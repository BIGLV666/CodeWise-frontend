<template>
  <div class="leetcode-clone">
    <AppNavBar active="home" show-search v-model:search="searchKeyword" @search="handleSearch" />

    <div class="main-container">
      <aside class="left-panel cw-offcanvas" :class="{ 'is-open': nav.open.value }">
        <section class="sidebar-section">
          <div class="section-title">学习</div>
          <button class="menu-item active" type="button" @click="refreshQuestions">
            <el-icon><Collection /></el-icon>
            <span>全部题目</span>

          </button>
          <button class="menu-item" type="button" @click="openFavorites()">
            <el-icon><Star /></el-icon>
            <span>我的收藏</span>
          </button>
          <button class="menu-item" type="button" @click="goReview">
            <el-icon><Clock /></el-icon>
            <span>复习</span>
          </button>
        </section>

        <section class="sidebar-section">
          <div class="section-title">我的收藏</div>
          <button
            v-for="favorite in homeFavorites"
            :key="favorite.favoritesId"
            class="menu-item"
            type="button"
            @click="openFavorites(favorite.favoritesId)"
          >
            <span class="dot orange"></span>
            <span class="favorite-menu-name">{{ favorite.favoritesName || '未命名收藏夹' }}</span>
            <span class="badge">{{ favorite.questionIds?.length || 0 }}</span>
          </button>
          <div v-if="!favoritesLoading && homeFavorites.length === 0" class="menu-empty">
            暂无收藏
          </div>
          <button class="menu-item create-btn" type="button" @click="openFavorites()">
            <el-icon><Plus /></el-icon>
            <span>创建新收藏</span>
          </button>
        </section>

        <section class="sidebar-section">
          <div class="section-title">难度筛选</div>
          <el-checkbox-group v-model="difficultyFilter" class="difficulty-group" @change="handleFilterChange">
            <el-checkbox :value="1">简单</el-checkbox>
            <el-checkbox :value="2">中等</el-checkbox>
            <el-checkbox :value="3">困难</el-checkbox>
          </el-checkbox-group>
        </section>
      </aside>

      <main class="center-panel">
        <section class="home-overview">
          <div class="overview-copy">
            <span class="eyebrow">题库训练 · {{ currentMonth }}</span>
            <h1>今天从一道合适的题开始</h1>
            <p>按难度、状态和关键词筛选题目；收藏常练题单，或者进入复习页按计划巩固薄弱点。</p>
          </div>
        </section>

        <section class="question-panel">
          <div class="content-header">
            <div class="header-left">
              <MobileNavToggle purpose="sidebar" :open="nav.open.value" :icon="Filter" label="打开筛选与收藏" @toggle="nav.toggle" />
              <h2>题目列表</h2>
              <el-segmented
                v-model="activeQuestionType"
                :options="questionTypeOptions"
                size="small"
                class="question-type-switch"
                @change="handleQuestionTypeChange"
              />
            </div>
            <div class="header-right">
              <el-button v-if="userStore.isAdmin" size="small" :icon="Download" class="import-button" @click="goLeetCodeImport">
                导入力扣
              </el-button>
              <el-select
                v-model="statusFilter"
                size="small"
                placeholder="状态"
                class="filter-select"
                clearable
                @change="handleFilterChange"
              >
                <el-option label="全部" value="" />
                <el-option label="未尝试" :value="0" />
                <el-option label="已通过" :value="1" />
                <el-option label="尝试过" :value="2" />
              </el-select>
            </div>
          </div>

          <div ref="scrollContainer" class="table-wrapper" @scroll="handleScroll">
            <el-table
              :data="problemList"
              stripe
              style="width: 100%"
              row-key="questionId"
              @row-click="goToDetail"
            >
              <el-table-column prop="title" label="题目" :min-width="isPhone ? 150 : 240">
                <template #default="{ row }">
                  <div class="problem-title" :data-question-id="row.questionId">
                    <span class="status-marker">
                      <el-icon v-if="row.status === 1" class="solved-check" title="已通过"><Check /></el-icon>
                    </span>
                    <span class="problem-id">{{ row.questionId }}</span>
                    <span class="problem-name">{{ row.title }}</span>
                    <el-tag
                      v-for="tag in getQuestionTags(row.tags)"
                      :key="tag"
                      size="small"
                      type="info"
                      effect="plain"
                      class="question-tag"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="difficulty" label="难度" width="100">
                <template #default="{ row }">
                  <el-tag :type="getDifficultyType(row.difficulty)" size="small">
                    {{ getDifficultyLabel(row.difficulty) }}
                  </el-tag>
                </template>
              </el-table-column>
              <!-- 手机档优先保证题目名可读，统计类列收起（表格本身可横向滚动） -->
              <el-table-column v-if="!isPhone" prop="passRate" label="通过率" width="110">
                <template #default="{ row }">
                  {{ formatRate(row.passRate) }}
                </template>
              </el-table-column>
              <el-table-column v-if="!isPhone" prop="totalAc" label="通过数" width="90">
                <template #default="{ row }">
                  {{ row.totalAc || 0 }}
                </template>
              </el-table-column>
            </el-table>

            <div v-if="loading" class="loading-more">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中...</span>
            </div>

            <div v-if="!hasMore && problemList.length > 0" class="no-more">
              已加载全部 {{ activeQuestionType === 'FUNCTION' ? problemList.length : (totalCount || problemList.length) }}
              道{{ activeQuestionType === 'FUNCTION' ? '核心函数题' : '标准题' }}
            </div>

            <div v-if="!loading && problemList.length === 0" class="empty-state">
              <el-empty description="暂无题目" />
            </div>
          </div>
        </section>
      </main>

      <aside class="right-panel">
        <section class="stats-card favorites-card">
          <div class="stats-header">
            <span class="stats-title">我的收藏</span>
            <el-button link size="small" class="view-all-btn" @click="openFavorites()">全部</el-button>
          </div>

          <div v-if="favoritesLoading" class="favorites-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载收藏夹...</span>
          </div>

          <div v-else-if="homeFavorites.length === 0" class="favorites-empty">
            暂无收藏夹
          </div>

          <div v-else class="favorites-list">
            <button
              v-for="favorite in homeFavorites"
              :key="favorite.favoritesId"
              type="button"
              class="favorite-item"
              @click="openFavorites(favorite.favoritesId)"
            >
              <span class="favorite-dot"></span>
              <span class="favorite-main">
                <span class="favorite-name">{{ favorite.favoritesName || '未命名收藏夹' }}</span>
                <span class="favorite-desc">{{ getFavoriteDescription(favorite) }}</span>
              </span>
              <span class="favorite-count">{{ favorite.questionIds?.length || 0 }}</span>
            </button>
          </div>
        </section>

        <section class="stats-card">
          <div class="stats-header">
            <span class="stats-title">每日进度</span>
            <span class="stats-month">{{ currentMonth }}</span>
          </div>
          <div class="weekday-header">
            <span v-for="day in weekDays" :key="day" class="weekday">{{ day }}</span>
          </div>
          <div class="calendar-grid">
            <div
              v-for="(day, index) in calendarDays"
              :key="index"
              class="calendar-day"
              :class="{ 'has-submit': day.hasSubmit, today: day.isToday, empty: !day.date }"
              :title="day.date ? `${day.date}: ${day.count || 0} 次提交` : ''"
            >
              <span v-if="day.date">{{ day.day }}</span>
            </div>
          </div>
          <div class="stats-footer">
            <div class="stat-item">
              <span class="stat-label">本月提交</span>
              <span class="stat-value">{{ monthlySubmits }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">连续打卡</span>
              <span class="stat-value">{{ streakDays }} 天</span>
            </div>
          </div>
        </section>

        <section class="stats-card quick-stats">
          <div class="stat-row">
            <span class="stat-label">已通过</span>
            <span class="stat-value">{{ solvedCount }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">通过率</span>
            <span class="stat-value">{{ overallAcceptance }}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">排名</span>
            <span class="stat-value">#{{ rank }}</span>
          </div>
        </section>
      </aside>
    </div>

    <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Collection, Star, Clock, Filter, Plus, Loading, Download, Check, Setting } from '@element-plus/icons-vue'
import router from '@/router'
import questionApi from '@/api/questionApi'
import reviewApi from '@/api/reviewApi'
import userApi from '@/api/userApi'
import { useUserStore } from '@/stores/User'
import type { FavoriteCollection } from '@/types/FavoriteProblem'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import MobileNavToggle from '@/components/layout/MobileNavToggle.vue'
import MobileNavBackdrop from '@/components/layout/MobileNavBackdrop.vue'
import { useMobileNav } from '@/composables/useMobileNav'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { navigateTopLevel } from '@/utils/navigation'
import { logWarn } from '@/utils/logger'

defineOptions({ name: 'HomeView' })

interface Question {
  questionId: number
  title: string
  difficulty: number
  passRate: number
  totalSubmit: number
  totalAc: number
  status: number
  tags?: string
}

type QuestionType = 'ACM' | 'FUNCTION'

interface SubmitRecord {
  submitRecordId?: string | number
  submitTime?: string
  createTime?: string
}

interface CalendarDay {
  date: string | null
  day: number | null
  hasSubmit: boolean
  count: number
  isToday: boolean
}

const userStore = useUserStore()
// 手机档左栏（筛选 + 收藏 + 复习入口）转成抽屉，桌面端仍是静态侧栏
const nav = useMobileNav()
const { isPhone } = useBreakpoint()
const searchKeyword = ref('')
const difficultyFilter = ref<number[]>([1, 2, 3])
const statusFilter = ref<number | ''>('')
const storedQuestionType = localStorage.getItem('homeQuestionType')
const activeQuestionType = ref<QuestionType>(storedQuestionType === 'FUNCTION' ? 'FUNCTION' : 'ACM')
const questionTypeOptions = [
  { label: '标准输入输出', value: 'ACM' },
  { label: '核心函数', value: 'FUNCTION' },
]
const problemList = ref<Question[]>([])
const lastId = ref<number | null>(null)
const hasMore = ref(true)
const loading = ref(false)
const totalCount = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const homeFavorites = ref<FavoriteCollection[]>([])
const favoritesLoading = ref(false)
const calendarDays = ref<CalendarDay[]>([])
const submitRecords = ref<SubmitRecord[]>([])
const profileAvatar = ref(localStorage.getItem('avatarUrl') || '')
const profileName = ref(localStorage.getItem('userName') || 'CW')
const rank = ref(12345)
let searchTimer: ReturnType<typeof window.setTimeout> | undefined

const currentMonth = computed(() => {
  const today = new Date()
  return `${today.getFullYear()}年${today.getMonth() + 1}月`
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const solvedCount = computed(() => {
  return problemList.value.filter((item) => item.status === 1).length
})

const overallAcceptance = computed(() => {
  if (problemList.value.length === 0) return 0
  const total = problemList.value.reduce((sum, item) => sum + normalizeRate(item.passRate), 0)
  return Math.round((total / problemList.value.length) * 100)
})

const monthlySubmits = computed(() => {
  return calendarDays.value.filter((day) => day.hasSubmit).reduce((sum, day) => sum + day.count, 0)
})

const streakDays = computed(() => {
  let streak = 0
  const today = new Date()

  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const day = calendarDays.value.find((item) => item.date === toDateKey(date))
    if (day?.hasSubmit) {
      streak++
      continue
    }
    if (i > 0) break
  }

  return streak
})

const unwrapData = <T,>(res: any, fallback: T): T => {
  return (res?.data ?? res ?? fallback) as T
}

const normalizeQuestion = (raw: any): Question => ({
  questionId: Number(raw.questionId ?? raw.question_id),
  title: raw.title ?? raw.questionTitle ?? raw.question_title ?? '未命名题目',
  difficulty: Number(raw.difficulty ?? 1),
  passRate: Number(raw.passRate ?? raw.pass_rate ?? 0),
  totalSubmit: Number(raw.totalSubmit ?? raw.total_submit ?? 0),
  totalAc: Number(raw.totalAc ?? raw.total_ac ?? 0),
  status: Number(raw.status ?? 0),
  tags: raw.tags,
})

const mapFavorite = (item: any): FavoriteCollection => {
  const questionIds = item.questionIds ?? item.question_ids

  return {
    ...item,
    favoritesId: String(item.favoritesId ?? item.favorites_id),
    favoritesName: item.favoritesName ?? item.favorites_name ?? '未命名收藏夹',
    favoritesType: item.favoritesType ?? item.favorites_type,
    favoritesContent: item.favoritesContent ?? item.favorites_content,
    userId: item.userId !== undefined && item.userId !== null ? String(item.userId) : undefined,
    questionIds: Array.isArray(questionIds)
      ? questionIds.map((id: any) => Number(id)).filter(Number.isFinite)
      : [],
    createTime: item.createTime ?? item.create_time,
    updateTime: item.updateTime ?? item.update_time,
  }
}

const normalizeRate = (rate: number) => {
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return rate > 1 ? rate / 100 : rate
}

const formatRate = (rate: number) => `${(normalizeRate(rate) * 100).toFixed(1)}%`

const getDifficultyType = (difficulty: number) => {
  const map = { 1: 'success', 2: 'warning', 3: 'danger' } as const
  return map[difficulty as 1 | 2 | 3] || 'info'
}

const getDifficultyLabel = (difficulty: number) => {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[difficulty] || '未知'
}

const getQuestionTags = (tags?: string) => {
  if (!tags) return []
  try {
    const parsed = JSON.parse(tags)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).slice(0, 2)
  } catch {
    // 普通逗号分隔标签直接向下处理。
  }
  return tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 2)
}

const getFavoriteDescription = (favorite: FavoriteCollection) => {
  return favorite.favoritesContent || favorite.favoritesType || '收藏题单'
}

const isUnauthorizedError = (error: unknown) => (error as any)?.response?.status === 401

const buildQuestionParams = (isRefresh: boolean) => {
  const params: Record<string, any> = { pageSize: 20 }

  if (!isRefresh && lastId.value !== null) {
    params.lastId = lastId.value
  }
  if (difficultyFilter.value.length > 0 && difficultyFilter.value.length < 3) {
    params.difficulty = difficultyFilter.value.join(',')
  }
  if (statusFilter.value !== '') {
    params.status = statusFilter.value
  }
  if (searchKeyword.value.trim()) {
    params.title = searchKeyword.value.trim()
  }
  params.type = activeQuestionType.value

  return params
}

const handleQuestionTypeChange = () => {
  localStorage.setItem('homeQuestionType', activeQuestionType.value)
  lastId.value = null
  hasMore.value = true
  totalCount.value = 0
  problemList.value = []
  scrollContainer.value?.scrollTo({ top: 0 })
  loadQuestions(true)
}

const loadQuestionTotal = async () => {
  try {
    const res: any = await questionApi.getTotal()
    totalCount.value = Number(unwrapData<number>(res, 0))
  } catch (error) {
    if (!isUnauthorizedError(error)) logWarn('加载题目总数失败:', error)
  }
}

const loadQuestions = async (isRefresh = false) => {
  if (loading.value) return
  if (!isRefresh && !hasMore.value) return

  const savedScrollTop = !isRefresh && scrollContainer.value ? scrollContainer.value.scrollTop : 0
  loading.value = true

  try {
    const res: any = await questionApi.cursorquestions(buildQuestionParams(isRefresh))
    const data = unwrapData<any>(res, {})
    const records = Array.isArray(data.records) ? data.records.map(normalizeQuestion) : []

    if (isRefresh) {
      problemList.value = records
      if (scrollContainer.value) scrollContainer.value.scrollTop = 0
    } else {
      problemList.value = [...problemList.value, ...records]
      if (scrollContainer.value && savedScrollTop > 0) {
        requestAnimationFrame(() => {
          if (scrollContainer.value) scrollContainer.value.scrollTop = savedScrollTop
        })
      }
    }

    lastId.value = data.nextCursor ?? null
    hasMore.value = Boolean(data.hasNext)
    if (data.total !== undefined && !totalCount.value) {
      totalCount.value = Number(data.total)
    }
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      logWarn('加载题目失败:', error)
    }
  } finally {
    loading.value = false
  }
}

const refreshQuestions = () => {
  lastId.value = null
  hasMore.value = true
  problemList.value = []
  loadQuestions(true)
}

const handleSearch = () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(refreshQuestions, 220)
}

const handleFilterChange = () => refreshQuestions()

const loadHomeFavorites = async () => {
  favoritesLoading.value = true
  try {
    const res: any = await reviewApi.listFavorites()
    const list = unwrapData<any[]>(res, [])
    homeFavorites.value = Array.isArray(list) ? list.map(mapFavorite) : []
  } catch (error) {
    if (!isUnauthorizedError(error)) logWarn('加载首页收藏夹失败:', error)
    homeFavorites.value = []
  } finally {
    favoritesLoading.value = false
  }
}

const loadUserProfile = async () => {
  const userId = localStorage.getItem('userId')
  if (!userId) return

  try {
    const res: any = await userApi.getUserById(userId)
    const user = unwrapData<any>(res, null)
    if (!user) return

    const normalizedUser = {
      ...user,
      userId: user.userId !== undefined && user.userId !== null ? String(user.userId) : undefined,
    }
    userStore.updateUser(normalizedUser)
    profileAvatar.value = normalizedUser.avatarUrl || ''
    profileName.value = normalizedUser.nickName || normalizedUser.userName || localStorage.getItem('userName') || 'CW'
  } catch (error) {
    logWarn('加载用户资料失败:', error)
  }
}

const loadSubmitStats = async () => {
  try {
    const res: any = await questionApi.getUserSubmitRecords({ pageSize: 30 })
    const payload = unwrapData<any>(res, {})
    submitRecords.value = Array.isArray(payload.records) ? payload.records : []
  } catch (error) {
    if (!isUnauthorizedError(error)) logWarn('加载提交统计失败:', error)
    submitRecords.value = []
  } finally {
    generateCalendar()
  }
}

const toDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getRecordDateKey = (record: SubmitRecord) => {
  const rawDate = record.submitTime || record.createTime
  if (!rawDate) return ''

  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return String(rawDate).slice(0, 10)
  return toDateKey(date)
}

const generateCalendar = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const counts = new Map<string, number>()

  submitRecords.value.forEach((record) => {
    const dateKey = getRecordDateKey(record)
    if (!dateKey) return
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1)
  })

  const days: CalendarDay[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push({ date: null, day: null, hasSubmit: false, count: 0, isToday: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateKey = toDateKey(date)
    const count = counts.get(dateKey) || 0
    days.push({
      date: dateKey,
      day,
      hasSubmit: count > 0,
      count,
      isToday: dateKey === toDateKey(today),
    })
  }

  calendarDays.value = days
}

const restoreScrollPosition = () => {
  const scrollTop = localStorage.getItem('returnScrollTop')
  const lastIdStr = localStorage.getItem('returnLastId')
  const questionId = localStorage.getItem('returnQuestionId')

  if (!scrollTop) return

  localStorage.removeItem('returnScrollTop')
  localStorage.removeItem('returnLastId')
  localStorage.removeItem('returnQuestionId')

  const targetLastId = Number(lastIdStr)
  const currentLastId = Number(lastId.value ?? 0)

  if (lastIdStr && Number.isFinite(targetLastId) && targetLastId > currentLastId) {
    const loadUntilTarget = () => {
      if (hasMore.value && Number(lastId.value ?? 0) < targetLastId) {
        loadQuestions(false)
        window.setTimeout(loadUntilTarget, 120)
      } else {
        window.setTimeout(() => scrollToPosition(Number(scrollTop), questionId), 50)
      }
    }
    loadUntilTarget()
    return
  }

  window.setTimeout(() => scrollToPosition(Number(scrollTop), questionId), 50)
}

const scrollToPosition = (scrollTop: number, questionId: string | null) => {
  scrollContainer.value?.scrollTo({ top: scrollTop, behavior: 'auto' })

  if (!questionId) return
  const targetEl = document.querySelector(`[data-question-id="${questionId}"]`)
  if (!targetEl) return

  targetEl.scrollIntoView({ block: 'center', behavior: 'auto' })
}

const handleScroll = () => {
  const container = scrollContainer.value
  if (!container) return

  const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100
  if (isNearBottom && !loading.value && hasMore.value) {
    loadQuestions(false)
  }
}

const goToDetail = (row: Question) => {
  const scrollTop = scrollContainer.value ? scrollContainer.value.scrollTop : 0

  localStorage.setItem('returnScrollTop', String(scrollTop))
  localStorage.setItem('returnLastId', String(lastId.value ?? ''))
  localStorage.setItem('returnQuestionId', String(row.questionId))

  router.push({
    path: '/questiondetailview',
    query: { questionId: row.questionId },
  })
}

const openFavorites = (favoriteId?: string) => {
  navigateTopLevel(router, {
    path: '/favorites',
    query: favoriteId ? { favoriteId } : undefined,
  })
}

const goReview = () => navigateTopLevel(router, '/review')
const goLeetCodeImport = () => router.push('/admin/questions/import/leetcode')

onMounted(async () => {
  await Promise.all([loadQuestionTotal(), loadQuestions(true), loadHomeFavorites(), loadUserProfile(), loadSubmitStats()])
  window.setTimeout(restoreScrollPosition, 30)
})

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.leetcode-clone {
  height: 100vh; height: 100dvh;
  /* dvh 让移动端浏览器地址栏收放时不再把底部内容顶出视口；不支持的浏览器沿用 100vh */
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
  overflow: hidden;
}

.navbar {
  height: 58px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--cw-border);
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
.menu-item {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cw-text-1);
  font-size: 18px;
  font-weight: 700;
}

.logo-icon,
.nav-item.active {
  color: var(--cw-brand);
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
  color: var(--cw-text-2);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover,
.nav-item.active {
  background: var(--cw-brand-soft);
  color: var(--cw-brand);
}

.search-input {
  width: 220px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: var(--cw-bg-page);
}

.avatar-entry {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.avatar-entry:hover {
  border-color: var(--cw-brand);
  box-shadow: 0 6px 14px rgba(255, 161, 22, 0.18);
  transform: translateY(-1px);
}

.main-container {
  width: min(1520px, calc(100% - 72px));
  margin: 0 auto;
  padding: 30px 0 36px;
  flex: 1;
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr) 320px;
  gap: 24px;
  overflow: hidden;
}

.left-panel,
.right-panel,
.home-overview,
.question-panel {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.left-panel {
  padding: 24px 18px;
  overflow-y: auto;
}

.sidebar-section {
  margin-bottom: 24px;
}

.section-title {
  margin-bottom: 10px;
  padding-left: 4px;
  color: var(--cw-text-3);
  font-size: 12px;
  font-weight: 600;
}

.menu-item {
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  color: var(--cw-text-2);
  font-size: 14px;
  text-align: left;
  transition: background 0.18s ease, color 0.18s ease;
}

.menu-item:hover,
.menu-item.active {
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
}

.menu-item.active {
  font-weight: 700;
}

.menu-item .badge {
  margin-left: auto;
  padding: 0 8px;
  border-radius: 12px;
  background: #f2f4f7;
  color: var(--cw-text-3);
  font-size: 11px;
}

.favorite-menu-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-empty {
  padding: 8px 12px;
  color: var(--cw-text-3);
  font-size: 13px;
}

.dot,
.favorite-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cw-brand);
  flex-shrink: 0;
}

.create-btn {
  border: 1px dashed var(--cw-brand);
  color: var(--cw-brand);
  font-weight: 500;
}

.difficulty-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 4px;
}

.difficulty-group :deep(.el-checkbox) {
  height: 30px;
}

.difficulty-group :deep(.el-checkbox__label) {
  font-size: 13px;
}

.center-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  overflow: hidden;
}

.home-overview {
  min-height: 176px;
  padding: 34px 40px;
  display: flex;
  align-items: center;
}

.overview-copy {
  max-width: 720px;
}

.eyebrow {
  min-height: 26px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  font-size: 13px;
  font-weight: 600;
}

.overview-copy h1 {
  margin: 16px 0 10px;
  color: var(--cw-text-1);
  font-size: 30px;
  line-height: 1.22;
}

.overview-copy p {
  max-width: 680px;
  margin: 0;
  color: #666f7a;
  font-size: 14px;
  line-height: 1.75;
}

.question-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  min-height: 72px;
  padding: 16px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid var(--cw-bg-subtle);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-left h2 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.question-type-switch {
  --el-segmented-item-selected-bg-color: #ffffff;
  --el-segmented-item-selected-color: var(--cw-brand-dark);
  padding: 3px;
  border: 1px solid var(--cw-bg-subtle);
  background: var(--cw-bg-page);
}

.question-type-switch :deep(.el-segmented__item) {
  min-height: 28px;
  padding: 0 11px;
  font-size: 12px;
}

.total-count {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--cw-bg-page);
  color: var(--cw-text-3);
  font-size: 13px;
}

.filter-select {
  width: 130px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.import-button {
  color: var(--cw-brand-dark);
  border-color: var(--cw-brand-border);
  background: var(--cw-brand-soft);
}

.import-button:hover,
.import-button:focus {
  color: var(--cw-brand-dark);
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.table-wrapper {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 14px;
}

.table-wrapper::-webkit-scrollbar,
.left-panel::-webkit-scrollbar,
.right-panel::-webkit-scrollbar {
  width: 6px;
}

.table-wrapper::-webkit-scrollbar-thumb,
.left-panel::-webkit-scrollbar-thumb,
.right-panel::-webkit-scrollbar-thumb {
  background: var(--cw-border);
  border-radius: 4px;
}

.problem-title {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.status-marker {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.solved-check {
  color: var(--cw-success);
  font-size: 15px;
  font-weight: 700;
}

.problem-id {
  min-width: 42px;
  color: #98a1ad;
  font-size: 13px;
}

.problem-name {
  color: var(--cw-text-1);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-tag {
  flex: 0 0 auto;
  --el-tag-bg-color: var(--cw-bg-page);
  --el-tag-border-color: #e8ebef;
  --el-tag-text-color: #777f89;
}

.loading-more,
.favorites-loading,
.favorites-empty {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--cw-text-3);
  font-size: 13px;
}

.no-more {
  padding: 20px 0;
  color: var(--cw-text-3);
  font-size: 13px;
  text-align: center;
}

.empty-state {
  padding: 40px 0;
}

.right-panel {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden auto;
}

.stats-card {
  padding: 16px 18px;
  background: #ffffff;
  border-bottom: 1px solid var(--cw-border);
}

.stats-card:last-child {
  border-bottom: 0;
}

.stats-header {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats-title {
  color: var(--cw-text-1);
  font-size: 14px;
  font-weight: 600;
}

.stats-month,
.favorite-desc {
  color: var(--cw-text-3);
  font-size: 12px;
}

.view-all-btn {
  height: auto;
  padding: 0;
  color: var(--cw-brand);
  font-size: 12px;
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorite-item {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--cw-bg-subtle);
  border-radius: 8px;
  background: var(--cw-bg-page);
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.favorite-item:hover {
  background: var(--cw-brand-soft);
  border-color: #ffe1b8;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.favorite-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.favorite-name,
.favorite-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-name {
  color: var(--cw-text-1);
  font-size: 13px;
  font-weight: 600;
}

.favorite-count {
  min-width: 26px;
  height: 22px;
  border-radius: 999px;
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.weekday-header,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.weekday-header {
  margin-bottom: 2px;
}

.weekday {
  padding: 2px 0;
  color: var(--cw-text-3);
  font-size: 10px;
  text-align: center;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: var(--cw-text-2);
  font-size: 11px;
}

.calendar-day.empty {
  visibility: hidden;
}

.calendar-day.has-submit {
  background: var(--cw-brand-soft);
  color: var(--cw-brand);
  font-weight: 600;
}

.calendar-day.today {
  border: 2px solid var(--cw-brand);
  font-weight: 700;
}

.stats-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--cw-border);
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--cw-text-3);
  font-size: 10px;
}

.stat-value {
  display: block;
  color: var(--cw-text-1);
  font-size: 15px;
  font-weight: 600;
}

.quick-stats .stat-row {
  padding: 10px 0;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--cw-border);
}

.quick-stats .stat-row:last-child {
  border-bottom: 0;
}

.quick-stats .stat-label {
  color: var(--cw-text-2);
  font-size: 13px;
}

.quick-stats .stat-value {
  color: var(--cw-text-1);
  font-size: 14px;
}

:deep(.el-table) {
  --el-table-border-color: var(--cw-bg-subtle);
  --el-table-header-bg-color: #f8f9fa;
  font-size: 14px;
}

:deep(.el-table .cell) {
  padding: 8px 10px;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f8f9fa;
  color: #5f6872;
  font-weight: 600;
}

:deep(.el-table td.el-table__cell) {
  padding: 14px 0;
}

:deep(.el-table tbody tr) {
  transition: transform 0.18s ease;
}

:deep(.el-table tbody tr:hover) {
  cursor: pointer;
  transform: translateY(-1px);
}

:deep(.el-table tbody tr:hover td.el-table__cell) {
  background: var(--cw-brand-soft) !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05);
}

:deep(.el-table tbody tr:hover .problem-name) {
  color: var(--cw-brand);
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background-color: var(--cw-bg-page);
}

@media (max-width: 1280px) {
  .main-container {
    width: min(1180px, calc(100% - 42px));
    grid-template-columns: 272px minmax(0, 1fr);
  }

  .right-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  /* 左栏（筛选/收藏/复习入口）不再是"窄屏隐藏"，而是转成 .cw-offcanvas 抽屉，
   * 由 .content-header 里的汉堡按钮开合，所以这里不再声明 display: none。 */
  .main-container {
    width: calc(100% - 28px);
    padding-top: 16px;
    grid-template-columns: 1fr;
  }

  .search-input {
    width: 140px;
  }

  .home-overview {
    min-height: auto;
    padding: 22px 18px;
  }

  .overview-copy h1 {
    font-size: 24px;
  }

  .content-header {
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }

  .header-left {
    width: 100%;
    flex-wrap: wrap;
  }

  .question-type-switch {
    max-width: 100%;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
