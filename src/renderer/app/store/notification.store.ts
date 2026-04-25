import { defineStore } from 'pinia';
import { ref } from 'vue';

export type NotificationVariant = 'success' | 'info' | 'warning' | 'error';

export interface NotificationAction {
    label: string;
    disabled?: boolean;
    route?: string | Record<string, unknown>;
    method?: () => void;
}

export interface NotificationType {
    variant?: NotificationVariant;
    title?: string;
    message?: string;
    system?: boolean;
    autoClose?: boolean;
    autoCloseDelay?: number;
    actions?: NotificationAction[];
    isLoading?: boolean;
}

export interface NotificationItem extends NotificationType {
    id: string;
    uuid: string;
    createdAt: number;
    timestamp: Date;
    visited: boolean;
    actions: NotificationAction[];
}

export const useNotificationStore = defineStore('cmh-notification', () => {
    const notifications = ref<NotificationItem[]>([]);
    const growlNotifications = ref<NotificationItem[]>([]);

    function resolveId(notificationOrId: string | NotificationItem): string {
        return typeof notificationOrId === 'string' ? notificationOrId : notificationOrId.id;
    }

    function removeById(items: NotificationItem[], id: string): void {
        const index = items.findIndex((notification) => notification.id === id);

        if (index !== -1) {
            items.splice(index, 1);
        }
    }

    function createNotification(notification: NotificationType): string {
        const id = crypto.randomUUID();
        const item: NotificationItem = {
            id,
            uuid: id,
            variant: 'info',
            autoClose: true,
            autoCloseDelay: 5000,
            actions: [],
            isLoading: false,
            ...notification,
            createdAt: Date.now(),
            timestamp: new Date(),
            visited: false,
        };

        notifications.value.push(item);
        growlNotifications.value.push(item);

        if (item.autoClose) {
            setTimeout(() => removeGrowlNotification(id), item.autoCloseDelay ?? 5000);
        }

        return id;
    }

    function removeNotification(notificationOrId: string | NotificationItem): void {
        const id = resolveId(notificationOrId);

        removeById(notifications.value, id);
        removeById(growlNotifications.value, id);
    }

    function removeGrowlNotification(notificationOrId: string | NotificationItem): void {
        removeById(growlNotifications.value, resolveId(notificationOrId));
    }

    function markAllNotificationsVisited(): void {
        notifications.value.forEach((notification) => {
            notification.visited = true;
        });
    }

    function clearAll(): void {
        notifications.value = [];
        growlNotifications.value = [];
    }

    return {
        notifications,
        growlNotifications,
        createNotification,
        removeNotification,
        removeGrowlNotification,
        markAllNotificationsVisited,
        clearAll,
    };
});
