/**
 * Truncate filter
 * Shortens a string to the specified length with optional HTML stripping.
 */
export function truncate(
    value: string = '',
    length: number = 75,
    stripHtml: boolean = true,
    ellipsis: string = '...',
): string {
    if (!value || !value.length) return '';

    const strippedValue = stripHtml ? value.replace(/<\/?("[^"]*"|'[^']*'|[^>])*(>|$)/g, '') : value;

    if (strippedValue.length <= length) return strippedValue;

    return `${strippedValue.slice(0, length - ellipsis.length)}${ellipsis}`;
}
