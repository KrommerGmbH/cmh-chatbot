import { defineComponent } from 'vue'
import template from './cmh-empty-state.html?raw';
import './cmh-empty-state.scss';

/**
 * @description Empty state placeholder shown when there is no data.
 * Unlike Shopware's version, module color/icon/description are passed explicitly
 * rather than inferred from router meta.
 */
export default defineComponent({
    template,

    props: {
        title: {
            type: String,
            default: null as string | null,
            required: false,
        },

        subline: {
            type: String,
            default: null as string | null,
            required: false,
        },

        showDescription: {
            type: Boolean,
            default: true,
            required: false,
        },

        color: {
            type: String,
            default: null as string | null,
            required: false,
        },

        icon: {
            type: String,
            default: 'regular-dashboard' as string,
            required: false,
        },

        absolute: {
            type: Boolean,
            default: false,
            required: false,
        },

        emptyModule: {
            type: Boolean,
            default: false,
            required: false,
        },

        autoHeight: {
            type: Boolean,
            default: false,
            required: false,
        },
    },

    computed: {
        resolvedColor(): string | null {
            return this.color ?? null;
        },

        resolvedIcon(): string {
            return this.icon ?? 'regular-dashboard';
        },

        resolvedSubline(): string | null {
            return this.subline ?? null;
        },

        hasActionSlot(): boolean {
            return !!this.$slots.actions;
        },

        classes(): Record<string, boolean> {
            return {
                'cmh-empty-state--absolute': this.absolute,
                'cmh-empty-state--empty-module': this.emptyModule,
                'cmh-empty-state--auto-height': this.autoHeight,
            };
        },
    },
});
