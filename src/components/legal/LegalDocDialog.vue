<template>
  <!--
    声明弹窗：登录页 / 注册页 / 忘记密码 / 个人主页共用同一个入口组件。

    设计取舍：
    - 内容与独立页 `/legal/:doc` 完全同源（LegalDocContent + utils/legalDocs），不存在两份文案；
    - 弹窗内可切换使用规范 / 隐私说明，用户不会因为点错文档而被关掉、丢掉当前上下文；
    - 用 append-to-body：登录注册页有自己的全屏背景层，挂在 body 上才不会被盖住。
  -->
  <el-dialog
    v-model="visible"
    class="legal-dialog"
    width="720px"
    append-to-body
    align-center
    :title="activeDoc.title"
    :aria-label="`${activeDoc.title}（平台声明）`"
  >
    <div class="legal-dialog-tabs" role="tablist" aria-label="声明文档切换">
      <button
        v-for="doc in LEGAL_DOC_LIST"
        :key="doc.key"
        type="button"
        role="tab"
        class="legal-dialog-tab"
        :class="{ active: doc.key === activeKey }"
        :aria-selected="doc.key === activeKey"
        @click="switchDoc(doc.key)"
      >
        {{ doc.title }}
      </button>
    </div>

    <div ref="scrollRef" class="legal-dialog-body">
      <LegalDocContent :doc="activeKey" @navigate="switchDoc" />
    </div>

    <template #footer>
      <div class="legal-dialog-footer">
        <span class="legal-dialog-hint">{{ activeDoc.summary }}</span>
        <el-button type="primary" @click="visible = false">我已知悉</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { LEGAL_DOCS, LEGAL_DOC_LIST, resolveLegalDocKey, type LegalDocKey } from '@/utils/legalDocs'
import LegalDocContent from './LegalDocContent.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 打开时默认展示的文档。 */
    doc?: LegalDocKey
  }>(),
  { doc: 'usage' },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()

const scrollRef = ref<HTMLElement | null>(null)
const activeKey = ref<LegalDocKey>(resolveLegalDocKey(props.doc))

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const activeDoc = computed(() => LEGAL_DOCS[activeKey.value])

// 每次打开都回到调用方指定的那一份，避免上次切换过的文档「粘」到下一个入口。
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    activeKey.value = resolveLegalDocKey(props.doc)
    void nextTick(resetScroll)
  },
)

function resetScroll() {
  if (scrollRef.value) scrollRef.value.scrollTop = 0
}

function switchDoc(key: LegalDocKey) {
  if (key === activeKey.value) return
  activeKey.value = key
  void nextTick(resetScroll)
}
</script>

<style scoped>
.legal-dialog-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--cw-border);
}

.legal-dialog-tab {
  padding: 6px 14px;
  border: 1px solid var(--cw-border);
  border-radius: 999px;
  background: var(--cw-bg-card);
  color: var(--cw-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.legal-dialog-tab:hover,
.legal-dialog-tab:focus-visible {
  border-color: var(--cw-brand-border);
  color: var(--cw-brand-deep);
}

.legal-dialog-tab.active {
  border-color: var(--cw-brand);
  background: var(--cw-brand-soft);
  color: var(--cw-brand-deep);
  font-weight: 600;
}

.legal-dialog-body {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 6px;
}

.legal-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.legal-dialog-hint {
  color: var(--cw-text-3);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
}

@media (max-width: 768px) {
  .legal-dialog-body {
    max-height: 56vh;
  }

  .legal-dialog-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .legal-dialog-hint {
    text-align: center;
  }
}
</style>
