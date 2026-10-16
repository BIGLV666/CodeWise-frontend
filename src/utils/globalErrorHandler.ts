import type { App } from 'vue'
import { ElMessage } from 'element-plus'
import { getRecentErrors, reportError } from './logger'

const DEV = import.meta.env.DEV

/**
 * 全局意外错误兜底。
 *
 * 在装上这套兜底之前，组件渲染异常、事件处理器里漏接的 promise、以及定时器
 * 内的异常都没有统一出口：有的直接消失，有的各自 `console.error`。这里收成一条路径：
 *   记录（logger 环形缓冲）+ 给用户一条通用提示（同一窗口内只弹一次）。
 *
 * 注意区分两类错误，别把业务失败也卷进来：
 *  - 业务失败（接口返回非 200、网络不可用）由 api/request.ts 拦截器提示，**不走这里**；
 *  - 这里只处理「代码没接住」的意外，属于 bug，提示用户刷新并保留线索。
 */

/** 同一条通用提示的静默窗口，避免连续多个异常刷屏 */
const NOTICE_WINDOW_MS = 5000

let lastNoticeAt = 0

function notifyUnexpected(context: string, error: unknown): void {
  reportError(error, context)

  // reportError 只在开发环境打印；生产环境这里补一次，
  // 让平台侧的错误上报/用户反馈仍能定位到这一个真正的 bug。
  if (!DEV) console.error(`[cw] ${context}`, error)

  const now = Date.now()
  if (now - lastNoticeAt < NOTICE_WINDOW_MS) return
  lastNoticeAt = now
  ElMessage.error('页面出现了意外错误，请刷新后重试')
}

export function installGlobalErrorHandlers(app: App): void {
  // 组件渲染 / 生命周期 / watch / setup 里没被接住的异常
  app.config.errorHandler = (error, _instance, info) => {
    notifyUnexpected(`vue:${info || 'unknown'}`, error)
  }

  window.addEventListener('error', (event) => {
    // 资源加载失败（img/script/link）不带 error 对象，且没有脚本异常语义，跳过
    const target = event.target as HTMLElement | null
    if (target && target !== (window as unknown as HTMLElement) && target.tagName) return
    notifyUnexpected('window.error', event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    notifyUnexpected('unhandledrejection', event.reason)
    // 已经统一记录并提示，阻止浏览器再打一条 "Uncaught (in promise)"
    event.preventDefault()
  })

  if (DEV) {
    // 开发期手动查看最近记录：window.__cwErrors()
    ;(window as unknown as { __cwErrors?: () => unknown }).__cwErrors = getRecentErrors
  }
}
