// src/lib/game/shidasu/rewardTalismanEffects.ts
import type { Card, ItemId, RoleName, HeldItem } from './types'
import type { ShidasuParams } from './params'
import { analyzeStair, analyzeSuitColor, analyzeAlternatingColor, isFace } from './patterns'

export interface PlayTriggerContext {
  card: Card
  chain: Card[]
  comboBefore: number
  comboAfter: number
  remainingTableauCountBefore: number
  remainingTableauCountAfter: number
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
  sweepQualifies: boolean
  sameColumnStreak: number
}

export interface RewardTalismanTriggerResult {
  // トリガー成立した護符のid一覧
  triggeredIds: ItemId[]
  // triggeredIdsに含まれる各idについて、実際にsellBonusへ加算すべき確定量。
  // 契約: triggeredIdsに含まれるidは必ずこのamountsにも値を持つ(呼び出し元はamounts[id]が
  // 存在する前提でsellBonusへ加算してよく、0扱いへのフォールバックを書く必要はない)。
  amounts: Partial<Record<ItemId, number>>
}

function hasRole(roleFired: { name: RoleName }[], name: RoleName): boolean {
  return roleFired.some(r => r.name === name)
}

// プレイ中に即座にトリガーされる、方向性1の14種の護符について、今回のプレイで
// トリガー成立したものを判定する。heldIdsは所持している護符idの集合(重複含まない、
// 呼び出し元が対象種別ごとに1回だけ呼ぶ)。
export function resolvePlayTriggeredRewardTalismans(
  params: ShidasuParams,
  heldIds: ItemId[],
  ctx: PlayTriggerContext
): RewardTalismanTriggerResult {
  const triggeredIds: ItemId[] = []
  const amounts: Partial<Record<ItemId, number>> = {}
  const trigger = (id: ItemId, amount: number) => {
    triggeredIds.push(id)
    amounts[id] = amount
  }

  for (const id of heldIds) {
    switch (id) {
      case 'koban':
        if (ctx.comboBefore < params.talismans.koban.c && ctx.comboAfter >= params.talismans.koban.c) trigger(id, params.talismans.koban.n)
        break
      case 'senryo':
        if (ctx.comboBefore < params.talismans.senryo.c && ctx.comboAfter >= params.talismans.senryo.c) trigger(id, params.talismans.senryo.n)
        break
      case 'manryo':
        if (ctx.comboBefore < params.talismans.manryo.c && ctx.comboAfter >= params.talismans.manryo.c) trigger(id, params.talismans.manryo.n)
        break
      case 'harvest':
        if (ctx.remainingTableauCountAfter === 0) trigger(id, params.talismans.harvest.n)
        break
      case 'hiddenTreasure':
        if (!ctx.card.wild && ctx.card.suit === '♠' && ctx.card.rank === 1) trigger(id, params.talismans.hiddenTreasure.n)
        break
      case 'greatestTreasure':
        if (!ctx.card.wild && ctx.card.suit === '♥' && ctx.card.rank === 13) trigger(id, params.talismans.greatestTreasure.n)
        break
      case 'heirloom':
        if (!ctx.card.wild && ctx.card.suit === '♦' && ctx.card.rank === 11) trigger(id, params.talismans.heirloom.n)
        break
      case 'treasury':
        if (!ctx.card.wild && ctx.card.suit === '♣' && ctx.card.rank === 12) trigger(id, params.talismans.treasury.n)
        break
      case 'boom':
        if (hasRole(ctx.roleFired, 'flush')) trigger(id, params.talismans.boom.n)
        break
      case 'abundantFunds':
        if (ctx.remainingTableauCountBefore > params.talismans.abundantFunds.m && ctx.remainingTableauCountAfter <= params.talismans.abundantFunds.m) trigger(id, params.talismans.abundantFunds.n)
        break
      case 'savings':
        if (ctx.sameColumnStreak >= 2) trigger(id, (ctx.sameColumnStreak - 1) * params.talismans.savings.n)
        break
      case 'bigCatch':
        if (ctx.sweepQualifies) trigger(id, params.talismans.bigCatch.n)
        break
      case 'grains':
        if (ctx.card.wild) trigger(id, params.talismans.grains.n)
        break
      case 'liveliness': {
        const { suitHeld } = analyzeSuitColor(ctx.chain)
        if (suitHeld && ctx.chain.filter(c => !c.wild).length >= params.talismans.liveliness.m) trigger(id, params.talismans.liveliness.n)
        break
      }
      case 'prosperity': {
        const { colorHeld } = analyzeSuitColor(ctx.chain)
        if (colorHeld && ctx.chain.filter(c => !c.wild).length >= params.talismans.prosperity.m) trigger(id, params.talismans.prosperity.n)
        break
      }
      case 'heavenlyBlessing': {
        const stairInfo = analyzeStair(ctx.chain)
        if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= params.talismans.heavenlyBlessing.m) trigger(id, params.talismans.heavenlyBlessing.n)
        break
      }
      case 'mizuho':
        // items(紅蓮・漆黒による色拡張)は他の同種護符(liveliness/prosperity)と同様に考慮しない。
        // 第3引数minLenを渡すため、デフォルト値[]相当を第2引数に明示している。
        if (analyzeAlternatingColor(ctx.chain, [], params.talismans.mizuho.m).held) trigger(id, params.talismans.mizuho.n)
        break
      case 'bountifulYear':
        if (hasRole(ctx.roleFired, 'royalSet')) trigger(id, params.talismans.bountifulYear.n)
        break
      case 'profit':
        if (hasRole(ctx.roleFired, 'sameRank')) trigger(id, params.talismans.profit.n)
        break
      case 'bounty':
        if (hasRole(ctx.roleFired, 'completeRun')) trigger(id, params.talismans.bounty.n)
        break
      case 'perk':
        if (hasRole(ctx.roleFired, 'pair')) trigger(id, params.talismans.perk.n)
        break
      default:
        break
    }
  }

  return { triggeredIds, amounts }
}

export interface CurrencyGainTriggerContext {
  card: Card
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}

export interface CurrencyGainTriggerResult {
  totalGain: number
}

// プレイ中に即座にcurrency(星片)へ加算される、方向性2の3種(賞金・僥倖・祝儀)を判定する。
// 賞金・祝儀はHeldItem.randomTarget(ウェーブ開始時にinstanceIdごと再抽選済み)を参照するため、
// heldはItemId[]ではなくHeldItem[]全体を受け取る。同名複数所持時は個体ごとに独立して判定・加算する。
export function resolvePlayTriggeredCurrencyGain(
  params: ShidasuParams,
  held: HeldItem[],
  ctx: CurrencyGainTriggerContext,
  rand: () => number = Math.random
): CurrencyGainTriggerResult {
  let totalGain = 0
  for (const h of held) {
    switch (h.id) {
      case 'prizeMoney':
        if (!ctx.card.wild && h.randomTarget === ctx.card.rank) totalGain += params.talismans.prizeMoney.n
        break
      case 'windfall':
        if (isFace(ctx.card) && rand() * 100 < params.talismans.windfall.p) totalGain += params.talismans.windfall.n
        break
      case 'celebration':
        if (ctx.roleFired.some(r => r.name === h.randomTarget)) totalGain += params.talismans.celebration.n
        break
      default:
        break
    }
  }
  return { totalGain }
}
