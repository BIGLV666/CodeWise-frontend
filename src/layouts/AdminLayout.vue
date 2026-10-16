<template>
  <div class="admin-layout" :class="{ collapsed }">
    <header class="admin-mobile-bar cw-only-phone">
      <MobileNavToggle purpose="sidebar" :open="nav.open.value" label="打开管理菜单" @toggle="nav.toggle" />
      <span class="mobile-bar-title">管理中心</span>
      <button class="mobile-bar-exit cw-tap" type="button" aria-label="退出登录" @click="logout">
        <el-icon><SwitchButton /></el-icon>
      </button>
    </header>

    <aside class="admin-sidebar cw-offcanvas" :class="{ collapsed, 'is-open': nav.open.value }">
      <header class="sidebar-header">
        <button class="brand-button" type="button" aria-label="返回首页" @click="goHome">
          <BrandLogo :size="28" :show-name="false" />
        </button>
        <transition name="fade">
          <span v-show="!collapsed" class="sidebar-title">管理中心</span>
        </transition>
        <button
          class="collapse-toggle"
          type="button"
          :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleCollapse"
        >
          <el-icon><component :is="collapsed ? DArrowRight : DArrowLeft" /></el-icon>
        </button>
      </header>

      <nav class="sidebar-nav" aria-label="管理功能导航">
        <button
          v-for="item in navItems"
          :key="item.path"
          type="button"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          @click="goAdminItem(item.path)"
        >
          <span class="nav-icon">
            <el-icon><component :is="item.icon" /></el-icon>
          </span>
          <transition name="fade">
            <span v-show="!collapsed" class="nav-label">{{ item.label }}</span>
          </transition>
        </button>
      </nav>

      <footer class="sidebar-footer">
        <button class="nav-item" type="button" @click="logout">
          <span class="nav-icon">
            <el-icon><SwitchButton /></el-icon>
          </span>
          <transition name="fade">
            <span v-show="!collapsed" class="nav-label">退出登录</span>
          </transition>
        </button>
      </footer>
    </aside>

    <div class="admin-main" :class="{ expanded: collapsed }">
      <router-view />
    </div>

    <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
  </div>
</template>

<script setup lang="ts">
/**
 * 管理后台外壳。
 *
 * 三档布局：
 *  - 桌面（>1024）：240px 侧栏，可手动收起成 72px 图标轨；
 *  - 平板（769–1024）：默认收成 72px 图标轨（仍可手动展开）；
 *  - 手机（≤768）：侧栏转成左侧抽屉（.cw-offcanvas），顶栏给一个汉堡按钮。
 *    抽屉里始终显示文字，所以手机档强制 collapsed = false。
 */
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DArrowLeft, DArrowRight, Files, MagicStick, Platform, DocumentChecked, ChatLineSquare, SwitchButton, User, Warning } from '@element-plus/icons-vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import MobileNavToggle from '@/components/layout/MobileNavToggle.vue'
import MobileNavBackdrop from '@/components/layout/MobileNavBackdrop.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useMobileNav } from '@/composables/useMobileNav'
import { navigateHome } from '@/utils/navigation'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const nav = useMobileNav()
const { isPhone, isTablet } = useBreakpoint()

// 平板默认收成图标轨；手机档侧栏是抽屉，需要显示文字，所以强制展开。
// 只在档位变化时重置，用户进来后的手动开合不会被覆盖。
watch(
  [isPhone, isTablet],
  ([phone, tablet]) => {
    collapsed.value = tablet && !phone
  },
  { immediate: true },
)

const navItems = [
  { path: '/admin/container-pool', label: '容器池', icon: Platform },
  { path: '/admin/failure-submits', label: '失败任务', icon: Warning },
  { path: '/admin/moderation', label: '内容审核', icon: DocumentChecked },
  { path: '/admin/appeals', label: '申诉管理', icon: ChatLineSquare },
  { path: '/admin/users', label: '用户治理', icon: User },
  { path: '/admin/questions/create', label: '普通题目', icon: DocumentChecked },
  { path: '/admin/questions/import/leetcode', label: '力扣导入', icon: Files },
  { path: '/admin/testcases', label: '测试点', icon: Files },
  { path: '/admin/artifact-generator', label: 'AI 出题', icon: MagicStick },
]

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const isActive = (path: string) => route.path === path
const goAdminItem = (path: string) => {
  nav.close()
  router.replace(path)
}

const goHome = () => {
  void navigateHome(router)
}

const logout = () => {
  localStorage.clear()
  router.push('/login')
}
</script>

<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh; min-height: 100dvh;
  min-height: 100dvh;
  background: var(--cw-bg-page);
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 手机档顶栏：只在 ≤768 出现（cw-only-phone 负责桌面隐藏） */
.admin-mobile-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 12px;
  background: var(--cw-bg-card);
  border-bottom: 1px solid var(--cw-border);
}

.mobile-bar-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--cw-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-bar-exit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--cw-text-3);
  cursor: pointer;
}

.admin-sidebar.collapsed ~ .admin-main {
  grid-column: 2;
}

.admin-sidebar {
  display: flex;
  min-width: 0;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--cw-border);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

.admin-sidebar.collapsed {
  width: 72px;
}

.admin-layout {
  grid-template-columns: 240px minmax(0, 1fr);
}

.admin-layout.collapsed {
  grid-template-columns: 72px minmax(0, 1fr);
}

.admin-sidebar.collapsed ~ .admin-main,
.admin-main.expanded {
  margin-left: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--cw-border);
  min-height: 68px;
}

.admin-sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 12px;
}

.brand-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: var(--cw-bg-page);
  color: #38bdf8;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.brand-button:hover {
  background: var(--cw-border);
}

.sidebar-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--cw-text-1);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.admin-sidebar.collapsed .sidebar-title {
  display: none;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--cw-text-3);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.collapse-toggle:hover {
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  color: var(--cw-text-3);
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  font-size: 14px;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--cw-bg-page);
  color: var(--cw-text-1);
}

.nav-item.active {
  background: var(--cw-brand-soft);
  color: var(--cw-brand-dark);
  font-weight: 600;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  font-size: 20px;
}

.nav-label {
  flex: 1;
  text-align: left;
  font-weight: 500;
}

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--cw-border);
}

.admin-main {
  overflow: auto;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.admin-sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 12px;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--cw-text-3);
}

@media (max-width: 768px) {
  /* 侧栏变成固定定位的抽屉后脱离网格流，主体只剩一列 */
  .admin-layout,
  .admin-layout.collapsed {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 抽屉模式下开合图标没有意义（抽屉里始终显示文字） */
  .collapse-toggle {
    display: none;
  }

  .admin-main {
    overflow: visible;
  }
}
</style>

