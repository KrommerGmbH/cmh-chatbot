import type { ObjectDirective } from 'vue';

/**
 * Directive: v-autofocus
 * Focuses the first input element within the bound element on mount.
 *
 * Usage:
 * <div v-autofocus>...</div>
 */
const autofocusDirective: ObjectDirective<HTMLElement> = {
    mounted(el: HTMLElement) {
        const inputs = el.getElementsByTagName('input');

        if (inputs.length === 0) {
            return;
        }

        inputs[0].focus();
    },
};

export default autofocusDirective;
