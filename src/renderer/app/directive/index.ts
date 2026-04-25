/**
 * AideWorks Directive Index
 * Vue 3 directive 등록 엔트리포인트.
 * VueAdapter.init() 에서 호출된다.
 */
import type { App } from 'vue';
import autofocusDirective from './autofocus.directive';
import responsiveDirective from './responsive.directive';
import tooltipDirective from './tooltip.directive';
import { draggableDirective, droppableDirective } from './dragdrop.directive';
import popoverDirective from './popover.directive';

export function registerDirectives(app: App): void {
    app.directive('autofocus', autofocusDirective);
    app.directive('responsive', responsiveDirective);
    app.directive('tooltip', tooltipDirective);
    app.directive('draggable', draggableDirective);
    app.directive('droppable', droppableDirective);
    app.directive('popover', popoverDirective);
}

export {
    autofocusDirective,
    responsiveDirective,
    tooltipDirective,
    draggableDirective,
    droppableDirective,
    popoverDirective,
};
