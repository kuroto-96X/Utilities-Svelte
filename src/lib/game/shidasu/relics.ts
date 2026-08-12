// src/lib/game/shidasu/relics.ts
import type { RelicId } from './types'
import type { ShidasuParams } from './params'

// レリックの抽選プール。第1弾13候補。
export const RELIC_POOL: RelicId[] = [
  'manekiNeko', 'fukuDaruma', 'kumade', 'juzu',
  'manekiHoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
  'kaiunKokeshi', 'engiKozuchi', 'engiSuzu', 'senjafuda', 'soroban',
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
