<template>
    <div class="inbox-page">
        <header class="navbar">
            <button class="logo" type="button" @click="navigateTopLevel(router, '/home')">
                <span>C</span>CodeWise
            </button>
            <nav>
                <button type="button" @click="navigateTopLevel(router, '/home')">题库</button
                ><button type="button" @click="navigateTopLevel(router, '/discuss')">讨论</button
                ><button type="button" @click="navigateTopLevel(router, '/review')">复习</button
                ><button class="active" type="button">收件箱</button>
            </nav>
            <el-button :icon="Refresh" circle size="small" :loading="loading" @click="reload" />
        </header>

        <main class="inbox-shell" :class="{ 'show-detail': Boolean(detail) }">
            <aside class="message-list-panel">
                <div class="list-header">
                    <div>
                        <h1>收件箱</h1>
                        <span>{{ notificationStore.unreadCount }} 条未读</span>
                    </div>
                    <el-button text :disabled="notificationStore.unreadCount === 0" @click="readAll"
                        >全部已读</el-button
                    >
                </div>
                <div class="list-filters">
                    <el-segmented
                        v-model="activeType"
                        :options="typeOptions"
                        size="small"
                        @change="reload"
                    />
                    <el-checkbox v-model="unreadOnly" label="仅未读" @change="reload" />
                </div>

                <div v-loading="loading && notifications.length === 0" class="message-scroll">
                    <el-empty
                        v-if="!loading && notifications.length === 0"
                        description="暂无通知"
                    />

                    <template v-if="activeType !== 'LIKE'">
                        <button
                            v-for="item in reviewNotifications"
                            :key="item.notificationCenterId"
                            class="message-row"
                            :class="{
                                active: selectedId === item.notificationCenterId,
                                unread: item.isRead === 0
                            }"
                            type="button"
                            @click="selectNotification(item)"
                        >
                            <span class="message-dot"></span
                            ><span class="message-copy"
                                ><strong>{{ item.title || '复习提醒' }}</strong
                                ><small>{{ formatDate(item.createTime) }}</small></span
                            ><el-tag size="small" effect="plain" type="success">复习</el-tag>
                        </button>
                    </template>

                    <el-collapse
                        v-if="activeType === 'ALL' && likeNotifications.length"
                        v-model="expandedGroups"
                        class="like-collapse"
                    >
                        <el-collapse-item name="likes">
                            <template #title
                                ><span class="collapse-title"
                                    ><el-icon><CaretRight /></el-icon>点赞通知
                                    <small>{{ likeNotifications.length }} 条</small></span
                                ></template
                            >
                            <button
                                v-for="item in likeNotifications"
                                :key="item.notificationCenterId"
                                class="message-row compact"
                                :class="{
                                    active: selectedId === item.notificationCenterId,
                                    unread: item.isRead === 0
                                }"
                                type="button"
                                @click="selectNotification(item)"
                            >
                                <span class="message-dot"></span
                                ><span class="message-copy"
                                    ><strong>{{ item.title || '收到新的点赞' }}</strong
                                    ><small>{{ formatDate(item.createTime) }}</small></span
                                >
                            </button>
                        </el-collapse-item>
                    </el-collapse>

                    <template v-else-if="activeType === 'LIKE'">
                        <button
                            v-for="item in likeNotifications"
                            :key="item.notificationCenterId"
                            class="message-row"
                            :class="{
                                active: selectedId === item.notificationCenterId,
                                unread: item.isRead === 0
                            }"
                            type="button"
                            @click="selectNotification(item)"
                        >
                            <span class="message-dot"></span
                            ><span class="message-copy"
                                ><strong>{{ item.title || '收到新的点赞' }}</strong
                                ><small>{{ formatDate(item.createTime) }}</small></span
                            ><el-tag size="small" effect="plain" type="warning">点赞</el-tag>
                        </button>
                    </template>

                    <div class="load-more">
                        <el-button v-if="hasNext" text :loading="loading" @click="loadNotifications"
                            >加载更多</el-button
                        ><span v-else-if="notifications.length">没有更多通知了</span>
                    </div>
                </div>
            </aside>

            <section class="message-detail-panel">
                <el-skeleton v-if="detailLoading" :rows="7" animated />
                <el-empty v-else-if="!detail" description="从左侧选择一条通知" />
                <article v-else class="message-detail">
                    <button
                        class="mobile-back"
                        type="button"
                        @click="
                            detail = null;
                            selectedId = '';
                        "
                    >
                        <el-icon><ArrowLeft /></el-icon>返回消息列表
                    </button>
                    <div class="detail-heading">
                        <div>
                            <el-tag
                                :type="detail.type === 'REVIEW' ? 'success' : 'warning'"
                                effect="plain"
                                >{{ detail.type === 'REVIEW' ? '复习提醒' : '点赞通知' }}</el-tag
                            >
                            <h2>{{ detail.title }}</h2>
                            <time>{{ formatDateTime(detail.createTime) }}</time>
                        </div>
                        <el-button
                            :icon="Delete"
                            circle
                            text
                            type="danger"
                            @click="removeSelected"
                        />
                    </div>
                    <div class="detail-content">{{ detail.content || '暂无详细内容' }}</div>
                    <div class="detail-actions">
                        <el-button v-if="detail.businessId" type="primary" @click="openBusiness"
                            >查看相关内容</el-button
                        >
                    </div>
                </article>
            </section>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, CaretRight, Delete, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import notificationApi, {
    type NotificationDetail,
    type NotificationSummary,
    type NotificationType
} from '@/api/notificationApi';
import { useNotificationStore } from '@/stores/notification';
import { navigateTopLevel } from '@/utils/navigation';

const router = useRouter();
const notificationStore = useNotificationStore();
const typeOptions = [
    { label: '全部', value: 'ALL' },
    { label: '复习', value: 'REVIEW' },
    { label: '点赞', value: 'LIKE' }
];
const activeType = ref<'ALL' | NotificationType>('ALL');
const unreadOnly = ref(false);
const expandedGroups = ref<string[]>([]);
const notifications = ref<NotificationSummary[]>([]);
const loading = ref(false);
const detailLoading = ref(false);
const detail = ref<NotificationDetail | null>(null);
const selectedId = ref('');
const nextCursor = ref<string | null>(null);
const hasNext = ref(false);

const reviewNotifications = computed(() =>
    notifications.value.filter((item) => item.type === 'REVIEW')
);
const likeNotifications = computed(() =>
    notifications.value.filter((item) => item.type === 'LIKE')
);

const unwrap = <T,>(response: any, fallback: T): T => (response?.data ?? response ?? fallback) as T;
const mapSummary = (raw: any): NotificationSummary => ({
    notificationCenterId: String(raw.notificationCenterId),
    messageId: raw.messageId,
    title: raw.title || '未命名通知',
    type: raw.type,
    businessType: raw.businessType,
    businessId: raw.businessId == null ? undefined : String(raw.businessId),
    userId: raw.userId == null ? undefined : String(raw.userId),
    isRead: Number(raw.isRead || 0),
    createTime: raw.createTime
});

async function loadNotifications() {
    if (loading.value || (notifications.value.length > 0 && !hasNext.value)) return;
    loading.value = true;
    try {
        const data = unwrap<any>(
            await notificationApi.list({
                pageSize: 20,
                lastId: nextCursor.value,
                type: activeType.value === 'ALL' ? undefined : activeType.value,
                unreadOnly: unreadOnly.value
            }),
            {}
        );
        const records = Array.isArray(data.records) ? data.records.map(mapSummary) : [];
        notifications.value.push(
            ...records.filter(
                (item: NotificationSummary) =>
                    !notifications.value.some(
                        (old) => old.notificationCenterId === item.notificationCenterId
                    )
            )
        );
        nextCursor.value = data.nextCursor == null ? null : String(data.nextCursor);
        hasNext.value = Boolean(data.hasNext);
    } catch (error) {
        console.error('通知列表加载失败:', error);
    } finally {
        loading.value = false;
    }
}

async function reload() {
    notifications.value = [];
    nextCursor.value = null;
    hasNext.value = false;
    detail.value = null;
    selectedId.value = '';
    await Promise.all([loadNotifications(), notificationStore.refreshUnreadCount()]);
}

async function selectNotification(item: NotificationSummary) {
    selectedId.value = item.notificationCenterId;
    detailLoading.value = true;
    const wasUnread = item.isRead === 0;
    try {
        detail.value = unwrap<NotificationDetail | null>(
            await notificationApi.getDetail(item.notificationCenterId),
            null
        );
        if (wasUnread) {
            item.isRead = 1;
            notificationStore.markOneRead();
        }
    } catch (error) {
        console.error('通知详情加载失败:', error);
    } finally {
        detailLoading.value = false;
    }
}

async function readAll() {
    await notificationApi.markAllAsRead(activeType.value === 'ALL' ? undefined : activeType.value);
    notifications.value.forEach((item) => {
        if (activeType.value === 'ALL' || item.type === activeType.value) item.isRead = 1;
    });
    await notificationStore.refreshUnreadCount();
    ElMessage.success('已全部标记为已读');
}

async function removeSelected() {
    if (!detail.value) return;
    try {
        await ElMessageBox.confirm('确定删除这条通知吗？', '删除通知', {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        });
        const id = detail.value.notificationCenterId;
        const wasUnread =
            notifications.value.find((item) => item.notificationCenterId === id)?.isRead === 0;
        await notificationApi.remove(id);
        notifications.value = notifications.value.filter(
            (item) => item.notificationCenterId !== id
        );
        detail.value = null;
        selectedId.value = '';
        if (wasUnread) notificationStore.markOneRead();
        ElMessage.success('通知已删除');
    } catch (error: any) {
        if (error !== 'cancel' && error !== 'close') console.error('删除通知失败:', error);
    }
}

function openBusiness() {
    if (!detail.value?.businessId) return;
    const id = detail.value.businessId;
    if (detail.value.businessType === 'POST') router.push(`/discuss/${id}`);
    else if (detail.value.businessType === 'SOLUTION')
        router.push({
            path: '/questiondetailview',
            query: { questionId: String(detail.value.extraData?.questionId || id) }
        });
    else if (detail.value.businessType === 'REVIEW_RECORD') router.push('/review');
    else router.push('/discuss');
}
const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '';
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('zh-CN') : '');

onMounted(reload);
</script>

<style scoped>
.inbox-page {
    min-height: 100vh;
    background: #f6f7f9;
    color: #262626;
}
.navbar {
    height: 58px;
    padding: 0 28px;
    border-bottom: 1px solid #e8ecf1;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 32px;
}
.logo {
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
}
.logo span {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    background: #ffa116;
    color: #fff;
}
.navbar nav {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 24px;
}
.navbar nav button {
    height: 100%;
    border: 0;
    background: transparent;
    color: #65676b;
    cursor: pointer;
}
.navbar nav button:hover,
.navbar nav button.active {
    color: #d98200;
}
.navbar nav button.active {
    border-bottom: 2px solid #ffa116;
}
.inbox-shell {
    width: min(1180px, calc(100% - 48px));
    height: calc(100vh - 98px);
    min-height: 560px;
    margin: 20px auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    display: grid;
    grid-template-columns: 370px minmax(0, 1fr);
    overflow: hidden;
}
.message-list-panel {
    min-width: 0;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
}
.list-header {
    min-height: 76px;
    padding: 15px 18px;
    border-bottom: 1px solid #edf0f3;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.list-header h1 {
    margin: 0;
    font-size: 20px;
}
.list-header span {
    color: #8a8f98;
    font-size: 12px;
}
.list-filters {
    padding: 10px 14px;
    border-bottom: 1px solid #edf0f3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.message-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}
.message-row {
    width: 100%;
    min-height: 68px;
    padding: 11px 14px;
    border: 0;
    border-bottom: 1px solid #edf0f3;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    cursor: pointer;
}
.message-row:hover,
.message-row.active {
    background: #f7f8fa;
}
.message-row.unread .message-copy strong {
    color: #191c1e;
    font-weight: 700;
}
.message-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: 0 0 auto;
    background: transparent;
}
.message-row.unread .message-dot {
    background: #e5484d;
}
.message-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.message-copy strong {
    color: #555b65;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.message-copy small {
    color: #9ca3af;
}
.like-collapse {
    border: 0;
}
.like-collapse :deep(.el-collapse-item__header) {
    padding: 0 15px;
    background: #fbfbfc;
}
.like-collapse :deep(.el-collapse-item__arrow) {
    display: none;
}
.collapse-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 600;
}
.collapse-title small {
    color: #9ca3af;
    font-weight: 400;
}
.compact {
    padding-left: 24px;
}
.load-more {
    min-height: 46px;
    display: grid;
    place-items: center;
    color: #9ca3af;
    font-size: 12px;
}
.message-detail-panel {
    min-width: 0;
    padding: 28px 34px;
    overflow-y: auto;
}
.message-detail-panel > .el-empty {
    height: 100%;
}
.detail-heading {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding-bottom: 22px;
    border-bottom: 1px solid #edf0f3;
}
.detail-heading h2 {
    margin: 12px 0 7px;
    font-size: 25px;
    line-height: 1.4;
}
.detail-heading time {
    color: #9ca3af;
    font-size: 12px;
}
.detail-content {
    padding: 28px 0;
    font-size: 16px;
    line-height: 1.9;
    white-space: pre-wrap;
}
.detail-actions {
    margin-top: 22px;
}
.inbox-page :deep(.el-segmented) {
    --el-segmented-item-selected-bg-color: #fff;
}
.mobile-back {
    display: none;
}
@media (max-width: 760px) {
    .navbar nav {
        display: none;
    }
    .inbox-shell {
        width: calc(100% - 20px);
        height: calc(100vh - 78px);
        margin: 10px;
        grid-template-columns: 1fr;
    }
    .message-detail-panel {
        display: none;
        padding: 20px;
    }
    .inbox-shell.show-detail .message-list-panel {
        display: none;
    }
    .inbox-shell.show-detail .message-detail-panel {
        display: block;
    }
    .mobile-back {
        margin: 0 0 16px;
        padding: 0;
        border: 0;
        background: transparent;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #6b7280;
    }
    .detail-heading h2 {
        font-size: 21px;
    }
}
</style>
