import request from './request';

export type NotificationType = 'LIKE' | 'REVIEW' | 'REVIEW_MASTERED' | 'CHECKED';
export type NotificationBusinessType = 'POST' | 'COMMENT' | 'SOLUTION' | 'REVIEW_RECORD';

export interface NotificationLikeExtraData {
    userId?: string;
    userName?: string;
    nickName?: string;
    avatarUrl?: string;
    rootId?: string;
    rootType?: 'POST' | 'SOLUTION';
    rootCommentId?: string;
    questionId?: string;
}

export interface NotificationCheckedExtraData {
    passed?: boolean;
    takeDown?: boolean;
    title?: string;
    message?: string;
    rootId?: string;
    rootType?: 'POST' | 'SOLUTION';
    rootCommentId?: string;
    questionId?: string;
}

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
    extraData?: NotificationLikeExtraData | NotificationCheckedExtraData | null;
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

    /** 后台轮询用：失败静默，不弹全局错误提示。 */
    getUnreadCount() {
        return request.get<number>('/message/notifications/unread-count', { silent: true });
    },

    getDetail(notificationId: string) {
        return request.get<NotificationDetail>(`/message/notifications/${notificationId}`);
    },

    markAllAsRead(type?: NotificationType) {
        return request.put<string>('/message/notifications/read-all', null, { params: { type } });
    },

    remove(notificationId: string) {
        return request.delete<string>(`/message/notifications/${notificationId}`);
    }
};

export default notificationApi;
