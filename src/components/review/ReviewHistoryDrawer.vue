<template>
  <el-drawer
    :model-value="visible"
    direction="ltr"
    size="440px"
    :with-header="false"
    class="review-history-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-shell">
      <header class="drawer-header">
        <div>
          <span>复习管理</span>
          <h2>{{ detailTitle }}</h2>
        </div>
        <el-button :icon="Close" circle text aria-label="关闭" @click="$emit('update:visible', false)" />
      </header>

      <template v-if="selectedPlan">
        <button class="back-button" type="button" @click="closePlanDetail">
          <el-icon><ArrowLeft /></el-icon>返回复习题目
        </button>
        <section v-loading="questionLoading" class="plan-detail">
          <div class="question-heading">
            <span>#{{ selectedPlan.questionId }}</span>
            <h3>{{ selectedQuestion?.title || `题目 ${selectedPlan.questionId}` }}</h3>
            <div class="state-tags">
              <el-tag v-if="selectedPlan.weight === 1" type="warning" effect="plain">优先复习</el-tag>
              <el-tag :type="statusType(selectedPlan.status)" effect="plain">{{ statusLabel(selectedPlan.status) }}</el-tag>
            </div>
          </div>

          <p v-if="selectedQuestion?.description" class="question-description">{{ plainDescription }}</p>

          <div class="plan-metrics">
            <div><span>复习次数</span><strong>{{ selectedPlan.reviewCount ?? 0 }}</strong></div>
            <div><span>连续正确</span><strong>{{ selectedPlan.repetitions ?? 0 }}</strong></div>
            <div><span>当前间隔</span><strong>{{ selectedPlan.intervalDays ?? 0 }} 天</strong></div>
            <div><span>难度因子</span><strong>{{ selectedPlan.easinessFactor ?? '-' }}</strong></div>
          </div>

          <el-form label-position="top" class="plan-form">
            <el-form-item label="下次复习时间">
              <el-date-picker
                v-model="editForm.nextReviewData"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                :disabled-date="disablePastDate"
                placeholder="选择下次复习时间"
              />
            </el-form-item>
            <el-form-item label="优先复习">
              <div class="switch-row">
                <span>开启后，该题会优先出现在待复习队列</span>
                <el-switch v-model="editForm.priority" />
              </div>
            </el-form-item>
            <el-form-item label="搁置题目">
              <div class="switch-row">
                <span>搁置后不会进入正常复习计划</span>
                <el-switch v-model="editForm.suspended" />
              </div>
            </el-form-item>
          </el-form>

          <div class="detail-actions">
            <el-button @click="openQuestion(selectedPlan.questionId)">查看题目</el-button>
            <el-button type="primary" :loading="saving" @click="savePlan">保存修改</el-button>
          </div>
        </section>
      </template>

      <template v-else-if="selectedRecord">
        <button class="back-button" type="button" @click="selectedRecord = null">
          <el-icon><ArrowLeft /></el-icon>返回历史记录
        </button>
        <section v-loading="recordDetailLoading" class="record-detail">
          <div class="record-summary">
            <span>{{ formatDate(selectedRecord.reviewDate) }}</span>
            <strong>连续复习 {{ selectedRecord.reviewDays ?? 0 }} 天</strong>
          </div>
          <div v-if="recordQuestions.length" class="record-question-list">
            <button v-for="question in recordQuestions" :key="question.questionId" type="button" @click="openQuestion(question.questionId)">
              <span>
                <small>#{{ question.questionId }}</small>
                <strong>{{ question.title }}</strong>
              </span>
              <el-tag :type="question.status === 'ac' ? 'success' : question.status === 'completed' ? 'warning' : 'info'" size="small" effect="plain">
                {{ question.status === 'ac' ? '通过' : question.status === 'completed' ? '已完成' : '待复习' }}
              </el-tag>
            </button>
          </div>
          <el-empty v-else-if="!recordDetailLoading" description="该记录没有题目" />
        </section>
      </template>

      <template v-else>
        <el-tabs v-model="activeTab" class="drawer-tabs">
          <el-tab-pane label="复习题目" name="plans">
            <div v-loading="plansLoading" class="drawer-list">
              <el-empty v-if="!plansLoading && plans.length === 0" description="暂无复习题目" />
              <button v-for="plan in plans" :key="plan.reviewId" class="list-row" type="button" @click="openPlanDetail(plan)">
                <span class="row-icon" :class="{ priority: plan.weight === 1, suspended: plan.status === 2 }">
                  <el-icon><StarFilled v-if="plan.weight === 1" /><Clock v-else /></el-icon>
                </span>
                <span class="row-main">
                  <strong>{{ plan.questionTitle || `题目 ${plan.questionId}` }}</strong>
                  <small>下次复习：{{ formatDateTime(plan.nextReviewTime) }}</small>
                </span>
                <span class="state-tags row-tags">
                  <el-tag v-if="plan.weight === 1" type="warning" size="small" effect="plain">优先</el-tag>
                  <el-tag :type="statusType(plan.status)" size="small" effect="plain">{{ statusLabel(plan.status) }}</el-tag>
                </span>
              </button>
            </div>
          </el-tab-pane>
          <el-tab-pane label="历史记录" name="records">
            <div v-loading="recordsLoading" class="drawer-list">
              <el-empty v-if="!recordsLoading && records.length === 0" description="暂无历史记录" />
              <button v-for="record in records" :key="record.reviewRecordId" class="list-row" type="button" @click="openRecordDetail(record)">
                <span class="row-icon"><el-icon><Calendar /></el-icon></span>
                <span class="row-main">
                  <strong>{{ formatDate(record.reviewDate) }}</strong>
                  <small>{{ recordCount(record) }} 道题 · 连续 {{ record.reviewDays ?? 0 }} 天</small>
                </span>
                <el-icon class="row-arrow"><ArrowRight /></el-icon>
              </button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Calendar, Clock, Close, StarFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import reviewApi, { type ReviewPlan, type ReviewRecord, type ReviewRecordDetail } from '@/api/reviewApi'
import questionApi from '@/api/questionApi'

const props = defineProps<{ visible: boolean }>()
defineEmits<{ (event: 'update:visible', value: boolean): void }>()

const router = useRouter()
const activeTab = ref('plans')
const loadedOnce = ref(false)
const plansLoading = ref(false)
const recordsLoading = ref(false)
const questionLoading = ref(false)
const recordDetailLoading = ref(false)
const saving = ref(false)
const plans = ref<ReviewPlan[]>([])
const records = ref<ReviewRecord[]>([])
const selectedPlan = ref<ReviewPlan | null>(null)
const selectedQuestion = ref<any>(null)
const selectedRecord = ref<ReviewRecordDetail | null>(null)
const editForm = reactive({ nextReviewData: '', priority: false, suspended: false })

const detailTitle = computed(() => selectedPlan.value ? '题目复习设置' : selectedRecord.value ? '当日复习记录' : '全部复习内容')
const plainDescription = computed(() => String(selectedQuestion.value?.description || '').replace(/[#*`>\[\]]/g, '').replace(/\s+/g, ' ').slice(0, 180))
const recordQuestions = computed(() => {
  if (!selectedRecord.value) return []
  const titleMap = selectedRecord.value.allQuestionTitles || {}
  const pending = new Set((selectedRecord.value.pendingReviewQuestionIds || []).map(String))
  const completed = new Set((selectedRecord.value.completedReviewQuestionIds || []).map(String))
  const ac = new Set((selectedRecord.value.acQuestionIds || []).map(String))
  return (selectedRecord.value.allQuestionIds || []).map((id) => {
    const questionId = String(id)
    return { questionId, title: titleMap[questionId] || `题目 ${questionId}`, status: ac.has(questionId) ? 'ac' : completed.has(questionId) ? 'completed' : pending.has(questionId) ? 'pending' : 'pending' }
  })
})

const unwrapList = <T,>(response: any): T[] => {
  const data = response?.data ?? response
  return Array.isArray(data) ? data : []
}

const normalizePlan = (item: any): ReviewPlan => ({
  ...item,
  reviewId: String(item.reviewId),
  userId: item.userId == null ? undefined : String(item.userId),
  questionId: String(item.questionId),
  weight: Number(item.weight) === 1 ? 1 : 0,
  status: Number(item.status) === 2 ? 2 : Number(item.status) === 1 ? 1 : 0,
})

async function loadDrawerData() {
  plansLoading.value = true
  recordsLoading.value = true
  try {
    const [plansResponse, recordsResponse]: any[] = await Promise.all([reviewApi.getAllReviewPlans(), reviewApi.getAllReviewRecords()])
    plans.value = unwrapList<any>(plansResponse).map(normalizePlan)
    records.value = unwrapList<any>(recordsResponse).map((item) => ({ ...item, reviewRecordId: item.reviewRecordId == null ? undefined : String(item.reviewRecordId), userId: item.userId == null ? undefined : String(item.userId) }))
  } catch (error) {
    console.error('加载全部复习内容失败:', error)
  } finally {
    plansLoading.value = false
    recordsLoading.value = false
  }
}

async function openPlanDetail(plan: ReviewPlan) {
  selectedPlan.value = plan
  selectedQuestion.value = null
  editForm.nextReviewData = normalizeDateTime(plan.nextReviewTime)
  editForm.priority = plan.weight === 1
  editForm.suspended = plan.status === 2
  questionLoading.value = true
  try {
    const response: any = await questionApi.getQuestionById(Number(plan.questionId))
    selectedQuestion.value = response?.data ?? response
  } catch (error) {
    console.error('加载复习题目详情失败:', error)
  } finally {
    questionLoading.value = false
  }
}

function closePlanDetail() { selectedPlan.value = null; selectedQuestion.value = null }

async function openRecordDetail(record: ReviewRecord) {
  if (!record.reviewRecordId) return
  selectedRecord.value = { ...record }
  recordDetailLoading.value = true
  try {
    const response: any = await reviewApi.getReviewRecordDetail(String(record.reviewRecordId))
    selectedRecord.value = response?.data ?? response
  } catch (error) {
    selectedRecord.value = null
    console.error('加载复习记录详情失败:', error)
  } finally {
    recordDetailLoading.value = false
  }
}

async function savePlan() {
  if (!selectedPlan.value || !editForm.nextReviewData) {
    ElMessage.warning('请选择下次复习时间')
    return
  }
  //if (new Date(editForm.nextReviewData).getTime() < Date.now()) {
    //ElMessage.warning('下次复习时间不能早于当前时间')
   // return
 // }
  saving.value = true
  try {
    const response: any = await reviewApi.updateReviewPlan(selectedPlan.value.reviewId, {
      status: editForm.suspended ? 2 : 0,
      weight: editForm.priority ? 1 : 0,
      nextReviewData: editForm.nextReviewData,
    })
    const updated = response?.data ?? response
    Object.assign(selectedPlan.value, updated, {
      status: editForm.suspended ? 2 : 0,
      weight: editForm.priority ? 1 : 0,
      nextReviewTime: editForm.nextReviewData,
    })
    ElMessage.success('复习计划已更新')
  } catch (error) {
    console.error('更新复习计划失败:', error)
  } finally {
    saving.value = false
  }
}

function openQuestion(questionId: string) { router.push({ path: '/questiondetailview', query: { questionId, from: '/review' } }) }
const statusLabel = (status?: number) => status === 2 ? '已搁置' : status === 1 ? '已掌握' : '学习中'
const statusType = (status?: number) => status === 2 ? 'info' : status === 1 ? 'success' : 'warning'
const recordCount = (record: ReviewRecord) => (record.pendingReviewQuestionIds?.length || 0) + (record.completedReviewQuestionIds?.length || 0)
const toLocalDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const normalizeDateTime = (value?: string) => value ? value.slice(0, 19) : toLocalDateTime(new Date(Date.now() + 86400000))
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '未知日期'
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未安排'
const disablePastDate = (date: Date) => date.getTime() < new Date().setHours(0, 0, 0, 0)

watch(() => props.visible, (visible) => {
  if (visible && !loadedOnce.value) {
    loadedOnce.value = true
    loadDrawerData()
  }
})
</script>

<style scoped>
.drawer-shell { min-height: 100%; color: #262626; }.drawer-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #edf0f3; }.drawer-header span { color: #d98200; font-size: 12px; font-weight: 600; }.drawer-header h2 { margin: 4px 0 0; font-size: 21px; }.drawer-tabs { margin-top: 6px; }.drawer-list { min-height: 260px; }.list-row { width: 100%; min-height: 72px; padding: 12px 4px; border: 0; border-bottom: 1px solid #edf0f3; background: transparent; display: flex; align-items: center; gap: 11px; text-align: left; cursor: pointer; transition: background .16s ease, transform .16s ease; }.list-row:hover { background: #fafafa; transform: translateX(2px); }.row-icon { width: 34px; height: 34px; border-radius: 6px; display: grid; place-items: center; flex: 0 0 auto; background: #f3f4f6; color: #737982; }.row-icon.priority { background: #fff6e7; color: #e58b00; }.row-icon.suspended { background: #f1f2f4; color: #a0a5ad; }.row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }.row-main strong { font-size: 14px; }.row-main small { color: #8a8f98; font-size: 12px; }.state-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }.row-tags { flex: 0 0 auto; justify-content: flex-end; }.row-arrow { color: #a8adb5; }.back-button { margin: 14px 0; padding: 0; border: 0; background: transparent; display: inline-flex; align-items: center; gap: 5px; color: #6b7280; font: inherit; cursor: pointer; }.back-button:hover { color: #d98200; }.plan-detail,.record-detail { min-height: 300px; }.question-heading > span { color: #9ca3af; font-size: 12px; }.question-heading h3 { margin: 5px 0 10px; font-size: 21px; line-height: 1.4; }.question-description { color: #6b7280; font-size: 13px; line-height: 1.7; }.plan-metrics { margin: 18px 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }.plan-metrics div { padding: 12px; border: 1px solid #e8eaed; border-radius: 6px; display: flex; flex-direction: column; gap: 4px; }.plan-metrics span { color: #8a8f98; font-size: 11px; }.plan-metrics strong { font-size: 15px; }.plan-form :deep(.el-date-editor) { width: 100%; }.switch-row { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; }.switch-row span { color: #6b7280; font-size: 12px; line-height: 1.5; }.detail-actions { position: sticky; bottom: 0; padding: 14px 0 4px; display: flex; justify-content: flex-end; gap: 8px; background: #fff; }.record-summary { margin-bottom: 14px; padding: 14px; border-radius: 6px; background: #f7f8fa; display: flex; flex-direction: column; gap: 5px; }.record-summary span { color: #6b7280; font-size: 12px; }.record-question-list { display: flex; flex-direction: column; }.record-question-list button { padding: 13px 2px; border: 0; border-bottom: 1px solid #edf0f3; background: transparent; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }.record-question-list button:hover { background: #fafafa; }.record-question-list button > span { min-width: 0; display: flex; flex-direction: column; gap: 4px; }.record-question-list small { color: #9ca3af; }.record-question-list strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
