import request from './request';

export type NotificationType = 'LIKE' | 'REVIEW';
export type NotificationBusinessType = 'POST' | 'COMMENT' | 'SOLUTION' | 'REVIEW_RECORD';

export interface NotificationSummary {
    notificationCenterId: string;
    messageId?: string;
    title: string;
    type: NotificationType;
    businessType?: NotificationBusinessType;
    businessId?: string;
    userId?: string;
    isRead: number;
    createTime?: string;
}

export interface NotificationDetail extends NotificationSummary {
    content?: string;
    extraData?: Record<string, unknown> | null;
}

export interface NotificationCursorPage {
    records: NotificationSummary[];
    nextCursor?: string | null;
    hasNext: boolean;
}

const notificationApi = {
    list(params: {
        pageSize: number;
        lastId?: string | null;
        type?: NotificationType;
        unreadOnly?: boolean;
    }) {
        return request.get<NotificationCursorPage>('/message/notifications', { params });
    },

    getUnreadCount() {
        return request.get<number>('/message/notifications/unread-count');
    },

    getDetail(notificationId: string) {
        return request.get<NotificationDetail>(`/message/notifications/${notificationId}`);
    },

    markAsRead(notificationId: string) {
        return request.put<string>(`/message/notifications/${notificationId}/read`);
    },

    markAllAsRead(type?: NotificationType) {
        return request.put<string>('/message/notifications/read-all', null, { params: { type } });
    },

    remove(notificationId: string) {
        return request.delete<string>(`/message/notifications/${notificationId}`);
    }
};

export default notificationApi;
