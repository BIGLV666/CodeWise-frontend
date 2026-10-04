<template>
  <div class="plan-view">
    <AppNavBar active="home" />

    <div class="main-container">
      <!-- 左侧边栏：选中日期计划列表 + 本周概览 -->
      <aside class="plan-sidebar">
        <div class="sidebar-header">
          <div class="selected-date">
            <span class="date-label">计划日期</span>
            <span class="date-value">{{ selectedDate }}</span>
            <span class="date-count">{{ doneCount }}/{{ dayPlans.length }} 完成</span>
          </div>
          <el-button type="primary" :icon="Plus" @click="openCreate">新建计划</el-button>
        </div>

        <div v-loading="plansLoading" class="plan-list">
          <el-empty
            v-if="!plansLoading && dayPlans.length === 0"
            description="这一天暂无计划"
            :image-size="72"
          />
          <div
            v-for="plan in dayPlans"
            :key="String(plan.progressId)"
            class="plan-card"
            :class="`status-${normalizeStatus(plan.status)}`"
          >
            <div class="plan-card-top">
              <span class="plan-question" title="查看题目详情" @click="goQuestionDetail(plan)">
                题目 #{{ plan.questionId }}
              </span>
              <el-tag :type="statusTag(plan.status)" size="small" effect="light">
                {{ statusText(plan.status) }}
              </el-tag>
            </div>
            <p class="plan-notes">{{ plan.notesContent || '暂无备注' }}</p>
            <div class="plan-card-foot">
              <span class="plan-time">{{ plan.updateTime ? fmtTime(plan.updateTime) : '' }}</span>
              <div class="plan-actions">
                <el-button text size="small" type="primary" @click="openEdit(plan)">编辑</el-button>
                <el-button text size="small" type="danger" @click="removePlan(plan)">删除</el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="weekly" class="week-summary">
          <div class="week-title">
            <span>本周概览</span>
            <el-button :icon="Refresh" text size="small" @click="loadWeeklyReport" />
          </div>
          <div class="week-range">{{ weekly.startDate }} ~ {{ weekly.endDate }}</div>
          <div class="week-stats">
            <div class="week-stat"><span class="num">{{ weekly.totalPlanned }}</span><span class="label">计划</span></div>
            <div class="week-stat done"><span class="num">{{ weekly.completedCount }}</span><span class="label">完成</span></div>
            <div class="week-stat doing"><span class="num">{{ weekly.inProgressCount }}</span><span class="label">进行</span></div>
            <div class="week-stat expired"><span class="num">{{ weekly.expiredCount }}</span><span class="label">过期</span></div>
          </div>
        </div>
      </aside>

      <!-- 右侧：顶部一个月日历 -->
      <main class="plan-content">
        <section class="calendar-card">
          <header class="calendar-header">
            <div class="calendar-title">
              <el-button :icon="ArrowLeft" text @click="changeMonth(-1)" />
              <span class="title-text">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</span>
              <el-button :icon="ArrowRight" text @click="changeMonth(1)" />
            </div>
            <div class="calendar-tools">
              <el-button size="small" @click="goToday">今天</el-button>
              <el-button :icon="Refresh" size="small" @click="loadCalendar" />
            </div>
          </header>

          <div class="calendar-grid">
            <div v-for="week in WEEKDAYS" :key="week" class="weekday-cell">{{ week }}</div>
            <div
              v-for="cell in renderCells"
              :key="cell.key"
              class="day-cell"
              :class="{
                'other-month': !cell.inMonth,
                today: cell.isToday,
                selected: cell.key === selectedDate,
              }"
              @click="selectDate(cell.key)"
            >
              <span class="day-number">{{ cell.day }}</span>
              <span v-if="cell.stat?.allDone" class="day-check" title="当日计划全部完成">
                <el-icon><Check /></el-icon>
              </span>
              <!-- total 为 0 表示当天无计划，不显示计数，避免全月 0/0 噪音 -->
              <span
                v-else-if="cell.stat && cell.stat.total > 0"
                class="day-count"
                :title="`已完成 ${cell.stat.completed} / ${cell.stat.total}`"
              >
                {{ cell.stat.completed }}/{{ cell.stat.total }}
              </span>
            </div>
          </div>

          <footer class="calendar-legend">
            <span class="legend-item"><i class="legend-check" />当日计划全部完成</span>
            <span class="legend-item">数字为「已完成 / 计划总数」</span>
          </footer>
        </section>
      </main>
    </div>

    <!-- 新建计划 -->
    <el-dialog v-model="createVisible" title="新建学习计划" width="460px">
      <el-form label-position="top">
        <el-form-item label="题目 ID" required>
          <el-input
            v-model="createForm.questionId"
            placeholder="请输入题目 ID（纯数字）"
            @keyup.enter="submitCreate"
          />
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker
            v-model="createForm.beginTime"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            :disabled-date="disablePastDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input
            v-model="createForm.notesContent"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="例如：复习链表题，重点看快慢指针"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitCreate">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑计划 -->
    <el-dialog v-model="editVisible" title="编辑学习计划" width="460px">
      <el-form label-position="top">
        <el-form-item v-if="editingPlan && normalizeStatus(editingPlan.status) === 0" label="计划日期（仅未开始可改）">
          <el-date-picker
            v-model="editForm.beginTime"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disablePastDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.notesContent"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="反思总结">
          <el-input
            v-model="editForm.summaryContent"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="做完题后的反思（已完成状态尤其值得记录）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, Plus, Refresh } from '@element-plus/icons-vue'
import AppNavBar from '@/components/layout/AppNavBar.vue'
import progressApi, {
  PROGRESS_STATUS_TAG,
  PROGRESS_STATUS_TEXT,
  type ProgressCalendarVo,
  type ProgressStatus,
  type ProgressTracker,
  type WeeklyReportVo,
} from '@/api/progressApi'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const

const router = useRouter()

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const selectedDate = ref('')
const calendarMap = ref(new Map<string, ProgressCalendarVo>())
const dayPlans = ref<ProgressTracker[]>([])
const weekly = ref<WeeklyReportVo | null>(null)
const calendarLoading = ref(false)
const plansLoading = ref(false)
const saving = ref(false)

const createVisible = ref(false)
const createForm = reactive({
  questionId: '',
  beginTime: todayStr(),
  notesContent: '',
})

const editVisible = ref(false)
const editingPlan = ref<ProgressTracker | null>(null)
const editForm = reactive({
  beginTime: '',
  notesContent: '',
  summaryContent: '',
})

/** 响应信封兼容解包：拦截器返回 {code,message,data}，个别上游可能已解包 */
const unwrapData = <T,>(res: any, fallback: T): T => (res?.data ?? res ?? fallback) as T

/** 本地时区 yyyy-MM-dd，避免 toISOString 的时区偏移 */
function todayStr(): string {
  return formatDate(new Date())
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 把后端可能返回的字符串/非法状态统一归一到 0-3，越界按 0 处理 */
function normalizeStatus(status: any): ProgressStatus {
  const n = Number(status)
  return n >= 0 && n <= 3 ? (n as ProgressStatus) : 0
}

const statusText = (status: any) => PROGRESS_STATUS_TEXT[normalizeStatus(status)]
const statusTag = (status: any) => PROGRESS_STATUS_TAG[normalizeStatus(status)]

const fmtTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 过去日期不可选（计划 beginTime 不得早于今天） */
const disablePastDate = (date: Date) => {
  const today = new Date(todayStr())
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

/** 以周一为第一列，生成 6 行 × 7 列共 42 格（含相邻月份补位） */
function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = formatDate(d)
    return {
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: key === todayStr(),
    }
  })
}

/** 渲染用格子，附带当日统计；allDone 时显示绿色小勾 */
const renderCells = computed(() => {
  return buildMonthCells(viewYear.value, viewMonth.value).map((cell) => {
    const stat = calendarMap.value.get(cell.key)
    return {
      ...cell,
      stat: stat
        ? { total: stat.total, completed: stat.completed, allDone: stat.total > 0 && stat.completed >= stat.total }
        : undefined,
    }
  })
})

const doneCount = computed(() => dayPlans.value.filter((p) => normalizeStatus(p.status) === 2).length)

async function loadCalendar() {
  calendarLoading.value = true
  try {
    const res: any = await progressApi.calendarMonth(`${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-01`)
    const list = unwrapData<ProgressCalendarVo[]>(res, [])
    const map = new Map<string, ProgressCalendarVo>()
    list.forEach((item) => map.set(item.date, item))
    calendarMap.value = map
  } catch (error) {
    console.error('加载月历失败:', error)
    calendarMap.value = new Map()
  } finally {
    calendarLoading.value = false
  }
}

async function loadPlans() {
  if (!selectedDate.value) return
  plansLoading.value = true
  try {
    const res: any = await progressApi.listByDate(selectedDate.value)
    const list = unwrapData<any[]>(res, [])
    dayPlans.value = list.map((item) => ({
      ...item,
      progressId: String(item.progressId ?? ''),
      questionId: String(item.questionId ?? ''),
      status: normalizeStatus(item.status),
    }))
  } catch (error) {
    console.error('加载计划列表失败:', error)
    dayPlans.value = []
  } finally {
    plansLoading.value = false
  }
}

async function loadWeeklyReport() {
  try {
    const res: any = await progressApi.weeklyReport()
    weekly.value = unwrapData<WeeklyReportVo | null>(res, null)
  } catch (error) {
    console.error('加载周报失败:', error)
    weekly.value = null
  }
}

/** 切换月份后校正选中日期，并重新拉取月历与当日计划 */
async function refreshMonth() {
  await loadCalendar()
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  if (!selectedDate.value.startsWith(prefix)) {
    selectedDate.value = todayStr().startsWith(prefix) ? todayStr() : `${prefix}-01`
    await loadPlans()
  }
}

function changeMonth(delta: number) {
  const first = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = first.getFullYear()
  viewMonth.value = first.getMonth()
  refreshMonth()
}

function goToday() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  selectedDate.value = todayStr()
  loadCalendar()
  loadPlans()
}

function selectDate(date: string) {
  if (selectedDate.value === date) return
  selectedDate.value = date
  loadPlans()
}

function openCreate() {
  createForm.questionId = ''
  createForm.beginTime = selectedDate.value || todayStr()
  createForm.notesContent = ''
  createVisible.value = true
}

async function submitCreate() {
  const questionId = createForm.questionId.trim()
  if (!/^\d+$/.test(questionId)) {
    ElMessage.warning('题目 ID 必须为正整数')
    return
  }
  if (!createForm.beginTime) {
    ElMessage.warning('请选择计划日期')
    return
  }

  saving.value = true
  try {
    await progressApi.createPlan({
      questionId,
      beginTime: createForm.beginTime,
      notesContent: createForm.notesContent.trim() || undefined,
    })
    ElMessage.success('计划创建成功')
    createVisible.value = false

    // 跳到新建日期所在月份并选中该天，让用户立刻看到新计划
    const [y, m] = createForm.beginTime.split('-').map(Number)
    if (y !== viewYear.value || m - 1 !== viewMonth.value) {
      viewYear.value = y
      viewMonth.value = m - 1
    }
    selectedDate.value = createForm.beginTime
    await Promise.all([loadCalendar(), loadPlans(), loadWeeklyReport()])
  } catch (error) {
    console.error('创建计划失败:', error)
  } finally {
    saving.value = false
  }
}

function openEdit(plan: ProgressTracker) {
  editingPlan.value = plan
  editForm.beginTime = plan.beginTime
  editForm.notesContent = plan.notesContent || ''
  editForm.summaryContent = plan.summaryContent || ''
  editVisible.value = true
}

async function submitEdit() {
  if (!editingPlan.value) return
  const payload: { progressId: string; beginTime?: string; notesContent?: string; summaryContent?: string } = {
    progressId: String(editingPlan.value.progressId),
    notesContent: editForm.notesContent.trim() || undefined,
    summaryContent: editForm.summaryContent.trim() || undefined,
  }
  // 仅「未开始」可改期
  if (normalizeStatus(editingPlan.value.status) === 0 && editForm.beginTime) {
    payload.beginTime = editForm.beginTime
  }

  saving.value = true
  try {
    await progressApi.updatePlan(payload)
    ElMessage.success('计划已更新')
    editVisible.value = false
    await Promise.all([loadCalendar(), loadPlans(), loadWeeklyReport()])
  } catch (error) {
    console.error('更新计划失败:', error)
  } finally {
    saving.value = false
  }
}

async function removePlan(plan: ProgressTracker) {
  try {
    await ElMessageBox.confirm(`确定删除「题目 #${plan.questionId}」这条计划吗？`, '删除计划', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await progressApi.deletePlan(String(plan.progressId))
    ElMessage.success('计划已删除')
    await Promise.all([loadCalendar(), loadPlans(), loadWeeklyReport()])
  } catch (error) {
    console.error('删除计划失败:', error)
  }
}

function goQuestionDetail(plan: ProgressTracker) {
  router.push({
    path: '/questiondetailview',
    query: { questionId: String(plan.questionId), from: '/plan' },
  })
}

onMounted(() => {
  selectedDate.value = todayStr()
  loadCalendar()
  loadPlans()
  loadWeeklyReport()
})
</script>

<style scoped>
.plan-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
  font-family: var(--cw-font-sans);
}

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ---------- 左侧边栏 ---------- */
.plan-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--cw-border);
  padding: 20px 16px;
  gap: 16px;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.selected-date {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.date-label {
  font-size: 12px;
  color: var(--cw-text-3);
}

.date-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--cw-text-1);
}

.date-count {
  font-size: 12px;
  color: var(--cw-text-3);
}

.plan-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

.plan-card {
  border: 1px solid var(--cw-border);
  border-left: 3px solid var(--cw-text-faint);
  border-radius: 8px;
  padding: 10px 12px;
  background: #ffffff;
  transition: box-shadow 0.2s;
}

.plan-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.plan-card.status-1 {
  border-left-color: var(--cw-brand);
}
.plan-card.status-2 {
  border-left-color: var(--cw-success);
}
.plan-card.status-3 {
  border-left-color: var(--cw-danger);
}

.plan-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plan-question {
  font-weight: 600;
  font-size: 14px;
  color: var(--cw-text-1);
  cursor: pointer;
}

.plan-question:hover {
  color: var(--cw-brand);
}

.plan-notes {
  margin: 8px 0;
  font-size: 13px;
  color: var(--cw-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.plan-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-time {
  font-size: 12px;
  color: var(--cw-text-3);
}

.plan-actions {
  display: flex;
  gap: 2px;
}

/* 周报概览 */
.week-summary {
  border: 1px solid var(--cw-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--cw-brand-soft);
}

.week-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 14px;
  color: var(--cw-text-1);
}

.week-range {
  font-size: 12px;
  color: var(--cw-text-3);
  margin-top: 2px;
}

.week-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.week-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.week-stat .num {
  font-size: 18px;
  font-weight: 700;
  color: var(--cw-text-1);
}

.week-stat.done .num {
  color: var(--cw-success);
}
.week-stat.doing .num {
  color: var(--cw-brand);
}
.week-stat.expired .num {
  color: var(--cw-danger);
}

.week-stat .label {
  font-size: 12px;
  color: var(--cw-text-3);
}

/* ---------- 右侧月历 ---------- */
.plan-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
}

.calendar-card {
  background: #ffffff;
  border: 1px solid var(--cw-border);
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 900px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.calendar-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--cw-text-1);
  min-width: 110px;
  text-align: center;
}

.calendar-tools {
  display: flex;
  gap: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.weekday-cell {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--cw-text-3);
  padding: 6px 0;
}

.day-cell {
  position: relative;
  min-height: 88px;
  border: 1px solid #eef1f5;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-cell:hover {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.today {
  background: var(--cw-brand-soft);
  border-color: var(--cw-brand);
}

.day-cell.selected {
  border-color: var(--cw-brand);
  box-shadow: 0 0 0 2px rgba(255, 161, 22, 0.25);
}

.day-number {
  font-size: 14px;
  font-weight: 600;
  color: var(--cw-text-1);
}

.day-cell.today .day-number {
  color: var(--cw-brand);
}

/* 绿色小勾：当日计划全部完成 */
.day-check {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--cw-success);
  color: #ffffff;
  font-size: 14px;
}

.day-count {
  font-size: 12px;
  color: var(--cw-text-3);
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--cw-text-3);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-check {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cw-success);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 768px) {
  .plan-sidebar {
    display: none;
  }
  .plan-content {
    padding: 12px;
  }
  .calendar-card {
    padding: 12px;
  }
  .day-cell {
    min-height: 64px;
    padding: 6px;
  }
}
</style>
