/**
 * @cmh-package framework
 */

import { defineComponent } from 'vue'
import { Criteria } from '@core/data';
import template from './cmh-range-filter.html?raw';
import './cmh-range-filter.scss';

/**
 * @private
 */
export default defineComponent({
    template,

    inject: ['feature'],

    emits: ['filter-update'],

    props: {
        value: {
            type: Object,
            required: true,
        },

        property: {
            type: String,
            required: true,
        },

        isShowDivider: {
            type: Boolean,
            required: false,
            default: true,
        },
    },

    computed: {},

    watch: {
        value: {
            deep: true,
            handler(newValue) {
                this.updateFilter(newValue);
            },
        },
    },

    methods: {
        updateFilter(range) {
            const params = {
                ...(range.from ? { gte: range.from } : {}),
                ...(range.to ? { lte: range.to } : {}),
            };

            const filterCriteria = [Criteria.range(this.property, params)];
            this.$emit('filter-update', filterCriteria);
        },
    },
});
