<template>
  <div class="favorites-view">
    <FavoritesNavBar v-model="keyword" @go-home="goHome" />

    <div class="main-container">
      <FavoritesSidebar @go-home="goHome" />

      <main class="content-panel">
        <section class="summary-panel">
          <FavoritesProgressCard
            :total-count="problems.length"
            :solved-count="solvedCount"
            :progress-percent="progressPercent"
            :total-by-difficulty="totalByDifficulty"
            :solved-by-difficulty="solvedByDifficulty"
            @start-practice="startPractice"
          />
        </section>

        <FavoritesProblemList
          v-model:keyword="keyword"
          v-model:difficulty="difficultyFilter"
          :problems="filteredProblems"
          :total-count="problems.length"
          @toggle-sort="toggleSortOrder"
          @select-problem="goToDetail"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import FavoritesNavBar from '@/components/favorites/FavoritesNavBar.vue'
import FavoritesProblemList from '@/components/favorites/FavoritesProblemList.vue'
import FavoritesProgressCard from '@/components/favorites/FavoritesProgressCard.vue'
import FavoritesSidebar from '@/components/favorites/FavoritesSidebar.vue'
import { favoriteProblems } from '@/data/favoriteProblems'
import type { FavoriteDifficulty, FavoriteProblem } from '@/types/FavoriteProblem'

const router = useRouter()
const keyword = ref('')
const difficultyFilter = ref<FavoriteDifficulty | ''>('')
const sortAsc = ref(true)
const problems = ref<FavoriteProblem[]>(favoriteProblems)

const filteredProblems = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const result = problems.value.filter((item) => {
    const matchedText = !text || `${item.id} ${item.title}`.toLowerCase().includes(text)
    const matchedDifficulty = !difficultyFilter.value || item.difficulty === difficultyFilter.value
    return matchedText && matchedDifficulty
  })

  return [...result].sort((a, b) => (sortAsc.value ? a.id - b.id : b.id - a.id))
})

const solvedCount = computed(() => problems.value.filter((item) => item.solved).length)

const progressPercent = computed(() => {
  if (problems.value.length === 0) return 0
  return Math.round((solvedCount.value / problems.value.length) * 100)
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

const countByDifficulty = (difficulty: FavoriteDifficulty, solvedOnly = false) => {
  return problems.value.filter((item) => item.difficulty === difficulty && (!solvedOnly || item.solved)).length
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

const goHome = () => {
  router.push('/home')
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

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
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

.summary-panel {
  min-width: 0;
}

@media (max-width: 1180px) {
  .content-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .content-panel {
    padding: 16px;
    gap: 16px;
  }
}
</style>
