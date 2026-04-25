import { defineComponent } from 'vue'
import template from './cmh-media-upload-v2.html?raw';
import './cmh-media-upload-v2.scss';

/**
 * @description 파일 업로드 컴포넌트 (drag&drop + file input + URL 입력).
 * Shopware의 mediaService/fileValidationService 의존 제거 → File API + emit 기반.
 *
 * variant:
 *  - "compact": 버튼 + URL 컨텍스트 메뉴
 *  - "regular": 드롭존 + 파일 업로드 + URL 폼
 *  - "small": regular의 축소 버전
 *
 * @emits media-upload-request({ files: File[], uploadTag: string }) - 파일 업로드 요청
 * @emits media-upload-url({ url: string, fileExtension: string, uploadTag: string }) - URL 업로드 요청
 * @emits media-upload-remove-image - 이미지 제거 요청
 */
export default defineComponent({
    template,

    emits: ['media-upload-request', 'media-upload-url', 'media-upload-remove-image'],

    props: {
        uploadTag: {
            type: String,
            required: false,
            default: '',
        },

        source: {
            type: [String, Object],
            required: false,
            default: null,
        },

        variant: {
            type: String,
            required: false,
            default: 'regular',
            validator: (v: string) => ['compact', 'regular', 'small'].includes(v),
        },

        allowMultiSelect: {
            type: Boolean,
            required: false,
            default: false,
        },

        fileAccept: {
            type: String,
            required: false,
            default: 'image/*',
        },

        maxFileSize: {
            type: Number,
            required: false,
            default: 0, // 0 = 제한 없음
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

        helpText: {
            type: String,
            required: false,
            default: '',
        },

        defaultFolder: {
            type: String,
            required: false,
            default: '',
        },

        targetMediaFolderId: {
            type: String,
            required: false,
            default: null,
        },

        /** URL 업로드 기능 노출 여부 */
        allowUrlUpload: {
            type: Boolean,
            required: false,
            default: true,
        },
    },

    data() {
        return {
            isDragActive: false as boolean,
            isUrlUpload: false as boolean,
            isFileUpload: true as boolean,
        };
    },

    computed: {
        isDragActiveClass(): Record<string, boolean> {
            return { 'is--active': this.isDragActive };
        },

        buttonFileUploadLabel(): string {
            return this.$t('cmh-global.media.buttonFileUpload');
        },

        isCompact(): boolean {
            return this.variant === 'compact';
        },

        hasSource(): boolean {
            return !!this.source;
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

            this.$emit('media-upload-request', {
                files: Array.from(files),
                uploadTag: this.uploadTag,
            });

            // 동일 파일 재선택 허용
            (this.$refs.fileForm as HTMLFormElement)?.reset();
        },

        useUrlUpload() {
            this.isUrlUpload = true;
            this.isFileUpload = false;
        },

        useFileUpload() {
            this.isUrlUpload = false;
            this.isFileUpload = true;
        },

        onUrlUpload({ url, fileExtension }: { url: URL; fileExtension: string }) {
            this.$emit('media-upload-url', {
                url: url.toString(),
                fileExtension,
                uploadTag: this.uploadTag,
            });
            this.useFileUpload();
        },

        onRemoveMediaItem() {
            this.$emit('media-upload-remove-image');
        },

        // Drag & Drop 핸들러
        onDragEnter(event: DragEvent) {
            event.preventDefault();
            if (this.disabled) return;
            this.isDragActive = true;
        },

        onDragOver(event: DragEvent) {
            event.preventDefault();
        },

        onDragLeave(event: DragEvent) {
            event.preventDefault();
            // 자식 요소로 이동할 때 false 처리 방지
            const related = event.relatedTarget as Node | null;
            if (related && (this.$refs.dropzone as HTMLElement)?.contains(related)) return;
            this.isDragActive = false;
        },

        onDrop(event: DragEvent) {
            event.preventDefault();
            this.isDragActive = false;
            if (this.disabled) return;

            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;

            this.$emit('media-upload-request', {
                files: Array.from(files),
                uploadTag: this.uploadTag,
            });
        },
    },
});
