<template>
  <aside class="left-panel">
    <section class="sidebar-card">
      <div class="sidebar-card-title">
        <el-icon><Menu /></el-icon>
        <span>导航</span>
      </div>
      <p>编程练习</p>
    </section>

    <section class="sidebar-section">
      <div class="menu-item" @click="$emit('go-home')">
        <el-icon><Collection /></el-icon>
        <span>全部题目</span>
      </div>
      <div class="menu-item">
        <el-icon><Compass /></el-icon>
        <span>探索</span>
      </div>
      <div class="menu-item">
        <el-icon><Reading /></el-icon>
        <span>题解书</span>
      </div>
      <div class="menu-item">
        <el-icon><Calendar /></el-icon>
        <span>学习计划</span>
      </div>
    </section>

    <section class="sidebar-section collections-section">
      <div class="section-title">
        <span>我的收藏</span>
        <el-button :icon="Plus" text size="small" @click="$emit('create-favorite')" />
      </div>
      <div
        v-for="favorite in favorites"
        :key="favorite.favoritesId"
        class="menu-item"
        :class="{ active: favorite.favoritesId === selectedFavoriteId }"
        @click="$emit('select-favorite', favorite.favoritesId)"
      >
        <el-icon><StarFilled /></el-icon>
        <span>{{ favorite.favoritesName }}</span>
      </div>
      <el-empty v-if="!loading && favorites.length === 0" description="暂无收藏" :image-size="64" />
    </section>

    <el-button class="create-collection" :icon="FolderAdd" plain @click="$emit('create-favorite')">新建收藏</el-button>
  </aside>
</template>

<script setup lang="ts">
import { Calendar, Collection, Compass, FolderAdd, Menu, Plus, Reading, StarFilled } from '@element-plus/icons-vue'
import type { FavoriteCollection } from '@/types/FavoriteProblem'

defineProps<{
  favorites: FavoriteCollection[]
  selectedFavoriteId: string
  loading: boolean
}>()

defineEmits<{
  (event: 'go-home'): void
  (event: 'select-favorite', value: string): void
  (event: 'create-favorite'): void
}>()
</script>

<style scoped>
.left-panel {
  width: 240px;
  flex-shrink: 0;
  padding: 20px 16px 20px 24px;
  overflow-y: auto;
  background: #ffffff;
  border-right: 1px solid #e8ecf1;
}

.sidebar-card {
  border: 1px solid #e8ecf1;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 18px;
  background: #ffffff;
}

.sidebar-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a1a2e;
  font-weight: 600;
  margin-bottom: 6px;
}

.sidebar-card-title .el-icon {
  color: #ffa116;
}

.sidebar-card p {
  margin: 0;
  color: #8c8c8c;
  font-size: 13px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #e8ecf1;
}

.collections-section {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  color: #4a4a4a;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item.active {
  background: #fff8f0;
  color: #ffa116;
  font-weight: 600;
}

.create-collection {
  width: 100%;
  border-style: dashed;
}

@media (max-width: 768px) {
  .left-panel {
    display: none;
  }
}
</style>
