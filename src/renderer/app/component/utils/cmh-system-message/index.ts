import { defineComponent, type PropType } from 'vue';
import template from './cmh-system-message.html?raw';
import './cmh-system-message.scss';

export type SystemMessageVariant = 'info' | 'warning' | 'error' | 'success' | 'loading';

/**
 * @description 채팅 영역 내 인라인 시스템 메시지 컴포넌트.
 * STT 모델 다운로드 중, LLM 응답 중단 등의 시스템 이벤트를 사용자에게 표시.
 */
export default defineComponent({
    template,

    props: {
        /** 표시할 텍스트 */
        text: {
            type: String,
            required: false,
            default: '',
        },

        /** 메시지 유형 (아이콘·색상 결정) */
        variant: {
            type: String as PropType<SystemMessageVariant>,
            required: false,
            default: 'info' as SystemMessageVariant,
            validator(value: string) {
                return ['info', 'warning', 'error', 'success', 'loading'].includes(value);
            },
        },

        /** 진행률 (loading variant에서 0~100, 0이면 무한 스피너) */
        progress: {
            type: Number,
            required: false,
            default: 0,
        },

        /** 아이콘 오버라이드 (Phosphor icon 이름) */
        icon: {
            type: String,
            required: false,
            default: '',
        },

        /** 닫기 버튼 표시 여부 */
        closable: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    emits: ['close'],

    computed: {
        /** variant별 기본 아이콘 */
        iconName(): string {
            if (this.icon) return this.icon;
            const map: Record<string, string> = {
                info: 'ph:info',
                warning: 'ph:warning',
                error: 'ph:warning-circle',
                success: 'ph:check-circle',
                loading: 'ph:spinner',
            };
            return map[this.variant] ?? 'ph:info';
        },

        /** 진행률 텍스트 */
        progressText(): string {
            if (this.variant !== 'loading' || !this.progress) return '';
            return `${this.progress}%`;
        },

        isLoading(): boolean {
            return this.variant === 'loading';
        },
    },

    methods: {
        onClose(): void {
            this.$emit('close');
        },
    },
});
