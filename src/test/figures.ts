/**
 * Rand figures shown in an element, ignoring the R1 000 rounding step that the
 * assumptions copy quotes. Before any calculation exists this must be empty.
 */
export function randFigures(element: HTMLElement): string[] {
  const text = element.textContent.replaceAll(/largest R1\s000 step/g, '');
  return text.match(/R\s?\d[\d\s.,]*/g) ?? [];
}
