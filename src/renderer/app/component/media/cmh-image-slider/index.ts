import { defineComponent } from 'vue'
import template from './cmh-image-slider.html?raw';
import './cmh-image-slider.scss';

type ImageItem = string | { src: string; description?: string };

/**
 * @description 이미지 슬라이더 컴포넌트.
 * Shopware.Filter.asset 의존 제거 → 유효한 URL이면 그대로, 아니면 src 직접 사용.
 *
 * @emits image-change(index: number)
 */
export default defineComponent({
    template,

    emits: ['image-change'],

    props: {
        images: {
            type: Array as () => ImageItem[],
            required: true,
        },

        canvasWidth: {
            type: Number,
            required: false,
            default: 0,
            validator: (v: number) => v >= 0,
        },

        canvasHeight: {
            type: Number,
            required: false,
            default: 0,
            validator: (v: number) => v >= 0,
        },

        gap: {
            type: Number,
            required: false,
            default: 20,
            validator: (v: number) => v >= 0,
        },

        elementPadding: {
            type: Number,
            required: false,
            default: 0,
            validator: (v: number) => v >= 0,
        },

        navigationType: {
            type: String,
            required: false,
            default: 'arrow',
            validator: (v: string) => ['arrow', 'button', 'all'].includes(v),
        },

        enableDescriptions: {
            type: Boolean,
            required: false,
            default: false,
        },

        overflow: {
            type: String,
            required: false,
            default: 'hidden',
            validator: (v: string) => ['hidden', 'visible'].includes(v),
        },

        rewind: {
            type: Boolean,
            required: false,
            default: false,
        },

        bordered: {
            type: Boolean,
            required: false,
            default: true,
        },

        rounded: {
            type: Boolean,
            required: false,
            default: true,
        },

        autoWidth: {
            type: Boolean,
            required: false,
            default: false,
        },

        itemPerPage: {
            type: Number,
            required: false,
            default: 1,
        },

        initialIndex: {
            type: Number,
            required: false,
            default: 0,
        },

        arrowStyle: {
            type: String,
            required: false,
            default: 'inside',
            validator: (v: string) => ['inside', 'outside', 'none'].includes(v),
        },

        buttonStyle: {
            type: String,
            required: false,
            default: 'outside',
            validator: (v: string) => ['inside', 'outside', 'none'].includes(v),
        },

        displayMode: {
            type: String,
            required: false,
            default: 'cover',
            validator: (v: string) => ['contain', 'cover', 'none'].includes(v),
        },
    },

    data() {
        return {
            currentPageNumber: 0 as number,
            currentItemIndex: 0 as number,
        };
    },

    computed: {
        totalPage(): number {
            return Math.ceil(this.images.length / this.itemPerPage);
        },

        remainder(): number {
            return this.images.length % this.itemPerPage;
        },

        buttonList(): ImageItem[] {
            if (this.itemPerPage === 1) return this.images;
            return this.images.filter((_, index) => index % this.itemPerPage === 0);
        },

        wrapperStyles(): Record<string, string> {
            return {
                width: this.canvasWidth ? `${this.canvasWidth}px` : '100%',
            };
        },

        componentStyles(): Record<string, string> {
            return {
                width: this.autoWidth ? 'auto' : `${100 / this.images.length}%`,
            };
        },

        containerStyles(): Record<string, string | number> {
            const offset = this.arrowStyle === 'outside' ? 112 : 0;
            const width = this.canvasWidth
                ? `${this.canvasWidth - offset}px`
                : `calc(100% - ${offset}px)`;

            return {
                width,
                overflowX: this.overflow as string,
                margin: this.arrowStyle === 'outside' ? '0 56px' : 0,
            };
        },

        scrollableContainerStyles(): Record<string, string> {
            if (
                this.itemPerPage === 1 ||
                this.remainder === 0 ||
                this.images.length <= this.itemPerPage
            ) {
                return {
                    width: `${this.totalPage * 100}%`,
                    gap: `${this.gap}px`,
                    transform: `translateX(-${(this.currentPageNumber / this.totalPage) * 100}%)`,
                };
            }

            const itemWidth = 100 / this.images.length;
            const translateAmount =
                this.currentPageNumber === this.totalPage - 1
                    ? ((this.currentPageNumber - 1) * this.itemPerPage + this.remainder) * itemWidth
                    : this.currentPageNumber * this.itemPerPage * itemWidth;

            return {
                width: `${(this.totalPage - 1 + this.remainder / this.itemPerPage) * 100}%`,
                gap: `${this.gap}px`,
                transform: `translateX(-${translateAmount}%)`,
            };
        },

        imageStyles(): Record<string, string> {
            return { objectFit: this.displayMode };
        },

        buttonClasses(): Record<string, boolean> {
            return { 'is--button-inside': this.buttonStyle === 'inside' };
        },

        showButtons(): boolean {
            return (
                this.images.length >= 2 &&
                this.images.length > this.itemPerPage &&
                ['button', 'all'].includes(this.navigationType)
            );
        },

        showArrows(): boolean {
            return (
                this.images.length > this.itemPerPage &&
                ['arrow', 'all'].includes(this.navigationType)
            );
        },
    },

    watch: {
        initialIndex: {
            immediate: true,
            handler(value: number) {
                this.onSetCurrentItem(value);
            },
        },
    },

    methods: {
        setCurrentPageNumber(pageNumber: number) {
            this.currentPageNumber = pageNumber;
        },

        isImageObject(image: ImageItem): image is { src: string; description?: string } {
            return typeof image === 'object';
        },

        hasValidDescription(image: ImageItem): boolean {
            return (
                this.enableDescriptions &&
                this.isImageObject(image) &&
                Object.prototype.hasOwnProperty.call(image, 'description') &&
                (image as { description?: string }).description!.length >= 1
            );
        },

        getImage(image: ImageItem): string {
            const link = (typeof image === 'object' && image !== null ? image.src : image) as string;

            try {
                new URL(link);
                return link;
            } catch {
                // 절대 URL이 아닌 경우 그대로 반환 (앱 내 에셋 경로 등)
                return link;
            }
        },

        imageAlt(index: number): string {
            return this.$t('cmh-global.media.imageAlt', {
                index: index + 1,
                total: this.images.length,
            });
        },

        goToPreviousImage() {
            this.currentPageNumber =
                this.rewind && this.currentPageNumber === 0
                    ? this.totalPage - 1
                    : Math.max(this.currentPageNumber - 1, 0);

            if (this.itemPerPage === 1) {
                this.currentItemIndex = this.currentPageNumber;
                this.$emit('image-change', this.currentPageNumber);
            }
        },

        goToNextImage() {
            this.currentPageNumber =
                this.rewind && this.currentPageNumber === this.totalPage - 1
                    ? 0
                    : Math.min(this.currentPageNumber + 1, this.totalPage - 1);

            if (this.itemPerPage === 1) {
                this.currentItemIndex = this.currentPageNumber;
                this.$emit('image-change', this.currentPageNumber);
            }
        },

        elementClasses(index: number): Record<string, boolean>[] {
            return [
                { 'is--active': index === this.currentItemIndex && this.itemPerPage > 1 },
                { 'is--bordered': this.bordered },
                { 'is--rounded': this.rounded },
            ];
        },

        elementStyles(image: ImageItem, index: number): Record<string, string | number> {
            return {
                cursor: index === this.currentItemIndex ? 'default' : 'pointer',
                height: this.canvasHeight ? `${this.canvasHeight}px` : '100%',
                padding: this.elementPadding ? `${this.elementPadding}px` : '0',
                ...this.borderStyles(image),
            };
        },

        imageClasses(index: number): Record<string, boolean> {
            return {
                'is--active': index === this.currentItemIndex,
                'is--auto-width': this.autoWidth,
            };
        },

        borderStyles(image: ImageItem): Record<string, string | number> {
            if (!this.hasValidDescription(image)) return {};
            return {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
            };
        },

        onSetCurrentItem(index: number) {
            if (index === this.currentItemIndex) return;

            this.currentPageNumber = Math.floor(index / this.itemPerPage);
            this.currentItemIndex = index;
            this.$emit('image-change', index);
        },

        isHiddenItem(index: number): boolean {
            if (this.itemPerPage === 1) {
                return index !== this.currentItemIndex;
            }

            if (this.currentPageNumber === this.totalPage - 1) {
                return index < this.images.length - this.itemPerPage;
            }

            return (
                this.currentPageNumber * this.itemPerPage > index ||
                index >= (this.currentPageNumber + 1) * this.itemPerPage
            );
        },
    },
});
