import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// 与 tests/judge-contract.test.mjs 同一套路：读源码 → 转译 → 在 vm 里跑，
// 这样不需要引入 vitest/jsdom 就能测纯逻辑。
// 注意：源文件里有 export，转译后会生成 CJS 风格的 exports 赋值，所以上下文要备好 exports，
// 不能像 judge 那个测试那样只靠 globalThis（那边是 scriptSetup，没有 export 语句）。
const source = readFileSync(new URL('../src/utils/aiModelSelection.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

const context = vm.createContext({ exports: {}, module: { exports: {} } })
vm.runInContext(compiled, context)
const buildAiModelParams = context.exports.buildAiModelParams
assert.equal(typeof buildAiModelParams, 'function', '未取到 buildAiModelParams，检查转译产物')

// vm 里造出来的对象原型属于另一个 realm，assert/strict 的 deepEqual 会连原型一起比，
// 直接比必挂——展开一次把它变回本 realm 的普通对象再断言。
const params = (selection) => ({ ...buildAiModelParams(selection) })

test('AUTO：两个参数都不传，后端才走平台轮转', () => {
  assert.deepEqual(params({}), {})
  assert.deepEqual(params({ modelName: '' }), {})
  assert.deepEqual(params({ modelName: '   ' }), {})
})

test('平台指定模型：只传 modelName，绝不能带 userAiConfigId', () => {
  // 带上 configId 会让后端当成"用户选了分组"，AUTO 之外的这条也会走错路
  assert.deepEqual(params({ modelName: 'glm-5.3' }), { modelName: 'glm-5.3' })
  assert.equal(
    Object.prototype.hasOwnProperty.call(params({ modelName: 'glm-5.3' }), 'userAiConfigId'),
    false,
  )
})

test('用户分组：两个都传，模型名两端去空白', () => {
  assert.deepEqual(
    params({ userConfigId: 7, modelName: 'glm-4-air' }),
    { modelName: 'glm-4-air', userAiConfigId: 7 },
  )
  assert.deepEqual(
    params({ userConfigId: 7, modelName: '  glm-4-air  ' }),
    { modelName: 'glm-4-air', userAiConfigId: 7 },
  )
})

test('只选了分组没选模型：如实透传 configId，让后端报错而不是前端替用户选', () => {
  // 前端正常流程产生不了这个组合；真出现时后端会回 MODEL_ARGS_INCOMPLETE（4000610），
  // 比"前端悄悄丢掉 configId 走成 AUTO"更容易定位
  assert.deepEqual(params({ userConfigId: 7 }), { userAiConfigId: 7 })
})
