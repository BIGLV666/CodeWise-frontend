<template>
  <div class="favorites-view">
    <FavoritesNavBar v-model="keyword" @go-home="goHome" />

    <div class="main-container">
      <FavoritesSidebar
        :favorites="favorites"
        :selected-favorite-id="selectedFavoriteId"
        :loading="favoritesLoading"
        @go-home="goHome"
        @select-favorite="selectFavorite"
        @create-favorite="createFavorite"
      />

      <main v-loading="favoritesLoading || questionsLoading" class="content-panel">
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FavoritesNavBar from '@/components/favorites/FavoritesNavBar.vue'
import FavoritesProblemList from '@/components/favorites/FavoritesProblemList.vue'
import FavoritesProgressCard from '@/components/favorites/FavoritesProgressCard.vue'
import FavoritesSidebar from '@/components/favorites/FavoritesSidebar.vue'
import reviewApi from '@/api/reviewApi'
import type { FavoriteCollection, FavoriteDifficulty, FavoriteProblem, FavoriteQuestionDto } from '@/types/FavoriteProblem'

const router = useRouter()
const route = useRoute()
const keyword = ref('')
const difficultyFilter = ref<FavoriteDifficulty | ''>('')
const sortAsc = ref(true)
const problems = ref<FavoriteProblem[]>([])
const favorites = ref<FavoriteCollection[]>([])
const selectedFavoriteId = ref('')
const favoritesLoading = ref(false)
const questionsLoading = ref(false)

const filteredProblems = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const result = problems.value.filter((item) => {
    const matchedText = !text || `${item.id} ${item.title}`.toLowerCase().includes(text)
    const matchedDifficulty = !difficultyFilter.value || item.difficulty === difficultyFilter.value
    return matchedText && matchedDifficulty
  })

  return [...result].sort((a, b) => compareId(a.id, b.id) * (sortAsc.value ? 1 : -1))
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

const compareId = (a: string, b: string) => {
  try {
    const left = BigInt(a)
    const right = BigInt(b)
    return left > right ? 1 : left < right ? -1 : 0
  } catch {
    return a.localeCompare(b)
  }
}

const mapDifficulty = (difficulty?: number): FavoriteDifficulty => {
  const map: Record<number, FavoriteDifficulty> = {
    1: 'Easy',
    2: 'Medium',
    3: 'Hard',
  }
  return map[difficulty || 1] || 'Easy'
}

const formatAcceptance = (question: FavoriteQuestionDto) => {
  if (question.passRate !== undefined && question.passRate !== null) {
    const raw = Number(question.passRate)
    if (!Number.isNaN(raw)) {
      return raw <= 1 ? `${(raw * 100).toFixed(1)}%` : `${raw.toFixed(1)}%`
    }
  }
  if (question.totalSubmit && question.totalAc !== undefined) {
    return `${((question.totalAc / question.totalSubmit) * 100).toFixed(1)}%`
  }
  return '-'
}

const mapQuestion = (question: FavoriteQuestionDto): FavoriteProblem => ({
  id: String(question.questionId),
  title: question.title,
  acceptance: formatAcceptance(question),
  difficulty: mapDifficulty(question.difficulty),
  solved: false,
})

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

const getRouteFavoriteId = () => {
  const favoriteId = route.query.favoriteId
  return Array.isArray(favoriteId) ? favoriteId[0] : favoriteId
}

const loadFavorites = async () => {
  favoritesLoading.value = true
  try {
    const res: any = await reviewApi.listFavorites()
    favorites.value = (res.data || []).map(mapFavorite)

    if (favorites.value.length === 0) {
      problems.value = []
      selectedFavoriteId.value = ''
      return
    }

    const routeFavoriteId = getRouteFavoriteId()
    const matchedRouteFavorite = routeFavoriteId
      ? favorites.value.find((item) => item.favoritesId === String(routeFavoriteId))
      : undefined
    const nextFavoriteId = matchedRouteFavorite?.favoritesId || selectedFavoriteId.value || favorites.value[0].favoritesId
    await selectFavorite(nextFavoriteId, false)
  } catch (error) {
    console.error('加载收藏夹失败:', error)
    favorites.value = []
    problems.value = []
    selectedFavoriteId.value = ''
    ElMessage.error('收藏夹加载失败')
  } finally {
    favoritesLoading.value = false
  }
}

const selectFavorite = async (favoriteId: string, syncRoute = true) => {
  selectedFavoriteId.value = favoriteId
  if (syncRoute && route.query.favoriteId !== favoriteId) {
    router.replace({
      path: '/favorites',
      query: { ...route.query, favoriteId },
    })
  }
  questionsLoading.value = true
  try {
    const res: any = await reviewApi.getFavoriteQuestions(favoriteId)
    problems.value = (res.data || []).map(mapQuestion)
  } catch (error) {
    console.error('加载收藏题目失败:', error)
    problems.value = []
  } finally {
    questionsLoading.value = false
  }
}

const createFavorite = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入题单名称', '新建题单', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '题单名称不能为空',
    })
    const requestIdRes: any = await reviewApi.getCreateRequestId()
    const requestId = typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.message
    if (!requestId) {
      ElMessage.error('创建请求 ID 获取失败')
      return
    }
    await reviewApi.createFavorite(value.trim(), requestId)
    ElMessage.success('题单创建成功')
    await loadFavorites()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('创建题单失败:', error)
    }
  }
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
    query: { questionId: row.id, from: '/favorites', favoriteId: selectedFavoriteId.value },
  })
}

watch(
  () => route.query.favoriteId,
  (favoriteId) => {
    const nextFavoriteId = Array.isArray(favoriteId) ? favoriteId[0] : favoriteId
    if (!nextFavoriteId || nextFavoriteId === selectedFavoriteId.value || favorites.value.length === 0) return
    selectFavorite(String(nextFavoriteId), false)
  },
)

onMounted(() => {
  loadFavorites()
})
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
