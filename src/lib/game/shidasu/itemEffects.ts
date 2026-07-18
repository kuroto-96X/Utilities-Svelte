// src/lib/game/shidasu/itemEffects.ts
import type { Card, ItemId } from './types'
import type { ShidasuParams } from './params'
import { fmtMultiplier, type ChainBonusResult } from './patterns'
import { CLEAR_BONUS_EFFECTS } from './clearBonusEffects'
import { CARD_COMBO_EFFECTS } from './cardComboEffects'
import { CHAIN_ATTRIBUTE_EFFECTS } from './chainAttributeEffects'

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
  omen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.omen.m) return { value: v, part: null }
      const factor = p.talismans.omen.x
      return { value: v * factor, part: `兆し×${fmtMultiplier(factor)}` }
    },
  },
  crescent: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.remainingTableauCount > p.talismans.crescent.m) return { value: v, part: null }
      const factor = p.talismans.crescent.x
      return { value: v * factor, part: `三日月×${fmtMultiplier(factor)}` }
    },
  },
  blessing: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.roleFired.length === 0) return { value: v, part: null }
      const factor = p.talismans.blessing.x
      return { value: v * factor, part: `恩寵×${fmtMultiplier(factor)}` }
    },
  },
  focus: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!ctx.chainBonus.roleFired.some(r => r.name === 'sameRank')) return { value: v, part: null }
      const factor = p.talismans.focus.x
      return { value: v * factor, part: `集中×${fmtMultiplier(factor)}` }
    },
  },
  lapis: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const total = ctx.chainBonus.roleFired.length + ctx.chainBonus.patternFiredCount
      if (total < 2) return { value: v, part: null }
      const factor = p.talismans.lapis.x
      return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
    },
  },
  jade: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.chainBonus.roleFired.some(r => r.usedWild)
        ? { value: v + p.talismans.jade.n, part: `翡翠+${p.talismans.jade.n}` }
        : { value: v, part: null },
  },
  emptyMind: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.chainBonus.patternFired || ctx.chainBonus.roleFired.length > 0) return { value: v, part: null }
      const factor = p.talismans.emptyMind.x
      return { value: v * factor, part: `無心×${fmtMultiplier(factor)}` }
    },
  },
  prologue: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === 1
        ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` }
        : { value: v, part: null },
  },
  interlude: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isPlayAction && ctx.playCountInChain === p.talismans.interlude.m
        ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
        : { value: v, part: null },
  },
  morningDew: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.isFirstPlayOfWave ? { value: v + p.talismans.morningDew.n, part: `朝露+${p.talismans.morningDew.n}` } : { value: v, part: null },
  },
  drizzle: {
    channel: 'gained',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.drizzle.n, part: `小雨+${p.talismans.drizzle.n}` }),
  },
  gentleBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const add = ctx.sameColumnStreak * p.talismans.gentleBreeze.n
      return { value: v + add, part: `微風+${add}` }
    },
  },
  resonance: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.sameColumnStreak < 2) return { value: v, part: null }
      const factor = 1 + ctx.sameColumnStreak * p.talismans.resonance.x
      return { value: v * factor, part: `共鳴×${fmtMultiplier(factor)}` }
    },
  },
  azureSky: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.totalColumnsEmptiedThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.totalColumnsEmptiedThisWave * p.talismans.azureSky.x
      return { value: v * factor, part: `蒼穹×${fmtMultiplier(factor)}` }
    },
  },
  amber: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.maxComboThisWave === 0) return { value: v, part: null }
      const factor = 1 + ctx.maxComboThisWave * p.talismans.amber.x
      return { value: v * factor, part: `琥珀×${fmtMultiplier(factor)}` }
    },
  },
  passion: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.flushActiveThisCombo
        ? { value: v * p.talismans.passion.x, part: `情熱×${fmtMultiplier(p.talismans.passion.x)}` }
        : { value: v, part: null },
  },
  fightingSpirit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.columnSweepActiveThisWave
        ? { value: v * p.talismans.fightingSpirit.x, part: `闘志×${fmtMultiplier(p.talismans.fightingSpirit.x)}` }
        : { value: v, part: null },
  },
  intuition: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.drawContinueCountThisChain === 0) return { value: v, part: null }
      const factor = 1 + ctx.drawContinueCountThisChain * p.talismans.intuition.x
      return { value: v * factor, part: `直感×${fmtMultiplier(factor)}` }
    },
  },
  mercy: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.mercyActiveNextCombo
        ? { value: v * p.talismans.mercy.x, part: `慈悲×${fmtMultiplier(p.talismans.mercy.x)}` }
        : { value: v, part: null },
  },
  deadline: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (ctx.stockRemaining === 0) return { value: v, part: null }
      const add = ctx.stockRemaining * p.talismans.deadline.n
      return { value: v + add, part: `刻限+${add}` }
    },
  },
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
