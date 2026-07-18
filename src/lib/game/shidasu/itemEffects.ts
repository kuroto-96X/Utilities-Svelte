// src/lib/game/shidasu/itemEffects.ts
import type { Card, ItemId } from './types'
import type { ShidasuParams } from './params'
import type { ChainBonusResult } from './patterns'
import { CLEAR_BONUS_EFFECTS } from './clearBonusEffects'
import { CARD_COMBO_EFFECTS } from './cardComboEffects'
import { CHAIN_ATTRIBUTE_EFFECTS } from './chainAttributeEffects'
import { STATE_AND_PATTERN_EFFECTS } from './stateAndPatternEffects'

export interface ItemEffectContext {
  card: Card
  previousFoundation: Card
  combo: number
  stockRemaining: number
  // 今回プレイしたカード(card)を含むチェーン全体(chainBefore + card)
  chain: Card[]
  // このプレイ後の場札総残数
  remainingTableauCount: number
  // このプレイで成立したパターン/役ボーナスの内訳(evaluateChainBonusの戻り値。列一掃も合流済み)
  chainBonus: ChainBonusResult
  // このプレイがウェーブ開始後の最初のプレイかどうか(山札めくりでは変化しない)
  isFirstPlayOfWave: boolean
  // 序章・幕間用: このスコアリングがプレイによるものか(true)、山札めくり(素朴)によるものか(false)
  isPlayAction: boolean
  // 序章・幕間用: このプレイを含めて、現在のチェーン内で何回目のプレイか
  playCountInChain: number
  // 護符(架橋等)による緩和を反映した、現在有効な階段成立の最小連続枚数
  effectiveStairMinLen: number
  // 護符(架橋等)による緩和を反映した、現在有効な同スート・同色成立の最小枚数
  effectiveSuitColorMinLen: number
  // 微風・共鳴用: このプレイ後の同一列連続回数
  sameColumnStreak: number
  // 蒼穹用: このプレイ後のウェーブ内列一掃累計回数
  totalColumnsEmptiedThisWave: number
  // 琥珀用: このプレイ後のウェーブ内最大到達コンボ数
  maxComboThisWave: number
  // 情熱用: このプレイ後、現在のコンボ中にフラッシュが成立しているか
  flushActiveThisCombo: boolean
  // 闘志用: このプレイ後、このウェーブ中に列一掃が発生しているか
  columnSweepActiveThisWave: boolean
  // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数
  drawContinueCountThisChain: number
  // 慈悲用: 次のコンボの間、倍率xを適用中か
  mercyActiveNextCombo: boolean
}

export type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: string | null }

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  ...CLEAR_BONUS_EFFECTS,
  ...CARD_COMBO_EFFECTS,
  ...CHAIN_ATTRIBUTE_EFFECTS,
  ...STATE_AND_PATTERN_EFFECTS,
}

export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): { value: number; parts: string[] } {
  const parts: string[] = []
  const value = items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    if (!entry || entry.channel !== channel) return v
    const result = entry.effect(v, ctx, params)
    if (result.part) parts.push(result.part)
    return result.value
  }, baseValue)
  return { value, parts }
}
