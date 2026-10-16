import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { ref, reactive, computed, watch, nextTick, effectScope } from 'vue'

const view = readFileSync(new URL('../src/views/QuestionDetailView.vue', import.meta.url), 'utf8')
const source = parse(view).descriptor.scriptSetup.content.replace(/^import .*$/gm, '')
const compiled = ts.transpileModule(source + `
 globalThis.testView = {
   handleSubmit, handleDebug, setupJudgeSubscriptions, debugTestCases, debugging,
   judgeResult, parsedTestData, submitting, selectedTestCaseIndex,
   setEditor(value) { editor = { getValue: () => value, getModel: () => null } },
 }
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText

function fixture(t, from) {
  const listeners = new Map()
  const destinations = new Map()
  const requests = []
  const notices = []
  const mounted = []
  const store = reactive({ userDto: { userId: 2 }, isAdmin: false })
  const route = { query: { questionId: '7', from } }
  const api = {
    submitCode: async (payload) => { requests.push(payload); return { code: 200, data: 11 } },
    debug: async (payload) => { requests.push(payload); return { code: 200, data: '83e2bd89-4c08-4608-a581-a5542ac79e09' } },
    getQuestionById: async () => ({ code: 200, data: { title: 'Test', sampleInput: '1', sampleOutput: '2' } }),
  }
  const context = vm.createContext({
    ref, computed, watch, nextTick,
    onMounted: (callback) => mounted.push(callback), onBeforeUnmount: () => {},
    useRoute: () => route, useRouter: () => ({}), useUserStore: () => store,
    // 断点与日志：这个夹具里一律按桌面档处理，日志走 no-op
    useBreakpoint: () => ({
      isNarrowPhone: ref(false),
      isPhone: ref(false),
      isTablet: ref(false),
      isDesktop: ref(true),
      isCompact: ref(false),
    }),
    useMediaQuery: () => ref(false),
    breakpointQuery: () => '(max-width: 1280px)',
    logWarn() {},
    logDebug() {},
    self: {}, EditorWorker: class {},
    localStorage: { getItem: () => '99', setItem() {}, removeItem() {} },
    websocketService: {
      subscribe: (event, destination) => destinations.set(event, destination),
      unsubscribe: (event) => destinations.delete(event),
      on: (event, callback) => { listeners.set(event, callback); return () => listeners.delete(event) },
    },
    questionApi: api, aiApi: {}, userApi: {}, reviewApi: {},
    ElMessage: Object.fromEntries(['success', 'error', 'warning', 'info'].map((key) => [key, (text) => notices.push({ key, text })])),
    console: { log() {}, warn() {}, error() {} },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    window: { addEventListener() {}, removeEventListener() {} },
  })
  const scope = effectScope()
  scope.run(() => vm.runInContext(compiled, context))
  t.after(() => scope.stop())
  const state = context.testView
  state.setEditor('print(2)')
  state.debugTestCases.value = [{ input: '1', expectedOutput: '2', result: null, passed: null }]
  state.setupJudgeSubscriptions()
  return { state, listeners, destinations, requests, notices, api, store, route, mounted, scope }
}

for (const [from, scene] of [[undefined, 'NORMAL'], ['/review', 'REVIEW'], ['/plan', 'PLAN'], [['/review'], 'REVIEW'], ['/home', 'NORMAL']]) {
  test(`submission from ${JSON.stringify(from)} sends required ${scene}`, async (t) => {
    const { state, requests } = fixture(t, from)
    await state.handleSubmit()
    assert.equal(requests[0].submitScene, scene)
    assert.equal(requests[0].questionId, 7)
  })
}

test('accepted debug UUID waits for WebSocket and does not populate result', async (t) => {
  const { state, requests, listeners } = fixture(t)
  await state.handleDebug()
  assert.equal(requests[0].userId, '2')
  assert.equal(state.debugging.value, true)
  assert.equal(state.debugTestCases.value[0].result, null)
  listeners.get('debug-judge-result')({ userId: 2, result: [{ submitStatus: 'AC', userOutput: '2', userId: 2 }] })
  assert.equal(state.debugging.value, false)
  assert.equal(state.debugTestCases.value[0].passed, true)
  assert.equal(state.selectedTestCaseIndex.value, 0)
})

test('WebSocket completion before HTTP response stays completed', async (t) => {
  const { state, api, listeners } = fixture(t)
  let accept
  api.debug = () => new Promise((resolve) => { accept = resolve })
  const pending = state.handleDebug()
  listeners.get('debug-judge-result')({ result: [{ submitStatus: 'WA', userOutput: '3' }] })
  accept({ code: 200, data: 'uuid' })
  await pending
  assert.equal(state.debugging.value, false)
  assert.equal(state.debugTestCases.value[0].result.userOutput, '3')
  assert.equal(state.debugTestCases.value[0].passed, false)
})

for (const kind of ['business rejection', 'network rejection']) {
  test(`debug ${kind} clears loading`, async (t) => {
    const { state, api } = fixture(t)
    // 业务码非 200 时，request.ts 的响应拦截器会把信封换成 Error 并 reject
    // （带上 bizCode），页面侧永远走 catch。这里按真实契约抛，而不是返回一个
    // 不会发生的"非 200 但不 reject"的信封。
    api.debug = kind === 'business rejection'
      ? async () => {
          const bizError = new Error('失败')
          bizError.bizCode = 4000207
          throw bizError
        }
      : async () => { throw new Error('offline') }
    await state.handleDebug()
    assert.equal(state.debugging.value, false)
    assert.equal(state.debugTestCases.value[0].result, null)
  })
}

test('repeated clicks do not create overlapping debug or ordinary requests', async (t) => {
  const { state, requests } = fixture(t)
  await state.handleDebug()
  await state.handleDebug()
  await state.handleSubmit()
  await state.handleSubmit()
  assert.equal(requests.length, 2)
})

for (const result of [[], 'uuid', {}, [null], [{}], [{ submitStatus: 'AC', userOutput: 3 }]]) {
  test(`malformed debug payload ${JSON.stringify(result)} leaves waiting state intact`, async (t) => {
    const { state, listeners } = fixture(t)
    await state.handleDebug()
    assert.doesNotThrow(() => listeners.get('debug-judge-result')({ result }))
    assert.equal(state.debugging.value, true)
    assert.equal(state.debugTestCases.value[0].result, null)
  })
}

test('compile error without output is rendered and cannot pass', async (t) => {
  const { state, listeners } = fixture(t)
  await state.handleDebug()
  listeners.get('debug-judge-result')({ result: [{ submitStatus: 'CE', errorMsg: '编译失败' }] })
  assert.equal(state.debugTestCases.value[0].result.errorMsg, '编译失败')
  assert.equal(state.debugTestCases.value[0].passed, false)
  assert.equal(state.debugging.value, false)
})

test('missing expected output does not claim success', async (t) => {
  const { state, listeners } = fixture(t)
  state.debugTestCases.value[0].expectedOutput = ''
  await state.handleDebug()
  listeners.get('debug-judge-result')({ results: [{ submitStatus: 'AC', userOutput: '' }] })
  assert.equal(state.debugTestCases.value[0].passed, null)
})

test('other-user wrapper or record is ignored', async (t) => {
  const { state, listeners } = fixture(t)
  await state.handleDebug()
  listeners.get('debug-judge-result')({ userId: 3, result: [{ submitStatus: 'AC', userOutput: '2' }] })
  listeners.get('debug-judge-result')({ result: [{ userId: 3, submitStatus: 'AC', userOutput: '2' }] })
  listeners.get('judge-result')({ userId: 3, result: { submitStatus: 'AC' } })
  assert.equal(state.debugging.value, true)
  assert.equal(state.judgeResult.value, null)
})

test('ordinary result reads wrapped status and reports failure', async (t) => {
  const { state, listeners, notices } = fixture(t)
  state.submitting.value = true
  listeners.get('judge-result')({ userId: 2, result: { submissionId: 11, submitStatus: 'CE', error: '编译失败' } })
  assert.equal(state.judgeResult.value.submitStatus, 'CE')
  assert.equal(state.submitting.value, false)
  assert.equal(notices.at(-1).key, 'error')
})

test('ordinary legacy direct result works but malformed objects are rejected', (t) => {
  const { state, listeners } = fixture(t)
  listeners.get('judge-result')({ result: [] })
  listeners.get('judge-result')({ result: {} })
  assert.equal(state.judgeResult.value, null)
  listeners.get('judge-result')({ submitStatus: 'AC' })
  assert.equal(state.judgeResult.value.submitStatus, 'AC')
})

test('ordinary structured output uses backend actual without requiring inputData', (t) => {
  const { state, listeners } = fixture(t)
  listeners.get('judge-result')({ result: { submitStatus: 'WA', expectedOutput: '2', actual: '3' } })
  assert.equal(state.parsedTestData.value.expected, '2')
  assert.equal(state.parsedTestData.value.actual, '3')
  listeners.get('judge-result')({ result: { submitStatus: 'WA', actual: '', userOutput: 'legacy' } })
  assert.equal(state.parsedTestData.value.actual, '')
})

test('ordinary output preserves legacy fields and error text fallback', (t) => {
  const { state, listeners } = fixture(t)
  listeners.get('judge-result')({ result: { submitStatus: 'WA', inputData: '1', userOutput: '3', expectedOutput: '2' } })
  assert.equal(state.parsedTestData.value.input, '1')
  assert.equal(state.parsedTestData.value.actual, '3')
  listeners.get('judge-result')({ result: { submitStatus: 'WA', error: '输入: 1 输出: 3 预期: 2' } })
  assert.equal(state.parsedTestData.value.input, '1')
  assert.equal(state.parsedTestData.value.expected, '2')
  assert.equal(state.parsedTestData.value.actual, '3')
})

test('subscriptions use store ID and rebind on identity change', async (t) => {
  const { mounted, destinations, store, scope } = fixture(t)
  assert.equal(destinations.get('judge-result'), '/queue/judge-result-2')
  await scope.run(() => mounted[0]())
  store.userDto.userId = 5
  await nextTick()
  assert.equal(destinations.get('judge-result'), '/queue/judge-result-5')
  assert.equal(destinations.get('debug-judge-result'), '/queue/debug-judge-result-5')
})
