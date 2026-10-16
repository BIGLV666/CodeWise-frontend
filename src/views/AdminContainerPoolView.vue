<template>
  <div class="pool-page">
      <main class="page-content">
        <section class="page-heading">
          <div>
            <span class="eyebrow">ADMIN · JUDGE RUNTIME</span>
            <h1>判题容器池</h1>
            <p>运行容量与任务负载</p>
          </div>
          <div class="heading-actions">
            <div class="refresh-state">
              <span class="live-dot" :class="{ active: autoRefresh }"></span>
              <span>{{ lastUpdatedText }}</span>
            </div>
            <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="手动" />
            <el-tooltip content="刷新" placement="bottom">
              <el-button :icon="Refresh" circle :loading="refreshing" aria-label="刷新容器池" @click="loadPools(true)" />
            </el-tooltip>
          </div>
        </section>

      <section class="summary-grid" aria-label="容器池汇总">
        <article class="summary-item">
          <span class="summary-icon neutral"><el-icon><Box /></el-icon></span>
          <div><strong>{{ summary.total }}</strong><span>容器总数</span></div>
        </article>
        <article class="summary-item">
          <span class="summary-icon idle"><el-icon><CircleCheck /></el-icon></span>
          <div><strong>{{ summary.idle }}</strong><span>空闲可用</span></div>
        </article>
        <article class="summary-item">
          <span class="summary-icon busy"><el-icon><Cpu /></el-icon></span>
          <div><strong>{{ summary.busy }}</strong><span>正在运行</span></div>
        </article>
        <article class="summary-item">
          <span class="summary-icon waiting"><el-icon><Timer /></el-icon></span>
          <div><strong>{{ summary.waiting }}</strong><span>等待任务</span></div>
        </article>
      </section>

      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        show-icon
        class="load-alert"
      />

      <section class="pool-section" aria-label="语言容器池">
        <header class="section-header">
          <div>
            <h2>语言运行池</h2>
            <span>{{ pools.length }} 个运行环境</span>
          </div>
          <el-tag :type="overallHealth.type" effect="plain">{{ overallHealth.label }}</el-tag>
        </header>

        <div v-if="loading" class="skeleton-list">
          <el-skeleton v-for="index in 4" :key="index" :rows="2" animated />
        </div>
        <el-empty v-else-if="pools.length === 0" description="暂无容器池数据" />

        <div v-else class="pool-list">
          <article v-for="pool in pools" :key="pool.language" class="pool-row">
            <div class="pool-main">
              <button
                class="expand-button"
                type="button"
                :aria-expanded="expandedLanguages.has(pool.language)"
                :aria-label="`${getLanguageLabel(pool.language)} 容器明细`"
                @click="toggleExpanded(pool.language)"
              >
                <el-icon :class="{ expanded: expandedLanguages.has(pool.language) }"><ArrowRight /></el-icon>
              </button>

              <div class="language-cell">
                <span class="language-mark">{{ getLanguageMark(pool.language) }}</span>
                <div>
                  <strong>{{ getLanguageLabel(pool.language) }}</strong>
                  <span>{{ pool.language }}</span>
                </div>
              </div>

              <div class="metric-cell">
                <span>容量</span>
                <strong>{{ pool.total }} / {{ pool.configuredCapacity }}</strong>
              </div>
              <div class="metric-cell idle-text">
                <span>空闲</span>
                <strong>{{ pool.idle }}</strong>
              </div>
              <div class="metric-cell busy-text">
                <span>运行</span>
                <strong>{{ pool.busy }}</strong>
              </div>
              <div class="metric-cell" :class="{ 'waiting-text': pool.waiting > 0 }">
                <span>等待</span>
                <strong>{{ pool.waiting }}</strong>
              </div>

              <div class="load-cell">
                <div><span>负载</span><strong>{{ getUtilization(pool) }}%</strong></div>
                <el-progress
                  :percentage="getUtilization(pool)"
                  :stroke-width="7"
                  :show-text="false"
                  :color="getProgressColor(pool)"
                />
              </div>

              <el-tag :type="getPoolState(pool).type" size="small" effect="plain">
                {{ getPoolState(pool).label }}
              </el-tag>

              <el-tooltip content="增加容器" placement="top">
                <el-button
                  :icon="Plus"
                  circle
                  size="small"
                  :loading="addingLanguages.has(pool.language)"
                  :aria-label="`增加 ${getLanguageLabel(pool.language)} 容器`"
                  @click="addContainer(pool.language)"
                />
              </el-tooltip>
            </div>

            <div v-if="expandedLanguages.has(pool.language)" class="container-details">
              <div class="container-group">
                <header><span class="status-dot idle-dot"></span><strong>空闲容器</strong><small>{{ pool.idleContainerIds.length }}</small></header>
                <div v-if="pool.idleContainerIds.length" class="container-list">
                  <div v-for="containerId in pool.idleContainerIds" :key="containerId" class="container-line">
                    <code :title="containerId">{{ containerId }}</code>
                    <div class="container-actions">
                      <el-tooltip content="复制 ID" placement="top">
                        <el-button :icon="CopyDocument" circle text size="small" @click="copyContainerId(containerId)" />
                      </el-tooltip>
                      <el-tooltip :content="pool.total <= 1 ? '至少保留一个容器' : '删除容器'" placement="top">
                        <el-button
                          :icon="Delete"
                          circle
                          text
                          size="small"
                          type="danger"
                          :disabled="pool.total <= 1"
                          :loading="removingContainerIds.has(containerId)"
                          @click="removeContainer(pool, containerId)"
                        />
                      </el-tooltip>
                    </div>
                  </div>
                </div>
                <span v-else class="empty-group">无空闲容器</span>
              </div>

              <div class="container-group">
                <header><span class="status-dot busy-dot"></span><strong>运行中</strong><small>{{ pool.busyContainerIds.length }}</small></header>
                <div v-if="pool.busyContainerIds.length" class="container-list">
                  <div v-for="containerId in pool.busyContainerIds" :key="containerId" class="container-line">
                    <code :title="containerId">{{ containerId }}</code>
                    <el-tooltip content="复制 ID" placement="top">
                      <el-button :icon="CopyDocument" circle text size="small" @click="copyContainerId(containerId)" />
                    </el-tooltip>
                  </div>
                </div>
                <span v-else class="empty-group">当前无运行任务</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Box,
  CircleCheck,
  CopyDocument,
  Cpu,
  Delete,
  Plus,
  Refresh,
  Timer,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import adminContainerApi, { type ContainerPoolStatus } from '@/api/adminContainerApi'
import { errorText } from '@/api/request'
import { logWarn } from '@/utils/logger'

type TagType = 'success' | 'warning' | 'danger' | 'info'

const router = useRouter()
const pools = ref<ContainerPoolStatus[]>([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const lastUpdatedAt = ref<Date | null>(null)
const autoRefresh = ref(localStorage.getItem('containerPoolAutoRefresh') !== 'false')
const expandedLanguages = ref(new Set<string>())
const addingLanguages = ref(new Set<string>())
const removingContainerIds = ref(new Set<string>())
let refreshTimer: number | undefined

const summary = computed(() => pools.value.reduce(
  (result, pool) => ({
    total: result.total + pool.total,
    idle: result.idle + pool.idle,
    busy: result.busy + pool.busy,
    waiting: result.waiting + pool.waiting,
  }),
  { total: 0, idle: 0, busy: 0, waiting: 0 },
))

const lastUpdatedText = computed(() => lastUpdatedAt.value
  ? `更新于 ${lastUpdatedAt.value.toLocaleTimeString('zh-CN', { hour12: false })}`
  : '尚未更新')

const overallHealth = computed<{ label: string; type: TagType }>(() => {
  if (pools.value.some((pool) => pool.total < pool.configuredCapacity)) return { label: '容量不足', type: 'danger' }
  if (summary.value.waiting > 0) return { label: '存在排队', type: 'warning' }
  if (pools.value.length === 0) return { label: '状态未知', type: 'info' }
  return { label: '运行正常', type: 'success' }
})

function normalizePool(raw: any): ContainerPoolStatus {
  return {
    language: String(raw.language || ''),
    total: Number(raw.total || 0),
    idle: Number(raw.idle || 0),
    busy: Number(raw.busy || 0),
    waiting: Number(raw.waiting || 0),
    configuredCapacity: Number(raw.configuredCapacity || 0),
    idleContainerIds: Array.isArray(raw.idleContainerIds) ? raw.idleContainerIds.map(String) : [],
    busyContainerIds: Array.isArray(raw.busyContainerIds) ? raw.busyContainerIds.map(String) : [],
  }
}

/**
 * @param showLoading 首次加载/手动刷新按钮：显示 loading 并允许内联错误态；
 *                    8s 自动刷新时传 false，请求也走 silent，避免后台抖动反复弹全局提示。
 */
async function loadPools(showLoading = false) {
  if (refreshing.value) return
  if (showLoading) loading.value = true
  refreshing.value = true
  loadError.value = ''
  try {
    const response: any = await adminContainerApi.getPools({ silent: !showLoading })
    const records = response?.data ?? response ?? []
    pools.value = Array.isArray(records) ? records.map(normalizePool) : []
    lastUpdatedAt.value = new Date()
  } catch (error) {
    if (showLoading) loadError.value = errorText(error, '容器池状态加载失败')
    else logWarn('容器池自动刷新失败:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function updateSet(target: typeof addingLanguages, value: string, active: boolean) {
  const next = new Set(target.value)
  active ? next.add(value) : next.delete(value)
  target.value = next
}

async function addContainer(language: string) {
  if (addingLanguages.value.has(language)) return
  updateSet(addingLanguages, language, true)
  try {
    await adminContainerApi.addContainer(language)
    ElMessage.success(`${getLanguageLabel(language)} 容器已增加`)
    await loadPools()
  } catch (error) {
    logWarn('增加判题容器失败:', error)
  } finally {
    updateSet(addingLanguages, language, false)
  }
}

async function removeContainer(pool: ContainerPoolStatus, containerId: string) {
  try {
    await ElMessageBox.confirm(
      `确认删除空闲容器 ${containerId.slice(0, 12)}？`,
      `删除 ${getLanguageLabel(pool.language)} 容器`,
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  updateSet(removingContainerIds, containerId, true)
  try {
    await adminContainerApi.removeContainer(pool.language, containerId)
    ElMessage.success('容器已删除')
    await loadPools()
  } catch (error) {
    logWarn('删除判题容器失败:', error)
  } finally {
    updateSet(removingContainerIds, containerId, false)
  }
}

function toggleExpanded(language: string) {
  const next = new Set(expandedLanguages.value)
  next.has(language) ? next.delete(language) : next.add(language)
  expandedLanguages.value = next
}

async function copyContainerId(containerId: string) {
  await navigator.clipboard.writeText(containerId)
  ElMessage.success('容器 ID 已复制')
}

function getUtilization(pool: ContainerPoolStatus) {
  return pool.total > 0 ? Math.round((pool.busy / pool.total) * 100) : 0
}

function getProgressColor(pool: ContainerPoolStatus) {
  const utilization = getUtilization(pool)
  if (pool.waiting > 0 || utilization >= 90) return '#d85b58'
  if (utilization >= 60) return '#d9921e'
  return '#35a36f'
}

function getPoolState(pool: ContainerPoolStatus): { label: string; type: TagType } {
  if (pool.total < pool.configuredCapacity) return { label: '容量不足', type: 'danger' }
  if (pool.waiting > 0) return { label: '任务排队', type: 'warning' }
  if (pool.total > 0 && pool.idle === 0) return { label: '满负载', type: 'warning' }
  return { label: '可用', type: 'success' }
}

function getLanguageLabel(language: string) {
  return ({ java: 'Java', python: 'Python', cpp: 'C++', c: 'C' } as Record<string, string>)[language.toLowerCase()] || language
}

function getLanguageMark(language: string) {
  return ({ java: 'J', python: 'PY', cpp: 'C++', c: 'C' } as Record<string, string>)[language.toLowerCase()] || language.slice(0, 2).toUpperCase()
}

function stopAutoRefresh() {
  if (refreshTimer) window.clearInterval(refreshTimer)
  refreshTimer = undefined
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (!autoRefresh.value) return
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') loadPools()
  }, 8_000)
}

watch(autoRefresh, (enabled) => {
  localStorage.setItem('containerPoolAutoRefresh', String(enabled))
  startAutoRefresh()
})

onMounted(() => {
  loadPools(true)
  startAutoRefresh()
})

onBeforeUnmount(stopAutoRefresh)
</script>

<style scoped>
.pool-page {
  min-height: 100vh; min-height: 100dvh;
  background: var(--cw-bg-page);
  color: #25282d;
  font-family: var(--cw-font-sans);
}

.topbar {
  height: 58px;
  padding: 0 30px;
  border-bottom: 1px solid #e5e8ec;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 14px;
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
  background: #e1e4e8;
}

.page-name {
  flex: 1;
  color: #484e57;
  font-size: 14px;
  font-weight: 600;
}

.page-content {
  width: min(1240px, calc(100% - 48px));
  margin: 0 auto;
  padding: 34px 0 60px;
}

.page-heading {
  margin-bottom: 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.eyebrow {
  color: var(--cw-brand-dark);
  font-size: 11px;
  font-weight: 700;
}

.page-heading h1 {
  margin: 7px 0 4px;
  font-size: 27px;
  letter-spacing: 0;
}

.page-heading p {
  margin: 0;
  color: #858c95;
  font-size: 13px;
}

.heading-actions,
.refresh-state {
  display: flex;
  align-items: center;
}

.heading-actions {
  gap: 12px;
}

.refresh-state {
  gap: 7px;
  color: #858c95;
  font-size: 12px;
}

.live-dot,
.status-dot {
  display: inline-block;
  border-radius: 50%;
}

.live-dot {
  width: 7px;
  height: 7px;
  background: #a8adb4;
}

.live-dot.active {
  background: var(--cw-success);
  box-shadow: 0 0 0 3px rgba(53, 163, 111, 0.12);
}

.summary-grid {
  margin-bottom: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary-item {
  min-width: 0;
  padding: 18px;
  border: 1px solid #e4e7eb;
  border-radius: 7px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 13px;
}

.summary-icon {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 18px;
}

.summary-icon.neutral { color: #59616c; background: #f0f2f4; }
.summary-icon.idle { color: var(--cw-success); background: #ebf7f0; }
.summary-icon.busy { color: var(--cw-brand-dark); background: var(--cw-brand-soft); }
.summary-icon.waiting { color: var(--cw-danger); background: #fceeee; }

.summary-item div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.summary-item strong {
  color: #24282e;
  font-size: 23px;
  line-height: 1.1;
}

.summary-item span:last-child {
  margin-top: 5px;
  color: #8c929a;
  font-size: 11px;
}

.load-alert {
  margin-bottom: 16px;
}

.pool-section {
  border: 1px solid #e3e6ea;
  border-radius: 7px;
  background: #fff;
  overflow: hidden;
}

.section-header {
  min-height: 66px;
  padding: 0 20px;
  border-bottom: 1px solid #e9ebee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-header > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.section-header h2 {
  margin: 0;
  font-size: 16px;
}

.section-header span {
  color: #969ca4;
  font-size: 11px;
}

.skeleton-list {
  padding: 20px;
  display: grid;
  gap: 24px;
}

.pool-row {
  border-bottom: 1px solid var(--cw-bg-subtle);
}

.pool-row:last-child {
  border-bottom: 0;
}

.pool-main {
  min-height: 82px;
  padding: 0 18px 0 10px;
  display: grid;
  grid-template-columns: 28px minmax(150px, 1.35fr) repeat(4, minmax(58px, .55fr)) minmax(150px, 1fr) 78px 34px;
  align-items: center;
  gap: 12px;
  transition: background 0.16s ease;
}

.pool-main:hover {
  background: var(--cw-bg-page);
}

.expand-button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #8d949d;
  cursor: pointer;
}

.expand-button .el-icon {
  transition: transform 0.18s ease;
}

.expand-button .el-icon.expanded {
  transform: rotate(90deg);
}

.language-cell {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
}

.language-mark {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 6px;
  background: var(--cw-bg-page);
  color: #4f5660;
  display: grid;
  place-items: center;
  font: 700 11px/1 Consolas, monospace;
}

.language-cell div,
.metric-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.language-cell strong,
.metric-cell strong {
  color: #33383f;
  font-size: 13px;
}

.language-cell span:last-child,
.metric-cell span,
.load-cell span {
  color: #969ca4;
  font-size: 10px;
}

.idle-text strong { color: var(--cw-success); }
.busy-text strong { color: var(--cw-brand-dark); }
.waiting-text strong { color: var(--cw-danger); }

.load-cell {
  min-width: 0;
}

.load-cell > div {
  margin-bottom: 7px;
  display: flex;
  justify-content: space-between;
}

.load-cell strong {
  color: #5d646d;
  font-size: 11px;
}

.container-details {
  padding: 0 62px 18px;
  background: var(--cw-bg-page);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.container-group {
  min-width: 0;
  padding: 14px;
  border: 1px solid #e7eaee;
  border-radius: 6px;
  background: #fff;
}

.container-group header {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.container-group header strong {
  color: #555c65;
  font-size: 12px;
}

.container-group header small {
  margin-left: auto;
  color: #9aa0a8;
}

.status-dot {
  width: 7px;
  height: 7px;
}

.idle-dot { background: var(--cw-success); }
.busy-dot { background: var(--cw-brand-dark); }

.container-list {
  display: grid;
  gap: 5px;
}

.container-line {
  min-width: 0;
  min-height: 32px;
  padding-left: 9px;
  border-radius: 4px;
  background: #f6f7f8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.container-line code {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #626a74;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.container-actions {
  flex: 0 0 auto;
  display: flex;
}

.empty-group {
  color: #a0a6ae;
  font-size: 11px;
}

@media (max-width: 1024px) {
  .pool-main {
    grid-template-columns: 28px minmax(140px, 1.2fr) repeat(3, 58px) minmax(130px, 1fr) 74px 34px;
  }

  .metric-cell:nth-of-type(2) {
    display: none;
  }
}

@media (max-width: 768px) {
  .topbar { padding: 0 16px; }
  .page-content { width: calc(100% - 28px); padding-top: 24px; }
  .page-heading { align-items: flex-start; flex-direction: column; }
  .heading-actions { width: 100%; justify-content: space-between; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pool-main {
    padding: 14px 12px;
    grid-template-columns: 28px minmax(130px, 1fr) 68px 34px;
  }
  .metric-cell,
  .load-cell,
  .pool-main > .el-tag {
    display: none;
  }
  .container-details { padding: 0 12px 14px; grid-template-columns: 1fr; }
}
</style>
