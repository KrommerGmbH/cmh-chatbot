import { defineComponent } from 'vue'
import template from './cmh-notifications.html?raw';
import './cmh-notifications.scss';
import { useNotificationStore } from '../../../store/notification.store';
import type { NotificationAction, NotificationItem } from '../../../store/notification.store';

type BannerVariant = 'info' | 'critical' | 'positive' | 'attention' | 'neutral';

/**
 * @description Global notification toast container.
 * Reads from useNotificationStore and renders Shopware-style growl notifications.
 */
export default defineComponent({
    template,

    props: {
        position: {
            type: String,
            required: false,
            default: 'topRight',
            validator(value: string) {
                return ['topRight', 'bottomRight'].includes(value);
            },
        },
        notificationsGap: {
            type: String,
            default: '20px',
        },
        notificationsTopGap: {
            type: String,
            default: '165px',
        },
    },

    setup() {
        const notificationStore = useNotificationStore();
        return { notificationStore };
    },

    computed: {
        notifications(): NotificationItem[] {
            return this.notificationStore.growlNotifications;
        },

        notificationsStyle(): Record<string, string> {
            const gap = /^\d+$/.test(this.notificationsGap)
                ? `${this.notificationsGap}px`
                : this.notificationsGap;

            if (this.position === 'bottomRight') {
                return { top: 'auto', right: gap, bottom: gap, left: 'auto' };
            }
            return { top: this.notificationsTopGap, right: gap, bottom: 'auto', left: 'auto' };
        },
    },

    methods: {
        onClose(notification: NotificationItem) {
            this.notificationStore.removeGrowlNotification(notification.id);
        },

        handleAction(action: NotificationAction, notification: NotificationItem) {
            if (action.route) {
                if (typeof action.route === 'string' && /^https?:\/\//.test(action.route)) {
                    window.open(action.route, '_blank');
                } else {
                    this.$router.push(action.route as never);
                }
            }
            if (action.method && typeof action.method === 'function') {
                action.method.call(null);
            }
            this.onClose(notification);
        },

        getBannerVariant(notification: NotificationItem): BannerVariant {
            if (
                [
                    'info',
                    'critical',
                    'positive',
                    'attention',
                    'neutral',
                ].includes(notification.variant ?? '')
            ) {
                return notification.variant as BannerVariant;
            }

            const map: Record<string, BannerVariant> = {
                info: 'info',
                error: 'critical',
                critical: 'critical',
                success: 'positive',
                positive: 'positive',
                warning: 'attention',
                attention: 'attention',
            };
            return map[notification.variant ?? ''] ?? 'neutral';
        },
    },
});
