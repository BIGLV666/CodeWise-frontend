<template>
  <div class="testcase-page">
    <main class="page-content">
      <section class="page-heading">
        <div>
          <span class="eyebrow">ADMIN · TEST CASES</span>
          <h1>测试点管理</h1>
          <p>查看各题目的测试点数量，维护测试点的输入输出、可见性与限制。</p>
        </div>
        <el-button :icon="Refresh" :loading="overviewLoading" @click="loadOverview">刷新概览</el-button>
      </section>

      <div class="testcase-layout">
        <!-- 题目概览 -->
        <section class="panel-card overview-card">
          <header class="card-header">
            <div>
              <h2>题目概览</h2>
              <span>共 {{ overview.total }} 道题有测试点</span>
            </div>
          </header>
          <div class="overview-filter">
            <el-input v-model="questionFilter" placeholder="按题目 ID 过滤" size="small" clearable />
          </div>
          <div v-loading="overviewLoading" class="overview-list">
            <button
              v-for="item in filteredOverview"
              :key="item.questionId"
              type="button"
              class="overview-item"
              :class="{ active: item.questionId === selectedQuestionId }"
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
              <span>{{ cases.length }} 条</span>
            </div>
            <el-button
              type="primary"
              size="small"
              :disabled="!selectedQuestionId"
              :icon="Plus"
              @click="openCreate"
            >新增用例</el-button>
          </header>

          <el-alert v-if="casesError" :title="casesError" type="error" :closable="false" show-icon class="load-alert" />

          <el-table v-loading="casesLoading" :data="cases" empty-text="左侧选择题目后查看测试点" row-key="caseId">
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
                <el-tag v-if="row.isHidden === 1" size="small" effect="plain">可见</el-tag>
                <el-tag v-else size="small" type="warning" effect="plain">隐藏</el-tag>
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
          <el-form-item label="对用户可见">
            <el-switch v-model="form.isHiddenBool" active-text="可见" inactive-text="隐藏" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminTestCaseApi, { type QuestionOverviewItem, type TestCaseItem } from '@/api/adminTestCaseApi'
import { errorText } from '@/api/request'

const overview = ref<{ items: QuestionOverviewItem[]; total: number }>({ items: [], total: 0 })
const overviewLoading = ref(false)
const questionFilter = ref('')
const selectedQuestionId = ref<number | null>(null)

const cases = ref<TestCaseItem[]>([])
const casesLoading = ref(false)
const casesError = ref('')

const editorVisible = ref(false)
const saving = ref(false)
const editingCaseId = ref<number | null>(null)

const emptyForm = () => ({
  inputData: '',
  expectedOutput: '',
  isSampleBool: false,
  isHiddenBool: true,
  sortOrder: 0,
  scoreWeight: 100,
  timeLimit: undefined as number | undefined,
  memoryLimit: undefined as number | undefined,
})
const form = reactive(emptyForm())

const filteredOverview = computed(() => {
  const text = questionFilter.value.trim()
  if (!text) return overview.value.items
  return overview.value.items.filter((item) => String(item.questionId).includes(text))
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

async function selectQuestion(questionId: number) {
  selectedQuestionId.value = questionId
  casesLoading.value = true
  casesError.value = ''
  try {
    cases.value = await adminTestCaseApi.listByQuestion(questionId)
  } catch (error) {
    cases.value = []
    casesError.value = errorText(error, '测试点加载失败')
  } finally {
    casesLoading.value = false
  }
}

function openCreate() {
  if (!selectedQuestionId.value) return
  editingCaseId.value = null
  Object.assign(form, emptyForm())
  editorVisible.value = true
}

function openEdit(row: TestCaseItem) {
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
  if (saving.value) return
  if (!form.expectedOutput.trim()) {
    ElMessage.warning('期望输出不能为空')
    return
  }
  const payload = {
    inputData: form.inputData,
    expectedOutput: form.expectedOutput,
    isSample: form.isSampleBool ? 1 : 0,
    isHidden: form.isHiddenBool ? 1 : 0,
    sortOrder: form.sortOrder ?? 0,
    scoreWeight: form.scoreWeight ?? 100,
    timeLimit: form.timeLimit ?? null,
    memoryLimit: form.memoryLimit ?? null,
  }
  saving.value = true
  try {
    if (editingCaseId.value) {
      await adminTestCaseApi.update(editingCaseId.value, payload)
      ElMessage.success('测试点已更新')
    } else {
      await adminTestCaseApi.add(selectedQuestionId.value as number, payload)
      ElMessage.success('测试点已创建')
    }
    editorVisible.value = false
    await Promise.all([loadOverview(), selectQuestion(selectedQuestionId.value as number)])
  } catch (error) {
    ElMessage.error(errorText(error, '保存测试点失败'))
  } finally {
    saving.value = false
  }
}

async function removeCase(row: TestCaseItem) {
  if (row.caseId == null) return
  try {
    await ElMessageBox.confirm(
      `确认删除测试点 #${row.caseId}？该操作不可恢复。`,
      '删除测试点',
      { confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger', type: 'warning' },
    )
    await adminTestCaseApi.remove(row.caseId)
    ElMessage.success('测试点已删除')
    await Promise.all([loadOverview(), selectQuestion(selectedQuestionId.value as number)])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error('删除测试点失败:', error)
  }
}

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
.overview-filter { padding: 12px 14px 4px; }
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
