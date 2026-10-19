/** Joins class names, skipping empty values (CSS-module lookups are typed `string | undefined`). */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
