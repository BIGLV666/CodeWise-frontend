<template>
  <div class="favorites-view">
    <AppNavBar active="home" show-search v-model:search="keyword" />

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
            :favorite-name="selectedFavorite?.favoritesName || '我的收藏'"
            :favorite-content="selectedFavorite?.favoritesContent"
            :total-count="problems.length"
            :solved-count="solvedCount"
            :progress-percent="progressPercent"
            :total-by-difficulty="totalByDifficulty"
            :solved-by-difficulty="solvedByDifficulty"
            @start-practice="startPractice"
            @edit-favorite="openEditFavorite"
            @delete-favorite="deleteSelectedFavorite"
          />
        </section>

        <FavoritesProblemList
          v-model:keyword="keyword"
          v-model:difficulty="difficultyFilter"
          :problems="filteredProblems"
          :total-count="problems.length"
          @toggle-sort="toggleSortOrder"
          @select-problem="goToDetail"
          @remove-problem="removeProblem"
        />
      </main>
    </div>

    <el-dialog v-model="editDialogVisible" title="编辑收藏夹" width="460px">
      <el-form label-position="top">
        <el-form-item label="收藏夹名称">
          <el-input v-model="editForm.favoritesName" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.favoritesContent"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="editForm.favoritesType" maxlength="30" placeholder="例如：算法、面试、错题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingFavorite" @click="saveFavoriteInfo">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import FavoritesProblemList from '@/components/favorites/FavoritesProblemList.vue'
import FavoritesProgressCard from '@/components/favorites/FavoritesProgressCard.vue'
import FavoritesSidebar from '@/components/favorites/FavoritesSidebar.vue'
import reviewApi from '@/api/reviewApi'
import type { FavoriteCollection, FavoriteDifficulty, FavoriteProblem, FavoriteQuestionDto } from '@/types/FavoriteProblem'
import { navigateTopLevel } from '@/utils/navigation'

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
const editDialogVisible = ref(false)
const savingFavorite = ref(false)
const editForm = reactive({
  favoritesName: '',
  favoritesContent: '',
  favoritesType: '',
})

const selectedFavorite = computed(() => {
  return favorites.value.find((item) => item.favoritesId === selectedFavoriteId.value)
})

const filteredProblems = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const result = problems.value.filter((item) => {
    const matchedText = !text || `${item.id} ${item.title}`.toLowerCase().includes(text)
    const matchedDifficulty = !difficultyFilter.value || item.difficulty === difficultyFilter.value
    return matchedText && matchedDifficulty
  })

  return [...result].sort((a, b) => compareId(a.id, b.id) * (sortAsc.value ? 1 : -1))
})

const solvedCount = computed(() => problems.value.filter((item) => item.status === 1).length)

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

const unwrapData = <T,>(res: any, fallback: T): T => {
  return (res?.data ?? res ?? fallback) as T
}

const countByDifficulty = (difficulty: FavoriteDifficulty, solvedOnly = false) => {
  return problems.value.filter((item) => item.difficulty === difficulty && (!solvedOnly || item.status === 1)).length
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

const mapQuestion = (question: any): FavoriteProblem => {
  const status = Number(question.status ?? 0)
  return {
    id: String(question.questionId ?? question.question_id),
    title: question.title ?? question.questionTitle ?? question.question_title ?? '未命名题目',
    acceptance: formatAcceptance(question),
    difficulty: mapDifficulty(question.difficulty),
    solved: status === 1,
    status,
  }
}

const mapFavorite = (item: any): FavoriteCollection => {
  const favoritesId = item.favoritesId ?? item.favorites_id
  const questionIds = item.questionIds ?? item.question_ids

  return {
    ...item,
    favoritesId: String(favoritesId),
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

const getRouteFavoriteId = () => {
  const favoriteId = route.query.favoriteId
  return Array.isArray(favoriteId) ? favoriteId[0] : favoriteId
}

const loadFavorites = async () => {
  favoritesLoading.value = true
  try {
    const res: any = await reviewApi.listFavorites()
    favorites.value = unwrapData<any[]>(res, []).map(mapFavorite)

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
    ElMessage.error('收藏夹加载失败，请稍后重试')
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
    problems.value = unwrapData<any[]>(res, []).map(mapQuestion)
  } catch (error) {
    console.error('加载收藏题目失败:', error)
    problems.value = []
  } finally {
    questionsLoading.value = false
  }
}

const createFavorite = async () => {
  try {
    const { value } = await ElMessageBox.prompt('请输入收藏夹名称', '新建收藏夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '收藏夹名称不能为空',
    })
    const requestIdRes: any = await reviewApi.getCreateRequestId()
    const requestId = typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.message
    if (!requestId) {
      ElMessage.error('操作失败，请稍后重试')
      return
    }
    await reviewApi.createFavorite(value.trim(), requestId)
    ElMessage.success('收藏夹创建成功')
    await loadFavorites()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('创建收藏夹失败:', error)
    }
  }
}

const openEditFavorite = () => {
  if (!selectedFavorite.value) {
    ElMessage.warning('请先选择收藏夹')
    return
  }
  editForm.favoritesName = selectedFavorite.value.favoritesName || ''
  editForm.favoritesContent = selectedFavorite.value.favoritesContent || ''
  editForm.favoritesType = selectedFavorite.value.favoritesType || ''
  editDialogVisible.value = true
}

const saveFavoriteInfo = async () => {
  if (!selectedFavorite.value) return
  const favoritesName = editForm.favoritesName.trim()
  if (!favoritesName) {
    ElMessage.warning('收藏夹名称不能为空')
    return
  }

  savingFavorite.value = true
  try {
    await reviewApi.updateFavorite({
      favoritesId: selectedFavorite.value.favoritesId,
      favoritesName,
      favoritesContent: editForm.favoritesContent.trim(),
      favoritesType: editForm.favoritesType.trim(),
      questionIds: selectedFavorite.value.questionIds || [],
    })
    ElMessage.success('收藏夹已更新')
    editDialogVisible.value = false
    await loadFavorites()
  } finally {
    savingFavorite.value = false
  }
}

const deleteSelectedFavorite = async () => {
  if (!selectedFavorite.value) {
    ElMessage.warning('请先选择收藏夹')
    return
  }

  await ElMessageBox.confirm(`确定删除「${selectedFavorite.value.favoritesName}」吗？`, '删除收藏夹', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })

  await reviewApi.deleteFavorite(selectedFavorite.value.favoritesId)
  ElMessage.success('收藏夹已删除')
  selectedFavoriteId.value = ''
  await loadFavorites()
}

const removeProblem = async (problem: FavoriteProblem) => {
  if (!selectedFavoriteId.value) return

  await ElMessageBox.confirm(`确定将「${problem.title}」移出当前收藏夹吗？`, '移出收藏', {
    confirmButtonText: '移出',
    cancelButtonText: '取消',
    type: 'warning',
  })

  await reviewApi.removeQuestion(problem.id, selectedFavoriteId.value)
  ElMessage.success('已移出收藏')
  await Promise.all([selectFavorite(selectedFavoriteId.value, false), loadFavorites()])
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
  navigateTopLevel(router, '/home')
}

const goDiscuss = () => {
  navigateTopLevel(router, '/discuss')
}

const goReview = () => {
  navigateTopLevel(router, '/review')
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
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
