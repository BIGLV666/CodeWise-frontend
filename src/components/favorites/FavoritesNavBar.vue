<template>
  <header class="navbar">
    <div class="navbar-left">
      <button class="logo" type="button" @click="$emit('go-home')">
        <span class="logo-icon">C</span>
        <span class="logo-text">CodeWise</span>
      </button>
      <nav class="nav-menu">
        <a class="nav-item active" href="#" @click.prevent="$emit('go-home')">题库</a>
        <a class="nav-item" href="#">竞赛</a>
        <a class="nav-item" href="#" @click.prevent="$emit('go-discuss')">讨论</a>
        <a class="nav-item" href="#" @click.prevent="$emit('go-review')">复习</a>
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
      <el-avatar :size="32" />
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
  (event: 'go-discuss'): void
  (event: 'go-review'): void
}>()
</script>

<style scoped>
.navbar {
  height: 58px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.96);
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
  border: 0;
  background: transparent;
  color: #1a1a2e;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
}

.logo-icon {
  color: #ffa116;
  font-size: 22px;
  font-weight: 800;
}

.nav-menu {
  gap: 4px;
}

.nav-item {
  padding: 7px 15px;
  color: #4a4a4a;
  text-decoration: none;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-item:hover,
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

@media (max-width: 768px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-menu {
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
