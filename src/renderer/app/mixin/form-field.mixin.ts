import { defineComponent } from 'vue';
import type { PropType } from 'vue';

/**
 * Mixin: sw-form-field
 * Provides inheritance attribute management for form field components.
 * Enables components to work within cmh-form-field inheritance chains.
 *
 * Usage:
 * mixins: [FormFieldMixin],
 */
const FormFieldMixin = defineComponent({
    data() {
        return {
            inheritanceAttrs: {} as Record<string, unknown>,
        };
    },

    provide(): Record<string, unknown> {
        return {
            restoreInheritanceHandler: this.handleRestoreInheritance,
            removeInheritanceHandler: this.handleRemoveInheritance,
        };
    },

    props: {
        name: {
            type: String as PropType<string>,
            required: false,
            default: null,
        },

        mapInheritance: {
            type: Object as PropType<Record<string, unknown>>,
            required: false,
            default: null,
        },
    },

    computed: {
        formFieldName(): string | null {
            if (this.$attrs.name) return this.$attrs.name as string;
            if (this.name) return this.name;
            return null;
        },
    },

    watch: {
        mapInheritance: {
            handler(mapInheritance: Record<string, unknown> | null) {
                if (!mapInheritance?.isInheritField) return;

                Object.keys(mapInheritance).forEach((prop) => {
                    const propValue = mapInheritance[prop];
                    if (typeof propValue === 'boolean') {
                        this.setAttributesForProps(prop, propValue);
                    }
                });
            },
            deep: true,
            immediate: true,
        },
    },

    beforeUnmount() {
        this.beforeDestroyComponent();
    },

    methods: {
        handleRestoreInheritance() {
            if (!this.mapInheritance) return;
            const handler = this.mapInheritance.restoreInheritance;
            if (typeof handler === 'function') handler();
        },

        handleRemoveInheritance() {
            if (!this.mapInheritance) return;
            const handler = this.mapInheritance.removeInheritance;
            if (typeof handler === 'function') handler();
        },

        beforeDestroyComponent() {
            // override in component if needed
        },

        setAttributesForProps(prop: string, propValue: boolean) {
            switch (prop) {
                case 'isInherited':
                    this.inheritanceAttrs = { ...this.inheritanceAttrs, [prop]: propValue };
                    break;
                case 'isInheritField':
                    this.inheritanceAttrs = { ...this.inheritanceAttrs, isInheritanceField: propValue };
                    break;
                default:
                    break;
            }
        },
    },
});

export default FormFieldMixin;
