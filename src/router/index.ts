import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/views/FavoritesView.vue'),
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('@/views/ReviewView.vue'),
    },
    {
      path: '/discuss',
      name: 'discuss',
      component: () => import('@/views/DiscussionView.vue'),
    },
    {
      path: '/discuss/create',
      name: 'discussion-create',
      component: () => import('@/views/DiscussionComposeView.vue'),
    },
    {
      path: '/discuss/:postId',
      name: 'discussion-detail',
      component: () => import('@/views/DiscussionDetailView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
    },
    {
      path: '/questiondetailview',
      name: 'questiondetailview',
      component: () => import('@/views/QuestionDetailView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
    },
  ],
})

// src/router/index.js
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
   //如果要去的页面是登录页
  if (to.path === '/login') {
    // 如果已登录，跳转到首页
    if (token) {
      next('/home')
    } else {
      next() // 未登录，正常显示登录页
    }
  }
  // 如果要去的页面需要登录
  else if (to.meta.requiresAuth) {
    if (token) {
     next() // 已登录，正常访问
    } else {
      next('/login') // 未登录，跳转登录
    }
  }
  // 其他情况
  else {
    next()
  }
})

export default router
