<template>
  <div class="question-detail">
    <!-- ====== 顶部导航 ====== -->
    <el-header class="navbar" height="56px">
      <div class="navbar-left">
        <el-button :icon="ArrowLeft" @click="goBack" text>返回</el-button>
        <el-divider direction="vertical" />
        <span class="navbar-title">{{ questionData?.title || '题目详情' }}</span>
        <span class="navbar-id">{{ questionData?.questionId || '' }}</span>
      </div>
      <div class="navbar-right">
        <el-button :icon="Star" text>收藏</el-button>
        <el-button :icon="CopyDocument" text>复制</el-button>
        <el-button text @click="resetLayout">🔄 重置布局</el-button>
      </div>
    </el-header>

    <!-- ====== 主内容 ====== -->
    <div class="main-container" ref="containerRef">
      <!-- ====== 左面板：题目 ====== -->
      <div class="left-panel" :style="{ width: leftWidth + 'px' }">
        <!-- 添加 @tab-click 事件 -->
        <el-tabs v-model="activeTab" class="tabs" @tab-click="handleTabClick">
          <el-tab-pane label="题目描述" name="description">
            <div class="question-header">
              <span class="question-id">{{ questionData?.questionId }}</span>
              <span class="question-title">{{ questionData?.title }}</span>
              <el-tag :type="difficultyTag" size="small" effect="light">
                {{ difficultyText }}
              </el-tag>
              <span class="meta-info">
                时间限制: {{ questionData?.timeLimit || 1000 }}ms &nbsp;|&nbsp;
                内存限制: {{ questionData?.memoryLimit || 256 }}MB
              </span>
            </div>

            <div class="section">
              <div class="section-title">📄 题目描述</div>
              <div class="markdown-body" v-html="renderContent(questionData?.description || '（无）')"></div>
            </div>

            <div class="section">
              <div class="section-title">⌨️ 输入描述</div>
              <div class="markdown-body" v-html="renderContent(questionData?.inputDesc || '（无）')"></div>
            </div>

            <div class="section">
              <div class="section-title">🖨️ 输出描述</div>
              <div class="markdown-body" v-html="renderContent(questionData?.outputDesc || '（无）')"></div>
            </div>

            <div class="section">
              <div class="section-title">📋 样例</div>
              <div class="sample-grid">
                <div v-for="(tc, index) in sampleCases" :key="index" class="sample-box">
                  <div class="sample-label">样例输入</div>
                  <pre>{{ tc.inputData }}</pre>
                  <div class="sample-label" style="margin-top:8px;">样例输出</div>
                  <pre>{{ tc.expectedOutput }}</pre>
                </div>
              </div>
            </div>

            <div class="section" v-if="questionData?.hint">
              <div class="section-title">💡 提示</div>
              <div class="markdown-body" v-html="renderContent(questionData.hint)"></div>
            </div>

            <div class="stats-bar">
              <span>提交: {{ questionData?.totalSubmit || 0 }}</span>
              <span>通过: {{ questionData?.totalAc || 0 }}</span>
              <span>通过率: {{ passRate }}%</span>
              <span>来源: {{ questionData?.source || '未知' }}</span>
              <span>标签: {{ questionData?.tags || '无' }}</span>
            </div>
          </el-tab-pane>

          <el-tab-pane label="题解" name="solution">
            <el-empty description="暂无题解，敬请期待" />
          </el-tab-pane>

          <el-tab-pane label="提交记录" name="submissions">
            <!-- 加载中 -->
            <div v-if="submissionsLoading" class="submissions-loading">
              <el-skeleton :rows="5" animated />
            </div>

            <!-- 空状态 -->
            <el-empty v-else-if="submissionsList.length === 0" description="暂无提交记录" />

            <!-- 提交列表 -->
            <div v-else class="submissions-list">
              <el-table :data="submissionsList" stripe style="width: 100%;" :header-cell-style="{ background: '#f5f7fa' }">
                <!-- 状态 -->
                <el-table-column prop="status" label="状态" width="120" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.submitStatus)" size="small">
                      {{ row.submitStatus }}
                    </el-tag>
                  </template>
                </el-table-column>

                <!-- 耗时 -->
                <el-table-column prop="timeUsed" label="耗时" width="100" align="center">
                  <template #default="{ row }">
                    <span>{{ row.timeUsed || '-' }} ms</span>
                  </template>
                </el-table-column>

                <!-- 内存 -->
                <el-table-column prop="memoryUsed" label="内存" width="120" align="center">
                  <template #default="{ row }">
                    <span>{{ row.memoryUsed ? (row.memoryUsed / 1024).toFixed(2) + ' MB' : '-' }}</span>
                  </template>
                </el-table-column>

                <!-- 语言 -->
                <el-table-column prop="language" label="语言" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag link type="primary">{{row.language}}</el-tag>
                  </template>
                </el-table-column>

                <!-- 提交时间 -->
                <el-table-column prop="submitTime" label="提交时间" min-width="160">
                  <template #default="{ row }">
                    <span>{{ formatTime(row.createTime) }}</span>
                  </template>
                </el-table-column>

                <!-- 操作 -->
                <el-table-column label="操作" width="120" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" text @click="viewCodeInEditor(row)">查看代码</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
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
          <el-button  size="small" @click="handleSubmit" :loading="submitting">
            🚀 提交
          </el-button>
          <el-button  size="small" @click="handleRun">▶️ 运行</el-button>
          <el-button  size="small" @click="handleFormat">📐 格式化</el-button>
          <span class="editor-status" :class="{ 'is-typing': isTyping }">
            {{ editorStatus }}
          </span>
        </div>

        <!-- Monaco Editor -->
        <div ref="editorContainer" class="editor-container"></div>

        <!-- ====== 结果区 ====== -->
        <div class="result-wrapper" ref="resultWrapperRef" :style="{ height: resultHeight + 'px' }">
          <div class="result-resize-handle" @mousedown="startResizeResult">
            <div class="result-handle-line"></div>
          </div>

          <div v-if="!judgeResult" class="result-placeholder">
            <el-empty description="提交代码后，判题结果将显示在这里" :image-size="80" />
          </div>

          <div v-else class="result-area">
            <!-- 状态栏 -->
            <div class="result-status-bar" :class="judgeResultClass">
              <div class="result-status-left">
                <el-icon v-if="judgeResult.submitStatus === 'AC'" class="status-icon success">
                  <CircleCheck />
                </el-icon>
                <el-icon v-else-if="judgeResult.submitStatus === 'PENDING'" class="status-icon pending">
                  <Loading />
                </el-icon>
                <el-icon v-else class="status-icon error">
                  <CircleClose />
                </el-icon>
                <span class="status-text">{{ statusText }}</span>
                <span v-if="judgeResult.timeUsed !== null" class="status-metric">⏱️ {{ judgeResult.timeUsed }}ms</span>
                <span v-if="judgeResult.memoryUsed !== null" class="status-metric">💾 {{ (judgeResult.memoryUsed / 1024).toFixed(2) }}MB</span>
              </div>
              <el-button size="small" text @click="clearResult">✕ 关闭</el-button>
            </div>

            <!-- AC 结果 -->
            <div v-if="judgeResult.submitStatus === 'AC'" class="result-content ac-content">
              <el-result icon="success" title="Accepted" sub-title="恭喜通过！">
                <template #extra>
                  <span>耗时: {{ judgeResult.timeUsed }}ms | 内存: {{ (judgeResult.memoryUsed / 1024).toFixed(2) }}MB</span>
                </template>
              </el-result>
            </div>

            <!-- PENDING -->
            <div v-else-if="judgeResult.submitStatus === 'PENDING'" class="result-content">
              <el-result icon="info" title="判题中..." sub-title="请稍候">
                <template #extra>
                  <el-progress :percentage="judgeProgress" :stroke-width="8" />
                </template>
              </el-result>
            </div>

            <!-- 错误状态 -->
            <div v-else class="result-content error-content">
              <!-- 错误信息 -->
              <div class="error-section">
                <div class="error-title">❌ 错误信息</div>
                <el-alert
                  :title="judgeResult.error || '未知错误'"
                  type="error"
                  show-icon
                  :closable="false"
                />
              </div>
                <!-- ✅ 显示原始日志 -->
  <div v-if="judgeResult.log" class="log-section">
    <div class="log-title">📋 完整日志</div>
    <pre class="log-content">{{ judgeResult.log }}</pre>
  </div>

              <!-- 失败测试点 -->
              <div class="sample-section">
                <div class="sample-title">📋 失败测试点</div>

                <!-- 输入 -->
                <el-card shadow="hover" class="sample-card input-card">
                  <template #header>
                    <div class="card-header">
                      <span class="card-title">📥 输入</span>
                      <el-button size="small" text @click="copyText(parsedTestData.input)">复制</el-button>
                    </div>
                  </template>
                  <pre class="card-content">{{ parsedTestData.input || '（无）' }}</pre>
                </el-card>

                <!-- 期望输出 -->
                <el-card shadow="hover" class="sample-card expected-card">
                  <template #header>
                    <div class="card-header">
                      <span class="card-title">✅ 期望输出</span>
                      <el-button size="small" text @click="copyText(parsedTestData.expected)">复制</el-button>
                    </div>
                  </template>
                  <pre class="card-content expected">{{ parsedTestData.expected || '（无）' }}</pre>
                </el-card>

                <!-- 实际输出 -->
                <el-card shadow="hover" class="sample-card actual-card">
                  <template #header>
                    <div class="card-header">
                      <span class="card-title">❌ 实际输出</span>
                      <el-button size="small" text @click="copyText(parsedTestData.actual)">复制</el-button>
                    </div>
                  </template>
                  <pre class="card-content actual">{{ parsedTestData.actual || '（无输出）' }}</pre>
                </el-card>
              </div>

              <!-- 测试点概览 -->
              <div v-if="allTestCases && allTestCases.length > 1" class="summary-section">
                <div class="summary-title">📊 测试点概览 ({{ allTestCases.length }})</div>
                <div class="testcase-summary">
                  <div
                    v-for="(tc, index) in allTestCases"
                    :key="index"
                    class="testcase-dot"
                    :class="tc.passed ? 'passed' : 'failed'"
                    :title="`测试点 ${index + 1}: ${tc.passed ? '✅ 通过' : '❌ 失败'}`"
                  >
                    {{ index + 1 }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Star, CopyDocument, CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'
import * as monaco from 'monaco-editor'
import { marked } from 'marked'
import websocketService from '@/utils/WebSocket'
import questionApi from '@/api/questionApi'

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

// ====== 提交记录 ======
const submissionsList = ref<any[]>([])
const submissionsLoading = ref(false)
const submissionsLoaded = ref(false)

// ====== 代码保存 ======
const SAVE_KEY_PREFIX = 'codewise_code_'

const saveCode = (language: string, code: string) => {
  const key = `${SAVE_KEY_PREFIX}${language}`
  const data = { code, language, timestamp: Date.now(), questionId: route.query.questionId }
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) { console.warn('保存代码失败:', e) }
}

const loadCode = (language: string): string | null => {
  const key = `${SAVE_KEY_PREFIX}${language}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    const expireTime = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - data.timestamp > expireTime) {
      localStorage.removeItem(key)
      return null
    }
    if (data.questionId !== route.query.questionId) return null
    return data.code
  } catch (e) { return null }
}

const onLanguageChange = (lang: string) => {
  const savedCode = loadCode(lang)
  if (savedCode && editor) {
    editor.setValue(savedCode)
    ElMessage.success(`已加载 ${lang} 的保存代码`)
  }
}

// ====== 判题结果 ======
interface JudgeResultDTO {
  submissionId: number
  language: string
  code: string
  submitStatus: 'AC' | 'WA' | 'TLE' | 'RE' | 'CE' | 'OLE' | 'MLE' | 'PE' | 'PENDING'
  failInde?: number
  expectedOutput?: string
  userOutput?: string
  inputData?: string
  timeUsed?: number
  memoryUsed?: number
  error?: string
  log?:string
}

interface TestCaseResult {
  input: string
  expectedOutput: string
  actual: string
  passed: boolean
}

const judgeResult = ref<JudgeResultDTO | null>(null)
const allTestCases = ref<TestCaseResult[]>([])

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

// ====== 获取提交记录（点击标签时触发） ======
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

// ====== 标签切换事件 ======
const handleTabClick = (tab: any) => {
  if (tab.paneName === 'submissions') {
    loadSubmissions()
  }
}

// ====== 查看代码 - 在编辑器中显示 ======
const viewCodeInEditor = (row: any) => {
  if (!editor) {
    ElMessage.warning('编辑器未初始化')
    return
  }

  editor.setValue(row.submitContent || '// 暂无代码')

  const languageMap: Record<string, string> = {
    'cpp': 'cpp',
    'c': 'c',
    'java': 'java',
    'python': 'python',
    'python3': 'python',
    'python2': 'python',
    'go': 'go',
    'csharp': 'csharp',
    'javascript': 'javascript'
  }
  const lang = languageMap[row.language?.toLowerCase()] || 'cpp'
  monaco.editor.setModelLanguage(editor.getModel()!, lang)
  selectedLanguage.value = row.language?.toLowerCase() || 'cpp'

  ElMessage.success('已加载代码到编辑器')
}

// ====== 状态颜色 ======
const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    'AC': 'success',
    'WA': 'danger',
    'TLE': 'warning',
    'RE': 'danger',
    'CE': 'info',
    'PENDING': 'warning'
  }
  return map[status] || 'info'
}

// ====== 时间格式化 ======
const formatTime = (time: string) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
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

// ====== 获取默认代码模板 ======
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

watch(selectedLanguage, (newLang) => {
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

// ====== 解析后的测试点数据 ======
const parsedTestData = computed(() => {
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

// ====== WebSocket ======
const setupWebSocket = () => {
  const token: any = localStorage.getItem('token')
  const userId: any = localStorage.getItem('userId')
  const wsUrl = `ws://localhost:8084/websocket?token=${token}`
  websocketService.connect(wsUrl, token)

  const eventName = `/queue/judge-result-${userId}`
  console.log('📡 监听事件:', eventName)

   websocketService.on('judge-result', (data: JudgeResultDTO) => {
    console.log('📩📩📩 监听器被触发！', data)  
    console.log('📩 收到判题结果:', data)
    judgeResult.value = data
    judgeProgress.value = 100
    if (data.submitStatus === 'AC') {
      ElMessage.success('🎉 恭喜通过！')
    } else if (data.submitStatus === 'PENDING') {
      ElMessage.info('判题中...')
    } else {
      ElMessage.error(`❌ ${statusMap[data.submitStatus]?.text || data.submitStatus}`)
    }
    submitting.value = false
  })
}

// ====== 提交代码 ======
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
      questionId: Number(questionId)
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

// ====== 格式化 ======
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

// QuestionDetailView.vue - 保存表格滚动位置
const goBack = () => {

  router.back()
}

// ====== 复制文本 ======
const copyText = (text: string) => {
  if (!text) {
    ElMessage.warning('没有内容可复制')
    return
  }
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

// ====== 生命周期 ======
onMounted(() => {
  loadQuestion()
  setupWebSocket()
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
  clearTimeout(formatTimeout)
  clearTimeout(saveTimeout)
})
</script>

<style scoped>
/* ====== 全局 ====== */
.question-detail {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.navbar {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
  height: 56px;
}
.navbar-left { display: flex; align-items: center; gap: 12px; }
.navbar-title { font-size: 16px; font-weight: 600; color: #303133; }
.navbar-id { font-size: 13px; color: #909399; }
.navbar-right { display: flex; align-items: center; gap: 8px; }

/* ====== 主容器 ====== */
.main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  height: calc(100vh - 56px);
}

/* ====== 左面板 ====== */
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
.left-panel::-webkit-scrollbar { width: 6px; }
.left-panel::-webkit-scrollbar-thumb { background: #d8dce5; border-radius: 3px; }

/* ====== Tabs 容器 ====== */
.tabs {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
  margin: 0 0 16px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
  padding-top: 12px;
}

.tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 4px;
}

/* ====== 提交记录 ====== */
.submissions-list {
  padding: 4px 0;
  overflow-y: auto;
  max-height: 100%;
}

.submissions-list .el-table {
  width: 100%;
}

.submissions-list :deep(.el-table__body-wrapper) {
  overflow-y: auto !important;
}

.submissions-loading {
  padding: 20px;
}
/* ====== 右面板 ====== */
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

.right-panel::-webkit-scrollbar { width: 4px; }
.right-panel::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }

/* ====== 拖拽手柄 ====== */
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
.resize-handle:hover { background: #409eff; }
.handle-line {
  width: 2px;
  height: 40px;
  background: #c0c4cc;
  border-radius: 2px;
  transition: background 0.2s;
}
.resize-handle:hover .handle-line { background: #fff; }

/* ====== 编辑器工具栏 ====== */
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
.editor-status.is-typing { color: #409eff; }

.editor-container {
  flex: 1;
  min-height: 100px;
}

/* ====== 结果区 ====== */
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

.result-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  min-height: 0;
}
.result-area::-webkit-scrollbar { width: 4px; }
.result-area::-webkit-scrollbar-thumb { background: #d8dce5; border-radius: 2px; }

/* ====== 结果区拖拽手柄 ====== */
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
.result-resize-handle:hover { background: #409eff; }
.result-handle-line {
  width: 40px;
  height: 3px;
  background: #c0c4cc;
  border-radius: 2px;
  transition: background 0.2s;
}
.result-resize-handle:hover .result-handle-line { background: #fff; }

/* ====== 状态栏 ====== */
.result-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.result-status-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.status-icon { font-size: 22px; }
.status-icon.success { color: #67c23a; }
.status-icon.error { color: #f56c6c; }
.status-icon.pending { color: #e6a23c; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-text { font-size: 15px; font-weight: 600; color: #303133; }
.status-metric { font-size: 13px; color: #909399; }

.result-wrapper.ac .result-status-bar { border-bottom-color: #67c23a; }
.result-wrapper.wa .result-status-bar,
.result-wrapper.re .result-status-bar,
.result-wrapper.ce .result-status-bar,
.result-wrapper.tle .result-status-bar { border-bottom-color: #f56c6c; }
.result-wrapper.pending .result-status-bar { border-bottom-color: #e6a23c; }

/* ====== 题目样式 ====== */
.tabs { height: 100%; }
.tabs :deep(.el-tabs__header) {
  margin: 0 0 20px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
  padding-top: 16px;
}
.tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.question-id { font-size: 13px; color: #909399; }
.question-title { font-size: 22px; font-weight: 700; color: #303133; }
.meta-info { font-size: 13px; color: #909399; margin-left: auto; }

.section { margin-bottom: 28px; }
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.markdown-body {
  font-size: 15px;
  line-height: 1.9;
  color: #303133;
}
.markdown-body p { margin: 10px 0; }
.markdown-body code {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
}
.markdown-body pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px 18px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.7;
}
.markdown-body ul,
.markdown-body ol {
  padding-left: 24px;
  margin: 10px 0;
}
.markdown-body li { margin: 4px 0; }

.sample-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 8px;
}
.sample-box {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 18px;
  border: 1px solid #e4e7ed;
}
.sample-box pre {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #303133;
  margin: 6px 0 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
.sample-label {
  font-size: 13px;
  font-weight: 600;
  color: #909399;
}

.stats-bar {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: #909399;
  flex-wrap: wrap;
}

/* ====== 错误内容 ====== */
.error-section {
  margin-bottom: 8px;
  flex-shrink: 0;
}
.error-title {
  font-size: 12px;
  font-weight: 600;
  color: #f56c6c;
  margin-bottom: 2px;
}
.error-section .el-alert {
  padding: 4px 10px;
  font-size: 12px;
}

.sample-section {
  margin-bottom: 6px;
  flex-shrink: 0;
}
.sample-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.sample-card {
  background: #fafafa;
  margin-bottom: 4px;
}
.sample-card:last-child { margin-bottom: 0; }
.sample-card :deep(.el-card__header) {
  padding: 2px 8px;
  border-bottom: 1px solid #f0f0f0;
}
.sample-card :deep(.el-card__body) {
  padding: 4px 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-title {
  font-size: 12px;
  font-weight: 600;
}
.input-card .card-title { color: #409eff; }
.expected-card .card-title { color: #67c23a; }
.actual-card .card-title { color: #f56c6c; }

.card-content {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}
.card-content.expected {
  border-left: 3px solid #67c23a;
  padding-left: 6px;
}
.card-content.actual {
  border-left: 3px solid #f56c6c;
  padding-left: 6px;
}

/* ====== 测试点概览 ====== */
.summary-section { margin-top: 4px; }
.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}
.testcase-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.testcase-dot {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
}
.testcase-dot.passed { background: #67c23a; }
.testcase-dot.failed { background: #f56c6c; }

/* ====== 提交记录 ====== */
.submissions-list {
  padding: 8px 0;
  height: 100%;
  overflow-y: auto;
  max-height: calc(100vh - 350px);
}

.submissions-list .el-table {
  width: 100%;
}

.submissions-loading {
  padding: 20px;
}

/* ✅ 表格内容滚动 */
.submissions-list :deep(.el-table__body-wrapper) {
  overflow-y: auto !important;
}

/* ✅ 表格行悬停 */
.submissions-list :deep(.el-table__row:hover) {
  background: #f0f2f5;
}
/* ====== 日志区域 ====== */
.log-section {
  margin-bottom: 8px;
  flex-shrink: 0;
}
.log-title {
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}
.log-content {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.6;
  background: #1a1a2e;
  color: #d4d4d4;
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
  border: 1px solid #333;
}
.log-content::-webkit-scrollbar { width: 4px; }
.log-content::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
/* ====== 响应式 ====== */
@media (max-width: 1024px) {
  .main-container { flex-direction: column; }
  .left-panel, .right-panel { width: 100% !important; height: auto; min-height: 300px; }
  .resize-handle { display: none; }
  .sample-grid { grid-template-columns: 1fr; }
  .question-header { flex-direction: column; align-items: flex-start; }
  .meta-info { margin-left: 0; }
}
</style>