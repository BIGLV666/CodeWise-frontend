<template>
    <el-badge
        :value="badgeValue"
        :hidden="notificationStore.unreadCount <= 0"
        :max="99"
        class="inbox-badge"
    >
        <el-tooltip content="收件箱" placement="bottom">
            <el-button
                :icon="Bell"
                circle
                size="small"
                aria-label="打开收件箱"
                @click="navigateTopLevel(router, '/inbox')"
            />
        </el-tooltip>
    </el-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bell } from '@element-plus/icons-vue';
import { useNotificationStore } from '@/stores/notification';
import { navigateTopLevel } from '@/utils/navigation';

const router = useRouter();
const notificationStore = useNotificationStore();
const badgeValue = computed(() =>
    notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount
);
</script>

<style scoped>
.inbox-badge {
    display: inline-flex;
    flex: 0 0 auto;
}
.inbox-badge :deep(.el-badge__content) {
    border: 2px solid #fff;
    background: var(--cw-danger);
    font-size: 10px;
}
</style>
