/**
 * StripHtml filter
 * Removes all HTML tags from a string.
 */
export function stripHtml(value: string): string {
    if (!value) return '';
    return value.replace(/<\/?("[^"]*"|'[^']*'|[^>])*(>|$)/g, '');
}
