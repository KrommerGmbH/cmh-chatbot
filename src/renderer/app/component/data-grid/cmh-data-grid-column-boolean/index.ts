import { defineComponent } from 'vue'
import template from './cmh-data-grid-column-boolean.html?raw';

export default defineComponent({
    template,

    emits: ['update:value'],

    props: {
        isInlineEdit: {
            type: Boolean,
            required: false,
            default: false,
        },
        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },
        value: {
            required: true,
        },
    },

    computed: {
        currentValue: {
            get() {
                return this.value;
            },
            set(newValue: unknown) {
                this.$emit('update:value', newValue);
            },
        },
    },
});
