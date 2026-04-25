import { defineComponent } from 'vue'
import template from './cmh-pagination.html?raw';
import './cmh-pagination.scss';

/**
 * @description Pagination component for navigating large datasets.
 * Supports page size selection and smart page number display.
 */
export default defineComponent({
    template,

    emits: ['page-change'],

    props: {
        total: {
            type: Number,
            required: true,
        },

        limit: {
            type: Number,
            required: true,
        },

        page: {
            type: Number,
            required: true,
        },

        totalVisible: {
            type: Number,
            required: false,
            default: 7,
        },

        steps: {
            type: Array as () => number[],
            required: false,
            default() {
                return [10, 25, 50, 75, 100];
            },
        },

        autoHide: {
            type: Boolean,
            required: false,
            default: true,
        },
    },

    data() {
        return {
            currentPage: this.page as number,
            perPage: this.limit as number,
        };
    },

    computed: {
        maxPage(): number {
            return Math.ceil(this.total / this.perPage);
        },

        displayedPages(): (number | string)[] {
            const maxLength = this.totalVisible;
            const currentPage = this.currentPage;

            if (this.maxPage <= maxLength) {
                return this.range(1, this.maxPage);
            }

            const even = maxLength % 2 === 0 ? 1 : 0;
            const left = Math.floor(maxLength / 2);
            const right = this.maxPage - left + 1 + even;

            if (currentPage === left || (left === 1 && currentPage === left + 1)) {
                return [
                    ...this.range(1, left + 1),
                    '...',
                    ...this.range(right, this.maxPage),
                ];
            }

            if (currentPage === right || (right === this.maxPage && currentPage === this.maxPage - 1)) {
                return [
                    ...this.range(1, left),
                    '...',
                    ...this.range(right - 1, this.maxPage),
                ];
            }

            if (currentPage > left && currentPage < right) {
                const start = currentPage - left + 2;
                const end = currentPage + left - 2 - even;
                return [
                    1,
                    '...',
                    ...(start > end ? [currentPage] : this.range(start, end)),
                    '...',
                    this.maxPage,
                ];
            }

            return [
                ...this.range(1, left),
                '...',
                ...this.range(right, this.maxPage),
            ];
        },

        shouldBeVisible(): boolean {
            if (!this.autoHide) return true;
            return this.total > Math.min(...(this.steps as number[]));
        },

        possibleSteps(): number[] {
            const total = this.total;
            const stepsSorted = [...(this.steps as number[])].sort((a, b) => a - b);
            let lastStep: number | undefined;
            return stepsSorted.filter((x) => {
                if (lastStep !== undefined && lastStep > total) return false;
                lastStep = x;
                return true;
            });
        },

        possibleStepsOptions(): { value: string; label: string }[] {
            return this.possibleSteps.map((step) => ({
                value: String(step),
                label: String(step),
            }));
        },
    },

    watch: {
        page(val: number) {
            this.currentPage = val;
        },
        limit(val: number) {
            this.perPage = val;
        },
        maxPage() {
            if (this.maxPage === 0) {
                this.currentPage = 1;
                return;
            }
            if (this.currentPage > this.maxPage) {
                this.changePageByPageNumber(this.maxPage);
            }
        },
    },

    methods: {
        range(from: number, to: number): number[] {
            const result: number[] = [];
            for (let i = Math.max(from, 1); i <= to; i++) {
                result.push(i);
            }
            return result;
        },

        pageChange() {
            this.$emit('page-change', {
                page: this.currentPage,
                limit: this.perPage,
            });
        },

        onPageSizeChange(perPage: string) {
            this.perPage = Number(perPage);
            this.firstPage();
        },

        firstPage() {
            this.currentPage = 1;
            this.pageChange();
        },

        prevPage() {
            this.currentPage -= 1;
            this.pageChange();
        },

        nextPage() {
            this.currentPage += 1;
            this.pageChange();
        },

        lastPage() {
            this.currentPage = this.maxPage;
            this.pageChange();
        },

        changePageByPageNumber(pageNum: number) {
            this.currentPage = pageNum;
            this.pageChange();
        },

        refresh() {
            this.pageChange();
        },
    },
});
