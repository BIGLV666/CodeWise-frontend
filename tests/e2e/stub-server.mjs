import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fixtures, fallbackData } from './fixtures.mjs'

/**
 * E2E 桩服务器。
 *
 * 同时干两件事：
 *  1. 伺服 `dist/` 里的构建产物（SPA 回退到 index.html）；
 *  2. 应答 `/api/**` 与 `/agentapi/**`，返回 tests/e2e/fixtures.mjs 里的数据，
 *     并按需注入故障（500 / 超时 / 401）。
 *
 * 这样跑响应式与错误处理测试**不需要**任何后端服务，也不碰宿主机状态。
 * 测试进程直接 import 本模块拿到句柄，通过 setFault 控制故障，无需额外控制端口。
 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

/** 以 SSE 应答的路径：静态 JSON 桩伪造不了流，这里给一个最小可用的事件流。 */
const SSE_PATHS = [/\/ai\/advice\/ask$/, /\/api\/agent\/stream$/, /\/agent\/call$/]

/**
 * @typedef {object} FaultConfig
 * @property {'off'|'500'|'timeout'|'401'} mode 故障类型；off 表示正常应答
 * @property {RegExp|null} match 只对匹配的路径生效；null 表示全部
 * @property {number} delayMs timeout 模式下的挂起时长
 */

/** @type {FaultConfig} */
let fault = { mode: 'off', match: null, delayMs: 15_000 }

export function setFault(next) {
  fault = { mode: 'off', match: null, delayMs: 15_000, ...next }
}

export function resetFault() {
  fault = { mode: 'off', match: null, delayMs: 15_000 }
}

/** 命中故障规则？ */
function faultApplies(pathname) {
  if (fault.mode === 'off') return false
  return fault.match ? fault.match.test(pathname) : true
}

function matchFixture(pathname, method) {
  for (const rule of fixtures) {
    if (rule.method && rule.method !== method) continue
    if (rule.test.test(pathname)) return rule
  }
  return null
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/** 后端统一信封：{ code, message, data }，见 src/api/request.ts 的 ApiResult。 */
function sendEnvelope(res, data, message = 'ok') {
  sendJson(res, 200, { code: 200, message, data })
}

function sendSse(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  res.write('event: done\ndata: {"finish_reason":"stop","content":"（E2E 桩数据）"}\n\n')
  res.end()
}

async function serveStatic(distDir, pathname, res) {
  // 防目录穿越：解析后必须仍在 distDir 之内
  const unsafe = join(distDir, pathname)
  const target = resolve(unsafe)
  if (!target.startsWith(resolve(distDir))) {
    res.writeHead(403).end('forbidden')
    return
  }

  let filePath = target
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    // 命中不了真实文件就回退 SPA 入口（history 路由需要）
    filePath = join(distDir, 'index.html')
  }

  try {
    const body = await readFile(filePath)
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}

/**
 * 启动桩服务器。
 * @param {{ distDir: string }} options
 */
export async function startStubServer({ distDir }) {
  const resolvedDist = resolve(distDir)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname

    if (!pathname.startsWith('/api/') && !pathname.startsWith('/agentapi/')) {
      await serveStatic(resolvedDist, normalize(pathname), res)
      return
    }

    if (faultApplies(pathname)) {
      if (fault.mode === 'timeout') {
        // 悬住不响应：让前端走到超时分支（request.ts 里是 ECONNABORTED / ETIMEDOUT）
        await new Promise((r) => setTimeout(r, Math.min(fault.delayMs, 30_000)))
        if (!res.writableEnded) res.destroy()
        return
      }
      if (fault.mode === '401') {
        sendJson(res, 401, { code: 401, message: '登录状态已失效', data: null })
        return
      }
      sendJson(res, 500, { code: 500, message: '服务出了点问题，请稍后重试', data: null })
      return
    }

    if (SSE_PATHS.some((re) => re.test(pathname))) {
      sendSse(req, res)
      return
    }

    const rule = matchFixture(pathname, req.method ?? 'GET')
    sendEnvelope(res, rule ? rule.data : fallbackData)
  })

  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise((r) => server.close(r)),
  }
}
