import { defineComponent } from 'vue'
import template from './cmh-data-grid-inline-edit.html?raw';
import './cmh-data-grid-inline-edit.scss';

export default defineComponent({
    template,

    emits: ['update:value'],

    props: {
        column: {
            type: Object,
            required: true,
            default() { return {}; },
        },
        value: {
            required: true,
        },
        compact: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            currentValue: null as unknown,
        };
    },

    computed: {
        classes(): Record<string, boolean> {
            return { 'is--compact': this.compact };
        },

        inputFieldSize(): string {
            return this.compact ? 'small' : 'default';
        },
    },

    created() {
        this.currentValue = this.value;
    },

    methods: {
        emitInput() {
            this.$emit('update:value', this.currentValue);
        },
    },
});
