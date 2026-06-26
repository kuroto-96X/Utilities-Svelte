export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function toHex2(n: number): string {
  return Math.round(n).toString(16).toUpperCase().padStart(2, '0')
}

export function fStr(n: number): string {
  return (n / 255).toFixed(3) + 'f'
}

export function parseHex(
  hex: string
): { r: number; g: number; b: number; a: number } | null {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 && h.length !== 8) return null

  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null

  if (h.length === 6) {
    return { r, g, b, a: 255 }
  }

  const a = parseInt(h.slice(6, 8), 16)
  if (isNaN(a)) return null

  return { r, g, b, a }
}

export function formatColor32(r: number, g: number, b: number, a: number): string {
  return `new Color32(${r}, ${g}, ${b}, ${a})`
}

export function formatColorFloat(r: number, g: number, b: number, a: number): string {
  return `new Color(${fStr(r)}, ${fStr(g)}, ${fStr(b)}, ${fStr(a)})`
}

export function formatHex8(r: number, g: number, b: number, a: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a)}`
}

export function formatHex6(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

export function formatRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
}
