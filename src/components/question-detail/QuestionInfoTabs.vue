<template>
  <el-tabs :model-value="activeTab" class="tabs" @update:model-value="$emit('update:activeTab', String($event))" @tab-click="$emit('tab-click', $event)">
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
        <div class="section-title">题目描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.description || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">输入描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.inputDesc || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">输出描述</div>
        <div class="markdown-body" v-html="renderContent(questionData?.outputDesc || '（无）')"></div>
      </div>

      <div class="section">
        <div class="section-title">样例</div>
        <div class="sample-grid">
          <div v-for="(tc, index) in sampleCases" :key="index" class="sample-box">
            <div class="sample-label">样例输入</div>
            <pre>{{ tc.inputData }}</pre>
            <div class="sample-label sample-output-label">样例输出</div>
            <pre>{{ tc.expectedOutput }}</pre>
          </div>
        </div>
      </div>

      <div v-if="questionData?.hint" class="section">
        <div class="section-title">提示</div>
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
      <QuestionSolutionPanel
        :active="activeTab === 'solution'"
        :question-id="questionData?.questionId || ''"
        :question-title="questionData?.title"
        :initial-solution-id="initialSolutionId"
      />
    </el-tab-pane>

    <el-tab-pane label="提交记录" name="submissions">
      <div v-if="submissionsLoading" class="submissions-loading">
        <el-skeleton :rows="5" animated />
      </div>
      <el-empty v-else-if="submissionsList.length === 0" description="暂无提交记录" />
      <div v-else class="submissions-list">
        <el-table :data="submissionsList" stripe style="width: 100%;" :header-cell-style="{ background: '#f5f7fa' }">
          <el-table-column prop="status" label="状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.submitStatus)" size="small">
                {{ row.submitStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="timeUsed" label="耗时" width="100" align="center">
            <template #default="{ row }">
              <span>{{ row.timeUsed || '-' }} ms</span>
            </template>
          </el-table-column>
          <el-table-column prop="memoryUsed" label="内存" width="120" align="center">
            <template #default="{ row }">
              <span>{{ row.memoryUsed ? (row.memoryUsed / 1024).toFixed(2) + ' MB' : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="language" label="语言" width="100" align="center">
            <template #default="{ row }">
              <el-tag link type="primary">{{ row.language }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="submitTime" label="提交时间" min-width="160">
            <template #default="{ row }">
              <span>{{ formatTime(row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" text @click="$emit('view-code', row)">查看代码</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-tab-pane>

    <el-tab-pane label="测试用例" name="testcases">
      <div class="testcase-editor">
        <div class="testcase-toolbar">
          <el-button v-if="!isFunctionQuestion" size="small" type="primary" @click="$emit('add-testcase')">
            添加用例
          </el-button>
          <el-button size="small" plain @click="$emit('reset-to-sample')">
            重置为样例
          </el-button>
          <el-button size="small" type="success" :loading="debugging" @click="$emit('debug')">
            调试运行
          </el-button>
          <el-tooltip v-if="canProvideTests" content="将自定义用例补充到这道题的判题数据中" placement="top">
            <el-button
              size="small"
              type="warning"
              plain
              :icon="Upload"
              :loading="providingTests"
              @click="$emit('provide-tests')"
            >
              提供测试
            </el-button>
          </el-tooltip>
          <el-button
            v-if="canGenerateRandom"
            size="small"
            type="primary"
            plain
            :icon="MagicStick"
            @click="$emit('generate-random')"
          >
            随机生成
          </el-button>
          <span class="testcase-hint">
            {{ isFunctionQuestion ? '每个参数单独填写，数组使用 JSON 格式' : '点击卡片查看结果 | 双击卡片编辑' }}
          </span>
        </div>

        <div v-if="isFunctionQuestion" class="function-cases">
          <div class="function-case-tabs">
            <el-button
              :icon="ArrowLeft"
              circle
              text
              size="small"
              aria-label="向前查看更多样例"
              @click="scrollFunctionCases(-1)"
            />
            <div ref="functionCaseTabRail" class="function-case-tab-rail" @wheel.prevent="handleFunctionCaseWheel">
              <button
                v-for="(_, index) in debugTestCases"
                :key="index"
                type="button"
                class="function-case-tab"
                :class="{ active: activeFunctionCaseIndex === index }"
                @click="$emit('select-testcase', index)"
              >
                样例 {{ index + 1 }}
                <span v-if="debugTestCases[index]?.passed" class="case-result-dot passed"></span>
                <span v-else-if="debugTestCases[index]?.result" class="case-result-dot failed"></span>
              </button>
            </div>
            <el-button
              :icon="ArrowRight"
              circle
              text
              size="small"
              aria-label="向后查看更多样例"
              @click="scrollFunctionCases(1)"
            />
            <el-tooltip content="添加样例" placement="top">
              <el-button :icon="Plus" circle text size="small" aria-label="添加样例" @click="$emit('add-testcase')" />
            </el-tooltip>
          </div>

          <div v-if="activeFunctionCase" class="function-case-panel">
            <div class="function-case-panel-header">
              <div>
                <span class="function-case-title">样例 {{ activeFunctionCaseIndex + 1 }}</span>
                <el-tag v-if="activeFunctionCase.provided" type="success" size="small">已提供</el-tag>
                <el-tag v-else-if="activeFunctionCase.result" :type="activeFunctionCase.passed ? 'success' : 'danger'" size="small">
                  {{ activeFunctionCase.result.submitStatus }}
                </el-tag>
              </div>
              <el-tooltip content="删除当前样例" placement="top">
                <el-button
                  :icon="Delete"
                  circle
                  text
                  type="danger"
                  aria-label="删除当前样例"
                  @click="$emit('remove-testcase', activeFunctionCaseIndex)"
                />
              </el-tooltip>
            </div>

            <div class="function-parameter-list">
              <div v-for="(parameter, index) in functionParameters" :key="`${parameter.name}-${index}`" class="function-parameter-field">
                <div class="function-parameter-label">
                  <span>{{ parameter.name }}</span>
                  <code>{{ parameter.type }}</code>
                </div>
                <el-input
                  :model-value="getFunctionParameterValue(activeFunctionCase, index)"
                  type="textarea"
                  :rows="parameter.type.includes('[]') ? 2 : 1"
                  resize="none"
                  spellcheck="false"
                  :placeholder="getFunctionParameterPlaceholder(parameter.type)"
                  @update:model-value="updateFunctionParameter(activeFunctionCase, index, String($event))"
                />
              </div>
            </div>

            <div class="function-parameter-field expected-output-field">
              <div class="function-parameter-label">
                <span>预期输出</span>
                <code>{{ questionData?.functionConfig?.outputType || '返回值' }}</code>
              </div>
              <el-input
                :model-value="activeFunctionCase.expectedOutput"
                type="textarea"
                :rows="2"
                resize="none"
                spellcheck="false"
                placeholder="可留空，仅查看实际输出"
                @update:model-value="updateFunctionExpectedOutput(activeFunctionCase, String($event))"
              />
            </div>
          </div>
        </div>

        <div v-else class="testcase-list">
          <div
            v-for="(tc, index) in debugTestCases"
            :key="index"
            class="testcase-card"
            :class="{
              'is-active': selectedTestCaseIndex === index,
              'has-result': tc.result,
              passed: tc.passed,
              failed: tc.result && !tc.passed,
              'is-editing': editingTestCaseIndex === index,
            }"
            @click="$emit('select-testcase', index)"
            @dblclick="$emit('start-edit-testcase', index)"
          >
            <div class="testcase-card-header">
              <span class="testcase-card-index">用例 {{ index + 1 }}</span>
              <div class="testcase-card-actions">
                <el-button size="small" text type="primary" @click.stop="$emit('start-edit-testcase', index)">
                  编辑
                </el-button>
                <el-button size="small" text type="danger" class="testcase-card-delete" @click.stop="$emit('remove-testcase', index)">
                  删除
                </el-button>
              </div>
            </div>

            <template v-if="editingTestCaseIndex !== index">
              <div class="testcase-card-preview">
                {{ tc.input ? tc.input.slice(0, 40) + (tc.input.length > 40 ? '...' : '') : '（空）' }}
              </div>
              <div class="testcase-card-footer">
                <el-tag v-if="tc.provided" type="success" size="small">已提供</el-tag>
                <el-tag v-else-if="tc.result" type="primary">
                  {{ tc.result.submitStatus }}
                </el-tag>
                <el-tag v-else type="info" size="small">等待</el-tag>
                <span v-if="tc.result" class="testcase-card-metrics">
                  {{ tc.result.timeUsed || 0 }}ms
                </span>
              </div>
            </template>

            <template v-else>
              <div class="testcase-edit-body">
                <div class="testcase-edit-input">
                  <div class="testcase-edit-label">输入</div>
                  <el-input v-model="tc.input" type="textarea" :rows="2" placeholder="请输入测试输入" spellcheck="false" @click.stop />
                </div>
                <div class="testcase-edit-output">
                  <div class="testcase-edit-label">期望输出</div>
                  <el-input v-model="tc.expectedOutput" type="textarea" :rows="2" placeholder="留空则只显示实际输出" spellcheck="false" @click.stop />
                </div>
                <div class="testcase-edit-actions">
                  <el-button size="small" type="primary" @click.stop="$emit('finish-edit-testcase')">
                    完成编辑
                  </el-button>
                  <el-button size="small" @click.stop="$emit('cancel-edit-testcase')">
                    取消
                  </el-button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <el-empty v-if="debugTestCases.length === 0" description="暂无测试用例，点击添加用例创建" />
      </div>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { ArrowLeft, ArrowRight, Delete, MagicStick, Plus, Upload } from '@element-plus/icons-vue'
import type { DebugTestCase, SampleCase } from '@/types/QuestionDetail'
import QuestionSolutionPanel from '@/components/question-detail/QuestionSolutionPanel.vue'

const props = defineProps<{
  activeTab: string
  questionData: any
  difficultyTag: string
  difficultyText: string
  sampleCases: SampleCase[]
  passRate: string | number
  renderContent: (content: string) => string | Promise<string>
  submissionsLoading: boolean
  submissionsList: any[]
  getStatusType: (status: string) => string
  formatTime: (time: string) => string
  debugTestCases: DebugTestCase[]
  selectedTestCaseIndex: number | null
  editingTestCaseIndex: number | null
  debugging: boolean
  canProvideTests: boolean
  providingTests: boolean
  canGenerateRandom: boolean
  initialSolutionId?: string
}>()

defineEmits<{
  (event: 'update:activeTab', value: string): void
  (event: 'tab-click', value: TabsPaneContext): void
  (event: 'view-code', value: any): void
  (event: 'add-testcase'): void
  (event: 'reset-to-sample'): void
  (event: 'debug'): void
  (event: 'provide-tests'): void
  (event: 'generate-random'): void
  (event: 'select-testcase', value: number): void
  (event: 'start-edit-testcase', value: number): void
  (event: 'remove-testcase', value: number): void
  (event: 'finish-edit-testcase'): void
  (event: 'cancel-edit-testcase'): void
}>()

interface FunctionParameter {
  type: string
  name: string
}

const isFunctionQuestion = computed(() => props.questionData?.questionType === 'FUNCTION')

const functionParameters = computed<FunctionParameter[]>(() => {
  try {
    const raw = props.questionData?.functionConfig?.parameterConfig
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(value)) return []
    return value
      .map((item) => ({ type: String(item?.type || ''), name: String(item?.name || '') }))
      .filter((item) => item.type && item.name)
  } catch {
    return []
  }
})

const activeFunctionCaseIndex = computed(() => {
  const selected = props.selectedTestCaseIndex
  if (selected !== null && selected >= 0 && selected < props.debugTestCases.length) return selected
  return 0
})

const activeFunctionCase = computed(() => props.debugTestCases[activeFunctionCaseIndex.value] || null)
const functionCaseTabRail = ref<HTMLElement | null>(null)

const scrollFunctionCases = (direction: -1 | 1) => {
  functionCaseTabRail.value?.scrollBy({ left: direction * 180, behavior: 'smooth' })
}

const handleFunctionCaseWheel = (event: WheelEvent) => {
  if (!functionCaseTabRail.value) return
  functionCaseTabRail.value.scrollLeft += event.deltaY || event.deltaX
}

watch(activeFunctionCaseIndex, () => {
  nextTick(() => {
    functionCaseTabRail.value
      ?.querySelector<HTMLElement>('.function-case-tab.active')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  })
})

const getFunctionInputValues = (testCase: DebugTestCase) => {
  const values = testCase.input.split(/\r?\n/)
  while (values.length < functionParameters.value.length) values.push('')
  return values.slice(0, functionParameters.value.length)
}

const getFunctionParameterValue = (testCase: DebugTestCase, index: number) => {
  return getFunctionInputValues(testCase)[index] || ''
}

const updateFunctionParameter = (testCase: DebugTestCase, index: number, value: string) => {
  const values = getFunctionInputValues(testCase)
  values[index] = value
  testCase.input = values.join('\n')
  testCase.provided = false
}

const updateFunctionExpectedOutput = (testCase: DebugTestCase, value: string) => {
  testCase.expectedOutput = value
  testCase.provided = false
}

const getFunctionParameterPlaceholder = (type: string) => {
  if (type.includes('[]')) return type === 'String[]' ? '["a", "b"]' : '[1, 2, 3]'
  if (type === 'String' || type === 'char' || type === 'Character') return '输入字符串'
  if (type === 'boolean' || type === 'Boolean') return 'true'
  return '输入参数值'
}
</script>

<style scoped>
.tabs {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
  margin: 0 0 20px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
  padding-top: 16px;
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
  border-bottom: 1px solid var(--cw-bg-page);
}

.question-id {
  font-size: 13px;
  color: var(--cw-text-3);
}

.question-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--cw-text-1);
}

.meta-info {
  font-size: 13px;
  color: var(--cw-text-3);
  margin-left: auto;
}

.section {
  margin-bottom: 28px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--cw-text-1);
  margin-bottom: 10px;
}

.markdown-body {
  font-size: 15px;
  line-height: 1.9;
  color: var(--cw-text-1);
}

.markdown-body :deep(p) {
  margin: 10px 0;
}

.markdown-body :deep(code) {
  background: var(--cw-bg-page);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--cw-font-mono);
  font-size: 14px;
}

.markdown-body :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px 18px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.7;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 10px 0;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.sample-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 8px;
}

.sample-box {
  background: var(--cw-bg-page);
  border-radius: 8px;
  padding: 14px 18px;
  border: 1px solid var(--cw-border);
}

.sample-box pre {
  font-family: var(--cw-font-mono);
  font-size: 14px;
  color: var(--cw-text-1);
  margin: 6px 0 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

.sample-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--cw-text-3);
}

.sample-output-label {
  margin-top: 8px;
}

.stats-bar {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--cw-bg-page);
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: var(--cw-text-3);
  flex-wrap: wrap;
}

.submissions-list {
  padding: 8px 0;
  height: 100%;
  overflow-y: auto;
  max-height: calc(100vh - 350px); max-height: calc(100dvh - 350px);
  max-height: calc(100dvh - 350px);
}

.submissions-list .el-table {
  width: 100%;
}

.submissions-list :deep(.el-table__body-wrapper) {
  overflow-y: auto !important;
}

.submissions-list :deep(.el-table__row:hover) {
  background: #f0f2f5;
}

.submissions-loading {
  padding: 20px;
}

.testcase-editor {
  padding: 4px 0;
}

.testcase-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.testcase-hint {
  font-size: 12px;
  color: var(--cw-text-3);
  margin-left: auto;
}

.function-cases {
  min-height: 0;
}

.function-case-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  min-width: 0;
}

.function-case-tabs > .el-button {
  flex: 0 0 auto;
}

.function-case-tab-rail {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 0 0 5px;
  scrollbar-width: thin;
  scrollbar-color: var(--cw-border) transparent;
}

.function-case-tab-rail::-webkit-scrollbar {
  height: 4px;
}

.function-case-tab-rail::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--cw-border);
}

.function-case-tab {
  position: relative;
  min-width: 76px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #656d78;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.function-case-tab:hover {
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
}

.function-case-tab.active {
  background: #e9eaec;
  color: var(--cw-text-1);
  font-weight: 600;
}

.case-result-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.case-result-dot.passed {
  background: var(--cw-success);
}

.case-result-dot.failed {
  background: var(--cw-danger);
}

.function-case-panel {
  padding: 18px;
  border: 1px solid var(--cw-border);
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.04);
}

.function-case-panel-header {
  min-height: 30px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.function-case-panel-header > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.function-case-title {
  color: var(--cw-text-1);
  font-size: 14px;
  font-weight: 650;
}

.function-parameter-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.function-parameter-field {
  min-width: 0;
}

.function-parameter-label {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #3f454d;
  font-size: 13px;
  font-weight: 600;
}

.function-parameter-label code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #e9ebee;
  color: #7b828c;
  font-family: var(--cw-font-mono);
  font-size: 11px;
  font-weight: 500;
}

.function-parameter-field :deep(.el-textarea__inner) {
  padding: 9px 11px;
  border: 0;
  background: #ffffff;
  box-shadow: 0 0 0 1px #dfe2e6 inset;
  color: #25282d;
  font-family: var(--cw-font-mono);
  font-size: 13px;
  line-height: 1.55;
}

.function-parameter-field :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #b8bdc5 inset;
}

.expected-output-field {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e4e8;
}

.testcase-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px); max-height: calc(100dvh - 300px);
  overflow-y: auto;
  padding-right: 4px;
}

.testcase-card {
  background: var(--cw-bg-page);
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.testcase-card:hover {
  background: #eef2f7;
  border-color: var(--cw-border);
}

.testcase-card.is-active {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.testcase-card.passed {
  border-left: 4px solid var(--cw-success);
}

.testcase-card.failed {
  border-left: 4px solid var(--cw-danger);
}

.testcase-card.is-editing {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
  cursor: default;
}

.testcase-card.is-editing:hover {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.testcase-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.testcase-card-index {
  font-weight: 600;
  font-size: 13px;
  color: var(--cw-text-1);
}

.testcase-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.testcase-card-actions .el-button {
  padding: 0 4px;
  font-size: 12px;
}

.testcase-card-delete {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.testcase-card-delete:hover {
  opacity: 1;
}

.testcase-card-preview {
  font-size: 13px;
  color: var(--cw-text-2);
  margin: 4px 0;
  font-family: var(--cw-font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.testcase-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.testcase-card-metrics {
  font-size: 12px;
  color: var(--cw-text-3);
}

.testcase-edit-body {
  width: 100%;
  padding: 4px 0;
}

.testcase-edit-input,
.testcase-edit-output {
  margin-bottom: 8px;
}

.testcase-edit-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--cw-text-2);
  margin-bottom: 2px;
}

.testcase-edit-body .el-textarea {
  font-family: var(--cw-font-mono);
}

.testcase-edit-body .el-textarea :deep(textarea) {
  font-size: 13px;
  background: #fff;
}

.testcase-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

@media (max-width: 1024px) {
  .sample-grid {
    grid-template-columns: 1fr;
  }

  .question-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .meta-info {
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  /* 用例页签在触屏上要能点准 */
  .function-case-tab {
    height: var(--cw-tap-target);
  }
}
</style>
