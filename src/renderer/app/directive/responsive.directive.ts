import type { ObjectDirective } from 'vue';

/**
 * Directive: v-responsive
 * Applies CSS classes to an element based on its width using ResizeObserver.
 *
 * Usage:
 * v-responsive="{ 'is--compact': el => el.width <= 1620, timeout: 200 }"
 */

interface ResponsiveBinding {
    value?: {
        [key: string]: ((elementSizeValues: DOMRectReadOnly) => boolean) | number;
    };
}

/** Simple throttle helper (no lodash dependency) */
function throttle<T extends (...args: Parameters<T>) => void>(
    fn: T,
    wait: number,
): (...args: Parameters<T>) => void {
    let lastTime = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Parameters<T>) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);

        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            lastTime = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(() => {
                lastTime = Date.now();
                timer = null;
                fn(...args);
            }, remaining);
        }
    };
}

const responsiveDirective: ObjectDirective<HTMLElement, ResponsiveBinding['value']> = {
    mounted(el: HTMLElement, binding: ResponsiveBinding) {
        const timeout = typeof binding.value?.timeout === 'number' ? binding.value.timeout : 200;

        const handleResize: ResizeObserverCallback = throttle((entries: ResizeObserverEntry[]) => {
            entries.forEach((entry) => {
                const elementSizeValues = entry.contentRect;

                Object.entries(binding.value ?? {}).forEach(([breakpointClass, breakpointCallback]) => {
                    if (typeof breakpointCallback !== 'function') {
                        return;
                    }

                    if (breakpointCallback(elementSizeValues)) {
                        el.classList.add(breakpointClass);
                        return;
                    }

                    el.classList.remove(breakpointClass);
                });
            });
        }, timeout);

        const observer = new ResizeObserver(handleResize);
        observer.observe(el);

        // Store observer on element for cleanup
        (el as HTMLElement & { _responsiveObserver?: ResizeObserver })._responsiveObserver = observer;
    },

    unmounted(el: HTMLElement) {
        const el_ = el as HTMLElement & { _responsiveObserver?: ResizeObserver };
        if (el_._responsiveObserver) {
            el_._responsiveObserver.disconnect();
            delete el_._responsiveObserver;
        }
    },
};

export default responsiveDirective;
