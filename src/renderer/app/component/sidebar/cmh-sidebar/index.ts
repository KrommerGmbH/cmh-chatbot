import { defineComponent } from 'vue'
import template from './cmh-sidebar.html?raw';
import './cmh-sidebar.scss';

/**
 * @description 사이드바 컨테이너 컴포넌트
 *  - cmh-sidebar-item들을 등록받아 탭 방식으로 콘텐츠를 표시
 *  - provide: registerSidebarItem (cmh-sidebar-item이 inject)
 *  - inject: setCmhPageSidebarOffset, removeCmhPageSidebarOffset (cmh-page가 provide)
 */
export default defineComponent({
    template,

    provide() {
        return {
            registerSidebarItem: this.registerSidebarItem,
        };
    },

    inject: {
        setCmhPageSidebarOffset: { default: null },
        removeCmhPageSidebarOffset: { default: null },
    },

    emits: ['item-click'],

    props: {
        propagateWidth: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            items: [] as AwSidebarItemInstance[],
            isOpened: false,
        };
    },

    computed: {
        sections(): Record<string, AwSidebarItemInstance[]> {
            const sections: Record<string, AwSidebarItemInstance[]> = {};
            this.items.forEach((item) => {
                const pos = item.position ?? 'top';
                if (!sections[pos]) sections[pos] = [];
                sections[pos].push(item);
            });
            return sections;
        },

        sidebarClasses(): Record<string, boolean> {
            return { 'is--opened': this.isOpened };
        },
    },

    mounted() {
        if (this.propagateWidth && this.setCmhPageSidebarOffset) {
            const nav = this.$el?.querySelector('.cmh-sidebar__navigation');
            if (nav) {
                (this.setCmhPageSidebarOffset as (w: number) => void)(nav.offsetWidth);
            }
        }
    },

    unmounted() {
        if (this.propagateWidth && this.removeCmhPageSidebarOffset) {
            (this.removeCmhPageSidebarOffset as () => void)();
        }
    },

    methods: {
        _isItemRegistered(item: AwSidebarItemInstance): boolean {
            return this.items.includes(item);
        },

        _isAnyItemActive(): boolean {
            return this.items.some((item) => item.isActive);
        },

        closeSidebar() {
            this.isOpened = false;
        },

        registerSidebarItem(item: AwSidebarItemInstance) {
            if (this._isItemRegistered(item)) return;
            this.items.push(item);
            item.registerToggleActiveListener(this.setItemActive);
            item.registerCloseContentListener(this.closeSidebar);
        },

        setItemActive(clickedItem: AwSidebarItemInstance) {
            this.$emit('item-click', clickedItem);
            this.items.forEach((item) => {
                item.sidebarButtonClick?.(clickedItem);
            });
            if (clickedItem.hasDefaultSlot) {
                this.isOpened = this._isAnyItemActive();
            }
        },
    },
});

export interface AwSidebarItemInstance {
    isActive: boolean;
    hasDefaultSlot: boolean;
    position?: string;
    registerToggleActiveListener: (fn: (item: AwSidebarItemInstance) => void) => void;
    registerCloseContentListener: (fn: () => void) => void;
    sidebarButtonClick?: (clickedItem: AwSidebarItemInstance) => void;
}
