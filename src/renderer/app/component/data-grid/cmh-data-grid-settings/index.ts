import { defineComponent } from 'vue'
import template from './cmh-data-grid-settings.html?raw';
import './cmh-data-grid-settings.scss';
import type { AwDataGridColumn } from '../cmh-data-grid';

export default defineComponent({
    template,

    emits: [
        'change-compact-mode',
        'change-preview-images',
        'change-column-visibility',
        'change-column-order',
    ],

    props: {
        columns: {
            type: Array as () => AwDataGridColumn[],
            default() { return []; },
            required: true,
        },
        compact: {
            type: Boolean,
            required: true,
            default: false,
        },
        previews: {
            type: Boolean,
            required: true,
            default: false,
        },
        enablePreviews: {
            type: Boolean,
            required: true,
            default: false,
        },
        disabled: {
            type: Boolean,
            required: true,
            default: false,
        },
    },

    data() {
        return {
            currentCompact: this.compact as boolean,
            currentPreviews: this.previews as boolean,
            currentColumns: this.columns as AwDataGridColumn[],
        };
    },

    computed: {
        contextMenuClasses(): Record<string, boolean> {
            return {
                'cmh-data-grid-settings': true,
            };
        },
    },

    watch: {
        columns() { this.currentColumns = this.columns; },
        compact() { this.currentCompact = this.compact; },
        previews() { this.currentPreviews = this.previews; },
    },

    methods: {
        getColumnLabel(column: AwDataGridColumn): string {
            const label = String(column.label ?? '');
            return this.$te?.(label) ? this.$t(label) : label;
        },

        onChangeCompactMode(value: boolean) {
            this.currentCompact = value;
            this.$emit('change-compact-mode', value);
        },

        onChangePreviews(value: boolean) {
            this.currentPreviews = value;
            this.$emit('change-preview-images', value);
        },

        onChangeColumnVisibility(value: boolean, index: number) {
            this.$emit('change-column-visibility', value, index);
        },

        onClickChangeColumnOrderUp(column: AwDataGridColumn) {
            const idx = this.currentColumns.findIndex((c) => c.property === column.property);
            this.$emit('change-column-order', idx, idx - 1);
        },

        onClickChangeColumnOrderDown(column: AwDataGridColumn) {
            const idx = this.currentColumns.findIndex((c) => c.property === column.property);
            this.$emit('change-column-order', idx, idx + 1);
        },
    },
});
