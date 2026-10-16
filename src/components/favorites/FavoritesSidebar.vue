<template>
  <aside class="left-panel cw-offcanvas" :class="{ 'is-open': mobileOpen }">
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
      <div class="menu-item" @click="goNotes">
        <el-icon><Notebook /></el-icon>
        <span>笔记</span>
      </div>
      <div class="menu-item" @click="goPlan">
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
import { Calendar, Collection, Compass, FolderAdd, Menu, Notebook, Plus, StarFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import type { FavoriteCollection } from '@/types/FavoriteProblem'

defineProps<{
  favorites: FavoriteCollection[]
  selectedFavoriteId: string
  loading: boolean
  /** 手机档由父级控制的抽屉开合状态；桌面端无效果（样式只在 ≤768 生效）。 */
  mobileOpen?: boolean
}>()

defineEmits<{
  (event: 'go-home'): void
  (event: 'select-favorite', value: string): void
  (event: 'create-favorite'): void
}>()

const router = useRouter()

/** 笔记菜单项 → 笔记页 */
const goNotes = () => router.push('/notes')

/** 学习计划菜单项 → 计划页 */
const goPlan = () => router.push('/plan')
</script>

<style scoped>
.left-panel {
  width: 240px;
  flex-shrink: 0;
  padding: 20px 16px 20px 24px;
  overflow-y: auto;
  background: #ffffff;
  border-right: 1px solid var(--cw-border);
}

.sidebar-card {
  border: 1px solid var(--cw-border);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 18px;
  background: #ffffff;
}

.sidebar-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cw-text-1);
  font-weight: 600;
  margin-bottom: 6px;
}

.sidebar-card-title .el-icon {
  color: var(--cw-brand);
}

.sidebar-card p {
  margin: 0;
  color: var(--cw-text-3);
  font-size: 13px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--cw-border);
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
  color: var(--cw-text-3);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--cw-text-2);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: var(--cw-bg-page);
}

.menu-item.active {
  background: var(--cw-brand-soft);
  color: var(--cw-brand);
  font-weight: 600;
}

.create-collection {
  width: 100%;
  border-style: dashed;
}

@media (max-width: 768px) {
  /* 手机档不再是"隐藏掉没了"：由父级 FavoritesView 的汉堡按钮控制 .cw-offcanvas 抽屉 */
  .left-panel {
    border-right: 0;
  }
}
</style>
