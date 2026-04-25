/**
 * @cmh-package framework
 */

import { defineComponent } from 'vue'
import template from './cmh-base-filter.html?raw';
import './cmh-base-filter.scss';

/**
 * @private
 */
export default defineComponent({
    template,

    emits: ['filter-reset'],

    props: {
        title: {
            type: String,
            required: true,
        },
        showResetButton: {
            type: Boolean,
            required: true,
        },
        active: {
            type: Boolean,
            required: true,
        },
    },

    watch: {
        active(value) {
            if (!value) {
                this.resetFilter();
            }
        },
    },

    methods: {
        resetFilter() {
            this.$emit('filter-reset');
        },
    },
});
