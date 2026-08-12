// src/lib/game/shidasu/relics.ts
import type { RelicId } from './types'
import type { ShidasuParams } from './params'

// レリックの抽選プール。個別候補は未確定のため、現状はシステム動作確認用のplaceholderのみ。
export const RELIC_POOL: RelicId[] = ['placeholder']

export function relicName(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].name
}

export function relicDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].desc
}

export function relicTsukumokaDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].tsukumokaDesc
}
