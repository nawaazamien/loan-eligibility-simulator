/**
 * Rand figures shown in an element, ignoring the fictional R69 fee that the static
 * assumptions copy quotes. Before any calculation exists this must be empty.
 */
export function randFigures(element: HTMLElement): string[] {
  const text = element.textContent.replaceAll('A R69 monthly service fee', '');
  return text.match(/R\s?\d[\d\s.,]*/g) ?? [];
}
