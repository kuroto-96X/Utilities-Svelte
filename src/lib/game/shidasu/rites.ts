// src/lib/game/shidasu/rites.ts
import type { RiteId } from './types'
import type { ShidasuParams } from './params'

// rollRiteは重み付けなしの完全均等抽選。エルダー・フサルク全24種が対象。
export const RITE_POOL: RiteId[] = [
  'raidho', 'jera', 'wunjo', 'othala', 'perthro',
  'uruz', 'ingwaz',
  'gebo', 'fehu', 'dagaz',
  'algiz', 'tiwaz', 'laguz',
  'eihwaz', 'ansuz', 'kenaz', 'thurisaz',
  'hagalaz', 'nauthiz', 'isa', 'sowilo', 'berkano', 'mannaz', 'ehwaz',
]

export function riteName(id: RiteId, params: ShidasuParams): string {
  return params.rites[id].name
}

export function riteDesc(id: RiteId, params: ShidasuParams): string {
  const entry = params.rites[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows, cols: params.layout.cols }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 所持数が上限(3)未満なら、RITE_POOLから1つを均等ランダムに抽選する(既に所持している種類も除外しない)。
// 上限に達していればnullを返す。
export function rollRite(currentRites: RiteId[], rand: () => number = Math.random): RiteId | null {
  if (currentRites.length >= 3) return null
  return RITE_POOL[Math.floor(rand() * RITE_POOL.length)]
}
