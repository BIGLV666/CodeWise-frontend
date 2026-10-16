import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

/**
 * 日志出口的行为约定。
 *
 * 用「转译 + vm」的套路（与 tests/judge-contract.test.mjs 一致），这样不必引入 vitest/jsdom。
 * `import.meta.env` 在 vm 里不可用，替换成一个可注入的全局对象，
 * 从而能分别验证开发环境与生产环境两条分支——这正是 logWarn/logDebug 存在的意义。
 */
const source = readFileSync(new URL('../src/utils/logger.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/import\.meta\.env/g, '__CW_ENV__'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

function loadLogger({ dev }) {
  const calls = { debug: [], warn: [], error: [] }
  const context = vm.createContext({
    exports: {},
    module: { exports: {} },
    __CW_ENV__: { DEV: dev },
    console: {
      debug: (...args) => calls.debug.push(args),
      warn: (...args) => calls.warn.push(args),
      error: (...args) => calls.error.push(args),
    },
  })
  vm.runInContext(compiled, context)
  return { logger: context.exports, calls }
}

test('开发环境：logWarn / logDebug 会打到控制台', () => {
  const { logger, calls } = loadLogger({ dev: true })
  logger.logWarn('加载失败', new Error('boom'))
  logger.logDebug('轮询中')
  assert.equal(calls.warn.length, 1)
  assert.equal(calls.debug.length, 1)
  assert.ok(String(calls.warn[0][0]).startsWith('[cw]'))
})

test('生产环境：logWarn / logDebug 静默（控制台不被业务失败刷屏）', () => {
  const { logger, calls } = loadLogger({ dev: false })
  logger.logWarn('加载失败', new Error('boom'))
  logger.logDebug('轮询中')
  assert.equal(calls.warn.length, 0)
  assert.equal(calls.debug.length, 0)
})

test('reportError：生产环境不打印但会记录，开发环境打印', () => {
  const prod = loadLogger({ dev: false })
  const prodRecord = prod.logger.reportError(new Error('意外错误'), 'vue:render')
  assert.equal(prod.calls.error.length, 0, '生产环境不应打印')
  assert.equal(prod.logger.getRecentErrors().length, 1)
  assert.equal(prodRecord.context, 'vue:render')
  assert.equal(prodRecord.message, '意外错误')

  const dev = loadLogger({ dev: true })
  dev.logger.reportError(new Error('意外错误'))
  assert.equal(dev.calls.error.length, 1, '开发环境应打印')
})

test('reportError：环形缓冲不会无限增长', () => {
  const { logger } = loadLogger({ dev: false })
  for (let i = 0; i < 80; i += 1) logger.reportError(new Error(`e${i}`))
  const records = logger.getRecentErrors()
  assert.equal(records.length, 50)
  assert.equal(records[records.length - 1].message, 'e79')
  logger.clearRecentErrors()
  assert.equal(logger.getRecentErrors().length, 0)
})

test('describeError：各种抛出物都能转成一行可读文本', () => {
  const { logger } = loadLogger({ dev: false })
  assert.equal(logger.describeError(new Error('标准错误')), '标准错误')
  assert.equal(logger.describeError('字符串错误'), '字符串错误')
  assert.equal(logger.describeError({ message: '带 message 的对象' }), '带 message 的对象')
  assert.equal(logger.describeError({ code: 1 }), '{"code":1}')
  assert.equal(logger.describeError(null), 'null')

  const circular = {}
  circular.self = circular
  assert.ok(logger.describeError(circular).length > 0, '循环引用不能抛异常')
})
