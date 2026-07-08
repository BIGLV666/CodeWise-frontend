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
          @tab-click="handleTabClick"
          @view-code="viewCodeInEditor"
          @add-testcase="addTestCase"
          @reset-to-sample="resetToSample"
          @debug="handleDebug"
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
      <div class="right-panel" :style="{ width: rightWidth + 'px' }">
        <!-- 编辑器工具栏 -->
        <div class="editor-toolbar">
          <el-select v-model="selectedLanguage" placeholder="选择语言" size="small" style="width:140px;" @change="onLanguageChange" link type="primary">
            <el-option label="C++" value="cpp" />
            <el-option label="C" value="c" />
            <el-option label="Java" value="java" />
            <el-option label="Python3" value="python" />
            <el-option label="Python2" value="python" />
            <el-option label="Golang" value="go" />
            <el-option label="C#" value="csharp" />
            <el-option label="JavaScript" value="javascript" />
          </el-select>
          <el-button size="small" @click="handleSubmit()" :loading="submitting">
            🚀 提交
          </el-button>
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
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as monaco from 'monaco-editor'
import { marked } from 'marked'
import websocketService from '@/utils/WebSocket'
import questionApi from '@/api/questionApi'
import reviewApi from '@/api/reviewApi'
import QuestionInfoTabs from '@/components/question-detail/QuestionInfoTabs.vue'
import QuestionResultContent from '@/components/question-detail/QuestionResultContent.vue'
import QuestionTopBar from '@/components/question-detail/QuestionTopBar.vue'
import type { FavoriteCollection } from '@/types/FavoriteProblem'
import type { DebugTestCase, JudgeResultDTO, JudgeReturnRecordDto, ParsedTestData } from '@/types/QuestionDetail'

const MARGIN_RIGHT = 70

// ====== 路由 ======
const route = useRoute()
const router = useRouter()

// ====== 数据 ======
const questionData = ref<any>(null)
const activeTab = ref('description')
const selectedLanguage = ref('cpp')
const loading = ref(false)
const isTyping = ref(false)
const editorStatus = ref('就绪')
const submitting = ref(false)
const judgeProgress = ref(0)
const resultHeight = ref(260)
const favoriteDialogVisible = ref(false)
const favoriteOptionsLoading = ref(false)
const addingFavorite = ref(false)
const favoriteOptions = ref<FavoriteCollection[]>([])
const selectedAddFavoriteId = ref('')

// ====== 提交记录 ======
const submissionsList = ref<any[]>([])
const submissionsLoading = ref(false)
const submissionsLoaded = ref(false)

// ====== 代码保存 ======
const SAVE_KEY_PREFIX = 'codewise_code_'
const LEGACY_CODE_LANGUAGES = ['cpp', 'c', 'java', 'python', 'go', 'csharp', 'javascript']
const CODE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000

const getCurrentQuestionId = () => {
  const questionId = route.query.questionId
  return Array.isArray(questionId) ? questionId[0] : questionId
}

const getCurrentUserId = () => localStorage.getItem('userId') || 'guest'

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
  const savedCode = loadCode(lang)
  if (savedCode && editor) {
    editor.setValue(savedCode)
    ElMessage.success(`已加载 ${lang} 的保存代码`)
  }
}
// ====== 提交代码 ======
const getSubmitScene = () => {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  return from === '/review' ? 'REVIEW' : undefined
}

const handleSubmit = async () => {
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
    const response: any = await questionApi.submitCode({
      code: code,
      language: selectedLanguage.value,
      questionId: Number(questionId),
      questionTitle: questionData.value?.title || '',
      submitScene: getSubmitScene(),
    })
    if (response.code === 200) {
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
    ElMessage.error('提交失败，请检查网络')
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

// ====== 布局 ======
const containerRef = ref<HTMLElement | null>(null)
const leftWidth = ref(0)
const rightWidth = ref(0)
const isResizing = ref(false)

const calculateWidths = () => {
  if (!containerRef.value) return
  const containerWidth = containerRef.value.offsetWidth
  leftWidth.value = Math.floor(containerWidth * 0.30)
  rightWidth.value = Math.floor(containerWidth * 0.70) - 6 - MARGIN_RIGHT
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
      submissionsLoaded.value = true
    }
  } catch (error) {
    console.error('加载提交记录失败:', error)
  } finally {
    submissionsLoading.value = false
  }
}

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
    ElMessage.error('加载失败，请检查网络')
  } finally { loading.value = false }
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
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    tabSize: 4,
    insertSpaces: true,
    bracketPairColorization: { enabled: true }
  })

  editor.onDidChangeModelContent(() => {
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
  console.log('✅ Monaco Editor 初始化成功')
  editorStatus.value = '就绪'
}

const getDefaultCode = (lang: string): string => {
  const templates: Record<string, string> = {
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // 请在这里编写代码\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
    java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    python: `# 请在这里编写代码\nprint("Hello, World!")`,
    go: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    csharp: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}`,
    javascript: `// 请在这里编写代码\nconsole.log("Hello, World!");`
  }
  return templates[lang] || templates.cpp
}

watch(selectedLanguage, (newLang:any) => {
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
  if (!judgeResult.value) return { input: '', expected: '', actual: '' }
  if (judgeResult.value.inputData) {
    return {
      input: judgeResult.value.inputData,
      expected: judgeResult.value.expectedOutput || '',
      actual: judgeResult.value.userOutput || ''
    }
  }
  return parseErrorMsg(judgeResult.value.error || '')
})
// ====== 调试相关 ======
const hasUserModified = ref(false)  // ✅ 新增：标记用户是否手动修改过用例
// ====== WebSocket ======
// QuestionDetailView.vue - setupWebSocket
const setupWebSocket = async () => {
  try {
    const token: any = localStorage.getItem('token')
    const userId: any = localStorage.getItem('userId')
    if (!token || !userId) {
      console.warn('⚠️ 未登录，跳过 WebSocket 连接')
      return
    }

    // ✅ 使用 ws:// 协议
    const wsUrl = `ws://localhost:8084/websocket?token=${token}`
    console.log('📡 准备连接 WebSocket:', wsUrl)

    // ✅ 等待连接完成
    await websocketService.connect(wsUrl, token)
    console.log('✅ WebSocket 已连接')

    // ✅ 订阅判题结果
    websocketService.clearListeners('judge-result')
    websocketService.clearListeners('debug-judge-result')

    websocketService.on('judge-result', (data: JudgeResultDTO) => {
      console.log('📩 收到判题结果:', data)
      judgeResult.value = data
      judgeProgress.value = 100
      if (data.submitStatus === 'AC') {

      } else if (data.submitStatus === 'PENDING') {

      } else {
        ElMessage.error(`❌ ${statusMap[data.submitStatus]?.text || data.submitStatus}`)
      }
      submitting.value = false
    })

    // ✅ 订阅调试结果
    websocketService.on('debug-judge-result', (results: JudgeReturnRecordDto[]) => {
      console.log('📩 收到调试结果:', results)

      debugTestCases.value.forEach((tc, index) => {
        if (index < results.length) {
          tc.result = results[index]
          tc.passed = tc.expectedOutput?.trim() === results[index].userOutput?.trim()
        }
      })

      const firstResultIndex = debugTestCases.value.findIndex(tc => tc.result)
      if (firstResultIndex !== -1) {
        selectedTestCaseIndex.value = firstResultIndex
      }
      debugging.value = false

    })

  } catch (error) {
    console.error('❌ WebSocket 连接失败:', error)
    // 3秒后重试
    setTimeout(() => {
      console.log('🔄 重试 WebSocket 连接...')
      setupWebSocket()
    }, 3000)
  }
}

const handleFormat = () => {
  if (!editor) { ElMessage.warning('编辑器未初始化'); return }
  try {
    const model = editor.getModel()
    if (!model) return
    const value = model.getValue()
    const formatted = value.split('\n').map(line => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n')
    if (formatted !== value) { model.setValue(formatted); ElMessage.success('格式化完成 ✅') } else { ElMessage.info('代码已是格式化的') }
  } catch (error) { console.error('格式化失败:', error); ElMessage.error('格式化失败') }
}

const handleRun = () => { ElMessage.info('运行功能开发中...') }

const clearResult = () => {
  judgeResult.value = null
  allTestCases.value = []
  judgeProgress.value = 0
}

const goBack = () => {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  if (from === '/favorites') {
    const favoriteId = Array.isArray(route.query.favoriteId) ? route.query.favoriteId[0] : route.query.favoriteId
    router.push({
      path: '/favorites',
      query: favoriteId ? { favoriteId } : undefined,
    })
    return
  }
  router.back()
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
      ? favoriteOptions.value.find((item) => item.favoritesId === String(routeFavoriteId))
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
  const minWidth = 300
  const maxWidth = containerWidth - 300 - MARGIN_RIGHT
  const newLeft = Math.max(minWidth, Math.min(relativeX, maxWidth))
  leftWidth.value = newLeft
  rightWidth.value = containerWidth - newLeft - 6 - MARGIN_RIGHT
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
  if (!debugTestCases.value[index].result) {
    ElMessage.info('该用例尚未运行，请点击「调试运行」')
  }
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
      passed: null
    }))
  } else {
    debugTestCases.value = [{ input: '', expectedOutput: '', result: null, passed: null }]
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
  debugTestCases.value.push({ input: '', expectedOutput: '', result: null, passed: null })
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
    const response: any = await questionApi.debug({
      userId: localStorage.getItem('userId') || '',
      code: code,
      language: selectedLanguage.value,
      questionId: Number(route.query.questionId),
      tests: debugTestCases.value.map(tc => ({
        input: tc.input,
        output: tc.expectedOutput || '',
      }))
    })

    // 5. 处理响应
    if (response.code === 200) {
      ElMessage.success('提交成功，请稍候，请勿刷新页面')
      const results = response.data || []
      debugTestCases.value.forEach((tc, index) => {
        if (index < results.length) {
          tc.result = results[index]
          tc.passed = tc.expectedOutput?.trim() === results[index].userOutput?.trim()
        }
      })
     
    } else {
      ElMessage.error(response.message || '调试失败')
    }
  } catch (error) {
    console.error('调试失败:', error)
    ElMessage.error('调试请求失败')
  } finally {
    debugging.value = false
    // 6. 恢复用户修改标记
    hasUserModified.value = wasUserModified
  }
}

// ====== 生命周期 ======
onMounted(async () => {
  await loadQuestion()
  // WebSocket 初始化不阻塞页面
  setupWebSocket().catch(e => console.error('WebSocket 初始化失败:', e))
  nextTick(() => { calculateWidths(); initEditor() })
  window.addEventListener('resize', () => { calculateWidths(); nextTick(() => { editor?.layout() }) })
})

onBeforeUnmount(() => {
  if (editor) {
    const code = editor.getValue()
    if (code) saveCode(selectedLanguage.value, code)
    editor.dispose()
    editor = null
  }
  websocketService.disconnect()
  websocketService.clearListeners('judge-result')
  websocketService.clearListeners('debug-judge-result')
  clearTimeout(formatTimeout)
  clearTimeout(saveTimeout)
})
</script>

<style scoped>
.question-detail {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  height: calc(100vh - 56px);
}

.left-panel {
  flex-shrink: 0;
  background: #fff;
  padding: 0 28px 12px;
  height: calc(100vh - 80px);
  min-height: calc(100vh - 80px);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  overflow-x: hidden;
}

.left-panel::-webkit-scrollbar {
  width: 6px;
}

.left-panel::-webkit-scrollbar-thumb {
  background: #d8dce5;
  border-radius: 3px;
}

.right-panel {
  flex-shrink: 0;
  background: #1e1e1e;
  flex-direction: column;
  display: flex;
  overflow: hidden;
  height: 100%;
  max-height: calc(100vh - 56px);
  margin-right: 30px;
  border-radius: 0 0 8px 0;
}

.right-panel::-webkit-scrollbar {
  width: 4px;
}

.right-panel::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.resize-handle {
  width: 6px;
  flex-shrink: 0;
  background: #e4e7ed;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.resize-handle:hover {
  background: #409eff;
}

.handle-line {
  width: 2px;
  height: 40px;
  background: #c0c4cc;
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
  background: #161616;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
}

.editor-status {
  margin-left: auto;
  font-size: 12px;
  color: #d5cdcd;
  transition: color 0.3s;
}

.editor-status.is-typing {
  color: #409eff;
}

.editor-container {
  flex: 1;
  min-height: 100px;
}

.favorite-select {
  width: 100%;
}

.result-wrapper {
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid #e4e7ed;
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
  background: #e4e7ed;
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
  background: #409eff;
}

.result-handle-line {
  width: 40px;
  height: 3px;
  background: #c0c4cc;
  border-radius: 2px;
  transition: background 0.2s;
}

.result-resize-handle:hover .result-handle-line {
  background: #fff;
}

@media (max-width: 1024px) {
  .main-container {
    flex-direction: column;
  }

  .left-panel,
  .right-panel {
    width: 100% !important;
    height: auto;
    min-height: 300px;
  }

  .resize-handle {
    display: none;
  }
}
</style>
