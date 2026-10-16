import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 极简 Chrome DevTools Protocol 客户端。
 *
 * 为什么不用 Playwright：本机已经装了 google-chrome，而 Node 22 自带 WebSocket 与 fetch，
 * 直接走 CDP 可以做到**零新依赖、不下载浏览器**，也不用在 CI 上装浏览器。
 * 需要的能力只有四样：切换视口尺寸、导航、执行 JS、收集控制台输出。
 */

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome'

async function waitForDevToolsPort(userDataDir, timeoutMs = 30_000) {
  const portFile = join(userDataDir, 'DevToolsActivePort')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const port = Number((await readFile(portFile, 'utf8')).split('\n')[0])
      if (port) return port
    } catch {
      // 文件还没写出来，继续等
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Chrome 未在超时时间内暴露 DevTools 端口')
}

/** 一个已连接 CDP 的页面会话。 */
export class PageSession {
  constructor(connection, sessionId) {
    this.connection = connection
    this.sessionId = sessionId
    /** 控制台输出（console.* 与未捕获异常）。 */
    this.consoleMessages = []
    this.pageErrors = []
  }

  send(method, params = {}) {
    return this.connection.send(method, params, this.sessionId)
  }

  on(method, handler) {
    this.connection.on(method, handler, this.sessionId)
  }

  async init() {
    await Promise.all([
      this.send('Page.enable'),
      this.send('Runtime.enable'),
      this.send('Log.enable'),
      this.send('Network.enable'),
    ])

    this.on('Runtime.consoleAPICalled', (params) => {
      const text = (params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? arg.type)
        .join(' ')
      this.consoleMessages.push({ level: params.type, text })
    })

    this.on('Log.entryAdded', (params) => {
      const entry = params.entry ?? {}
      if (entry.level === 'error' || entry.level === 'warning') {
        this.consoleMessages.push({ level: entry.level, text: entry.text ?? '' })
      }
    })

    this.on('Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails ?? {}
      this.pageErrors.push(details.exception?.description ?? details.text ?? 'unknown error')
    })
  }

  clearConsole() {
    this.consoleMessages.length = 0
    this.pageErrors.length = 0
  }

  /** 收集到的 console.error（不含 warn/log）。 */
  consoleErrors() {
    return this.consoleMessages.filter((m) => m.level === 'error')
  }

  /** 在页面里执行表达式并取回值。 */
  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    })
    if (result.exceptionDetails) {
      throw new Error(
        `页面内求值失败: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
      )
    }
    return result.result?.value
  }

  /** 在每次导航前注入的脚本（用于写 localStorage 等）。 */
  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source })
  }

  async setViewport(width, height, { mobile = false } = {}) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    })
  }

  async navigate(url) {
    const loaded = new Promise((resolveLoad) => {
      const off = this.connection.on(
        'Page.loadEventFired',
        () => {
          off()
          resolveLoad()
        },
        this.sessionId,
      )
      setTimeout(() => {
        off()
        resolveLoad()
      }, 15_000)
    })
    await this.send('Page.navigate', { url })
    await loaded
  }

  /** 等待页面「安静下来」：Vue 挂载完成 + 首屏请求结束。 */
  async waitForSettled({ selector = '#app > *', timeoutMs = 10_000, quietMs = 600 } = {}) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const ready = await this.evaluate(
        `(() => {
           const el = document.querySelector(${JSON.stringify(selector)});
           return Boolean(el) && document.readyState === 'complete';
         })()`,
        { awaitPromise: false },
      )
      if (ready) break
      await new Promise((r) => setTimeout(r, 100))
    }
    // 首屏请求（命中桩数据很快）与渲染收尾
    await new Promise((r) => setTimeout(r, quietMs))
  }
}

/** 启动 Chrome 并返回连接句柄。 */
export async function launchChrome() {
  const userDataDir = await mkdtemp(join(tmpdir(), 'cw-e2e-'))
  const child = spawn(
    CHROME,
    [
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      // 后台标签页会被降频，导致 rAF/定时器停滞，这里全部关掉
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  const port = await waitForDevToolsPort(userDataDir)
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()

  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener('open', resolveOpen, { once: true })
    ws.addEventListener('error', () => rejectOpen(new Error('连接 Chrome DevTools WebSocket 失败')), {
      once: true,
    })
  })

  let nextId = 1
  const pending = new Map()
  const listeners = new Map()

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`))
      else entry.resolve(message.result ?? {})
      return
    }
    const key = `${message.method}::${message.sessionId ?? ''}`
    listeners.get(key)?.forEach((handler) => handler(message.params ?? {}))
  })

  const connection = {
    send(method, params = {}, sessionId) {
      const id = nextId++
      const payload = { id, method, params }
      if (sessionId) payload.sessionId = sessionId
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolve: resolveSend, reject: rejectSend, method })
        ws.send(JSON.stringify(payload))
      })
    },
    on(method, handler, sessionId) {
      const key = `${method}::${sessionId ?? ''}`
      if (!listeners.has(key)) listeners.set(key, new Set())
      listeners.get(key).add(handler)
      return () => listeners.get(key)?.delete(handler)
    },
  }

  async function newPage() {
    const { targetId } = await connection.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await connection.send('Target.attachToTarget', { targetId, flatten: true })
    const session = new PageSession(connection, sessionId)
    await session.init()
    return { session, targetId }
  }

  async function closePage(targetId) {
    await connection.send('Target.closeTarget', { targetId }).catch(() => {})
  }

  async function close() {
    for (const handler of listeners.values()) handler.clear()
    try {
      ws.close()
    } catch {
      // 连接可能已经断了，忽略
    }
    child.kill('SIGKILL')
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }

  return { newPage, closePage, close, port }
}
