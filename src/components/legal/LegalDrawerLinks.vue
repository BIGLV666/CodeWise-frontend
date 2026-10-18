<template>
  <!--
    手机档的「平台声明」入口，挂在各页导航抽屉（.cw-offcanvas）的最下面。

    为什么不复用导航栏那个「帮助」下拉：手机档右侧簇只剩几十像素，40px 的触屏目标会把
    搜索框压到几乎不可用（实测 375px 下 80px → 43px）。抽屉本来就是放"次要导航"的地方，
    把声明放这儿既省空间，也更符合用户预期。

    与 LegalHelpMenu 的分工：桌面（≥769px）看帮助菜单，手机（≤768px）看这里，
    两边的断点都由 .cw-only-phone（min-width:769px 隐藏）和 LegalHelpMenu 里的
    max-width:768px 决定，二者必须成对修改。
  -->
  <nav class="legal-drawer-links cw-only-phone" aria-label="平台声明" v-bind="attrs">
    <span class="legal-drawer-title">平台声明</span>
    <button
      v-for="doc in LEGAL_DOC_LIST"
      :key="doc.key"
      type="button"
      class="legal-drawer-link cw-tap"
      @click="open(doc.key)"
    >
      《{{ doc.title }}》
    </button>
    <span class="legal-drawer-mail">联系邮箱：{{ LEGAL_CONTACT_EMAIL }}</span>
  </nav>

  <LegalDocDialog v-model="visible" :doc="activeDoc" />
</template>

<script setup lang="ts">
import { ref, useAttrs } from 'vue'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOC_LIST,
  resolveLegalDocKey,
  type LegalDocKey,
} from '@/utils/legalDocs'
import LegalDocDialog from './LegalDocDialog.vue'

/** 多根组件不会自动继承 class/attrs，手动落到 <nav> 上（同 LegalNotice / LegalHelpMenu）。 */
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const visible = ref(false)
const activeDoc = ref<LegalDocKey>('usage')

function open(doc: LegalDocKey) {
  activeDoc.value = resolveLegalDocKey(doc)
  visible.value = true
}
</script>

<style scoped>
.legal-drawer-links {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--cw-border);
}

.legal-drawer-title {
  padding: 4px 12px;
  color: var(--cw-text-3);
  font-size: 12px;
  font-weight: 600;
}

.legal-drawer-link {
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--cw-text-2);
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.legal-drawer-link:hover,
.legal-drawer-link:focus-visible {
  background: var(--cw-bg-subtle);
  color: var(--cw-brand-deep);
}

.legal-drawer-mail {
  padding: 4px 12px;
  color: var(--cw-text-faint);
  font-size: 12px;
  word-break: break-all;
}
</style>
