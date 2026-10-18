import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { LEGAL_DOC_KEYS, isLegalDocKey, legalDocPath, resolveLegalDocKey } from '../src/utils/legalKeys.ts'

/**
 * 平台声明（使用规范 / 隐私说明）的「合同」测试。
 *
 * 这份文档的特点是：改文案的人可能完全不懂代码，而它又出现在注册、登录、找回密码、
 * 个人主页四个入口。因此除了纯逻辑单测，这里把「正文结构 + 安全红线 + 入口接线」
 * 全部用静态断言锁死，避免出现「弹窗里还是去年文案」「链接点了没反应」这类回归。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...parts) => readFileSync(join(projectRoot, ...parts), 'utf8')

const DOC_FILES = {
  usage: 'src/content/legal/usage.html',
  privacy: 'src/content/legal/privacy.html',
}

const docsRaw = Object.fromEntries(
  Object.entries(DOC_FILES).map(([key, path]) => [key, read(path)]),
)

/** 结构类断言看的是「会被渲染出来的正文」，先把 HTML 注释里的示例剥掉。 */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '')
const docs = Object.fromEntries(
  Object.entries(docsRaw).map(([key, html]) => [key, stripComments(html)]),
)

const ENTRY_VIEWS = [
  'src/views/LoginView.vue',
  'src/views/RegisterView.vue',
  'src/views/ForgotPasswordView.vue',
  'src/views/ProfileView.vue',
]

// ---------------------------------------------------------------- 纯逻辑

test('文档标识：只认 usage / privacy，非法值回落到使用规范', () => {
  assert.deepEqual([...LEGAL_DOC_KEYS], ['usage', 'privacy'])

  assert.equal(isLegalDocKey('usage'), true)
  assert.equal(isLegalDocKey('privacy'), true)
  assert.equal(isLegalDocKey('USER_AGREEMENT'), false)
  assert.equal(isLegalDocKey(''), false)
  assert.equal(isLegalDocKey(undefined), false)
  assert.equal(isLegalDocKey(null), false)
  assert.equal(isLegalDocKey(0), false)

  assert.equal(resolveLegalDocKey('privacy'), 'privacy')
  assert.equal(resolveLegalDocKey('usage'), 'usage')
  assert.equal(resolveLegalDocKey('../etc/passwd'), 'usage')
  assert.equal(resolveLegalDocKey(undefined), 'usage')
})

test('文档路径固定为 /legal/:doc', () => {
  assert.equal(legalDocPath('usage'), '/legal/usage')
  assert.equal(legalDocPath('privacy'), '/legal/privacy')
})

// ---------------------------------------------------------------- 正文结构

test('两份正文都是完整的 article 文档，且写死了生效日期、没有残留占位符', () => {
  for (const [key, html] of Object.entries(docs)) {
    assert.match(html, /<article class="legal-doc"/, `${key}: 缺少 article.legal-doc 容器`)
    assert.match(html, /class="legal-doc__meta"/, `${key}: 缺少生效日期行`)
    assert.match(html, /生效日期：\d{4}-\d{2}-\d{2}/, `${key}: 生效日期应为 YYYY-MM-DD`)
    assert.match(html, /最近更新：\d{4}-\d{2}-\d{2}/, `${key}: 最近更新应为 YYYY-MM-DD`)
    assert.doesNotMatch(html, /【/, `${key}: 还有未替换的【占位内容】`)
  }
})

test('隐私说明给出了可用的联系方式', () => {
  assert.match(
    docs.privacy,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    '隐私说明应给出可联系到我们的邮箱',
  )
})

test('《使用规范》覆盖账号、社区、AI、判题、申诉与知识产权', () => {
  const required = [
    '总则',
    '账号与安全',
    '使用行为规范',
    '社区内容规范',
    'AI 功能使用规范',
    '在线判题与代码规范',
    '违规处理与申诉',
    '知识产权',
    '服务变更与免责',
    '规范的更新',
  ]
  for (const heading of required) {
    assert.ok(docs.usage.includes(heading), `《使用规范》缺少「${heading}」条款`)
  }

  // 与产品实际能力对齐：申诉入口在「个人主页 → 我的内容 → 我的申诉」。
  assert.match(docs.usage, /我的申诉/, '申诉条款必须指向真实入口，否则用户找不到')
  assert.match(docs.usage, /隔离容器/, '判题条款应说明代码在隔离容器中运行')
})

test('《隐私说明》覆盖收集范围、用途、存储、共享、本地存储与用户权利', () => {
  const required = [
    '我们收集哪些信息',
    '我们如何使用这些信息',
    '信息的存储与保护',
    '信息的对外提供',
    '本地存储与缓存',
    '你的权利',
    '未成年人保护',
    '说明的更新与联系我们',
  ]
  for (const heading of required) {
    assert.ok(docs.privacy.includes(heading), `《隐私说明》缺少「${heading}」条款`)
  }

  // 收集范围必须与真实实现对齐（localStorage 的键、AI 与判题入参）。
  for (const keyword of ['登录令牌', '代码草稿', '判题结果', 'AI 交互数据', '邮箱', 'IP 地址']) {
    assert.ok(docs.privacy.includes(keyword), `《隐私说明》未覆盖实际采集项：${keyword}`)
  }

  // 注销入口在个人主页的编辑下拉里。
  assert.match(docs.privacy, /注销账号/, '隐私说明应给出注销账号的可达路径')
})

test('隐私说明的收集范围表格列数一致（3 列）', () => {
  const table = docs.privacy.match(/<table>[\s\S]*?<\/table>/)?.[0]
  assert.ok(table, '《隐私说明》缺少收集范围表格')

  const rows = table.match(/<tr>[\s\S]*?<\/tr>/g) ?? []
  assert.ok(rows.length >= 7, `收集范围表格行数过少：${rows.length}`)

  for (const [index, row] of rows.entries()) {
    const cells = row.match(/<t[hd]>/g) ?? []
    assert.equal(cells.length, 3, `表格第 ${index + 1} 行应为 3 列，实际 ${cells.length} 列`)
  }
})

// ---------------------------------------------------------------- 安全红线

test('正文里不允许出现可执行内容（script/style/iframe/事件属性/javascript:）', () => {
  // 用未剥注释的原文：注释里也不允许出现这些写法，避免有人「抄示例」抄进正文。
  for (const [key, html] of Object.entries(docsRaw)) {
    assert.doesNotMatch(html, /<script/i, `${key}: 不允许 <script>`)
    assert.doesNotMatch(html, /<style/i, `${key}: 不允许 <style>（样式统一在组件里）`)
    assert.doesNotMatch(html, /<iframe|<object|<embed/i, `${key}: 不允许嵌入外部框架`)
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${key}: 不允许内联事件处理器`)
    assert.doesNotMatch(html, /javascript:/i, `${key}: 不允许 javascript: 协议`)
  }
})

test('跨文档内链必须是 data-legal + /legal/ 双写，且指向已登记的文档', () => {
  for (const [key, html] of Object.entries(docs)) {
    const links = html.match(/<a\b[^>]*data-legal="[^"]*"[^>]*>/g) ?? []
    assert.ok(links.length > 0, `${key}: 缺少跨文档内链`)

    for (const link of links) {
      const target = link.match(/data-legal="([^"]+)"/)?.[1]
      const href = link.match(/href="([^"]+)"/)?.[1]
      assert.ok(isLegalDocKey(target), `${key}: data-legal="${target}" 不是已登记的文档`)
      assert.equal(href, `/legal/${target}`, `${key}: href 与 data-legal 不一致（${link}）`)
      assert.notEqual(target, key, `${key}: 不应链接到自己`)
    }
  }

  // 两份文档必须互相可达，否则用户只能在弹窗里看到其中一份。
  assert.ok(docs.usage.includes('data-legal="privacy"'), '《使用规范》应链到《隐私说明》')
  assert.ok(docs.privacy.includes('data-legal="usage"'), '《隐私说明》应链到《使用规范》')
})

test('正文不出现 h1（标题由弹窗/独立页统一承担）', () => {
  for (const [key, html] of Object.entries(docs)) {
    assert.doesNotMatch(html, /<h1[\s>]/i, `${key}: 正文不要写 h1，避免一页两个主标题`)
    const h2Count = (html.match(/<h2>/g) ?? []).length
    assert.ok(h2Count >= 8, `${key}: h2 条款数量异常（${h2Count}）`)
  }
})

// ---------------------------------------------------------------- 渲染与接线

test('渲染器统一走 DOMPurify 清洗后的 v-html，且只清洗一次', () => {
  const content = read('src/components/legal/LegalDocContent.vue')
  assert.match(content, /DOMPurify\.sanitize\(/, '声明正文必须经 DOMPurify 清洗')
  assert.match(content, /USE_PROFILES:\s*\{\s*html:\s*true\s*\}/, '应显式限定 HTML profile')
  assert.match(content, /v-html="safeHtml"/, '正文应绑定清洗后的 safeHtml')
  assert.match(content, /data-legal/, '应拦截正文内的 data-legal 内链')
})

test('legalDocs 登记了两份正文与展示标题', () => {
  const source = read('src/utils/legalDocs.ts')
  assert.match(source, /usageHtml from '@\/content\/legal\/usage\.html\?raw'/)
  assert.match(source, /privacyHtml from '@\/content\/legal\/privacy\.html\?raw'/)
  assert.match(source, /title: '使用规范'/)
  assert.match(source, /title: '隐私说明'/)
})

test('弹窗与独立页共用同一份正文组件', () => {
  const dialog = read('src/components/legal/LegalDocDialog.vue')
  const view = read('src/views/LegalView.vue')

  assert.match(dialog, /LegalDocContent/, '弹窗必须复用 LegalDocContent')
  assert.match(view, /LegalDocContent/, '独立页必须复用 LegalDocContent')
  assert.match(dialog, /LEGAL_DOC_LIST/, '弹窗内应能切换两份文档')
})

test('四个入口都接上了声明弹窗，且两份文档都能打开', () => {
  for (const view of ENTRY_VIEWS) {
    const source = read(view)
    assert.match(source, /<LegalDocDialog/, `${view}: 缺少 <LegalDocDialog>`)
    assert.match(source, /openLegalDoc\('usage'\)/, `${view}: 缺少《使用规范》入口`)
    assert.match(source, /openLegalDoc\('privacy'\)/, `${view}: 缺少《隐私说明》入口`)
  }
})

test('注册页的勾选文案与校验提示统一为《使用规范》《隐私说明》', () => {
  const source = read('src/views/RegisterView.vue')
  assert.match(source, /我已阅读并同意/, '注册页应保留勾选确认')
  assert.match(source, /《使用规范》/, '注册页勾选文案缺少《使用规范》')
  assert.match(source, /《隐私说明》/, '注册页勾选文案缺少《隐私说明》')
  assert.doesNotMatch(source, /《用户协议》/, '旧的《用户协议》文案应已替换')
  assert.doesNotMatch(source, /《隐私政策》/, '旧的《隐私政策》文案应已替换')
  assert.match(source, /请先阅读并同意《使用规范》与《隐私说明》/, '校验提示应与勾选文案一致')
})

test('登录页不再只有一句纯文本，声明入口可点击', () => {
  const source = read('src/views/LoginView.vue')
  assert.match(source, /登录即表示你同意/, '登录页应保留告知文案')
  assert.doesNotMatch(
    source,
    /<p class="privacy-note">[^<]*<\/p>/,
    '登录页隐私提示必须包含可点击入口，不能退回纯文本',
  )
})

// ---------------------------------------------------------------- 全站常驻入口

/** 每个自带一套导航栏的页面都要挂「帮助」菜单，否则那一页的用户找不到声明。 */
const NAV_HOSTS = [
  'src/components/layout/AppNavBar.vue',
  'src/views/ReviewView.vue',
  'src/views/DiscussionView.vue',
  'src/views/ProfileView.vue',
]

test('每个导航栏都挂了常驻「帮助」入口（手机档用 .cw-hide-phone 收起）', () => {
  for (const host of NAV_HOSTS) {
    const source = read(host)
    assert.match(
      source,
      /<LegalHelpMenu class="cw-hide-phone"\s*\/>/,
      `${host}: 导航栏缺少 <LegalHelpMenu class="cw-hide-phone" />`,
    )
    assert.match(
      source,
      /import LegalHelpMenu from '@\/components\/legal\/LegalHelpMenu\.vue'/,
      `${host}: 缺少 LegalHelpMenu 导入`,
    )
  }
})

test('做题页顶栏也有声明入口：桌面「帮助」图标 + 手机「更多」下拉', () => {
  const source = read('src/components/question-detail/QuestionTopBar.vue')

  assert.match(source, /<LegalHelpMenu class="cw-hide-phone"\s*\/>/, '桌面档缺少「帮助」图标')
  assert.match(source, /<LegalDocDialog/, '缺少声明弹窗')
  assert.match(source, /openLegalDoc\('usage'\)/, '手机「更多」下拉缺少《使用规范》')
  assert.match(source, /openLegalDoc\('privacy'\)/, '手机「更多」下拉缺少《隐私说明》')

  // 顶栏是 375px 下最挤的一页，手机档必须把入口收进「更多」而不是平铺图标。
  assert.equal(
    (source.match(/<LegalHelpMenu/g) ?? []).length,
    1,
    '顶栏只应有一个「帮助」图标（手机档走「更多」下拉）',
  )
})

test('手机档入口在导航抽屉里，且与桌面入口的断点成对', () => {
  for (const host of NAV_HOSTS) {
    const source = read(host)
    assert.match(source, /<LegalDrawerLinks\s*\/>/, `${host}: 抽屉缺少 <LegalDrawerLinks />`)
    assert.match(
      source,
      /import LegalDrawerLinks from '@\/components\/legal\/LegalDrawerLinks\.vue'/,
      `${host}: 缺少 LegalDrawerLinks 导入`,
    )
  }

  // 抽屉入口必须是手机档专用（桌面档由帮助菜单承担），否则桌面会出现两个入口。
  assert.match(
    read('src/components/legal/LegalDrawerLinks.vue'),
    /class="legal-drawer-links cw-only-phone"/,
    'LegalDrawerLinks 应只在手机档显示',
  )

  // 显示侧（cw-only-phone：min-width 769 隐藏，即 ≤768 显示）与隐藏侧（cw-hide-phone：≤768 隐藏）
  // 必须同一断点，否则会出现"桌面入口已隐藏、手机入口还没显示"的空窗。
  const responsive = read('src/styles/responsive.css')
  assert.match(responsive, /@media \(min-width: 769px\) \{\s*\.cw-only-phone/, 'cw-only-phone 断点应保持 768/769')
  assert.match(responsive, /@media \(max-width: 768px\) \{\s*\.cw-hide-phone/, 'cw-hide-phone 断点应保持 768')
})

test('「帮助」菜单暴露两款声明、可弹窗查看，并带联系方式', () => {
  const source = read('src/components/legal/LegalHelpMenu.vue')

  // 菜单项来自 LEGAL_DOC_LIST，新增声明时不会漏挂入口。
  assert.match(source, /v-for="doc in LEGAL_DOC_LIST"/, '菜单项应由 LEGAL_DOC_LIST 驱动')
  assert.match(source, /resolveLegalDocKey\(command\)/, '菜单命令应经 resolveLegalDocKey 归一')
  assert.match(source, /<LegalDocDialog/, '「帮助」菜单应自带声明弹窗')
  assert.match(source, /legal-help-button/, '缺少「帮助」按钮样式钩子')
})

test('界面上的联系邮箱与《隐私说明》第八条保持一致，避免改一处漏一处', () => {
  const constant = read('src/utils/legalDocs.ts').match(
    /LEGAL_CONTACT_EMAIL = '([^']+)'/,
  )?.[1]
  const docEmail = docs.privacy.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]

  assert.ok(constant, 'legalDocs 应给出联系邮箱常量')
  assert.equal(constant, docEmail, '界面邮箱与《隐私说明》不一致')

  // 界面侧一律引用常量，不许再各写一份字面量。
  for (const file of [
    'src/components/legal/LegalHelpMenu.vue',
    'src/components/legal/LegalDrawerLinks.vue',
  ]) {
    const source = read(file)
    assert.match(source, /LEGAL_CONTACT_EMAIL/, `${file}: 应引用 LEGAL_CONTACT_EMAIL`)
    assert.doesNotMatch(
      source,
      /'[^']*[a-zA-Z0-9._%+-]@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^']*'/,
      `${file}: 不要再写死一份邮箱字面量`,
    )
  }
})

// ---------------------------------------------------------------- 就地提示

/**
 * 用户真正需要被提醒的时刻：内容要公开了、代码要发给 AI 了。
 * 这里把「哪一页该提醒什么」锁成合同，避免以后改了编辑器把提示弄丢。
 */
const IN_CONTEXT_HOSTS = [
  {
    file: 'src/views/DiscussionComposeView.vue',
    need: /公开/,
    doc: 'usage',
    why: '发帖页必须告知内容会公开',
  },
  {
    file: 'src/views/DiscussionDetailView.vue',
    need: /公开|可见/,
    doc: 'usage',
    why: '评论框必须告知评论可见',
  },
  {
    file: 'src/components/question-detail/QuestionSolutionPanel.vue',
    need: /公开/,
    doc: 'usage',
    why: '题解编辑器必须告知题解公开',
  },
  {
    file: 'src/components/question-detail/AiAssistantPanel.vue',
    need: /读取/,
    doc: 'privacy',
    why: 'AI 面板必须告知会读取题目与代码',
  },
]

test('四处就地提示都在，且指向正确的声明', () => {
  for (const { file, need, doc, why } of IN_CONTEXT_HOSTS) {
    const source = read(file)
    assert.match(source, /<LegalNotice/, `${file}: ${why}（缺少 <LegalNotice />）`)
    assert.match(
      source,
      /import LegalNotice from '@\/components\/legal\/LegalNotice\.vue'/,
      `${file}: 缺少 LegalNotice 导入`,
    )

    const tag = source.match(/<LegalNotice[\s\S]*?\/>/)?.[0]
    assert.ok(tag, `${file}: LegalNotice 写法异常（本测试只认自闭合标签）`)
    assert.match(tag, /text="[^"]+"/, `${file}: 就地提示不能是空文案`)
    assert.match(tag, need, `${file}: ${why}，但文案没提到相关内容（${tag.trim()}）`)

    if (doc === 'privacy') {
      assert.match(tag, /doc="privacy"/, `${file}: ${why}，应链到《隐私说明》`)
    } else {
      assert.doesNotMatch(tag, /doc=/, `${file}: 默认即《使用规范》，不必重复声明 doc`)
    }
  }
})

test('就地提示组件只负责「一句话 + 一个入口 + 自带弹窗」，不复制正文', () => {
  const source = read('src/components/legal/LegalNotice.vue')

  assert.match(source, /defineProps/, 'LegalNotice 应由 props 驱动文案')
  assert.match(source, /LEGAL_DOCS\[/, '链接书名号应取自 LEGAL_DOCS，避免写死标题')
  assert.match(source, /<LegalDocDialog/, 'LegalNotice 应自带声明弹窗')
  // 正文只能来自 content/legal/*.html，组件里不许再抄一份。
  assert.doesNotMatch(source, /<h2>/, 'LegalNotice 不应内联声明正文')
})

test('多根组件的 class 必须手动透传（否则调用方的定位样式会静默失效）', () => {
  // 真实踩过的坑：LegalNotice 是「提示 + 弹窗」两棵根节点，Vue 不会自动继承 class，
  // 于是 <LegalNotice class="compose-notice" /> 里的 class 被丢掉，布局与测试一起失效。
  for (const file of [
    'src/components/legal/LegalNotice.vue',
    'src/components/legal/LegalHelpMenu.vue',
    'src/components/legal/LegalDrawerLinks.vue',
  ]) {
    const source = read(file)
    assert.match(source, /inheritAttrs:\s*false/, `${file}: 多根组件应关闭自动继承`)
    assert.match(source, /useAttrs\(\)/, `${file}: 应取到 attrs`)
    assert.match(source, /v-bind="attrs"/, `${file}: 应把 attrs 落到根节点上`)
  }
})

test('路由把 /legal/:doc 设为公开，且已登录用户不会被弹回首页', () => {
  const source = read('src/router/index.ts')

  assert.match(source, /path: '\/legal\/:doc'/, '缺少声明路由')
  assert.match(source, /name: 'legal'/, '声明路由应命名为 legal')

  // 关键：公开≠仅未登录可看。声明页常被当作分享链接打开，登录用户也必须能看，
  // 所以它要在 PUBLIC_PATHS 的「已登录→回首页」逻辑之前直接放行。
  const legalPass = source.indexOf("if (to.name === 'legal') return true")
  const publicRedirect = source.indexOf("PUBLIC_PATHS.has(to.path)")
  assert.ok(legalPass > -1, '路由守卫缺少 legal 放行分支')
  assert.ok(publicRedirect > -1, '路由守卫结构变化，请同步本测试')
  assert.ok(legalPass < publicRedirect, 'legal 放行必须发生在「已登录弹回 /home」之前')

  assert.doesNotMatch(
    source,
    /PUBLIC_PATHS\s*=\s*new Set\(\[[^\]]*'\/legal/,
    '不要把 /legal 放进 PUBLIC_PATHS：那会让已登录用户被弹回首页',
  )
})
