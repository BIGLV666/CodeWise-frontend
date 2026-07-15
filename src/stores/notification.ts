import { defineStore } from 'pinia';
import notificationApi from '@/api/notificationApi';

export const useNotificationStore = defineStore('notification', {
    state: () => ({
        unreadCount: 0,
        loaded: false,
        loading: false
    }),

    actions: {
        async refreshUnreadCount() {
            if (this.loading || !localStorage.getItem('token')) return;
            this.loading = true;
            try {
                const response: any = await notificationApi.getUnreadCount();
                const count = Number(response?.data ?? response ?? 0);
                this.unreadCount = Number.isFinite(count) ? Math.max(0, count) : 0;
                this.loaded = true;
            } catch (error) {
                console.warn('未读通知数量加载失败:', error);
            } finally {
                this.loading = false;
            }
        },

        markOneRead() {
            this.unreadCount = Math.max(0, this.unreadCount - 1);
        },

        clearUnread() {
            this.unreadCount = 0;
        }
    }
});
