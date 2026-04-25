import { defineComponent } from 'vue'
import { PropType } from 'vue';
import template from './cmh-one-to-many-grid.html?raw';
import AwDataGrid from '../../data-grid/cmh-data-grid';

/**
 * @description 1:N 관계 그리드 컴포넌트
 *  - localMode: true → 부모 엔티티와 함께 저장되는 컬렉션 (로컬 배열)
 *  - localMode: false → repository.search/delete 사용
 */
export default defineComponent({
    template,

    extends: AwDataGrid,

    inject: {
        repositoryFactory: { default: null },
    },

    emits: [
        'load-finish',
        'delete-item-failed',
        'items-delete-finish',
        'column-sort',
    ],

    props: {
        collection: {
            required: true,
            type: Array as () => Record<string, unknown>[],
        },

        localMode: {
            type: Boolean,
            default: true,
        },

        dataSource: {
            type: [Array, Object] as PropType<Record<string, unknown>[] | null>,
            required: false,
            default(props: { localMode: boolean; collection: Record<string, unknown>[] | null }) {
                return props.localMode && props.collection ? props.collection : null;
            },
        },

        allowDelete: {
            type: Boolean,
            required: false,
            default: true,
        },

        tooltipDelete: {
            type: Object,
            required: false,
            default() {
                return { message: '', disabled: true };
            },
        },
    },

    data() {
        return {
            page: 1,
            limit: 25,
            total: 0,
            initial: true,
            result: null as Record<string, unknown> | null,
            // repository는 remote 모드에서 createdComponent에서 초기화
            _repository: null as Record<string, unknown> | null,
        };
    },

    watch: {
        collection: {
            handler() {
                if (!this.initial) this.load();
            },
            deep: true,
        },
    },

    created() {
        this.createdComponent();
    },

    methods: {
        createdComponent() {
            // AwDataGrid 부모 초기화
            (AwDataGrid as any).methods?.createdComponent?.call(this);

            this.applyResult(this.collection);
            this.initial = false;

            if (this.localMode) {
                return Promise.resolve();
            }

            const col = this.collection as Record<string, unknown> & {
                entity?: string;
                source?: string;
            };
            this._repository = this.repositoryFactory?.create(col.entity, col.source);

            if (Array.isArray(this.records) && this.records.length > 0) {
                return Promise.resolve();
            }

            return this.load();
        },

        applyResult(result: Record<string, unknown>) {
            this.result = result;
            const arr = result as unknown as Record<string, unknown>[];
            if (!this.collection || !this.initial) {
                this.records = arr;
            }
            const res = result as { total?: number; length?: number; criteria?: { page?: number; limit?: number } };
            this.total = res.total ?? (res as unknown as unknown[]).length ?? 0;
            if (res.criteria) {
                this.page = res.criteria.page ?? this.page;
                this.limit = res.criteria.limit ?? this.limit;
            }
        },

        save(record: Record<string, unknown>) {
            if (this.localMode) return Promise.resolve();
            return this._repository?.save(record, this.result?.context).then(() => this.load());
        },

        revert() {
            if (this.localMode) return Promise.resolve();
            return this.load();
        },

        load() {
            if (this.localMode) return Promise.resolve();
            return this._repository
                ?.search((this.result as Record<string, unknown>)?.criteria, (this.result as Record<string, unknown>)?.context)
                .then((response: Record<string, unknown>) => {
                    this.applyResult(response);
                    this.$emit('load-finish');
                });
        },

        deleteItem(id: string) {
            if (this.localMode) {
                const col = this.collection as { remove?: (id: string) => void };
                col.remove?.(id);
                return Promise.resolve();
            }
            return this._repository
                ?.delete(id, this.result?.context)
                .then(() => {
                    this.resetSelection();
                    return this.load();
                })
                .catch((errorResponse: unknown) => {
                    this.$emit('delete-item-failed', { id, errorResponse });
                });
        },

        deleteItems() {
            const selection = Object.values(this.selection) as Record<string, unknown>[];
            if (this.localMode) {
                const col = this.collection as { remove?: (id: string) => void };
                selection.forEach((item) => col.remove?.(item.id as string));
                this.resetSelection();
                return Promise.resolve();
            }
            this.isBulkLoading = true;
            const selectedIds = selection.map((item) => item.id as string);
            return this._repository
                ?.syncDeleted(selectedIds, this.result?.context)
                .then(() => {
                    this.resetSelection();
                    return this.load();
                })
                .catch(() => this.deleteItemsFinish());
        },

        deleteItemsFinish() {
            this.resetSelection();
            this.isBulkLoading = false;
            this.$emit('items-delete-finish');
            return this.load();
        },

        sort(column: Record<string, unknown>) {
            if (this.localMode) {
                this.$emit('column-sort', column);
                return Promise.resolve();
            }

            const criteria = (this.result as Record<string, unknown>)?.criteria as {
                resetSorting: () => void;
                addSorting: (sort: unknown) => void;
            };

            criteria?.resetSorting();

            let direction = 'ASC';
            if (this.currentSortBy === column.dataIndex) {
                if (this.currentSortDirection === direction) direction = 'DESC';
            }
            criteria?.addSorting({ field: column.dataIndex, order: direction, naturalSorting: !!column.naturalSorting });

            this.currentSortBy = column.dataIndex as string;
            this.currentSortDirection = direction;
            this.currentNaturalSorting = !!column.naturalSorting;

            return this.load();
        },

        paginate({ page, limit }: { page: number; limit: number }) {
            if (this.localMode) return Promise.resolve();
            const criteria = (this.result as Record<string, unknown>)?.criteria as {
                setPage: (p: number) => void;
                setLimit: (l: number) => void;
            };
            criteria?.setPage(page);
            criteria?.setLimit(limit);
            return this.load();
        },
    },
});
