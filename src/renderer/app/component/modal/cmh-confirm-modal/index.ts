import { defineComponent } from 'vue'
import template from './cmh-confirm-modal.html?raw';
import './cmh-confirm-modal.scss';

type ConfirmModalType = 'confirm' | 'delete' | 'yesno' | 'discard';

/**
 * @description A modal dialog for confirmation, deletion, or discard actions.
 * Type controls button labels and variants.
 */
export default defineComponent({
    template,

    emits: ['close', 'cancel', 'confirm'],

    props: {
        title: {
            type: String,
            required: false,
            default: '' as string,
        },

        text: {
            type: String,
            required: false,
            default: '' as string,
        },

        type: {
            type: String as () => ConfirmModalType,
            required: false,
            default: 'confirm' as ConfirmModalType,
            validator(value: string) {
                return ['confirm', 'delete', 'yesno', 'discard'].includes(value);
            },
        },
    },

    computed: {
        titleText(): string {
            if (this.title?.length) return this.title;
            return this.$t('cmh-global.confirmModal.defaultTitle');
        },

        descriptionText(): string {
            if (this.text?.length) return this.text;
            return this.$t('cmh-global.confirmModal.defaultText');
        },

        confirmText(): string {
            switch (this.type) {
                case 'delete':
                    return this.$t('cmh-global.default.delete');
                case 'yesno':
                    return this.$t('cmh-global.default.yes');
                case 'discard':
                    return this.$t('cmh-global.default.discard');
                default:
                    return this.$t('cmh-global.default.confirm');
            }
        },

        cancelText(): string {
            return this.type === 'yesno'
                ? this.$t('cmh-global.default.no')
                : this.$t('cmh-global.default.cancel');
        },

        confirmButtonVariant(): string {
            switch (this.type) {
                case 'delete':
                case 'discard':
                    return 'critical';
                default:
                    return 'primary';
            }
        },
    },
});
