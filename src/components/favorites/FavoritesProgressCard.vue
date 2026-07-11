<template>
  <el-card class="progress-card" shadow="never">
    <div class="collection-header">
      <div>
        <div class="favorite-mark">
          <el-icon><StarFilled /></el-icon>
        </div>
        <h1>{{ favoriteName || '我的收藏' }}</h1>
        <p>{{ favoriteContent || `共 ${totalCount} 道题` }}</p>
      </div>
      <div class="header-actions">
        <el-tooltip content="编辑收藏夹" placement="top">
          <el-button :icon="Edit" circle @click="$emit('edit-favorite')" />
        </el-tooltip>
        <el-tooltip content="删除收藏夹" placement="top">
          <el-button :icon="Delete" circle type="danger" plain @click="$emit('delete-favorite')" />
        </el-tooltip>
      </div>
    </div>

    <div class="practice-actions">
      <el-button class="start-button" type="info" :icon="VideoPlay" @click="$emit('start-practice')">
        开始练习
      </el-button>
    </div>

    <el-divider />

    <div class="progress-title">
      <span>练习进度</span>
      <small>{{ solvedCount }} / {{ totalCount }}</small>
    </div>
    <div class="progress-body">
      <el-progress type="circle" :percentage="progressPercent" :width="132" :stroke-width="10" color="#67c23a">
        <template #default>
          <div class="progress-number">{{ solvedCount }}</div>
          <div class="progress-total">/ {{ totalCount }}</div>
        </template>
      </el-progress>
      <div class="difficulty-stats">
        <div class="stat-line easy">
          <span>简单</span>
          <strong>{{ solvedByDifficulty.easy }}/{{ totalByDifficulty.easy }}</strong>
        </div>
        <div class="stat-line medium">
          <span>中等</span>
          <strong>{{ solvedByDifficulty.medium }}/{{ totalByDifficulty.medium }}</strong>
        </div>
        <div class="stat-line hard">
          <span>困难</span>
          <strong>{{ solvedByDifficulty.hard }}/{{ totalByDifficulty.hard }}</strong>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Delete, Edit, StarFilled, VideoPlay } from '@element-plus/icons-vue'

defineProps<{
  favoriteName: string
  favoriteContent?: string
  totalCount: number
  solvedCount: number
  progressPercent: number
  totalByDifficulty: {
    easy: number
    medium: number
    hard: number
  }
  solvedByDifficulty: {
    easy: number
    medium: number
    hard: number
  }
}>()

defineEmits<{
  (event: 'start-practice'): void
  (event: 'edit-favorite'): void
  (event: 'delete-favorite'): void
}>()
</script>

<style scoped>
.progress-card {
  border-radius: 8px;
  border-color: #e8ecf1;
}

.collection-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}

.favorite-mark {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  background: #fff8f0;
  color: #ffa116;
  font-size: 30px;
}

.collection-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
}

.collection-header p {
  margin: 6px 0 0;
  color: #8c8c8c;
  font-size: 14px;
  line-height: 1.6;
}

.header-actions,
.practice-actions,
.progress-title {
  display: flex;
  align-items: center;
}

.header-actions {
  gap: 8px;
}

.practice-actions {
  gap: 12px;
  margin-top: 24px;
}

.start-button {
  background: #262626;
  border-color: #262626;
  font-weight: 600;
}

.progress-title {
  justify-content: space-between;
  margin-bottom: 18px;
  font-size: 16px;
  font-weight: 600;
}

.progress-title small {
  color: #8c8c8c;
  font-size: 12px;
  font-weight: 500;
}

.progress-body {
  display: flex;
  align-items: center;
  gap: 28px;
}

.progress-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 32px;
}

.progress-total {
  color: #8c8c8c;
  font-size: 13px;
}

.difficulty-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  font-size: 13px;
}

.stat-line span {
  font-weight: 700;
}

.stat-line.easy span {
  color: #67c23a;
}

.stat-line.medium span {
  color: #e6a23c;
}

.stat-line.hard span {
  color: #f56c6c;
}

@media (max-width: 768px) {
  .collection-header,
  .progress-body {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
