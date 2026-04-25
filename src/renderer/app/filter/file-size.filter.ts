/**
 * FileSize filter
 * Formats a file size in bytes to a human-readable string.
 *
 * Usage:
 * $filters.fileSize(1048576) // → '1 MB'
 */
export function fileSize(value: number, locale?: string): string {
    if (!value && value !== 0) return '';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    const formatted = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
    }).format(size);

    return `${formatted} ${units[unitIndex]}`;
}
