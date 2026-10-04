<template>
  <div class="failure-page">
    <main class="page-content">
      <section class="page-heading">
        <div>
          <span class="eyebrow">ADMIN · JUDGE RECOVERY</span>
          <h1>判题失败任务</h1>
          <p>查看异常提交的补偿状态，并重新投递仍待操作的任务。</p>
        </div>
        <el-button :icon="Refresh" :loading="loading" @click="loadRecords">刷新</el-button>
      </section>

      <section class="summary-grid" aria-label="当前状态汇总">
        <button
          v-for="item in statusOptions"
          :key="item.value"
          type="button"
          class="summary-card"
          :class="[{ active: activeStatus === item.value }, `tone-${item.tone}`]"
          @click="activeStatus = item.value"
        >
          <span class="summary-icon"><el-icon><component :is="item.icon" /></el-icon></span>
          <span class="summary-copy"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
          <span class="summary-count">{{ activeStatus === item.value ? records.length : '—' }}</span>
        </button>
      </section>

      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
        class="load-alert"
      />

      <section class="records-card">
        <header class="card-header">
          <div>
            <h2>{{ currentStatus.label }}</h2>
            <span>共 {{ records.length }} 条记录</span>
          </div>
          <el-tag :type="currentStatus.tagType" effect="plain">{{ currentStatus.description }}</el-tag>
        </header>

        <el-table v-loading="loading" :data="records" empty-text="当前状态下暂无失败提交" row-key="failureSubmitId">
          <el-table-column label="任务 ID" min-width="120">
            <template #default="{ row }">#{{ row.failureSubmitId }}</template>
          </el-table-column>
          <el-table-column label="提交记录" min-width="135">
            <template #default="{ row }">#{{ row.submitRecordId }}</template>
          </el-table-column>
          <el-table-column prop="retryCount" label="重试次数" width="105" align="center" />
          <el-table-column label="创建时间" min-width="175">
            <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
          </el-table-column>
          <el-table-column label="最近重试" min-width="175">
            <template #default="{ row }">{{ formatDate(row.retryTime) }}</template>
          </el-table-column>
          <el-table-column label="错误信息" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ muted: !row.lastError }">{{ row.lastError || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="105" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusOption(row.status).tagType" effect="light">
                {{ getStatusOption(row.status).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="105" fixed="right" align="center">
            <template #default="{ row }">
              <el-tooltip
                :disabled="row.status === FAILURE_SUBMIT_STATUS.PENDING"
                content="只有待操作任务支持重试"
                placement="top"
              >
                <span>
                  <el-button
                    type="primary"
                    link
                    :icon="RefreshRight"
                    :disabled="row.status !== FAILURE_SUBMIT_STATUS.PENDING"
                    :loading="retryingIds.has(row.failureSubmitId)"
                    @click="retryRecord(row)"
                  >重试</el-button>
                </span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CircleCheck, Clock, Loading, Refresh, RefreshRight, Warning } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminFailureSubmitApi, {
  FAILURE_SUBMIT_STATUS,
  type FailureSubmit,
  type FailureSubmitStatus,
} from '@/api/adminFailureSubmitApi'
import { errorText } from '@/api/request'

const statusOptions = [
  { value: FAILURE_SUBMIT_STATUS.PENDING, label: '待操作', description: '可重新投递', tone: 'pending', tagType: 'warning', icon: Clock },
  { value: FAILURE_SUBMIT_STATUS.RETRYING, label: '重试中', description: '正在执行', tone: 'running', tagType: 'primary', icon: Loading },
  { value: FAILURE_SUBMIT_STATUS.SUCCESS, label: '已成功', description: '补偿完成', tone: 'success', tagType: 'success', icon: CircleCheck },
  { value: FAILURE_SUBMIT_STATUS.FAILURE, label: '重试失败', description: '等待系统补偿', tone: 'failure', tagType: 'danger', icon: Warning },
] as const

const activeStatus = ref<FailureSubmitStatus>(FAILURE_SUBMIT_STATUS.PENDING)
const records = ref<FailureSubmit[]>([])
const loading = ref(false)
const loadError = ref('')
const retryingIds = ref(new Set<number>())

const currentStatus = computed(() => getStatusOption(activeStatus.value))

function getStatusOption(status: FailureSubmitStatus) {
  return statusOptions.find((item) => item.value === status) ?? statusOptions[0]
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function loadRecords() {
  loading.value = true
  loadError.value = ''
  try {
    records.value = await adminFailureSubmitApi.list(activeStatus.value)
  } catch (error) {
    records.value = []
    loadError.value = errorText(error, '失败提交记录加载失败')
  } finally {
    loading.value = false
  }
}

function setRetrying(id: number, active: boolean) {
  const next = new Set(retryingIds.value)
  active ? next.add(id) : next.delete(id)
  retryingIds.value = next
}

async function retryRecord(record: FailureSubmit) {
  if (record.status !== FAILURE_SUBMIT_STATUS.PENDING) return

  try {
    await ElMessageBox.confirm(
      `确认重新投递提交记录 #${record.submitRecordId}？`,
      '重试判题任务',
      { confirmButtonText: '确认重试', cancelButtonText: '取消', type: 'warning' },
    )
    setRetrying(record.failureSubmitId, true)
    await adminFailureSubmitApi.retry(record.failureSubmitId)
    ElMessage.success('任务已加入重试队列')
    await loadRecords()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error('重试判题任务失败:', error)
    }
  } finally {
    setRetrying(record.failureSubmitId, false)
  }
}

watch(activeStatus, loadRecords)
onMounted(loadRecords)
</script>

<style scoped>
.failure-page { min-height: 100vh; color: var(--cw-text-1); background: var(--cw-bg-page); }
.page-content { width: min(1420px, calc(100% - 48px)); margin: 0 auto; padding: 42px 0 64px; }
.page-heading { margin-bottom: 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.eyebrow { color: var(--cw-text-3); font-size: 11px; font-weight: 700; letter-spacing: .13em; }
h1 { margin: 7px 0 5px; color: var(--cw-text-1); font-size: 28px; letter-spacing: -.03em; }
.page-heading p { margin: 0; color: var(--cw-text-3); font-size: 13px; }
.summary-grid { margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.summary-card { min-width: 0; padding: 16px; border: 1px solid var(--cw-border); border-radius: 9px; display: flex; align-items: center; gap: 12px; text-align: left; background: #fff; cursor: pointer; transition: border-color .18s, box-shadow .18s, transform .18s; }
.summary-card:hover { transform: translateY(-1px); border-color: #cbd5e1; box-shadow: 0 5px 16px rgba(15, 23, 42, .05); }
.summary-card.active { border-color: currentColor; box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 12%, transparent); }
.tone-pending { color: var(--cw-brand-dark); } .tone-running { color: #2563eb; } .tone-success { color: var(--cw-success); } .tone-failure { color: var(--cw-danger); }
.summary-icon { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 8px; display: grid; place-items: center; font-size: 18px; background: color-mix(in srgb, currentColor 10%, white); }
.summary-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 3px; }
.summary-copy strong { color: #273244; font-size: 14px; } .summary-copy small { color: var(--cw-text-3); font-size: 11px; }
.summary-count { color: var(--cw-text-3); font-size: 22px; font-weight: 700; }
.load-alert { margin-bottom: 16px; }
.records-card { border: 1px solid var(--cw-border); border-radius: 9px; overflow: hidden; background: #fff; }
.card-header { min-height: 68px; padding: 0 20px; border-bottom: 1px solid var(--cw-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-header > div { display: flex; align-items: baseline; gap: 10px; }
.card-header h2 { margin: 0; color: var(--cw-text-1); font-size: 16px; }
.card-header span { color: var(--cw-text-3); font-size: 11px; }
.muted { color: #a8b0bc; }
:deep(.el-table th.el-table__cell) { background: var(--cw-bg-page); color: var(--cw-text-3); font-size: 12px; font-weight: 600; }
:deep(.el-table td.el-table__cell) { color: var(--cw-text-3); font-size: 12px; }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .page-content { width: calc(100% - 28px); padding-top: 28px; } }
@media (max-width: 560px) { .page-heading { align-items: flex-start; flex-direction: column; } .summary-grid { grid-template-columns: 1fr; } }
</style>
