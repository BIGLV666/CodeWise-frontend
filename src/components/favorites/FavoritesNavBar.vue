<template>
  <header class="navbar">
    <div class="navbar-left">
      <div class="logo" @click="$emit('go-home')">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">CodeWise</span>
      </div>
      <nav class="nav-menu">
        <a class="nav-item active" href="#" @click.prevent="$emit('go-home')">题库</a>
        <a class="nav-item" href="#">竞赛</a>
        <a class="nav-item" href="#">讨论</a>
        <a class="nav-item" href="#">求职</a>
      </nav>
    </div>
    <div class="navbar-right">
      <el-input
        :model-value="modelValue"
        class="search-input"
        placeholder="搜索题目..."
        size="small"
        :prefix-icon="Search"
        clearable
        @update:model-value="$emit('update:modelValue', $event)"
      />
      <el-button :icon="Bell" circle size="small" />
      <el-button class="plus-button" type="warning" size="small">Go Plus</el-button>
      <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { Bell, Search } from '@element-plus/icons-vue'

defineProps<{
  modelValue: string
}>()

defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'go-home'): void
}>()
</script>

<style scoped>
.navbar {
  height: 56px;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.navbar-left,
.navbar-right,
.logo,
.nav-menu {
  display: flex;
  align-items: center;
}

.navbar-left {
  gap: 32px;
}

.navbar-right {
  gap: 14px;
}

.logo {
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
}

.logo-icon {
  color: #ffa116;
  font-size: 22px;
}

.logo-text {
  background: linear-gradient(135deg, #ffa116, #ff6b35);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-menu {
  gap: 4px;
}

.nav-item {
  padding: 6px 14px;
  color: #4a4a4a;
  text-decoration: none;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-item:hover {
  background: #f0f2f5;
  color: #1a1a2e;
}

.nav-item.active {
  color: #ffa116;
  background: #fff8f0;
}

.search-input {
  width: 180px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: #f5f7fa;
}

.plus-button {
  color: #673d00;
  font-weight: 600;
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-menu,
  .plus-button {
    display: none;
  }

  .navbar-left {
    gap: 12px;
  }

  .navbar-right {
    gap: 8px;
  }

  .search-input {
    width: 120px;
  }
}
</style>
