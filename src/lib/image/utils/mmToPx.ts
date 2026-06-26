export function mmToPx(mm: number, dpi = 300): number {
  return Math.round((mm / 25.4) * dpi)
}
