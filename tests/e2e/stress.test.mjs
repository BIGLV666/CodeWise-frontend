import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startStubServer, setFault, resetFault } from './stub-server.mjs'
import { launchChrome } from './cdp.mjs'

/**
 * 压测。
 *
 * 前两个矩阵测的是「一次正确的加载」，这里测的是「反复折腾之后还正不正常」：
 *  1. 视口在两档之间快速来回切换 —— 最容易暴露 matchMedia / resize 监听泄漏，
 *     以及 Monaco 这类按容器尺寸渲染的组件在 display:none 之后失去尺寸；
 *  2. 持续失败的场景反复加载 —— 最容易暴露错误状态累积、DOM 无限增长、控制台被刷屏。
 *
 * 指标：崩溃 0、未捕获异常 0、应用级 console.error 0、溢出 0、DOM 节点数不随时间增长。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDir = join(projectRoot, 'dist')

const INFRA_NOISE = /WebSocket connection to|ws:\/\/|Failed to load resource|net::ERR_/

const OVERFLOW = `document.documentElement.scrollWidth - document.documentElement.clientWidth`
const NODE_COUNT = `document.querySelectorAll('*').length`

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

describe('压测', { concurrency: false }, () => {
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

  test('视口快速切换 60 轮：不溢出、不泄漏、Monaco 仍能正确布局', async () => {
    const { session } = page
    resetFault()
    session.clearConsole()

    await session.setViewport(375, 812, { mobile: true })
    await session.navigate(`${server.url}/questiondetailview?questionId=1&from=/home`)
    await session.waitForSettled({ quietMs: 500 })

    // 手机档切到代码页签，让 Monaco 真正参与布局
    await session.evaluate(`document.querySelectorAll('.mobile-pane-tab')[1]?.click()`)
    await new Promise((r) => setTimeout(r, 300))

    let nodeCountEarly = 0
    for (let round = 0; round < 60; round += 1) {
      const mobile = round % 2 === 0
      await session.setViewport(mobile ? 375 : 1440, mobile ? 812 : 900, { mobile })
      // 让 matchMedia 与 rAF 合并后的回调都跑完
      await new Promise((r) => setTimeout(r, 60))
      if (round === 5) nodeCountEarly = await session.evaluate(NODE_COUNT)

      const overflow = await session.evaluate(OVERFLOW)
      assert.ok(
        overflow <= 1,
        `第 ${round} 轮切换后横向溢出 ${overflow}px（宽度 ${mobile ? 375 : 1440}）`,
      )
    }

    const nodeCountLate = await session.evaluate(NODE_COUNT)
    assert.ok(
      nodeCountLate - nodeCountEarly < 400,
      `DOM 节点数在切换过程中持续增长：${nodeCountEarly} → ${nodeCountLate}`,
    )

    // 回到桌面档，编辑器必须仍然有实际尺寸（Monaco 在 0 尺寸容器里渲染后会失效）
    await session.setViewport(1440, 900)
    await new Promise((r) => setTimeout(r, 400))
    const editor = await session.evaluate(
      `(() => { const r = document.querySelector('.editor-container').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })()`,
    )
    assert.ok(editor.w > 200 && editor.h > 100, `编辑器尺寸异常：${JSON.stringify(editor)}`)

    assert.deepEqual(session.pageErrors, [], '反复切换视口后出现未捕获异常')
    assert.deepEqual(appConsoleErrors(session), [], '反复切换视口后控制台出现应用级 error')
  })

  test('持续失败 20 次反复加载：提示不累积、DOM 不增长、控制台不脏', async () => {
    const { session } = page
    setFault({ mode: '500' })
    session.clearConsole()

    const counts = []
    const started = Date.now()
    for (let i = 0; i < 20; i += 1) {
      await session.setViewport(1440, 900)
      await session.navigate(`${server.url}/home`)
      await session.waitForSettled({ quietMs: 200 })
      counts.push(await session.evaluate(`document.querySelectorAll('.el-message').length`))
      assert.equal(await session.evaluate(OVERFLOW), 0, `第 ${i} 次加载出现横向溢出`)
    }
    const elapsed = Date.now() - started

    // 每次加载里首页会并发发起多个请求，全部 500 且文案相同 → 去重后只应有一条
    assert.ok(
      counts.every((count) => count >= 1 && count <= 2),
      `单次加载的提示条数异常：${JSON.stringify(counts)}`,
    )
    assert.deepEqual(session.pageErrors, [], '反复失败加载后出现未捕获异常')
    assert.deepEqual(appConsoleErrors(session), [], '反复失败加载后控制台出现应用级 error')

    const nodes = await session.evaluate(NODE_COUNT)
    assert.ok(nodes < 3000, `反复加载后 DOM 节点数异常：${nodes}`)
    // 只是记录，不做门槛；20 次加载超过 60s 说明有请求在挂死
    assert.ok(elapsed < 60_000, `20 次失败加载耗时 ${elapsed}ms，疑似请求挂死`)

    resetFault()
  })

  test('正常路径 20 次反复加载：不产生任何 console.error', async () => {
    const { session } = page
    resetFault()
    session.clearConsole()

    for (let i = 0; i < 20; i += 1) {
      await session.setViewport(1440, 900)
      await session.navigate(`${server.url}/home`)
      await session.waitForSettled({ quietMs: 120 })
    }

    assert.deepEqual(session.pageErrors, [], '反复加载后出现未捕获异常')
    assert.deepEqual(appConsoleErrors(session), [], '反复加载后控制台出现应用级 error')
    const toasts = await session.evaluate(`document.querySelectorAll('.el-message').length`)
    assert.equal(toasts, 0, `正常路径不应出现任何失败提示，实际 ${toasts} 条`)
  })
})
