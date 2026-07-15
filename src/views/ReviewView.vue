<template>
  <div class="review-view">
    <header class="navbar">
      <div class="navbar-left">
        <button class="logo" type="button" @click="goHome">
          <span class="logo-icon">⚡</span>
          <span class="logo-text">CodeWise</span>
        </button>
        <nav class="nav-menu">
          <button class="nav-item" type="button" @click="goHome">题库</button>
          <button class="nav-item" type="button">竞赛</button>
          <button class="nav-item" type="button" @click="goDiscuss">讨论</button>
          <button class="nav-item active" type="button">复习</button>
        </nav>
      </div>

      <div class="navbar-right">
        <el-input
          v-model="keyword"
          placeholder="搜索复习题..."
          size="small"
          :prefix-icon="Search"
          class="search-input"
          clearable
        />
        <InboxButton />
        <el-tooltip content="全部复习内容" placement="bottom">
          <el-button :icon="Tickets" circle size="small" @click="historyDrawerVisible = true" />
        </el-tooltip>
        <el-tooltip content="复习设置" placement="bottom">
          <el-button :icon="Setting" circle size="small" @click="openConfigDialog" />
        </el-tooltip>
        <el-tooltip content="刷新" placement="bottom">
          <el-button :icon="Refresh" circle size="small" :loading="loading" @click="loadReviewPage" />
        </el-tooltip>
      </div>
    </header>

    <main class="review-shell">
      <section class="overview-panel">
        <div class="overview-copy">
          <span class="eyebrow">今日复习 · {{ todayLabel }}</span>
          <h1>把做过的题变成稳定手感</h1>
          <p>这里会按后端 SM-2 复习计划拉取今天该练的题。进入题目后仍使用原来的详情页和编辑器，提交时会标记为 REVIEW。</p>

          <div class="overview-actions">
            <el-button class="start-button" type="primary" :disabled="!filteredTasks.length" @click="startReview">
              开始复习
            </el-button>
            <el-button plain @click="goFavorites">查看收藏</el-button>
          </div>
        </div>

        <div class="progress-card">
          <div class="progress-ring" :aria-label="`今日进度 ${progressPercent}%`">
            <svg viewBox="0 0 140 140">
              <circle class="ring-track" cx="70" cy="70" r="58" />
              <circle class="ring-value" cx="70" cy="70" r="58" :style="ringStyle" />
            </svg>
            <div class="ring-text">
              <strong>{{ progressPercent }}%</strong>
              <span>今日进度</span>
            </div>
          </div>

          <div class="metric-grid">
            <div class="metric-item">
              <span>待复习</span>
              <strong>{{ pendingTasks }}</strong>
            </div>
            <div class="metric-item">
              <span>每日上限</span>
              <strong>{{ reviewConfig.reviewCount ?? '-' }}</strong>
            </div>
            <div class="metric-item">
              <span>复习模式</span>
              <strong class="accent">{{ activePresetLabel }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="review-table-panel">
        <div class="table-header">
          <div>
            <h2>待复习题目</h2>
            <p>点击题目进入原来的编辑器页面</p>
          </div>
          <div class="table-tools">
            <el-tag effect="plain" type="info">SM-2</el-tag>
            <el-button :icon="Filter" text />
          </div>
        </div>

        <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="state-alert" />

        <el-table
          v-loading="loading"
          :data="filteredTasks"
          row-key="questionId"
          class="review-table"
          empty-text="今天暂无需要复习的题目"
          @row-click="openQuestion"
        >
          <el-table-column label="状态" width="96">
            <template #default>
              <el-icon class="status-icon">
                <Clock />
              </el-icon>
            </template>
          </el-table-column>
          <el-table-column label="题目名称" min-width="320">
            <template #default="{ row }">
              <div class="question-cell">
                <strong>{{ row.questionId }}. {{ row.title }}</strong>
                <span>{{ getDifficultyLabel(row.difficulty) }} · {{ formatTags(row.tags) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="通过率" min-width="200">
            <template #default="{ row }">
              <div class="rate-cell">
                <el-progress :percentage="getPassRate(row.passRate)" :show-text="false" :stroke-width="8" />
                <span>{{ getPassRate(row.passRate) }}%</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="提交" width="140">
            <template #default="{ row }">
              <span>{{ row.totalAc ?? 0 }} / {{ row.totalSubmit ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-tooltip content="进入编辑器" placement="top">
                <el-button :icon="VideoPlay" size="small" circle @click.stop="openQuestion(row)" />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </main>

    <el-dialog v-model="configDialogVisible" title="复习设置" width="720px" class="config-dialog">
      <div class="preset-grid">
        <button
          v-for="preset in reviewPresets"
          :key="preset.value"
          class="preset-card"
          :class="{ active: selectedPreset === preset.value }"
          type="button"
          @click="applyPreset(preset.value)"
        >
          <span>{{ preset.label }}</span>
          <strong>{{ preset.reviewCount }} 题 / 天</strong>
          <small>{{ preset.description }}</small>
        </button>
      </div>

      <el-divider />

      <el-alert
        title="如果不了解 SM-2 参数，可以直接使用上方的轻松、标准或紧张模式，不需要手动修改下面的高级参数。"
        type="info"
        show-icon
        :closable="false"
        class="config-tip"
      />

      <el-form label-position="top" class="config-form">
        <el-collapse v-model="activeConfigPanels" class="advanced-config-collapse">
          <el-collapse-item name="advanced">
            <template #title>
              <span class="advanced-title">
                显示更多配置
                <small>手动调整每日题数、自动推进和 SM-2 参数</small>
              </span>
            </template>

            <div class="manual-config-grid">
              <el-form-item>
                <template #label>
                  <span class="field-label">
                    每日最大复习题数
                    <el-tooltip content="每天最多从复习队列中取多少道题。数值越大，单日压力越高。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-input-number v-model="configForm.reviewCount" :min="0" :max="200" controls-position="right" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="field-label">
                    自动复习推进
                    <el-tooltip content="开启后，后端会根据提交结果和 SM-2 算法自动更新下一次复习时间。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-switch v-model="configForm.enableAutoReview" :active-value="1" :inactive-value="0" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="field-label">
                    编译错误计入复习
                    <el-tooltip content="开启后，编译错误也会作为一次低质量复习记录，可能让题目更快再次出现。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-switch v-model="configForm.countCompileError" :active-value="1" :inactive-value="0" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="field-label">
                    最低难度因子
                    <el-tooltip content="SM-2 中 easiness factor 的下限。越低表示系统允许题目被判定得更难，复习间隔会更短。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-input-number v-model="configForm.minEasinessFactor" :min="1" :max="3" :step="0.1" controls-position="right" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="field-label">
                    初始难度因子
                    <el-tooltip content="新加入复习计划的题目默认 easiness factor。数值越高，答对后复习间隔增长越快。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-input-number v-model="configForm.initialEasinessFactor" :min="1" :max="4" :step="0.1" controls-position="right" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="field-label">
                    掌握判定间隔
                    <el-tooltip content="当下一次复习间隔达到这个天数时，可以认为题目接近掌握。数值越大，掌握标准越严格。" placement="top">
                      <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </template>
                <el-input-number v-model="configForm.masteredIntervalDays" :min="1" :max="365" controls-position="right" />
              </el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>

      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingConfig" @click="saveConfig">保存设置</el-button>
      </template>
    </el-dialog>

    <ReviewHistoryDrawer v-model:visible="historyDrawerVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Clock,
  Filter,
  QuestionFilled,
  Refresh,
  Search,
  Setting,
  Tickets,
  VideoPlay,
} from '@element-plus/icons-vue'
import reviewApi, { type ReviewConfig, type ReviewQuestionDto, type ReviewRecord } from '@/api/reviewApi'
import ReviewHistoryDrawer from '@/components/review/ReviewHistoryDrawer.vue'
import InboxButton from '@/components/notification/InboxButton.vue'
import { navigateTopLevel } from '@/utils/navigation'

type ReviewQuestion = ReviewQuestionDto & {
  questionId: string
  title: string
}

type PresetValue = 'easy' | 'standard' | 'intense'

interface ReviewPreset {
  value: PresetValue
  label: string
  description: string
  reviewCount: number
  enableAutoReview: number
  countCompileError: number
  minEasinessFactor: number
  initialEasinessFactor: number
  masteredIntervalDays: number
}

const reviewPresets: ReviewPreset[] = [
  {
    value: 'easy',
    label: '轻松',
    description: '适合保持手感，减少每天负担。',
    reviewCount: 10,
    enableAutoReview: 1,
    countCompileError: 0,
    minEasinessFactor: 1.3,
    initialEasinessFactor: 2.5,
    masteredIntervalDays: 45,
  },
  {
    value: 'standard',
    label: '标准',
    description: '默认节奏，兼顾新题和复习。',
    reviewCount: 20,
    enableAutoReview: 1,
    countCompileError: 1,
    minEasinessFactor: 1.3,
    initialEasinessFactor: 2.5,
    masteredIntervalDays: 30,
  },
  {
    value: 'intense',
    label: '紧张',
    description: '面试冲刺期使用，更快暴露薄弱点。',
    reviewCount: 40,
    enableAutoReview: 1,
    countCompileError: 1,
    minEasinessFactor: 1.2,
    initialEasinessFactor: 2.3,
    masteredIntervalDays: 21,
  },
]

const router = useRouter()
const keyword = ref('')
const loading = ref(false)
const savingConfig = ref(false)
const configDialogVisible = ref(false)
const historyDrawerVisible = ref(false)
const activeConfigPanels = ref<string[]>([])
const errorMessage = ref('')
const selectedPreset = ref<PresetValue>('standard')
const reviewTasks = ref<ReviewQuestion[]>([])
const reviewRecord = ref<ReviewRecord | null>(null)
const reviewConfig = ref<ReviewConfig>({})
const configForm = reactive({
  reviewCount: 20,
  enableAutoReview: 1,
  countCompileError: 1,
  minEasinessFactor: 1.3,
  initialEasinessFactor: 2.5,
  masteredIntervalDays: 30,
})

const todayLabel = computed(() => {
  const date = new Date()
  return `${date.getMonth() + 1}月${date.getDate()}日`
})

const activePresetLabel = computed(() => {
  return reviewPresets.find((preset) => preset.value === selectedPreset.value)?.label || '自定义'
})

const pendingTasks = computed(() => reviewRecord.value?.pendingReviewQuestionIds?.length ?? reviewTasks.value.length)
const completedTasks = computed(() => reviewRecord.value?.completedReviewQuestionIds?.length ?? 0)
const totalTasks = computed(() => {
  const total = pendingTasks.value + completedTasks.value
  return total > 0 ? total : reviewTasks.value.length
})
const progressPercent = computed(() => {
  if (totalTasks.value === 0) return 100
  return Math.min(100, Math.round((completedTasks.value / totalTasks.value) * 100))
})
const ringStyle = computed(() => {
  const circumference = 364.4
  return {
    strokeDasharray: circumference,
    strokeDashoffset: circumference * (1 - progressPercent.value / 100),
  }
})

const filteredTasks = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return reviewTasks.value
  return reviewTasks.value.filter((item) =>
    `${item.questionId} ${item.title} ${item.tags ?? ''}`.toLowerCase().includes(text),
  )
})

const normalizeListResponse = (res: any): ReviewQuestion[] => {
  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
  return list
    .map((item: ReviewQuestionDto) => ({
      ...item,
      questionId: String(item.questionId),
      title: item.title || `题目 ${item.questionId}`,
    }))
    .filter((item: ReviewQuestion) => item.questionId)
}

const normalizeTodayReviewResponse = (res: any) => {
  const payload = res?.data ?? res
  if (Array.isArray(payload)) {
    return {
      questions: normalizeListResponse(payload),
      record: null,
    }
  }

  return {
    questions: normalizeListResponse(payload?.questions ?? []),
    record: payload?.reviewRecord ?? null,
  }
}

const inferPreset = () => {
  const matched = reviewPresets.find((preset) =>
    preset.reviewCount === configForm.reviewCount
    && preset.enableAutoReview === configForm.enableAutoReview
    && preset.countCompileError === configForm.countCompileError
    && preset.masteredIntervalDays === configForm.masteredIntervalDays,
  )
  selectedPreset.value = matched?.value || 'standard'
}

const applyConfig = (config: ReviewConfig = {}) => {
  reviewConfig.value = config
  configForm.reviewCount = config.reviewCount ?? 20
  configForm.enableAutoReview = config.enableAutoReview ?? 1
  configForm.countCompileError = config.countCompileError ?? 1
  configForm.minEasinessFactor = config.minEasinessFactor ?? 1.3
  configForm.initialEasinessFactor = config.initialEasinessFactor ?? 2.5
  configForm.masteredIntervalDays = config.masteredIntervalDays ?? 30
  inferPreset()
}

const loadReviewPage = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [todayRes, configRes]: any[] = await Promise.all([reviewApi.getTodayReview(), reviewApi.getReviewConfig()])
    const todayReview = normalizeTodayReviewResponse(todayRes)
    reviewTasks.value = todayReview.questions
    reviewRecord.value = todayReview.record
    applyConfig(configRes?.data || configRes || {})
  } catch (error) {
    errorMessage.value = '复习计划加载失败，请确认后端服务和登录状态正常'
    reviewTasks.value = []
    reviewRecord.value = null
  } finally {
    loading.value = false
  }
}

const openConfigDialog = () => {
  configDialogVisible.value = true
}

const applyPreset = (value: PresetValue) => {
  const preset = reviewPresets.find((item) => item.value === value)
  if (!preset) return
  selectedPreset.value = preset.value
  configForm.reviewCount = preset.reviewCount
  configForm.enableAutoReview = preset.enableAutoReview
  configForm.countCompileError = preset.countCompileError
  configForm.minEasinessFactor = preset.minEasinessFactor
  configForm.initialEasinessFactor = preset.initialEasinessFactor
  configForm.masteredIntervalDays = preset.masteredIntervalDays
}

const saveConfig = async () => {
  savingConfig.value = true
  try {
    const res: any = await reviewApi.updateReviewConfig({
      reviewCount: configForm.reviewCount,
      enableAutoReview: configForm.enableAutoReview,
      countCompileError: configForm.countCompileError,
      minEasinessFactor: configForm.minEasinessFactor,
      initialEasinessFactor: configForm.initialEasinessFactor,
      masteredIntervalDays: configForm.masteredIntervalDays,
    })
    applyConfig(res?.data || res || {})
    configDialogVisible.value = false
    ElMessage.success('复习设置已保存')
  } finally {
    savingConfig.value = false
  }
}

const getDifficultyLabel = (difficulty?: number) => {
  if (difficulty === 1) return '简单'
  if (difficulty === 2) return '中等'
  if (difficulty === 3) return '困难'
  return '未标记'
}

const formatTags = (tags?: string) => {
  if (!tags) return '暂无标签'
  return tags
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('、')
}

const getPassRate = (value?: number | string) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

const goHome = () => {
  navigateTopLevel(router, '/home')
}

const goDiscuss = () => {
  navigateTopLevel(router, '/discuss')
}

const goFavorites = () => {
  navigateTopLevel(router, '/favorites')
}

const openQuestion = (task: ReviewQuestion) => {
  router.push({
    path: '/questiondetailview',
    query: { questionId: task.questionId, from: '/review' },
  })
}

const startReview = () => {
  const nextTask = filteredTasks.value[0]
  if (nextTask) openQuestion(nextTask)
}

onMounted(loadReviewPage)
onActivated(loadReviewPage)
</script>

<style scoped>
.review-view {
  min-height: 100vh;
  background: #f6f7f9;
  color: #191c1e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
  gap: 12px;
}

.logo,
.nav-item {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}

.logo-icon {
  color: #ffa116;
}

.logo-text {
  color: #1a1a2e;
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
  color: #ffa116;
  background: #fff8f0;
}

.search-input {
  width: 220px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 999px;
  background: #f5f7fa;
}

.review-shell {
  width: min(1320px, calc(100% - 56px));
  margin: 0 auto;
  padding: 34px 0 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.overview-panel,
.review-table-panel {
  background: #ffffff;
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.overview-panel {
  min-height: 258px;
  padding: 34px 38px;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, 0.85fr);
  gap: 48px;
  align-items: center;
}

.overview-copy {
  max-width: 680px;
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
  margin: 18px 0 12px;
  color: #1a1a2e;
  font-size: 34px;
  line-height: 1.22;
  letter-spacing: 0;
}

.overview-copy p {
  max-width: 620px;
  margin: 0;
  color: #666f7a;
  font-size: 15px;
  line-height: 1.8;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 26px;
}

.start-button {
  min-width: 118px;
  background: #262626;
  border-color: #262626;
}

.progress-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 26px;
  border: 1px solid #edf0f3;
  border-radius: 8px;
  background: #fbfcfd;
}

.progress-ring {
  position: relative;
  width: 142px;
  height: 142px;
  flex-shrink: 0;
}

.progress-ring svg {
  width: 142px;
  height: 142px;
  transform: rotate(-90deg);
}

.ring-track,
.ring-value {
  fill: none;
  stroke-width: 10;
}

.ring-track {
  stroke: #eef0f3;
}

.ring-value {
  stroke: #00b8a3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.2s ease;
}

.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-text strong {
  font-size: 30px;
  line-height: 1;
  color: #1a1a2e;
}

.ring-text span {
  color: #8c8c8c;
  font-size: 13px;
}

.metric-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  min-height: 82px;
  padding: 14px 16px;
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  background: #ffffff;
}

.metric-item span,
.metric-item strong {
  display: block;
}

.metric-item span {
  color: #8c8c8c;
  font-size: 13px;
}

.metric-item strong {
  margin-top: 10px;
  color: #1a1a2e;
  font-size: 22px;
}

.metric-item .accent {
  color: #00a38f;
}

.review-table-panel {
  overflow: hidden;
}

.table-header {
  min-height: 76px;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8ecf1;
  background: #ffffff;
}

.table-header h2 {
  margin: 0;
  color: #1a1a2e;
  font-size: 18px;
}

.table-header p {
  margin: 5px 0 0;
  color: #8c8c8c;
  font-size: 13px;
}

.table-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.state-alert {
  margin: 14px 20px 0;
}

.review-table {
  --el-table-row-hover-bg-color: #fffdf9;
}

.review-table :deep(.el-table__cell) {
  padding: 16px 0;
}

.review-table :deep(.el-table__row) {
  cursor: pointer;
}

.review-table :deep(.el-table__row td.el-table__cell) {
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.review-table :deep(.el-table__row:hover td.el-table__cell) {
  background: #fffdf9 !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05);
}

.status-icon {
  color: #d9c3ad;
  font-size: 20px;
}

.question-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.question-cell strong {
  color: #1a1a2e;
  font-size: 15px;
}

.review-table :deep(.el-table__row:hover .question-cell strong) {
  color: #ffa116;
}

.question-cell span,
.rate-cell span {
  color: #8c8c8c;
  font-size: 12px;
}

.rate-cell {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) 42px;
  gap: 10px;
  align-items: center;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.preset-card {
  min-height: 126px;
  padding: 16px;
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.preset-card:hover,
.preset-card.active {
  border-color: #ffa116;
  background: #fffaf3;
  box-shadow: 0 8px 18px rgba(255, 161, 22, 0.1);
}

.preset-card span,
.preset-card strong,
.preset-card small {
  display: block;
}

.preset-card span {
  color: #1a1a2e;
  font-weight: 700;
}

.preset-card strong {
  margin-top: 10px;
  color: #ffa116;
  font-size: 18px;
}

.preset-card small {
  margin-top: 8px;
  color: #6b7280;
  line-height: 1.5;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-tip {
  margin-bottom: 18px;
}

.manual-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 18px;
}

.advanced-config-collapse {
  border-top: 1px solid #edf0f3;
  border-bottom: 1px solid #edf0f3;
}

.advanced-config-collapse :deep(.el-collapse-item__header) {
  min-height: 48px;
  color: #1a1a2e;
  font-weight: 700;
}

.advanced-config-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 4px;
}

.advanced-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.advanced-title small {
  color: #8c8c8c;
  font-size: 12px;
  font-weight: 400;
}

.config-form :deep(.el-form-item__label) {
  color: #4a4a4a;
  font-weight: 600;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.field-label .el-icon {
  color: #a8b0ba;
  cursor: help;
  font-size: 15px;
  transition: color 0.18s ease;
}

.field-label .el-icon:hover {
  color: #ffa116;
}

.config-form :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 1120px) {
  .overview-panel {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .progress-card {
    align-items: stretch;
  }
}

@media (max-width: 760px) {
  .nav-menu {
    display: none;
  }

  .navbar {
    padding: 0 14px;
  }

  .search-input {
    display: none;
  }

  .review-shell {
    width: calc(100% - 28px);
    padding-top: 18px;
  }

  .overview-panel {
    padding: 24px 20px;
  }

  .overview-copy h1 {
    font-size: 26px;
  }

  .progress-card {
    flex-direction: column;
  }

  .metric-grid,
  .preset-grid,
  .manual-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
