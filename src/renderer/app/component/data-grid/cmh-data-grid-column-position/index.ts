import { defineComponent } from 'vue'
import template from './cmh-data-grid-column-position.html?raw';

/**
 * @description 포지션 컬럼 – 위/아래 버튼으로 순서 변경
 */
export default defineComponent({
    template,

    emits: [
        'lower-position-value',
        'position-changed',
        'raise-position-value',
    ],

    props: {
        value: {
            type: Array as () => Record<string, unknown>[],
            required: true,
        },
        item: {
            type: Object as () => Record<string, unknown>,
            required: true,
        },
        field: {
            type: String,
            required: false,
            default: 'position',
        },
        showValue: {
            type: Boolean,
            required: false,
            default: false,
        },
        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    computed: {
        itemMin(): boolean {
            return this.value.every((entity) => (this.item[this.field] as number) <= (entity[this.field] as number));
        },

        itemMax(): boolean {
            return this.value.every((entity) => (this.item[this.field] as number) >= (entity[this.field] as number));
        },
    },

    methods: {
        onLowerPositionValue() {
            this._swapPosition(-1);
            this.$emit('lower-position-value', this.value);
            this.$emit('position-changed', this.value);
        },

        onRaisePositionValue() {
            this._swapPosition(1);
            this.$emit('raise-position-value', this.value);
            this.$emit('position-changed', this.value);
        },

        /** 현재 아이템의 position 값을 delta만큼 이동 후 인접 아이템과 스왑 */
        _swapPosition(delta: number) {
            const field = this.field;
            const current = this.item[field] as number;
            const targetVal = current + delta;
            const targetItem = this.value.find((e) => (e[field] as number) === targetVal);
            if (!targetItem) return;
            targetItem[field] = current;
            this.item[field] = targetVal;
        },
    },
});
