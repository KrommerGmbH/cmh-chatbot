import { defineComponent } from 'vue'
import template from './cmh-sortable-list.html?raw';
import './cmh-sortable-list.scss';

interface DragConfig {
    delay: number;
    dragGroup: number | string;
    draggableCls?: string;
    draggingStateCls?: string;
    dragElementCls?: string;
    validDragCls: string;
    invalidDragCls?: string;
    preventEvent: boolean;
    validateDrop?: boolean;
    validateDrag?: boolean;
    onDragStart?: (...args: unknown[]) => void;
    onDragEnter?: (...args: unknown[]) => void;
    onDragLeave?: (...args: unknown[]) => void;
    onDrop?: (...args: unknown[]) => void;
    data?: Record<string, unknown>;
    disabled: boolean;
}

interface ScrollOnDragConf {
    speed: number;
    margin: number;
    accelerationMargin: number;
}

interface SortableItem {
    id: string | number;
    [key: string]: unknown;
}

const defaultConfig: DragConfig = {
    delay: 300,
    dragGroup: 'cmh-sortable-list',
    validDragCls: 'is--valid-drag',
    preventEvent: true,
    disabled: false,
};

const defaultScrollOnDragConf: ScrollOnDragConf = {
    speed: 50,
    margin: 100,
    accelerationMargin: 0,
};

/**
 * @description A drag-and-drop sortable list component.
 * Uses v-draggable / v-droppable directives.
 * Emits `items-sorted` with the new order after drop.
 */
export default defineComponent({
    template,

    emits: ['items-sorted'],

    props: {
        items: {
            type: Array as () => SortableItem[],
            required: true,
        },

        sortable: {
            type: Boolean,
            required: false,
            default: true,
        },

        dragConf: {
            type: Object as () => Partial<DragConfig>,
            required: false,
            default(): Partial<DragConfig> {
                return {};
            },
        },

        scrollOnDrag: {
            type: Boolean,
            required: false,
            default: false,
        },

        scrollOnDragConf: {
            type: Object as () => Partial<ScrollOnDragConf>,
            required: false,
            default(): Partial<ScrollOnDragConf> {
                return {};
            },
        },
    },

    data() {
        return {
            defaultConfig: { ...defaultConfig } as DragConfig,
            defaultScrollOnDragConf: { ...defaultScrollOnDragConf } as ScrollOnDragConf,
            sortedItems: [...this.items] as SortableItem[],
            dragElement: null as Element | null,
            scrollEventTicking: false as boolean,
        };
    },

    computed: {
        hasItems(): boolean {
            return this.items.length > 0;
        },

        isSortable(): boolean {
            return this.sortable;
        },

        mergedDragConfig(): DragConfig {
            this.defaultConfig.onDragStart = this.onDragStart as (...args: unknown[]) => void;
            this.defaultConfig.onDragEnter = this.onDragEnter as (...args: unknown[]) => void;
            this.defaultConfig.onDrop = this.onDrop as (...args: unknown[]) => void;
            return { ...this.defaultConfig, ...this.dragConf } as DragConfig;
        },

        mergedScrollOnDragConfig(): ScrollOnDragConf {
            return { ...this.defaultScrollOnDragConf, ...this.scrollOnDragConf };
        },

        scrollableParent(): Element | null {
            return this.findScrollableParent(this.$el as Element | null);
        },
    },

    watch: {
        items(newItems: SortableItem[]) {
            this.sortedItems = [...newItems];
        },
    },

    methods: {
        findScrollableParent(node: Element | null): Element | null {
            if (!node) return null;
            if (node.scrollHeight > node.clientHeight) return node;
            return this.findScrollableParent(node.parentElement);
        },

        hasOrderChanged(): boolean {
            return JSON.stringify(this.sortedItems) !== JSON.stringify(this.items);
        },

        onDragEnter(dragged: SortableItem, dropped: SortableItem): void {
            if (!this.isSortable || !dragged || !dropped) return;
            if (dragged.id === dropped?.id) return;

            if (this.scrollOnDrag) this.scroll();

            const draggedIndex = this.sortedItems.findIndex((c) => c.id === dragged.id);
            const droppedIndex = this.sortedItems.findIndex((c) => c.id === dropped.id);

            if (draggedIndex < 0 || droppedIndex < 0) return;

            this.sortedItems.splice(droppedIndex, 0, this.sortedItems.splice(draggedIndex, 1)[0]);
        },

        onDragStart(_config: DragConfig, _draggedEl: Element, dragElement: Element): void {
            this.dragElement = dragElement;
            if (this.scrollOnDrag && this.scrollableParent) {
                this.scrollableParent.addEventListener('scroll', this.onScroll);
            }
        },

        onScroll(): void {
            if (!this.scrollEventTicking) {
                window.requestAnimationFrame(() => {
                    this.scroll();
                    this.scrollEventTicking = false;
                });
                this.scrollEventTicking = true;
            }
        },

        scroll(): void {
            if (!this.scrollableParent || !this.dragElement) return;

            const scrollableRect = this.scrollableParent.getBoundingClientRect();
            const dragRect = this.dragElement.getBoundingClientRect();
            const topDistance = dragRect.top - scrollableRect.top;
            const bottomDistance = scrollableRect.bottom - dragRect.bottom;
            const conf = this.mergedScrollOnDragConfig;
            let speed = conf.speed;

            if (topDistance < conf.margin) {
                if (topDistance < conf.accelerationMargin) {
                    speed *= 1 + Math.abs(topDistance / 20);
                }
                this.scrollableParent.scrollBy({ top: -speed, behavior: 'smooth' });
            }

            if (bottomDistance < conf.margin) {
                if (bottomDistance < conf.accelerationMargin) {
                    speed *= 1 + Math.abs(bottomDistance / 20);
                }
                this.scrollableParent.scrollBy({ top: speed, behavior: 'smooth' });
            }
        },

        onDrop(): void {
            this.dragElement = null;
            if (this.scrollOnDrag && this.scrollableParent) {
                this.scrollableParent.removeEventListener('scroll', this.onScroll);
            }
            if (!this.isSortable) return;
            this.$emit('items-sorted', this.sortedItems, this.hasOrderChanged());
        },
    },
});
