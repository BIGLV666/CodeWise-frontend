<template>
  <!-- 抽屉遮罩：点一下收起。样式由全局 .cw-offcanvas-backdrop 提供（仅手机档可见） -->
  <div class="cw-offcanvas-backdrop" role="presentation" @click="emit('close')" />
</template>

<script setup lang="ts">
const emit = defineEmits<{ (event: 'close'): void }>()
</script>
