import { defineComponent } from 'vue';
import type { PropType } from 'vue';

/**
 * Mixin: validation
 * Provides form field validation logic via an injected validationService.
 *
 * Usage:
 * mixins: [ValidationMixin],
 * props: {
 *   validation: 'required,email'
 * }
 */
const ValidationMixin = defineComponent({
    inject: {
        validationService: {
            type: Object,
            required: false,
            default: null,
        },
    },

    props: {
        validation: {
            type: [String, Array, Object, Boolean] as PropType<string | string[] | Record<string, unknown> | boolean>,
            required: false,
            default: null,
        },
    },

    computed: {
        isValid(): boolean {
            const value = ((this as unknown as { currentValue?: unknown; value?: unknown; selections?: unknown }).currentValue ??
                (this as unknown as { currentValue?: unknown; value?: unknown; selections?: unknown }).value ??
                (this as unknown as { currentValue?: unknown; value?: unknown; selections?: unknown }).selections) as unknown;
            return this.validate(value);
        },
    },

    methods: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(value: any): boolean {
            let validation = this.validation;
            let valid = true;

            if (typeof validation === 'boolean') return validation;

            if (typeof validation === 'string') {
                const list = validation.split(',');
                if (list.length > 1) {
                    validation = list as string[];
                } else {
                    return this.validateRule(value, this.validation as string);
                }
            }

            if (Array.isArray(validation)) {
                valid = validation.every((rule) => {
                    if (typeof rule === 'boolean') return rule;
                    if (typeof rule === 'string') return this.validateRule(value, rule.trim());
                    return false;
                });
            }

            return valid;
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validateRule(value: any, rule: string): boolean {
            const svc = this.validationService as Record<string, (val: unknown) => boolean> | null;
            if (!svc || typeof svc[rule] === 'undefined') return false;
            return svc[rule](value);
        },
    },
});

export default ValidationMixin;
