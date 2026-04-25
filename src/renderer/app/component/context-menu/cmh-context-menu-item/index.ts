import { defineComponent } from 'vue'
import template from './cmh-context-menu-item.html?raw';
import './cmh-context-menu-item.scss';

type ContextMenuItemVariant = 'success' | 'danger' | 'warning' | 'headline' | '';

/**
 * @description A single item in an cmh-context-menu. Supports router-link and button modes,
 * optional icon, disabled state, and semantic variants.
 */
export default defineComponent({
    template,

    props: {
        icon: {
            type: String,
            required: false,
            default: null as string | null,
        },

        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },

        routerLink: {
            type: Object,
            required: false,
            default: null as object | null,
        },

        target: {
            type: String,
            required: false,
            default: null as string | null,
        },

        variant: {
            type: String as () => ContextMenuItemVariant,
            required: false,
            default: '' as ContextMenuItemVariant,
            validator(value: string) {
                if (!value.length) return true;
                return ['success', 'danger', 'warning', 'headline'].includes(value);
            },
        },
    },

    computed: {
        contextMenuItemStyles(): Record<string, boolean> {
            return {
                [`cmh-context-menu-item--${this.variant}`]: !!this.variant,
                'is--disabled': this.disabled && this.variant !== 'headline',
                'cmh-context-menu-item--icon': !!this.icon,
            };
        },
    },

    methods: {
        handleClick(event: MouseEvent) {
            if (this.disabled) {
                event.stopPropagation();
            }
        },
    },
});
