import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import markedKatex from 'marked-katex-extension'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import { logWarn } from '@/utils/logger'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c++', cpp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)

const markdown = new Marked(
  {
    gfm: true,
    breaks: true,
  },
  markedKatex({
    throwOnError: false,
    nonStandard: false,
  }),
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, language) {
      const normalizedLanguage = hljs.getLanguage(language) ? language : 'plaintext'
      return hljs.highlight(code, { language: normalizedLanguage }).value
    },
  }),
)

function sanitizeHtml(html: string) {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
  })
  const documentNode = new DOMParser().parseFromString(sanitized, 'text/html')
  documentNode.body.querySelectorAll('*').forEach((element) => {
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
    if (element.tagName === 'IMG') {
      element.setAttribute('loading', 'lazy')
      element.setAttribute('decoding', 'async')
    }
  })
  return documentNode.body.innerHTML
}

export function renderMarkdown(source: string) {
  try {
    return sanitizeHtml(String(markdown.parse(source || '')))
  } catch (error) {
    logWarn('Markdown 渲染失败:', error)
    return '<p>Markdown 预览暂时无法渲染，请检查公式或代码块是否完整。</p>'
  }
}
