import usageHtml from '@/content/legal/usage.html?raw'
import privacyHtml from '@/content/legal/privacy.html?raw'
import {
  LEGAL_DOC_KEYS,
  isLegalDocKey,
  legalDocPath,
  resolveLegalDocKey,
  type LegalDocKey,
} from './legalKeys'

/**
 * 平台声明（使用规范 / 隐私说明）。
 *
 * 正文以纯 HTML 维护在 `src/content/legal/*.html`，这里只做「取用」：
 *  - 通过 Vite 的 `?raw` 在构建期把正文内联进产物，运行时不再发请求；
 *  - 渲染统一走 `components/legal/LegalDocContent.vue`（DOMPurify 清洗后 v-html）；
 *  - 文档标识与路径这类纯逻辑放在 `legalKeys.ts`，便于 Node 单测。
 *
 * 新增一份声明只需三步：加一个 `.html` 正文、在 `legalKeys.ts` 的 `LEGAL_DOC_KEYS`
 * 与本文件的 `LEGAL_DOCS` 里登记、确认 `/legal/:doc` 能取到它。
 */

export interface LegalDoc {
  key: LegalDocKey
  /** 文档标题，用于弹窗标题、页签与页面标题。 */
  title: string
  /** 一句话摘要，用于入口按钮的辅助说明。 */
  summary: string
  /** 正文 HTML（本地静态资源，渲染前仍会过一遍 DOMPurify）。 */
  html: string
}

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  usage: {
    key: 'usage',
    title: '使用规范',
    summary: '账号、社区内容、AI 与在线判题的使用边界',
    html: usageHtml,
  },
  privacy: {
    key: 'privacy',
    title: '隐私说明',
    summary: '我们收集哪些信息、如何使用以及你享有的权利',
    html: privacyHtml,
  },
}

/** 供模板遍历使用的文档列表。 */
export const LEGAL_DOC_LIST: readonly LegalDoc[] = LEGAL_DOC_KEYS.map((key) => LEGAL_DOCS[key])

/**
 * 对外联系邮箱。
 *
 * 《隐私说明》正文里是静态 HTML 写死的，界面上的联系方式（帮助菜单、手机抽屉）统一引用
 * 这个常量，避免"改了一处漏一处"。tests/legal-docs.test.mjs 会比对两者，改错就红。
 */
export const LEGAL_CONTACT_EMAIL = '379299583@qq.com'

export { LEGAL_DOC_KEYS, isLegalDocKey, legalDocPath, resolveLegalDocKey }
export type { LegalDocKey }

export default LEGAL_DOCS
