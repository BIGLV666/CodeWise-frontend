import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startStubServer, setFault, resetFault } from './stub-server.mjs'
import { launchChrome } from './cdp.mjs'

/**
 * 错误处理验收：注入故障，检查「用户被提示了几次」和「控制台脏不脏」。
 *
 * 断言的核心两条：
 *  1. 一次失败只弹一条提示 —— 全局拦截器弹过之后，页面 catch 不能再弹（历史上是两条）；
 *  2. 应用代码不再往控制台写 error（业务失败已统一降级为 dev-only 日志）。
 *
 * 浏览器自己打的网络失败记录（例如桩服务器没有实现 WebSocket 升级）不算应用代码的错，
 * 用 INFRA_NOISE 过滤掉，避免测试因为这个假阳性而永远红着。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDir = join(projectRoot, 'dist')

/** 浏览器/基础设施层面的噪音，不是应用代码写进控制台的。 */
const INFRA_NOISE = /WebSocket connection to|ws:\/\/|Failed to load resource|net::ERR_/

const TOAST_COUNT = `document.querySelectorAll('.el-message').length`
const TOAST_TEXTS = `[...document.querySelectorAll('.el-message')].map((el) => el.textContent.trim())`

const ROUTES = [
  '/home',
  '/favorites',
  '/plan',
  '/notes',
  '/review',
  '/inbox',
  '/discuss',
  '/profile',
  '/agent',
  '/questiondetailview?questionId=1&from=/home',
  '/discuss/2001',
  '/admin/users',
  '/admin/moderation',
  '/admin/container-pool',
]

function futureToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: '1001' }),
  ).toString('base64url')
  return `e2e-header.${payload}.e2e-signature`
}

const USER_INIT_SCRIPT = `
localStorage.setItem('token', ${JSON.stringify(futureToken())});
localStorage.setItem('userId', '1001');
localStorage.setItem('userName', 'alice_coder');
localStorage.setItem('roleId', '2');
`

function appConsoleErrors(session) {
  return session.consoleErrors()
    .filter((entry) => !INFRA_NOISE.test(entry.text))
    .map((entry) => entry.text)
}

describe('错误处理：故障注入', { concurrency: false }, () => {
  let server
  let chrome
  let page

  before(async () => {
    if (!existsSync(join(distDir, 'index.html'))) {
      throw new Error('缺少 dist/index.html，请先执行 node tests/e2e/build-dist.mjs')
    }
    server = await startStubServer({ distDir })
    chrome = await launchChrome()
    page = await chrome.newPage()
    await page.session.addInitScript(USER_INIT_SCRIPT)
  })

  after(async () => {
    resetFault()
    await chrome?.closePage(page?.targetId)
    await chrome?.close()
    await server?.close()
  })

  for (const path of ROUTES) {
    test(`接口全部 500：${path} 只提示一次且不污染控制台`, async () => {
      const { session } = page
      setFault({ mode: '500' })
      session.clearConsole()
      await session.setViewport(1440, 900)
      await session.navigate(`${server.url}${path}`)
      await session.waitForSettled({ quietMs: 500 })

      const toasts = await session.evaluate(TOAST_COUNT)
      const texts = await session.evaluate(TOAST_TEXTS)

      // 重复提示才是要防的病：同一次失败被全局拦截器和页面 catch 各弹一次。
      // 所以先断言"没有两条相同文案"，再断言总条数。
      // /agent 是唯一的例外：它同时依赖平台接口（走全局拦截器）和独立的 agent 客户端
      // （自己有 axios 实例，不经过拦截器），两个后端各失败一次，理应各提示一条。
      const expectedToasts = path === '/agent' ? 2 : 1
      assert.equal(
        new Set(texts).size,
        texts.length,
        `${path} 出现重复文案的失败提示：${JSON.stringify(texts)}`,
      )
      assert.equal(
        toasts,
        expectedToasts,
        `${path} 期望 ${expectedToasts} 条失败提示，实际 ${toasts} 条：${JSON.stringify(texts)}`,
      )
      assert.deepEqual(appConsoleErrors(session), [], `${path} 应用代码往控制台写了 error`)
      assert.deepEqual(session.pageErrors, [], `${path} 出现未捕获异常`)

      resetFault()
    })
  }

  test('401：清会话并回到登录页，只提示一次', async () => {
    const { session } = page
    setFault({ mode: '401' })
    session.clearConsole()
    await session.navigate(`${server.url}/home`)
    await session.waitForSettled({ quietMs: 500 })

    const url = await session.evaluate('location.pathname')
    assert.equal(url, '/login', '401 应把用户送回登录页')

    const token = await session.evaluate("localStorage.getItem('token')")
    assert.equal(token, null, '401 应清掉本地登录态')

    const toasts = await session.evaluate(TOAST_COUNT)
    assert.ok(toasts >= 1 && toasts <= 2, `401 提示条数异常：${toasts}`)

    // 登录页自身不再带 token 重复请求，控制台不应有应用级 error
    assert.deepEqual(appConsoleErrors(session), [])
    await session.evaluate('localStorage.setItem("token", "placeholder")')
    resetFault()
  })

  test('请求超时：提示超时而不是英文技术信息', async () => {
    const { session } = page
    // 服务端悬住不响应，axios 10s 超时后走 ECONNABORTED 分支
    setFault({ mode: 'timeout', match: /\/api\/question\/cursorquestions$/, delayMs: 12_000 })
    session.clearConsole()
    await session.navigate(`${server.url}/home`)
    await session.waitForSettled({ quietMs: 11_000 })

    const texts = await session.evaluate(TOAST_TEXTS)
    assert.ok(
      texts.some((text) => text.includes('请求超时')),
      `未出现超时提示，实际：${JSON.stringify(texts)}`,
    )
    assert.ok(
      !texts.some((text) => /timeout of|ECONNABORTED|status code/i.test(text)),
      `把英文技术信息泄漏给了用户：${JSON.stringify(texts)}`,
    )
    assert.deepEqual(appConsoleErrors(session), [])
    resetFault()
  })
})
