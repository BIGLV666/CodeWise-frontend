<template>
  <span class="brand-logo" :class="{ inverse }">
    <img :src="codewiseLogo" alt="" :style="markStyle" aria-hidden="true" />
    <span v-if="showName">CodeWise</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import codewiseLogo from '@/assets/codewise-logo.svg'

const props = withDefaults(defineProps<{
  size?: number
  inverse?: boolean
  showName?: boolean
}>(), {
  size: 30,
  inverse: false,
  showName: true,
})

const markStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  color: var(--cw-text-1);
  font-size: 18px;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
}

.brand-logo.inverse { color: #fff; }
.brand-logo img { display: block; flex: 0 0 auto; }
</style>
