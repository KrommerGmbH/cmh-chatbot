import { defineComponent } from 'vue'
import template from './cmh-entity-listing.html?raw';
import AwDataGrid from '../../data-grid/cmh-data-grid';

/**
 * @description cmh-data-grid를 extends하여 repository 기반 CRUD 리스팅을 제공
 *  - repository.search / delete / syncDeleted 패턴
 *  - items prop에 { data, total, criteria, context } 형태의 EntityCollection 대응
 */
export default defineComponent({
    template,

    extends: AwDataGrid,

    inject: {
        repositoryFactory: { default: null },
    },

    emits: [
        'update-records',
        'delete-item-finish',
        'delete-item-failed',
        'delete-items-failed',
        'items-delete-finish',
        'inline-edit-save',
        'inline-edit-cancel',
        'column-sort',
        'row-click',
        'page-change',
        'bulk-edit-modal-open',
        'bulk-edit-modal-close',
    ],

    props: {
        dataSource: {
            type: Array as () => Record<string, unknown>[],
            required: false,
            default() {
                return [];
            },
        },

        detailRoute: {
            type: String,
            required: false,
            default: null,
        },

        repository: {
            type: Object,
            required: false,
            default: null,
        },

        items: {
            type: Object as () => AwEntityCollection | null,
            required: false,
            default: null,
        },

        steps: {
            type: Array as () => number[],
            required: false,
            default() {
                return [10, 25, 50, 75, 100];
            },
        },

        fullPage: {
            type: Boolean,
            required: false,
            default: true,
        },

        allowInlineEdit: {
            type: Boolean,
            required: false,
            default: true,
        },

        allowColumnEdit: {
            type: Boolean,
            required: false,
            default: true,
        },

        criteriaLimit: {
            type: Number,
            required: false,
            default: 25,
        },

        currentPage: {
            type: Number,
            required: false,
            default: null,
        },

        perPage: {
            type: Number,
            required: false,
            default: null,
        },

        totalItems: {
            type: Number,
            required: false,
            default: null,
        },

        allowEdit: {
            type: Boolean,
            required: false,
            default: true,
        },

        allowView: {
            type: Boolean,
            required: false,
            default: false,
        },

        allowDelete: {
            type: Boolean,
            required: false,
            default: true,
        },

        disableDataFetching: {
            type: Boolean,
            required: false,
            default: false,
        },

        naturalSorting: {
            type: Boolean,
            required: false,
            default: false,
        },

        allowBulkEdit: {
            type: Boolean,
            required: false,
            default: false,
        },

        showBulkEditModal: {
            type: Boolean,
            required: false,
            default: false,
        },

        maximumSelectItems: {
            type: Number,
            required: false,
            default: 1000,
        },

    },

    data() {
        return {
            deleteId: null as string | null,
            showBulkDeleteModal: false,
            isBulkLoading: false,
            page: (this.currentPage as number | null) ?? 1,
            limit: (this.perPage as number | null) ?? (this.criteriaLimit as number),
            total: (this.totalItems as number | null) ?? 0,
            lastSortedColumn: null as Record<string, unknown> | null,
        };
    },

    computed: {
        detailPageLinkText(): string {
            if (!this.allowEdit && this.allowView) {
                return this.$t('cmh-global.default.view');
            }
            return this.$t('cmh-global.default.edit');
        },

        dataGridProps(): Record<string, unknown> {
            return {
                columns: this.columns,
                identifier: this.identifier,
                showSelection: this.showSelection,
                showActions: this.showActions,
                showHeader: this.showHeader,
                showSettings: this.showSettings,
                fullPage: this.fullPage,
                allowInlineEdit: this.allowInlineEdit,
                allowColumnEdit: this.allowColumnEdit,
                sortBy: this.sortBy,
                sortDirection: this.sortDirection,
                naturalSorting: this.naturalSorting,
                compactMode: this.compactMode,
                plainAppearance: this.plainAppearance,
                showPreviews: this.showPreviews,
                isRecordEditable: this.isRecordEditable,
                isRecordSelectable: this.isRecordSelectable,
                itemIdentifierProperty: this.itemIdentifierProperty,
                maximumSelectItems: this.maximumSelectItems,
                preSelection: this.preSelection,
                isRecordDisabled: this.isRecordDisabled,
                contextButtonMenuWidth: this.contextButtonMenuWidth,
                skeletonItemAmount: this.skeletonItemAmount,
            };
        },
    },

    watch: {
        items(newItems: AwEntityCollection) {
            if (newItems) this.applyResult(newItems);
        },
        currentPage(newPage: number | null) {
            if (typeof newPage === 'number' && newPage > 0) {
                this.page = newPage;
            }
        },
        perPage(newLimit: number | null) {
            if (typeof newLimit === 'number' && newLimit > 0) {
                this.limit = newLimit;
            }
        },
        totalItems(newTotal: number | null) {
            if (typeof newTotal === 'number' && newTotal >= 0) {
                this.total = newTotal;
            }
        },
        dataSource(newData: Record<string, unknown>[]) {
            if (this.totalItems === null) {
                this.total = Array.isArray(newData) ? newData.length : 0;
            }
        },
    },

    created() {
        this.createdComponent();
    },

    methods: {
        createdComponent() {
            // parent createdComponent 호출
            (AwDataGrid as any).methods && (AwDataGrid as any).methods.createdComponent?.call(this);
            if (this.items) {
                this.applyResult(this.items);
            }
        },

        onDataGridColumnSort(sortBy: string, sortDirection: string) {
            const column = this.currentColumns.find((entry: Record<string, unknown>) => {
                const dataIndex = entry.dataIndex ?? entry.property;
                return dataIndex === sortBy || entry.property === sortBy;
            });

            if (!column) {
                return false;
            }

            return this.sort(column, sortDirection);
        },

        applyResult(result: AwEntityCollection) {
            this.records = result.data ?? result as unknown as Record<string, unknown>[];
            this.total = result.total ?? 0;
            this.page = result.criteria?.page ?? 1;
            this.limit = result.criteria?.limit ?? this.criteriaLimit;
            this.loading = false;

            if (result.criteria?.sortings?.[0]?.field) {
                this.currentSortBy = result.criteria.sortings[0].field;
            }

            this.$emit('update-records', result);
        },

        deleteItem(id: string) {
            this.deleteId = null;
            return this.repository
                .delete(id, this.items?.context)
                .then(() => {
                    this.resetSelection();
                    this.$emit('delete-item-finish', id);
                    return this.doSearch();
                })
                .catch((errorResponse: unknown) => {
                    this.$emit('delete-item-failed', { id, errorResponse });
                });
        },

        deleteItems() {
            this.isBulkLoading = true;
            const selectedIds = Object.keys(this.selection);
            return this.repository
                .syncDeleted(selectedIds, this.items?.context)
                .then(() => this.deleteItemsFinish())
                .catch((errorResponse: unknown) => {
                    this.$emit('delete-items-failed', { selectedIds, errorResponse });
                    return this.deleteItemsFinish();
                });
        },

        deleteItemsFinish() {
            this.resetSelection();
            this.isBulkLoading = false;
            this.showBulkDeleteModal = false;
            this.$emit('items-delete-finish');
            return this.doSearch();
        },

        doSearch() {
            this.loading = true;
            return this.repository
                .search(this.items?.criteria, this.items?.context)
                .then((result: AwEntityCollection) => this.applyResult(result));
        },

        save(record: Record<string, unknown>) {
            const promise = this.repository.save(record, this.items?.context).then(() => this.doSearch());
            this.$emit('inline-edit-save', promise, record);
            return promise;
        },

        revert() {
            const promise = this.doSearch();
            this.$emit('inline-edit-cancel', promise);
            return promise;
        },

        sort(column: Record<string, unknown>, forcedDirection?: string) {
            this.lastSortedColumn = column;
            let direction = forcedDirection ?? 'ASC';

            if (!forcedDirection && this.currentSortBy === (column.dataIndex ?? column.property)) {
                direction = this.currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
            }

            this.items?.criteria?.resetSorting?.();
            String(column.dataIndex ?? column.property)
                .split(',')
                .forEach((field) => {
                    this.items?.criteria?.addSorting?.({
                        field,
                        order: direction,
                        naturalSorting: column.naturalSorting ?? this.naturalSorting,
                    });
                });

            this.currentSortBy = String(column.dataIndex ?? column.property);
            this.currentSortDirection = direction;
            this.currentNaturalSorting = Boolean(column.naturalSorting ?? this.naturalSorting);

            this.$emit('column-sort', column, this.currentSortDirection);

            if (column.useCustomSort || this.disableDataFetching) {
                return false;
            }

            return this.doSearch();
        },

        paginate({ page, limit }: { page: number; limit: number }) {
            this.page = page;
            this.limit = limit;
            if (this.items?.criteria) {
                this.items.criteria.page = page;
                this.items.criteria.limit = limit;
                this.items.criteria.setPage?.(page);
                this.items.criteria.setLimit?.(limit);
            }
            this.$emit('page-change', { page, limit });

            if (this.disableDataFetching) {
                return false;
            }

            return this.doSearch();
        },

        showDelete(id: string) {
            this.deleteId = id;
        },

        closeModal() {
            this.deleteId = null;
        },

        onClickBulkEdit() {
            this.$emit('bulk-edit-modal-open');
        },

        onCloseBulkEditModal() {
            this.$emit('bulk-edit-modal-close');
        },
    },
});

export interface AwEntityCollection {
    data?: Record<string, unknown>[];
    total?: number;
    context?: unknown;
    criteria?: {
        page?: number;
        limit?: number;
        sortings?: Array<{ field: string; order: string; naturalSorting?: boolean }>;
        resetSorting?: () => void;
        addSorting?: (sorting: { field: unknown; order: string; naturalSorting?: boolean }) => void;
        setPage?: (page: number) => void;
        setLimit?: (limit: number) => void;
    };
    [key: string]: unknown;
}
