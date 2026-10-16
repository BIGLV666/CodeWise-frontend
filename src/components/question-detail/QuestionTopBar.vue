<template>
  <el-header class="navbar" height="56px">
    <div class="navbar-left">
      <el-button :icon="ArrowLeft" text class="back-button" @click="$emit('back')">
        <span class="back-text">返回</span>
      </el-button>
      <el-divider direction="vertical" class="cw-hide-phone" />
      <span class="navbar-title">{{ title || '题目详情' }}</span>
      <span class="navbar-id cw-hide-phone">{{ questionId || '' }}</span>
    </div>
    <div class="navbar-right">
      <InboxButton />
      <!-- 桌面/平板：动作平铺 -->
      <template v-if="!isPhone">
        <el-button type="primary" text @click="$emit('addQuestionToReview')">添加到复习</el-button>
        <el-button :icon="Star" text @click="$emit('favorite')">收藏</el-button>
        <el-button :icon="CopyDocument" text @click="$emit('copy')">复制</el-button>
        <el-button text @click="$emit('reset-layout')">重置布局</el-button>
      </template>
      <!-- 手机：收进「更多」，否则 375px 下必然挤爆 -->
      <el-dropdown v-else trigger="click">
        <el-button :icon="MoreFilled" text class="more-button" aria-label="更多操作" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="$emit('addQuestionToReview')">添加到复习</el-dropdown-item>
            <el-dropdown-item @click="$emit('favorite')">收藏</el-dropdown-item>
            <el-dropdown-item @click="$emit('copy')">复制标题</el-dropdown-item>
            <el-dropdown-item @click="$emit('reset-layout')">重置布局</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<script setup lang="ts">
/**
 * 做题页顶栏。
 *
 * 手机档把「添加到复习 / 收藏 / 复制 / 重置布局」收进「更多」下拉，
 * 标题允许省略号收缩，否则 375px 下这些动作会把导航挤爆。
 */
import { ArrowLeft, CopyDocument, MoreFilled, Star } from '@element-plus/icons-vue'
import InboxButton from '@/components/notification/InboxButton.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'

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

const { isPhone } = useBreakpoint()
</script>

<style scoped>
.navbar {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 20px;
  border-bottom: 1px solid var(--cw-border);
  flex-shrink: 0;
  height: 56px;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
}

.navbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--cw-text-1);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-id {
  font-size: 13px;
  color: var(--cw-text-3);
  flex: 0 0 auto;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .navbar {
    padding: 0 10px;
    gap: 6px;
  }

  .navbar-left {
    gap: 6px;
  }

  /* 返回按钮只留图标，把横向空间让给标题 */
  .back-text {
    display: none;
  }

  .navbar-right {
    gap: 4px;
  }
}
</style>
