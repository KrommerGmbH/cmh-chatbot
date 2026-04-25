import { defineComponent } from 'vue';
import type { LocationQuery, RouteLocationNamedRaw } from 'vue-router';

/**
 * Mixin: listing
 * Provides pagination, sorting, filtering, and route-query sync for list pages.
 *
 * Usage:
 * mixins: [ListingMixin],
 * methods: {
 *   getList() { // implement your own fetch }
 * }
 */
const ListingMixin = defineComponent({
    data(): {
        page: number;
        limit: number;
        total: number;
        sortBy: string | null;
        sortDirection: string;
        naturalSorting: boolean;
        selection: Record<string, unknown>;
        term: string | undefined;
        disableRouteParams: boolean;
        searchConfigEntity: string | null;
        entitySearchable: boolean;
        freshSearchTerm: boolean;
        previousRouteName: string;
    } {
        return {
            page: 1,
            limit: 25,
            total: 0,
            sortBy: null,
            sortDirection: 'ASC',
            naturalSorting: false,
            selection: {},
            term: undefined,
            disableRouteParams: false,
            searchConfigEntity: null,
            entitySearchable: true,
            freshSearchTerm: false,
            previousRouteName: '',
        };
    },

    computed: {
        maxPage(): number {
            return Math.ceil(this.total / this.limit);
        },

        routeName(): string | symbol | null | undefined {
            return this.$route?.name;
        },

        selectionArray(): unknown[] {
            return Object.values(this.selection);
        },

        selectionCount(): number {
            return this.selectionArray.length;
        },

        filters(): { active: boolean }[] {
            return [];
        },

        currentSortBy(): string | null {
            return this.freshSearchTerm ? null : this.sortBy;
        },
    },

    created() {
        this.previousRouteName = this.$route?.name as string ?? '';

        if (this.disableRouteParams) {
            this.getList();
            return;
        }

        const query: LocationQuery = this.$route?.query ?? {};

        if (!query || Object.keys(query).length === 0) {
            this.resetListing();
        } else {
            this.parseBooleanQueryParams(query);
            this.updateData(query as Record<string, string>);
            this.getList();
        }
    },

    watch: {
        $route(newRoute, oldRoute) {
            if (this.disableRouteParams || oldRoute?.name !== newRoute?.name) return;

            const query = this.$route?.query ?? {};

            if (!query || Object.keys(query).length === 0) {
                this.resetListing();
            }

            this.parseBooleanQueryParams(query as LocationQuery);
            this.updateData(query as Record<string, string>);
            this.getList();
        },

        term(newValue: string) {
            if (newValue?.length) {
                this.freshSearchTerm = true;
            }
        },

        sortBy() {
            this.freshSearchTerm = false;
        },

        sortDirection() {
            this.freshSearchTerm = false;
        },
    },

    methods: {
        updateData(customData: {
            page?: string | number;
            limit?: string | number;
            term?: string;
            sortBy?: string;
            sortDirection?: string;
            naturalSorting?: string | boolean;
        }) {
            if (customData.page) this.page = parseInt(String(customData.page), 10) || this.page;
            if (customData.limit) this.limit = parseInt(String(customData.limit), 10) || this.limit;
            if (customData.term !== undefined) this.term = customData.term;
            if (customData.sortBy) this.sortBy = customData.sortBy;
            if (customData.sortDirection) this.sortDirection = customData.sortDirection;
            if (customData.naturalSorting !== undefined) {
                this.naturalSorting = customData.naturalSorting === true || customData.naturalSorting === 'true';
            }
        },

        updateRoute(
            customQuery: {
                limit?: number;
                page?: number;
                term?: string;
                sortBy?: string;
                sortDirection?: string;
                naturalSorting?: boolean;
            },
            queryExtension: Record<string, unknown> = {},
        ) {
            const query = (customQuery || this.$route?.query) ?? {};
            const routeQuery = this.$route?.query ?? {};

            const route = {
                name: this.$route?.name,
                params: this.$route?.params,
                query: {
                    limit: query.limit ?? this.limit,
                    page: query.page ?? this.page,
                    term: query.term ?? this.term,
                    sortBy: query.sortBy ?? this.sortBy,
                    sortDirection: query.sortDirection ?? this.sortDirection,
                    naturalSorting: query.naturalSorting ?? this.naturalSorting,
                    ...queryExtension,
                },
            };

            if (!routeQuery || Object.keys(routeQuery).length === 0) {
                void this.$router?.replace(route as unknown as RouteLocationNamedRaw);
            } else {
                void this.$router?.push(route as unknown as RouteLocationNamedRaw);
            }
        },

        resetListing() {
            this.updateRoute({
                limit: this.limit,
                page: this.page,
                term: this.term,
                sortBy: this.sortBy ?? undefined,
                sortDirection: this.sortDirection,
                naturalSorting: this.naturalSorting,
            });
        },

        getMainListingParams() {
            if (this.disableRouteParams) {
                return {
                    limit: this.limit,
                    page: this.page,
                    term: this.term,
                    sortBy: this.sortBy,
                    sortDirection: this.sortDirection,
                    naturalSorting: this.naturalSorting,
                };
            }

            const query = this.$route?.query ?? {};
            return {
                limit: query.limit,
                page: query.page,
                term: query.term,
                sortBy: (query.sortBy as string) || this.sortBy,
                sortDirection: (query.sortDirection as string) || this.sortDirection,
                naturalSorting: query.naturalSorting ?? this.naturalSorting,
            };
        },

        updateSelection(selection: Record<string, unknown>) {
            this.selection = selection;
        },

        onPageChange(opts: { page: number; limit: number }) {
            this.page = opts.page;
            this.limit = opts.limit;
            if (this.disableRouteParams) {
                this.getList();
                return;
            }
            this.updateRoute({ page: this.page });
        },

        onSearch(value: string | undefined) {
            this.term = value;
            if (this.disableRouteParams) {
                this.page = 1;
                this.getList();
                return;
            }
            this.updateRoute({ term: this.term, page: 1 });
        },

        onSwitchFilter(filter: { active: boolean }, filterIndex: number) {
            this.filters[filterIndex].active = !this.filters[filterIndex].active;
            this.page = 1;
        },

        onSort({ sortBy, sortDirection }: { sortBy: string; sortDirection: string }) {
            if (this.disableRouteParams) {
                this.updateData({ sortBy, sortDirection });
            } else {
                this.updateRoute({ sortBy, sortDirection });
            }
            this.getList();
        },

        onSortColumn(column: { dataIndex: string; naturalSorting?: boolean }) {
            if (this.disableRouteParams) {
                if (this.sortBy === column.dataIndex) {
                    this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    this.sortDirection = 'ASC';
                    this.sortBy = column.dataIndex;
                }
                this.getList();
                return;
            }

            if (this.sortBy === column.dataIndex) {
                this.updateRoute({
                    sortDirection: this.sortDirection === 'ASC' ? 'DESC' : 'ASC',
                });
            } else {
                this.naturalSorting = column.naturalSorting ?? false;
                this.updateRoute({
                    sortBy: column.dataIndex,
                    sortDirection: 'ASC',
                    naturalSorting: column.naturalSorting,
                });
            }
        },

        onRefresh() {
            this.getList();
        },

        /** Override in component */
        getList() {
            console.warn('[ListingMixin] Implement getList() in your component.');
        },

        parseBooleanQueryParams(query: LocationQuery) {
            Object.keys(query).forEach((key) => {
                if (String(query[key]).toLowerCase() === 'true') {
                    (query as Record<string, unknown>)[key] = true;
                } else if (String(query[key]).toLowerCase() === 'false') {
                    (query as Record<string, unknown>)[key] = false;
                }
            });
        },
    },
});

export default ListingMixin;
