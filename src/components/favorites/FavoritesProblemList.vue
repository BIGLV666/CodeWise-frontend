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
    </div>

    <el-card class="problem-card" shadow="never">
      <el-table
        :data="problems"
        row-key="id"
        row-class-name="favorite-problem-row"
        style="width: 100%"
        :show-header="false"
        @row-click="handleRowClick"
      >
        <el-table-column width="52">
          <template #default="{ row }">
            <el-icon class="status-icon" :class="getStatusClass(row.status)">
              <CircleCheckFilled v-if="row.status === 1" />
              <CircleCloseFilled v-else-if="row.status === 2" />
              <CircleCheck v-else />
            </el-icon>
          </template>
        </el-table-column>
        <el-table-column min-width="260">
          <template #default="{ row }">
            <div class="problem-title">{{ row.id }}. {{ row.title }}</div>
            <div class="problem-subtitle">{{ getStatusLabel(row.status) }}</div>
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
        <el-table-column width="72" align="right">
          <template #default="{ row }">
            <el-tooltip content="移出收藏" placement="top">
              <el-button
                :icon="Delete"
                circle
                text
                type="danger"
                @click.stop="$emit('remove-problem', row)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="problems.length === 0" description="暂无匹配的收藏题目" />
    </el-card>

    <div class="list-footer">
      <span>显示 {{ problems.length }} / {{ totalCount }} 道题</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CircleCheck, CircleCheckFilled, CircleCloseFilled, Delete, Search, Sort } from '@element-plus/icons-vue'
import type { FavoriteDifficulty, FavoriteProblem } from '@/types/FavoriteProblem'

defineProps<{
  problems: FavoriteProblem[]
  totalCount: number
  keyword: string
  difficulty: FavoriteDifficulty | ''
}>()

const emit = defineEmits<{
  (event: 'update:keyword', value: string): void
  (event: 'update:difficulty', value: FavoriteDifficulty | ''): void
  (event: 'toggle-sort'): void
  (event: 'select-problem', value: FavoriteProblem): void
  (event: 'remove-problem', value: FavoriteProblem): void
}>()

const handleRowClick = (row: FavoriteProblem) => {
  emit('select-problem', row)
}

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

const getStatusLabel = (status: number) => {
  const map: Record<number, string> = {
    0: '未尝试',
    1: '已通过',
    2: '尝试过',
  }
  return map[status] || '未知状态'
}

const getStatusClass = (status: number) => {
  const map: Record<number, string> = {
    0: 'not-tried',
    1: 'accepted',
    2: 'attempted',
  }
  return map[status] || 'not-tried'
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
  border-radius: 8px;
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

.status-icon {
  font-size: 18px;
}

.status-icon.accepted {
  color: #00a38f;
}

.status-icon.attempted {
  color: #e6a23c;
}

.status-icon.not-tried {
  color: #c0c4cc;
}

.problem-title {
  color: #1a1a2e;
  font-size: 15px;
  font-weight: 600;
  transition: color 0.2s;
}

.problem-subtitle {
  margin-top: 3px;
  color: #8c8c8c;
  font-size: 12px;
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
}
</style>
