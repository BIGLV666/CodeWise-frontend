import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

/**
 * 请求层两个纯工具的语义。
 *
 * request.ts 里有 axios / ElMessage / router 等副作用依赖，但 errorText 与 isLocalFailure
 * 本身只用参数，所以沿用「去掉 import 行后转译进 vm」的套路单独测这两个函数。
 */
const fullSource = readFileSync(new URL('../src/api/request.ts', import.meta.url), 'utf8')
// 整文件里有 axios.create / 拦截器等顶层副作用，在 vm 里跑不起来；
// 这里只截取两个纯函数（errorText / isLocalFailure）的源码。
const start = fullSource.indexOf('export function errorText')
const end = fullSource.indexOf('// 导出常用请求方法')
assert.ok(start > 0 && end > start, '未能从 request.ts 中截取到 errorText / isLocalFailure')
const source = fullSource.slice(start, end)
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

const context = vm.createContext({ exports: {}, module: { exports: {} } })
vm.runInContext(compiled, context)
const { errorText, isLocalFailure } = context.exports

/**
 * 在 vm 的 realm 里造 Error：宿主 new 出来的 Error 过不了 vm 内的 instanceof 判断，
 * 而 errorText 正是靠 instanceof 区分「本地异常」与「axios 错误」。
 */
const makeError = (message) => vm.runInContext(`new Error(${JSON.stringify(message)})`, context)

test('errorText：优先后端 message（那本身就是写给用户看的）', () => {
  const axiosLike = { response: { data: { message: '题目不存在' } } }
  assert.equal(errorText(axiosLike, '兜底'), '题目不存在')
})

test('errorText：丢弃 axios 的英文技术信息，用兜底文案', () => {
  const axiosError = new Error('Request failed with status code 502')
  axiosError.isAxiosError = true
  assert.equal(errorText(axiosError, '服务暂时无法连接'), '服务暂时无法连接')
})

test('errorText：本地 Error 的 message 可以透出', () => {
  assert.equal(errorText(makeError('创建请求 ID 获取失败'), '兜底'), '创建请求 ID 获取失败')
  assert.equal(errorText(undefined, '兜底'), '兜底')
  assert.equal(errorText({ response: { data: { message: '   ' } } }, '兜底'), '兜底')
})

test('isLocalFailure：本地 throw 才算本地失败', () => {
  // 页面自己 throw 的（不经过拦截器）→ 页面必须自己提示
  assert.equal(isLocalFailure(new Error('requestId 获取失败')), true)

  // 网络失败：axios 错误 → 拦截器已提示
  const axiosError = new Error('offline')
  axiosError.isAxiosError = true
  assert.equal(isLocalFailure(axiosError), false)

  // 业务码失败：拦截器把它换成了带 bizCode 的 Error → 拦截器已提示
  const bizError = new Error('操作太频繁')
  bizError.bizCode = 4290001
  assert.equal(isLocalFailure(bizError), false)

  // 兜底：非对象按本地失败处理，避免用户什么都看不到
  assert.equal(isLocalFailure('boom'), true)
  assert.equal(isLocalFailure(null), true)
})
