<template>
  <div class="testcase-page">
    <main class="page-content">
      <section class="page-heading">
        <div>
          <span class="eyebrow">ADMIN · TEST CASES</span>
          <h1>测试点管理</h1>
          <p>查看各题目的测试点数量，维护测试点的输入输出、可见性与限制。</p>
        </div>
        <el-button :icon="Refresh" :loading="overviewLoading" @click="refreshPage">刷新</el-button>
      </section>

      <div class="testcase-layout">
        <!-- 题目概览 -->
        <section class="panel-card overview-card">
          <header class="card-header">
            <div>
              <h2>题目概览</h2>
              <span>ACM 概览：{{ overview.total }} 道题有测试点</span>
            </div>
          </header>
          <div class="overview-filter">
            <el-input v-model="questionFilter" placeholder="按题目 ID 过滤" size="small" clearable />
            <el-input v-model="questionIdInput" placeholder="输入题目 ID（支持无用例题目）" size="small" @keyup.enter="selectByInput" />
            <el-button size="small" :disabled="casesLoading || saving" @click="selectByInput">选择题目</el-button>
          </div>
          <div v-loading="overviewLoading" class="overview-list">
            <button
              v-for="item in filteredOverview"
              :key="item.questionId"
              type="button"
              class="overview-item"
              :class="{ active: item.questionId === selectedQuestionId }"
              :disabled="saving"
              @click="selectQuestion(item.questionId)"
            >
              <span class="overview-id">#{{ item.questionId }}</span>
              <span class="overview-count">{{ item.count }} 个用例</span>
            </button>
            <p v-if="!overviewLoading && filteredOverview.length === 0" class="empty-tip">无匹配题目</p>
          </div>
        </section>

        <!-- 测试点列表 -->
        <section class="panel-card cases-card">
          <header class="card-header">
            <div>
              <h2>{{ selectedQuestionId ? `题目 #${selectedQuestionId} 的测试点` : '测试点列表' }}</h2>
              <span>{{ selectedQuestionType === 'FUNCTION' ? 'FUNCTION · 批量添加' : `${cases.length} 条` }}</span>
            </div>
            <el-button
              v-if="selectedQuestionType === 'ACM'"
              type="primary"
              size="small"
              :disabled="!selectedQuestionId || casesLoading || !!casesError || saving"
              :icon="Plus"
              @click="openCreate"
            >新增用例</el-button>
          </header>

          <el-alert v-if="casesError" :title="casesError" type="error" :closable="false" show-icon class="load-alert" />

          <section v-if="selectedQuestionType === 'FUNCTION' && !casesLoading && !casesError" class="function-batch">
            <el-alert title="填写 JSON 数组，每项包含 input、output 字符串；input 按函数参数顺序逐行填写，字符串参数可用原始文本。新增用例默认为隐藏。" type="info" :closable="false" show-icon />
            <p>左侧概览仅统计 ACM 测试点，函数用例数量不在该概览中。</p>
            <el-form label-position="top" @submit.prevent="saveFunctionBatch">
              <el-form-item label="批量测试用例">
                <el-input v-model="functionBatch" type="textarea" :rows="12" :disabled="saving" :placeholder="batchPlaceholder" />
              </el-form-item>
              <div class="batch-actions">
                <el-button type="primary" native-type="submit" :loading="saving">批量添加</el-button>
                <el-button @click="goGenerator">随机测试生成</el-button>
              </div>
            </el-form>
          </section>
          <el-table v-else v-loading="casesLoading" :data="cases" empty-text="左侧选择题目后查看测试点" row-key="caseId">
            <el-table-column label="用例 ID" min-width="90">
              <template #default="{ row }">#{{ row.caseId }}</template>
            </el-table-column>
            <el-table-column label="输入" min-width="200" show-overflow-tooltip>
              <template #default="{ row }"><pre class="io-cell">{{ row.inputData }}</pre></template>
            </el-table-column>
            <el-table-column label="期望输出" min-width="180" show-overflow-tooltip>
              <template #default="{ row }"><pre class="io-cell">{{ row.expectedOutput }}</pre></template>
            </el-table-column>
            <el-table-column label="属性" width="150" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.isSample === 1" size="small" type="success" effect="plain">样例</el-tag>
                <el-tag v-if="row.isHidden === 1" size="small" type="warning" effect="plain">隐藏</el-tag>
                <el-tag v-else size="small" effect="plain">可见</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="顺序" width="70" align="center" />
            <el-table-column label="分值" width="70" align="center">
              <template #default="{ row }">{{ row.scoreWeight ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="限制" width="130" align="center">
              <template #default="{ row }">
                <span class="limit-cell">{{ limitText(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button link type="danger" @click="removeCase(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </main>

    <!-- 新增/编辑用例弹窗 -->
    <el-dialog v-model="editorVisible" :title="editingCaseId ? `编辑用例 #${editingCaseId}` : '新增测试点'" width="620px">
      <el-form label-position="top">
        <el-form-item label="输入（inputData）" required>
          <el-input v-model="form.inputData" type="textarea" :rows="4" placeholder="标准输入内容，留空表示无输入" />
        </el-form-item>
        <el-form-item label="期望输出（expectedOutput）" required>
          <el-input v-model="form.expectedOutput" type="textarea" :rows="4" placeholder="与标准输出逐行比较" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="样例用例">
            <el-switch v-model="form.isSampleBool" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="隐藏用例">
            <el-switch v-model="form.isHiddenBool" active-text="隐藏" inactive-text="可见" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="form.sortOrder" :min="0" :max="999" />
          </el-form-item>
          <el-form-item label="分值权重">
            <el-input-number v-model="form.scoreWeight" :min="0" :max="1000" />
          </el-form-item>
          <el-form-item label="时限（ms，留空用全局默认）">
            <el-input-number v-model="form.timeLimit" :min="0" :max="60000" />
          </el-form-item>
          <el-form-item label="内存（MB，留空用全局默认）">
            <el-input-number v-model="form.memoryLimit" :min="0" :max="2048" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCase">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminTestCaseApi, { type QuestionOverviewItem, type TestCaseItem } from '@/api/adminTestCaseApi'
import questionApi, { type FunctionTestCasePayload } from '@/api/questionApi'
import { errorText, unwrap } from '@/api/request'

const route = useRoute()
const router = useRouter()
const overview = ref<{ items: QuestionOverviewItem[]; total: number }>({ items: [], total: 0 })
const overviewLoading = ref(false)
const questionFilter = ref('')
const questionIdInput = ref('')
const selectedQuestionId = ref<number | null>(null)
const selectedQuestionType = ref<'ACM' | 'FUNCTION' | null>(null)
const cases = ref<TestCaseItem[]>([])
const casesLoading = ref(false)
const casesError = ref('')
const editorVisible = ref(false)
const saving = ref(false)
const editingCaseId = ref<number | null>(null)
const functionBatch = ref('')
const batchPlaceholder = '[{"input":"[1,2]\\n3","output":"[0,1]"}]'
let selectionVersion = 0

const emptyForm = () => ({
  inputData: '', expectedOutput: '', isSampleBool: false, isHiddenBool: true,
  sortOrder: 0, scoreWeight: 100,
  timeLimit: undefined as number | undefined, memoryLimit: undefined as number | undefined,
})
const form = reactive(emptyForm())
const filteredOverview = computed(() => {
  const text = questionFilter.value.trim()
  return text ? overview.value.items.filter((item) => String(item.questionId).includes(text)) : overview.value.items
})

function limitText(row: TestCaseItem) {
  const time = row.timeLimit ? `${row.timeLimit}ms` : null
  const memory = row.memoryLimit ? `${row.memoryLimit}MB` : null
  return [time, memory].filter(Boolean).join(' / ') || '默认'
}

async function loadOverview() {
  overviewLoading.value = true
  try {
    overview.value = await adminTestCaseApi.getQuestionOverview()
  } catch (error) {
    overview.value = { items: [], total: 0 }
    ElMessage.error(errorText(error, '题目概览加载失败'))
  } finally {
    overviewLoading.value = false
  }
}

async function loadSelection(rawId: unknown) {
  const version = ++selectionVersion
  selectedQuestionId.value = null
  selectedQuestionType.value = null
  cases.value = []
  casesError.value = ''
  casesLoading.value = false
  editorVisible.value = false
  editingCaseId.value = null
  functionBatch.value = ''
  questionIdInput.value = typeof rawId === 'string' ? rawId : ''
  if (rawId === undefined || rawId === null) return
  const questionId = Number(rawId)
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId) || !Number.isSafeInteger(questionId) || questionId <= 0) {
    casesError.value = '请输入有效的正整数题目 ID'
    return
  }
  casesLoading.value = true
  try {
    const response = await questionApi.getQuestionById(questionId)
    if (version !== selectionVersion) return
    const question = unwrap<{ questionId?: number; questionType?: string } | null>(response, null)
    if (!question || Number(question.questionId) !== questionId) throw new Error('未找到对应题目')
    if (question.questionType !== 'ACM' && question.questionType !== 'FUNCTION') throw new Error('暂不支持该题目类型')
    selectedQuestionId.value = questionId
    selectedQuestionType.value = question.questionType
    if (question.questionType === 'ACM') {
      const records = await adminTestCaseApi.listByQuestion(questionId)
      if (version === selectionVersion) cases.value = records
    }
  } catch (error) {
    if (version !== selectionVersion) return
    selectedQuestionType.value = null
    casesError.value = errorText(error, '题目或测试点加载失败')
  } finally {
    if (version === selectionVersion) casesLoading.value = false
  }
}

async function selectQuestion(questionId: number) {
  if (saving.value) return
  const id = String(questionId)
  if (route.query.questionId === id) await loadSelection(id)
  else await router.replace({ query: { ...route.query, questionId: id } })
}

function selectByInput() {
  const raw = questionIdInput.value.trim()
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) {
    ElMessage.warning('请输入有效的正整数题目 ID')
    return
  }
  void selectQuestion(Number(raw))
}

async function refreshPage() {
  await Promise.all([loadOverview(), loadSelection(route.query.questionId)])
}

function openCreate() {
  if (!selectedQuestionId.value || selectedQuestionType.value !== 'ACM' || casesLoading.value || casesError.value) return
  editingCaseId.value = null
  Object.assign(form, emptyForm())
  editorVisible.value = true
}

function openEdit(row: TestCaseItem) {
  if (selectedQuestionType.value !== 'ACM' || casesLoading.value || saving.value) return
  editingCaseId.value = row.caseId ?? null
  form.inputData = row.inputData ?? ''
  form.expectedOutput = row.expectedOutput ?? ''
  form.isSampleBool = row.isSample === 1
  form.isHiddenBool = row.isHidden !== 0
  form.sortOrder = row.sortOrder ?? 0
  form.scoreWeight = row.scoreWeight ?? 100
  form.timeLimit = row.timeLimit ?? undefined
  form.memoryLimit = row.memoryLimit ?? undefined
  editorVisible.value = true
}

async function saveCase() {
  if (saving.value || selectedQuestionType.value !== 'ACM' || !selectedQuestionId.value || casesLoading.value) return
  if (!form.expectedOutput.trim()) {
    ElMessage.warning('期望输出不能为空')
    return
  }
  const questionId = selectedQuestionId.value
  const version = selectionVersion
  const payload = {
    inputData: form.inputData, expectedOutput: form.expectedOutput,
    isSample: form.isSampleBool ? 1 : 0, isHidden: form.isHiddenBool ? 1 : 0,
    sortOrder: form.sortOrder ?? 0, scoreWeight: form.scoreWeight ?? 100,
    timeLimit: form.timeLimit ?? null, memoryLimit: form.memoryLimit ?? null,
  }
  saving.value = true
  try {
    if (editingCaseId.value) await adminTestCaseApi.update(editingCaseId.value, payload)
    else await adminTestCaseApi.add(questionId, payload)
    ElMessage.success('测试点已保存')
    if (version === selectionVersion) {
      editorVisible.value = false
      await loadSelection(String(questionId))
    }
    await loadOverview()
  } catch (error) {
    ElMessage.error(errorText(error, '保存测试点失败'))
  } finally {
    saving.value = false
  }
}

async function saveFunctionBatch() {
  if (saving.value || selectedQuestionType.value !== 'FUNCTION' || !selectedQuestionId.value || casesLoading.value) return
  let payload: FunctionTestCasePayload[]
  try {
    const parsed: unknown = JSON.parse(functionBatch.value)
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('请填写非空的测试用例数组')
    payload = parsed.map((item, index) => {
      if (!item || typeof item.input !== 'string' || typeof item.output !== 'string') {
        throw new Error(`第 ${index + 1} 个用例的 input 和 output 必须是字符串`)
      }
      return { input: item.input, output: item.output }
    })
  } catch (error) {
    ElMessage.warning(error instanceof SyntaxError ? '请填写有效的 JSON 数组' : errorText(error, '测试用例格式不正确'))
    return
  }
  const questionId = selectedQuestionId.value
  const version = selectionVersion
  saving.value = true
  try {
    const response = await questionApi.addFunctionTestCases(questionId, payload)
    const count = unwrap<number>(response, 0)
    ElMessage.success(`已添加 ${count} 个函数测试用例`)
    if (version === selectionVersion) functionBatch.value = ''
  } catch (error) {
    ElMessage.error(errorText(error, '添加函数测试用例失败'))
  } finally {
    saving.value = false
  }
}

function goGenerator() {
  if (selectedQuestionType.value !== 'FUNCTION' || !selectedQuestionId.value) return
  void router.push({ path: '/questions/function-test-generator', query: { questionId: selectedQuestionId.value } })
}

async function removeCase(row: TestCaseItem) {
  if (row.caseId == null || selectedQuestionType.value !== 'ACM' || saving.value || !selectedQuestionId.value) return
  const questionId = selectedQuestionId.value
  const version = selectionVersion
  let ownsSaving = false
  try {
    await ElMessageBox.confirm(`确认删除测试点 #${row.caseId}？该操作不可恢复。`, '删除测试点',
      { confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger', type: 'warning' })
    if (version !== selectionVersion || saving.value) return
    saving.value = true
    ownsSaving = true
    await adminTestCaseApi.remove(row.caseId)
    ElMessage.success('测试点已删除')
    if (version === selectionVersion) await loadSelection(String(questionId))
    await loadOverview()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorText(error, '删除测试点失败'))
  } finally {
    if (ownsSaving) saving.value = false
  }
}

watch(() => route.query.questionId, (id) => { void loadSelection(id) }, { immediate: true })
onMounted(loadOverview)
</script>

<style scoped>
.testcase-page { min-height: 100vh; color: var(--cw-text-1); background: var(--cw-bg-page); }
.page-content { width: min(1420px, calc(100% - 48px)); margin: 0 auto; padding: 42px 0 64px; }
.page-heading { margin-bottom: 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.eyebrow { color: var(--cw-text-3); font-size: 11px; font-weight: 700; letter-spacing: .13em; }
h1 { margin: 7px 0 5px; color: var(--cw-text-1); font-size: 28px; letter-spacing: -.03em; }
.page-heading p { margin: 0; color: var(--cw-text-3); font-size: 13px; }
.testcase-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px; align-items: start; }
.panel-card { border: 1px solid var(--cw-border); border-radius: 9px; overflow: hidden; background: #fff; }
.card-header { min-height: 64px; padding: 0 20px; border-bottom: 1px solid var(--cw-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-header > div:first-child { display: flex; align-items: baseline; gap: 10px; }
.card-header h2 { margin: 0; color: var(--cw-text-1); font-size: 16px; }
.card-header span { color: var(--cw-text-3); font-size: 11px; }
.overview-filter { padding: 12px 14px 4px; display: flex; flex-direction: column; gap: 8px; }
.function-batch { padding: 20px; }
.function-batch p { color: var(--cw-text-3); font-size: 12px; line-height: 1.7; }
.batch-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.overview-list { max-height: 620px; overflow-y: auto; padding: 8px 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.overview-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border: 1px solid transparent; border-radius: 7px; background: transparent; cursor: pointer; text-align: left; }
.overview-item:hover { background: var(--cw-bg-page); }
.overview-item.active { border-color: #3b82f6; background: #eff6ff; }
.overview-id { color: var(--cw-text-1); font-size: 13px; font-weight: 600; }
.overview-count { color: var(--cw-text-3); font-size: 11px; }
.empty-tip { color: var(--cw-text-3); font-size: 12px; text-align: center; padding: 18px 0; }
.load-alert { margin: 12px 20px 0; }
.io-cell { margin: 0; font-family: var(--cw-font-mono); font-size: 11px; white-space: pre-wrap; word-break: break-all; }
.limit-cell { color: var(--cw-text-3); font-size: 11px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
@media (max-width: 1000px) { .testcase-layout { grid-template-columns: 1fr; } .page-content { width: calc(100% - 28px); padding-top: 28px; } }
</style>
