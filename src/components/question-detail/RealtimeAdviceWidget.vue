<template>
  <Teleport to="body">
    <aside
      v-if="panelVisible"
      class="advice-panel"
      :style="panelStyle"
      aria-label="实时分析建议"
    >
      <header class="panel-header">
        <div>
          <span class="panel-kicker">实时分析</span>
          <strong>解题建议</strong>
        </div>
        <div class="panel-actions">
          <el-tooltip content="刷新建议" placement="top">
            <el-button :icon="RefreshRight" circle text size="small" :loading="loading" @click="loadAdvices" />
          </el-tooltip>
          <el-tooltip content="关闭" placement="top">
            <el-button :icon="Close" circle text size="small" @click="panelVisible = false" />
          </el-tooltip>
        </div>
      </header>

      <div class="panel-content" aria-live="polite">
        <div v-if="loading" class="loading-state">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在读取建议</span>
        </div>
        <el-empty v-else-if="advices.length === 0" :image-size="54" description="暂时没有需要提醒的内容" />
        <article v-for="(advice, index) in advices" v-else :key="`${index}-${advice.slice(0, 24)}`" class="advice-item">
          <span class="advice-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="advice-markdown" v-html="renderMarkdown(advice)"></div>
        </article>
      </div>
    </aside>

    <el-badge :is-dot="unread" class="floating-badge" :style="ballStyle">
      <button
        class="floating-ball"
        :class="{ flashing, dragging }"
        type="button"
        title="实时分析建议（可拖动）"
        aria-label="打开实时分析建议，可拖动改变位置"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @click="togglePanel"
      >
        <el-icon><MagicStick /></el-icon>
      </button>
    </el-badge>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Close, Loading, MagicStick, RefreshRight } from '@element-plus/icons-vue'
import aiApi, { type RealtimeAnalysisPush } from '@/api/aiApi'
import websocketService from '@/utils/WebSocket'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  questionId: string | number
}>()

const AI_EVENT = 'ai-advice'
const POSITION_KEY = 'codewise_realtime_advice_position'
const BALL_SIZE = 48
const EDGE_GAP = 12
const PANEL_GAP = 12

const panelVisible = ref(false)
const loading = ref(false)
const unread = ref(false)
const flashing = ref(false)
const dragging = ref(false)
const advices = ref<string[]>([])
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)
const position = ref({ x: window.innerWidth - BALL_SIZE - 28, y: window.innerHeight - BALL_SIZE - 92 })
let activePointerId: number | null = null
let dragStart = { pointerX: 0, pointerY: 0, x: 0, y: 0 }
let movedDuringDrag = false
let suppressClick = false
let flashTimer: number | undefined

const ballStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}))

const panelStyle = computed(() => {
  const width = Math.min(360, viewportWidth.value - EDGE_GAP * 2)
  const height = Math.min(430, viewportHeight.value - EDGE_GAP * 2)
  const opensLeft = position.value.x > viewportWidth.value / 2
  const left = opensLeft
    ? position.value.x - width - PANEL_GAP
    : position.value.x + BALL_SIZE + PANEL_GAP
  const top = Math.min(
    Math.max(EDGE_GAP, position.value.y - Math.round(height * 0.42)),
    viewportHeight.value - height - EDGE_GAP,
  )
  return {
    width: `${width}px`,
    height: `${height}px`,
    left: `${Math.min(Math.max(EDGE_GAP, left), viewportWidth.value - width - EDGE_GAP)}px`,
    top: `${top}px`,
  }
})

function clampPosition() {
  position.value = {
    x: Math.min(Math.max(EDGE_GAP, position.value.x), viewportWidth.value - BALL_SIZE - EDGE_GAP),
    y: Math.min(Math.max(EDGE_GAP, position.value.y), viewportHeight.value - BALL_SIZE - EDGE_GAP),
  }
}

function savePosition() {
  localStorage.setItem(POSITION_KEY, JSON.stringify(position.value))
}

function restorePosition() {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) || '')
    if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) {
      position.value = { x: Number(stored.x), y: Number(stored.y) }
    }
  } catch {
    // Use the default bottom-right position when no saved position exists.
  }
  clampPosition()
}

function handleResize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  clampPosition()
  savePosition()
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return
  activePointerId = event.pointerId
  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: position.value.x,
    y: position.value.y,
  }
  movedDuringDrag = false
  dragging.value = true
  event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  const deltaX = event.clientX - dragStart.pointerX
  const deltaY = event.clientY - dragStart.pointerY
  if (Math.abs(deltaX) + Math.abs(deltaY) > 4) movedDuringDrag = true
  position.value = { x: dragStart.x + deltaX, y: dragStart.y + deltaY }
  clampPosition()
}

function endDrag(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  activePointerId = null
  dragging.value = false
  if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  if (movedDuringDrag) {
    suppressClick = true
    window.setTimeout(() => { suppressClick = false }, 0)
    savePosition()
  }
}

async function loadAdvices() {
  if (!props.questionId || loading.value) return
  loading.value = true
  try {
    const response: any = await aiApi.getRealtimeAdvices(props.questionId)
    const records = response?.data ?? response ?? []
    advices.value = Array.isArray(records)
      ? records.map((item) => String(item ?? '').trim()).filter(Boolean).reverse()
      : []
    unread.value = false
  } catch (error) {
    console.error('加载实时分析建议失败:', error)
  } finally {
    loading.value = false
  }
}

function togglePanel() {
  if (suppressClick) return
  panelVisible.value = !panelVisible.value
  if (panelVisible.value) loadAdvices()
}

function extractRealtimeAdvice(raw: unknown) {
  const payload = raw && typeof raw === 'object' && 'result' in raw
    ? (raw as { result?: unknown }).result
    : raw
  if (!payload || typeof payload !== 'object') return null

  const push = payload as Partial<RealtimeAnalysisPush>
  if (push.type !== 'AITASKADVICE') return null
  if (String(push.questionId ?? '') !== String(props.questionId)) return null
  if (typeof push.advice !== 'string' || !push.advice.trim()) return null
  return push as RealtimeAnalysisPush
}

function handleRealtimePush(raw: unknown) {
  if (!extractRealtimeAdvice(raw)) return
  unread.value = true
  flashing.value = false
  if (flashTimer) window.clearTimeout(flashTimer)
  nextTick(() => {
    flashing.value = true
    flashTimer = window.setTimeout(() => { flashing.value = false }, 2600)
  })
  if (panelVisible.value) loadAdvices()
}

const stopAdviceListener = websocketService.on(AI_EVENT, handleRealtimePush)

watch(() => props.questionId, () => {
  panelVisible.value = false
  advices.value = []
  unread.value = false
})

onMounted(() => {
  restorePosition()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopAdviceListener()
  window.removeEventListener('resize', handleResize)
  if (flashTimer) window.clearTimeout(flashTimer)
})
</script>

<style scoped>
.floating-badge {
  position: fixed;
  z-index: 2100;
  width: 48px;
  height: 48px;
  touch-action: none;
}

.floating-badge :deep(.el-badge__content.is-fixed.is-dot) {
  top: 4px;
  right: 5px;
  width: 9px;
  height: 9px;
  border: 2px solid #fff;
  background: var(--cw-danger);
}

.floating-ball {
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid #e1e4e8;
  border-radius: 50%;
  background: #fff;
  color: var(--cw-brand-dark);
  box-shadow: 0 7px 20px rgba(28, 32, 38, 0.16);
  cursor: grab;
  display: grid;
  place-items: center;
  font-size: 21px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
  user-select: none;
}

.floating-ball:hover,
.floating-ball:focus-visible {
  border-color: var(--cw-brand-dark);
  color: var(--cw-brand-dark);
  box-shadow: 0 8px 24px rgba(218, 137, 17, 0.22);
  outline: none;
}

.floating-ball.dragging {
  cursor: grabbing;
  transition: none;
}

.floating-ball.flashing {
  animation: realtime-advice-flash 1.2s ease-in-out 2;
}

.advice-panel {
  position: fixed;
  z-index: 2099;
  box-sizing: border-box;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 16px 42px rgba(24, 28, 34, 0.17);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  min-height: 58px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--cw-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header > div:first-child {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.panel-kicker {
  color: var(--cw-brand-dark);
  font-size: 11px;
  font-weight: 700;
}

.panel-header strong {
  color: #30343a;
  font-size: 15px;
}

.panel-actions {
  flex: 0 0 auto;
  display: flex;
}

.panel-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  scrollbar-width: thin;
}

.loading-state {
  height: 100%;
  color: #8a919a;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
}

.advice-item {
  padding: 13px 0;
  border-bottom: 1px solid #eff1f3;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
}

.advice-item:first-child {
  padding-top: 2px;
}

.advice-item:last-child {
  border-bottom: 0;
}

.advice-index {
  color: var(--cw-brand-dark);
  font: 600 11px/1.7 'JetBrains Mono', var(--cw-font-mono);
}

.advice-markdown {
  min-width: 0;
  color: #4b5159;
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.advice-markdown :deep(p) {
  margin: 0 0 8px;
}

.advice-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.advice-markdown :deep(pre) {
  max-width: 100%;
  overflow: auto;
  padding: 10px;
  border-radius: 5px;
  background: #f6f7f8;
}

@keyframes realtime-advice-flash {
  0%, 100% {
    box-shadow: 0 7px 20px rgba(28, 32, 38, 0.16);
  }
  45% {
    border-color: var(--cw-brand-dark);
    box-shadow: 0 0 0 7px rgba(240, 160, 28, 0.18), 0 9px 24px rgba(28, 32, 38, 0.18);
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-ball.flashing {
    animation: none;
  }
}
</style>
