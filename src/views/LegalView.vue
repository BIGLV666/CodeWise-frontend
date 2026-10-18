<template>
  <!--
    声明独立页 `/legal/:doc`。

    存在意义：
    - 未登录也能直达（路由已加入公开路径白名单），注册页/登录页的链接可以放心给出真实地址；
    - 可以直接把链接发给别人，或从站外跳转过来，不依赖弹窗；
    - 与弹窗共用 LegalDocContent，正文只有一份，不会出现「弹窗和页面文案不一致」。
  -->
  <div class="legal-page">
    <header class="legal-topbar">
      <button type="button" class="legal-brand" aria-label="回到 CodeWise" @click="goHome">
        <BrandLogo :size="28" />
      </button>

      <nav class="legal-tabs" aria-label="平台声明">
        <button
          v-for="doc in LEGAL_DOC_LIST"
          :key="doc.key"
          type="button"
          class="legal-tab"
          :class="{ active: doc.key === activeKey }"
          :aria-current="doc.key === activeKey ? 'page' : undefined"
          @click="switchDoc(doc.key)"
        >
          {{ doc.title }}
        </button>
      </nav>

      <button type="button" class="legal-back" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回</span>
      </button>
    </header>

    <main class="legal-shell">
      <article class="legal-panel">
        <h1>{{ activeDoc.title }}</h1>
        <p class="legal-panel__summary">{{ activeDoc.summary }}</p>
        <LegalDocContent :doc="activeKey" @navigate="switchDoc" />
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import LegalDocContent from '@/components/legal/LegalDocContent.vue'
import {
  LEGAL_DOCS,
  LEGAL_DOC_LIST,
  resolveLegalDocKey,
  type LegalDocKey,
} from '@/utils/legalDocs'

const route = useRoute()
const router = useRouter()

const activeKey = ref<LegalDocKey>(resolveLegalDocKey(route.params.doc))

const activeDoc = computed(() => LEGAL_DOCS[activeKey.value])

watch(
  () => route.params.doc,
  (doc) => {
    activeKey.value = resolveLegalDocKey(doc)
  },
)

/** 切文档只改 URL 参数，不重新挂载页面（正文切换是即时且可分享的）。 */
function switchDoc(key: LegalDocKey) {
  if (key === activeKey.value) return
  activeKey.value = key
  void router.replace({ name: 'legal', params: { doc: key } })
}

/** 有来路就返回，直接打开的（站外分享、新标签）回登录页。 */
function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.push('/login')
}

function goHome() {
  void router.push('/home')
}
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
}

.legal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: var(--cw-navbar-height);
  padding: 0 var(--cw-page-gutter);
  border-bottom: 1px solid var(--cw-border);
  background: var(--cw-bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
}

.legal-brand {
  display: flex;
  align-items: center;
  min-height: var(--cw-tap-target);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.legal-tabs {
  display: flex;
  gap: 8px;
}

.legal-tab {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--cw-text-2);
  font-size: 13px;
  cursor: pointer;
}

.legal-tab:hover,
.legal-tab:focus-visible {
  color: var(--cw-brand-deep);
}

.legal-tab.active {
  border-color: var(--cw-brand-border);
  background: var(--cw-brand-soft);
  color: var(--cw-brand-deep);
  font-weight: 600;
}

.legal-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--cw-tap-target);
  padding: 0 10px;
  border: 0;
  border-radius: var(--cw-radius-sm);
  background: transparent;
  color: var(--cw-text-2);
  font-size: 13px;
  cursor: pointer;
}

.legal-back:hover,
.legal-back:focus-visible {
  color: var(--cw-brand-deep);
}

.legal-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 28px var(--cw-page-gutter) 64px;
}

.legal-panel {
  padding: 32px 36px 36px;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius-lg);
  background: var(--cw-bg-card);
  box-shadow: var(--cw-shadow-card);
}

.legal-panel h1 {
  margin: 0 0 6px;
  color: var(--cw-text-1);
  font-size: 22px;
  font-weight: 600;
}

.legal-panel__summary {
  margin: 0 0 20px;
  color: var(--cw-text-3);
  font-size: 13px;
}

@media (max-width: 768px) {
  .legal-topbar {
    flex-wrap: wrap;
    height: auto;
    padding: 10px var(--cw-page-gutter);
  }

  .legal-tabs {
    order: 3;
    width: 100%;
  }

  .legal-tab {
    flex: 1;
  }

  .legal-panel {
    padding: 22px 18px 26px;
  }

  .legal-panel h1 {
    font-size: 19px;
  }
}
</style>
