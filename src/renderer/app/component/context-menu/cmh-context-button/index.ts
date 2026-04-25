import { defineComponent } from 'vue'
import template from './cmh-context-button.html?raw';
import './cmh-context-button.scss';

type HorizontalAlign = 'right' | 'left';
type VerticalAlign = 'bottom' | 'top';

/**
 * @description A button that toggles a context menu (three-dot or custom icon button).
 * The menu is teleported to <body> to avoid clipping.
 */
export default defineComponent({
    inheritAttrs: false,
    template,

    emits: ['on-open-change'],

    props: {
        showMenuOnStartup: {
            type: Boolean,
            required: false,
            default: false,
        },

        menuWidth: {
            type: Number,
            required: false,
            default: 220,
        },

        menuHorizontalAlign: {
            type: String as () => HorizontalAlign,
            required: false,
            default: 'right' as HorizontalAlign,
            validator(value: string) {
                return ['right', 'left'].includes(value);
            },
        },

        menuVerticalAlign: {
            type: String as () => VerticalAlign,
            required: false,
            default: 'bottom' as VerticalAlign,
            validator(value: string) {
                return ['bottom', 'top'].includes(value);
            },
        },

        icon: {
            type: String,
            required: false,
            default: 'regular-ellipsis-h-s',
        },

        iconSize: {
            type: String,
            required: false,
            default: '16px',
        },

        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },

        autoClose: {
            type: Boolean,
            required: false,
            default: true,
        },

        additionalContextMenuClasses: {
            type: Object,
            required: false,
            default(): Record<string, boolean> {
                return {};
            },
        },

        zIndex: {
            type: Number,
            required: false,
            default: 1100,
        },

        ariaLabel: {
            type: String,
            required: false,
            default: null as string | null,
        },
    },

    data() {
        return {
            showMenu: this.showMenuOnStartup as boolean,
            menuPositionStyle: {} as Record<string, string>,
        };
    },

    computed: {
        menuStyles(): Record<string, string> {
            return { width: `${this.menuWidth}px` };
        },

        contextClass(): Record<string, boolean> {
            return {
                'is--disabled': this.disabled,
                'is--active': this.showMenu,
            };
        },

        contextButtonClass(): Record<string, boolean> {
            return { 'is--active': this.showMenu };
        },

        contextMenuClass(): Record<string, boolean> {
            return {
                'is--left-align': this.menuHorizontalAlign === 'left',
                'is--top-align': this.menuVerticalAlign === 'top',
                ...this.additionalContextMenuClasses,
            };
        },
    },

    methods: {
        onClickButton() {
            if (this.disabled) return;
            if (this.showMenu) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        },

        openMenu() {
            this.$emit('on-open-change', true);
            this.showMenu = true;
            this.$nextTick(() => {
                this.updateMenuPosition();
            });
            document.addEventListener('click', this.handleClickEvent, { capture: false });
        },

        updateMenuPosition() {
            const root = this.$refs.awContextButtonRoot as HTMLElement | null;
            if (!root) return;
            const rect = root.getBoundingClientRect();
            const style: Record<string, string> = {
                position: 'fixed',
                zIndex: String(this.zIndex),
            };

            if (this.menuHorizontalAlign === 'right') {
                style.right = `${window.innerWidth - rect.right}px`;
            } else {
                style.left = `${rect.left}px`;
            }

            if (this.menuVerticalAlign === 'bottom') {
                style.top = `${rect.bottom + 4}px`;
            } else {
                style.bottom = `${window.innerHeight - rect.top + 4}px`;
            }

            this.menuPositionStyle = style;
        },

        handleClickEvent(event: MouseEvent) {
            const target = event.target as HTMLElement | null;
            if (!target) return this.closeMenu();

            if (target.classList.contains('is--disabled')) return;

            const root = this.$refs.awContextButtonRoot as HTMLElement | null;
            const menu = this.$refs.awContextMenu as HTMLElement | null;

            const clickedInsideRoot = root?.contains(target) ?? false;
            const clickedInsideMenu = menu?.contains(target) ?? false;

            if (!clickedInsideRoot && !clickedInsideMenu) {
                return this.closeMenu();
            }

            if (this.autoClose && !clickedInsideRoot) {
                return this.closeMenu();
            }
        },

        closeMenu() {
            this.$emit('on-open-change', false);
            this.showMenu = false;
            document.removeEventListener('click', this.handleClickEvent);
        },
    },

    unmounted() {
        document.removeEventListener('click', this.handleClickEvent);
    },
});
