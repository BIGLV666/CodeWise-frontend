<template>
  <el-header class="navbar" height="56px">
    <div class="navbar-left">
      <el-button :icon="ArrowLeft" text @click="$emit('back')">返回</el-button>
      <el-divider direction="vertical" />
      <span class="navbar-title">{{ title || '题目详情' }}</span>
      <span class="navbar-id">{{ questionId || '' }}</span>
    </div>
    <div class="navbar-right">
      <el-button type="primary" text @click="$emit('addQuestionToReview')">添加到复习</el-button>
      <el-button :icon="Star" text @click="$emit('favorite')">收藏</el-button>
      <el-button :icon="CopyDocument" text @click="$emit('copy')">复制</el-button>
      <el-button text @click="$emit('reset-layout')">重置布局</el-button>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { ArrowLeft, CopyDocument, Star } from '@element-plus/icons-vue'

defineProps<{
  title?: string
  questionId?: string | number
}>()

defineEmits<{
  (event: 'back'): void
  (event: 'addQuestionToReview'): void
  (event: 'copy'): void
  (event: 'favorite'): void
  (event: 'reset-layout'): void
}>()
</script>

<style scoped>
.navbar {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
  height: 56px;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.navbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.navbar-id {
  font-size: 13px;
  color: #909399;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
