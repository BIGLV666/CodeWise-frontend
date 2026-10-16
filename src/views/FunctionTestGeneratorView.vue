<template>
  <div class="generator-page">
    <header class="topbar">
      <button class="brand-button" type="button" aria-label="返回题目" @click="goBack">
        <BrandLogo :size="28" />
      </button>
      <div class="topbar-divider"></div>
      <span class="page-name">随机测试生成</span>
      <el-button :icon="Back" text @click="goBack">返回题目</el-button>
    </header>

    <main v-loading="loading" class="page-content">
      <el-result
        v-if="!loading && loadError"
        icon="error"
        title="页面加载失败"
        :sub-title="loadError"
      >
        <template #extra><el-button type="primary" @click="loadPage">重新加载</el-button></template>
      </el-result>

      <el-result
        v-else-if="!loading && !authorized"
        icon="warning"
        title="无操作权限"
        sub-title="只有管理员可以生成随机测试用例"
      >
        <template #extra><el-button @click="goBack">返回题目</el-button></template>
      </el-result>

      <template v-else-if="questionData && authorized">
        <section class="page-heading">
          <div>
            <span class="eyebrow">FUNCTION · JAVA</span>
            <h1>随机测试生成</h1>
            <p>{{ questionData.questionId }}. {{ questionData.title }}</p>
          </div>
          <el-tag type="warning" effect="plain">仅管理员</el-tag>
        </section>

        <div class="generator-layout">
          <section class="code-section">
            <div class="section-heading">
              <div>
                <h2>Java 标准答案</h2>
                <p>随机输入会使用这份代码计算预期输出。</p>
              </div>
              <el-tag size="small" type="info" effect="plain">{{ methodSignature }}</el-tag>
            </div>
            <el-input
              v-model="standardAnswer"
              type="textarea"
              :rows="24"
              resize="vertical"
              spellcheck="false"
              class="code-input"
              :disabled="generating"
              @keydown.tab.prevent="handleCodeTab"
            />
          </section>

          <aside class="settings-panel">
            <section class="settings-section">
              <div class="section-heading compact-heading">
                <div>
                  <h2>生成设置</h2>
                  <p>生成结果会直接写入隐藏判题用例。</p>
                </div>
              </div>

              <el-form label-position="top" class="generator-form">
                <el-form-item label="生成数量">
                  <el-input-number
                    v-model="caseCount"
                    :min="1"
                    :max="100"
                    controls-position="right"
                    class="full-width"
                    :disabled="generating"
                  />
                </el-form-item>
                <el-form-item label="随机种子（可选）">
                  <el-input v-model="seed" clearable placeholder="留空自动生成" :disabled="generating" />
                  <span class="field-tip">相同种子可以复现同一批随机输入。</span>
                </el-form-item>
              </el-form>

              <el-alert
                title="随机参数只保证类型正确，不保证满足题目的跨参数约束。"
                type="warning"
                :closable="false"
                show-icon
              />

              <el-button
                type="primary"
                size="large"
                :icon="MagicStick"
                :loading="generating"
                class="generate-button"
                @click="startGeneration"
              >
                开始生成
              </el-button>
            </section>

            <section v-if="task" class="task-section" :class="`is-${task.status.toLowerCase()}`">
              <div class="task-status-row">
                <span class="task-status-title">{{ taskStatusText }}</span>
                <span class="task-count">{{ task.generatedCount || 0 }}/{{ task.requestedCount }}</span>
              </div>
              <el-progress
                v-if="task.status === 'PENDING'"
                :percentage="35"
                :indeterminate="true"
                :show-text="false"
              />
              <div v-else-if="task.status === 'SUCCESS'" class="task-message success-message">
                <el-icon><CircleCheck /></el-icon>
                <span>已写入 {{ task.generatedCount }} 个隐藏测试用例</span>
              </div>
              <div v-else class="task-message failure-message">
                <el-icon><Warning /></el-icon>
                <span>{{ task.errorMessage || '生成失败，请检查标准答案' }}</span>
              </div>
              <dl class="task-meta">
                <div><dt>任务 ID</dt><dd>{{ task.taskId }}</dd></div>
                <div><dt>随机种子</dt><dd>{{ task.seed ?? '-' }}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Back, CircleCheck, MagicStick, Warning } from '@element-plus/icons-vue'
import questionApi from '@/api/questionApi'
import type { FunctionTestCaseGenerationTask } from '@/api/questionApi'
import { useUserStore } from '@/stores/User'
import { logWarn } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const loadError = ref('')
const questionData = ref<any>(null)
const standardAnswer = ref('')
const caseCount = ref(20)
const seed = ref('')
const generating = ref(false)
const task = ref<FunctionTestCaseGenerationTask | null>(null)
let pollTimer: number | undefined

const questionId = computed(() => {
  const value = Array.isArray(route.query.questionId) ? route.query.questionId[0] : route.query.questionId
  return Number(value)
})

const authorized = computed(() => userStore.isAdmin)

const functionParameters = computed<Array<{ type: string; name: string }>>(() => {
  try {
    const raw = questionData.value?.functionConfig?.parameterConfig
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(value)) return []
    return value.map((item) => ({ type: String(item?.type || ''), name: String(item?.name || '') }))
  } catch {
    return []
  }
})

const methodSignature = computed(() => {
  const config = questionData.value?.functionConfig || {}
  const parameters = functionParameters.value.map((item) => `${item.type} ${item.name}`).join(', ')
  return `${config.outputType || 'void'} ${config.methodName || 'solve'}(${parameters})`
})

const taskStatusText = computed(() => {
  if (task.value?.status === 'SUCCESS') return '生成完成'
  if (task.value?.status === 'FAILED') return '生成失败'
  return '正在生成'
})

const getStarterCode = () => {
  const config = questionData.value?.functionConfig || {}
  const className = String(config.className || 'Solution')
  const outputType = String(config.outputType || 'void')
  const parameters = functionParameters.value.map((item) => `${item.type} ${item.name}`).join(', ')
  const returnStatement = outputType === 'void' ? '' : `\n    return ${getDefaultValue(outputType)};`
  return `import java.util.*;\n\npublic class ${className} {\n  public ${outputType} ${config.methodName || 'solve'}(${parameters}) {\n    // 请填写正确的标准答案${returnStatement}\n  }\n}`
}

const getDefaultValue = (type: string) => {
  if (type === 'boolean') return 'false'
  if (['byte', 'short', 'int', 'long', 'float', 'double'].includes(type)) return '0'
  if (type === 'char') return "'\\0'"
  return 'null'
}

const handleCodeTab = (event: KeyboardEvent) => {
  const textarea = event.target as HTMLTextAreaElement | null
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = standardAnswer.value

  if (event.shiftKey) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const removeCount = value.slice(lineStart, start).startsWith('  ') ? 2 : value.slice(lineStart, start).startsWith('\t') ? 1 : 0
    if (!removeCount) return
    standardAnswer.value = value.slice(0, lineStart) + value.slice(lineStart + removeCount)
    requestAnimationFrame(() => {
      textarea.selectionStart = Math.max(lineStart, start - removeCount)
      textarea.selectionEnd = Math.max(lineStart, end - removeCount)
    })
    return
  }

  standardAnswer.value = value.slice(0, start) + '  ' + value.slice(end)
  requestAnimationFrame(() => {
    textarea.selectionStart = start + 2
    textarea.selectionEnd = start + 2
  })
}

const loadPage = async () => {
  loading.value = true
  loadError.value = ''
  try {
    if (!Number.isSafeInteger(questionId.value) || questionId.value <= 0) throw new Error('缺少有效的题目 ID')
    const [questionResponse]: any[] = await Promise.all([
      questionApi.getQuestionById(questionId.value),
      userStore.ensureRoleId(),
    ])
    questionData.value = questionResponse?.data ?? questionResponse
    if (questionData.value?.questionType !== 'FUNCTION') throw new Error('仅核心函数题支持随机测试生成')
    if (authorized.value && !standardAnswer.value) standardAnswer.value = getStarterCode()
  } catch (error: any) {
    logWarn('加载随机测试生成页面失败:', error)
    loadError.value = error?.message || '加载题目信息失败'
  } finally {
    loading.value = false
  }
}

const stopPolling = () => {
  if (pollTimer) window.clearTimeout(pollTimer)
  pollTimer = undefined
}

const pollTask = async (taskId: string) => {
  try {
    const response: any = await questionApi.getFunctionTestCaseGenerationStatus(taskId)
    task.value = response?.data ?? response
    if (task.value?.status === 'PENDING') {
      pollTimer = window.setTimeout(() => pollTask(taskId), 1500)
      return
    }
    generating.value = false
    if (task.value?.status === 'SUCCESS') ElMessage.success('随机测试用例生成完成')
    else ElMessage.error(task.value?.errorMessage || '随机测试用例生成失败')
  } catch (error) {
    generating.value = false
    logWarn('查询随机测试任务失败:', error)
    // 状态查询走的是 silent 轮询（失败不弹全局提示），这里必须把任务落到失败态，
    // 否则卡片会永远停在"正在生成"，用户无从判断。
    if (task.value) {
      task.value = { ...task.value, status: 'FAILED', errorMessage: '查询任务状态失败，请重新生成' }
    } else {
      ElMessage.error('查询任务状态失败，请稍后重试')
    }
  }
}

const startGeneration = async () => {
  if (!authorized.value || generating.value) return
  if (!standardAnswer.value.trim()) {
    ElMessage.warning('请填写 Java 标准答案')
    return
  }
  if (seed.value.trim() && !/^-?\d+$/.test(seed.value.trim())) {
    ElMessage.warning('随机种子必须是整数')
    return
  }

  stopPolling()
  generating.value = true
  task.value = null
  try {
    const response: any = await questionApi.generateFunctionTestCases({
      questionId: questionId.value,
      language: 'java',
      standardAnswer: standardAnswer.value,
      count: caseCount.value,
      ...(seed.value.trim() ? { seed: seed.value.trim() } : {}),
    })
    task.value = response?.data ?? response
    if (task.value?.status === 'PENDING' && task.value.taskId) {
      pollTimer = window.setTimeout(() => pollTask(task.value!.taskId), 800)
    } else {
      generating.value = false
    }
  } catch (error) {
    generating.value = false
    logWarn('创建随机测试生成任务失败:', error)
  }
}

const goBack = () => {
  router.replace({ path: '/questiondetailview', query: { questionId: questionId.value } })
}

onMounted(loadPage)
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.generator-page {
  min-height: 100vh; min-height: 100dvh;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
}

.topbar {
  height: 58px;
  padding: 0 30px;
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--cw-border);
}

.brand-button {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.topbar-divider {
  width: 1px;
  height: 22px;
  background: var(--cw-border);
}

.page-name {
  flex: 1;
  color: var(--cw-text-1);
  font-size: 14px;
  font-weight: 600;
}

.page-content {
  width: min(1220px, calc(100% - 48px));
  min-height: calc(100vh - 58px); min-height: calc(100dvh - 58px);
  margin: 0 auto;
  padding: 36px 0 56px;
}

.page-heading {
  margin-bottom: 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  color: var(--cw-brand-dark);
  font-size: 12px;
  font-weight: 700;
}

.page-heading h1 {
  margin: 8px 0 5px;
  font-size: 27px;
}

.page-heading p,
.section-heading p {
  margin: 0;
  color: var(--cw-text-3);
  font-size: 13px;
}

.generator-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}

.code-section,
.settings-section,
.task-section {
  padding: 22px;
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.section-heading {
  margin-bottom: 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.section-heading h2 {
  margin: 0 0 5px;
  color: var(--cw-text-1);
  font-size: 17px;
}

.section-heading .el-tag {
  max-width: 54%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.code-input :deep(.el-textarea__inner) {
  min-height: 560px !important;
  padding: 16px 18px;
  border-radius: 6px;
  background: #ffffff;
  color: #2f343b;
  box-shadow: 0 0 0 1px #dfe3e8 inset;
  font-family: var(--cw-font-mono);
  font-size: 13px;
  line-height: 1.7;
}

.code-input :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #aeb6c0 inset, 0 0 0 3px rgba(255, 161, 22, 0.12);
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.compact-heading {
  margin-bottom: 20px;
}

.generator-form .full-width,
.generate-button {
  width: 100%;
}

.field-tip {
  margin-top: 5px;
  color: var(--cw-text-3);
  font-size: 12px;
}

.generate-button {
  margin-top: 20px;
  --el-button-bg-color: var(--cw-brand);
  --el-button-border-color: var(--cw-brand);
  --el-button-hover-bg-color: var(--cw-brand-dark);
  --el-button-hover-border-color: var(--cw-brand-dark);
}

.task-section {
  box-shadow: none;
}

.task-section.is-success {
  border-color: var(--cw-success-soft);
}

.task-section.is-failed {
  border-color: #f1c1c1;
}

.task-status-row,
.task-message,
.task-meta div {
  display: flex;
  align-items: center;
}

.task-status-row {
  justify-content: space-between;
  margin-bottom: 12px;
}

.task-status-title {
  font-size: 14px;
  font-weight: 700;
}

.task-count {
  color: var(--cw-text-3);
  font-size: 12px;
}

.task-message {
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.success-message {
  color: var(--cw-success);
}

.failure-message {
  color: var(--cw-danger);
}

.task-meta {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--cw-bg-subtle);
}

.task-meta div {
  justify-content: space-between;
  gap: 12px;
  margin-top: 7px;
  font-size: 11px;
}

.task-meta dt {
  color: var(--cw-text-3);
}

.task-meta dd {
  margin: 0;
  overflow: hidden;
  color: #5f6670;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .generator-layout {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    grid-row: 1;
  }

  .code-input :deep(.el-textarea__inner) {
    min-height: 420px !important;
  }
}

@media (max-width: 560px) {
  .topbar {
    padding: 0 16px;
  }

  .page-content {
    width: calc(100% - 28px);
    padding-top: 24px;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-heading {
    flex-direction: column;
  }

  .section-heading .el-tag {
    max-width: 100%;
  }
}
</style>
