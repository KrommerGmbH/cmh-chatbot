import { defineComponent } from 'vue';
import template from './cmh-range-slider.html?raw';
import './cmh-range-slider.scss';

export default defineComponent({
  template,

  props: {
    modelValue: {
      type: Number,
      required: true,
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
    step: {
      type: Number,
      default: 1,
    },
    label: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue', 'change'],

  computed: {
    clampedValue(): number {
      const value = Number(this.modelValue ?? this.min);
      return Math.min(this.max, Math.max(this.min, value));
    },

    progressStyle(): Record<string, string> {
      const range = this.max - this.min;
      const progress = range <= 0 ? 0 : ((this.clampedValue - this.min) / range) * 100;
      return {
        '--cmh-range-slider-progress': `${progress}%`,
      };
    },
  },

  methods: {
    emitValue(value: number): void {
      const steppedValue = Math.round((value - this.min) / this.step) * this.step + this.min;
      const normalizedValue = Math.min(this.max, Math.max(this.min, steppedValue));
      this.$emit('update:modelValue', normalizedValue);
      this.$emit('change', normalizedValue);
    },

    onInput(event: Event): void {
      const target = event.target as HTMLInputElement | null;
      if (!target) return;
      this.emitValue(Number(target.value));
    },

    increaseValue(): void {
      if (this.disabled) return;
      this.emitValue(this.clampedValue + this.step);
    },

    decreaseValue(): void {
      if (this.disabled) return;
      this.emitValue(this.clampedValue - this.step);
    },
  },
});
