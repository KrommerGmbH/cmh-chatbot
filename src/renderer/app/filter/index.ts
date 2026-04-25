/**
 * AideWorks Filter Index
 * Vue 3에는 global filter가 없으므로 globalProperties.$filters 로 등록한다.
 *
 * VueAdapter.init() 에서 app.config.globalProperties.$filters = Filters 로 등록됨.
 *
 * 컴포넌트 내 사용법:
 * {{ $filters.truncate(text, 50) }}
 * {{ $filters.date(isoString, { dateStyle: 'medium' }) }}
 */
import type { App } from 'vue';
import { truncate } from './truncate.filter';
import { stripHtml } from './striphtml.filter';
import { date } from './date.filter';
import { fileSize } from './file-size.filter';
import { mediaName } from './media-name.filter';

export const Filters = {
    truncate,
    stripHtml,
    date,
    fileSize,
    mediaName,
} as const;

export type FiltersType = typeof Filters;

export function registerFilters(app: App): void {
    app.config.globalProperties.$filters = Filters;
}

export { truncate, stripHtml, date, fileSize, mediaName };
