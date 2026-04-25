import type { ObjectDirective, ComponentPublicInstance } from 'vue';

/**
 * Directive: v-popover
 * Automatic edge detection and positioning for popover/dropdown elements.
 *
 * Usage:
 * v-popover="{ active: true, targetSelector: '.my-element', resizeWidth: true }"
 */

const virtualScrollingElements = new Map<string, { el: HTMLElement; ref: Element; config: PopoverConfig }>();

const outsideClasses = {
    top: '--placement-top-outside',
    right: '--placement-right-outside',
    bottom: '--placement-bottom-outside',
    left: '--placement-left-outside',
};

interface PopoverConfig {
    active: boolean;
    targetSelector: string;
    resizeWidth: boolean;
    style: Record<string, string>;
}

const defaultConfig: PopoverConfig = {
    active: false,
    targetSelector: '',
    resizeWidth: false,
    style: {},
};

const customStylingBlacklist = ['width', 'position', 'top', 'left', 'right', 'bottom'];

function calculateOutsideEdges(el: HTMLElement, instance: ComponentPublicInstance) {
    const orientationElement = (instance.$parent as ComponentPublicInstance)?.$el as HTMLElement;
    if (!orientationElement) return;

    const rect = orientationElement.getBoundingClientRect();
    const winH = window.innerHeight || document.documentElement.clientHeight;
    const winW = window.innerWidth || document.documentElement.clientWidth;

    el.classList.remove(...Object.values(outsideClasses));

    const placementClasses = [
        winH - rect.bottom < rect.top ? outsideClasses.bottom : outsideClasses.top,
        winW - rect.right > rect.left ? outsideClasses.left : outsideClasses.right,
    ];

    el.classList.add(...placementClasses);
}

function setElementPosition(element: HTMLElement, refElement: Element | undefined, config: PopoverConfig) {
    const originElement = refElement ?? element;
    const elementPosition = originElement.getBoundingClientRect();

    let targetPosition = { top: 0, left: 0 };

    if (config.targetSelector?.length > 0) {
        const targetElement = originElement.closest(config.targetSelector);
        if (targetElement) targetPosition = targetElement.getBoundingClientRect();
    }

    Object.entries(config.style).forEach(([key, value]) => {
        if (customStylingBlacklist.includes(key)) return;
        (element.style as any)[key] = value;
    });

    element.style.position = 'absolute';
    element.style.top = `${elementPosition.top - targetPosition.top + (originElement as HTMLElement).clientHeight}px`;
    element.style.left = `${elementPosition.left - targetPosition.left}px`;
}

function virtualScrollingHandler() {
    if (virtualScrollingElements.size <= 0) {
        stopVirtualScrolling();
        return;
    }
    virtualScrollingElements.forEach((entry) => {
        setElementPosition(entry.el, entry.ref, entry.config);
    });
}

function startVirtualScrolling() {
    window.addEventListener('scroll', virtualScrollingHandler, true);
}

function stopVirtualScrolling() {
    window.removeEventListener('scroll', virtualScrollingHandler, true);
}

export function registerVirtualScrollingElement(
    modifiedElement: HTMLElement,
    uid: string,
    refEl: Element,
    config: PopoverConfig,
) {
    if (!uid) return;
    if (virtualScrollingElements.size <= 0) startVirtualScrolling();
    virtualScrollingElements.set(uid, { el: modifiedElement, ref: refEl, config });
}

export function unregisterVirtualScrollingElement(uid?: string) {
    if (!uid) return;
    virtualScrollingElements.delete(uid);
    if (virtualScrollingElements.size <= 0) stopVirtualScrolling();
}

const popoverDirective: ObjectDirective<HTMLElement, Partial<PopoverConfig>> = {
    mounted(element, binding) {
        if (!binding.value) return;

        const config = { ...defaultConfig, ...binding.value };
        if (!config.active) return;

        let targetElement: Element = document.body;
        if (config.targetSelector?.length > 0) {
            targetElement = element.closest(config.targetSelector) ?? document.body;
        }

        targetElement.appendChild(element);
        setElementPosition(element, binding.instance?.$el, config);

        if (config.resizeWidth && binding.instance?.$el) {
            element.style.width = `${(binding.instance.$el as HTMLElement).clientWidth}px`;
        }

        if (binding.instance) {
            calculateOutsideEdges(element, binding.instance as ComponentPublicInstance);
            const uid = (binding.instance as { _uid?: string })?._uid ?? '';
            registerVirtualScrollingElement(element, uid, binding.instance.$el, config);
        }
    },

    unmounted(element, binding, vnode) {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        const uid = (vnode.component?.uid ?? '').toString();
        unregisterVirtualScrollingElement(uid);
    },
};

export default popoverDirective;
export { virtualScrollingElements };
