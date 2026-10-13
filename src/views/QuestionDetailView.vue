<template>
  <div class="question-detail">
    <!-- ====== 顶部导航 ====== -->
    <QuestionTopBar
      :title="questionData?.title"
      :question-id="questionData?.questionId"
      @back="goBack"
      @copy="copyText(questionData?.title || '')"
      @favorite="handleFavoriteQuestion"
      @reset-layout="resetLayout"
      @addQuestionToReview="addQuestionToReview"
    />

    <!-- ====== 主内容 ====== -->
    <div class="main-container" ref="containerRef">
      <!-- ====== 左面板：题目 ====== -->
      <div class="left-panel" :style="{ width: leftWidth + 'px' }">
        <QuestionInfoTabs
          v-model:active-tab="activeTab"
          :question-data="questionData"
          :difficulty-tag="difficultyTag"
          :difficulty-text="difficultyText"
          :sample-cases="sampleCases"
          :pass-rate="passRate"
          :render-content="renderContent"
          :submissions-loading="submissionsLoading"
          :submissions-list="submissionsList"
          :get-status-type="getStatusType"
          :format-time="formatTime"
          :debug-test-cases="debugTestCases"
          :selected-test-case-index="selectedTestCaseIndex"
          :editing-test-case-index="editingTestCaseIndex"
          :debugging="debugging"
          :can-provide-tests="isFunctionQuestion && userStore.isAdmin && hasSubmittedQuestion"
          :providing-tests="providingTests"
          :can-generate-random="canGenerateRandomTests"
          :initial-solution-id="initialSolutionId"
          @tab-click="handleTabClick"
          @view-code="viewCodeInEditor"
          @add-testcase="addTestCase"
          @reset-to-sample="resetToSample"
          @debug="handleDebug"
          @provide-tests="provideFunctionTests"
          @generate-random="goRandomGenerator"
          @select-testcase="selectTestCase"
          @start-edit-testcase="startEditTestCase"
          @remove-testcase="removeTestCase"
          @finish-edit-testcase="finishEditTestCase"
          @cancel-edit-testcase="cancelEditTestCase"
        />
      </div>

      <!-- ====== 拖拽手柄 ====== -->
      <div class="resize-handle" @mousedown="startResize">
        <div class="handle-line"></div>
      </div>

      <!-- ====== 右面板：编辑器 + 结果 ====== -->
      <div class="right-panel">
        <!-- 编辑器工具栏 -->
        <div class="editor-toolbar">
          <el-select v-model="selectedLanguage" placeholder="选择语言" size="small" style="width:140px;" @change="onLanguageChange" link type="primary">
            <el-option label="C++" value="cpp" :disabled="isFunctionQuestion" />
            <el-option label="C" value="c" :disabled="isFunctionQuestion" />
            <el-option label="Java" value="java" />
            <el-option label="Python3" value="python" :disabled="isFunctionQuestion" />
            <el-option label="Python2" value="python" :disabled="isFunctionQuestion" />
            <el-option label="Golang" value="go" :disabled="isFunctionQuestion" />
            <el-option label="C#" value="csharp" :disabled="isFunctionQuestion" />
            <el-option label="JavaScript" value="javascript" :disabled="isFunctionQuestion" />
          </el-select>
          <el-tag v-if="isFunctionQuestion" size="small" type="warning" effect="dark">核心函数 · Java</el-tag>
          <el-button size="small" @click="handleSubmit()" :loading="submitting">
            🚀 提交
          </el-button>
          <el-tooltip content="AI 助手" placement="bottom">
            <el-badge :is-dot="aiHasUpdate" class="ai-entry-badge">
              <el-button
                :icon="MagicStick"
                circle
                size="small"
                class="ai-entry-button"
                :class="{ active: aiPanelVisible, flashing: aiFlashing }"
                aria-label="打开 AI 助手"
                @click="toggleAiPanel"
              />
            </el-badge>
          </el-tooltip>
          <el-button size="small" @click="handleDebug">▶️ 调试</el-button>
          <el-button size="small" @click="handleFormat">📐 格式化</el-button>
          <span class="editor-status" :class="{ 'is-typing': isTyping }">
            {{ editorStatus }}
          </span>
        </div>

        <!-- Monaco Editor -->
        <div ref="editorContainer" class="editor-container"></div>

        <!-- ====== 结果区（右侧详情） ====== -->
        <div class="result-wrapper" ref="resultWrapperRef" :style="{ height: resultHeight + 'px' }">
          <div class="result-resize-handle" @mousedown="startResizeResult">
            <div class="result-handle-line"></div>
          </div>
          <QuestionResultContent
            :judge-result="judgeResult"
            :judge-result-class="judgeResultClass"
            :status-text="statusText"
            :judge-progress="judgeProgress"
            :parsed-test-data="parsedTestData"
            :all-test-cases="allTestCases"
            :selected-test-case="selectedTestCase"
            @clear-result="clearResult"
            @copy-text="copyText"
            @clear-selected-testcase="clearSelectedTestCase"
          />
        </div>
      </div>

      <div v-show="aiPanelVisible" class="ai-panel-shell">
        <AiAssistantPanel
          :visible="aiPanelVisible"
          :question-id="questionData?.questionId || getCurrentQuestionId() || ''"
          :get-current-code="getCurrentEditorCode"
          @close="closeAiPanel"
          @advice-ready="handleAiAdviceReady"
        />
      </div>
    </div>

    <el-dialog
      v-model="favoriteDialogVisible"
      title="添加到收藏"
      width="380px"
      class="favorite-dialog"
    >
      <el-select
        v-model="selectedAddFavoriteId"
        class="favorite-select"
        placeholder="选择收藏夹"
        :loading="favoriteOptionsLoading"
        :disabled="favoriteOptionsLoading || addingFavorite"
      >
        <el-option
          v-for="favorite in favoriteOptions"
          :key="favorite.favoritesId"
          :label="favorite.favoritesName"
          :value="favorite.favoritesId"
        />
      </el-select>

      <template #footer>
        <el-button @click="favoriteDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addingFavorite" @click="confirmAddFavorite">
          添加
        </el-button>
      </template>
    </el-dialog>

    <RealtimeAdviceWidget
      v-if="questionData?.questionId || getCurrentQuestionId()"
      :question-id="questionData?.questionId || getCurrentQuestionId() || ''"
    />

  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick } from '@element-plus/icons-vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import { marked } from 'marked'
import websocketService from '@/utils/WebSocket'
import aiApi, { type RealtimeAnalysisChange } from '@/api/aiApi'
import questionApi from '@/api/questionApi'
import userApi from '@/api/userApi'
import reviewApi from '@/api/reviewApi'
import QuestionInfoTabs from '@/components/question-detail/QuestionInfoTabs.vue'
import QuestionResultContent from '@/components/question-detail/QuestionResultContent.vue'
import QuestionTopBar from '@/components/question-detail/QuestionTopBar.vue'
import AiAssistantPanel from '@/components/question-detail/AiAssistantPanel.vue'
import RealtimeAdviceWidget from '@/components/question-detail/RealtimeAdviceWidget.vue'
import type { FavoriteCollection } from '@/types/FavoriteProblem'
import type { DebugTestCase, JudgeResultDTO, JudgeReturnRecordDto, ParsedTestData } from '@/types/QuestionDetail'
import { useUserStore } from '@/stores/User'
import { navigateBack } from '@/utils/navigation'

const AI_PANEL_WIDTH = 390
const AI_PANEL_GAP = 8

const monacoGlobal = self as typeof self & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
monacoGlobal.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

// ====== 路由 ======
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// ====== 数据 ======
const questionData = ref<any>(null)
const isFunctionQuestion = computed(() => questionData.value?.questionType === 'FUNCTION')
const canGenerateRandomTests = computed(() => isFunctionQuestion.value && userStore.isAdmin)
const routeTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
const initialSolutionId = String(
  (Array.isArray(route.query.solutionId) ? route.query.solutionId[0] : route.query.solutionId) || '',
)
const activeTab = ref(routeTab === 'solution' ? 'solution' : 'description')
const selectedLanguage = ref('cpp')
const loading = ref(false)
const isTyping = ref(false)
const editorStatus = ref('就绪')
const submitting = ref(false)
const judgeProgress = ref(0)
const resultHeight = ref(260)
const aiPanelVisible = ref(false)
const aiHasUpdate = ref(false)
const aiFlashing = ref(false)
let aiFlashTimer: number | undefined
const favoriteDialogVisible = ref(false)
const favoriteOptionsLoading = ref(false)
const addingFavorite = ref(false)
const favoriteOptions = ref<FavoriteCollection[]>([])
const selectedAddFavoriteId = ref('')

// ====== 提交记录 ======
const submissionsList = ref<any[]>([])
const submissionsLoading = ref(false)
const submissionsLoaded = ref(false)
const hasSubmittedQuestion = ref(false)
const providingTests = ref(false)

// ====== 代码保存 ======
const SAVE_KEY_PREFIX = 'codewise_code_'
const LEGACY_CODE_LANGUAGES = ['cpp', 'c', 'java', 'python', 'go', 'csharp', 'javascript']
const CODE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000

const getCurrentQuestionId = () => {
  const questionId = route.query.questionId
  return Array.isArray(questionId) ? questionId[0] : questionId
}

const getCurrentUserId = () => String(userStore.userDto?.userId ?? localStorage.getItem('userId') ?? 'guest')

const getCodeSaveKey = (questionId: string, language: string) => {
  return `${SAVE_KEY_PREFIX}${getCurrentUserId()}_${questionId}_${language}`
}

const clearLegacySavedCodes = () => {
  try {
    LEGACY_CODE_LANGUAGES.forEach((language) => {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${language}`)
    })
  } catch (e) { console.warn('清理旧代码缓存失败:', e) }
}

clearLegacySavedCodes()

const saveCode = (language: string, code: string) => {
  const questionId = getCurrentQuestionId()
  if (!questionId) return

  const key = getCodeSaveKey(String(questionId), language)
  const data = {
    code,
    language,
    timestamp: Date.now(),
    questionId: String(questionId),
    userId: getCurrentUserId(),
    questionTitle: questionData.value?.title || ''
  }
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) { console.warn('保存代码失败:', e) }
}

const loadCode = (language: string): string | null => {
  const questionId = getCurrentQuestionId()
  if (!questionId) return null

  const key = getCodeSaveKey(String(questionId), language)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return getDefaultCode(language)

    const data = JSON.parse(raw)
    if (Date.now() - data.timestamp > CODE_EXPIRE_TIME) {
      localStorage.removeItem(key)
      return null
    }
    if (String(data.questionId) !== String(questionId)) return null
    return typeof data.code === 'string' ? data.code : null
  } catch (e) { return null }
}

const onLanguageChange = (lang: string) => {
  if (isFunctionQuestion.value && lang !== 'java') {
    selectedLanguage.value = 'java'
    return
  }
  const savedCode = loadCode(lang)
  if (savedCode && editor) {
    editor.setValue(savedCode)
    ElMessage.success(`已加载 ${lang} 的保存代码`)
  }
}
// ====== 提交代码 ======
const getSubmitScene = (): 'NORMAL' | 'REVIEW' | 'PLAN' => {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  if (from === '/review') return 'REVIEW'
  if (from === '/plan') return 'PLAN'
  return 'NORMAL'
}

const handleSubmit = async () => {
  if (submitting.value) return
  if (!editor) { ElMessage.warning('编辑器未初始化'); return }
  const code = editor.getValue()
  if (!code.trim()) { ElMessage.warning('请先编写代码'); return }

  saveCode(selectedLanguage.value, code)

  const questionId = route.query.questionId
  if (!questionId) { ElMessage.error('缺少题目 ID'); return }

  submitting.value = true
  judgeResult.value = {
    submissionId: 0,
    language: selectedLanguage.value,
    code: code,
    submitStatus: 'PENDING',
    timeUsed: 0,
    memoryUsed: 0
  }
  judgeProgress.value = 0

  try {
    const response = await questionApi.submitCode({
      code: code,
      language: selectedLanguage.value,
      questionId: Number(questionId),
      questionTitle: questionData.value?.title || '',
      submitScene: getSubmitScene(),
    })
    if (response.code === 200) {
      hasSubmittedQuestion.value = true
      ElMessage.success('代码已提交，等待判题...')
      const interval = setInterval(() => {
        if (judgeProgress.value < 90) { judgeProgress.value += 10 } else { clearInterval(interval) }
      }, 300)
    } else {
      ElMessage.error(response.message || '提交失败')
      submitting.value = false
      judgeResult.value = null
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('提交失败，请稍后重试')
    submitting.value = false
    judgeResult.value = null
  }
}

const judgeResult = ref<JudgeResultDTO | null>(null)
const allTestCases = ref<any[]>([])

// ====== 状态映射 ======
const statusMap: Record<string, { text: string; cls: string }> = {
  AC: { text: 'Accepted ✅', cls: 'ac' },
  WA: { text: 'Wrong Answer ❌', cls: 'wa' },
  TLE: { text: 'Time Limit Exceeded ⏰', cls: 'tle' },
  RE: { text: 'Runtime Error 💥', cls: 're' },
  CE: { text: 'Compile Error 🔧', cls: 'ce' },
  OLE: { text: 'Output Limit Exceeded 📤', cls: 'ole' },
  MLE: { text: 'Memory Limit Exceeded 💾', cls: 'mle' },
  PE: { text: 'Presentation Error 📝', cls: 'pe' },
  PENDING: { text: '判题中... ⏳', cls: 'pending' }
}

const statusText = computed(() => {
  if (!judgeResult.value) return ''
  return statusMap[judgeResult.value.submitStatus]?.text || judgeResult.value.submitStatus
})

const judgeResultClass = computed(() => {
  if (!judgeResult.value) return ''
  return statusMap[judgeResult.value.submitStatus]?.cls || ''
})

// ====== 编辑器 ======
const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let formatTimeout: any = null
let saveTimeout: any = null
let realtimeAnalysisIdleTimer: number | undefined
let realtimeAnalysisSending = false
let realtimeAnalysisInitializedQuestionId = ''
let realtimeAnalysisRetryCount = 0
/** 实时分析：服务端代码快照与本地增量不一致（AiErrorCode.CODE_CHANGE_RANGE_INVALID）。 */
const REALTIME_CODE_CHANGE_INVALID = 4000618
/** 实时分析上报的最大重试次数，超过即暂停，避免服务端异常时无限重试刷屏。 */
const REALTIME_MAX_RETRY = 3
const pendingRealtimeChanges: RealtimeAnalysisChange[] = []

const toLocalDateTime = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, -1)
}

const buildRealtimeTask = (changes: RealtimeAnalysisChange[]) => {
  const userId = userStore.userDto?.userId || localStorage.getItem('userId') || ''
  const questionId = getCurrentQuestionId()
  if (!userId || !questionId || !editor) return null

  return {
    rootId: `${String(userId)}:${String(questionId)}`,
    userId: String(userId),
    questionId: Number(questionId),
    code: editor.getValue(),
    changes,
  }
}

const initializeRealtimeAnalysis = async () => {
  const questionId = String(getCurrentQuestionId() || '')
  if (!questionId || realtimeAnalysisInitializedQuestionId === questionId) return
  const payload = buildRealtimeTask([])
  if (!payload) return

  realtimeAnalysisInitializedQuestionId = questionId
  try {
    await aiApi.reportRealtimeAnalysis(payload)
  } catch (error) {
    realtimeAnalysisInitializedQuestionId = ''
    console.warn('初始化实时分析失败:', error)
  }
}

const scheduleRealtimeAnalysis = () => {
  if (realtimeAnalysisIdleTimer) window.clearTimeout(realtimeAnalysisIdleTimer)
  realtimeAnalysisIdleTimer = window.setTimeout(() => {
    realtimeAnalysisIdleTimer = undefined
    void flushRealtimeAnalysis()
  }, 45_000)
}

const flushRealtimeAnalysis = async () => {
  if (realtimeAnalysisSending || pendingRealtimeChanges.length === 0) return
  const batch = pendingRealtimeChanges.splice(0, pendingRealtimeChanges.length)
  const payload = buildRealtimeTask(batch)
  if (!payload) {
    pendingRealtimeChanges.unshift(...batch)
    return
  }

  realtimeAnalysisSending = true
  try {
    await aiApi.reportRealtimeAnalysis(payload)
    realtimeAnalysisRetryCount = 0
  } catch (error) {
    // 服务端保存的是"完整代码快照"，增量按其 offset 应用到快照上（非幂等）。
    // 一旦快照与本地增量不一致（服务端重启/快照过期/上一批已部分生效），这批
    // offset 永远不会被接受：继续塞回队列重发只会无限循环、刷屏并打爆接口。
    if ((error as { bizCode?: number })?.bizCode === REALTIME_CODE_CHANGE_INVALID) {
      pendingRealtimeChanges.length = 0
      realtimeAnalysisRetryCount = 0
      realtimeAnalysisInitializedQuestionId = ''
      void initializeRealtimeAnalysis()
      return
    }
    realtimeAnalysisRetryCount += 1
    if (realtimeAnalysisRetryCount > REALTIME_MAX_RETRY) {
      // 服务端持续不可用：停止重试并丢弃本批，用户下次编辑会重新累计。
      pendingRealtimeChanges.length = 0
      realtimeAnalysisRetryCount = 0
      console.warn('实时分析上报连续失败，已暂停上报')
      return
    }
    pendingRealtimeChanges.unshift(...batch)
    console.warn(`上报实时分析增量失败（第 ${realtimeAnalysisRetryCount} 次），稍后重试`, error)
    scheduleRealtimeAnalysis()
  } finally {
    realtimeAnalysisSending = false
  }
}

const collectRealtimeChanges = (event: monaco.editor.IModelContentChangedEvent) => {
  const createTime = toLocalDateTime()
  event.changes.forEach((change) => {
    pendingRealtimeChanges.push({
      rangeOffset: change.rangeOffset,
      rangeLength: change.rangeLength,
      text: change.text,
      version: event.versionId,
      createTime,
    })
  })
  if (event.changes.length > 0) scheduleRealtimeAnalysis()
}

// ====== 布局 ======
const containerRef = ref<HTMLElement | null>(null)
const leftWidth = ref(0)
const isResizing = ref(false)

const getAiPanelSpace = () =>
  aiPanelVisible.value && window.innerWidth > 1280 ? AI_PANEL_WIDTH + AI_PANEL_GAP : 0

const calculateWidths = () => {
  if (!containerRef.value) return
  const containerWidth = containerRef.value.offsetWidth
  const contentWidth = containerWidth - getAiPanelSpace()
  const minLeftWidth = contentWidth < 900 ? Math.max(220, contentWidth * 0.38) : 300
  const maxLeftWidth = Math.max(minLeftWidth, contentWidth - 360)
  leftWidth.value = Math.min(Math.max(Math.floor(contentWidth * 0.30), minLeftWidth), maxLeftWidth)
}

const resetLayout = () => {
  calculateWidths()
  ElMessage.success('布局已重置')
  nextTick(() => { editor?.layout() })
}

// ====== 计算属性 ======
const difficultyText = computed(() => {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[questionData.value?.difficulty] || '简单'
})

const difficultyTag = computed(() => {
  const map: Record<number, string> = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[questionData.value?.difficulty] || 'success'
})

const passRate = computed(() => {
  const data = questionData.value
  if (!data || data.totalSubmit === 0) return '0.0'
  return ((data.totalAc / data.totalSubmit) * 100).toFixed(1)
})

const sampleCases = computed(() => {
  const data = questionData.value
  if (!data) return []
  if (data.testCases && data.testCases.length > 0) {
    const sample = data.testCases.find((tc: any) => tc.isSample === 1) || data.testCases[0]
    return [{ inputData: sample.inputData, expectedOutput: sample.expectedOutput }]
  }
  if (data.sampleInput && data.sampleOutput) {
    return [{ inputData: data.sampleInput, expectedOutput: data.sampleOutput }]
  }
  return [{ inputData: '（无）', expectedOutput: '（无）' }]
})

// ====== 渲染内容 ======
const renderContent = (content: string) => {
  if (!content) return '（无）'
  const mdPatterns = [
    /^#+\s/m, /\*\*.*\*\*/, /\*.*\*/, /`[^`]+`/, /```[\s\S]*```/,
    /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /\|.*\|/
  ]
  const isMarkdown = mdPatterns.some(pattern => pattern.test(content))
  if (isMarkdown) return marked(content)
  return content.replace(/\n/g, '<br>')
}

// ====== 获取提交记录 ======
const loadSubmissions = async () => {
  if (submissionsLoaded.value) return
  const questionId: any = route.query.questionId
  if (!questionId) return
  submissionsLoading.value = true
  try {
    const response: any = await questionApi.getSubmitRecord(questionId)
    if (response.code === 200) {
      submissionsList.value = response.data || []
      hasSubmittedQuestion.value = submissionsList.value.length > 0
      submissionsLoaded.value = true
    }
  } catch (error) {
    console.error('加载提交记录失败:', error)
  } finally {
    submissionsLoading.value = false
  }
}

const loadCurrentUserRole = () => userStore.ensureRoleId()

const handleTabClick = (tab: any) => {
  if (tab.paneName === 'submissions') {
    loadSubmissions()
  }
}

// ====== 查看代码 ======
const viewCodeInEditor = (row: any) => {
  if (!editor) {
    ElMessage.warning('编辑器未初始化')
    return
  }
  editor.setValue(row.submitContent || '// 暂无代码')
  const languageMap: Record<string, string> = {
    'cpp': 'cpp', 'c': 'c', 'java': 'java', 'python': 'python',
    'python3': 'python', 'python2': 'python', 'go': 'go',
    'csharp': 'csharp', 'javascript': 'javascript'
  }
  const lang = languageMap[row.language?.toLowerCase()] || 'cpp'
  monaco.editor.setModelLanguage(editor.getModel()!, lang)
  enforceTwoSpaceIndentation()
  selectedLanguage.value = row.language?.toLowerCase() || 'cpp'
  ElMessage.success('已加载代码到编辑器')
}

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    'AC': 'success', 'WA': 'danger', 'TLE': 'warning',
    'RE': 'danger', 'CE': 'info', 'PENDING': 'warning'
  }
  return map[status] || 'info'
}

const formatTime = (time: string) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

// ====== 加载题目 ======
const loadQuestion = async () => {
  const questionId: any = route.query.questionId
  if (!questionId) { ElMessage.error('缺少题目 ID'); return }
  loading.value = true
  try {
    const response: any = await questionApi.getQuestionById(questionId)
    if (response.code === 200) {
      questionData.value = response.data
      if (response.data?.questionType === 'FUNCTION') {
        selectedLanguage.value = 'java'
        await Promise.all([loadSubmissions(), loadCurrentUserRole()])
      }
      initDebugCases()
      hasUserModified.value = false  // ✅ 确保标记为 false
      const savedCode = loadCode(selectedLanguage.value)
      if (savedCode) {
        setTimeout(() => { if (editor) editor.setValue(savedCode) }, 500)
      }
    } else {
      ElMessage.error(response.message || '加载失败')
    }
  } catch (error: any) {
    console.error('加载失败:', error)
    ElMessage.error('加载失败，请稍后重试')
  } finally { loading.value = false }
}
const enforceTwoSpaceIndentation = () => {
  editor?.getModel()?.updateOptions({
    tabSize: 2,
    indentSize: 2,
    insertSpaces: true,
    trimAutoWhitespace: true,
  })
}

// ====== 初始化 Monaco Editor ======
const initEditor = () => {
  if (!editorContainer.value) return
  const languageMap: Record<string, string> = {
    cpp: 'cpp', c: 'c', java: 'java', python: 'python',
    go: 'go', csharp: 'csharp', javascript: 'javascript'
  }
  const savedCode = loadCode(selectedLanguage.value) || getDefaultCode(selectedLanguage.value)

  editor = monaco.editor.create(editorContainer.value, {
    value: savedCode,
    language: languageMap[selectedLanguage.value] || 'cpp',
    theme: 'vs',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    detectIndentation: false,
    tabSize: 2,
    insertSpaces: true,
    bracketPairColorization: { enabled: true }
  })

  editor.onDidChangeModelContent((event) => {
    collectRealtimeChanges(event)
    isTyping.value = true
    editorStatus.value = '编辑中...'
    clearTimeout(formatTimeout)
    clearTimeout(saveTimeout)
    formatTimeout = setTimeout(() => {
      isTyping.value = false
      editorStatus.value = '已保存'
    }, 2000)
    saveTimeout = setTimeout(() => {
      const code = editor?.getValue()
      if (code) saveCode(selectedLanguage.value, code)
    }, 3000)
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => { handleSubmit() })
  void initializeRealtimeAnalysis()
  editorStatus.value = '就绪'
}

const getDefaultCode = (lang: string): string => {
  if (isFunctionQuestion.value) return getFunctionJavaStarter()
  const templates: Record<string, string> = {
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n  // 请在这里编写代码\n  cout << "Hello, World!" << endl;\n  return 0;\n}`,
    c: `#include <stdio.h>\n\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}`,
    java: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}`,
    python: `# 请在这里编写代码\nprint("Hello, World!")`,
    go: `package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}`,
    csharp: `using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}`,
    javascript: `// 请在这里编写代码\nconsole.log("Hello, World!");`
  }
  return templates[lang] || templates.cpp
}

const getFunctionJavaStarter = () => {
  const config = questionData.value?.functionConfig || {}
  const className = String(config.className || 'Solution')
  const methodName = String(config.methodName || 'solve')
  const outputType = String(config.outputType || 'void')
  const parameters = parseFunctionParameters(config.parameterConfig)
    .map((parameter) => `${parameter.type} ${parameter.name}`)
    .join(', ')

  const returnHint = outputType === 'void'
    ? '    // 请在这里实现核心函数'
    : `    // 请在这里实现核心函数\n    return ${getJavaDefaultValue(outputType)};`

  return `import java.util.*;\n\npublic class ${className} {\n  public ${outputType} ${methodName}(${parameters}) {\n${returnHint}\n  }\n}`
}

const parseFunctionParameters = (raw: unknown): Array<{ type: string; name: string }> => {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(value)) return []
    return value
      .map((item) => ({ type: String(item?.type || ''), name: String(item?.name || '') }))
      .filter((item) => item.type && item.name)
  } catch {
    return []
  }
}

const getJavaDefaultValue = (type: string) => {
  if (type === 'boolean') return 'false'
  if (['byte', 'short', 'int', 'long', 'float', 'double'].includes(type)) return '0'
  if (type === 'char') return "'\\0'"
  return 'null'
}

watch(selectedLanguage, (newLang:any) => {
  if (isFunctionQuestion.value && newLang !== 'java') {
    selectedLanguage.value = 'java'
    return
  }
  if (editor) {
    const languageMap: Record<string, string> = {
      cpp: 'cpp', c: 'c', java: 'java', python: 'python',
      go: 'go', csharp: 'csharp', javascript: 'javascript'
    }
    const savedCode = loadCode(newLang)
    if (savedCode) {
      editor.setValue(savedCode)
    } else {
      const currentValue = editor.getValue()
      if (!currentValue.trim() || currentValue.trim() === getDefaultCode('cpp').trim()) {
        editor.setValue(getDefaultCode(newLang))
      }
    }
    monaco.editor.setModelLanguage(editor.getModel()!, languageMap[newLang] || 'cpp')
    enforceTwoSpaceIndentation()
  }
})

// ====== 解析错误信息 ======
const parseErrorMsg = (errorMsg: string) => {
  if (!errorMsg) return { input: '', expected: '', actual: '' }
  const inputMatch = errorMsg.match(/输入:\s*([\s\S]*?)\s*输出:/)
  const outputMatch = errorMsg.match(/输出:\s*([\s\S]*?)\s*预期:/)
  const expectedMatch = errorMsg.match(/预期:\s*([\s\S]*?)$/)
  return {
    input: inputMatch ? inputMatch[1].trim() : '',
    expected: expectedMatch ? expectedMatch[1].trim() : '',
    actual: outputMatch ? outputMatch[1].trim() : ''
  }
}

const parsedTestData = computed<ParsedTestData>(() => {
  const result = judgeResult.value
  if (!result) return { input: '', expected: '', actual: '' }
  const fallback = parseErrorMsg(result.error || '')
  return {
    input: result.inputData ?? fallback.input,
    expected: result.expectedOutput ?? fallback.expected,
    actual: result.actual ?? result.userOutput ?? fallback.actual,
  }
})
// ====== 调试相关 ======
const hasUserModified = ref(false)  // ✅ 新增：标记用户是否手动修改过用例
// ====== WebSocket ======
let stopJudgeListener: (() => void) | undefined
let stopDebugJudgeListener: (() => void) | undefined

const setupJudgeSubscriptions = () => {
  stopJudgeListener?.()
  stopDebugJudgeListener?.()
  websocketService.unsubscribe('judge-result')
  websocketService.unsubscribe('debug-judge-result')
  const userId = getCurrentUserId()
  if (!userId || userId === 'guest') return

  websocketService.subscribe('judge-result', `/queue/judge-result-${userId}`)
  websocketService.subscribe('debug-judge-result', `/queue/debug-judge-result-${userId}`)

  stopJudgeListener = websocketService.on('judge-result', (data: any) => {
    console.log('📩 收到判题结果:', data)
    if (data?.userId != null && String(data.userId) !== userId) return
    const result = data?.result ?? data
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || typeof result.submitStatus !== 'string' || !result.submitStatus) return
    judgeResult.value = result
    judgeProgress.value = 100
    const status = result.submitStatus
    if (status && status !== 'AC' && status !== 'PENDING') {
      ElMessage.error(`❌ ${statusMap[status]?.text || status}`)
    }
    submitting.value = false
  })
  enforceTwoSpaceIndentation()

  stopDebugJudgeListener = websocketService.on('debug-judge-result', (message: any) => {
    console.log('📩 收到调试结果:', message)
    if (!debugging.value || (message?.userId != null && String(message.userId) !== userId)) return
    const results = Array.isArray(message?.result)
      ? message.result
      : Array.isArray(message?.results)
        ? message.results
        : null
    if (!results?.length || !results.every((result: unknown) => {
      if (!result || typeof result !== 'object' || Array.isArray(result)) return false
      const record = result as JudgeReturnRecordDto
      return typeof record.submitStatus === 'string' && Boolean(record.submitStatus)
        && (record.userId == null || String(record.userId) === userId)
        && (record.userOutput == null || typeof record.userOutput === 'string')
    })) {
      console.warn('忽略格式异常的调试结果消息')
      return
    }

    debugTestCases.value.forEach((tc: any, index: number) => {
      const result = results[index]
      if (result) {
        tc.result = result
        tc.passed = tc.expectedOutput?.trim()
          ? result.submitStatus === 'AC' && tc.expectedOutput.trim() === result.userOutput?.trim()
          : null
      }
    })

    const firstResultIndex = debugTestCases.value.findIndex((tc: any) => tc.result)
    if (firstResultIndex !== -1) selectedTestCaseIndex.value = firstResultIndex
    debugging.value = false
  })
}

const getCurrentEditorCode = () => editor?.getValue() || ''

const toggleAiPanel = () => {
  aiPanelVisible.value = !aiPanelVisible.value
  if (aiPanelVisible.value) aiHasUpdate.value = false
  nextTick(() => {
    calculateWidths()
    editor?.layout()
  })
}

const closeAiPanel = () => {
  aiPanelVisible.value = false
  nextTick(() => {
    calculateWidths()
    editor?.layout()
  })
}

const handleAiAdviceReady = () => {
  if (!aiPanelVisible.value) aiHasUpdate.value = true
  aiFlashing.value = false
  requestAnimationFrame(() => {
    aiFlashing.value = true
  })
  if (aiFlashTimer) window.clearTimeout(aiFlashTimer)
  aiFlashTimer = window.setTimeout(() => {
    aiFlashing.value = false
  }, 1900)
}

const handleFormat = () => {
  if (!editor) { ElMessage.warning('编辑器未初始化'); return }
  try {
    const model = editor.getModel()
    if (!model) return
    const value = model.getValue()
    const formatted = value.split('\n').map((line: any) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n')
    if (formatted !== value) { model.setValue(formatted); ElMessage.success('格式化完成 ✅') } else { ElMessage.info('代码已是格式化的') }
  } catch (error) { console.error('格式化失败:', error); ElMessage.error('格式化失败') }
}

// 运行：复用调试通道快速执行当前代码。未手动改动过用例时先重置为题目样例输入，
// 结果仍经 WebSocket /queue/debug-judge-result-{userId} 回填到调试用例区。
const handleRun = () => {
  if (!editor) { ElMessage.warning('编辑器未初始化'); return }
  if (!hasUserModified.value) initDebugCases()
  handleDebug()
}

const clearResult = () => {
  judgeResult.value = null
  allTestCases.value = []
  judgeProgress.value = 0
}

const goBack = () => {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  if (from === '/favorites') {
    const favoriteId = Array.isArray(route.query.favoriteId) ? route.query.favoriteId[0] : route.query.favoriteId
    navigateBack(router, {
      path: '/favorites',
      query: favoriteId ? { favoriteId } : undefined,
    })
    return
  }
  navigateBack(
    router,
    from === '/review' || from === '/profile' || from === '/inbox' ? from : '/home',
  )
}

// ====== 复制文本 ======
const copyText = (text: any) => {
  if (!text) { ElMessage.warning('没有内容可复制'); return }
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('✅ 已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('✅ 已复制到剪贴板')
    } catch (e) {
      ElMessage.error('复制失败，请手动复制')
    }
    document.body.removeChild(textarea)
  })
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

const getRequestId = async () => {
  const requestIdRes: any = await reviewApi.getCreateRequestId()
  return typeof requestIdRes === 'string' ? requestIdRes : requestIdRes?.data
}

const loadFavoriteOptions = async () => {
  favoriteOptionsLoading.value = true
  try {
    const listRes: any = await reviewApi.listFavorites()
    favoriteOptions.value = (listRes.data || []).map(mapFavorite)

    if (favoriteOptions.value.length === 0) {
      const requestId = await getRequestId()
      if (!requestId) {
        ElMessage.error('创建请求 ID 获取失败')
        return
      }
      await reviewApi.createFavorite('我的收藏', requestId)
      const refreshedRes: any = await reviewApi.listFavorites()
      favoriteOptions.value = (refreshedRes.data || []).map(mapFavorite)
    }

    const routeFavoriteId = Array.isArray(route.query.favoriteId) ? route.query.favoriteId[0] : route.query.favoriteId
    const matchedRouteFavorite = routeFavoriteId
      ? favoriteOptions.value.find((item: any) => item.favoritesId === String(routeFavoriteId))
      : undefined
    selectedAddFavoriteId.value = matchedRouteFavorite?.favoritesId || favoriteOptions.value[0]?.favoritesId || ''
  } finally {
    favoriteOptionsLoading.value = false
  }
}

const handleFavoriteQuestion = async () => {
  const questionId = Array.isArray(route.query.questionId) ? route.query.questionId[0] : route.query.questionId
  if (!questionId) {
    ElMessage.warning('缺少题目 ID')
    return
  }

  favoriteDialogVisible.value = true
  await loadFavoriteOptions()
}

const confirmAddFavorite = async () => {
  const questionId = Array.isArray(route.query.questionId) ? route.query.questionId[0] : route.query.questionId
  if (!questionId) {
    ElMessage.warning('缺少题目 ID')
    return
  }

  if (!selectedAddFavoriteId.value) {
    ElMessage.warning('请选择收藏夹')
    return
  }

  addingFavorite.value = true
  try {
    await reviewApi.addQuestion(String(questionId), selectedAddFavoriteId.value)
    ElMessage.success('已加入收藏夹')
    favoriteDialogVisible.value = false
  } catch (error) {
    console.error('收藏题目失败:', error)
  } finally {
    addingFavorite.value = false
  }
}
//=======添加题目到复习计划=======
const addQuestionToReview = async () => {
  const questionId = Array.isArray(route.query.questionId) ? route.query.questionId[0] : route.query.questionId
  if (!questionId) {
    ElMessage.warning('缺少题目 ID')
    return
  }
  
  try {
    const res: any = await reviewApi.addQuestionToReview(questionId)
    if(res.code==200){
      ElMessage.success('已加入复习计划')
    }else{
      ElMessage.error(res.msg || '加入复习计划失败')
    }
  } catch (error) {
    console.error('加入复习计划失败:', error)
  }
}
// ====== 拖拽调整左右面板 ======
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !containerRef.value) return
  const containerWidth = containerRef.value.offsetWidth
  const rect = containerRef.value.getBoundingClientRect()
  const relativeX = e.clientX - rect.left
  const availableWidth = containerWidth - getAiPanelSpace()
  const minWidth = availableWidth < 900 ? 220 : 300
  const maxWidth = Math.max(minWidth, availableWidth - 360)
  const newLeft = Math.max(minWidth, Math.min(relativeX, maxWidth))
  leftWidth.value = newLeft
  nextTick(() => { editor?.layout() })
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ====== 结果区拖拽调整高度 ======
const resultWrapperRef = ref<HTMLElement | null>(null)
const isResizingResult = ref(false)

const startResizeResult = (e: MouseEvent) => {
  isResizingResult.value = true
  document.addEventListener('mousemove', onResizeResult)
  document.addEventListener('mouseup', stopResizeResult)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

const onResizeResult = (e: MouseEvent) => {
  if (!isResizingResult.value || !resultWrapperRef.value) return
  const rect = resultWrapperRef.value.getBoundingClientRect()
  const containerRect = document.querySelector('.right-panel')?.getBoundingClientRect()
  if (!containerRect) return
  const newHeight = containerRect.bottom - e.clientY - 10
  const minHeight = 150
  const maxHeight = containerRect.height * 0.6
  if (newHeight > minHeight && newHeight < maxHeight) {
    resultHeight.value = newHeight
    resultWrapperRef.value.style.height = newHeight + 'px'
    nextTick(() => { editor?.layout() })
  }
}

const stopResizeResult = () => {
  isResizingResult.value = false
  document.removeEventListener('mousemove', onResizeResult)
  document.removeEventListener('mouseup', stopResizeResult)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ====== 调试相关 ======
const debugTestCases = ref<DebugTestCase[]>([])
const debugging = ref(false)
const selectedTestCaseIndex = ref<number | null>(null)
const editingTestCaseIndex = ref<number | null>(null)  // ✅ 正在编辑的用例索引


// ====== 编辑模式 ======
// 开始编辑
const startEditTestCase = (index: number) => {
  editingTestCaseIndex.value = index
}

// 完成编辑
const finishEditTestCase = () => {
  const editingCase = editingTestCaseIndex.value === null
    ? null
    : debugTestCases.value[editingTestCaseIndex.value]
  if (editingCase) editingCase.provided = false
  editingTestCaseIndex.value = null
  hasUserModified.value = true
  ElMessage.success('用例已更新')
}

// 取消编辑
const cancelEditTestCase = () => {
  // 如果用户没有修改过，恢复原来的值
  // 由于 v-model 已经双向绑定，取消时只需要退出编辑模式
  editingTestCaseIndex.value = null
}

// 选择用例（查看结果）
const selectTestCase = (index: number) => {
  // 如果正在编辑，不切换
  if (editingTestCaseIndex.value !== null) return

  selectedTestCaseIndex.value = index
}
// 选中的测试用例（计算属性）
const selectedTestCase = computed(() => {
  if (selectedTestCaseIndex.value === null) return null
  return debugTestCases.value[selectedTestCaseIndex.value] || null
})


// 从题目样例初始化
const initDebugCases = () => {
  const samples = sampleCases.value
  if (samples.length > 0 && samples[0].inputData !== '（无）') {
    debugTestCases.value = samples.map(s => ({
      input: s.inputData,
      expectedOutput: s.expectedOutput,
      result: null,
      passed: null,
      isSample: true,
      provided: false,
    }))
  } else {
    debugTestCases.value = [{ input: '', expectedOutput: '', result: null, passed: null, isSample: false, provided: false }]
  }
  selectedTestCaseIndex.value = null
  hasUserModified.value = false  // ✅ 重置标记
}


// 清空选中的用例
const clearSelectedTestCase = () => {
  selectedTestCaseIndex.value = null
}

// 添加用例
const addTestCase = () => {
  debugTestCases.value.push({
    input: '',
    expectedOutput: '',
    result: null,
    passed: null,
    isSample: false,
    provided: false,
  })
  selectedTestCaseIndex.value = debugTestCases.value.length - 1
  hasUserModified.value = true  // ✅ 标记用户已修改
}

// 删除用例
const removeTestCase = (index: number) => {
  if (debugTestCases.value.length <= 1) {
    ElMessage.warning('至少保留一个用例')
    return
  }
  debugTestCases.value.splice(index, 1)
  hasUserModified.value = true  // ✅ 标记用户已修改
  if (selectedTestCaseIndex.value === index) {
    selectedTestCaseIndex.value = null
  } else if (selectedTestCaseIndex.value !== null && selectedTestCaseIndex.value > index) {
    selectedTestCaseIndex.value--
  }
}
// 重置为样例
// 重置为样例
const resetToSample = () => {
  initDebugCases()
  hasUserModified.value = false  // ✅ 重置标记
  ElMessage.success('已重置为题目样例')
}
// ====== 监听 sampleCases 变化，自动更新调试用例 ======
watch(sampleCases, (newSamples) => {
  // 如果用户没有手动修改过用例，自动更新
  if (!hasUserModified.value && newSamples.length > 0 && newSamples[0].inputData !== '（无）') {
    initDebugCases()
  }
}, { deep: true })
// ====== 调试运行 ======
const handleDebug = async () => {
  if (debugging.value) return
  // 1. 检查用例输入
  const emptyCases = debugTestCases.value.some(tc => !tc.input.trim())
  if (emptyCases) {
    ElMessage.warning('请填写所有用例的输入')
    return
  }

  // 2. 检查编辑器
  if (!editor) {
    ElMessage.warning('编辑器未初始化')
    return
  }
  const code = editor.getValue()
  if (!code.trim()) {
    ElMessage.warning('请先编写代码')
    return
  }

  // 3. 保存用户修改标记，清空旧结果
  const wasUserModified = hasUserModified.value
  debugTestCases.value.forEach(tc => {
    tc.result = null
    tc.passed = null
  })
  selectedTestCaseIndex.value = null
  debugging.value = true

  try {
    // 4. 发送调试请求
    const response = await questionApi.debug({
      userId: getCurrentUserId(),
      code: code,
      language: selectedLanguage.value,
      questionId: Number(route.query.questionId),
      tests: debugTestCases.value.map(tc => ({
        input: tc.input,
        output: tc.expectedOutput || '',
      }))
    })

    if (response.code === 200) {
      ElMessage.success('提交成功，请稍候，请勿刷新页面')
    } else {
      debugging.value = false
      ElMessage.error(response.message || '调试失败')
    }
  } catch (error) {
    debugging.value = false
    console.error('调试失败:', error)
    ElMessage.error('调试请求失败')
  } finally {
    hasUserModified.value = wasUserModified
  }
}

const provideFunctionTests = async () => {
  if (!isFunctionQuestion.value || !userStore.isAdmin || !hasSubmittedQuestion.value || providingTests.value) return
  const customCases = debugTestCases.value.filter((testCase) => !testCase.isSample && !testCase.provided)
  if (!customCases.length) {
    ElMessage.info('请先添加一个自定义测试用例')
    return
  }
  const incompleteIndex = customCases.findIndex(
    (testCase) => !testCase.input.trim() || !testCase.expectedOutput.trim(),
  )
  if (incompleteIndex >= 0) {
    ElMessage.warning(`请补全第 ${incompleteIndex + 1} 个自定义用例的输入和预期输出`)
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认提供 ${customCases.length} 个测试用例？提交后将用于这道题的判题。`,
      '提供测试',
      { confirmButtonText: '确认提供', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  providingTests.value = true
  try {
    const response: any = await questionApi.addFunctionTestCases(
      Number(getCurrentQuestionId()),
      customCases.map((testCase) => ({
        input: testCase.input.trim(),
        output: testCase.expectedOutput.trim(),
      })),
    )
    customCases.forEach((testCase) => { testCase.provided = true })
    ElMessage.success(`已提供 ${Number(response?.data ?? customCases.length)} 个测试用例`)
  } catch (error) {
    console.error('提供核心函数测试用例失败:', error)
  } finally {
    providingTests.value = false
  }
}

const goRandomGenerator = () => {
  if (!canGenerateRandomTests.value) return
  router.push({
    path: '/questions/function-test-generator',
    query: { questionId: getCurrentQuestionId() },
  })
}

// ====== 生命周期 ======
let resizeFrame: number | undefined
const handleWindowResize = () => {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
  resizeFrame = window.requestAnimationFrame(() => {
    calculateWidths()
    editor?.layout()
  })
}

watch(() => userStore.userDto?.userId, setupJudgeSubscriptions)

onMounted(async () => {
  setupJudgeSubscriptions()
  await loadQuestion()
  nextTick(() => { calculateWidths(); initEditor() })
  window.addEventListener('resize', handleWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
  stopResize()
  stopResizeResult()
  if (editor) {
    const code = editor.getValue()
    if (code) saveCode(selectedLanguage.value, code)
    editor.dispose()
    editor = null
  }
  stopJudgeListener?.()
  stopDebugJudgeListener?.()
  websocketService.unsubscribe('judge-result')
  websocketService.unsubscribe('debug-judge-result')
  clearTimeout(formatTimeout)
  clearTimeout(saveTimeout)
  if (realtimeAnalysisIdleTimer) window.clearTimeout(realtimeAnalysisIdleTimer)
  pendingRealtimeChanges.length = 0
  if (aiFlashTimer) window.clearTimeout(aiFlashTimer)
})
</script>

<style scoped>
.question-detail {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--cw-bg-page);
  overflow: hidden;
}

.main-container {
  flex: 1;
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

.left-panel {
  flex: 0 0 auto;
  min-width: 0;
  background: #fff;
  padding: 0 28px 12px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.left-panel::-webkit-scrollbar {
  width: 6px;
}

.left-panel::-webkit-scrollbar-thumb {
  background: var(--cw-border);
  border-radius: 3px;
}

.right-panel {
  flex: 1 1 0;
  min-width: 0;
  background: #ffffff;
  flex-direction: column;
  display: flex;
  overflow: hidden;
  height: 100%;
  margin-right: 0;
  border-radius: 0 0 8px 0;
}

.right-panel::-webkit-scrollbar {
  width: 4px;
}

.right-panel::-webkit-scrollbar-thumb {
  background: var(--cw-border);
  border-radius: 2px;
}

.resize-handle {
  width: 6px;
  flex-shrink: 0;
  background: var(--cw-border);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.resize-handle:hover {
  background: var(--cw-brand);
}

.handle-line {
  width: 2px;
  height: 40px;
  background: var(--cw-text-faint);
  border-radius: 2px;
  transition: background 0.2s;
}

.resize-handle:hover .handle-line {
  background: #fff;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #ffffff;
  border-bottom: 1px solid var(--cw-border);
  flex-shrink: 0;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.editor-toolbar::-webkit-scrollbar {
  display: none;
}

.ai-entry-badge {
  display: inline-flex;
  flex: 0 0 auto;
}

.ai-entry-badge :deep(.el-badge__content.is-dot) {
  top: 3px;
  right: 5px;
  border: 1px solid #ffffff;
  background: #8b73ef;
}

.ai-entry-button {
  color: #9b87f5;
}

.ai-entry-button:hover,
.ai-entry-button.active {
  border-color: var(--cw-accent-ai);
  background: #f1effd;
  color: var(--cw-accent-ai);
}

.ai-entry-button.flashing {
  animation: ai-button-flash 0.95s ease-in-out 2;
}

@keyframes ai-button-flash {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(114, 87, 232, 0);
    transform: scale(1);
  }

  20%, 60% {
    box-shadow: 0 0 0 5px rgba(114, 87, 232, 0.24);
    transform: scale(1.08);
  }
}

.ai-panel-shell {
  width: 390px;
  min-width: 390px;
  height: 100%;
  margin-left: 8px;
  flex: 0 0 auto;
  overflow: hidden;
}

.editor-status {
  margin-left: auto;
  font-size: 12px;
  color: #7b828c;
  transition: color 0.3s;
}

.editor-status.is-typing {
  color: var(--cw-brand);
}

.editor-container {
  flex: 1;
  min-height: 100px;
  background: #ffffff;
}

.favorite-select {
  width: 100%;
}

.result-wrapper {
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid var(--cw-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 180px;
  max-height: 60%;
  height: 300px;
  width: 100%;
}

.result-resize-handle {
  height: 8px;
  background: var(--cw-border);
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
  position: relative;
  z-index: 10;
}

.result-resize-handle:hover {
  background: var(--cw-brand);
}

.result-handle-line {
  width: 40px;
  height: 3px;
  background: var(--cw-text-faint);
  border-radius: 2px;
  transition: background 0.2s;
}

.result-resize-handle:hover .result-handle-line {
  background: #fff;
}

@media (max-width: 1280px) {
  .ai-panel-shell {
    position: absolute;
    z-index: 30;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(390px, calc(100% - 16px));
    min-width: 0;
    height: 100%;
    margin-left: 0;
    box-shadow: -10px 0 28px rgba(18, 20, 24, 0.16);
  }
}

@media (max-width: 760px) {
  .left-panel {
    padding-right: 16px;
    padding-left: 16px;
  }

  .resize-handle {
    width: 4px;
  }

  .editor-toolbar {
    gap: 6px;
    padding-right: 8px;
    padding-left: 8px;
  }

  .editor-status {
    display: none;
  }

  .ai-panel-shell {
    width: 100%;
  }
}
</style>
