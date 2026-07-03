<template>
  <router-view />
</template>

<script setup lang="ts">
</script>

<style>
/* 去除默认边距，让登录页占满全屏 */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
}

#app {
  height: 100%;
  width: 100%;
}
</style>
