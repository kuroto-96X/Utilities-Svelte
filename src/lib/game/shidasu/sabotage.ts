// src/lib/game/shidasu/sabotage.ts
import type { SabotageActionId, StarSabotage } from './types'
import type { ShidasuParams } from './params'

// 妨害行動プール。32件のid(先行実装11個+Phase A 11個+Phase B 10個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
// name・target・intervalTurns・descTemplateの実値はShidasuParams.sabotageActions側で管理する
// (/admin/shidasu-sabotageから編集可能。レリック等と同じ「固定idプール+params.ts側の可変フィールド」構造)。
export const SABOTAGE_POOL: SabotageActionId[] = [
  'stockPurge', 'columnReturn', 'chainSettle', 'comboBreather',
  'talismanSeal', 'riteSeal', 'revelationOracleSeal', 'relicConfiscate',
  'tableauCardToDiscard', 'currencyConfiscate', 'roleSeal',
  'stockPurgeSmall', 'stockShuffle', 'tableauFullReturn', 'tableauShuffle',
  'chainPartialDiscard', 'chainShuffle', 'comboReduce', 'comboCap',
  'talismanConfiscate', 'riteConfiscate', 'riteForceActivate',
  'talismanShuffle', 'revelationOracleConfiscate', 'revelationOracleForceActivate', 'tsukumokaRelease',
  'discardErase', 'discardBury', 'rewardReduce', 'currencyDrain', 'roleLevelDecay', 'roleBias',
]

// 妨害行動の表示名をparams経由で取得する(relicName等と同じパターン)。
export function sabotageActionName(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].name
}

// 妨害行動の効果説明文をparams経由で取得する(プレースホルダー展開は無し、descTemplateは常に完成文)。
export function sabotageActionDesc(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].descTemplate
}

export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL
    case 'some': return sabotage.ids
  }
}

// paramsからintervalTurnsを読むため、paramsを第一引数に取る。
export function rollSabotage(params: ShidasuParams, sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  return { pendingSabotageId: id, sabotageTurnsRemaining: params.sabotageActions[id].intervalTurns }
}
