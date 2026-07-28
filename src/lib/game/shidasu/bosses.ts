// src/lib/game/shidasu/bosses.ts
import type { ShidasuParams } from './params'

// 指定したwaveSlotに属する星の一覧を返す(管理画面の件数表示・バリデーションで使う)。
export function starsInSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3): ShidasuParams['stars'] {
  return params.stars.filter(s => s.waveSlot === waveSlot)
}
