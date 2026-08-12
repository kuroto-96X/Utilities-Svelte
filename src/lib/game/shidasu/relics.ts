// src/lib/game/shidasu/relics.ts
import type { RelicId } from './types'
import type { ShidasuParams } from './params'

// レリックの抽選プール。第1弾13候補。
export const RELIC_POOL: RelicId[] = [
  'maneki-neko', 'fuku-daruma', 'kumade', 'juzu',
  'maneki-hoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
  'kaiun-kokeshi', 'engi-kozuchi', 'engi-suzu', 'senjafuda', 'soroban',
]

export function relicName(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].name
}

export function relicDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].desc
}

export function relicTsukumokaDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].tsukumokaDesc
}
