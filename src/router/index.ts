import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { stack: 'auth' } },
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { stack: 'auth' } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/ForgotPasswordView.vue'), meta: { stack: 'auth' } },
    // 平台声明：登录前后都要能看，属于公开路径（见下方 PUBLIC_PATHS 与守卫）。
    { path: '/legal/:doc', name: 'legal', component: () => import('@/views/LegalView.vue'), meta: { stack: 'auth' } },

    { path: '/home', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { stack: 'root', keepAlive: true } },
    { path: '/favorites', name: 'favorites', component: () => import('@/views/FavoritesView.vue'), meta: { stack: 'root' } },
    { path: '/plan', name: 'plan', component: () => import('@/views/PlanView.vue'), meta: { stack: 'root' } },
    { path: '/notes', name: 'notes', component: () => import('@/views/NotesView.vue'), meta: { stack: 'root' } },
    { path: '/review', name: 'review', component: () => import('@/views/ReviewView.vue'), meta: { stack: 'root' } },
    { path: '/inbox', name: 'inbox', component: () => import('@/views/InboxView.vue'), meta: { stack: 'root' } },
    { path: '/discuss', name: 'discuss', component: () => import('@/views/DiscussionView.vue'), meta: { stack: 'root' } },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { stack: 'root' } },
    { path: '/agent', name: 'agent', component: () => import('@/views/AgentView.vue'), meta: { stack: 'root' } },

    { path: '/questions/import/leetcode', redirect: (to) => ({ path: '/admin/questions/import/leetcode', query: to.query }), meta: { requiresAdmin: true } },
    { path: '/questions/function-test-generator', name: 'function-test-generator', component: () => import('@/views/FunctionTestGeneratorView.vue'), meta: { requiresAdmin: true, stack: 'detail', remountOnQuery: true } },
    { path: '/questiondetailview', name: 'questiondetailview', component: () => import('@/views/QuestionDetailView.vue'), meta: { stack: 'detail', remountOnQuery: true } },
    { path: '/discuss/create', name: 'discussion-create', component: () => import('@/views/DiscussionComposeView.vue'), meta: { stack: 'detail' } },
    { path: '/discuss/:postId', name: 'discussion-detail', component: () => import('@/views/DiscussionDetailView.vue'), meta: { stack: 'detail', remountOnQuery: true } },

    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      redirect: '/admin/container-pool',
      meta: { requiresAdmin: true, stack: 'module' },
      children: [
        { path: 'container-pool', name: 'admin-container-pool', component: () => import('@/views/AdminContainerPoolView.vue') },
        { path: 'failure-submits', name: 'admin-failure-submits', component: () => import('@/views/AdminFailureSubmitView.vue') },
        { path: 'moderation', name: 'admin-moderation', component: () => import('@/views/AdminModerationView.vue') },
        { path: 'appeals', name: 'admin-appeals', component: () => import('@/views/AdminAppealsView.vue') },
        { path: 'users', name: 'admin-users', component: () => import('@/views/AdminUsersView.vue') },
        { path: 'questions/create', name: 'admin-question-create', component: () => import('@/views/AdminQuestionCreateView.vue') },
        { path: 'questions/import/leetcode', name: 'leetcode-import', component: () => import('@/views/LeetCodeImportView.vue') },
        { path: 'testcases', name: 'admin-testcases', component: () => import('@/views/AdminTestCasesView.vue') },
        { path: 'artifact-generator', name: 'admin-artifact-generator', component: () => import('@/views/AdminFunctionArtifactView.vue') },
      ],
    },
    { path: '/content-render', name: 'content-render', component: () => import('@/views/ContentRenderView.vue'), meta: { requiresAdmin: true, stack: 'detail' } },
  ],
})

const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password'])

function clearStoredSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('userId')
  localStorage.removeItem('userName')
  localStorage.removeItem('avatarUrl')
  localStorage.removeItem('roleId')
}

function hasValidToken() {
  const token = localStorage.getItem('token')
  if (!token) return false

  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return true
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(normalized)) as { exp?: number }
    if (!payload.exp || payload.exp * 1000 > Date.now()) return true
    clearStoredSession()
    return false
  } catch {
    return true
  }
}

router.beforeEach(async (to) => {
  const authenticated = hasValidToken()
  // 平台声明是「谁都能看」的页面：未登录放行，已登录也不弹回首页
  //（它常被当作分享链接打开，弹走等于看不到）。
  if (to.name === 'legal') return true
  if (PUBLIC_PATHS.has(to.path)) return authenticated ? '/home' : true
  if (!authenticated) return { path: '/login', query: { redirect: to.fullPath } }

  // 管理员路由做一次前置拦截，避免非管理员进入后被逐个接口 403。
  // 这只是界面层面的引导，真正的鉴权仍由后端 @RequireAdmin 负责。
  if (to.meta?.requiresAdmin) {
    const { useUserStore, isAdminRole } = await import('@/stores/User')
    const userStore = useUserStore()
    const roleId = await userStore.ensureRoleId()
    if (!isAdminRole(roleId)) {
      ElMessage.error('该页面仅管理员可访问')
      return '/home'
    }
  }
  return true
})

export default router

