import { defineComponent } from 'vue';
import { useNotificationStore } from '../store/notification.store';
import type { NotificationType, NotificationVariant } from '../store/notification.store';

/**
 * Mixin: notification
 * Provides createNotification helper methods for Vue components.
 *
 * Usage:
 * mixins: [NotificationMixin],
 *
 * this.createNotificationSuccess({ message: 'Saved!' })
 */
const NotificationMixin = defineComponent({
    methods: {
        createNotification(notification: NotificationType): string | null {
            const store = useNotificationStore();
            return store.createNotification(notification);
        },

        createNotificationSuccess(config: NotificationType): void {
            const notification: NotificationType = {
                variant: 'success' as NotificationVariant,
                title: (this.$t ? this.$t('cmh-global.default.success') : 'Success') as string,
                ...config,
            };
            this.createNotification(notification);
        },

        createNotificationInfo(config: NotificationType): void {
            const notification: NotificationType = {
                variant: 'info' as NotificationVariant,
                title: (this.$t ? this.$t('cmh-global.default.info') : 'Info') as string,
                ...config,
            };
            this.createNotification(notification);
        },

        createNotificationWarning(config: NotificationType): void {
            const notification: NotificationType = {
                variant: 'warning' as NotificationVariant,
                title: (this.$t ? this.$t('cmh-global.default.warning') : 'Warning') as string,
                ...config,
            };
            this.createNotification(notification);
        },

        createNotificationError(config: NotificationType): void {
            const notification: NotificationType = {
                variant: 'error' as NotificationVariant,
                title: (this.$t ? this.$t('cmh-global.default.error') : 'Error') as string,
                ...config,
            };
            this.createNotification(notification);
        },

        createSaveSuccessNotification(config: NotificationType = {}): void {
            this.createNotificationSuccess({
                title: (this.$t ? this.$t('cmh-global.notification.saveSuccessTitle') : '') as string,
                message: (this.$t ? this.$t('cmh-global.notification.saveSuccessMessage') : '') as string,
                ...config,
            });
        },

        createSaveErrorNotification(config: NotificationType = {}): void {
            this.createNotificationError({
                title: (this.$t ? this.$t('cmh-global.notification.saveErrorTitle') : '') as string,
                message: (this.$t ? this.$t('cmh-global.notification.saveErrorMessage') : '') as string,
                ...config,
            });
        },

        createSystemNotificationSuccess(config: NotificationType): void {
            this.createNotification({ variant: 'success', system: true, ...config });
        },

        createSystemNotificationInfo(config: NotificationType): void {
            this.createNotification({ variant: 'info', system: true, ...config });
        },

        createSystemNotificationWarning(config: NotificationType): void {
            this.createNotification({ variant: 'warning', system: true, ...config });
        },

        createSystemNotificationError(config: NotificationType): void {
            this.createNotification({ variant: 'error', system: true, ...config });
        },

        createSystemNotification(config: NotificationType): void {
            this.createNotification({ system: true, ...config });
        },
    },
});

export default NotificationMixin;
export type { NotificationType, NotificationVariant };
