import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startStubServer, setFault, resetFault } from './stub-server.mjs'
import { launchChrome } from './cdp.mjs'

/**
 * 会话与登出。
 *
 * 覆盖三条路径：
 *  1. 用户主动退出 → 必须真的调 POST /api/user/logout（后端靠它把 token 拉黑），再回登录页；
 *  2. 登出接口失败 → 本地登出照样完成，且不弹错误提示（用户已经离开，提示只会误导）；
 *  3. 401 失效 → 只清本地，**不能**再调登出接口（token 已无效，白跑一趟还会多弹提示）。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDir = join(projectRoot, 'dist')

const INFRA_NOISE = /WebSocket connection to|ws:\/\/|Failed to load resource|net::ERR_/

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

/** 打开个人主页的「编辑」下拉并点击「退出登录」。 */
const CLICK_LOGOUT = `(async () => {
  const trigger = document.querySelector('.profile-actions .more-button')
  if (!trigger) return 'no-trigger'
  trigger.click()
  await new Promise((r) => setTimeout(r, 300))
  const item = [...document.querySelectorAll('.el-dropdown-menu__item')]
    .find((el) => el.textContent.trim() === '退出登录')
  if (!item) return 'no-item'
  item.click()
  return 'clicked'
})()`

describe('会话与登出', { concurrency: false }, () => {
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

  test('主动退出：调 POST /api/user/logout，再清本地并回登录页', async () => {
    const { session } = page
    resetFault()
    await session.setViewport(1440, 900)
    await session.navigate(`${server.url}/profile`)
    await session.waitForSettled({ quietMs: 500 })

    session.clearConsole()
    assert.equal(await session.evaluate(CLICK_LOGOUT), 'clicked', '未找到「退出登录」入口')
    await session.waitForSettled({ quietMs: 900 })

    assert.equal(
      await session.evaluate('location.pathname'),
      '/login',
      '退出后应回到登录页',
    )
    assert.equal(await session.evaluate("localStorage.getItem('token')"), null, '本地 token 未清除')
    assert.equal(await session.evaluate("localStorage.getItem('roleId')"), null, '本地角色未清除')

    assert.ok(
      session.requested('/api/user/logout'),
      `未向后端发起登出请求，实际请求：${JSON.stringify(session.requests.map((r) => `${r.method} ${r.pathname}`))}`,
    )
    assert.deepEqual(
      session.consoleErrors().filter((entry) => !INFRA_NOISE.test(entry.text)),
      [],
      '登出过程中出现应用级 console.error',
    )
  })

  test('登出接口失败：本地登出照常完成，且不弹错误提示', async () => {
    const { session } = page
    // 重新注入登录态（上一条用例已清空）
    await session.navigate(`${server.url}/login`)
    await session.evaluate(`
      localStorage.setItem('token', ${JSON.stringify(futureToken())});
      localStorage.setItem('userId', '1001');
      localStorage.setItem('userName', 'alice_coder');
      localStorage.setItem('roleId', '2');
    `)

    setFault({ mode: '500', match: /\/api\/user\/logout$/ })
    await session.setViewport(1440, 900)
    await session.navigate(`${server.url}/profile`)
    await session.waitForSettled({ quietMs: 500 })

    session.clearConsole()
    await session.evaluate(CLICK_LOGOUT)
    await session.waitForSettled({ quietMs: 900 })

    assert.ok(session.requested('/api/user/logout'), '登出请求没发出')
    assert.equal(await session.evaluate('location.pathname'), '/login', '接口失败不应阻断退出')
    assert.equal(await session.evaluate("localStorage.getItem('token')"), null, '接口失败也应清本地')

    const toasts = await session.evaluate(
      `[...document.querySelectorAll('.el-message')].map((el) => el.textContent.trim())`,
    )
    assert.deepEqual(toasts, [], `登出接口失败不该打扰用户，实际提示：${JSON.stringify(toasts)}`)

    resetFault()
  })

  test('401 失效：只清本地，不再调登出接口', async () => {
    const { session } = page
    await session.navigate(`${server.url}/login`)
    await session.evaluate(`
      localStorage.setItem('token', ${JSON.stringify(futureToken())});
      localStorage.setItem('userId', '1001');
      localStorage.setItem('roleId', '2');
    `)

    setFault({ mode: '401' })
    session.clearConsole()
    await session.navigate(`${server.url}/home`)
    await session.waitForSettled({ quietMs: 600 })

    assert.equal(await session.evaluate('location.pathname'), '/login', '401 应送回登录页')
    assert.equal(await session.evaluate("localStorage.getItem('token')"), null, '401 应清本地登录态')
    assert.ok(
      !session.requested('/api/user/logout'),
      '401 时 token 已失效，不该再发登出请求',
    )

    resetFault()
  })
})
