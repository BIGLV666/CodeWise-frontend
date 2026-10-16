import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startStubServer, resetFault } from './stub-server.mjs'
import { launchChrome } from './cdp.mjs'

/**
 * 响应式验收：每个路由 × 四档视口，断言不横向溢出、关键容器在视口内。
 *
 * 前置：先跑 `node tests/e2e/build-dist.mjs` 生成 dist（npm run test:e2e 会代跑）。
 * 依赖：宿主 chrome（CHROME_PATH 可覆盖）+ 内置桩服务器，不需要后端服务。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDir = join(projectRoot, 'dist')

/**
 * 视口档位。
 *
 * 除四档语义断点外，额外覆盖 1120 / 1180：这两个宽度处在「多栏退单栏」的临界区间，
 * 断点归一化如果方向搞反（该提前却延后），问题恰好只在这里暴露 ——
 * 表现为内容被祖先的 overflow: hidden 裁掉，而文档本身不溢出，光看 scrollWidth 抓不到。
 */
const VIEWPORTS = [
  { name: '手机 375', width: 375, height: 812, mobile: true },
  { name: '平板 768', width: 768, height: 1024, mobile: false },
  { name: '平板 1024', width: 1024, height: 768, mobile: false },
  { name: '临界 1120', width: 1120, height: 800, mobile: false },
  { name: '临界 1180', width: 1180, height: 800, mobile: false },
  { name: '桌面 1440', width: 1440, height: 900, mobile: false },
]

/**
 * 路由清单。`expect` 里的选择器必须存在且完整落在视口横向范围内。
 * 选择器取各页面真正承担布局的容器，而不是随便一个元素。
 */
const ROUTES = [
  { path: '/home', expect: ['.app-navbar', '.main-container', '.content-header'] },
  { path: '/favorites', expect: ['.app-navbar', '.main-container'] },
  { path: '/plan', expect: ['.app-navbar', '.main-container'] },
  { path: '/notes', expect: ['.app-navbar', '.main-container', '.editor-panel'] },
  { path: '/review', expect: ['.navbar', '.review-shell'] },
  { path: '/inbox', expect: ['.app-navbar', '.inbox-page'] },
  { path: '/discuss', expect: ['.navbar', '.discussion-shell'] },
  { path: '/profile', expect: ['.navbar', '.profile-shell'] },
  { path: '/agent', expect: ['.app-navbar', '.agent-shell'] },
  {
    path: '/questiondetailview?questionId=1&from=/home',
    expect: ['.question-detail', '.main-container'],
  },
  { path: '/discuss/create', expect: ['.navbar', '.compose-shell'] },
  { path: '/discuss/2001', expect: ['.navbar', '.page-shell'] },
  { path: '/questions/function-test-generator?questionId=1', expect: ['.page-content'] },
  { path: '/content-render?type=POST&id=2001', expect: ['.content-render-view'] },
  { path: '/admin/container-pool', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/failure-submits', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/moderation', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/appeals', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/users', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/questions/create', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/questions/import/leetcode', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/testcases', expect: ['.admin-layout', '.admin-main'] },
  { path: '/admin/artifact-generator', expect: ['.admin-layout', '.admin-main'] },
]

/** 未登录页面：不能带 token 访问，否则路由守卫会把已登录用户弹回 /home。 */
const GUEST_ROUTES = [
  { path: '/login', expect: ['.auth-shell'] },
  { path: '/register', expect: ['.register-container'] },
  { path: '/forgot-password', expect: ['.auth-shell'] },
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

const GUEST_INIT_SCRIPT = 'localStorage.clear();'

const OVERFLOW_PROBE = `(() => {
  const doc = document.documentElement;
  return {
    href: location.pathname + location.search,
    clientWidth: doc.clientWidth,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  };
})()`

function rectProbe(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { missing: true };
    const r = el.getBoundingClientRect();
    return {
      missing: false,
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      visibility: getComputedStyle(el).visibility,
      display: getComputedStyle(el).display,
      // 容器自身的横向溢出：>0 说明内容比容器宽，可能正被祖先的 overflow: hidden 裁掉
      overflowX: el.scrollWidth - el.clientWidth,
    };
  })()`
}

describe('响应式：路由 × 视口矩阵', { concurrency: false }, () => {
  let server
  let chrome
  let userPage
  let guestPage

  before(async () => {
    if (!existsSync(join(distDir, 'index.html'))) {
      throw new Error('缺少 dist/index.html，请先执行 node tests/e2e/build-dist.mjs')
    }
    resetFault()
    server = await startStubServer({ distDir })
    chrome = await launchChrome()

    // 两种身份各用一个页面：CDP 的 addScriptToEvaluateOnNewDocument 是叠加的，
    // 同一个页面里切换身份会互相干扰，分开最干净。
    userPage = await chrome.newPage()
    await userPage.session.addInitScript(USER_INIT_SCRIPT)

    guestPage = await chrome.newPage()
    await guestPage.session.addInitScript(GUEST_INIT_SCRIPT)
  })

  after(async () => {
    await chrome?.closePage(userPage?.targetId)
    await chrome?.closePage(guestPage?.targetId)
    await chrome?.close()
    await server?.close()
  })

  for (const viewport of VIEWPORTS) {
    for (const route of [...ROUTES, ...GUEST_ROUTES]) {
      const isGuest = GUEST_ROUTES.includes(route)
      test(`${viewport.name} ${route.path}`, async () => {
        const { session } = isGuest ? guestPage : userPage
        session.clearConsole()
        await session.setViewport(viewport.width, viewport.height, { mobile: viewport.mobile })
        await session.navigate(`${server.url}${route.path}`)
        await session.waitForSettled({ quietMs: 350 })

        const overflow = await session.evaluate(OVERFLOW_PROBE)
        assert.ok(
          overflow.scrollWidth <= overflow.clientWidth + 1,
          `横向溢出：文档宽 ${overflow.scrollWidth} > 视口宽 ${overflow.clientWidth}（${route.path} @ ${viewport.name}）`,
        )
        assert.ok(
          overflow.bodyScrollWidth <= overflow.clientWidth + 1,
          `body 横向溢出：${overflow.bodyScrollWidth} > ${overflow.clientWidth}（${route.path} @ ${viewport.name}）`,
        )

        for (const selector of route.expect) {
          const rect = await session.evaluate(rectProbe(selector))
          assert.ok(!rect.missing, `缺少选择器 ${selector}（${route.path} @ ${viewport.name}）`)
          assert.ok(
            rect.display !== 'none' && rect.visibility !== 'hidden',
            `${selector} 不可见（${route.path} @ ${viewport.name}）`,
          )
          assert.ok(
            rect.left >= -1 && rect.right <= overflow.clientWidth + 1,
            `${selector} 超出视口：left=${rect.left} right=${rect.right} 视口=${overflow.clientWidth}（${route.path} @ ${viewport.name}）`,
          )
          // 这些选择器都是各页面的顶层布局容器，本身不该需要横向滚动；
          // 一旦需要，通常意味着里面的内容已经被裁掉（文档 scrollWidth 看不出来）。
          assert.ok(
            rect.overflowX <= 1,
            `${selector} 内容被裁切：scrollWidth 比 clientWidth 大 ${rect.overflowX}px（${route.path} @ ${viewport.name}）`,
          )
        }

        assert.deepEqual(
          session.pageErrors,
          [],
          `页面抛出未捕获异常（${route.path} @ ${viewport.name}）：${session.pageErrors.join(' | ')}`,
        )
        // 应用的业务失败已统一降级为 dev-only 日志，生产构建里不应有任何 console.error。
        // 浏览器自身的网络失败记录（桩服务器没有实现 WebSocket 升级）不算应用代码，过滤掉。
        assert.deepEqual(
          session
            .consoleErrors()
            .filter((entry) => !/WebSocket connection to|ws:\/\/|Failed to load resource/.test(entry.text)),
          [],
          `控制台出现应用级 error（${route.path} @ ${viewport.name}）：${session.consoleErrors().map((e) => e.text).join(' | ')}`,
        )
      })
    }
  }
})

/**
 * 手机档专项。
 *
 * 上面的矩阵只能证明「没有横向溢出」——把两栏挤到 150px 也照样不溢出。
 * 这里补两类断言：
 *  1. 主内容区必须真正占满宽度（证明它已经单栏化，而不是被挤扁）；
 *  2. 页面级侧栏/导航的抽屉必须能被汉堡按钮打开、并完整落在视口内。
 */
const SIDEBAR_TOGGLE = '[data-nav-toggle="sidebar"]'
const NAV_TOGGLE = '[data-nav-toggle="nav"]'

const DRAWER_CASES = [
  { path: '/home', drawer: '.left-panel', navSelector: '.menu-item', toggle: '.content-header ' + SIDEBAR_TOGGLE },
  { path: '/favorites', drawer: '.left-panel', navSelector: '.menu-item', toggle: SIDEBAR_TOGGLE },
  { path: '/plan', drawer: '.plan-sidebar', navSelector: '.plan-list', toggle: SIDEBAR_TOGGLE },
  { path: '/notes', drawer: '.folder-panel', navSelector: '.folder-list', toggle: SIDEBAR_TOGGLE },
  { path: '/agent', drawer: '.agent-sidebar', navSelector: '.new-session', toggle: SIDEBAR_TOGGLE },
  // 复习/个人主页/讨论三页用的是各自的顶部导航，抽屉里装的是站点导航
  { path: '/review', drawer: '.nav-menu', navSelector: '.nav-item', toggle: NAV_TOGGLE },
  { path: '/profile', drawer: '.nav-menu', navSelector: '.nav-item', toggle: NAV_TOGGLE },
  { path: '/discuss', drawer: '.nav-menu', navSelector: '.nav-item', toggle: NAV_TOGGLE },
  { path: '/admin/users', drawer: '.admin-sidebar', navSelector: '.nav-item', toggle: SIDEBAR_TOGGLE },
]

const FULL_WIDTH_CASES = [
  { path: '/questiondetailview?questionId=1&from=/home', selector: '.left-panel' },
  { path: '/questiondetailview?questionId=1&from=/home', selector: '.right-panel' },
  { path: '/notes', selector: '.editor-panel' },
  { path: '/admin/users', selector: '.admin-main' },
]

describe('手机档：主内容单栏化 + 抽屉可用', { concurrency: false }, () => {
  let server
  let chrome
  let userPage

  before(async () => {
    resetFault()
    server = await startStubServer({ distDir })
    chrome = await launchChrome()
    userPage = await chrome.newPage()
    await userPage.session.addInitScript(USER_INIT_SCRIPT)
  })

  after(async () => {
    await chrome?.closePage(userPage?.targetId)
    await chrome?.close()
    await server?.close()
  })

  async function goto(path) {
    const { session } = userPage
    session.clearConsole()
    await session.setViewport(375, 812, { mobile: true })
    await session.navigate(`${server.url}${path}`)
    await session.waitForSettled({ quietMs: 350 })
    return session
  }

  for (const item of FULL_WIDTH_CASES) {
    test(`375px 主内容占满宽度：${item.path} ${item.selector}`, async () => {
      const session = await goto(item.path)
      const rect = await session.evaluate(rectProbe(item.selector))
      const viewport = await session.evaluate('document.documentElement.clientWidth')
      assert.ok(!rect.missing, `缺少 ${item.selector}`)
      assert.ok(
        rect.width >= viewport * 0.85,
        `${item.selector} 只占 ${rect.width}px / 视口 ${viewport}px，疑似仍被压成多栏`,
      )
    })
  }

  for (const item of DRAWER_CASES) {
    test(`375px 抽屉可开合：${item.path} ${item.drawer}`, async () => {
      const session = await goto(item.path)

      const before = await session.evaluate(rectProbe(item.drawer))
      assert.ok(!before.missing, `缺少抽屉元素 ${item.drawer}`)
      assert.equal(before.visibility, 'hidden', `初始状态 ${item.drawer} 应处于收起状态`)

      const toggle = await session.evaluate(rectProbe(item.toggle))
      assert.ok(!toggle.missing, `缺少汉堡按钮 ${item.toggle}`)
      assert.ok(toggle.width >= 40 && toggle.right <= 375 + 1, '汉堡按钮不可用或超出视口')

      await session.evaluate(`document.querySelector(${JSON.stringify(item.toggle)}).click()`)
      await new Promise((r) => setTimeout(r, 350))

      const opened = await session.evaluate(rectProbe(item.drawer))
      assert.equal(opened.visibility, 'visible', `${item.drawer} 点击后未展开`)
      assert.ok(
        opened.left >= -1 && opened.right <= 376,
        `抽屉超出视口：left=${opened.left} right=${opened.right}`,
      )

      const inner = await session.evaluate(rectProbe(item.navSelector))
      assert.ok(!inner.missing, `抽屉内缺少导航项 ${item.navSelector}`)
      assert.ok(
        inner.left >= -1 && inner.right <= 376,
        `抽屉内导航项超出视口：${JSON.stringify(inner)}`,
      )

      // 点遮罩收起
      await session.evaluate(`document.querySelector('.cw-offcanvas-backdrop').click()`)
      await new Promise((r) => setTimeout(r, 350))
      const closed = await session.evaluate(rectProbe(item.drawer))
      assert.equal(closed.visibility, 'hidden', '点击遮罩后抽屉未收起')

      assert.deepEqual(session.pageErrors, [], `抽屉交互抛异常：${session.pageErrors.join(' | ')}`)
    })
  }
})
