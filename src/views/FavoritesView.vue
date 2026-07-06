<template>
  <div class="favorites-view">
    <header class="navbar">
      <div class="navbar-left">
        <div class="logo" @click="router.push('/home')">
          <span class="logo-icon">⚡</span>
          <span class="logo-text">CodeWise</span>
        </div>
        <nav class="nav-menu">
          <a class="nav-item active" href="#" @click.prevent="router.push('/home')">题库</a>
          <a class="nav-item" href="#">竞赛</a>
          <a class="nav-item" href="#">讨论</a>
          <a class="nav-item" href="#">求职</a>
        </nav>
      </div>
      <div class="navbar-right">
        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="搜索题目..."
          size="small"
          :prefix-icon="Search"
          clearable
        />
        <el-button :icon="Bell" circle size="small" />
        <el-button class="plus-button" type="warning" size="small">Go Plus</el-button>
        <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
      </div>
    </header>

    <div class="main-container">
      <aside class="left-panel">
        <section class="sidebar-card">
          <div class="sidebar-card-title">
            <el-icon><Menu /></el-icon>
            <span>导航</span>
          </div>
          <p>编程练习</p>
        </section>

        <section class="sidebar-section">
          <div class="menu-item" @click="router.push('/home')">
            <el-icon><Collection /></el-icon>
            <span>全部题目</span>
          </div>
          <div class="menu-item">
            <el-icon><Compass /></el-icon>
            <span>探索</span>
          </div>
          <div class="menu-item">
            <el-icon><Reading /></el-icon>
            <span>题解书</span>
          </div>
          <div class="menu-item">
            <el-icon><Calendar /></el-icon>
            <span>学习计划</span>
          </div>
        </section>

        <section class="sidebar-section collections-section">
          <div class="section-title">
            <span>我的题单</span>
            <el-button :icon="Plus" text size="small" />
          </div>
          <div class="menu-item active">
            <el-icon><StarFilled /></el-icon>
            <span>我的收藏</span>
          </div>
          <div class="menu-item">
            <el-icon><Document /></el-icon>
            <span>树和链表</span>
          </div>
        </section>

        <el-button class="create-collection" :icon="FolderAdd" plain>新建题单</el-button>
      </aside>

      <main class="content-panel">
        <section class="summary-panel">
          <el-card class="progress-card" shadow="never">
            <div class="collection-header">
              <div>
                <div class="favorite-mark">
                  <el-icon><StarFilled /></el-icon>
                </div>
                <h1>我的收藏</h1>
                <p>已创建：{{ favoriteProblems.length }} 道题</p>
              </div>
              <div class="header-actions">
                <el-button :icon="Edit" circle />
                <el-button :icon="MoreFilled" circle />
              </div>
            </div>

            <div class="practice-actions">
              <el-button class="start-button" type="info" :icon="VideoPlay" @click="startPractice">
                开始练习
              </el-button>
              <el-button :icon="Plus" />
            </div>

            <el-divider />

            <div class="progress-title">
              <span>练习进度</span>
              <el-button :icon="Refresh" text size="small" />
            </div>
            <div class="progress-body">
              <el-progress
                type="circle"
                :percentage="progressPercent"
                :width="132"
                :stroke-width="10"
                color="#67c23a"
              >
                <template #default>
                  <div class="progress-number">{{ solvedCount }}</div>
                  <div class="progress-total">/ {{ favoriteProblems.length }}</div>
                </template>
              </el-progress>
              <div class="difficulty-stats">
                <div class="stat-line easy">
                  <span>简单</span>
                  <strong>{{ solvedByDifficulty.easy }}/{{ totalByDifficulty.easy }}</strong>
                </div>
                <div class="stat-line medium">
                  <span>中等</span>
                  <strong>{{ solvedByDifficulty.medium }}/{{ totalByDifficulty.medium }}</strong>
                </div>
                <div class="stat-line hard">
                  <span>困难</span>
                  <strong>{{ solvedByDifficulty.hard }}/{{ totalByDifficulty.hard }}</strong>
                </div>
              </div>
            </div>
          </el-card>
        </section>

        <section class="list-panel">
          <div class="toolbar">
            <el-input
              v-model="keyword"
              class="problem-search"
              placeholder="搜索收藏题目..."
              :prefix-icon="Search"
              clearable
            />
            <el-select v-model="difficultyFilter" placeholder="难度" clearable class="difficulty-select">
              <el-option label="简单" value="Easy" />
              <el-option label="中等" value="Medium" />
              <el-option label="困难" value="Hard" />
            </el-select>
            <el-button :icon="Sort" @click="toggleSortOrder" />
            <el-button :icon="Filter" />
          </div>

          <el-card class="problem-card" shadow="never">
            <el-table
              :data="filteredProblems"
              row-key="id"
              style="width: 100%"
              :show-header="false"
              @row-click="goToDetail"
            >
              <el-table-column width="48">
                <template #default>
                  <el-icon class="solved-icon"><CircleCheckFilled /></el-icon>
                </template>
              </el-table-column>
              <el-table-column min-width="260">
                <template #default="{ row }">
                  <div class="problem-title">{{ row.id }}. {{ row.title }}</div>
                </template>
              </el-table-column>
              <el-table-column width="110" align="right">
                <template #default="{ row }">
                  <span class="acceptance">{{ row.acceptance }}</span>
                </template>
              </el-table-column>
              <el-table-column width="110" align="center">
                <template #default="{ row }">
                  <el-tag :type="getDifficultyType(row.difficulty)" effect="light" round>
                    {{ getDifficultyLabel(row.difficulty) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-if="filteredProblems.length === 0" description="暂无匹配的收藏题目" />
          </el-card>

          <div class="list-footer">
            <span>显示 {{ filteredProblems.length }} / {{ favoriteProblems.length }} 道题</span>
            <div>
              <el-button disabled>上一页</el-button>
              <el-button disabled>下一页</el-button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell,
  Calendar,
  CircleCheckFilled,
  Collection,
  Compass,
  Document,
  Edit,
  Filter,
  FolderAdd,
  Menu,
  MoreFilled,
  Plus,
  Reading,
  Refresh,
  Search,
  Sort,
  StarFilled,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface FavoriteProblem {
  id: number
  title: string
  acceptance: string
  difficulty: Difficulty
  solved: boolean
}

const router = useRouter()
const keyword = ref('')
const difficultyFilter = ref<Difficulty | ''>('')
const sortAsc = ref(true)

const favoriteProblems = ref<FavoriteProblem[]>([
  { id: 290, title: 'Word Pattern', acceptance: '45.6%', difficulty: 'Easy', solved: true },
  { id: 1021, title: 'Remove Outer Parentheses', acceptance: '81.6%', difficulty: 'Easy', solved: true },
  { id: 739, title: 'Daily Temperatures', acceptance: '69.7%', difficulty: 'Medium', solved: true },
  { id: 172, title: 'Factorial Trailing Zeroes', acceptance: '51.3%', difficulty: 'Medium', solved: true },
  { id: 1995, title: 'Count Special Quadruplets', acceptance: '67.7%', difficulty: 'Easy', solved: true },
  { id: 560, title: 'Subarray Sum Equals K', acceptance: '46.7%', difficulty: 'Medium', solved: true },
  { id: 347, title: 'Top K Frequent Elements', acceptance: '65.9%', difficulty: 'Medium', solved: true },
  { id: 98, title: 'Validate Binary Search Tree', acceptance: '41.1%', difficulty: 'Medium', solved: true },
  { id: 20, title: 'Valid Parentheses', acceptance: '42.8%', difficulty: 'Easy', solved: true },
  { id: 215, title: 'Kth Largest Element in an Array', acceptance: '67.2%', difficulty: 'Medium', solved: true },
  { id: 105, title: 'Construct Binary Tree from Preorder and Inorder Traversal', acceptance: '63.1%', difficulty: 'Medium', solved: true },
])

const filteredProblems = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const result = favoriteProblems.value.filter((item) => {
    const matchedText = !text || `${item.id} ${item.title}`.toLowerCase().includes(text)
    const matchedDifficulty = !difficultyFilter.value || item.difficulty === difficultyFilter.value
    return matchedText && matchedDifficulty
  })

  return [...result].sort((a, b) => (sortAsc.value ? a.id - b.id : b.id - a.id))
})

const solvedCount = computed(() => favoriteProblems.value.filter((item) => item.solved).length)

const progressPercent = computed(() => {
  if (favoriteProblems.value.length === 0) return 0
  return Math.round((solvedCount.value / favoriteProblems.value.length) * 100)
})

const totalByDifficulty = computed(() => ({
  easy: countByDifficulty('Easy'),
  medium: countByDifficulty('Medium'),
  hard: countByDifficulty('Hard'),
}))

const solvedByDifficulty = computed(() => ({
  easy: countByDifficulty('Easy', true),
  medium: countByDifficulty('Medium', true),
  hard: countByDifficulty('Hard', true),
}))

const countByDifficulty = (difficulty: Difficulty, solvedOnly = false) => {
  return favoriteProblems.value.filter((item) => item.difficulty === difficulty && (!solvedOnly || item.solved)).length
}

const getDifficultyType = (difficulty: Difficulty) => {
  const map: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
    Easy: 'success',
    Medium: 'warning',
    Hard: 'danger',
  }
  return map[difficulty]
}

const getDifficultyLabel = (difficulty: Difficulty) => {
  const map: Record<Difficulty, string> = {
    Easy: '简单',
    Medium: '中等',
    Hard: '困难',
  }
  return map[difficulty]
}

const toggleSortOrder = () => {
  sortAsc.value = !sortAsc.value
}

const startPractice = () => {
  const firstProblem = filteredProblems.value[0]
  if (!firstProblem) {
    ElMessage.warning('当前没有可练习的题目')
    return
  }
  goToDetail(firstProblem)
}

const goToDetail = (row: FavoriteProblem) => {
  router.push({
    path: '/questiondetailview',
    query: { questionId: row.id },
  })
}
</script>

<style scoped>
.favorites-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8f9fb;
  color: #1a1a2e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.navbar {
  height: 56px;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.navbar-left,
.navbar-right,
.logo,
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

.logo {
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
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

.nav-item:hover {
  background: #f0f2f5;
  color: #1a1a2e;
}

.nav-item.active {
  color: #ffa116;
  background: #fff8f0;
}

.search-input {
  width: 180px;
}

.search-input :deep(.el-input__wrapper),
.problem-search :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: #f5f7fa;
}

.plus-button {
  color: #673d00;
  font-weight: 600;
}

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.left-panel {
  width: 240px;
  flex-shrink: 0;
  padding: 20px 16px 20px 24px;
  overflow-y: auto;
  background: #ffffff;
  border-right: 1px solid #e8ecf1;
}

.sidebar-card {
  border: 1px solid #e8ecf1;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 18px;
  background: #ffffff;
}

.sidebar-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a1a2e;
  font-weight: 600;
  margin-bottom: 6px;
}

.sidebar-card-title .el-icon {
  color: #ffa116;
}

.sidebar-card p {
  margin: 0;
  color: #8c8c8c;
  font-size: 13px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #e8ecf1;
}

.collections-section {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  color: #4a4a4a;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item.active {
  background: #fff8f0;
  color: #ffa116;
  font-weight: 600;
}

.create-collection {
  width: 100%;
  border-style: dashed;
}

.content-panel {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
  gap: 24px;
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
}

.summary-panel,
.list-panel {
  min-width: 0;
}

.progress-card,
.problem-card {
  border-radius: 10px;
  border-color: #e8ecf1;
}

.collection-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}

.favorite-mark {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  background: #fff8f0;
  color: #ffa116;
  font-size: 30px;
}

.collection-header h1 {
  margin: 0;
  font-size: 30px;
  line-height: 38px;
}

.collection-header p {
  margin: 6px 0 0;
  color: #8c8c8c;
  font-size: 14px;
}

.header-actions,
.practice-actions,
.progress-title,
.toolbar,
.list-footer {
  display: flex;
  align-items: center;
}

.header-actions {
  gap: 8px;
}

.practice-actions {
  gap: 12px;
  margin-top: 24px;
}

.start-button {
  background: #262626;
  border-color: #262626;
  font-weight: 600;
}

.progress-title {
  justify-content: space-between;
  margin-bottom: 18px;
  font-size: 16px;
  font-weight: 600;
}

.progress-body {
  display: flex;
  align-items: center;
  gap: 28px;
}

.progress-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 32px;
}

.progress-total {
  color: #8c8c8c;
  font-size: 13px;
}

.difficulty-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  font-size: 13px;
}

.stat-line span {
  font-weight: 700;
}

.stat-line.easy span {
  color: #67c23a;
}

.stat-line.medium span {
  color: #e6a23c;
}

.stat-line.hard span {
  color: #f56c6c;
}

.list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  gap: 12px;
}

.problem-search {
  flex: 1;
  min-width: 180px;
}

.difficulty-select {
  width: 120px;
}

.problem-card {
  overflow: hidden;
}

.problem-card :deep(.el-card__body) {
  padding: 0;
}

.problem-card :deep(.el-table__row) {
  cursor: pointer;
}

.problem-card :deep(.el-table__cell) {
  padding: 13px 0;
}

.problem-card :deep(.el-table__row:hover .problem-title) {
  color: #ffa116;
}

.solved-icon {
  color: #67c23a;
  font-size: 18px;
}

.problem-title {
  color: #1a1a2e;
  font-size: 15px;
  font-weight: 600;
  transition: color 0.2s;
}

.acceptance {
  color: #8c8c8c;
  font-size: 13px;
}

.list-footer {
  justify-content: space-between;
  color: #8c8c8c;
  font-size: 13px;
}

@media (max-width: 1180px) {
  .content-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-menu,
  .left-panel,
  .plus-button {
    display: none;
  }

  .navbar-left {
    gap: 12px;
  }

  .navbar-right {
    gap: 8px;
  }

  .search-input {
    width: 120px;
  }

  .content-panel {
    padding: 16px;
    gap: 16px;
  }

  .collection-header,
  .progress-body,
  .toolbar,
  .list-footer {
    align-items: stretch;
  }

  .collection-header,
  .progress-body,
  .toolbar {
    flex-direction: column;
  }

  .difficulty-select {
    width: 100%;
  }

  .list-footer {
    gap: 12px;
    flex-direction: column;
  }
}
</style>
