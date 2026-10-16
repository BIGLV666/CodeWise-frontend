/**
 * 全站统一日志出口。
 *
 * 背景：历史上每个页面的失败分支都直接 `console.error`，结果是
 *  - 控制台被「其实已经处理过、用户也已经在界面上看到提示」的业务失败淹没；
 *  - 生产构建同样输出，既没人看，也不该把服务端细节留在用户浏览器里。
 *
 * 约定（与 request.ts 的全局错误提示配合）：
 *  - `logDebug` / `logWarn`：仅开发环境输出。**已被全局提示过**的业务失败、
 *    后台轮询失败、以及可预期的降级分支都走这里；
 *  - `reportError`：意外错误（不该发生的那一类）的统一入口。始终写入环形缓冲，
 *    开发环境顺带打印；生产环境静默——生产是否要让平台记录由 globalErrorHandler 决定。
 *
 * 因此 src/ 里不应再出现裸 `console.*`（由 tests/no-console.test.mjs 静态守卫）。
 */
const DEV = import.meta.env.DEV

/** 保留最近多少条意外错误，供开发期排查（DEV 下挂到 window.__cwErrors） */
const MAX_RECORDS = 50

export interface ErrorRecord {
  message: string
  context?: string
  at: number
}

const records: ErrorRecord[] = []

/** 把任意抛出物转成一行可读文本，避免把对象塞进日志后看不出重点。 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }
  return String(error)
}

export function logDebug(message: string, ...args: unknown[]): void {
  if (DEV) console.debug(`[cw] ${message}`, ...args)
}

export function logWarn(message: string, ...args: unknown[]): void {
  if (DEV) console.warn(`[cw] ${message}`, ...args)
}

export function reportError(error: unknown, context?: string): ErrorRecord {
  const record: ErrorRecord = { message: describeError(error), context, at: Date.now() }
  records.push(record)
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS)
  if (DEV) console.error(`[cw]${context ? ` ${context}` : ''}`, error)
  return record
}

export function getRecentErrors(): readonly ErrorRecord[] {
  return records
}

export function clearRecentErrors(): void {
  records.length = 0
}
