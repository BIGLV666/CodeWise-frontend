import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from './useMediaQuery'
import { breakpointQuery } from './useBreakpoint'

/**
 * 手机端抽屉开关状态。
 *
 * 配合全局样式 `.cw-offcanvas` / `.cw-offcanvas-backdrop` 使用：
 *   <aside class="my-sidebar cw-offcanvas" :class="{ 'is-open': nav.open.value }">…</aside>
 *   <MobileNavToggle :open="nav.open.value" @toggle="nav.toggle" />
 *   <MobileNavBackdrop v-if="nav.open.value" @close="nav.close" />
 *
 * 这里集中处理两件容易漏的事：回到桌面档位时收起（避免遮罩留在桌面上），
 * 以及路由切换时收起（否则跳转后抽屉仍然盖着新页面）。
 */
export function useMobileNav() {
  const open = ref(false)
  const route = useRoute()
  const isPhone = useMediaQuery(breakpointQuery('phone'))

  const close = () => {
    open.value = false
  }

  const toggle = () => {
    open.value = !open.value
  }

  watch(isPhone, (value) => {
    if (!value) close()
  })

  watch(() => route.fullPath, close)

  onBeforeUnmount(close)

  return { open, toggle, close }
}
