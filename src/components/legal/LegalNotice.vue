<template>
  <!--
    就地提示：在「内容即将公开」「代码即将发给 AI」的地方贴一句告知，并把对应声明做成可点入口。

    和 LegalHelpMenu 一样自带弹窗，调用方只提供文案：
      <LegalNotice text="评论对所有用户可见。" doc="usage" />
  -->
  <p class="legal-notice" v-bind="attrs">
    <el-icon class="legal-notice-icon"><InfoFilled /></el-icon>
    <span>
      {{ text }}
      <button type="button" class="legal-notice-link" @click="open">
        《{{ title }}》
      </button>
    </span>
  </p>

  <LegalDocDialog v-model="visible" :doc="doc" />
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { LEGAL_DOCS, resolveLegalDocKey, type LegalDocKey } from '@/utils/legalDocs'
import LegalDocDialog from './LegalDocDialog.vue'

/**
 * 本组件是「多根节点」（提示 + 弹窗），Vue 不会自动继承父级传下来的 class。
 * 调用方靠 class 把它塞进各处布局（.compose-notice / .comment-notice / .composer-notice），
 * 所以这里手动把 attrs 落到 <p> 上，否则那些定位样式会静默失效。
 */
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const props = withDefaults(
  defineProps<{
    /** 提示正文（不含书名号链接，链接由组件补）。 */
    text: string
    /** 点击链接要打开的声明。 */
    doc?: LegalDocKey
  }>(),
  { doc: 'usage' },
)

const visible = ref(false)
const title = computed(() => LEGAL_DOCS[resolveLegalDocKey(props.doc)].title)

function open() {
  visible.value = true
}
</script>

<style scoped>
.legal-notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 10px;
  color: var(--cw-text-3);
  font-size: 12px;
  line-height: 1.6;
}

.legal-notice-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 13px;
  color: var(--cw-text-faint);
}

.legal-notice-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--cw-brand-deep);
  font: inherit;
  cursor: pointer;
}

.legal-notice-link:hover,
.legal-notice-link:focus-visible {
  text-decoration: underline;
}
</style>
