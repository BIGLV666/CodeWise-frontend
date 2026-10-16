import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * 为 E2E 构建前端产物。
 *
 * 唯一特殊之处：把 `VITE_AGENT_BASE_URL` 设为 `/agentapi`（与生产 nginx 一致），
 * 这样 Agent 请求与其它接口同源，都能被 tests/e2e/stub-server.mjs 拦下来。
 * 用 Node 设置环境变量而不是 shell 前缀，避免 Windows / Linux 写法差异。
 */
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const viteBin = join(projectRoot, 'node_modules', '.bin', 'vite')

if (!existsSync(viteBin)) {
  console.error(`找不到 vite 可执行文件：${viteBin}，请先安装依赖`)
  process.exit(1)
}

const child = spawn(viteBin, ['build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, VITE_AGENT_BASE_URL: '/agentapi' },
})

child.on('exit', (code) => process.exit(code ?? 1))
