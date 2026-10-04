import type { RouteLocationRaw, Router } from 'vue-router'

export type TopLevelPath = '/home' | '/review' | '/discuss' | '/favorites' | '/inbox' | '/profile' | '/agent'

function getTargetPath(router: Router, target: RouteLocationRaw) {
  return router.resolve(target).path
}

function isHomeHistoryEntry(entry: unknown) {
  if (typeof entry !== 'string' || !entry) return false
  try {
    return new URL(entry, window.location.origin).pathname === '/home'
  } catch {
    return entry.split(/[?#]/, 1)[0] === '/home'
  }
}

/**
 * 回到主页时优先弹出当前模块，让主页重新成为当前历史项。
 * 不能使用 replace('/home') 代替 pop，否则会生成“主页 -> admin -> 主页”，
 * 后续从 Agent、收藏等页面后退时就会再次落到 admin。
 */
export function navigateHome(router: Router) {
  if (router.currentRoute.value.path === '/home') return Promise.resolve()

  if (isHomeHistoryEntry(window.history.state?.back)) {
    router.back()
    return Promise.resolve()
  }

  return router.replace('/home')
}

/**
 * 主页是页面栈基线：主页进入模块使用 push；模块之间切换使用 replace。
 * 最终始终保持“主页 -> 当前模块”，不会把 admin 留在返回路径里。
 */
export function navigateTopLevel(router: Router, target: TopLevelPath | RouteLocationRaw) {
  const currentRoute = router.currentRoute.value
  const targetPath = getTargetPath(router, target)

  if (currentRoute.path === targetPath) return Promise.resolve()
  if (targetPath === '/home') return navigateHome(router)

  return currentRoute.path === '/home'
    ? router.push(target)
    : router.replace(target)
}

/** 优先弹出真实历史记录；只有直接打开页面时才使用兜底地址。 */
export function navigateBack(router: Router, fallback: RouteLocationRaw = '/home') {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.replace(fallback)
}
