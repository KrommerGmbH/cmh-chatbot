import { defineComponent } from 'vue'
import template from './cmh-media-url-form.html?raw';

/**
 * @description URL 입력 폼 컴포넌트 (modal 또는 inline 변형 지원).
 * 포터블 — 외부 inject 의존 없음.
 *
 * @emits media-url-form-submit - { originalDomEvent, url: URL, fileExtension: string }
 * @emits modal-close
 */
export default defineComponent({
    template,

    emits: ['media-url-form-submit', 'modal-close'],

    props: {
        variant: {
            type: String,
            required: false,
            default: 'inline',
            validator: (value: string) => ['modal', 'inline'].includes(value),
        },
    },

    data() {
        return {
            url: '' as string,
            extensionFromUrl: '' as string,
            extensionFromInput: '' as string,
            showModal: false as boolean,
        };
    },

    computed: {
        urlObject(): URL | null {
            try {
                return new URL(this.url);
            } catch {
                this.extensionFromUrl = '';
                return null;
            }
        },

        hasInvalidInput(): boolean {
            return this.urlObject === null && this.url !== '';
        },

        invalidUrlError(): { code: string } | null {
            if (this.hasInvalidInput) {
                return { code: 'INVALID_MEDIA_URL' };
            }
            return null;
        },

        missingFileExtension(): boolean {
            return this.urlObject !== null && !this.extensionFromUrl;
        },

        fileExtension(): string {
            return this.extensionFromUrl || this.extensionFromInput;
        },

        isValid(): boolean {
            return this.urlObject !== null && !!this.fileExtension;
        },
    },

    watch: {
        urlObject(value: URL | null) {
            if (value === null) {
                this.extensionFromUrl = '';
                return;
            }

            const fileName = value.pathname.split('/').pop() ?? '';
            const parts = fileName.split('.');
            if (parts.length === 1) {
                this.extensionFromUrl = '';
                return;
            }

            this.extensionFromUrl = parts.pop() ?? '';
        },
    },

    mounted() {
        if (this.variant === 'modal') {
            this.showModal = true;
        }
    },

    methods: {
        emitUrl(originalDomEvent: Event) {
            if (!this.isValid || !this.urlObject) return;

            this.$emit('media-url-form-submit', {
                originalDomEvent,
                url: this.urlObject,
                fileExtension: this.fileExtension,
            });

            if (this.variant === 'modal') {
                this.showModal = false;
            }
        },

        onModalChange(isOpen: boolean) {
            this.showModal = isOpen;
            if (!isOpen) {
                this.$emit('modal-close');
            }
        },
    },
});
