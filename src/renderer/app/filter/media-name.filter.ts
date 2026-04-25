/**
 * MediaName filter
 * Returns formatted file name with extension from a media entity object.
 *
 * Usage:
 * $filters.mediaName({ fileName: 'photo', fileExtension: 'jpg' }) // → 'photo.jpg'
 * $filters.mediaName({ entity: { fileName: 'photo', fileExtension: 'jpg' } }) // → 'photo.jpg'
 */
export function mediaName(
    value:
        | {
              entity?: { fileName?: string; fileExtension?: string };
              fileName?: string;
              fileExtension?: string;
          }
        | null
        | undefined,
    fallback: string = '',
): string {
    if (!value) return fallback;

    const target = value.entity ?? value;

    if (!target.fileName || !target.fileExtension) return fallback;

    return `${target.fileName}.${target.fileExtension}`;
}
