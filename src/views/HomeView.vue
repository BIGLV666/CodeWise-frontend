<template>
  <div class="leetcode-clone">
    <!-- 顶部导航栏 -->
    <header class="navbar">
      <div class="navbar-left">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <span class="logo-text">CodeWise</span>
        </div>
        <nav class="nav-menu">
          <a href="#" class="nav-item active">题库</a>
          <a href="#" class="nav-item">竞赛</a>
          <a href="#" class="nav-item">讨论</a>
          <button type="button" class="nav-item nav-button" @click="goReview">复习</button>
        </nav>
      </div>
      <div class="navbar-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索题目..."
          size="small"
          :prefix-icon="Search"
          class="search-input"
          @input="handleSearch"
        />
        <el-badge :value="3" class="badge-item">
          <el-button :icon="Bell" circle size="small" />
        </el-badge>
        <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
      </div>
    </header>

    <!-- 主体内容 -->
    <div class="main-container">
      <!-- 左侧导航 -->
      <div class="left-panel">
        <div class="sidebar-section">
          <div class="section-title">学习</div>
          <div class="menu-item active">
            <el-icon><Collection /></el-icon>
            <span>全部题目</span>
            <span class="badge">{{ totalCount }}/4365</span>
          </div>
          <div class="menu-item" @click="openFavorites()">
            <el-icon><Star /></el-icon>
            <span>我的收藏</span>
          </div>
          <div class="menu-item" @click="goReview">
            <el-icon><Clock /></el-icon>
            <span>复习</span>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">我的收藏</div>
          <div
            v-for="favorite in homeFavorites"
            :key="favorite.favoritesId"
            class="menu-item"
            @click="openFavorites(favorite.favoritesId)"
          >
            <span class="dot orange"></span>
            <span class="favorite-menu-name">{{ favorite.favoritesName || '未命名收藏夹' }}</span>
            <span class="badge">{{ favorite.questionIds?.length || 0 }}</span>
          </div>
          <div v-if="!favoritesLoading && homeFavorites.length === 0" class="menu-empty">
            暂无收藏
          </div>
          <div class="menu-item create-btn" @click="openFavorites()">
            <el-icon><Plus /></el-icon>
            <span>创建新收藏</span>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">难度筛选</div>
          <el-checkbox-group v-model="difficultyFilter" class="difficulty-group" @change="handleFilterChange">
            <el-checkbox :value="1">简单</el-checkbox>
            <el-checkbox :value="2">中等</el-checkbox>
            <el-checkbox :value="3">困难</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <div class="divider"></div>

      <!-- 中间题目列表 -->
      <div class="center-panel">
        <section class="home-overview">
          <div class="overview-copy">
            <span class="eyebrow">题库训练 · {{ currentMonth }}</span>
            <h1>今天从一道合适的题开始</h1>
            <p>按难度、状态和关键词筛选题目；收藏常练题单，或进入复习页按计划巩固薄弱点。</p>
          </div>
        </section>

        <div class="content-header">
          <div class="header-left">
            <h2>题目列表</h2>
            <span class="total-count">共 {{ totalCount }} 题</span>
          </div>
          <div class="header-right">
            <el-select 
              v-model="statusFilter" 
              size="small" 
              placeholder="状态" 
              class="filter-select" 
          
              @change="handleFilterChange"
              clearable
            >
              <el-option label="全部" :value="0" />
              <el-option label="已解答" :value="1" />
              <el-option label="未尝试" :value="2" />
            </el-select>
          </div>
        </div>

        <!-- 题目列表容器 -->
        <div 
          ref="scrollContainer" 
          class="table-wrapper"
          @scroll="handleScroll"
        >
          <el-table 
    :data="displayList" 
    stripe 
    style="width: 100%"  
    row-key="questionId" 
    @row-click="goToDetail"
  >
            <el-table-column prop="title" label="题目" min-width="200">
              <template #default="{ row }">
                <div class="problem-title" :data-question-id="row.questionId">
                  <span class="problem-id">{{ row.questionId }}</span>
                  <span class="problem-name">{{ row.title }}</span>
                  <span v-if="row.status === 1" class="solved-tag">已解答</span>
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
            <el-table-column prop="passRate" label="通过率" width="100">
              <template #default="{ row }">
                {{ row.passRate ? (row.passRate * 100).toFixed(1) : 0 }}%
              </template>
            </el-table-column>
            <el-table-column prop="totalAc" label="通过数" width="80">
              <template #default="{ row }">
                {{ row.totalAc || 0 }}
              </template>
            </el-table-column>
          </el-table>

          <!-- 加载状态 -->
          <div v-if="loading" class="loading-more">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          
          <!-- 没有更多数据 -->
          <div v-if="!hasMore && displayList.length > 0" class="no-more">
            — 已加载全部 {{ totalCount }} 道题目 —
          </div>
          
          <!-- 空状态 -->
          <div v-if="!loading && displayList.length === 0" class="empty-state">
            <el-empty description="暂无题目" />
          </div>
        </div>

       
      </div>

      <div class="divider"></div>

      <!-- 右侧统计 -->
      <div class="right-panel">
        <div class="stats-card favorites-card">
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
        </div>

        <div class="stats-card">
          <div class="stats-header">
            <span class="stats-title">📊 每日进度</span>
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
              :class="{
                'has-submit': day.hasSubmit,
                'today': day.isToday,
                'empty': !day.date
              }"
              :title="day.date ? `${day.date}: ${day.count || 0} 题` : ''"
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
        </div>

        <div class="stats-card quick-stats">
          <div class="stat-row">
            <span class="stat-label">已解答</span>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Bell, Collection, Star, Clock, Plus, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import questionApi from '@/api/questionApi'
import reviewApi from '@/api/reviewApi'
import router from '@/router'
import type { FavoriteCollection } from '@/types/FavoriteProblem'

// ===== 类型定义 =====
interface Question {
  questionId: number
  title: string
  description: string
  difficulty: number
  passRate: number
  totalSubmit: number
  totalAc: number
  status: number
  tags: string
  createTime: string
}

interface CursorPageResult {
  records: Question[]
  nextCursor: number | null
  hasNext: boolean
  total: number
}

interface CalendarDay {
  date: string | null
  day: number | null
  hasSubmit: boolean
  count: number
  isToday: boolean
}

// ===== 状态 =====
const searchKeyword = ref('')
const difficultyFilter = ref<number[]>([1, 2, 3])
const statusFilter = ref<number>(0)
const problemList = ref<Question[]>([])
const lastId = ref<number | null>(null)
const hasMore = ref(true)
const loading = ref(false)
const totalCount = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const homeFavorites = ref<FavoriteCollection[]>([])
const favoritesLoading = ref(false)

// 记录加载前的滚动位置
let scrollHeightBeforeLoad = 0
let scrollTopBeforeLoad = 0

// ===== 模拟数据 =====
const mockQuestions = ref<Question[]>([])

const generateMockData = () => {
  const titles = [
    '两数之和', '两数相加', '无重复字符的最长子串', '寻找两个正序数组的中位数',
    '最长回文子串', 'Z字形变换', '整数反转', '字符串转换整数',
    '回文数', '正则表达式匹配', '盛最多水的容器', '三数之和'
  ]
  const diffs = [1, 1, 2, 2, 3, 1, 2, 3, 1, 3, 2, 2]
  
  const list: Question[] = []
  for (let i = 1; i <= 100; i++) {
    const idx = (i - 1) % titles.length
    list.push({
      questionId: i,
      title: titles[idx] || `题目 ${i}`,
      description: `这是题目 ${i} 的描述`,
      difficulty: diffs[idx % diffs.length] || 1,
      passRate: 0.3 + Math.random() * 0.5,
      totalSubmit: Math.floor(100 + Math.random() * 900),
      totalAc: Math.floor(30 + Math.random() * 300),
      status: Math.random() > 0.6 ? 1 : 0,
      tags: '数组,字符串',
      createTime: new Date().toISOString()
    })
  }
  return list
}

// ===== 显示列表 =====
const displayList = computed(() => {
  return problemList.value.length > 0 ? problemList.value : mockQuestions.value
})

// ===== 日历状态 =====
const currentMonth = ref('2026年7月')
const calendarDays = ref<CalendarDay[]>([])
const rank = ref(12345)
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// ===== 计算属性 =====
const solvedCount = computed(() => {
  return displayList.value.filter(p => p.status === 1).length
})

const overallAcceptance = computed(() => {
  if (displayList.value.length === 0) return 0
  const total = displayList.value.reduce((sum, p) => sum + (p.passRate || 0), 0)
  return Math.round((total / displayList.value.length) * 100)
})

const monthlySubmits = computed(() => {
  return calendarDays.value.filter(d => d.hasSubmit).reduce((sum, d) => sum + d.count, 0)
})

const streakDays = computed(() => {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toDateString()
    const day = calendarDays.value.find(d => {
      if (!d.date) return false
      return new Date(d.date).toDateString() === dateStr
    })
    if (day && day.hasSubmit) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
})

const getFavoriteDescription = (favorite: FavoriteCollection) => {
  return favorite.favoritesContent || favorite.favoritesType || '收藏题单'
}

const mapFavorite = (item: any): FavoriteCollection => {
  const favoritesId = item.favoritesId ?? item.favorites_id
  const questionIds = item.questionIds ?? item.question_ids
  const normalizedQuestionIds = Array.isArray(questionIds)
    ? questionIds.map((id: any) => Number(id)).filter(Number.isFinite)
    : []

  return {
    ...item,
    favoritesId: String(favoritesId),
    favoritesName: item.favoritesName ?? item.favorites_name ?? '未命名收藏夹',
    favoritesType: item.favoritesType ?? item.favorites_type,
    favoritesContent: item.favoritesContent ?? item.favorites_content,
    userId: item.userId !== undefined && item.userId !== null ? String(item.userId) : undefined,
    questionIds: normalizedQuestionIds,
    createTime: item.createTime ?? item.create_time,
    updateTime: item.updateTime ?? item.update_time,
  }
}

// ===== 方法 =====
const getDifficultyType = (difficulty: number) => {
  const map: Record<number, string> = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[difficulty] || ''
}

const getDifficultyLabel = (difficulty: number) => {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[difficulty] || '未知'
}
// ===== 加载题目数据（游标分页） =====
const loadQuestions = async (isRefresh = false) => {
  if (loading.value) return
  if (!isRefresh && !hasMore.value) return

  // 保存当前滚动位置（追加数据时）
  let savedScrollTop = 0
  if (!isRefresh && scrollContainer.value) {
    savedScrollTop = scrollContainer.value.scrollTop
    console.log('📌 保存滚动位置:', savedScrollTop)
  }

  loading.value = true

  try {
    const params: any = {
      pageSize: 20,
    }

    if (!isRefresh && lastId.value !== null) {
      params.lastId = lastId.value
    }

    // 难度筛选
    if (difficultyFilter.value.length > 0 && difficultyFilter.value.length < 3) {
      params.difficulty = difficultyFilter.value.join(',')
    }

    // 状态筛选
    if (statusFilter.value === 1) {
      params.status = 1
    } else if (statusFilter.value === 2) {
      params.status = 0
    }

    // 搜索关键词
    if (searchKeyword.value) {
      params.title = searchKeyword.value
    }

    console.log('📤 请求参数:', params)
    const res: any = await questionApi.cursorquestions(params)
    console.log('📥 加载题目响应:', res)

    if (res.code === 200) {
      const data = res.data

      if (isRefresh) {
        // 刷新：替换数据
        problemList.value = data.records
        // 刷新时滚动到顶部
        if (scrollContainer.value) {
          scrollContainer.value.scrollTop = 0
        }
      } else {
        // 追加数据
        problemList.value = [...problemList.value, ...data.records]

        // ✅ 立即恢复滚动位置（使用 requestAnimationFrame 更快）
        if (scrollContainer.value && savedScrollTop > 0) {
          requestAnimationFrame(() => {
            if (scrollContainer.value) {
              scrollContainer.value.scrollTop = savedScrollTop
              console.log('📌 恢复滚动位置:', savedScrollTop)
            }
          })
        }
      }

      // 更新游标信息
      lastId.value = data.nextCursor
      hasMore.value = data.hasNext
      totalCount.value = data.total || problemList.value.length

      console.log('✅ 加载完成:', {
        recordsCount: data.records.length,
        totalList: problemList.value.length,
        lastId: lastId.value,
        hasMore: hasMore.value
      })
    } else {
      ElMessage.error(res.message || '加载失败')
    }
  } catch (error) {
    console.error('❌ 加载题目失败:', error)
    ElMessage.error('加载题目失败')
  } finally {
    loading.value = false
  }

}
//===== 搜索 =====
const handleSearch = () => {
  console.log('🔍 搜索:', searchKeyword.value)
  lastId.value = null
  hasMore.value = true
  problemList.value = []
  loadQuestions(true)
}

// ===== 筛选变化 =====
const handleFilterChange = () => {
  console.log('🎯 筛选变化:', difficultyFilter.value, statusFilter.value)
  lastId.value = null
  hasMore.value = true
  problemList.value = []
  loadQuestions(true)
}

const loadHomeFavorites = async () => {
  favoritesLoading.value = true
  try {
    const res: any = await reviewApi.listFavorites()
    homeFavorites.value = (res.data || []).map(mapFavorite)
  } catch (error) {
    console.error('加载首页收藏夹失败:', error)
    homeFavorites.value = []
  } finally {
    favoritesLoading.value = false
  }
}

const openFavorites = (favoriteId?: string) => {
  router.push({
    path: '/favorites',
    query: favoriteId ? { favoriteId } : undefined,
  })
}

const goReview = () => {
  router.push('/review')
}

// ===== 跳转时保存 =====
const goToDetail = (row: Question) => {
  const container = document.querySelector('.table-wrapper')
  const scrollTop = container ? container.scrollTop : 0

  localStorage.setItem('returnScrollTop', String(scrollTop))
  localStorage.setItem('returnLastId', String(lastId.value))
  localStorage.setItem('returnQuestionId', String(row.questionId))

  router.push({
    path: '/questiondetailview',
    query: { questionId: row.questionId }
  })
}
// ===== 生成日历数据 =====
const generateCalendar = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  currentMonth.value = `${year}年${month + 1}月`
  
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const days: CalendarDay[] = []
  
  for (let i = 0; i < firstDay; i++) {
    days.push({ date: null, day: null, hasSubmit: false, count: 0, isToday: false })
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    const isToday = date.toDateString() === today.toDateString()
    const hasSubmit = Math.random() > 0.3
    days.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      day: i,
      hasSubmit,
      count: hasSubmit ? Math.floor(Math.random() * 3) + 1 : 0,
      isToday
    })
  }
  
  calendarDays.value = days
}
// ===== 恢复滚动位置（平滑滚动） =====
const restoreScrollPosition = () => {
  const scrollTop = localStorage.getItem('returnScrollTop')
  const lastIdStr = localStorage.getItem('returnLastId')
  const questionId = localStorage.getItem('returnQuestionId')

  console.log('📌 restoreScrollPosition 执行:', { scrollTop, lastIdStr, questionId })

  if (!scrollTop) {
    console.log('⚠️ 没有保存的滚动位置')
    return
  }

  localStorage.removeItem('returnScrollTop')
  localStorage.removeItem('returnLastId')
  localStorage.removeItem('returnQuestionId')

  // 如果保存的 lastId 更大，先加载数据
  if (lastIdStr && parseInt(lastIdStr) > (lastId.value ?? 0)) {
    console.log('📌 需要加载更多数据，目标 lastId:', lastIdStr)

    const loadUntilTarget = () => {
      if (hasMore.value && (lastId.value ?? 0) < parseInt(lastIdStr)) {
        loadQuestions(false)
        // ✅ 减少延迟到 100ms
        setTimeout(loadUntilTarget, 100)
      } else {
        // ✅ 加载完成，立即滚动（50ms 延迟等 DOM 渲染）
        setTimeout(() => {
          scrollToPosition(parseInt(scrollTop), questionId)
        }, 50)
      }
    }

    loadUntilTarget()
  } else {
    // ✅ 直接滚动（50ms 延迟等 DOM 渲染）
    setTimeout(() => {
      scrollToPosition(parseInt(scrollTop), questionId)
    }, 50)
  }
}

// ===== 执行滚动 =====
const scrollToPosition = (scrollTop: number, questionId: string | null) => {
  const container = document.querySelector('.table-wrapper')
  
  if (container) {
    container.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    })
    console.log('✅ 已滚动到:', scrollTop)
  }

  // 高亮题目
  if (questionId) {
    const targetEl = document.querySelector(`[data-question-id="${questionId}"]`)
    if (targetEl) {
      targetEl.scrollIntoView({ 
        block: 'center', 
        behavior: 'smooth'
      })
      targetEl.classList.add('highlight-item')
      setTimeout(() => {
        targetEl.classList.remove('highlight-item')
      }, 3000)
    }
  }
}
// ===== 滚动加载更多 =====
const handleScroll = () => {
  const container = scrollContainer.value
  if (!container) return

  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight

  // 距离底部 100px 时触发加载
  const threshold = 100
  const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold

  // ✅ 只在用户手动滚动到底部时触发加载，且不重复加载
  if (isNearBottom && !loading.value && hasMore.value) {
    console.log('🔄 触发加载更多!', {
      scrollTop,
      clientHeight,
      scrollHeight,
      currentListLength: problemList.value.length,
      lastId: lastId.value,
      hasMore: hasMore.value
    })
    // ✅ 传入 isRefresh = false
    loadQuestions(false)
  }
}
// HomeView.vue - 点击题目跳转时保存
const handleProblemClick = (row: Question) => {
  // 保存当前滚动位置
  const container = document.querySelector('.table-wrapper')
  const scrollTop = container ? container.scrollTop : 0
  
  const returnData = {
    questionId: row.questionId,
    scrollTop: scrollTop,
    timestamp: Date.now()
  }
  
  localStorage.setItem('homeReturnData', JSON.stringify(returnData))
  
  // 跳转到详情页
  router.push({
    path: '/questiondetailview',
    query: { questionId: row.questionId }
  })
}
// ===== 生命周期 =====
onMounted(() => {
  loadQuestions(true)
  loadHomeFavorites()
  generateCalendar()

  // ✅ 延迟减少到 300ms
  setTimeout(() => {
    restoreScrollPosition()
  }, 30)
})
</script>

<style scoped>
/* ===== 样式保持不变 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.leetcode-clone {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;
}

.navbar {
  background: #ffffff;
  border-bottom: 1px solid #e8ecf1;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  cursor: pointer;
}

.logo-icon {
  color: #ffa116;
  font-size: 22px;
}

.logo-text {
  background: linear-gradient(135deg, #ffa116, #ff6b35);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-menu {
  display: flex;
  gap: 4px;
}

.nav-item {
  padding: 6px 14px;
  color: #4a4a4a;
  text-decoration: none;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.nav-item:hover {
  background: #f0f2f5;
  color: #1a1a2e;
}

.nav-item.active {
  color: #ffa116;
  background: #fff8f0;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.search-input {
  width: 180px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: #f5f7fa;
}

.badge-item {
  cursor: pointer;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: #ffffff;
}

.left-panel {
  width: 220px;
  flex-shrink: 0;
  padding: 20px 16px 20px 24px;
  overflow-y: auto;
  background: #ffffff;
}

.left-panel::-webkit-scrollbar {
  width: 4px;
}
.left-panel::-webkit-scrollbar-thumb {
  background: #e8ecf1;
  border-radius: 4px;
}

.sidebar-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  padding-left: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #4a4a4a;
  font-size: 14px;
  position: relative;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item.active {
  background: #fff8f0;
  color: #ffa116;
  font-weight: 500;
}

.menu-item .badge {
  margin-left: auto;
  background: #e8ecf1;
  padding: 0 8px;
  border-radius: 12px;
  font-size: 11px;
  color: #8c8c8c;
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
  color: #b0b0b0;
  font-size: 13px;
}

.menu-item .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.blue { background: #4a90d9; }
.dot.green { background: #52c41a; }
.dot.orange { background: #faad14; }

.menu-item.create-btn {
  color: #ffa116;
  font-weight: 500;
  border: 1px dashed #ffa116;
  background: transparent;
}

.menu-item.create-btn:hover {
  background: #fff8f0;
}

.difficulty-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 4px;
}

.difficulty-group :deep(.el-checkbox) {
  height: 30px;
  display: flex;
  align-items: center;
}
.difficulty-group :deep(.el-checkbox__label) {
  font-size: 13px;
}

.divider {
  width: 1px;
  background: #e8ecf1;
  flex-shrink: 0;
}

.center-panel {
  flex: 1;
  padding: 20px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  min-width: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.total-count {
  color: #8c8c8c;
  font-size: 13px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.filter-select {
  width: 120px;
}
.filter-select :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  margin: 0 -8px;
  padding: 0 8px;
}

.table-wrapper::-webkit-scrollbar {
  width: 6px;
}
.table-wrapper::-webkit-scrollbar-thumb {
  background: #e8ecf1;
  border-radius: 4px;
}

.problem-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.problem-id {
  color: #8c8c8c;
  font-size: 13px;
  min-width: 30px;
}

.problem-name {
  color: #1a1a2e;
}

.solved-tag {
  font-size: 11px;
  color: #52c41a;
  background: #f0faf0;
  padding: 1px 8px;
  border-radius: 10px;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  gap: 10px;
  color: #8c8c8c;
  font-size: 14px;
}

.loading-more .el-icon {
  font-size: 20px;
}

.no-more {
  text-align: center;
  padding: 20px 0;
  color: #b0b0b0;
  font-size: 13px;
}

.empty-state {
  padding: 40px 0;
}

.cursor-info-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 4px 0 4px;
  border-top: 1px solid #f0f2f5;
  flex-shrink: 0;
  font-size: 12px;
  color: #8c8c8c;
}

.cursor-label {
  font-weight: 500;
  color: #4a4a4a;
}

.cursor-value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: #f5f7fa;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #4a4a4a;
}

.right-panel {
  width: 240px;
  flex-shrink: 0;
  padding: 20px 20px 20px 16px;
  overflow-y: auto;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.right-panel::-webkit-scrollbar {
  width: 4px;
}
.right-panel::-webkit-scrollbar-thumb {
  background: #e8ecf1;
  border-radius: 4px;
}

.stats-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 14px 16px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stats-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.view-all-btn {
  color: #ffa116;
  padding: 0;
  height: auto;
  font-size: 12px;
}

.favorites-card {
  background: #ffffff;
  border: 1px solid #e8ecf1;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.favorites-loading,
.favorites-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 72px;
  color: #8c8c8c;
  font-size: 13px;
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorite-item {
  width: 100%;
  border: 1px solid transparent;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.favorite-item:hover {
  background: #ffffff;
  border-color: #ffe1b8;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.favorite-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffa116;
  flex-shrink: 0;
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
  color: #1a1a2e;
  font-size: 13px;
  font-weight: 600;
}

.favorite-desc {
  color: #8c8c8c;
  font-size: 11px;
}

.favorite-count {
  min-width: 26px;
  height: 22px;
  border-radius: 999px;
  background: #fff8f0;
  color: #d98200;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.stats-month {
  font-size: 12px;
  color: #8c8c8c;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  margin-bottom: 2px;
}

.weekday {
  text-align: center;
  font-size: 10px;
  color: #b0b0b0;
  padding: 2px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border-radius: 3px;
  color: #4a4a4a;
  cursor: default;
  transition: all 0.2s;
}

.calendar-day.empty {
  visibility: hidden;
}

.calendar-day.has-submit {
  background: #fff8f0;
  color: #ffa116;
  font-weight: 600;
}

.calendar-day.today {
  border: 2px solid #ffa116;
  font-weight: 700;
}

.calendar-day.has-submit:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(255, 161, 22, 0.25);
}

.stats-footer {
  display: flex;
  justify-content: space-around;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e8ecf1;
}

.stat-item {
  text-align: center;
}
.stat-label {
  display: block;
  font-size: 10px;
  color: #b0b0b0;
}
.stat-value {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.quick-stats .stat-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #e8ecf1;
}
.quick-stats .stat-row:last-child {
  border-bottom: none;
}
.quick-stats .stat-row .stat-label {
  font-size: 13px;
  color: #4a4a4a;
}
.quick-stats .stat-row .stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

:deep(.el-table) {
  font-size: 13px;
}
:deep(.el-table .cell) {
  padding: 6px 0;
}
:deep(.el-table tbody tr:hover) {
  cursor: pointer;
}
:deep(.el-table tbody tr) {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
:deep(.el-table tbody tr td.el-table__cell) {
  transition: background 0.18s ease, box-shadow 0.18s ease;
}
:deep(.el-table tbody tr:hover) {
  transform: translateY(-1px);
}
:deep(.el-table tbody tr:hover td.el-table__cell) {
  background: #fffdf9 !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.06);
}
:deep(.el-table tbody tr:hover .problem-name) {
  color: #ffa116;
}
:deep(.el-table th.el-table__cell) {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #4a4a4a;
}
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background-color: #fafbfc;
}
.highlight-item {
  background: #fff8f0 !important;
  border-left: 3px solid #a5d5e5;
  transition: all 0.3s;
}
@media (max-width: 1200px) {
  .right-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .left-panel {
    display: none;
  }
  .navbar-left .nav-menu {
    display: none;
  }
  .search-input {
    width: 100px;
  }
  .center-panel {
    padding: 12px 16px;
  }
  .header-right {
    flex-wrap: wrap;
  }
  .filter-select {
    width: 100px;
  }
}

/* ===== Home refresh: align with Review page visual language ===== */
.leetcode-clone {
  background: #f6f7f9;
  color: #191c1e;
}

.navbar {
  height: 58px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.96);
}

.logo-text {
  background: none;
  -webkit-text-fill-color: initial;
  color: #1a1a2e;
}

.nav-item:hover {
  background: #fff8f0;
  color: #ffa116;
}

.search-input {
  width: 220px;
}

.main-container {
  width: min(1520px, calc(100% - 72px));
  margin: 0 auto;
  padding: 30px 0 36px;
  gap: 24px;
  background: transparent;
}

.divider {
  display: none;
}

.left-panel,
.right-panel {
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.left-panel {
  width: 272px;
  padding: 24px 18px;
}

.right-panel {
  width: 320px;
  padding: 0;
  gap: 0;
  overflow: hidden auto;
}

.center-panel {
  padding: 0;
  gap: 22px;
  background: transparent;
}

.home-overview,
.content-header,
.table-wrapper {
  background: #ffffff;
  border: 1px solid #e8ecf1;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.home-overview {
  min-height: 176px;
  padding: 34px 40px;
  display: flex;
  align-items: center;
  border-radius: 8px;
}

.overview-copy {
  min-width: 0;
  max-width: 720px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff8f0;
  color: #b86b00;
  font-size: 13px;
  font-weight: 600;
}

.overview-copy h1 {
  margin: 16px 0 10px;
  color: #1a1a2e;
  font-size: 30px;
  line-height: 1.22;
  letter-spacing: 0;
}

.overview-copy p {
  max-width: 680px;
  margin: 0;
  color: #666f7a;
  font-size: 14px;
  line-height: 1.75;
}

.content-header {
  min-height: 72px;
  padding: 16px 22px;
  margin-bottom: 0;
  border-radius: 8px 8px 0 0;
  border-bottom: 0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.header-left h2 {
  font-size: 18px;
}

.total-count {
  padding: 3px 10px;
  border-radius: 999px;
  background: #f5f7fa;
}

.table-wrapper {
  margin: 0;
  padding: 0 10px 14px;
  border-top: 0;
  border-radius: 0 0 8px 8px;
}

.menu-item {
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 6px;
}

.menu-item:hover {
  background: #fff8f0;
  color: #d98200;
}

.menu-item.active {
  background: #fff8f0;
  color: #ffa116;
  font-weight: 700;
}

.menu-item .badge {
  background: #f2f4f7;
}

.difficulty-group {
  gap: 2px;
}

.stats-card {
  border-radius: 0;
  padding: 16px 18px;
  background: #ffffff;
  border-bottom: 1px solid #e8ecf1;
}

.stats-card:last-child {
  border-bottom: 0;
}

.favorites-card {
  border: 0;
  box-shadow: none;
}

.favorite-item {
  border-color: #edf0f3;
  background: #fbfcfd;
}

.favorite-item:hover {
  background: #fffdf9;
}

.calendar-day {
  border-radius: 5px;
}

.quick-stats .stat-row {
  padding: 10px 0;
}

:deep(.el-table) {
  --el-table-border-color: #edf0f3;
  --el-table-header-bg-color: #f8f9fa;
  font-size: 14px;
}

:deep(.el-table .cell) {
  padding: 8px 10px;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f8f9fa;
  color: #5f6872;
}

:deep(.el-table td.el-table__cell) {
  padding: 14px 0;
}

:deep(.el-table tbody tr:hover td.el-table__cell) {
  background: #fffdf9 !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05);
}

.problem-title {
  gap: 12px;
}

.problem-id {
  min-width: 42px;
  color: #98a1ad;
}

.problem-name {
  font-weight: 600;
}

.solved-tag {
  background: #eefaf7;
  color: #00a38f;
}

@media (max-width: 1280px) {
  .right-panel {
    display: none;
  }

  .main-container {
    width: min(1180px, calc(100% - 42px));
  }
}

@media (max-width: 980px) {
  .home-overview {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 768px) {
  .main-container {
    width: calc(100% - 28px);
    padding-top: 16px;
  }

  .home-overview {
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
}
</style>
