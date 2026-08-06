// src/lib/game/shidasu/oracles.ts
import type { RoleName } from './types'
import type { ShidasuParams } from './params'
import { rollOffer } from './deck'

// rollOracleOfferは重み付けなしの完全均等抽選。8役すべてが対象(将来の追加余地なし)。
export const ORACLE_POOL: RoleName[] = [
  'completeRun', 'royalSet', 'flush', 'stair', 'color', 'suit', 'columnSweep', 'sameRank',
]

// params.oraclesはpair・alternatingを含まない(YAGNI判断、実装計画のTask 1参照)。
// RoleName型はpair・alternatingを含むため、インデックスアクセスは型エラーになる。
// ORACLE_POOLにpair・alternatingが含まれない限り実行時にこの分岐へは入らないが、
// 型安全のためPartialでキャストしフォールバックを用意する。
function oracleEntry(roleName: RoleName, params: ShidasuParams): { name: string; desc: string } | undefined {
  return (params.oracles as Partial<Record<RoleName, { name: string; desc: string }>>)[roleName]
}

export function oracleName(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.name ?? roleName
}

export function oracleDesc(roleName: RoleName, params: ShidasuParams): string {
  return oracleEntry(roleName, params)?.desc ?? ''
}

// 神託プールから均等ランダムに3つ選ぶ(天啓のrollRevelationOfferと同じ方式。重複除外は無いが、
// 8種類中3つをシャッフルして先頭から取るため、1回のオファー内で同じ役が重複することはない)。
export function rollOracleOffer(rand: () => number = Math.random, count = 3): RoleName[] {
  return rollOffer(ORACLE_POOL, count, rand)
}

// 各役のレベルの初期値(全て1)。startWave・createInitialRun・beginRunの既定値として使う。
export function defaultOracleLevels(): Record<RoleName, number> {
  return {
    flush: 1, royalSet: 1, sameRank: 1, completeRun: 1, columnSweep: 1,
    suit: 1, color: 1, stair: 1,
    pair: 1, alternating: 1,
  }
}
