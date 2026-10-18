<template>
  <!--
    声明正文渲染器：唯一负责「把 HTML 正文变成页面」的地方，弹窗与独立页共用。

    - v-html 前统一过 DOMPurify：正文虽然来自本地静态文件，但保持与 markdown 一致的
      安全策略，避免以后有人把外部内容塞进同一通道；
    - 正文里的跨文档链接写成 `data-legal="usage|privacy"`，这里拦截点击并 emit，
      由外层决定是「弹窗内切换」还是「路由跳转」。
  -->
  <div class="legal-doc-content" @click="onContentClick" v-html="safeHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { LEGAL_DOCS, isLegalDocKey, type LegalDocKey } from '@/utils/legalDocs'

const props = defineProps<{ doc: LegalDocKey }>()

const emit = defineEmits<{ (event: 'navigate', key: LegalDocKey): void }>()

const safeHtml = computed(() =>
  DOMPurify.sanitize(LEGAL_DOCS[props.doc].html, { USE_PROFILES: { html: true } }),
)

/** 点击正文里的声明内链 → 交给外层切换文档，避免整页刷新。 */
function onContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest('a[data-legal]')
  if (!link) return
  event.preventDefault()
  const key = link.getAttribute('data-legal')
  if (isLegalDocKey(key)) emit('navigate', key)
}
</script>

<style scoped>
.legal-doc-content {
  color: var(--cw-text-2);
  font-size: 14px;
  line-height: 1.75;
}

/* 正文里的盒子一律 border-box：下面给 td/tr 设了 width:100%，不统一盒模型就会
   因为 1px 边框多出 2px，在 375px 上直接变成横向溢出（响应式矩阵会抓）。 */
.legal-doc-content,
.legal-doc-content :deep(*) {
  box-sizing: border-box;
}

.legal-doc-content :deep(.legal-doc__meta) {
  margin: 0 0 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--cw-border);
  color: var(--cw-text-3);
  font-size: 12px;
}

.legal-doc-content :deep(section) {
  margin-bottom: 22px;
}

.legal-doc-content :deep(h2) {
  margin: 0 0 10px;
  color: var(--cw-text-1);
  font-size: 15px;
  font-weight: 600;
}

.legal-doc-content :deep(p) {
  margin: 0 0 10px;
}

.legal-doc-content :deep(p:last-child) {
  margin-bottom: 0;
}

.legal-doc-content :deep(ul),
.legal-doc-content :deep(ol) {
  margin: 0 0 10px;
  padding-left: 22px;
}

.legal-doc-content :deep(li) {
  margin-bottom: 6px;
}

.legal-doc-content :deep(li:last-child) {
  margin-bottom: 0;
}

.legal-doc-content :deep(strong) {
  color: var(--cw-text-1);
  font-weight: 600;
}

.legal-doc-content :deep(a) {
  color: var(--cw-brand-dark);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
  cursor: pointer;
}

.legal-doc-content :deep(a:hover),
.legal-doc-content :deep(a:focus-visible) {
  color: var(--cw-brand-deep);
}

/* 表格固定布局：窄屏下让三列自己换行，绝不把弹窗/页面撑出横向滚动 */
.legal-doc-content :deep(table) {
  width: 100%;
  margin: 0 0 12px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.legal-doc-content :deep(th),
.legal-doc-content :deep(td) {
  padding: 8px 10px;
  border: 1px solid var(--cw-border);
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}

.legal-doc-content :deep(th) {
  background: var(--cw-bg-subtle);
  color: var(--cw-text-1);
  font-weight: 600;
}

@media (max-width: 560px) {
  .legal-doc-content {
    font-size: 13px;
  }

  .legal-doc-content :deep(th),
  .legal-doc-content :deep(td) {
    padding: 6px 8px;
  }

  /* 窄屏下三列固定布局会挤成每列 80px，读起来很糟。
     这里把每一行转成一张小卡片：首列当标题，其余两行顺序列出。 */
  .legal-doc-content :deep(thead) {
    display: none;
  }

  .legal-doc-content :deep(table),
  .legal-doc-content :deep(tbody),
  .legal-doc-content :deep(tr),
  .legal-doc-content :deep(td) {
    display: block;
    width: 100%;
  }

  .legal-doc-content :deep(tr) {
    margin-bottom: 10px;
    border: 1px solid var(--cw-border);
    border-radius: var(--cw-radius-sm);
    overflow: hidden;
  }

  .legal-doc-content :deep(td) {
    border: 0;
    border-top: 1px solid var(--cw-border);
    padding: 7px 10px;
  }

  .legal-doc-content :deep(td:first-child) {
    border-top: 0;
    background: var(--cw-bg-subtle);
    color: var(--cw-text-1);
    font-weight: 600;
  }
}
</style>
