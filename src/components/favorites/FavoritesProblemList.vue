<template>
  <section class="list-panel">
    <div class="toolbar">
      <el-input
        :model-value="keyword"
        class="problem-search"
        placeholder="搜索收藏题目..."
        :prefix-icon="Search"
        clearable
        @update:model-value="$emit('update:keyword', $event)"
      />
      <el-select
        :model-value="difficulty"
        placeholder="难度"
        clearable
        class="difficulty-select"
        @update:model-value="$emit('update:difficulty', $event)"
      >
        <el-option label="简单" value="Easy" />
        <el-option label="中等" value="Medium" />
        <el-option label="困难" value="Hard" />
      </el-select>
      <el-button :icon="Sort" @click="$emit('toggle-sort')" />
      <el-button :icon="Filter" />
    </div>

    <el-card class="problem-card" shadow="never">
      <el-table
        :data="problems"
        row-key="id"
        row-class-name="favorite-problem-row"
        style="width: 100%"
        :show-header="false"
        @row-click="$emit('select-problem', $event)"
      >
        <el-table-column width="48">
          <template #default>
            <el-icon class="solved-icon"><CircleCheckFilled /></el-icon>
          </template>
        </el-table-column>
        <el-table-column min-width="260">
          <template #default="{ row }">
            <div class="problem-title">{{ row.id }}. {{ row.title }}</div>
          </template>
        </el-table-column>
        <el-table-column width="110" align="right">
          <template #default="{ row }">
            <span class="acceptance">{{ row.acceptance }}</span>
          </template>
        </el-table-column>
        <el-table-column width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getDifficultyType(row.difficulty)" effect="light" round>
              {{ getDifficultyLabel(row.difficulty) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="problems.length === 0" description="暂无匹配的收藏题目" />
    </el-card>

    <div class="list-footer">
      <span>显示 {{ problems.length }} / {{ totalCount }} 道题</span>
      <div>
        <el-button disabled>上一页</el-button>
        <el-button disabled>下一页</el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CircleCheckFilled, Filter, Search, Sort } from '@element-plus/icons-vue'
import type { FavoriteDifficulty, FavoriteProblem } from '@/types/FavoriteProblem'

defineProps<{
  problems: FavoriteProblem[]
  totalCount: number
  keyword: string
  difficulty: FavoriteDifficulty | ''
}>()

defineEmits<{
  (event: 'update:keyword', value: string): void
  (event: 'update:difficulty', value: FavoriteDifficulty | ''): void
  (event: 'toggle-sort'): void
  (event: 'select-problem', value: FavoriteProblem): void
}>()

const getDifficultyType = (difficulty: FavoriteDifficulty) => {
  const map: Record<FavoriteDifficulty, 'success' | 'warning' | 'danger'> = {
    Easy: 'success',
    Medium: 'warning',
    Hard: 'danger',
  }
  return map[difficulty]
}

const getDifficultyLabel = (difficulty: FavoriteDifficulty) => {
  const map: Record<FavoriteDifficulty, string> = {
    Easy: '简单',
    Medium: '中等',
    Hard: '困难',
  }
  return map[difficulty]
}
</script>

<style scoped>
.list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.toolbar,
.list-footer {
  display: flex;
  align-items: center;
}

.toolbar {
  gap: 12px;
}

.problem-search {
  flex: 1;
  min-width: 180px;
}

.problem-search :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: #f5f7fa;
}

.difficulty-select {
  width: 120px;
}

.problem-card {
  overflow: hidden;
  border-radius: 10px;
  border-color: #e8ecf1;
}

.problem-card :deep(.el-card__body) {
  padding: 0;
}

.problem-card :deep(.el-table__row) {
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.problem-card :deep(.el-table__cell) {
  padding: 13px 0;
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.problem-card :deep(.favorite-problem-row:hover) {
  transform: translateY(-2px);
}

.problem-card :deep(.favorite-problem-row:hover td.el-table__cell) {
  background: #fffdf9 !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
}

.problem-card :deep(.favorite-problem-row:hover .problem-title) {
  color: #ffa116;
}

.solved-icon {
  color: #67c23a;
  font-size: 18px;
}

.problem-title {
  color: #1a1a2e;
  font-size: 15px;
  font-weight: 600;
  transition: color 0.2s;
}

.acceptance {
  color: #8c8c8c;
  font-size: 13px;
}

.list-footer {
  justify-content: space-between;
  color: #8c8c8c;
  font-size: 13px;
}

@media (max-width: 768px) {
  .toolbar,
  .list-footer {
    align-items: stretch;
  }

  .toolbar {
    flex-direction: column;
  }

  .difficulty-select {
    width: 100%;
  }

  .list-footer {
    gap: 12px;
    flex-direction: column;
  }
}
</style>
