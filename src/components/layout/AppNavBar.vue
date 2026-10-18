<template>
  <header class="app-navbar">
    <div class="navbar-left">
      <MobileNavToggle
        :open="nav.open.value"
        :controls="NAV_MENU_ID"
        label="打开主导航"
        @toggle="nav.toggle"
      />
      <button class="logo" type="button" aria-label="回到题库" @click="goHome">
        <BrandLogo :size="28" />
      </button>
      <nav
        :id="NAV_MENU_ID"
        class="nav-menu cw-offcanvas"
        :class="{ 'is-open': nav.open.value }"
        aria-label="主导航"
      >
        <div class="nav-drawer-head cw-only-phone">
          <span>导航</span>
          <button class="nav-drawer-close cw-tap" type="button" aria-label="收起导航" @click="nav.close">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <button
          v-for="item in NAV_ITEMS"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: active === item.key }"
          @click="item.go()"
        >
          {{ item.label }}
        </button>
        <LegalDrawerLinks />
      </nav>
    </div>

    <div class="navbar-right">
      <el-input
        v-if="showSearch"
        :model-value="search"
        class="search-input"
        placeholder="搜索题目..."
        size="small"
        :prefix-icon="Search"
        clearable
        @update:model-value="onSearchInput"
      />
      <slot name="actions" />
      <LegalHelpMenu class="cw-hide-phone" />
      <InboxButton v-if="active !== 'inbox'" />
      <el-button
        v-if="userStore.isAdmin"
        type="primary"
        :icon="Tools"
        circle
        title="管理后台"
        @click="goAdmin"
      />
      <button class="avatar-entry" type="button" aria-label="进入个人主页" @click="goProfile">
        <el-avatar :size="32" :src="avatarUrl">{{ avatarText }}</el-avatar>
      </button>
    </div>
  </header>

  <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
</template>

<script setup lang="ts">
/**
 * 全站统一的顶部导航栏。
 *
 * 结构固定：品牌 logo + 五个导航项（题库/竞赛/讨论/复习/Agent）+ 右侧簇
 * （可选搜索框、页面自定义动作 slot、收件箱、管理员入口、头像个人主页入口）。
 * 页面通过 `active` 声明当前高亮的导航项；`showSearch` + `v-model:search`
 * 控制搜索框（题库/收藏类页面使用）；页面特有的控件（如收件箱页的刷新）
 * 放进 `actions` 插槽。头像与管理员入口组件内部自行读取用户 store，无需各页传递。
 *
 * 手机档：导航项从横向导航条切换为左侧抽屉（.cw-offcanvas，见 responsive.css），
 * 由左侧汉堡按钮开合。抽屉复用同一份 nav 标记，不复制 DOM。
 * 收件箱/管理员/头像仍留在顶栏，所以窄屏也能一键到达。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Close, Search, Tools } from '@element-plus/icons-vue'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import LegalDrawerLinks from '@/components/legal/LegalDrawerLinks.vue'
import LegalHelpMenu from '@/components/legal/LegalHelpMenu.vue'
import InboxButton from '@/components/notification/InboxButton.vue'
import MobileNavToggle from '@/components/layout/MobileNavToggle.vue'
import MobileNavBackdrop from '@/components/layout/MobileNavBackdrop.vue'
import { useMobileNav } from '@/composables/useMobileNav'
import { navigateTopLevel } from '@/utils/navigation'
import { normalizeAvatarUrl } from '@/utils/avatar'
import { useUserStore } from '@/stores/User'

const props = defineProps<{
  /** 当前高亮的导航项：home | contest | discuss | review | agent | inbox */
  active?: string
  /** 是否显示搜索框（题库/收藏类页面使用）。 */
  showSearch?: boolean
  /** 搜索关键字（配合 v-model:search 使用）。 */
  search?: string
}>()

const emit = defineEmits<{
  (event: 'update:search', value: string): void
  /** 输入/清空时同步触发，供需要即时过滤的页面监听。 */
  (event: 'search', value: string): void
}>()

const NAV_MENU_ID = 'app-nav-menu'

const NAV_ITEMS = [
  { key: 'home', label: '题库', go: () => goHome() },
  { key: 'contest', label: '竞赛', go: () => {} },
  { key: 'discuss', label: '讨论', go: () => navigate('discuss') },
  { key: 'review', label: '复习', go: () => navigate('review') },
  { key: 'agent', label: 'Agent', go: () => navigate('agent') },
] as const

const router = useRouter()
const userStore = useUserStore()
const nav = useMobileNav()

const goHome = () => navigateTopLevel(router, '/home')
const navigate = (path: string) => navigateTopLevel(router, `/${path}`)
const goAdmin = () => router.push('/admin')
const goProfile = () => navigateTopLevel(router, '/profile')

const avatarUrl = computed(() => normalizeAvatarUrl(userStore.getAvatarUrl || ''))
const avatarText = computed(() => (userStore.getUsername || 'CW').slice(0, 2).toUpperCase())

function onSearchInput(value: string) {
  emit('update:search', value)
  emit('search', value)
}
</script>

<style scoped>
.app-navbar {
  height: 58px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--cw-border);
}

.navbar-left,
.navbar-right,
.nav-menu {
  display: flex;
  align-items: center;
}

.navbar-left {
  gap: 32px;
  min-width: 0;
}

.navbar-right {
  gap: 14px;
  min-width: 0;
}

.logo {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.nav-menu {
  gap: 4px;
}

.nav-menu button {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.nav-item {
  padding: 7px 15px;
  color: var(--cw-text-2);
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-item:hover,
.nav-item.active {
  color: var(--cw-brand);
  background: var(--cw-brand-soft);
}

.search-input {
  width: 180px;
  /* 允许收缩：平板/窄屏下导航项与右侧簇会挤压搜索框，而不是把它顶破 */
  flex: 0 1 180px;
  min-width: 88px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: var(--cw-bg-page);
}

.avatar-entry {
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

/* 平板档：收窄留白与导航项内边距，避免 769–900px 区间横向溢出 */
@media (max-width: 1024px) {
  .app-navbar {
    padding: 0 18px;
  }

  .navbar-left {
    gap: 18px;
  }

  .navbar-right {
    gap: 10px;
  }

  .nav-item {
    padding: 7px 11px;
  }

  .search-input {
    width: 150px;
    flex: 0 1 150px;
  }
}

@media (max-width: 768px) {
  .app-navbar {
    padding: 0 12px;
    gap: 8px;
  }

  .navbar-left {
    gap: 10px;
    flex: 1 1 auto;
  }

  .navbar-right {
    gap: 6px;
    flex: 0 1 auto;
    justify-content: flex-end;
  }

  .search-input {
    width: auto;
    flex: 1 1 56px;
    min-width: 0;
  }
}
</style>
