import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resetFault, startStubServer } from './stub-server.mjs'
import { launchChrome } from './cdp.mjs'

/**
 * 平台声明（使用规范 / 隐私说明）的端到端验收。
 *
 * 覆盖四类容易出问题的地方：
 *  1. 可达性：未登录能看、已登录也不会被守卫弹回首页、真链接刷新不 404；
 *  2. 入口接线：登录页/注册页的入口真的打得开，且注册页点链接不会顺手勾上复选框；
 *  3. 渲染安全：注入后的 DOM 里没有 script / 内联事件属性；
 *  4. 形态与性能：手机档不横向溢出、正文可滚动，反复开关弹窗不泄漏 DOM。
 *
 * 依赖宿主 chrome 与内置桩服务器（无需后端）。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDir = join(projectRoot, 'dist')

function futureToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: '1001' }),
  ).toString('base64url')
  return `e2e-header.${payload}.e2e-signature`
}

/** 访客页：清空登录态，并记录「文档被加载了几次」（用于判断是否整页刷新）。 */
const GUEST_INIT_SCRIPT = `
window.__documentCount = (window.__documentCount || 0) + 1;
localStorage.clear();
`

const USER_INIT_SCRIPT = `
window.__documentCount = (window.__documentCount || 0) + 1;
localStorage.setItem('token', ${JSON.stringify(futureToken())});
localStorage.setItem('userId', '1001');
localStorage.setItem('userName', 'alice_coder');
localStorage.setItem('roleId', '2');
`

/** 弹窗是否真的可见（EP 关闭时用 display:none 保留 DOM，所以不能只看存在性）。 */
const DIALOG_VISIBLE = `(() => {
  const el = document.querySelector('.legal-dialog');
  return Boolean(el) && el.getClientRects().length > 0;
})()`

const DIALOG_TITLE = `(() => {
  const el = document.querySelector('.legal-dialog .el-dialog__title');
  return el ? el.textContent.trim() : null;
})()`

const DIALOG_TEXT = `(() => {
  const el = document.querySelector('.legal-dialog-body');
  return el ? el.innerText : null;
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
      height: Math.round(r.height),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  })()`
}

/** 点击某个「打开声明」的入口按钮（按可见文案匹配）。 */
function clickEntry(text) {
  return `(() => {
    const buttons = [...document.querySelectorAll('.text-action, .el-link, .side-link')];
    const target = buttons.find((el) => el.textContent.trim().includes(${JSON.stringify(text)}));
    if (!target) return 'missing';
    target.click();
    return 'clicked';
  })()`
}

const CLOSE_DIALOG = `(() => {
  const buttons = [...document.querySelectorAll('.legal-dialog .el-button')];
  const target = buttons.find((el) => el.textContent.trim().includes('我已知悉'));
  if (!target) return 'missing';
  target.click();
  return 'clicked';
})()`

/** 点开某处就地提示里的声明链接（按容器定位，避免和页面其它链接串味）。 */
function clickNotice(scopeSelector) {
  return `(() => {
    const scope = document.querySelector(${JSON.stringify(scopeSelector)});
    const btn = scope ? scope.querySelector('.legal-notice-link') : null;
    if (!btn) return 'missing';
    btn.click();
    return 'clicked';
  })()`
}

const OPEN_HELP_MENU = `(() => {
  const btn = document.querySelector('.legal-help-button');
  if (!btn) return 'missing';
  btn.click();
  return 'clicked';
})()`

/**
 * 点「帮助」下拉里的菜单项。
 * 下拉是 teleport 到 body 的浮层，渲染有延迟，所以这里轮询等它出现并可见。
 */
function clickHelpItem(text) {
  return `(async () => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const items = [...document.querySelectorAll('.legal-help-popper .el-dropdown-menu__item')];
      const target = items.find((el) => el.textContent.includes(${JSON.stringify(text)}));
      if (target && target.getClientRects().length > 0) {
        target.click();
        return 'clicked';
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    return 'missing';
  })()`
}

const WAIT_DIALOG = `
  (async () => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const el = document.querySelector('.legal-dialog');
      if (el && el.getClientRects().length > 0) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return false;
  })()
`

/** 关闭要等离场动画收尾，固定 sleep 卡在 300ms 边界上会飘，这里轮询到位。 */
const WAIT_DIALOG_CLOSED = `
  (async () => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const el = document.querySelector('.legal-dialog');
      if (!el || el.getClientRects().length === 0) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return false;
  })()
`

describe('平台声明：入口、正文与安全', { concurrency: false }, () => {
  let server
  let chrome
  let guest
  let user

  before(async () => {
    if (!existsSync(join(distDir, 'index.html'))) {
      throw new Error('缺少 dist/index.html，请先执行 node tests/e2e/build-dist.mjs')
    }
    resetFault()
    server = await startStubServer({ distDir })
    chrome = await launchChrome()

    guest = await chrome.newPage()
    await guest.session.addInitScript(GUEST_INIT_SCRIPT)
    user = await chrome.newPage()
    await user.session.addInitScript(USER_INIT_SCRIPT)
  })

  after(async () => {
    await chrome?.closePage(guest?.targetId)
    await chrome?.closePage(user?.targetId)
    await chrome?.close()
    await server?.close()
  })

  /**
   * 把页面切到前台。
   *
   * CDP 里每个 target 都是一个真实标签页：后创建的页面在前台，先创建的处于 hidden。
   * Chrome 在隐藏页面上不跑 requestAnimationFrame，而 Vue 的 <transition> 正是靠 rAF
   * 推进 enter/leave（EP 弹窗的 fade 也由它收尾）。于是隐藏页里的弹窗会永远停在
   * `dialog-fade-enter-from`、点关闭也关不掉 —— 这是测试环境的可见性限制，不是产品缺陷
   * （真实用户永远在可见标签页操作）。所以每次操作前先把目标页激活。
   */
  async function focus(page) {
    await page.session.send('Target.activateTarget', { targetId: page.targetId })
  }

  async function goto(page, path, { width = 1440, height = 900, mobile = false } = {}) {
    await focus(page)
    const session = page.session
    session.clearConsole()
    await session.setViewport(width, height, { mobile })
    await session.navigate(`${server.url}${path}`)
    await session.waitForSettled({ quietMs: 300 })
    return session
  }

  /** 断言没有应用级错误（过滤掉桩服务器不支持的 WebSocket 噪声）。 */
  function assertClean(session, label) {
    assert.deepEqual(session.pageErrors, [], `${label}：页面抛出未捕获异常`)
    const errors = session
      .consoleErrors()
      .filter((entry) => !/WebSocket connection to|ws:\/\/|Failed to load resource/.test(entry.text))
    assert.deepEqual(errors, [], `${label}：控制台出现应用级 error`)
  }

  test('未登录可直接打开 /legal/privacy 并看到完整正文', async () => {
    await goto(guest, '/legal/privacy')

    const state = await guest.session.evaluate(`(() => ({
      pathname: location.pathname,
      heading: document.querySelector('.legal-panel h1')?.textContent.trim() ?? null,
      sections: document.querySelectorAll('.legal-doc-content h2').length,
      rows: document.querySelectorAll('.legal-doc-content tbody tr').length,
      hasMeta: Boolean(document.querySelector('.legal-doc-content .legal-doc__meta')),
    }))()`)

    assert.equal(state.pathname, '/legal/privacy')
    assert.equal(state.heading, '隐私说明')
    assert.ok(state.sections >= 8, `条款数量异常：${state.sections}`)
    assert.ok(state.rows >= 6, `收集范围表格行数异常：${state.rows}`)
    assert.equal(state.hasMeta, true, '缺少生效日期信息')
    assertClean(guest.session, '未登录打开声明页')
  })

  test('已登录访问 /legal/usage 不会被守卫弹回首页', async () => {
    await goto(user, '/legal/usage')

    const state = await user.session.evaluate(`(() => ({
      pathname: location.pathname,
      heading: document.querySelector('.legal-panel h1')?.textContent.trim() ?? null,
    }))()`)

    assert.equal(state.pathname, '/legal/usage', '声明页对已登录用户也应可访问')
    assert.equal(state.heading, '使用规范')
    assertClean(user.session, '已登录打开声明页')
  })

  test('独立页内切换文档：URL 变化但不整页刷新', async () => {
    const session = await goto(guest, '/legal/privacy')
    const before = await session.evaluate('window.__documentCount')

    const clicked = await session.evaluate(`(() => {
      const link = document.querySelector('.legal-doc-content a[data-legal="usage"]');
      if (!link) return 'missing';
      link.click();
      return 'clicked';
    })()`)
    assert.equal(clicked, 'clicked', '《隐私说明》里应能点开《使用规范》')
    await new Promise((r) => setTimeout(r, 250))

    const after = await session.evaluate(`(() => ({
      pathname: location.pathname,
      heading: document.querySelector('.legal-panel h1')?.textContent.trim() ?? null,
      documentCount: window.__documentCount,
    }))()`)

    assert.equal(after.pathname, '/legal/usage', '切换后 URL 应同步')
    assert.equal(after.heading, '使用规范', '切换后标题应同步')
    assert.equal(after.documentCount, before, '切换文档不应整页刷新')
    assertClean(session, '独立页切换文档')
  })

  test('登录页入口可用：打开《使用规范》、切到《隐私说明》、关闭', async () => {
    const session = await goto(guest, '/login')
    await session.evaluate('document.querySelector(".auth-shell") !== null')

    assert.equal(await session.evaluate(clickEntry('《使用规范》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, '登录页点《使用规范》没有打开弹窗')
    assert.equal(await session.evaluate(DIALOG_TITLE), '使用规范')

    const usageText = await session.evaluate(DIALOG_TEXT)
    assert.match(usageText, /账号与安全/, '弹窗正文应是使用规范')

    // 弹窗内页签切换
    const switched = await session.evaluate(`(() => {
      const tab = [...document.querySelectorAll('.legal-dialog-tab')]
        .find((el) => el.textContent.trim() === '隐私说明');
      if (!tab) return 'missing';
      tab.click();
      return 'clicked';
    })()`)
    assert.equal(switched, 'clicked')

    const privacyText = await session.evaluate(DIALOG_TEXT)
    assert.match(privacyText, /我们收集哪些信息/, '切到隐私说明后正文应同步更新')
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明')

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true, '点「我已知悉」后弹窗应关闭')
    assert.equal(await session.evaluate(DIALOG_VISIBLE), false)
    assertClean(session, '登录页声明弹窗')
  })

  test('弹窗内的跨文档内链也能切文档（不走路由）', async () => {
    const session = await goto(guest, '/login')
    assert.equal(await session.evaluate(clickEntry('《隐私说明》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true)

    const pathname = await session.evaluate('location.pathname')
    const clicked = await session.evaluate(`(() => {
      const link = document.querySelector('.legal-dialog-body a[data-legal="usage"]');
      if (!link) return 'missing';
      link.click();
      return 'clicked';
    })()`)
    assert.equal(clicked, 'clicked')
    await new Promise((r) => setTimeout(r, 200))

    assert.equal(await session.evaluate(DIALOG_TITLE), '使用规范')
    assert.equal(await session.evaluate('location.pathname'), pathname, '弹窗内切换不应改变 URL')
    assertClean(session, '弹窗内切换文档')
  })

  test('注册页：点声明链接会打开弹窗，且不会顺手勾上同意勾选框', async () => {
    const session = await goto(guest, '/register')

    assert.equal(await session.evaluate(clickEntry('《隐私说明》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true)
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明')

    const checked = await session.evaluate(
      `document.querySelector('.el-checkbox.is-checked') !== null`,
    )
    assert.equal(checked, false, '点《隐私说明》不应触发「已阅读并同意」勾选')

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true)

    // 勾选框仍可正常勾上（说明链接没有把 checkbox 的交互吃掉）
    await session.evaluate(`(() => {
      const box = document.querySelector('.agree-row .el-checkbox');
      if (box) box.click();
      return true;
    })()`)
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(
      await session.evaluate(`document.querySelector('.el-checkbox.is-checked') !== null`),
      true,
      '勾选框应仍可正常勾选',
    )
    assertClean(session, '注册页声明入口')
  })

  test('五个自带导航栏的页面都能看到常驻「帮助」入口', async () => {
    // 这些页面各有一套导航栏（AppNavBar 覆盖 6 页，复习/讨论/个人主页是自己抄的，
    // 做题页顶栏又单独一份），少挂一处那一页的用户就找不到声明，所以逐页验。
    for (const path of [
      '/home',
      '/review',
      '/discuss',
      '/profile',
      '/questiondetailview?questionId=1',
    ]) {
      await goto(user, path)
      const visible = await user.session.evaluate(`(() => {
        const btn = document.querySelector('.legal-help-button');
        if (!btn) return 'missing';
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? 'visible' : 'hidden';
      })()`)
      assert.equal(visible, 'visible', `${path}: 导航栏缺少可见的「帮助」入口`)
      assertClean(user.session, `${path} 帮助入口`)
    }
  })

  test('做题页手机档：从「更多」下拉打开《隐私说明》', async () => {
    const session = await goto(user, '/questiondetailview?questionId=1', {
      width: 375,
      height: 812,
      mobile: true,
    })

    // 375px 下顶栏已排满（返回/标题/收件箱/更多），「帮助」图标必须让位给「更多」下拉。
    const state = await session.evaluate(`(() => ({
      helpVisible: Boolean(document.querySelector('.legal-help-button')?.getClientRects().length),
      moreVisible: Boolean(document.querySelector('[aria-label="更多操作"]')?.getClientRects().length),
    }))()`)
    assert.equal(state.helpVisible, false, '手机档顶栏不应再显示「帮助」图标')
    assert.equal(state.moreVisible, true, '手机档顶栏应保留「更多」下拉')

    const clicked = await session.evaluate(`(() => {
      const btn = document.querySelector('[aria-label="更多操作"]');
      if (!btn) return 'missing';
      btn.click();
      return 'clicked';
    })()`)
    assert.equal(clicked, 'clicked')

    const itemClicked = await session.evaluate(`(async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const item = [...document.querySelectorAll('.el-dropdown-menu__item')]
          .find((el) => el.textContent.includes('《隐私说明》') && el.getClientRects().length > 0);
        if (item) { item.click(); return 'clicked'; }
        await new Promise((r) => setTimeout(r, 30));
      }
      return 'missing';
    })()`)
    assert.equal(itemClicked, 'clicked', '「更多」下拉里应有《隐私说明》')

    assert.equal(await session.evaluate(WAIT_DIALOG), true, '做题页「更多」里的声明打不开')
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明')
    assert.match(await session.evaluate(DIALOG_TEXT), /我们收集哪些信息/)

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true)
    assertClean(session, '做题页手机档声明入口')
  })

  test('「帮助」菜单能分别打开《使用规范》与《隐私说明》', async () => {
    const session = await goto(user, '/home')

    assert.equal(await session.evaluate(OPEN_HELP_MENU), 'clicked')
    assert.equal(await session.evaluate(clickHelpItem('《使用规范》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, '「帮助」菜单打不开声明弹窗')
    assert.equal(await session.evaluate(DIALOG_TITLE), '使用规范')
    assert.match(await session.evaluate(DIALOG_TEXT), /账号与安全/)

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true)

    // 第二次走另一份文档，确认菜单不是只接了第一款
    assert.equal(await session.evaluate(OPEN_HELP_MENU), 'clicked')
    assert.equal(await session.evaluate(clickHelpItem('《隐私说明》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true)
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明')
    assert.match(await session.evaluate(DIALOG_TEXT), /我们收集哪些信息/)

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true)
    assertClean(session, '帮助菜单打开声明')
  })

  test('发帖页就地提示：告知会公开、且能打开《使用规范》', async () => {
    const session = await goto(user, '/discuss/create')

    const notice = await session.evaluate(`(() => {
      const el = document.querySelector('.compose-notice');
      return el ? el.innerText.trim() : null;
    })()`)
    assert.ok(notice, '发帖页缺少就地提示')
    assert.match(notice, /公开/, '发帖提示应说明内容会公开')

    assert.equal(await session.evaluate(clickNotice('.compose-notice')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, '发帖页提示点不开声明')
    assert.equal(await session.evaluate(DIALOG_TITLE), '使用规范')
    assertClean(session, '发帖页就地提示')
  })

  test('帖子详情评论框就地提示可打开《使用规范》', async () => {
    const session = await goto(user, '/discuss/2001')

    const notice = await session.evaluate(`(() => {
      const el = document.querySelector('.comments-panel .comment-notice');
      return el ? el.innerText.trim() : null;
    })()`)
    assert.ok(notice, '评论框缺少就地提示')
    assert.match(notice, /可见/, '评论提示应说明评论可见')

    assert.equal(await session.evaluate(clickNotice('.comment-notice')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, '评论提示点不开声明')
    assert.equal(await session.evaluate(DIALOG_TITLE), '使用规范')
    assertClean(session, '评论框就地提示')
  })

  test('AI 面板就地提示：告知会读取题目与代码，并指向《隐私说明》', async () => {
    const session = await goto(user, '/questiondetailview?questionId=1')

    const opened = await session.evaluate(`(() => {
      const btn = document.querySelector('.ai-entry-button');
      if (!btn) return 'missing';
      btn.click();
      return 'clicked';
    })()`)
    assert.equal(opened, 'clicked', '找不到 AI 助手入口')

    const notice = await session.evaluate(`(async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const el = document.querySelector('.ai-panel-shell .composer-notice');
        if (el && el.getClientRects().length > 0) return el.innerText.trim();
        await new Promise((r) => setTimeout(r, 30));
      }
      return null;
    })()`)
    assert.ok(notice, 'AI 面板缺少就地提示')
    assert.match(notice, /读取/, 'AI 提示应说明会读取题目与代码')

    assert.equal(await session.evaluate(clickNotice('.composer-notice')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, 'AI 面板提示点不开声明')
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明', 'AI 提示应落到《隐私说明》')
    assertClean(session, 'AI 面板就地提示')
  })

  test('375px：手机档入口在导航抽屉里，导航栏搜索框不被挤坏、页面不横向溢出', async () => {
    const session = await goto(user, '/home', { width: 375, height: 812, mobile: true })

    const navbar = await session.evaluate(`(() => {
      const btn = document.querySelector('.legal-help-button');
      const search = document.querySelector('.search-input');
      return {
        helpVisible: btn ? btn.getClientRects().length > 0 : false,
        searchWidth: search ? Math.round(search.getBoundingClientRect().width) : -1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    })()`)

    // 导航栏在 375px 已被搜索框+收件箱+头像占满，40px 的触屏目标会把搜索框从 ~80px 压到 ~43px，
    // 所以手机档把入口收进抽屉（下面的用例验证抽屉真的能用）。
    assert.equal(navbar.helpVisible, false, '手机档导航栏不应再显示「帮助」按钮')
    assert.ok(navbar.searchWidth >= 80, `手机档搜索框被挤窄：${navbar.searchWidth}px`)
    assert.ok(
      navbar.scrollWidth <= navbar.clientWidth + 1,
      `手机档横向溢出：${navbar.scrollWidth} > ${navbar.clientWidth}`,
    )
    assertClean(session, '手机档导航栏')
  })

  test('375px：抽屉里的「平台声明」能打开两份声明', async () => {
    const session = await goto(user, '/home', { width: 375, height: 812, mobile: true })

    const opened = await session.evaluate(`(() => {
      const toggle = document.querySelector('[aria-label="打开主导航"]');
      if (!toggle) return 'missing';
      toggle.click();
      return 'clicked';
    })()`)
    assert.equal(opened, 'clicked', '找不到导航抽屉开关')

    const links = await session.evaluate(`(async () => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const nav = document.querySelector('.legal-drawer-links');
        if (nav && nav.getClientRects().length > 0) {
          return [...nav.querySelectorAll('.legal-drawer-link')].map((el) => el.textContent.trim());
        }
        await new Promise((r) => setTimeout(r, 30));
      }
      return null;
    })()`)
    assert.deepEqual(links, ['《使用规范》', '《隐私说明》'], '抽屉里应给出两份声明的入口')

    const opened2 = await session.evaluate(`(() => {
      const link = [...document.querySelectorAll('.legal-drawer-link')]
        .find((el) => el.textContent.includes('《隐私说明》'));
      if (!link) return 'missing';
      link.click();
      return 'clicked';
    })()`)
    assert.equal(opened2, 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true, '抽屉入口打不开声明')
    assert.equal(await session.evaluate(DIALOG_TITLE), '隐私说明')
    assert.match(await session.evaluate(DIALOG_TEXT), /我们收集哪些信息/)

    assert.equal(await session.evaluate(CLOSE_DIALOG), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG_CLOSED), true)
    assertClean(session, '手机档抽屉入口')
  })

  test('渲染后的正文不含可执行内容', async () => {
    const session = await goto(guest, '/legal/privacy')
    const audit = await session.evaluate(`(() => {
      const root = document.querySelector('.legal-doc-content');
      if (!root) return { missing: true };
      const inlineHandlers = [];
      for (const node of root.querySelectorAll('*')) {
        for (const attr of node.attributes) {
          if (attr.name.startsWith('on')) inlineHandlers.push(node.tagName + '[' + attr.name + ']');
        }
      }
      return {
        missing: false,
        scripts: root.querySelectorAll('script').length,
        inlineHandlers,
        iframes: root.querySelectorAll('iframe, object, embed').length,
      };
    })()`)

    assert.equal(audit.missing, false)
    assert.equal(audit.scripts, 0, '正文里不允许出现 script')
    assert.equal(audit.iframes, 0, '正文里不允许出现 iframe/object/embed')
    assert.deepEqual(audit.inlineHandlers, [], '正文里不允许内联事件处理器')
  })

  test('375px：声明独立页与弹窗都不横向溢出，弹窗正文可滚动', async () => {
    const session = await goto(guest, '/legal/privacy', { width: 375, height: 812, mobile: true })

    const page = await session.evaluate(`(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))()`)
    assert.ok(page.scrollWidth <= page.clientWidth + 1, `独立页横向溢出：${page.scrollWidth}`)

    await session.navigate(`${server.url}/login`)
    await session.waitForSettled({ quietMs: 300 })
    assert.equal(await session.evaluate(clickEntry('《隐私说明》')), 'clicked')
    assert.equal(await session.evaluate(WAIT_DIALOG), true)

    const dialog = await session.evaluate(rectProbe('.legal-dialog'))
    assert.ok(!dialog.missing, '弹窗未渲染')
    assert.ok(dialog.left >= -1 && dialog.right <= 376, `弹窗超出视口：${JSON.stringify(dialog)}`)

    const body = await session.evaluate(rectProbe('.legal-dialog-body'))
    assert.ok(!body.missing, '弹窗正文容器未渲染')
    assert.ok(body.right <= 376, `弹窗正文超出视口：${JSON.stringify(body)}`)
    assert.ok(
      body.scrollHeight > body.clientHeight,
      '长正文应产生内部滚动，而不是把弹窗撑出屏幕',
    )

    const docWidth = await session.evaluate(`(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))()`)
    assert.ok(docWidth.scrollWidth <= docWidth.clientWidth + 1, '弹窗打开后页面横向溢出')
    assertClean(session, '手机档声明')
  })

  test('压测：25 次完整开合 + 200 次文档切换，无报错且 DOM 不增长', async () => {
    const session = await goto(guest, '/login')

    const result = await session.evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const dialog = () => document.querySelector('.legal-dialog');
      const overlay = () => dialog()?.parentElement?.parentElement ?? null;
      const isOpen = () => { const el = dialog(); return Boolean(el) && el.getClientRects().length > 0; };
      // 过渡类还在 = 动画没结束。压测里等它结束，模拟真实用户（不会在 3 帧内点开又点关）。
      const animating = () => {
        const o = overlay();
        return Boolean(o) && /-enter-|-leave-/.test(o.className);
      };
      const state = () => {
        const o = overlay();
        return {
          rects: dialog() ? dialog().getClientRects().length : -1,
          ownOverlayClass: o ? String(o.className) : null,
          ownOverlayDisplay: o ? getComputedStyle(o).display : null,
          overlays: [...document.querySelectorAll('.el-overlay')].map((el) => getComputedStyle(el).display),
        };
      };
      const waitFor = async (fn, expected, timeout = 3000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (fn() === expected) return true;
          await sleep(5);
        }
        return false;
      };
      const closeBtn = () => [...document.querySelectorAll('.legal-dialog .el-button')]
        .find((el) => el.textContent.includes('我已知悉'));
      const openBtn = [...document.querySelectorAll('.privacy-note .text-action')]
        .find((el) => el.textContent.includes('隐私说明'));
      if (!openBtn) return { error: '找不到打开入口' };

      const CYCLES = 25;
      const SWITCHES = 200;
      let failures = 0;
      let failedPhase = null;
      let failedState = null;
      let nodesAfterFirstCycle = 0;

      const cycleStart = performance.now();
      for (let i = 0; i < CYCLES; i++) {
        openBtn.click();
        if (!(await waitFor(isOpen, true))) { failures++; failedPhase = 'open'; failedState = state(); break; }
        if (!(await waitFor(animating, false))) { failures++; failedPhase = 'enter-animation'; failedState = state(); break; }
        const btn = closeBtn();
        if (!btn) { failures++; failedPhase = 'close-button'; failedState = state(); break; }
        btn.click();
        if (!(await waitFor(isOpen, false))) { failures++; failedPhase = 'close'; failedState = state(); break; }
        if (i === 0) nodesAfterFirstCycle = document.querySelectorAll('*').length;
      }
      const cycleElapsed = Math.round(performance.now() - cycleStart);

      // 文档切换压测：真正吃性能的是 DOMPurify + v-html 重渲染，这里把它压满。
      let switchFailures = 0;
      let currentTitle = null;
      let switchElapsed = 0;
      if (!failures) {
        openBtn.click();
        await waitFor(isOpen, true);
        await waitFor(animating, false);
        const tabs = () => [...document.querySelectorAll('.legal-dialog-tab')];
        const nodesBeforeSwitches = document.querySelectorAll('*').length;
        const switchStart = performance.now();
        for (let i = 0; i < SWITCHES; i++) {
          // 弹窗由《隐私说明》打开，这里按奇偶交替切，保证每次点击都真的换文档
          // （点击当前页签会被 switchDoc 短路，压不到重渲染）。
          const target = i % 2 === 0 ? '使用规范' : '隐私说明';
          const tab = tabs().find((el) => el.textContent.trim() === target);
          if (!tab) { switchFailures++; break; }
          tab.click();
          await sleep(1);
        }
        switchElapsed = Math.round(performance.now() - switchStart);
        currentTitle = document.querySelector('.legal-dialog .el-dialog__title')?.textContent.trim() ?? null;
        const nodesAfterSwitches = document.querySelectorAll('*').length;
        if (nodesAfterSwitches - nodesBeforeSwitches > 20) {
          switchFailures++;
          failedPhase = 'switch-dom-growth';
          failedState = { nodesBeforeSwitches, nodesAfterSwitches };
        }
        const btn = closeBtn();
        if (btn) btn.click();
        await waitFor(isOpen, false);
      }

      return {
        cycles: CYCLES,
        switches: SWITCHES,
        failures,
        switchFailures,
        failedPhase,
        failedState,
        cycleElapsed,
        switchElapsed,
        currentTitle,
        nodesAfterFirstCycle,
        nodesEnd: document.querySelectorAll('*').length,
        stillOpen: isOpen(),
      };
    })()`)

    assert.equal(result.error, undefined, result.error)
    assert.equal(
      result.failures,
      0,
      `开关循环在「${result.failedPhase}」阶段失败：${JSON.stringify(result.failedState)}`,
    )
    assert.equal(
      result.switchFailures,
      0,
      `文档切换压测失败（${result.failedPhase}）：${JSON.stringify(result.failedState)}`,
    )
    assert.equal(result.stillOpen, false, '压测结束后弹窗应处于关闭状态')
    assert.equal(result.currentTitle, '隐私说明', '200 次切换后应停在《隐私说明》（证明每次点击都生效）')
    assert.ok(
      result.nodesEnd - result.nodesAfterFirstCycle < 20,
      `DOM 节点在压测中增长：${result.nodesAfterFirstCycle} → ${result.nodesEnd}`,
    )
    assert.ok(result.cycleElapsed < 30_000, `25 次完整开合耗时过长：${result.cycleElapsed}ms`)
    assert.ok(
      result.switchElapsed / result.switches < 50,
      `文档切换平均耗时过长：${result.switchElapsed}ms / ${result.switches} 次`,
    )
    assertClean(session, '声明压测')
  })
})
