/**
 * Date filter
 * Formats a date string using Intl.DateTimeFormat.
 *
 * Usage:
 * $filters.date('2024-01-15T00:00:00Z', { year: 'numeric', month: 'long', day: 'numeric' })
 */
export function date(value: string, options: Intl.DateTimeFormatOptions = {}): string {
    if (!value) return '';

    try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';

        return new Intl.DateTimeFormat(undefined, options).format(parsed);
    } catch {
        return '';
    }
}
