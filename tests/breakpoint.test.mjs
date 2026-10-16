import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import { computed, ref } from 'vue'

/**
 * 断点档位的语义。
 *
 * useBreakpoint 依赖 useMediaQuery，后者在 vm 里用桩替换（本测试只关心档位推导逻辑），
 * 这样能把「≤768 是手机、769–1024 是平板、>1024 是桌面」这条约定固定下来 ——
 * 它与 styles/tokens.css 的断点文档、tests/responsive-contract.test.mjs 的白名单是三份互相印证的约定。
 */
const source = readFileSync(new URL('../src/composables/useBreakpoint.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

/** 用给定的命中集合构造 context，返回导出的 useBreakpoint/breakpointQuery/BREAKPOINTS。 */
function load(breakpointState) {
  const context = vm.createContext({
    exports: {},
    module: { exports: {} },
    computed,
    ref,
    useMediaQuery: (query) => ref(Boolean(breakpointState[query])),
  })
  vm.runInContext(compiled, context)
  // 只把需要的导出取回宿主 realm
  return {
    BREAKPOINTS: context.exports.BREAKPOINTS,
    breakpointQuery: context.exports.breakpointQuery,
    useBreakpoint: context.exports.useBreakpoint,
  }
}

test('BREAKPOINTS 只有 560/768/1024/1280 四档，且与样式层的白名单一致', () => {
  const { BREAKPOINTS } = load({})
  // vm 里造出来的对象原型属于另一个 realm，strict deepEqual 会连原型一起比，展开一次再断言
  assert.deepEqual({ ...BREAKPOINTS }, { narrowPhone: 560, phone: 768, tablet: 1024, wide: 1280 })
})

test('breakpointQuery 生成的查询串与档位一一对应', () => {
  const { breakpointQuery } = load({})
  assert.equal(breakpointQuery('narrowPhone'), '(max-width: 560px)')
  assert.equal(breakpointQuery('phone'), '(max-width: 768px)')
  assert.equal(breakpointQuery('tablet'), '(max-width: 1024px)')
  assert.equal(breakpointQuery('wide'), '(max-width: 1280px)')
})

test('375px：手机档，同时算「窄手机」而不是平板/桌面', () => {
  const { useBreakpoint } = load({
    '(max-width: 560px)': true,
    '(max-width: 768px)': true,
    '(max-width: 1024px)': true,
    '(max-width: 1280px)': true,
  })
  const bp = useBreakpoint()
  assert.equal(bp.isNarrowPhone.value, true)
  assert.equal(bp.isPhone.value, true)
  assert.equal(bp.isTablet.value, false, '≤768 不应被判成平板')
  assert.equal(bp.isDesktop.value, false)
  assert.equal(bp.isCompact.value, true)
})

test('1024px：平板档（不是手机，也不是桌面）', () => {
  const { useBreakpoint } = load({
    '(max-width: 560px)': false,
    '(max-width: 768px)': false,
    '(max-width: 1024px)': true,
    '(max-width: 1280px)': true,
  })
  const bp = useBreakpoint()
  assert.equal(bp.isPhone.value, false)
  assert.equal(bp.isTablet.value, true)
  assert.equal(bp.isDesktop.value, false)
})

test('1440px：桌面档', () => {
  const { useBreakpoint } = load({
    '(max-width: 560px)': false,
    '(max-width: 768px)': false,
    '(max-width: 1024px)': false,
    '(max-width: 1280px)': false,
  })
  const bp = useBreakpoint()
  assert.equal(bp.isPhone.value, false)
  assert.equal(bp.isTablet.value, false)
  assert.equal(bp.isDesktop.value, true)
  assert.equal(bp.isCompact.value, false)
})
