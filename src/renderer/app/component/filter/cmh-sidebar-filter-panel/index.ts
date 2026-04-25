/**
 * @cmh-package framework
 */

import { defineComponent } from 'vue'
import template from './cmh-sidebar-filter-panel.html?raw';
import './cmh-sidebar-filter-panel.scss';

/**
 * @private
 */
export default defineComponent({
    template,

    props: {
        activeFilterNumber: {
            type: Number,
            required: true,
        },
    },

    computed: {},

    methods: {
        resetAll() {
            const filterPanel = this.$refs.filterPanel as { resetAll?: () => void } | undefined;
            filterPanel?.resetAll?.();
        },
    },
});
