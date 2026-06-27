export type Tab = 'dot' | 'cross' | 'angle' | 'lerp' | 'single'

export interface ResultRow {
  label: string
  value: string
  copyable: boolean
}

export function fmt(n: number, d = 3): number {
  return parseFloat(n.toFixed(d))
}

export function fv(x: number, y: number, z: number, d = 3): string {
  return `(${fmt(x, d)}, ${fmt(y, d)}, ${fmt(z, d)})`
}

export function getDotInterpretation(cosA: number): string {
  if (cosA > 0.99)  return 'ほぼ同じ向き'
  if (cosA > 0.5)   return '鋭角（同方向寄り）'
  if (cosA > -0.01) return 'ほぼ直角'
  if (cosA > -0.5)  return '鈍角（逆方向寄り）'
  return 'ほぼ逆向き'
}
