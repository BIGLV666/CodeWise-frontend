<template>
  <el-config-provider :locale="zhCn">
    <NotificationRuntime />
    <router-view v-slot="{ Component, route }">
      <keep-alive :include="CACHED_PAGE_NAMES" :max="1">
        <component :is="Component" :key="getPageKey(route)" />
      </keep-alive>
    </router-view>
  </el-config-provider>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import NotificationRuntime from '@/components/notification/NotificationRuntime.vue'

const CACHED_PAGE_NAMES = ['HomeView']

function getPageKey(route: RouteLocationNormalizedLoaded) {
  if (route.meta.remountOnQuery) return route.fullPath
  return String(route.name || route.matched.at(-1)?.path || route.path)
}
</script>
