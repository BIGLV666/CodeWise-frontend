import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { test } from 'node:test'

/**
 * 响应式与日志的「合同」静态守卫。
 *
 * 这些规则本身很琐碎，但靠人眼在 40 多个文件里守住不现实，用测试锁死最便宜：
 *  1. src/ 里不允许出现裸 console（统一走 utils/logger，生产静默）；
 *  2. 媒体查询只允许用 560 / 768 / 1024 / 1280 四档语义断点；
 *  3. 每个 100vh 必须配一个 100dvh（移动端地址栏收放会把底部内容顶出视口）。
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(projectRoot, 'src')

/** 允许直接使用 console 的文件：日志实现自身。 */
const CONSOLE_WHITELIST = new Set(['utils/logger.ts', 'utils/globalErrorHandler.ts'])

/** 媒体查询允许的宽度档位（见 src/styles/tokens.css 的断点说明）。 */
const ALLOWED_MAX_WIDTHS = new Set([560, 768, 1024, 1280])
/** 与 phone 档配套的 min-width（隐藏手机专用元素时用 769）。 */
const ALLOWED_MIN_WIDTHS = new Set([769])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

const files = walk(srcDir)
const sources = new Map(files.map((path) => [path, readFileSync(path, 'utf8')]))
const relative = (path) => path.slice(srcDir.length + 1).replace(/\\/g, '/')

test('src/ 里不允许裸 console（统一走 utils/logger）', () => {
  const offenders = []
  for (const [path, source] of sources) {
    if (CONSOLE_WHITELIST.has(relative(path))) continue
    source.split('\n').forEach((line, index) => {
      if (/\bconsole\.(log|warn|error|debug|info)\s*\(/.test(line)) {
        offenders.push(`${relative(path)}:${index + 1}  ${line.trim()}`)
      }
    })
  }
  assert.deepEqual(offenders, [], `发现裸 console 调用：\n${offenders.join('\n')}`)
})

test('媒体查询只允许 560/768/1024/1280 四档断点', () => {
  const offenders = []
  for (const [path, source] of sources) {
    // 只看样式：.vue 的 <style> 块与 .css 文件；脚本里的字符串不参与
    const cssChunks = []
    if (path.endsWith('.css')) cssChunks.push(source)
    else if (path.endsWith('.vue')) {
      for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) cssChunks.push(match[1])
    } else continue

    for (const chunk of cssChunks) {
      for (const match of chunk.matchAll(/@media[^{]*?\((min|max)-width:\s*(\d+)px\)/g)) {
        const kind = match[1]
        const value = Number(match[2])
        const allowed = kind === 'max' ? ALLOWED_MAX_WIDTHS : ALLOWED_MIN_WIDTHS
        if (!allowed.has(value)) {
          offenders.push(`${relative(path)}  @media (${kind}-width: ${value}px)`)
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `媒体查询断点超出白名单（用 560/768/1024/1280，见 tokens.css）：\n${offenders.join('\n')}`,
  )
})

test('height: 100vh 必须同时给出 100dvh', () => {
  const offenders = []
  for (const [path, source] of sources) {
    if (!path.endsWith('.vue') && !path.endsWith('.css')) continue
    if (!source.includes('100vh')) continue

    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (!/(height|min-height|max-height):\s*calc\(100vh|(?<![\w-])100vh/.test(line)) return
      // 同一声明块（向后最多 6 行）里必须出现 dvh 兜底
      const window = lines.slice(index, index + 7).join('\n')
      if (!window.includes('dvh')) {
        offenders.push(`${relative(path)}:${index + 1}  ${line.trim()}`)
      }
    })
  }
  assert.deepEqual(
    offenders,
    [],
    `以下 100vh 缺少 100dvh 兜底（移动端地址栏会顶出底部内容）：\n${offenders.join('\n')}`,
  )
})
