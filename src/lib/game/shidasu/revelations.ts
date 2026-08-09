// src/lib/game/shidasu/revelations.ts
import type { RevelationId } from './types'
import type { ShidasuParams } from './params'
import { rollOffer } from './deck'

// rollRevelationOfferは重み付けなしの完全均等抽選。効果が実装済みの12種のみが対象。
export const REVELATION_POOL: RevelationId[] = [
  'kaku', 'kou', 'tei', 'bou',
  'shin', 'bi', 'ki', 'to',
  'gyu', 'jo',
  'kyo',
  'aya',
  'shitsu',
]

export function revelationName(id: RevelationId, params: ShidasuParams): string {
  return params.revelations[id].name
}

export function revelationDesc(id: RevelationId, params: ShidasuParams): string {
  const entry = params.revelations[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows, cols: params.layout.cols }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}

// 天啓プールから均等ランダムに3つ選ぶ(所持数に関わらず重複除外しない、秘儀のrollRiteと同じ方式。
// ただしrollRiteと異なり、常に3つ返す(所持上限による抽選中断は無い。上限時の「獲得」不可判定は
// 呼び出し側=engine.tsのpickRevelationFromOfferで行う))。
export function rollRevelationOffer(rand: () => number = Math.random, count = 3): RevelationId[] {
  return rollOffer(REVELATION_POOL, count, rand)
}
