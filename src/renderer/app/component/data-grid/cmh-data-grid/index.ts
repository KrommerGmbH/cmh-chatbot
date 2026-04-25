import { defineComponent } from 'vue'
import template from './cmh-data-grid.html?raw';
import './cmh-data-grid.scss';

/**
 * @description AideWorks Data Grid – 범용 테이블 컴포넌트
 *  - 선택, 정렬, 인라인 편집, 컬럼 리사이즈, 컴팩트 모드 지원
 *  - identifier prop 지정 시 컬럼 설정을 localStorage 에 저장
 */
export default defineComponent({
    template,

    emits: [
        'selection-change',
        'select-all-items',
        'select-item',
        'row-click',
        'inline-edit-assign',
        'inline-edit-save',
        'inline-edit-cancel',
        'column-sort',
    ],

    props: {
        dataSource: {
            type: Array as () => Record<string, unknown>[],
            required: true,
        },

        columns: {
            type: Array as () => AwDataGridColumn[],
            required: true,
        },

        /** localStorage 저장 키 */
        identifier: {
            type: String,
            required: false,
            default: '',
        },

        showSelection: {
            type: Boolean,
            default: true,
            required: false,
        },

        showActions: {
            type: Boolean,
            default: true,
            required: false,
        },

        showHeader: {
            type: Boolean,
            default: true,
            required: false,
        },

        showSettings: {
            type: Boolean,
            default: false,
            required: false,
        },

        fullPage: {
            type: Boolean,
            default: false,
            required: false,
        },

        allowInlineEdit: {
            type: Boolean,
            default: false,
            required: false,
        },

        allowColumnEdit: {
            type: Boolean,
            default: false,
            required: false,
        },

        isLoading: {
            type: Boolean,
            default: false,
            required: false,
        },

        skeletonItemAmount: {
            type: Number,
            required: false,
            default: 7,
        },

        sortBy: {
            type: String,
            required: false,
            default: null,
        },

        sortDirection: {
            type: String,
            required: false,
            default: 'ASC',
        },

        naturalSorting: {
            type: Boolean,
            required: false,
            default: false,
        },

        compactMode: {
            type: Boolean,
            required: false,
            default: true,
        },

        plainAppearance: {
            type: Boolean,
            required: false,
            default: false,
        },

        showPreviews: {
            type: Boolean,
            required: false,
            default: true,
        },

        isRecordEditable: {
            type: Function,
            required: false,
            default() {
                return true;
            },
        },

        isRecordSelectable: {
            type: Function,
            required: false,
            default(this: { reachMaximumSelectionExceed: boolean; selection: Record<string, unknown>; itemIdentifierProperty: string }, item: Record<string, unknown>) {
                return (
                    !this.reachMaximumSelectionExceed ||
                    Object.keys(this.selection).includes(item[this.itemIdentifierProperty] as string)
                );
            },
        },

        itemIdentifierProperty: {
            type: String,
            required: false,
            default: 'id',
        },

        maximumSelectItems: {
            type: Number,
            required: false,
            default: null,
        },

        preSelection: {
            type: Object as () => Record<string, unknown>,
            required: false,
            default: null,
        },

        isRecordDisabled: {
            type: Function,
            required: false,
            default() {
                return false;
            },
        },

        contextButtonMenuWidth: {
            type: Number,
            required: false,
            default: 220,
        },
    },

    data() {
        return {
            records: this.dataSource as Record<string, unknown>[],
            currentSortBy: this.sortBy as string | null,
            currentSortDirection: this.sortDirection as string,
            currentNaturalSorting: this.naturalSorting as boolean,
            loading: this.isLoading as boolean,
            currentColumns: [] as AwDataGridColumn[],
            columnIndex: null as number | null,
            selection: { ...(this.preSelection || {}) } as Record<string, unknown>,
            originalTarget: null as HTMLElement | null,
            compact: this.compactMode as boolean,
            previews: this.showPreviews as boolean,
            isInlineEditActive: false,
            currentInlineEditId: '',
            hasPreviewSlots: false,
            hasResizeColumns: false,
            _hasColumnsResize: false,
            _isResizing: false,
        };
    },

    computed: {
        classes(): Record<string, boolean> {
            return {
                'is--compact': this.compact,
                'cmh-data-grid--full-page': this.fullPage,
                'cmh-data-grid--actions': this.showActions,
                'cmh-data-grid--plain-appearance': this.plainAppearance,
            };
        },

        selectionCount(): number {
            return Object.values(this.selection).length;
        },

        reachMaximumSelectionExceed(): boolean {
            if (!this.maximumSelectItems) return false;
            return this.selectionCount >= this.maximumSelectItems;
        },

        isSelectAllDisabled(): boolean {
            if (!this.maximumSelectItems) return false;
            if (!this.records) return false;
            const currentVisibleIds = this.records.map((r) => r[this.itemIdentifierProperty]);
            return (
                this.reachMaximumSelectionExceed &&
                Object.keys(this.selection).every((id) => !currentVisibleIds.includes(id))
            );
        },

        allSelectedChecked(): boolean {
            if (this.isSelectAllDisabled) return false;
            if (this.reachMaximumSelectionExceed) return true;
            if (!this.records || this.records.length === 0) return false;
            if (this.selectionCount < this.records.length) return false;
            const selectedItems = Object.values(this.selection) as Record<string, unknown>[];
            return this.records.every((item) =>
                selectedItems.some(
                    (sel) => (sel as Record<string, unknown>)[this.itemIdentifierProperty] === item[this.itemIdentifierProperty],
                ),
            );
        },

        hasInvisibleSelection(): boolean {
            if (!this.records) return false;
            const currentVisibleIds = this.records.map((r) => r[this.itemIdentifierProperty]);
            return this.selectionCount > 0 && Object.keys(this.selection).some((id) => !currentVisibleIds.includes(id));
        },

        currentVisibleColumns(): AwDataGridColumn[] {
            return this.currentColumns.filter((col) => col.visible);
        },
    },

    watch: {
        columns() {
            this.initGridColumns();
        },
        sortBy(v: string) { this.currentSortBy = v; },
        sortDirection(v: string) { this.currentSortDirection = v; },
        naturalSorting(v: boolean) { this.currentNaturalSorting = v; },
        isLoading(v: boolean) { this.loading = v; },
        dataSource(v: Record<string, unknown>[]) { this.records = v; },
        showSelection(v: boolean) { if (!v) this.selection = {}; },
        compactMode(v: boolean) { this.compact = v; },
        selection() {
            this.$emit('selection-change', this.selection, this.selectionCount);
        },
    },

    created() {
        this.createdComponent();
    },

    mounted() {
        this.mountedComponent();
    },

    unmounted() {
        window.removeEventListener('resize', this._onWindowResize as EventListener);
    },

    methods: {
        createdComponent() {
            this.initGridColumns();
        },

        mountedComponent() {
            this.trackScrollX();
            this.findPreviewSlots();
            this._onWindowResize = this.trackScrollX.bind(this);
            window.addEventListener('resize', this._onWindowResize as EventListener);
        },

        initGridColumns() {
            this.currentColumns = this.getDefaultColumns();
            this.findResizeColumns();
            if (!this.identifier) return;
            this.loadLocalSetting();
        },

        // ---------- localStorage 기반 설정 ----------
        loadLocalSetting() {
            try {
                const raw = localStorage.getItem(`cmh-data-grid.${this.identifier}`);
                if (!raw) return;
                const setting = JSON.parse(raw);
                this.applyUserSettings({
                    columns: setting?.columns ?? setting,
                    compact: setting?.compact,
                    previews: setting?.previews,
                });
            } catch {
                // ignore
            }
        },

        saveLocalSetting() {
            if (!this.identifier) return;
            try {
                localStorage.setItem(
                    `cmh-data-grid.${this.identifier}`,
                    JSON.stringify({
                        columns: this.currentColumns,
                        compact: this.compact,
                        previews: this.previews,
                    }),
                );
            } catch {
                // ignore
            }
        },

        applyUserSettings(userSettings: { columns?: AwDataGridColumn[]; compact?: boolean; previews?: boolean }) {
            if (typeof userSettings.compact === 'boolean') this.compact = userSettings.compact;
            if (typeof userSettings.previews === 'boolean') this.previews = userSettings.previews;
            if (!userSettings.columns) return;

            const userColumnMap: Record<string, { position: number } & Partial<AwDataGridColumn>> = {};
            userSettings.columns.forEach((col, idx) => {
                userColumnMap[col.dataIndex as string] = {
                    ...col,
                    position: idx,
                };
            });

            this.currentColumns = this.currentColumns
                .map((col) => {
                    const saved = userColumnMap[col.dataIndex as string];
                    if (!saved) return col;
                    return { ...col, ...saved };
                })
                .sort((a, b) => ((a.position ?? 0) - (b.position ?? 0)));
        },

        findResizeColumns() {
            this.hasResizeColumns = this.currentColumns.some((c) => c.allowResize);
        },

        findPreviewSlots() {
            this.hasPreviewSlots = Object.keys(this.$slots).some((s) => s.includes('preview-'));
        },

        getDefaultColumns(): AwDataGridColumn[] {
            return this.columns.map((column) => {
                const defaults: Partial<AwDataGridColumn> = {
                    width: 'auto',
                    allowResize: false,
                    sortable: true,
                    visible: true,
                    align: 'left',
                    naturalSorting: false,
                };
                if (!column.property) {
                    throw new Error(`[cmh-data-grid] "property"를 지정해주세요.`);
                }
                if (!column.dataIndex) {
                    column.dataIndex = column.property;
                }
                return { ...defaults, ...column };
            });
        },

        // ---------- 헤더 셀 클래스 ----------
        getHeaderCellClasses(column: AwDataGridColumn, index: number) {
            return [
                {
                    'cmh-data-grid__cell--sortable': column.sortable,
                    'cmh-data-grid__cell--icon-label': column.iconLabel,
                },
                `cmh-data-grid__cell--${index}`,
                `cmh-data-grid__cell--align-${column.align}`,
            ];
        },

        getRowClasses(item: Record<string, unknown>, itemIndex: number) {
            return [
                {
                    'is--inline-edit': this.isInlineEdit(item),
                    'is--selected': this.isSelected(item[this.itemIdentifierProperty] as string),
                    'is--disabled': (this.isRecordDisabled as (i: Record<string, unknown>) => boolean)(item),
                },
                `cmh-data-grid__row--${itemIndex}`,
            ];
        },

        getCellClasses(column: AwDataGridColumn) {
            return [
                `cmh-data-grid__cell--${column.property.replace(/\./g, '-')}`,
                `cmh-data-grid__cell--align-${column.align}`,
                { 'cmh-data-grid__cell--multi-line': column.multiLine },
            ];
        },

        // ---------- 컬럼 설정 이벤트 ----------
        onChangeCompactMode(value: boolean) {
            this.compact = value;
            this.saveLocalSetting();
        },

        onChangePreviews(value: boolean) {
            this.previews = value;
            this.saveLocalSetting();
        },

        onChangeColumnVisibility(value: boolean, index: number) {
            this.currentColumns[index].visible = value;
            this.saveLocalSetting();
        },

        onChangeColumnOrder(currentIdx: number, newIdx: number) {
            this.currentColumns = this.orderColumns(this.currentColumns, currentIdx, newIdx);
            this.saveLocalSetting();
        },

        orderColumns(columns: AwDataGridColumn[], oldIdx: number, newIdx: number): AwDataGridColumn[] {
            const copy = [...columns];
            copy.splice(newIdx, 0, copy.splice(oldIdx, 1)[0]);
            return copy;
        },

        // ---------- 인라인 편집 ----------
        enableInlineEdit() {
            this.isInlineEditActive = this.hasColumnWithInlineEdit();
            this.setAllColumnElementWidths();
        },

        hasColumnWithInlineEdit(): boolean {
            return this.currentColumns.some((c) => Object.prototype.hasOwnProperty.call(c, 'inlineEdit'));
        },

        isInlineEdit(item: Record<string, unknown>): boolean {
            return this.isInlineEditActive && this.currentInlineEditId === item[this.itemIdentifierProperty];
        },

        disableInlineEdit() {
            this.isInlineEditActive = false;
            this.currentInlineEditId = '';
        },

        onDbClickCell(item: Record<string, unknown>) {
            if (!this.allowInlineEdit) return;
            if (!(this.isRecordEditable as (i: Record<string, unknown>) => boolean)(item)) return;
            this.currentInlineEditId = item[this.itemIdentifierProperty] as string;
            this.enableInlineEdit();
            this.$emit('inline-edit-assign', item);
        },

        onClickSaveInlineEdit(item: Record<string, unknown>) {
            this.$emit('inline-edit-save', item);
            this.disableInlineEdit();
        },

        onClickCancelInlineEdit(item: Record<string, unknown>) {
            this.$emit('inline-edit-cancel', item);
            this.disableInlineEdit();
        },

        // ---------- 컬럼 숨기기 ----------
        hideColumn(columnIndex: number) {
            this.currentColumns[columnIndex].visible = false;
            this.saveLocalSetting();
        },

        // ---------- 컬럼 값 렌더링 ----------
        renderColumn(item: Record<string, unknown>, column: AwDataGridColumn): unknown {
            const accessor = column.property.split('.');
            let pointer: unknown = item;
            for (const part of accessor) {
                if (typeof pointer !== 'object' || pointer === null) {
                    console.warn(`[cmh-data-grid] accessor 해석 불가: ${column.property}`);
                    return undefined;
                }
                const cleanPart = part.replace('()', '');
                const rec = pointer as Record<string, unknown>;
                if (typeof rec[cleanPart] === 'function') {
                    pointer = (rec[cleanPart] as () => unknown)();
                } else if (rec['translated'] && (rec['translated'] as Record<string, unknown>)[cleanPart] !== undefined) {
                    pointer = (rec['translated'] as Record<string, unknown>)[cleanPart];
                } else {
                    pointer = rec[cleanPart];
                }
            }
            return pointer;
        },

        // ---------- 선택 ----------
        selectAll(selected: boolean) {
            this.records.forEach((item) => {
                if (this.isSelected(item[this.itemIdentifierProperty] as string) !== selected) {
                    this.selectItem(selected, item);
                }
            });
            this.$emit('select-all-items', this.selection);
        },

        selectItem(selected: boolean, item: Record<string, unknown>) {
            if (selected && this.reachMaximumSelectionExceed) return;
            if (!(this.isRecordSelectable as (i: Record<string, unknown>) => boolean)(item)) return;
            const key = item[this.itemIdentifierProperty] as string;
            if (selected) {
                this.selection = { ...this.selection, [key]: item };
            } else {
                this.selection = Object.fromEntries(
                    Object.entries(this.selection).filter(([k]) => k !== key),
                );
            }
            this.$emit('select-item', this.selection, item, selected);
        },

        isSelected(id: string): boolean {
            return Object.prototype.hasOwnProperty.call(this.selection, id);
        },

        resetSelection() {
            this.selection = {};
        },

        shouldIgnoreRowClick(target: EventTarget | null): boolean {
            if (!(target instanceof Element)) {
                return false;
            }

            return Boolean(
                target.closest(
                    'a, button, input, label, textarea, select, [role="button"], .mt-checkbox, .cmh-context-button, .cmh-context-menu-item',
                ),
            );
        },

        onRowClick(item: Record<string, unknown>, event: MouseEvent) {
            if (this.shouldIgnoreRowClick(event.target)) {
                return;
            }

            this.$emit('row-click', item, event);
        },

        // ---------- 정렬 ----------
        onClickHeaderCell(_event: MouseEvent, column: AwDataGridColumn) {
            if (!column.sortable) return;
            this.sort(column);
        },

        sort(column: AwDataGridColumn) {
            if (this.currentSortBy !== column.dataIndex) {
                this.currentSortBy = column.dataIndex as string;
                this.currentSortDirection = 'ASC';
            } else {
                this.currentSortDirection = this.currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
            }
            this.$emit('column-sort', this.currentSortBy, this.currentSortDirection);
        },

        // ---------- 리사이즈 ----------
        setAllColumnElementWidths() {
            const cells = this.$el?.querySelectorAll('.cmh-data-grid__cell--header.cmh-data-grid__cell--property');
            if (!cells) return;
            cells.forEach((cell: Element, i: number) => {
                if (this.currentColumns[i]) {
                    this.currentColumns[i].width = `${(cell as HTMLElement).offsetWidth}px`;
                }
            });
        },

        onStartResize(event: MouseEvent, column: AwDataGridColumn, columnIndex: number) {
            this._isResizing = true;
            this.columnIndex = columnIndex;
            this.originalTarget = event.target as HTMLElement;
            const startX = event.clientX;
            const startWidth = (event.target as HTMLElement).closest('th')?.offsetWidth ?? 0;

            const onMove = (e: MouseEvent) => {
                if (!this._isResizing) return;
                const diff = e.clientX - startX;
                this.currentColumns[columnIndex].width = `${Math.max(80, startWidth + diff)}px`;
            };
            const onUp = () => {
                this._isResizing = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        },

        // ---------- 스크롤 ----------
        trackScrollX() {
            const wrapper = this.$refs?.wrapper as HTMLElement;
            if (!wrapper) return;
            const isScrollable = wrapper.scrollWidth > wrapper.clientWidth;
            this._hasColumnsResize = isScrollable;
        },

        // ---------- i18n 헬퍼 ----------
        t(key: string) {
            return this.$t(key);
        },
    },
});

export interface AwDataGridColumn {
    property: string;
    label?: string;
    iconLabel?: string;
    iconTooltip?: string;
    dataIndex?: string;
    sortable?: boolean;
    visible?: boolean;
    allowResize?: boolean;
    width?: string;
    align?: 'left' | 'right' | 'center';
    naturalSorting?: boolean;
    inlineEdit?: string | boolean;
    multiLine?: boolean;
    routerLink?: string;
    primary?: boolean;
    position?: number;
}
