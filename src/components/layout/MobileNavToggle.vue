<template>
  <button
    class="mobile-nav-toggle cw-only-phone cw-tap"
    type="button"
    :data-nav-toggle="purpose"
    :aria-label="label"
    :aria-expanded="open"
    :aria-controls="controls"
    @click="emit('toggle')"
  >
    <el-icon :size="18"><component :is="icon" /></el-icon>
  </button>
</template>

<script setup lang="ts">
/**
 * 手机端抽屉触发器。桌面/平板档由 .cw-only-phone 自动隐藏，
 * 所以各页面可以无条件把它放进自己的顶栏。
 *
 * 同一页面上可能同时存在两个触发器（顶部导航的站点抽屉、页面自己的侧栏抽屉），
 * 所以这里带上 `data-nav-toggle` 便于测试区分，并允许各页换一个语义更贴切的图标
 * （例如题库页的筛选用漏斗、笔记页的文件夹用文件夹），避免两个相同的汉堡图标并排。
 */
import { Fold } from '@element-plus/icons-vue'
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    /** 抽屉是否已展开，用于 aria-expanded */
    open?: boolean
    /** 无障碍名称 */
    label?: string
    /** 被控制元素的 id（可选） */
    controls?: string
    /** 图标，默认是折叠箭头 */
    icon?: Component
    /**
     * 用途标记，渲染成 data-nav-toggle 供测试定位。
     * 同一页面可能同时有站点导航抽屉（nav）与页面侧栏抽屉（sidebar）两个触发器。
     */
    purpose?: 'nav' | 'sidebar'
  }>(),
  { open: false, label: '打开导航', controls: undefined, icon: Fold, purpose: 'nav' },
)

const emit = defineEmits<{ (event: 'toggle'): void }>()
</script>

<style scoped>
.mobile-nav-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--cw-border);
  border-radius: var(--cw-radius-sm);
  background: var(--cw-bg-card);
  color: var(--cw-text-2);
  cursor: pointer;
}

.mobile-nav-toggle:hover,
.mobile-nav-toggle:active {
  color: var(--cw-brand);
  border-color: var(--cw-brand-border);
  background: var(--cw-brand-soft);
}
</style>
