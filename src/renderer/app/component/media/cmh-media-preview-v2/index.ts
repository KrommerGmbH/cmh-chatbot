import { defineComponent } from 'vue'
import template from './cmh-media-preview-v2.html?raw';
import './cmh-media-preview-v2.scss';

type MediaObject = {
    id?: string;
    mimeType?: string;
    url?: string;
    alt?: string;
    fileName?: string;
    fileExtension?: string;
    thumbnails?: Array<{ url: string; width: number }>;
};

/**
 * @description 미디어 오브젝트 프리뷰 컴포넌트.
 * - source가 UUID 문자열이면 repositoryFactory(optional inject)로 미디어 로드.
 * - source가 File/URL 객체이면 직접 처리.
 * - source가 일반 문자열(경로/URL)이면 직접 src로 사용.
 * - Shopware.Filter (mediaName, asset) 의존 제거.
 *
 * @emits click
 * @emits media-preview-play({ originalDomEvent, item })
 */
export default defineComponent({
    template,

    inject: {
        repositoryFactory: { default: null },
    },

    emits: ['click', 'media-preview-play'],

    playableVideoFormats: [
        'video/mp4',
        'video/ogg',
        'video/webm',
    ],

    playableAudioFormats: [
        'audio/mp3',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
    ],

    /** 파일 타입 플레이스홀더 아이콘 매핑 */
    placeHolderThumbnails: {
        application: {
            'adobe.illustrator': 'icons-multicolor-file-thumbnail-ai',
            illustrator: 'icons-multicolor-file-thumbnail-ai',
            postscript: 'icons-multicolor-file-thumbnail-ai',
            msword: 'icons-multicolor-file-thumbnail-doc',
            'vnd.openxmlformats-officedocument.wordprocessingml.document': 'icons-multicolor-file-thumbnail-doc',
            pdf: 'icons-multicolor-file-thumbnail-pdf',
            'vnd.ms-excel': 'icons-multicolor-file-thumbnail-xls',
            'vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'icons-multicolor-file-thumbnail-xls',
            'vnd.ms-powerpoint': 'icons-multicolor-file-thumbnail-ppt',
            'vnd.openxmlformats-officedocument.presentationml.presentation': 'icons-multicolor-file-thumbnail-ppt',
            glb: 'icons-multicolor-file-thumbnail-glb',
            'octet-stream': 'icons-multicolor-file-thumbnail-glb',
        },
        video: {
            'x-msvideo': 'icons-multicolor-file-thumbnail-avi',
            quicktime: 'icons-multicolor-file-thumbnail-mov',
            mp4: 'icons-multicolor-file-thumbnail-mp4',
        },
        text: {
            csv: 'icons-multicolor-file-thumbnail-csv',
            plain: 'icons-multicolor-file-thumbnail-csv',
        },
        image: {
            gif: 'icons-multicolor-file-thumbnail-gif',
            jpeg: 'icons-multicolor-file-thumbnail-jpg',
            'svg+xml': 'icons-multicolor-file-thumbnail-svg',
        },
        model: {
            'gltf-binary': 'icons-multicolor-file-thumbnail-glb',
        },
    } as Record<string, Record<string, string>>,

    placeholderThumbnailsBasePath: '/administration/administration/static/img/media-preview/',

    props: {
        source: {
            required: true,
            default: null,
        },

        showControls: {
            type: Boolean,
            required: false,
            default: false,
        },

        autoplay: {
            type: Boolean,
            required: false,
            default: false,
        },

        transparency: {
            type: Boolean,
            required: false,
            default: true,
        },

        useThumbnails: {
            type: Boolean,
            required: false,
            default: true,
        },

        hideTooltip: {
            type: Boolean,
            required: false,
            default: true,
        },

        mediaIsPrivate: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            trueSource: null as MediaObject | File | URL | string | null,
            width: 0 as number,
            dataUrl: '' as string,
            urlPreviewFailed: false as boolean,
            imagePreviewFailed: false as boolean,
        };
    },

    computed: {
        mediaPreviewClasses(): Record<string, boolean> {
            return {
                'is--icon': this.isIcon,
                'is--no-media': !this.source,
            };
        },

        transparencyClass(): Record<string, boolean> {
            return {
                'shows--transparency': this.canBeTransparent,
            };
        },

        canBeTransparent(): boolean {
            if (!this.transparency) return false;
            return this.isIcon || this.mimeTypeGroup === 'image';
        },

        mimeType(): string {
            if (!this.trueSource) return '';
            if (this.trueSource instanceof File) return this.trueSource.type;
            if (this.trueSource instanceof URL) return 'application/octet-stream';
            if (typeof this.trueSource === 'string') return '';
            return (this.trueSource as MediaObject).mimeType ?? '';
        },

        mimeTypeGroup(): string {
            if (!this.mimeType) return '';
            return this.mimeType.split('/')[0];
        },

        isPlayable(): boolean {
            const videoFormats = (this.$options as Record<string, string[]>).playableVideoFormats ?? [];
            const audioFormats = (this.$options as Record<string, string[]>).playableAudioFormats ?? [];
            return videoFormats.includes(this.mimeType) || audioFormats.includes(this.mimeType);
        },

        isIcon(): boolean {
            return /.*svg.*/.test(this.mimeType);
        },

        placeholderIcon(): string {
            if (!this.mimeType) return 'icons-multicolor-file-thumbnail-broken';

            const opts = (this.$options as Record<string, Record<string, Record<string, string>>>).placeHolderThumbnails;
            const typeGroup = opts?.[this.mimeTypeGroup];
            if (typeGroup) {
                const subType = this.mimeType.split('/')[1];
                const icon = typeGroup[subType];
                if (icon) return icon;
            }

            return 'icons-multicolor-file-thumbnail-normal';
        },

        placeholderIconPath(): string {
            const base = (this.$options as Record<string, string>).placeholderThumbnailsBasePath;
            return `${base}${this.placeholderIcon}.svg`;
        },

        lockIsVisible(): boolean {
            return this.width > 40;
        },

        previewUrl(): string {
            if (!this.trueSource) return '';
            if (this.trueSource instanceof File) return this.dataUrl;
            if (this.trueSource instanceof URL) return this.trueSource.href;
            if (typeof this.trueSource === 'string') return this.trueSource;
            return (this.trueSource as MediaObject).url ?? '';
        },

        isUrl(): boolean {
            return this.trueSource instanceof URL;
        },

        isFile(): boolean {
            return this.trueSource instanceof File;
        },

        isRelativePath(): boolean {
            return typeof this.trueSource === 'string';
        },

        alt(): string {
            if (!this.trueSource || typeof this.trueSource === 'string') return '';
            if (this.trueSource instanceof File) return this.trueSource.name;
            if (this.trueSource instanceof URL) return this.trueSource.href;
            return (this.trueSource as MediaObject).alt ?? (this.trueSource as MediaObject).fileName ?? '';
        },

        mediaName(): string {
            if (!this.trueSource) return this.$t('cmh-global.media.noMedia');

            if (this.trueSource instanceof File) return this.trueSource.name;
            if (this.trueSource instanceof URL) return this.trueSource.href;
            if (typeof this.trueSource === 'string') return this.trueSource;

            const obj = this.trueSource as MediaObject;
            if (obj.fileName && obj.fileExtension) return `${obj.fileName}.${obj.fileExtension}`;
            return obj.fileName ?? obj.alt ?? '';
        },

        sourceSet(): string {
            if (
                this.trueSource instanceof File ||
                this.trueSource instanceof URL ||
                typeof this.trueSource === 'string'
            ) {
                return '';
            }

            const obj = this.trueSource as MediaObject;
            const thumbnails = obj.thumbnails;
            if (!thumbnails || thumbnails.length === 0) return '';

            return thumbnails.map(t => `${t.url} ${t.width}w`).join(', ');
        },
    },

    watch: {
        source() {
            this.urlPreviewFailed = false;
            this.imagePreviewFailed = false;
            this.fetchSourceIfNecessary();
        },
    },

    created() {
        this.fetchSourceIfNecessary();
    },

    mounted() {
        this.width = (this.$el as HTMLElement)?.offsetWidth ?? 0;
    },

    methods: {
        async fetchSourceIfNecessary() {
            if (!this.source) {
                this.trueSource = null;
                return;
            }

            // File/URL 객체는 직접 설정
            if (this.source instanceof File || this.source instanceof URL) {
                this.trueSource = this.source;
                if (this.source instanceof File) {
                    await this.getDataUrlFromFile(this.source);
                }
                return;
            }

            // 배열이면 첫 번째 항목 사용
            if (Array.isArray(this.source)) {
                this.trueSource = this.source[0] ?? null;
                return;
            }

            // 일반 객체(미디어 엔티티)
            if (typeof this.source === 'object') {
                this.trueSource = this.source as MediaObject;
                return;
            }

            // 문자열 — UUID 패턴이면 repository로 로드
            if (
                typeof this.source === 'string' &&
                this.repositoryFactory &&
                /^[0-9a-f]{32}$/i.test(this.source.replace(/-/g, ''))
            ) {
                try {
                    const repo = (this.repositoryFactory as { create: (name: string) => { get: (id: string) => Promise<MediaObject> } }).create('media');
                    this.trueSource = await repo.get(this.source);
                } catch {
                    // 로드 실패 시 URL 문자열로 폴백
                    this.trueSource = this.source;
                }
                return;
            }

            // 일반 URL 문자열
            this.trueSource = this.source as string;
        },

        onPlayClick(originalDomEvent: MouseEvent) {
            if (!(originalDomEvent.shiftKey || originalDomEvent.ctrlKey)) {
                originalDomEvent.stopPropagation();
                this.$emit('media-preview-play', {
                    originalDomEvent,
                    item: this.trueSource,
                });
            }
        },

        async getDataUrlFromFile(file: File) {
            if (!file.type.startsWith('image/')) return;

            return new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.dataUrl = (e.target?.result as string) ?? '';
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        },

        removeUrlPreview() {
            this.urlPreviewFailed = true;
        },

        showEvent() {
            if (!this.isFile) {
                this.imagePreviewFailed = true;
            }
        },
    },
});
