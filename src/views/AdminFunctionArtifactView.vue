<template>
  <div class="artifact-page">
    <header class="topbar">
      <button class="brand-button" type="button" aria-label="返回题库" @click="goHome"><BrandLogo :size="28" /></button>
      <span class="topbar-divider"></span>
      <span class="page-name">AI 自动题目生成</span>
      <el-button :icon="Back" text @click="goHome">返回题库</el-button>
    </header>

    <main class="page-content">
      <section class="page-heading">
        <div><span class="eyebrow">ADMIN · FUNCTION · JAVA</span><h1>AI 自动题目生成</h1><p>抓取 LeetCode 函数题，生成 Java 测试工程，校验后自动写入题库。</p></div>
        <el-tag type="warning" effect="plain"><el-icon><Lock /></el-icon> 管理员专用</el-tag>
      </section>
      <el-alert title="该流程会创建新题目并写入隐藏测试用例，请确认 titleSlug 对应正确题目。" type="warning" :closable="false" show-icon class="notice" />

      <div class="artifact-layout">
        <section class="form-card">
          <div class="card-heading"><span class="card-icon"><el-icon><MagicStick /></el-icon></span><div><h2>创建生成任务</h2><p>AI 将生成 Generator 和标准答案，并执行 50 组校验。</p></div></div>
          <el-form label-position="top" @submit.prevent="startGeneration">
            <el-form-item label="LeetCode titleSlug" required>
              <el-input v-model="titleSlug" size="large" clearable :disabled="generating" placeholder="例如：two-sum" @keyup.enter="startGeneration" />
              <span class="field-tip">URL 示例：leetcode.cn/problems/two-sum/ 中的 two-sum。</span>
            </el-form-item>
            <el-button type="primary" size="large" :icon="MagicStick" :loading="generating" class="generate-button" @click="startGeneration">开始自动生成</el-button>
          </el-form>
          <div class="pipeline">
            <div v-for="step in pipelineSteps" :key="step.title" class="pipeline-step"><span class="pipeline-icon"><el-icon><component :is="step.icon" /></el-icon></span><strong>{{ step.title }}</strong><small>{{ step.description }}</small></div>
          </div>
        </section>

        <section class="status-card">
          <div class="card-heading status-heading"><div><h2>任务状态</h2><p>{{ task ? `任务 ${task.taskId}` : '等待创建任务' }}</p></div><el-button v-if="task" link :icon="Refresh" :loading="statusLoading" @click="refreshTask">刷新</el-button></div>
          <div v-if="!task" class="empty-status"><span class="empty-icon"><el-icon><MagicStick /></el-icon></span><strong>还没有生成任务</strong><p>提交 titleSlug 后，任务进度会显示在这里。</p></div>
          <template v-else>
            <div class="task-summary"><div><span>题目 slug</span><strong>{{ task.titleSlug }}</strong></div><div><span>当前阶段</span><el-tag :type="statusTagType" effect="plain">{{ statusText }}</el-tag></div></div>
            <div class="progress-track"><div class="progress-value" :style="{ width: `${progress}%` }"></div></div><div class="progress-caption"><span>{{ statusText }}</span><span>{{ progress }}%</span></div>
            <div v-if="task.status === 'SUCCESS'" class="result-box success-box"><el-icon><CircleCheck /></el-icon><div><strong>题目已入库</strong><span>题目 ID：{{ task.questionId }} · 隐藏测试：{{ task.generatedCount || 0 }} 条</span></div><el-button link type="primary" @click="openQuestion">查看题目</el-button></div>
            <div v-else-if="task.status === 'MANUAL_REVIEW'" class="result-box review-box"><el-icon><Warning /></el-icon><div><strong>需要人工复核</strong><span>{{ task.errorMessage || '生成或校验未通过，请查看后端任务目录。' }}</span></div></div>
            <div v-else class="running-box"><el-icon class="is-loading"><Loading /></el-icon><span>后台正在处理，页面会自动更新状态。</span></div>
            <dl class="task-meta"><div><dt>任务 ID</dt><dd>{{ task.taskId }}</dd></div><div><dt>创建时间</dt><dd>{{ formatDate(task.createTime) }}</dd></div><div v-if="task.finishTime"><dt>完成时间</dt><dd>{{ formatDate(task.finishTime) }}</dd></div></dl>
          </template>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Back, CircleCheck, CirclePlus, DocumentChecked, Loading, Lock, MagicStick, Refresh, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import questionApi, { type LeetCodeArtifactTask } from '@/api/questionApi'
import { errorText } from '@/api/request'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { navigateTopLevel } from '@/utils/navigation'

const router = useRouter()
const titleSlug = ref('')
const task = ref<LeetCodeArtifactTask | null>(null)
const generating = ref(false)
const statusLoading = ref(false)
let pollTimer: number | undefined

const pipelineSteps = [
  { title: '抓取题目', description: '读取函数定义', icon: DocumentChecked },
  { title: '生成源码', description: 'AI 生成测试工程', icon: MagicStick },
  { title: 'Docker 校验', description: '执行 50 组测试', icon: CirclePlus },
  { title: '自动入库', description: '写入隐藏用例', icon: CircleCheck },
]
const statusTextMap: Record<string, string> = { PENDING: '等待处理', FETCHING: '抓取题目', GENERATING: 'AI 生成源码', VALIDATING: 'Docker 校验', SAVING: '写入题库', SUCCESS: '生成完成', MANUAL_REVIEW: '人工复核' }
const statusText = computed(() => statusTextMap[task.value?.status || ''] || '处理中')
const progress = computed(() => ({ PENDING: 8, FETCHING: 25, GENERATING: 50, VALIDATING: 75, SAVING: 90, SUCCESS: 100, MANUAL_REVIEW: 100 }[task.value?.status || ''] || 12))
const statusTagType = computed(() => task.value?.status === 'SUCCESS' ? 'success' : task.value?.status === 'MANUAL_REVIEW' ? 'danger' : 'warning')
const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T

const stopPolling = () => { if (pollTimer) window.clearTimeout(pollTimer); pollTimer = undefined }
const applyTask = (response: any) => { task.value = unwrap<LeetCodeArtifactTask>(response, {} as LeetCodeArtifactTask) }
const pollTask = async (taskId: string) => {
  try {
    statusLoading.value = true
    applyTask(await questionApi.getLeetCodeArtifactStatus(taskId))
    if (task.value?.status && !['SUCCESS', 'MANUAL_REVIEW'].includes(task.value.status)) pollTimer = window.setTimeout(() => pollTask(taskId), 1500)
    else { generating.value = false; if (task.value?.status === 'SUCCESS') ElMessage.success('AI 自动题目生成完成'); else ElMessage.warning('任务进入人工复核状态') }
  } catch (error) { generating.value = false; ElMessage.error(errorText(error, '查询任务状态失败')) }
  finally { statusLoading.value = false }
}
const startGeneration = async () => {
  const value = titleSlug.value.trim()
  if (!value || generating.value) { if (!value) ElMessage.warning('请输入 LeetCode titleSlug'); return }
  stopPolling(); generating.value = true; task.value = null
  try {
    applyTask(await questionApi.generateLeetCodeArtifacts(value))
    const taskId = (task.value as LeetCodeArtifactTask | null)?.taskId
    if (taskId) pollTimer = window.setTimeout(() => pollTask(taskId), 700)
  }
  catch (error) { generating.value = false;
}
}
const refreshTask = () => { if (task.value?.taskId) pollTask(task.value.taskId) }
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-'
const openQuestion = () => { if (task.value?.questionId) router.push({ path: '/questiondetailview', query: { questionId: task.value.questionId } }) }
const goHome = () => navigateTopLevel(router, '/home')
onBeforeUnmount(stopPolling)
</script>

<style scoped>
.artifact-page{min-height:100vh; min-height:100dvh;background:var(--cw-bg-page);color:var(--cw-text-1);font-family: var(--cw-font-sans)}.topbar{height:58px;padding:0 30px;display:flex;align-items:center;gap:14px;background:#fff;border-bottom:1px solid var(--cw-border)}.brand-button{padding:0;border:0;background:transparent;cursor:pointer}.topbar-divider{width:1px;height:22px;background:var(--cw-border)}.page-name{flex:1;color:var(--cw-text-1);font-size:14px;font-weight:600}.page-content{width:min(1180px,calc(100% - 48px));margin:0 auto;padding:36px 0 56px}.page-heading{margin-bottom:20px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{color:var(--cw-brand-dark);font-size:12px;font-weight:700}.page-heading h1{margin:8px 0 5px;font-size:28px}.page-heading p{margin:0;color:var(--cw-text-3);font-size:13px}.notice{margin-bottom:20px}.artifact-layout{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:20px;align-items:start}.form-card,.status-card{padding:24px;border:1px solid var(--cw-border);border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.04)}.card-heading{margin-bottom:24px;display:flex;align-items:flex-start;gap:12px}.card-heading h2{margin:0 0 5px;font-size:17px}.card-heading p{margin:0;color:#858c96;font-size:12px}.card-icon,.empty-icon{width:40px;height:40px;border-radius:7px;background:var(--cw-brand-soft);color:var(--cw-brand-dark);display:grid;place-items:center;font-size:20px}.field-tip{margin-top:6px;color:#9299a2;font-size:12px}.generate-button{width:100%;margin-top:8px;--el-button-bg-color:var(--cw-brand);--el-button-border-color:var(--cw-brand);--el-button-hover-bg-color:var(--cw-brand-dark)}.pipeline{margin-top:36px;padding-top:22px;border-top:1px solid var(--cw-bg-subtle);display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pipeline-step{min-width:0;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center}.pipeline-icon{width:32px;height:32px;border-radius:50%;background:var(--cw-bg-page);color:#7b838d;display:grid;place-items:center}.pipeline-step strong{font-size:12px}.pipeline-step small{color:#979da5;font-size:10px}.status-heading{margin-bottom:22px;justify-content:space-between}.status-heading p{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty-status{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.empty-icon{width:54px;height:54px;margin-bottom:14px;font-size:25px}.empty-status strong{font-size:15px}.empty-status p{margin:7px 0 0;color:#969ca5;font-size:12px}.task-summary{display:grid;gap:12px}.task-summary div{display:flex;align-items:center;justify-content:space-between;gap:12px}.task-summary span{color:#9299a2;font-size:12px}.task-summary strong{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.progress-track{height:8px;margin-top:24px;border-radius:99px;background:var(--cw-bg-page);overflow:hidden}.progress-value{height:100%;border-radius:inherit;background:var(--cw-brand);transition:width .3s ease}.progress-caption{margin-top:7px;display:flex;justify-content:space-between;color:#858c96;font-size:11px}.result-box{margin-top:24px;padding:13px;border-radius:7px;display:flex;align-items:flex-start;gap:9px}.result-box>.el-icon{margin-top:2px;font-size:18px}.result-box div{min-width:0;flex:1}.result-box strong,.result-box span{display:block}.result-box strong{font-size:13px}.result-box span{margin-top:4px;color:#737b85;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.success-box{background:#effaf3;color:var(--cw-success)}.review-box{background:#fff5f5;color:var(--cw-danger)}.running-box{margin-top:24px;padding:13px;color:#8c929b;display:flex;align-items:center;gap:8px;font-size:12px}.task-meta{margin:22px 0 0;padding-top:14px;border-top:1px solid var(--cw-bg-subtle)}.task-meta div{display:flex;justify-content:space-between;gap:12px;margin-top:7px;font-size:11px}.task-meta dt{color:#9aa0a8}.task-meta dd{max-width:240px;margin:0;overflow:hidden;color:#5f6670;text-overflow:ellipsis;white-space:nowrap}@media (max-width:1024px){.artifact-layout{grid-template-columns:1fr}.status-card{grid-row:1}.pipeline{grid-template-columns:repeat(2,1fr)}}@media (max-width:560px){.topbar{padding:0 16px}.page-content{width:calc(100% - 28px);padding-top:24px}.page-heading{align-items:flex-start;flex-direction:column}}
</style>
