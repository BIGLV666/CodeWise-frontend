import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

/**
 * 响应式视口尺寸（精确像素）。
 *
 * 与 useBreakpoint 的区别：断点判断「落在哪一档」，这里给的是真实像素值，
 * 供需要精确计算的场景使用（例如可拖拽悬浮球的边界夹取、按百分比控高）。
 *
 * 实现要点：全局只注册**一个** resize 监听并用 rAF 合并，
 * 多个组件同时使用时不会产生 N 个监听器（避免 resize 抖动与泄漏）。
 */
const width = ref(0)
const height = ref(0)

let subscribers = 0
let frame: number | undefined

function read() {
  width.value = window.innerWidth
  height.value = window.innerHeight
}

function onResize() {
  if (frame !== undefined) return
  frame = window.requestAnimationFrame(() => {
    frame = undefined
    read()
  })
}

function subscribe() {
  if (subscribers === 0) {
    read()
    window.addEventListener('resize', onResize, { passive: true })
  }
  subscribers += 1
}

function unsubscribe() {
  if (subscribers === 0) return
  subscribers -= 1
  if (subscribers > 0) return
  window.removeEventListener('resize', onResize)
  if (frame !== undefined) {
    window.cancelAnimationFrame(frame)
    frame = undefined
  }
}

export function useViewportSize(): { width: Ref<number>; height: Ref<number> } {
  if (typeof window !== 'undefined') {
    subscribe()
    if (getCurrentScope()) onScopeDispose(unsubscribe)
  }
  return { width, height }
}
