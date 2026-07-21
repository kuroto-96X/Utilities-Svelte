// src/lib/game/shidasu/oracles.ts
import type { RoleName } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'

// rollOracleOfferは重み付けなしの完全均等抽選。8役すべてが対象(将来の追加余地なし)。
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
]

export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].name
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return params.oracles[roleName].desc
}

// 神託プールから均等ランダムに3つ選ぶ(天啓のrollRevelationOfferと同じ方式。重複除外は無いが、
// 8種類中3つをシャッフルして先頭から取るため、1回のオファー内で同じ役が重複することはない)。
export function rollOracleOffer(rand: () => number = Math.random): RoleName[] {
  const pool = [...ORACLE_POOL]
  shuffleInPlace(pool, rand)
  return pool.slice(0, 3)
}

// 各役のレベルの初期値(全て1)。startWave・createInitialRun・beginRunの既定値として使う。
export function defaultOracleLevels(): Record<RoleName, number> {
  return {
    flush: 1, royalSet: 1, sameRank: 1, completeRun: 1, columnSweep: 1,
    suit: 1, color: 1, stair: 1,
  }
}
