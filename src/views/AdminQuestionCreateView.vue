<template>
  <div class="question-create-page">
    <main class="page-content">
      <section class="page-heading">
        <span class="eyebrow">ADMIN · ACM</span>
        <h1>创建普通题目</h1>
        <p>填写题面与输入输出说明，保存后继续添加判题用例。</p>
      </section>
      <section class="panel-card">
        <header class="card-header"><h2>题目内容</h2><el-tag effect="plain">ACM</el-tag></header>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="question-form" @submit.prevent="saveQuestion">
          <el-form-item label="题目标题" prop="title">
            <el-input v-model="form.title" maxlength="200" show-word-limit />
          </el-form-item>
          <el-form-item label="题目描述" prop="description">
            <el-input v-model="form.description" type="textarea" :rows="10" resize="vertical" />
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="输入说明"><el-input v-model="form.inputDesc" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="输出说明"><el-input v-model="form.outputDesc" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="样例输入"><el-input v-model="form.sampleInput" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="样例输出"><el-input v-model="form.sampleOutput" type="textarea" :rows="4" /></el-form-item>
          </div>
          <el-form-item label="提示"><el-input v-model="form.hint" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="标签" prop="tags"><el-input v-model="form.tags" maxlength="255" show-word-limit placeholder="数组,哈希表" /></el-form-item>
          <div class="form-grid">
            <el-form-item label="时间限制（ms）" prop="timeLimit"><el-input-number v-model="form.timeLimit" :min="100" :max="60000" :step="100" /></el-form-item>
            <el-form-item label="内存限制（MB）" prop="memoryLimit"><el-input-number v-model="form.memoryLimit" :min="16" :max="4096" :step="16" /></el-form-item>
          </div>
          <div class="save-bar">
            <span>题目可见性沿用平台现有设置。</span>
            <el-button type="primary" native-type="submit" :loading="saving">保存并添加测试点</el-button>
          </div>
        </el-form>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import questionApi, { type InsertQuestionPayload } from '@/api/questionApi'
import { errorText, unwrap } from '@/api/request'

const router = useRouter()
const formRef = ref<FormInstance>()
const saving = ref(false)
const form = reactive<InsertQuestionPayload>({
  title: '', description: '', inputDesc: '', outputDesc: '', sampleInput: '', sampleOutput: '',
  hint: '', tags: '', timeLimit: 1000, memoryLimit: 256,
})
const rules: FormRules<InsertQuestionPayload> = {
  title: [
    { required: true, whitespace: true, message: '请输入题目标题', trigger: 'blur' },
    { max: 200, message: '题目标题最多 200 个字符', trigger: 'blur' },
  ],
  description: [{ required: true, whitespace: true, message: '请输入题目描述', trigger: 'blur' }],
  tags: [{ max: 255, message: '标签最多 255 个字符', trigger: 'blur' }],
  timeLimit: [{ required: true, type: 'integer', min: 100, max: 60000, message: '时限需为 100–60000 ms 的整数', trigger: 'change' }],
  memoryLimit: [{ required: true, type: 'integer', min: 16, max: 4096, message: '内存需为 16–4096 MB 的整数', trigger: 'change' }],
}

async function saveQuestion() {
  if (saving.value || !formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid || saving.value) return
  saving.value = true
  try {
    const response = await questionApi.addQuestion({ ...form, title: form.title.trim(), tags: form.tags.trim() })
    const question = unwrap<{ questionId?: number }>(response, {})
    if (!Number.isSafeInteger(question.questionId) || Number(question.questionId) <= 0) {
      throw new Error('题目已保存，但未返回有效的题目 ID，请在题库中确认')
    }
    ElMessage.success('普通题目已创建')
    await router.replace({ path: '/admin/testcases', query: { questionId: question.questionId } })
  } catch (error) {
    ElMessage.error(errorText(error, '保存题目失败'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.question-create-page { min-height: 100vh; min-height: 100dvh; color: var(--cw-text-1); background: var(--cw-bg-page); }
.page-content { width: min(1120px, calc(100% - 48px)); margin: 0 auto; padding: 42px 0 64px; }
.page-heading { margin-bottom: 24px; }
.eyebrow { color: var(--cw-text-3); font-size: 11px; font-weight: 700; letter-spacing: .13em; }
h1 { margin: 7px 0 8px; font-size: 28px; }
.page-heading p, .save-bar span { color: var(--cw-text-3); font-size: 13px; }
.panel-card { border: 1px solid var(--cw-border); border-radius: 9px; background: #fff; overflow: hidden; }
.card-header { padding: 20px 26px; border-bottom: 1px solid var(--cw-border); display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0; font-size: 18px; }
.question-form { padding: 26px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
.save-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-top: 1px solid var(--cw-border); padding-top: 20px; }
@media (max-width: 1024px) { .page-content { width: calc(100% - 28px); padding-top: 28px; } .form-grid { grid-template-columns: 1fr; } .save-bar { flex-direction: column; align-items: flex-start; } }
</style>
