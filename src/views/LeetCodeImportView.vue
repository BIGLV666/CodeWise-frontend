<template>
  <div class="import-page">
    <header class="topbar">
      <button class="brand-button" type="button" aria-label="返回题库" @click="goHome">
        <BrandLogo :size="28" />
      </button>
      <div class="topbar-divider"></div>
      <span class="page-name">导入力扣题目</span>
      <el-button :icon="Back" text @click="goHome">返回题库</el-button>
    </header>

    <main class="page-content">
      <section class="intro-section">
        <div>
          <span class="eyebrow">核心函数模式 · Java</span>
          <h1>从力扣导入题目</h1>
          <p>粘贴题目链接，系统会解析题面、Java 函数签名和样例。确认内容后再保存到 CodeWise。</p>
        </div>
      </section>

      <section class="import-source" aria-labelledby="source-title">
        <div class="section-heading">
          <div>
            <h2 id="source-title">题目链接</h2>
            <p>支持 leetcode.cn 和 leetcode.com 的题目详情链接。</p>
          </div>
        </div>

        <div class="url-row">
          <el-input
            v-model="leetcodeUrl"
            size="large"
            clearable
            :prefix-icon="Link"
            placeholder="https://leetcode.cn/problems/two-sum/"
            @keyup.enter="parseQuestion"
          />
          <el-button
            type="primary"
            size="large"
            :icon="Download"
            :loading="parsing"
            @click="parseQuestion"
          >
            解析题目
          </el-button>
        </div>
        <p v-if="parsedSlug" class="slug-hint">将解析题目标识：{{ parsedSlug }}</p>
      </section>

      <section v-if="draft" class="editor-section" aria-labelledby="editor-title">
        <div class="section-heading editor-heading">
          <div>
            <h2 id="editor-title">检查并修改</h2>
            <p>保存前可以调整题面、函数签名和样例数据。</p>
          </div>
          <el-tag type="warning" effect="plain">FUNCTION · Java</el-tag>
        </div>

        <el-form ref="formRef" :model="draft" :rules="rules" label-position="top" class="question-form">
          <div class="form-grid form-grid-meta">
            <el-form-item label="题目标题" prop="title" class="span-2">
              <el-input v-model="draft.title" maxlength="120" show-word-limit />
            </el-form-item>
            <el-form-item label="难度" prop="difficulty">
              <el-select v-model="draft.difficulty" class="full-width">
                <el-option label="简单" :value="1" />
                <el-option label="中等" :value="2" />
                <el-option label="困难" :value="3" />
              </el-select>
            </el-form-item>
            <el-form-item label="来源">
              <el-input v-model="draft.source" />
            </el-form-item>
            <el-form-item label="标签" class="span-2">
              <el-input v-model="draft.tags" placeholder="数组,哈希表" />
            </el-form-item>
            <el-form-item label="时间限制（ms）" prop="timeLimit">
              <el-input-number v-model="draft.timeLimit" :min="100" :max="60000" :step="100" controls-position="right" class="full-width" />
            </el-form-item>
            <el-form-item label="内存限制（MB）" prop="memoryLimit">
              <el-input-number v-model="draft.memoryLimit" :min="16" :max="4096" :step="16" controls-position="right" class="full-width" />
            </el-form-item>
          </div>

          <div class="form-section">
            <h3>题面内容</h3>
            <el-form-item label="题目描述" prop="description">
              <el-input v-model="draft.description" type="textarea" :rows="10" resize="vertical" />
            </el-form-item>
            <div class="form-grid">
              <el-form-item label="输入说明">
                <el-input v-model="draft.inputDesc" type="textarea" :rows="4" resize="vertical" />
              </el-form-item>
              <el-form-item label="输出说明">
                <el-input v-model="draft.outputDesc" type="textarea" :rows="4" resize="vertical" />
              </el-form-item>
            </div>
            <el-form-item label="提示">
              <el-input v-model="draft.hint" type="textarea" :rows="3" resize="vertical" />
            </el-form-item>
          </div>

          <div class="form-section">
            <div class="subsection-heading">
              <div>
                <h3>Java 核心函数</h3>
                <p>这些字段决定编辑器展示的初始方法签名。</p>
              </div>
            </div>
            <div class="form-grid function-grid">
              <el-form-item label="类名" prop="className">
                <el-input v-model="draft.className" placeholder="Solution" />
              </el-form-item>
              <el-form-item label="方法名" prop="methodName">
                <el-input v-model="draft.methodName" placeholder="twoSum" />
              </el-form-item>
              <el-form-item label="返回类型" prop="outputType">
                <el-input v-model="draft.outputType" placeholder="int[]" />
              </el-form-item>
            </div>

            <div class="list-heading">
              <span>函数参数</span>
              <el-button :icon="Plus" text type="primary" @click="addParameter">添加参数</el-button>
            </div>
            <div v-if="parameters.length" class="parameter-list">
              <div v-for="(parameter, index) in parameters" :key="index" class="parameter-row">
                <span class="row-index">{{ index + 1 }}</span>
                <el-input v-model="parameter.type" placeholder="类型，例如 int[]" />
                <el-input v-model="parameter.name" placeholder="参数名，例如 nums" />
                <el-tooltip content="删除参数" placement="top">
                  <el-button :icon="Delete" circle text type="danger" aria-label="删除参数" @click="removeParameter(index)" />
                </el-tooltip>
              </div>
            </div>
            <el-empty v-else description="当前函数没有参数" :image-size="52" />
          </div>

          <div class="form-section samples-section">
            <div class="list-heading samples-heading">
              <div>
                <h3>题目样例</h3>
                <p>样例会作为可见测试用例保存。</p>
              </div>
              <el-button :icon="Plus" text type="primary" @click="addSample">添加样例</el-button>
            </div>
            <div v-if="draft.samples.length" class="sample-list">
              <div v-for="(sample, index) in draft.samples" :key="index" class="sample-item">
                <div class="sample-title">
                  <span>样例 {{ index + 1 }}</span>
                  <el-tooltip content="删除样例" placement="top">
                    <el-button :icon="Delete" circle text type="danger" aria-label="删除样例" @click="removeSample(index)" />
                  </el-tooltip>
                </div>
                <div class="form-grid">
                  <el-form-item label="输入">
                    <el-input v-model="sample.input" type="textarea" :rows="4" resize="vertical" />
                  </el-form-item>
                  <el-form-item label="预期输出">
                    <el-input v-model="sample.output" type="textarea" :rows="4" resize="vertical" />
                  </el-form-item>
                </div>
              </div>
            </div>
            <el-empty v-else description="尚未添加样例" :image-size="58" />
          </div>
        </el-form>

        <div class="save-bar">
          <div class="save-note">
            <el-icon><InfoFilled /></el-icon>
            <span>保存后题目会进入“核心函数”列表，目前仅支持 Java 判题。</span>
          </div>
          <div class="save-actions">
            <el-button @click="resetDraft">重新解析</el-button>
            <el-button type="primary" :loading="saving" @click="saveQuestion">保存并添加</el-button>
          </div>
        </div>
      </section>

      <section v-else class="empty-preview">
        <el-empty description="解析完成后，题目内容会在这里展示" :image-size="92" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Back, Delete, Download, InfoFilled, Link, Plus } from '@element-plus/icons-vue'
import questionImportApi, {
  type FunctionParameterDraft,
  type FunctionQuestionDraft,
} from '@/api/questionImportApi'
import { logWarn } from '@/utils/logger'

const router = useRouter()
const formRef = ref<FormInstance>()
const leetcodeUrl = ref('')
const parsing = ref(false)
const saving = ref(false)
const draft = ref<FunctionQuestionDraft | null>(null)
const parameters = ref<FunctionParameterDraft[]>([])

const parsedSlug = computed(() => extractTitleSlug(leetcodeUrl.value))

const rules: FormRules<FunctionQuestionDraft> = {
  title: [{ required: true, message: '请输入题目标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入题目描述', trigger: 'blur' }],
  difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
  className: [{ required: true, message: '请输入 Java 类名', trigger: 'blur' }],
  methodName: [{ required: true, message: '请输入方法名', trigger: 'blur' }],
  outputType: [{ required: true, message: '请输入返回类型', trigger: 'blur' }],
  timeLimit: [{ required: true, message: '请输入时间限制', trigger: 'change' }],
  memoryLimit: [{ required: true, message: '请输入内存限制', trigger: 'change' }],
}

function extractTitleSlug(value: string) {
  const input = value.trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    if (!['leetcode.cn', 'www.leetcode.cn', 'leetcode.com', 'www.leetcode.com'].includes(url.hostname.toLowerCase())) {
      return ''
    }
    const match = url.pathname.match(/\/problems\/([^/?#]+)/i)
    return match?.[1] ? decodeURIComponent(match[1]) : ''
  } catch {
    return ''
  }
}

function parseParameters(raw: string) {
  try {
    const value = JSON.parse(raw || '[]')
    if (!Array.isArray(value)) return []
    return value.map((item) => ({
      type: String(item?.type || ''),
      name: String(item?.name || ''),
    }))
  } catch {
    return []
  }
}

async function parseQuestion() {
  const slug = parsedSlug.value
  if (!slug) {
    ElMessage.warning('请粘贴有效的力扣题目链接')
    return
  }

  parsing.value = true
  try {
    const response = await questionImportApi.parseLeetCode(slug)
    draft.value = {
      ...response.data,
      title: response.data.title || '',
      description: response.data.description || '',
      inputDesc: response.data.inputDesc || '',
      outputDesc: response.data.outputDesc || '',
      hint: response.data.hint || '',
      source: response.data.source || 'LeetCode',
      difficulty: response.data.difficulty || 1,
      tags: response.data.tags || '',
      timeLimit: response.data.timeLimit || 2000,
      memoryLimit: response.data.memoryLimit || 256,
      className: response.data.className || 'Solution',
      methodName: response.data.methodName || '',
      outputType: response.data.outputType || 'void',
      parameterConfig: response.data.parameterConfig || '[]',
      samples: Array.isArray(response.data.samples)
        ? response.data.samples.map((sample) => ({ input: sample.input || '', output: sample.output || '' }))
        : [],
    }
    parameters.value = parseParameters(response.data.parameterConfig)
    ElMessage.success('题目解析完成，请检查后保存')
  } catch (error) {
    logWarn('解析力扣题目失败:', error)
  } finally {
    parsing.value = false
  }
}

function validateParameters() {
  const invalidIndex = parameters.value.findIndex((item) => !item.type.trim() || !item.name.trim())
  if (invalidIndex >= 0) {
    ElMessage.warning(`请补全第 ${invalidIndex + 1} 个函数参数`)
    return false
  }
  return true
}

async function saveQuestion() {
  if (saving.value || !draft.value || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid || saving.value || !validateParameters()) return
  saving.value = true
  try {
    const payload: FunctionQuestionDraft = {
      ...draft.value,
      parameterConfig: JSON.stringify(parameters.value.map((item) => ({
        type: item.type.trim(),
        name: item.name.trim(),
      }))),
      samples: draft.value.samples.map((sample) => ({
        input: sample.input.trim(),
        output: sample.output.trim(),
      })),
    }
    const response = await questionImportApi.createFunctionQuestion(payload)
    localStorage.setItem('homeQuestionType', 'FUNCTION')
    ElMessage.success('核心函数题目已添加')
    await router.replace({
      path: '/admin/testcases',
      query: { questionId: response.data },
    })
  } catch (error) {
    logWarn('保存核心函数题目失败:', error)
  } finally {
    saving.value = false
  }
}

function addParameter() {
  parameters.value.push({ type: '', name: '' })
}

function removeParameter(index: number) {
  parameters.value.splice(index, 1)
}

function addSample() {
  draft.value?.samples.push({ input: '', output: '' })
}

function removeSample(index: number) {
  draft.value?.samples.splice(index, 1)
}

function resetDraft() {
  draft.value = null
  parameters.value = []
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.url-row input')?.focus())
}

function goHome() {
  router.replace('/home')
}
</script>

<style scoped>
.import-page {
  min-height: 100vh; min-height: 100dvh;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
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
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto;
  padding: 42px 0 64px;
}

.intro-section {
  margin-bottom: 26px;
}

.eyebrow {
  color: var(--cw-brand-dark);
  font-size: 13px;
  font-weight: 700;
}

.intro-section h1 {
  margin: 10px 0 8px;
  color: var(--cw-text-1);
  font-size: 30px;
  line-height: 1.25;
}

.intro-section p,
.section-heading p,
.subsection-heading p,
.samples-heading p {
  margin: 0;
  color: var(--cw-text-3);
  font-size: 13px;
  line-height: 1.7;
}

.import-source,
.editor-section,
.empty-preview {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.import-source {
  padding: 24px 26px;
}

.section-heading,
.subsection-heading,
.list-heading,
.sample-title,
.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading h2,
.form-section h3,
.samples-heading h3 {
  margin: 0;
  color: var(--cw-text-1);
}

.section-heading h2 {
  font-size: 18px;
}

.url-row {
  margin-top: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
}

.url-row :deep(.el-button--primary),
.save-actions :deep(.el-button--primary) {
  --el-button-bg-color: var(--cw-brand);
  --el-button-border-color: var(--cw-brand);
  --el-button-hover-bg-color: var(--cw-brand-dark);
  --el-button-hover-border-color: var(--cw-brand-dark);
  --el-button-active-bg-color: var(--cw-brand-dark);
  --el-button-active-border-color: var(--cw-brand-dark);
}

.slug-hint {
  margin: 10px 0 0;
  color: var(--cw-text-3);
  font-size: 12px;
}

.editor-section {
  margin-top: 24px;
  overflow: hidden;
}

.editor-heading {
  padding: 22px 26px;
  border-bottom: 1px solid var(--cw-bg-subtle);
}

.question-form {
  padding: 26px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.form-grid-meta {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.span-2 {
  grid-column: span 2;
}

.full-width {
  width: 100%;
}

.form-section {
  margin-top: 8px;
  padding-top: 26px;
  border-top: 1px solid var(--cw-bg-subtle);
}

.form-section h3,
.samples-heading h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

.subsection-heading h3,
.samples-heading h3 {
  margin-bottom: 4px;
}

.function-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18px;
}

.list-heading {
  min-height: 36px;
  margin: 4px 0 10px;
  color: var(--cw-text-1);
  font-size: 14px;
  font-weight: 600;
}

.parameter-list,
.sample-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.parameter-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 0.8fr) minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
}

.row-index {
  color: #a1a8b2;
  font-size: 12px;
  text-align: center;
}

.samples-heading {
  margin-bottom: 14px;
}

.sample-item {
  padding: 16px 18px 0;
  background: var(--cw-bg-page);
  border: 1px solid var(--cw-bg-subtle);
  border-radius: 6px;
}

.sample-title {
  margin-bottom: 10px;
  color: var(--cw-text-1);
  font-size: 13px;
  font-weight: 700;
}

.save-bar {
  padding: 18px 26px;
  background: var(--cw-bg-page);
  border-top: 1px solid var(--cw-bg-subtle);
}

.save-note {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #777f89;
  font-size: 12px;
}

.save-note .el-icon {
  color: var(--cw-brand-dark);
}

.save-actions {
  display: flex;
  gap: 8px;
}

.empty-preview {
  min-height: 260px;
  margin-top: 24px;
  display: grid;
  place-items: center;
}

@media (max-width: 1024px) {
  .page-content {
    width: min(100% - 28px, 1120px);
    padding-top: 28px;
  }

  .topbar {
    padding: 0 16px;
  }

  .form-grid-meta,
  .function-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }

  .save-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .save-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 560px) {
  .url-row {
    grid-template-columns: 1fr;
  }

  .url-row .el-button {
    width: 100%;
  }

  .import-source,
  .question-form,
  .editor-heading,
  .save-bar {
    padding-right: 18px;
    padding-left: 18px;
  }

  .parameter-row {
    grid-template-columns: 24px minmax(0, 1fr) 34px;
  }

  .parameter-row :deep(.el-input):nth-of-type(2) {
    grid-column: 2;
  }

  .parameter-row .el-button {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .intro-section h1 {
    font-size: 25px;
  }
}
</style>
