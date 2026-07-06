import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import HomeView from '@/views/HomeView.vue'
import QuestionDetailView from '@/views/QuestionDetailView.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import RegisterView from '../views/RegisterView.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
        path:'/login',
        name:'login',
        component:LoginView
    },
    {
        path:'/home',
        name:'home',
        component:HomeView
    },
    {
        path:'/favorites',
        name:'favorites',
        component:FavoritesView
    },
    {
        path:'/questiondetailview',
        name:'questiondetailview',
        component:QuestionDetailView
    },
    {
      path:'/register',
      name:'register',
      component:RegisterView
    }
    
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
