import { defineComponent } from 'vue'
import template from './cmh-media-compact-upload-v2.html?raw';
import './cmh-media-compact-upload-v2.scss';

interface DisableDeletionForLastItem {
    value: boolean;
    helpText: string | null;
}

/**
 * @description 미디어 선택/업로드용 컴팩트 컴포넌트.
 * sw-media-modal-v2 의존 제거 → 파일 input 직접 처리.
 * 멀티셀렉트 및 단일 업로드 모두 지원.
 *
 * variant="compact": 버튼 + URL 업로드 드롭다운
 * variant="regular": 드롭존 + 프리뷰 + 파일 선택
 *
 * @emits delete-item(item) - 미디어 삭제 요청
 * @emits selection-change(files, uploadTag) - 파일 선택 완료
 * @emits url-upload(url, fileExtension) - URL 업로드
 */
export default defineComponent({
    template,

    emits: ['delete-item', 'selection-change', 'url-upload'],

    props: {
        allowMultiSelect: {
            type: Boolean,
            required: false,
            default: false,
        },

        disableDeletionForLastItem: {
            type: Object as () => DisableDeletionForLastItem,
            required: false,
            default: () => ({ value: false, helpText: null }),
        },

        variant: {
            type: String,
            required: false,
            default: 'regular',
            validator: (v: string) => ['compact', 'regular'].includes(v),
        },

        /** 단일 선택 소스 (URL 또는 객체) */
        source: {
            type: [String, Object],
            required: false,
            default: '',
        },

        /** 멀티 선택 소스 배열 */
        sourceMultiselect: {
            type: Array,
            required: false,
            default: () => [],
        },

        fileAccept: {
            type: String,
            required: false,
            default: 'image/*',
        },

        removeButtonLabel: {
            type: String,
            required: false,
            default: '',
        },

        uploadTag: {
            type: String,
            required: false,
            default: '',
        },

        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },

        label: {
            type: String,
            required: false,
            default: '',
        },

        /** 드롭존 표시 여부 (regular 모드) */
        isDragActive: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            isUrlUpload: false as boolean,
            isDragOver: false as boolean,
        };
    },

    computed: {
        mediaPreview(): string | object | Array<unknown> | null {
            if (!this.allowMultiSelect) {
                return this.source || null;
            }
            return this.sourceMultiselect?.length ? this.sourceMultiselect : null;
        },

        removeFileButtonLabel(): string {
            if (this.removeButtonLabel === '') {
                return this.$t('cmh-global.media.buttonRemove');
            }
            return this.removeButtonLabel;
        },

        isDeletionDisabled(): boolean {
            if (!this.disableDeletionForLastItem.value) return false;
            return (this.sourceMultiselect?.length ?? 0) <= 1;
        },

        isDragActiveClass(): Record<string, boolean> {
            return { 'is--drag-active': this.isDragOver };
        },

        buttonFileUploadLabel(): string {
            return this.$t('cmh-global.media.buttonFileUpload');
        },
    },

    methods: {
        onClickUpload() {
            (this.$refs.fileInput as HTMLInputElement)?.click();
        },

        onFileInputChange(event: Event) {
            const input = event.target as HTMLInputElement;
            const files = input.files;
            if (!files || files.length === 0) return;

            this.$emit('selection-change', Array.from(files), this.uploadTag);
            // input 초기화 (같은 파일 재선택 허용)
            (this.$refs.fileForm as HTMLFormElement)?.reset();
        },

        useUrlUpload() {
            this.isUrlUpload = true;
        },

        useFileUpload() {
            this.isUrlUpload = false;
        },

        onUrlUpload({ url, fileExtension }: { url: URL; fileExtension: string }) {
            this.$emit('url-upload', url.toString(), fileExtension);
            this.isUrlUpload = false;
        },

        onRemoveMediaItem() {
            this.$emit('delete-item', this.source);
        },

        onDragEnter(event: DragEvent) {
            event.preventDefault();
            this.isDragOver = true;
        },

        onDragLeave(event: DragEvent) {
            event.preventDefault();
            this.isDragOver = false;
        },

        onDrop(event: DragEvent) {
            event.preventDefault();
            this.isDragOver = false;

            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;

            this.$emit('selection-change', Array.from(files), this.uploadTag);
        },

        getFileName(item: Record<string, string>): string {
            if (item.name) return item.name;
            return `${item.fileName}.${item.fileExtension}`;
        },
    },
});
