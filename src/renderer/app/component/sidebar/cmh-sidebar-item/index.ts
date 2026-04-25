import { defineComponent } from 'vue'
import template from './cmh-sidebar-item.html?raw';
import './cmh-sidebar-item.scss';

/**
 * @description 사이드바 개별 탭 아이템
 *  - cmh-sidebar에 registerSidebarItem provide로 자신을 등록
 *  - default slot이 있으면 클릭 시 사이드바 패널을 열고, 없으면 단순 아이콘 버튼
 */
export default defineComponent({
    template,

    inject: {
        registerSidebarItem: {
            from: 'registerSidebarItem',
            default: null,
        },
    },

    emits: ['toggle-active', 'close-content', 'click'],

    props: {
        title: {
            type: String,
            required: true,
        },

        icon: {
            type: String,
            required: true,
        },

        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },

        position: {
            type: String,
            required: false,
            default: 'top',
            validator: (value: string) => ['top', 'bottom'].includes(value),
        },

        badge: {
            type: Number,
            required: false,
            default: 0,
        },

        hasSimpleBadge: {
            type: Boolean,
            required: false,
            default: false,
        },

        badgeType: {
            type: String,
            required: false,
            default: 'info',
            validator: (value: string) => ['info', 'warning', 'error', 'success'].includes(value),
        },
    },

    data() {
        return {
            isActive: false,
            toggleActiveListener: [] as Array<(item: unknown) => void>,
            closeContentListener: [] as Array<() => void>,
        };
    },

    computed: {
        sidebarItemClasses(): Record<string, boolean> {
            return {
                'is--active': this.showContent,
                'is--disabled': this.disabled,
            };
        },

        hasDefaultSlot(): boolean {
            return !!this.$slots.default;
        },

        showContent(): boolean {
            return this.hasDefaultSlot && this.isActive;
        },
    },

    watch: {
        disabled(newVal: boolean) {
            if (newVal) this.closeContent();
        },
    },

    created() {
        if (this.registerSidebarItem) {
            (this.registerSidebarItem as (item: unknown) => void)(this);
        }
    },

    methods: {
        registerToggleActiveListener(listener: (item: unknown) => void) {
            this.toggleActiveListener.push(listener);
        },

        registerCloseContentListener(listener: () => void) {
            this.closeContentListener.push(listener);
        },

        openContent() {
            if (this.showContent) return;
            this.$emit('toggle-active', this);
            this.toggleActiveListener.forEach((fn) => fn(this));
        },

        closeContent() {
            if (!this.isActive) return;
            this.isActive = false;
            this.$emit('close-content');
            this.closeContentListener.forEach((fn) => fn());
        },

        sidebarButtonClick(sidebarItem: unknown) {
            if (this === sidebarItem) {
                this.isActive = !this.isActive;
                this.$emit('click');
                return;
            }
            if ((sidebarItem as { hasDefaultSlot?: boolean }).hasDefaultSlot) {
                this.isActive = false;
            }
        },
    },
});
