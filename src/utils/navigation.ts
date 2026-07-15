import type { Router } from 'vue-router'

export type TopLevelPath = '/home' | '/review' | '/discuss' | '/favorites' | '/inbox' | '/profile'

export function navigateTopLevel(router: Router, path: TopLevelPath) {
  const currentPath = router.currentRoute.value.path
  if (currentPath === path) return Promise.resolve()

  return currentPath === '/home' ? router.push(path) : router.replace(path)
}
