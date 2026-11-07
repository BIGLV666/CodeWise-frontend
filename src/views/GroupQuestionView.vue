<template>
  <div class="group-question-page">
    <AppNavBar active="groups" />

    <main class="question-shell">
      <header class="question-head">
        <el-button text :icon="ArrowLeft" @click="backToGroup">返回小组</el-button>
        <div class="head-main">
          <h1>{{ question?.title || '小组题目' }}</h1>
          <div class="head-meta">
            <el-tag v-if="question" size="small" :type="difficultyTag(question.difficulty)" effect="light">
              {{ difficultyText(question.difficulty) }}
            </el-tag>
            <span v-if="groupName">{{ groupName }}</span>
            <span v-if="questionId">题目 ID：{{ questionId }}</span>
            <span v-if="question?.tags">{{ question.tags }}</span>
          </div>
        </div>
        <el-button text @click="copyText(question?.title || '')">复制标题</el-button>
      </header>

      <el-alert
        v-if="loadState === 'error'"
        class="page-error"
        type="error"
        :closable="false"
        :title="loadError"
      />

      <section v-if="loadState === 'not-member'" class="panel empty-panel">
        <el-empty description="你不是该小组成员，加入后才能查看和提交题目" :image-size="88">
          <el-button type="primary" @click="backToGroup">去小组页加入</el-button>
        </el-empty>
      </section>

      <section v-else-if="loadState === 'missing'" class="panel empty-panel">
        <el-empty description="题目不存在，或已被移出小组题库" :image-size="88">
          <el-button @click="backToGroup">返回小组</el-button>
        </el-empty>
      </section>

      <div v-else v-loading="loading" class="workspace">
        <section class="panel statement">
          <div class="statement-meta">
            <span>时间限制：{{ question?.timeLimit || '-' }} ms</span>
            <span>内存限制：{{ question?.memoryLimit || '-' }} MB</span>
            <span v-if="question?.totalSubmit != null">提交 {{ question.totalSubmit }} 次</span>
            <span v-if="question?.totalAc != null">通过 {{ question.totalAc }} 次</span>
          </div>

          <el-alert
            v-if="question?.status === 0"
            type="info"
            :closable="false"
            show-icon
            title="该题目已下架，暂时无法提交"
            class="status-alert"
          />
          <el-alert
            v-else-if="question?.status === 2"
            type="warning"
            :closable="false"
            show-icon
            title="该题目正在审核中，暂时无法提交"
            class="status-alert"
          />

          <article class="md" v-html="renderMarkdown(question?.description || '（无题目描述）')"></article>

          <template v-if="question?.inputDesc">
            <h3>输入描述</h3>
            <article class="md" v-html="renderMarkdown(question.inputDesc)"></article>
          </template>
          <template v-if="question?.outputDesc">
            <h3>输出描述</h3>
            <article class="md" v-html="renderMarkdown(question.outputDesc)"></article>
          </template>

          <h3>样例</h3>
          <div class="samples">
            <div class="sample-card">
              <div class="sample-head">
                <span>样例输入</span>
                <el-button text size="small" @click="copyText(question?.sampleInput || '')">复制</el-button>
              </div>
              <pre>{{ question?.sampleInput || '（无）' }}</pre>
            </div>
            <div class="sample-card">
              <div class="sample-head">
                <span>样例输出</span>
                <el-button text size="small" @click="copyText(question?.sampleOutput || '')">复制</el-button>
              </div>
              <pre>{{ question?.sampleOutput || '（无）' }}</pre>
            </div>
          </div>

          <template v-if="question?.hint">
            <h3>提示</h3>
            <article class="md" v-html="renderMarkdown(question.hint)"></article>
          </template>
        </section>

        <section class="panel solve">
          <div class="editor-toolbar">
            <el-select
              v-model="selectedLanguage"
              size="small"
              class="language-select"
              @change="onLanguageChange"
            >
              <el-option label="C++" value="cpp" />
              <el-option label="C" value="c" />
              <el-option label="Java" value="java" />
              <el-option label="Python3" value="python" />
              <el-option label="Golang" value="go" />
              <el-option label="C#" value="csharp" />
              <el-option label="JavaScript" value="javascript" />
            </el-select>
            <el-button size="small" @click="resetCode">重置代码</el-button>
            <span class="editor-status">{{ editorStatus }}</span>
            <el-button
              type="primary"
              size="small"
              :loading="submitting"
              :disabled="submissionBlocked"
              @click="handleSubmit"
            >
              提交代码
            </el-button>
          </div>

          <div ref="editorContainer" class="editor-container"></div>

          <div class="result-panel">
            <QuestionResultContent
              v-if="judgeResult"
              :judge-result="judgeResult"
              :judge-result-class="judgeResultClass"
              :status-text="statusText"
              :judge-progress="judgeProgress"
              :parsed-test-data="parsedTestData"
              :all-test-cases="[]"
              :selected-test-case="null"
              @clear-result="judgeResult = null"
              @copy-text="copyText"
              @clear-selected-testcase="() => {}"
            />
            <el-empty
              v-else
              description="提交后在这里查看判题结果"
              :image-size="56"
            />
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * 小组题目做题页。
 *
 * 不复用普通题目详情页：小组题目的详情、提交场景和可操作项都不同。
 * - 详情走 `/quiz/groups/{groupId}/questions/{groupQuestionId}`；
 * - 提交走 `/question/judge`，`submitScene=GROUP` 且必须带 `groupId`；
 * - 不展示收藏 / 复习 / AI / 题解等平台题目专属入口。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import QuestionResultContent from '@/components/question-detail/QuestionResultContent.vue'
import groupApi, { type GroupInfo, type GroupQuestionDetail } from '@/api/groupApi'
import questionApi from '@/api/questionApi'
import { errorText, isLocalFailure, unwrap } from '@/api/request'
import { useUserStore } from '@/stores/User'
import { logWarn } from '@/utils/logger'
import { renderMarkdown } from '@/utils/markdown'
import websocketService from '@/utils/WebSocket'
import { resolveParsedTestData } from '@/utils/judgeResult'
import type { JudgeResultDTO } from '@/types/QuestionDetail'

type LoadState = 'loading' | 'ok' | 'not-member' | 'missing' | 'error'

const monacoGlobal = self as typeof self & {
  MonacoEnvironment?: { getWorker: () => Worker }
}
monacoGlobal.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loadState = ref<LoadState>('loading')
const loading = ref(false)
const loadError = ref('')
const groupName = ref('')
const question = ref<GroupQuestionDetail['questionDto'] | null>(null)

const selectedLanguage = ref('cpp')
const editorStatus = ref('就绪')
const submitting = ref(false)
const judgeResult = ref<JudgeResultDTO | null>(null)
const judgeProgress = ref(0)
const editorContainer = ref<HTMLElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let progressTimer: number | undefined
let saveTimer: number | undefined
let lastLanguage = 'cpp'
let stopJudgeListener: (() => void) | undefined
let questionLoadSeq = 0

const param = (key: string) => {
  const raw = route.params[key]
  return String(Array.isArray(raw) ? raw[0] : raw || '')
}

const groupId = computed(() => param('groupId'))
const groupQuestionId = computed(() => param('groupQuestionId'))
const questionId = computed(() => String(question.value?.questionId || ''))
const submissionBlocked = computed(
  () => question.value?.status === 0 || question.value?.status === 2,
)
const currentUserId = computed(() =>
  String(userStore.userDto?.userId ?? localStorage.getItem('userId') ?? ''),
)

const STATUS_MAP: Record<string, { text: string; cls: string }> = {
  AC: { text: 'Accepted ✅', cls: 'ac' },
  WA: { text: 'Wrong Answer ❌', cls: 'wa' },
  TLE: { text: 'Time Limit Exceeded ⏰', cls: 'tle' },
  RE: { text: 'Runtime Error 💥', cls: 're' },
  CE: { text: 'Compile Error 🔧', cls: 'ce' },
  OLE: { text: 'Output Limit Exceeded 📤', cls: 'ole' },
  MLE: { text: 'Memory Limit Exceeded 💾', cls: 'mle' },
  PE: { text: 'Presentation Error 📝', cls: 'pe' },
  PENDING: { text: '判题中... ⏳', cls: 'pending' },
}

const statusText = computed(() => {
  if (!judgeResult.value) return ''
  return STATUS_MAP[judgeResult.value.submitStatus]?.text || judgeResult.value.submitStatus
})

const judgeResultClass = computed(() => {
  if (!judgeResult.value) return ''
  return STATUS_MAP[judgeResult.value.submitStatus]?.cls || ''
})

const parsedTestData = computed(() => resolveParsedTestData(judgeResult.value))

function difficultyText(value?: number | null) {
  const map: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
  return map[Number(value)] || '未标注'
}

function difficultyTag(value?: number | null): 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<number, 'success' | 'warning' | 'danger'> = {
    1: 'success',
    2: 'warning',
    3: 'danger',
  }
  return map[Number(value)] || 'info'
}

function backToGroup() {
  if (groupId.value) router.push(`/groups/${groupId.value}`)
  else router.push('/groups')
}

async function loadQuestion() {
  const targetGroupId = groupId.value
  const targetQuestionId = groupQuestionId.value
  if (!targetGroupId || !targetQuestionId) {
    loadState.value = 'missing'
    loadError.value = '缺少小组题目参数'
    return
  }
  const requestId = ++questionLoadSeq
  loading.value = true
  loadError.value = ''
  try {
    const [groupResult, questionResult] = await Promise.allSettled([
      groupApi.getGroup(targetGroupId, true),
      groupApi.getQuestion(targetGroupId, targetQuestionId, true),
    ])
    // 路由复用时旧请求可能晚于新请求返回，只允许最新一次写入状态。
    if (requestId !== questionLoadSeq) return

    if (groupResult.status === 'fulfilled') {
      const info = unwrap<GroupInfo | null>(groupResult.value, null)
      groupName.value = info?.groupName || ''
    }

    if (questionResult.status === 'rejected') throw questionResult.reason
    const detail = unwrap<GroupQuestionDetail | null>(questionResult.value, null)
    if (!detail?.questionDto) {
      loadState.value = 'missing'
      return
    }
    question.value = detail.questionDto
    loadState.value = 'ok'
    await nextTick()
    if (requestId !== questionLoadSeq) return
    initEditor()
    applySavedCode()
  } catch (error) {
    if (requestId !== questionLoadSeq) return
    const bizCode = (error as { bizCode?: number } | null)?.bizCode
    if (bizCode === 4041101) {
      loadState.value = 'not-member'
    } else if (bizCode === 4041102 || bizCode === 4041104) {
      loadState.value = 'missing'
    } else {
      loadState.value = 'error'
      loadError.value = errorText(error, '题目加载失败，请稍后重试')
      logWarn('加载小组题目失败:', error)
    }
  } finally {
    if (requestId === questionLoadSeq) loading.value = false
  }
}

// ====== 代码缓存 ======
const CODE_PREFIX = 'codewise_group_code_'
const CODE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000

const DEFAULT_CODES: Record<string, string> = {
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  \n  return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n  \n  return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    \n  }\n}\n',
  python: 'import sys\n\n\ndef main():\n    pass\n\n\nif __name__ == "__main__":\n    main()\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t\n}\n',
  csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        \n    }\n}\n',
  javascript: 'const readline = require("readline");\n\nconst rl = readline.createInterface({ input: process.stdin });\nrl.on("line", (line) => {\n  \n});\n',
}

const LANGUAGE_IDS: Record<string, string> = {
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  python: 'python',
  go: 'go',
  csharp: 'csharp',
  javascript: 'javascript',
}

const codeKeyFor = (
  targetGroupId: string,
  targetQuestionId: string,
  language: string,
) => `${CODE_PREFIX}${currentUserId.value}_${targetGroupId}_${targetQuestionId}_${language}`

const codeKey = (language: string) =>
  codeKeyFor(groupId.value, groupQuestionId.value, language)

function saveCode(language: string, code: string, targetGroupId = groupId.value, targetQuestionId = groupQuestionId.value) {
  if (!targetGroupId || !targetQuestionId) return
  try {
    // 空代码也要落盘：用户清空编辑器后刷新应保持为空，而不是又变回模板。
    localStorage.setItem(
      codeKeyFor(targetGroupId, targetQuestionId, language),
      JSON.stringify({ code, savedAt: Date.now() }),
    )
  } catch {
    // 本地存储不可用时不影响提交
  }
}

function loadCode(language: string): string | null {
  try {
    const key = codeKey(language)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: unknown; savedAt?: unknown }
    if (typeof parsed.code !== 'string' || typeof parsed.savedAt !== 'number') {
      localStorage.removeItem(key)
      return null
    }
    if (Date.now() - parsed.savedAt > CODE_EXPIRE_TIME) {
      // 顺手清掉过期缓存，避免旧代码长期占用存储。
      localStorage.removeItem(key)
      return null
    }
    return parsed.code
  } catch {
    return null
  }
}

function applySavedCode() {
  if (!editor) return
  const saved = loadCode(selectedLanguage.value)
  editor.setValue(
    saved !== null ? saved : DEFAULT_CODES[selectedLanguage.value] || '',
  )
  lastLanguage = selectedLanguage.value
  editorStatus.value = '已保存'
}

// ====== 编辑器 ======
function initEditor() {
  if (!editorContainer.value) return
  if (editor) {
    const dom = editor.getDomNode()
    // 加载态切换（not-member/missing）会 v-if 卸载工作区，旧实例仍指向已脱离
    // 文档的节点；此时必须销毁重建，否则编辑器不会显示。
    if (dom && editorContainer.value.contains(dom)) return
    editor.dispose()
    editor = null
  }
  editor = monaco.editor.create(editorContainer.value, {
    value: DEFAULT_CODES[selectedLanguage.value] || '',
    language: LANGUAGE_IDS[selectedLanguage.value] || 'cpp',
    theme: 'vs',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    detectIndentation: false,
    tabSize: 2,
    insertSpaces: true,
    bracketPairColorization: { enabled: true },
    scrollBeyondLastLine: false,
  })

  editor.onDidChangeModelContent(() => {
    editorStatus.value = '编辑中...'
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const value = editor?.getValue() || ''
      saveCode(selectedLanguage.value, value)
      editorStatus.value = '已保存'
    }, 800)
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    void handleSubmit()
  })
}

function onLanguageChange(language: string) {
  if (!editor) {
    lastLanguage = language
    return
  }
  saveCode(lastLanguage, editor.getValue())
  lastLanguage = language
  const model = editor.getModel()
  if (model) monaco.editor.setModelLanguage(model, LANGUAGE_IDS[language] || 'cpp')
  const saved = loadCode(language)
  editor.setValue(saved !== null ? saved : DEFAULT_CODES[language] || '')
  editorStatus.value = '已保存'
}

function resetCode() {
  if (!editor) return
  editor.setValue(DEFAULT_CODES[selectedLanguage.value] || '')
  editorStatus.value = '已重置'
}

// ====== 提交 ======
function startProgress() {
  if (progressTimer) window.clearInterval(progressTimer)
  judgeProgress.value = 0
  progressTimer = window.setInterval(() => {
    if (judgeProgress.value >= 90) {
      // 进度条停在 90%，等待判题结果推送，避免空转定时器。
      stopProgress()
      return
    }
    judgeProgress.value += 10
  }, 300)
}

function stopProgress() {
  if (progressTimer) window.clearInterval(progressTimer)
  progressTimer = undefined
}

async function handleSubmit() {
  if (submitting.value || !editor) return
  if (submissionBlocked.value) {
    ElMessage.warning('该题目当前不可提交')
    return
  }
  if (!questionId.value) {
    ElMessage.error('缺少题目 ID')
    return
  }
  const code = editor.getValue()
  if (!code.trim()) {
    ElMessage.warning('请先编写代码')
    return
  }
  saveCode(selectedLanguage.value, code)

  submitting.value = true
  judgeResult.value = {
    language: selectedLanguage.value,
    code,
    submitStatus: 'PENDING',
    timeUsed: 0,
    memoryUsed: 0,
  }
  startProgress()

  try {
    const response = await questionApi.submitCode({
      code,
      language: selectedLanguage.value,
      questionId: Number(questionId.value),
      questionTitle: question.value?.title || '',
      submitScene: 'GROUP',
      groupId: groupId.value,
    })
    if (response.code === 200) {
      ElMessage.success('代码已提交，等待判题...')
    } else {
      submitting.value = false
      judgeResult.value = null
      stopProgress()
    }
  } catch (error) {
    logWarn('小组提交失败:', error)
    submitting.value = false
    judgeResult.value = null
    stopProgress()
    if (isLocalFailure(error)) {
      ElMessage.error(errorText(error, '提交失败'))
    }
  }
}

// ====== 判题结果推送 ======
function setupJudgeSubscriptions() {
  stopJudgeListener?.()
  websocketService.unsubscribe('judge-result')
  const userId = currentUserId.value
  if (!userId || userId === 'guest') return

  websocketService.subscribe('judge-result', `/queue/judge-result-${userId}`)
  stopJudgeListener = websocketService.on('judge-result', (data: any) => {
    if (data?.userId != null && String(data.userId) !== userId) return
    const result = data?.result ?? data
    if (
      !result ||
      typeof result !== 'object' ||
      Array.isArray(result) ||
      typeof result.submitStatus !== 'string' ||
      !result.submitStatus
    ) {
      return
    }
    judgeResult.value = result
    judgeProgress.value = 100
    stopProgress()
    submitting.value = false
    if (result.submitStatus !== 'AC' && result.submitStatus !== 'PENDING') {
      ElMessage.error(`❌ ${STATUS_MAP[result.submitStatus]?.text || result.submitStatus}`)
    }
  })
}

async function copyText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
  }
}

watch(currentUserId, setupJudgeSubscriptions)

watch(
  () => [groupId.value, groupQuestionId.value] as const,
  ([nextGroupId, nextQuestionId], previous) => {
    // 先把上一道题的代码按旧小组/题目落盘，再做切换；否则会写进新题目的缓存键。
    const prevGroupId = previous?.[0] || ''
    const prevQuestionId = previous?.[1] || ''
    if (editor && prevGroupId && prevQuestionId) {
      saveCode(lastLanguage, editor.getValue(), prevGroupId, prevQuestionId)
    }
    if (saveTimer) {
      window.clearTimeout(saveTimer)
      saveTimer = undefined
    }
    questionLoadSeq += 1
    stopProgress()
    judgeProgress.value = 0
    judgeResult.value = null
    submitting.value = false
    question.value = null
    if (!nextGroupId || !nextQuestionId) {
      loadState.value = 'missing'
      loadError.value = '缺少小组题目参数'
      return
    }
    loadState.value = 'loading'
    void loadQuestion()
  },
)

onMounted(async () => {
  setupJudgeSubscriptions()
  await loadQuestion()
})

onBeforeUnmount(() => {
  if (editor) {
    saveCode(selectedLanguage.value, editor.getValue())
    editor.dispose()
    editor = null
  }
  stopProgress()
  if (saveTimer) window.clearTimeout(saveTimer)
  stopJudgeListener?.()
  websocketService.unsubscribe('judge-result')
})
</script>

<style scoped>
.group-question-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
}

.question-shell {
  width: min(1320px, calc(100% - 48px));
  margin: 0 auto;
  padding: 16px 0 40px;
}

.question-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.head-main {
  flex: 1 1 auto;
  min-width: 0;
}

.head-main h1 {
  margin: 0;
  color: var(--cw-text-1);
  font-size: 22px;
  line-height: 1.3;
  word-break: break-word;
}

.head-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.panel {
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius-lg);
  background: var(--cw-bg-card);
  box-shadow: var(--cw-shadow-card);
}

.empty-panel {
  padding: 24px;
}

.page-error {
  margin-bottom: 14px;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.statement {
  padding: 20px 22px 26px;
  max-height: calc(100dvh - 178px);
  overflow-y: auto;
}

.statement-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--cw-border);
  color: var(--cw-text-3);
  font-size: 12px;
}

.status-alert {
  margin-top: 14px;
}

.statement h3 {
  margin: 20px 0 8px;
  color: var(--cw-text-1);
  font-size: 15px;
}

.md {
  color: var(--cw-text-2);
  font-size: 14px;
  line-height: 1.75;
  word-break: break-word;
}

.md :deep(p) {
  margin: 0 0 10px;
}

.md :deep(pre) {
  padding: 12px;
  overflow-x: auto;
  border-radius: var(--cw-radius);
  background: var(--cw-bg-page);
}

.md :deep(code) {
  font-family: var(--cw-font-mono);
  font-size: 13px;
}

.md :deep(img) {
  max-width: 100%;
}

.samples {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sample-card {
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius);
  overflow: hidden;
}

.sample-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 12px;
  background: var(--cw-bg-page);
  color: var(--cw-text-2);
  font-size: 12px;
}

.sample-card pre {
  margin: 0;
  padding: 12px;
  max-height: 200px;
  overflow: auto;
  color: var(--cw-text-1);
  font-family: var(--cw-font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.solve {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 178px);
  min-height: 420px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--cw-border);
}

.language-select {
  width: 128px;
}

.editor-status {
  margin-left: auto;
  color: var(--cw-text-3);
  font-size: 12px;
}

.editor-container {
  flex: 1 1 auto;
  min-height: 240px;
}

.result-panel {
  flex: 0 0 auto;
  max-height: 42%;
  min-height: 120px;
  overflow-y: auto;
  border-top: 1px solid var(--cw-border);
}

@media (max-width: 1024px) {
  .question-shell {
    width: calc(100% - 32px);
  }

  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .statement {
    max-height: none;
  }

  .solve {
    height: 560px;
  }
}

@media (max-width: 768px) {
  .question-shell {
    padding: 10px 0 28px;
  }

  .question-head {
    flex-wrap: wrap;
  }

  .head-main h1 {
    font-size: 18px;
  }

  .statement {
    padding: 16px 14px 20px;
  }

  .samples {
    grid-template-columns: minmax(0, 1fr);
  }

  .solve {
    height: 520px;
  }

  .editor-status {
    display: none;
  }

  .result-panel {
    max-height: 46%;
  }
}
</style>
