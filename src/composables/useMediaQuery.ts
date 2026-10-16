import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

/**
 * 响应式媒体查询。
 *
 * 只负责「某个 media query 是否命中」，不含任何断点语义；
 * 断点语义统一走 useBreakpoint。组件卸载时自动移除监听，
 * 所以不需要各页面自己写 addEventListener/removeEventListener 配对。
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const matches = ref(false)

  if (!supported) return matches

  const mediaQueryList = window.matchMedia(query)
  matches.value = mediaQueryList.matches

  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }

  mediaQueryList.addEventListener('change', onChange)
  // 在 setup 之外调用（如工具函数）时没有作用域可挂载，这里不强行注册清理。
  if (getCurrentScope()) {
    onScopeDispose(() => mediaQueryList.removeEventListener('change', onChange))
  }

  return matches
}
