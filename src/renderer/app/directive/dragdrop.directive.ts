import type { ObjectDirective } from 'vue';

/**
 * Directive: v-draggable / v-droppable
 * Custom drag-and-drop directive using mouse/touch events.
 *
 * Usage:
 * <div v-draggable="{ data: {...}, onDrop() {...} }"></div>
 * <div v-droppable="{ data: {...}, onDrop() {...} }"></div>
 */

interface DropConfig<DATA = unknown> {
    dragGroup: number | string;
    droppableCls: string;
    validDropCls: string;
    invalidDropCls: string;
    validateDrop: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => boolean);
    onDrop: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => void);
    data: null | DATA;
}

interface DragConfig<DATA = unknown> {
    delay: number;
    dragGroup: number | string;
    draggableCls: string;
    draggingStateCls: string;
    dragElementCls: string;
    validDragCls: string;
    invalidDragCls: string;
    preventEvent: boolean;
    validateDrop: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => boolean);
    validateDrag: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => boolean);
    onDragStart: null | ((dragConfig: DragConfig<DATA>, el: HTMLElement, dragEl: HTMLElement) => void);
    onDragEnter:
        | null
        | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data'], valid?: boolean) => void);
    onDragLeave: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => void);
    onDrop: null | ((dragData: DragConfig<DATA>['data'], dropData: DropConfig<DATA>['data']) => void);
    data: null | DATA;
    disabled: boolean;
}

interface DropZone {
    el: HTMLElement;
    dropConfig: DropConfig;
}

interface DragHTMLElement extends HTMLElement {
    dragConfig?: DragConfig;
    boundDragListener?: (event: MouseEvent | TouchEvent) => boolean;
}

let currentDrag: { el: HTMLElement; dragConfig: DragConfig } | null = null;
let currentDrop: { el: HTMLElement; dropConfig: DropConfig } | null = null;
let dragElement: HTMLElement | null = null;
let dragMouseOffsetX = 0;
let dragMouseOffsetY = 0;
let delayTimeout: number | null = null;
const dropZones: DropZone[] = [];

const defaultDragConfig: DragConfig = {
    delay: 100,
    dragGroup: 1,
    draggableCls: 'is--draggable',
    draggingStateCls: 'is--dragging',
    dragElementCls: 'is--drag-element',
    validDragCls: 'is--valid-drag',
    invalidDragCls: 'is--invalid-drag',
    preventEvent: true,
    validateDrop: null,
    validateDrag: null,
    onDragStart: null,
    onDragEnter: null,
    onDragLeave: null,
    onDrop: null,
    data: null,
    disabled: false,
};

const defaultDropConfig: DropConfig = {
    dragGroup: 1,
    droppableCls: 'is--droppable',
    validDropCls: 'is--valid-drop',
    invalidDropCls: 'is--invalid-drop',
    validateDrop: null,
    onDrop: null,
    data: null,
};

export function resetCurrentDrag() {
    currentDrag = null;
    currentDrop = null;
    dragElement = null;
}

export function getCurrentDragElement() {
    return dragElement;
}

function onDrag(el: HTMLElement, dragConfig: DragConfig, event: MouseEvent | TouchEvent): boolean {
    if (event instanceof MouseEvent && event.buttons !== 1) return false;

    if (dragConfig.preventEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!dragConfig.delay || dragConfig.delay <= 0) {
        startDrag(el, dragConfig, event);
    } else {
        delayTimeout = window.setTimeout(() => startDrag(el, dragConfig, event), dragConfig.delay);
    }

    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
    return true;
}

function startDrag(el: HTMLElement, dragConfig: DragConfig, event: MouseEvent | TouchEvent) {
    delayTimeout = null;
    if (currentDrag !== null) return;

    currentDrag = { el, dragConfig };
    const box = el.getBoundingClientRect();
    const pageX = (event instanceof MouseEvent ? event.pageX : event.touches[0].pageX) as number;
    const pageY = (event instanceof MouseEvent ? event.pageY : event.touches[0].pageY) as number;

    dragMouseOffsetX = pageX - box.left;
    dragMouseOffsetY = pageY - box.top;

    dragElement = el.cloneNode(true) as HTMLElement;
    dragElement.classList.add(dragConfig.dragElementCls);
    dragElement.style.width = `${box.width}px`;
    dragElement.style.left = `${pageX - dragMouseOffsetX}px`;
    dragElement.style.top = `${pageY - dragMouseOffsetY}px`;
    document.body.appendChild(dragElement);
    el.classList.add(dragConfig.draggingStateCls);

    if (typeof dragConfig.onDragStart === 'function') {
        dragConfig.onDragStart(dragConfig, el, dragElement);
    }

    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag);
}

function moveDrag(event: MouseEvent | TouchEvent) {
    if (currentDrag === null) { stopDrag(); return; }

    const pageX = (event instanceof MouseEvent ? event.pageX : event.touches[0].pageX) as number;
    const pageY = (event instanceof MouseEvent ? event.pageY : event.touches[0].pageY) as number;
    if (!pageX || !pageY) return;

    if (dragElement) {
        dragElement.style.left = `${pageX - dragMouseOffsetX}px`;
        dragElement.style.top = `${pageY - dragMouseOffsetY}px`;
    }

    if (event.type === 'touchmove') {
        dropZones.forEach((zone) => {
            if (isEventOverElement(event, zone.el)) {
                if (currentDrop === null || zone.el !== currentDrop.el) {
                    enterDropZone(zone.el, zone.dropConfig);
                }
            } else if (currentDrop !== null && zone.el === currentDrop.el) {
                leaveDropZone(zone.el, zone.dropConfig);
            }
        });
    }
}

function isEventOverElement(event: MouseEvent | TouchEvent, el: HTMLElement): boolean {
    const pageX = (event instanceof MouseEvent ? event.pageX : event.touches[0].pageX) as number;
    const pageY = (event instanceof MouseEvent ? event.pageY : event.touches[0].pageY) as number;
    const box = el.getBoundingClientRect();
    return pageX >= box.x && pageX <= box.x + box.width && pageY >= box.y && pageY <= box.y + box.height;
}

function stopDrag() {
    if (delayTimeout !== null) {
        window.clearTimeout(delayTimeout);
        delayTimeout = null;
        return;
    }

    const validDrag = validateDrag();
    const validDrop = validateDrop();

    if (validDrag && currentDrag && typeof currentDrag.dragConfig.onDrop === 'function') {
        currentDrag.dragConfig.onDrop(
            currentDrag.dragConfig.data,
            validDrop ? currentDrop?.dropConfig.data ?? null : null,
        );
    }

    if (validDrop && currentDrop && typeof currentDrop.dropConfig.onDrop === 'function') {
        currentDrop.dropConfig.onDrop(currentDrag?.dragConfig.data ?? null, currentDrop.dropConfig.data);
    }

    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('touchmove', moveDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);

    if (dragElement) { dragElement.remove(); dragElement = null; }

    if (currentDrag) {
        currentDrag.el.classList.remove(currentDrag.dragConfig.draggingStateCls);
        currentDrag.el.classList.remove(currentDrag.dragConfig.validDragCls);
        currentDrag.el.classList.remove(currentDrag.dragConfig.invalidDragCls);
        currentDrag = null;
    }

    if (currentDrop) {
        currentDrop.el.classList.remove(currentDrop.dropConfig.validDropCls);
        currentDrop.el.classList.remove(currentDrop.dropConfig.invalidDropCls);
        currentDrop = null;
    }

    dragMouseOffsetX = 0;
    dragMouseOffsetY = 0;
}

function enterDropZone(el: HTMLElement, dropConfig: DropConfig) {
    if (currentDrag === null) return;
    currentDrop = { el, dropConfig };

    const valid = validateDrop();
    if (valid) {
        el.classList.add(dropConfig.validDropCls);
        el.classList.remove(dropConfig.invalidDropCls);
        dragElement?.classList.add(currentDrag.dragConfig.validDragCls);
        dragElement?.classList.remove(currentDrag.dragConfig.invalidDragCls);
    } else {
        el.classList.add(dropConfig.invalidDropCls);
        el.classList.remove(dropConfig.validDropCls);
        dragElement?.classList.add(currentDrag.dragConfig.invalidDragCls);
        dragElement?.classList.remove(currentDrag.dragConfig.validDragCls);
    }

    if (typeof currentDrag.dragConfig.onDragEnter === 'function') {
        currentDrag.dragConfig.onDragEnter(currentDrag.dragConfig.data, currentDrop.dropConfig.data, valid);
    }
}

function leaveDropZone(el: HTMLElement, dropConfig: DropConfig) {
    if (currentDrag === null) return;

    if (typeof currentDrag.dragConfig.onDragLeave === 'function') {
        currentDrag.dragConfig.onDragLeave(currentDrag.dragConfig.data, currentDrop?.dropConfig.data ?? null);
    }

    el.classList.remove(dropConfig.validDropCls);
    el.classList.remove(dropConfig.invalidDropCls);
    dragElement?.classList.remove(currentDrag.dragConfig.validDragCls);
    dragElement?.classList.remove(currentDrag.dragConfig.invalidDragCls);

    currentDrop = null;
}

function validateDrop(): boolean {
    if (!currentDrag || !currentDrop || currentDrop.dropConfig.dragGroup !== currentDrag.dragConfig.dragGroup) {
        return false;
    }

    const customDragValid =
        typeof currentDrag.dragConfig.validateDrop === 'function'
            ? currentDrag.dragConfig.validateDrop(currentDrag.dragConfig.data, currentDrop.dropConfig.data)
            : true;

    const customDropValid =
        typeof currentDrop.dropConfig.validateDrop === 'function'
            ? currentDrop.dropConfig.validateDrop(currentDrag.dragConfig.data, currentDrop.dropConfig.data)
            : true;

    return customDragValid && customDropValid;
}

function validateDrag(): boolean {
    if (!currentDrag) return false;

    return typeof currentDrag.dragConfig.validateDrag === 'function'
        ? currentDrag.dragConfig.validateDrag(currentDrag.dragConfig.data, currentDrop?.dropConfig.data ?? null)
        : true;
}

function mergeConfigs<T extends DragConfig | DropConfig>(defaultConfig: T, binding: { value: unknown }): T {
    const merged = { ...defaultConfig };
    if (binding.value && typeof binding.value === 'object') {
        Object.assign(merged, binding.value);
    } else {
        Object.assign(merged, { data: binding.value });
    }
    return merged;
}

/** v-draggable directive */
export const draggableDirective: ObjectDirective<DragHTMLElement, unknown> = {
    mounted(el, binding) {
        const dragConfig = mergeConfigs(defaultDragConfig, binding);
        el.dragConfig = dragConfig;
        el.boundDragListener = (e: MouseEvent | TouchEvent) => onDrag(el, el.dragConfig!, e);

        if (!dragConfig.disabled) {
            el.classList.add(dragConfig.draggableCls);
            el.addEventListener('mousedown', el.boundDragListener);
            el.addEventListener('touchstart', el.boundDragListener);
        }
    },

    updated(el, binding) {
        const dragConfig = mergeConfigs(defaultDragConfig, binding);

        if (el.dragConfig && el.dragConfig.disabled !== dragConfig.disabled) {
            if (!dragConfig.disabled) {
                el.classList.add(dragConfig.draggableCls);
                if (el.boundDragListener) {
                    el.addEventListener('mousedown', el.boundDragListener);
                    el.addEventListener('touchstart', el.boundDragListener);
                }
            } else {
                el.classList.remove(el.dragConfig.draggableCls);
                if (el.boundDragListener) {
                    el.removeEventListener('mousedown', el.boundDragListener);
                    el.removeEventListener('touchstart', el.boundDragListener);
                }
            }
        }

        if (!el.dragConfig) el.dragConfig = {} as DragConfig;
        Object.assign(el.dragConfig, dragConfig);
    },

    unmounted(el, binding) {
        const dragConfig = mergeConfigs(defaultDragConfig, binding);
        el.classList.remove(dragConfig.draggableCls);
        if (el.boundDragListener) {
            el.removeEventListener('mousedown', el.boundDragListener);
            el.removeEventListener('touchstart', el.boundDragListener);
        }
    },
};

/** v-droppable directive */
export const droppableDirective: ObjectDirective<HTMLElement, unknown> = {
    mounted(el, binding) {
        const dropConfig = mergeConfigs(defaultDropConfig, binding);
        dropZones.push({ el, dropConfig });
        el.classList.add(dropConfig.droppableCls);
        el.addEventListener('mouseenter', () => enterDropZone(el, dropConfig));
        el.addEventListener('mouseleave', () => leaveDropZone(el, dropConfig));
    },

    unmounted(el, binding) {
        const dropConfig = mergeConfigs(defaultDropConfig, binding);
        const idx = dropZones.findIndex((z) => z.el === el);
        if (idx !== -1) dropZones.splice(idx, 1);
        el.classList.remove(dropConfig.droppableCls);
    },

    updated(el, binding) {
        const zone = dropZones.find((z) => z.el === el);
        if (!zone) return;
        if (binding.value && typeof binding.value === 'object') {
            Object.assign(zone.dropConfig, binding.value);
        } else {
            Object.assign(zone.dropConfig, { data: binding.value });
        }
    },
};

export type { DragConfig, DropConfig };
