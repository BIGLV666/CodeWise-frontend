/**
 * 平台声明的「纯逻辑」部分：文档标识与路径。
 *
 * 单独拆出来是为了能在 Node 里直接单测（不碰 `?raw` 资源导入，也不依赖 DOM）；
 * 正文本身与展示元数据在 `legalDocs.ts`。
 */

/** 声明文档标识，同时也是 `/legal/:doc` 的路由参数。 */
export type LegalDocKey = 'usage' | 'privacy'

/** 文档展示顺序。 */
export const LEGAL_DOC_KEYS: readonly LegalDocKey[] = ['usage', 'privacy']

export function isLegalDocKey(value: unknown): value is LegalDocKey {
  return typeof value === 'string' && (LEGAL_DOC_KEYS as readonly string[]).includes(value)
}

/** 把任意输入（路由参数、DOM 属性）收敛成一个合法文档标识，非法时回落到使用规范。 */
export function resolveLegalDocKey(value: unknown): LegalDocKey {
  return isLegalDocKey(value) ? value : 'usage'
}

/** 独立页的路径，供入口链接与跨文档跳转复用。 */
export function legalDocPath(key: LegalDocKey): string {
  return `/legal/${key}`
}
