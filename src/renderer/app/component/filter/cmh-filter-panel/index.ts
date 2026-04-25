/**
 * @cmh-package framework
 */

import { defineComponent } from 'vue'
import type { CriteriaFilter } from '@core/data';
import template from './cmh-filter-panel.html?raw';
import './cmh-filter-panel.scss';

interface StoredFilterEntry {
    value: unknown;
    criteria: CriteriaFilter[] | null;
}

type StoredFilters = Record<string, StoredFilterEntry>;

/**
 * @private
 */
export default defineComponent({
    template,

    inject: ['repositoryFactory'],

    emits: ['criteria-changed'],

    props: {
        filters: {
            type: Array,
            required: true,
        },

        defaults: {
            type: Array,
            required: true,
        },

        storeKey: {
            type: String,
            required: true,
        },
    },

    data() {
        return {
            activeFilters: {} as Record<string, CriteriaFilter[]>,
            filterChanged: false,
            storedFilters: {} as StoredFilters,
        };
    },

    computed: {
        criteria() {
            const filters = [];

            Object.values(this.activeFilters).forEach((activeFilter) => {
                if (Array.isArray(activeFilter)) {
                    filters.push(...activeFilter);
                }
            });

            return filters;
        },

        isFilterActive() {
            return this.activeFiltersNumber > 0;
        },

        activeFiltersNumber() {
            return Object.keys(this.activeFilters).length;
        },

        listFilters() {
            const savedFilters = { ...this.storedFilters };
            const filters = [];

            this.filters.forEach((el) => {
                const filter = { ...el };
                const savedFilter = savedFilters[String(filter.name)];

                filter.value = savedFilter ? savedFilter.value : null;
                filter.filterCriteria = savedFilter ? savedFilter.criteria : null;

                filters.push(filter);
            });

            return filters;
        },
    },

    watch: {
        criteria: {
            handler() {
                if (this.filterChanged) {
                    this.persistStoredFilters();
                    this.$emit('criteria-changed', this.criteria);
                }
            },
            deep: true,
        },

        $route() {
            this.filterChanged = false;
            this.createdComponent();
        },
    },

    created() {
        this.createdComponent();
    },

    methods: {
        getStorageKey() {
            return `aw.filter.${this.storeKey}`;
        },

        persistStoredFilters() {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.storedFilters));
        },

        readStoredFilters(): StoredFilters {
            const raw = localStorage.getItem(this.getStorageKey());
            if (!raw) {
                return {};
            }

            try {
                return JSON.parse(raw) as StoredFilters;
            } catch {
                return {};
            }
        },

        createdComponent() {
            const filters = this.readStoredFilters();
            this.activeFilters = {};
            this.storedFilters = filters;

            this.listFilters.forEach((filter) => {
                const criteria = filters[String(filter.name)] ? filters[String(filter.name)].criteria : null;
                if (criteria) {
                    this.activeFilters[String(filter.name)] = criteria;
                }
            });
        },

        updateFilter(name, filter, value) {
            this.filterChanged = true;
            this.activeFilters[name] = filter;
            this.storedFilters[name] = { value: value, criteria: filter };
        },

        resetFilter(name) {
            this.filterChanged = true;
            delete this.activeFilters[name];
            this.storedFilters[name] = { value: null, criteria: null };
        },

        resetAll() {
            this.filterChanged = true;
            this.activeFilters = {};

            Object.keys(this.storedFilters).forEach((key) => {
                const entry = this.storedFilters[key];
                if (entry) {
                    entry.value = null;
                    entry.criteria = null;
                }
            });
        },

        showFilter(filter, type) {
            return filter.type === type && this.defaults.includes(filter.name);
        },

        getBreadcrumb(item) {
            if (item.breadcrumb?.length > 0) {
                return item.breadcrumb.join(' / ');
            }
            return item.translated?.name || item.name;
        },

        getLabelName(item) {
            if (item.breadcrumb && item.breadcrumb.length > 1) {
                return `.. / ${item.translated?.name || item.name} `;
            }

            return item.translated?.name || item.name;
        },
    },
});
