import type { ObjectDirective } from 'vue';

/**
 * Directive: v-tooltip
 * Displays a tooltip on mouse hover.
 *
 * Usage:
 * v-tooltip="'Some text'"
 * v-tooltip.bottom="'Some text'"
 * v-tooltip="{ message: 'Some Text', width: 200, position: 'bottom' }"
 * v-tooltip.bottom="{ message: 'Some Text', width: 200, showDelay: 200, hideDelay: 300 }"
 */

type Placements = 'top' | 'right' | 'bottom' | 'left';

const availableTooltipPlacements: Placements[] = ['top', 'right', 'bottom', 'left'];

export const tooltipRegistry = new Map<string, Tooltip>();

class Tooltip {
    private _id?: string;
    private _placement?: Placements;
    private _message: string;
    private _width: number | string;
    private _parentDOMElement: HTMLElement;
    private _showDelay: number;
    private _hideDelay: number;
    private _disabled: boolean;
    private _appearance: string;
    private _showOnDisabledElements: boolean;
    private _zIndex: number | null;
    private _isShown: boolean;
    private _state: boolean;
    private _DOMElement: HTMLElement | null;
    private _parentDOMElementWrapper: HTMLElement | null;
    private _actualTooltipPlacement: Placements | null;
    private _timeout?: ReturnType<typeof setTimeout>;

    constructor({
        id = crypto.randomUUID(),
        placement = 'top',
        message,
        width = 200,
        element,
        showDelay = 100,
        hideDelay = showDelay,
        disabled = false,
        appearance = 'dark',
        showOnDisabledElements = false,
        zIndex = null,
    }: {
        id?: string;
        placement?: Placements;
        message?: string;
        width?: number | string;
        element: HTMLElement;
        showDelay?: number;
        hideDelay?: number;
        disabled: boolean;
        appearance?: string;
        showOnDisabledElements?: boolean;
        zIndex?: number | null;
    }) {
        this._id = id;
        this._placement = Tooltip.validatePlacement(placement);
        this._message = Tooltip.validateMessage(message);
        this._width = Tooltip.validateWidth(width);
        this._parentDOMElement = element;
        this._showDelay = showDelay ?? 100;
        this._hideDelay = hideDelay ?? 100;
        this._disabled = disabled;
        this._appearance = appearance;
        this._showOnDisabledElements = showOnDisabledElements;
        this._zIndex = zIndex;
        this._isShown = false;
        this._state = false;
        this._DOMElement = null;
        this._parentDOMElementWrapper = null;
        this._actualTooltipPlacement = null;
    }

    get id() {
        return this._id;
    }

    init() {
        this._DOMElement = this.createDOMElement();

        if (this._showOnDisabledElements) {
            this._parentDOMElementWrapper = this.createParentDOMElementWrapper();
        }

        this.registerEvents();
    }

    update({
        message,
        placement,
        width,
        showDelay,
        hideDelay,
        disabled,
        appearance,
        showOnDisabledElements,
        zIndex,
    }: {
        message?: string;
        placement?: Placements;
        width?: number | string;
        showDelay?: number;
        hideDelay?: number;
        disabled?: boolean;
        appearance?: string;
        showOnDisabledElements?: boolean;
        zIndex?: number | null;
    }) {
        if (message && this._message !== message) {
            this._message = Tooltip.validateMessage(message);
            if (this._DOMElement) {
                this._DOMElement.innerHTML = this._message;
            }
            this.registerEvents();
        }
        if (width && this._width !== width) {
            this._width = Tooltip.validateWidth(width);
            this._DOMElement!.style.width = `${this._width}px`;
        }
        if (placement && this._placement !== placement) {
            this._placement = Tooltip.validatePlacement(placement);
            this._placeTooltip();
        }
        if (showDelay && this._showDelay !== showDelay) this._showDelay = showDelay;
        if (hideDelay && this._hideDelay !== hideDelay) this._hideDelay = hideDelay;
        if (disabled !== undefined && this._disabled !== disabled) this._disabled = disabled;
        if (appearance && this._appearance !== appearance) {
            this._DOMElement!.classList.remove(`cmh-tooltip--${this._appearance}`);
            this._appearance = appearance;
            this._DOMElement!.classList.add(`cmh-tooltip--${this._appearance}`);
        }
        if (showOnDisabledElements !== undefined && this._showOnDisabledElements !== showOnDisabledElements) {
            this._showOnDisabledElements = showOnDisabledElements;
        }
        if (zIndex !== this._zIndex && zIndex !== undefined) this._zIndex = zIndex;
    }

    createParentDOMElementWrapper() {
        const element = document.createElement('div');
        element.classList.add('cmh-tooltip--wrapper');
        this._parentDOMElement.parentNode!.insertBefore(element, this._parentDOMElement);
        element.appendChild(this._parentDOMElement);
        return element;
    }

    createDOMElement(): HTMLElement {
        const element = document.createElement('div');
        element.innerHTML = this._message;
        element.style.width = `${this._width}px`;
        element.setAttribute('aria-hidden', 'false');
        element.classList.add('cmh-tooltip');
        element.classList.add(`cmh-tooltip--${this._appearance}`);
        if (this._zIndex !== null) {
            element.style.zIndex = this._zIndex.toFixed(0);
        }
        return element;
    }

    registerEvents() {
        const target = this._parentDOMElementWrapper ?? this._parentDOMElement;
        target.addEventListener('mouseenter', this.onMouseToggle.bind(this));
        target.addEventListener('mouseleave', this.onMouseToggle.bind(this));
        this._DOMElement!.addEventListener('mouseenter', this.onMouseToggle.bind(this));
        this._DOMElement!.addEventListener('mouseleave', this.onMouseToggle.bind(this));
    }

    onMouseToggle(event: MouseEvent) {
        this._state = event.type === 'mouseenter';
        if (this._timeout) clearTimeout(this._timeout);
        this._timeout = setTimeout(this._toggle.bind(this), this._state ? this._showDelay : this._hideDelay);
    }

    _toggle() {
        if (this._state && !this._isShown && this._doesParentExist()) {
            this.showTooltip();
            return;
        }
        if (!this._state && this._isShown) this.hideTooltip();
    }

    _doesParentExist() {
        const tooltipId = this._parentDOMElement.getAttribute('tooltip-id') ?? '';
        const tag = this._parentDOMElement.tagName.toLowerCase();
        return !!document.querySelector(`${tag}[tooltip-id="${tooltipId}"]`);
    }

    showTooltip() {
        if (this._disabled) return;
        document.body.appendChild(this._DOMElement!);
        this._placeTooltip();
        this._isShown = true;
    }

    hideTooltip() {
        if (this._disabled) return;
        this._DOMElement!.remove();
        this._isShown = false;
    }

    _placeTooltip() {
        let possiblePlacements = [...availableTooltipPlacements];
        let placement = this._placement;
        possiblePlacements = possiblePlacements.filter((pos) => pos !== placement);

        this._DOMElement!.classList.remove(`cmh-tooltip--${this._actualTooltipPlacement!}`);
        this._setDOMElementPosition(this._calculateTooltipPosition(placement ?? 'top'));
        this._actualTooltipPlacement = placement ?? null;

        while (!this._isElementInViewport(this._DOMElement!)) {
            if (possiblePlacements.length < 1) {
                this._actualTooltipPlacement = this._placement ?? null;
                this._setDOMElementPosition(this._calculateTooltipPosition(this._placement ?? 'top'));
                break;
            }
            placement = possiblePlacements.shift();
            this._setDOMElementPosition(this._calculateTooltipPosition(placement ?? 'top'));
            this._actualTooltipPlacement = placement ?? null;
        }

        this._DOMElement!.classList.add(`cmh-tooltip--${this._actualTooltipPlacement ?? ''}`);
    }

    _setDOMElementPosition({ top, left }: { top: string; left: string }) {
        this._DOMElement!.style.top = top;
        this._DOMElement!.style.left = left;
    }

    _calculateTooltipPosition(placement: Placements) {
        const box = this._parentDOMElement.getBoundingClientRect();
        const offset = 10;
        let top: string;
        let left: string;

        switch (placement) {
            case 'bottom':
                top = `${box.top + box.height + offset}px`;
                left = `${box.left + box.width / 2 - this._DOMElement!.offsetWidth / 2}px`;
                break;
            case 'left':
                top = `${box.top + box.height / 2 - this._DOMElement!.offsetHeight / 2}px`;
                left = `${box.left - offset - this._DOMElement!.offsetWidth}px`;
                break;
            case 'right':
                top = `${box.top + box.height / 2 - this._DOMElement!.offsetHeight / 2}px`;
                left = `${box.right + offset}px`;
                break;
            case 'top':
            default:
                top = `${box.top - this._DOMElement!.offsetHeight - offset}px`;
                left = `${box.left + box.width / 2 - this._DOMElement!.offsetWidth / 2}px`;
        }
        return { top, left };
    }

    _isElementInViewport(element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        const winH = window.innerHeight || document.documentElement.clientHeight;
        const winW = window.innerWidth || document.documentElement.clientWidth;
        return rect.top > 0 && rect.right < winW && rect.bottom < winH && rect.left > 0;
    }

    static validatePlacement(placement: string): Placements {
        if (!availableTooltipPlacements.includes(placement as Placements)) {
            console.warn(`[Tooltip] placement must be one of "${availableTooltipPlacements.join(',')}"`);
            return 'top';
        }
        return placement as Placements;
    }

    static validateMessage(message?: string): string {
        if (typeof message !== 'string') {
            console.warn('[Tooltip] message must be a string');
        }
        return message ?? '';
    }

    static validateWidth(width: number | string): number | string {
        if (width === 'auto') return width;
        if (typeof width !== 'number' || width < 1) {
            console.warn('[Tooltip] width must be a number > 0');
            return 200;
        }
        return width;
    }
}

interface TooltipValue {
    message: string;
    position?: Placements;
    showDelay?: number;
    hideDelay?: number;
    disabled?: boolean;
    appearance?: string;
    width?: number | string;
    showOnDisabledElements?: boolean;
    zIndex?: number;
}

function createOrUpdateTooltip(
    el: HTMLElement,
    { value, modifiers }: { value: TooltipValue | string; modifiers: Record<string, boolean> },
) {
    const message = (typeof value === 'string' ? value : value.message)?.trim?.() ?? '';
    const config = typeof value === 'string' ? ({} as TooltipValue) : value;
    const placement = config.position ?? (Object.keys(modifiers)[0] as Placements | undefined);

    const configuration = {
        element: el,
        message,
        placement,
        width: config.width,
        showDelay: config.showDelay,
        hideDelay: config.hideDelay,
        disabled: config.disabled ?? false,
        appearance: config.appearance,
        showOnDisabledElements: config.showOnDisabledElements,
        zIndex: config.zIndex ?? null,
    };

    if (el.hasAttribute('tooltip-id')) {
        const tooltip = tooltipRegistry.get(el.getAttribute('tooltip-id')!);
        tooltip?.update(configuration);
        return;
    }

    const tooltip = new Tooltip(configuration);
    tooltipRegistry.set(tooltip.id ?? '', tooltip);
    el.setAttribute('tooltip-id', tooltip.id!);
}

const tooltipDirective: ObjectDirective<HTMLElement, TooltipValue | string> = {
    beforeMount(el, binding) {
        createOrUpdateTooltip(el, binding);
    },

    mounted(el) {
        if (el.hasAttribute('tooltip-id')) {
            const tooltip = tooltipRegistry.get(el.getAttribute('tooltip-id')!);
            tooltip?.init();
        }
    },

    updated(el, binding) {
        createOrUpdateTooltip(el, binding);
    },

    unmounted(el) {
        if (el.hasAttribute('tooltip-id')) {
            const tooltip = tooltipRegistry.get(el.getAttribute('tooltip-id')!);
            tooltip?.hideTooltip();
            tooltipRegistry.delete(el.getAttribute('tooltip-id')!);
        }
    },
};

export default tooltipDirective;
