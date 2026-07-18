// src/lib/game/shidasu/directEffects.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { itemName } from './items'

export type DirectChannel = 'resetDirect' | 'stockEmptyDirect' | 'comboMilestoneDirect' | 'drawContinueDirect'

export interface DirectEffectContext {
  comboBeforeReset: number
  hasPlayableColumns: boolean
  roleFiredThisChain: boolean
  remainingTableauCount: number
  combo: number
  colorHeld: boolean
  // 流星用: このアクション直前のコンボ数(閾値をまたいで通過したかの判定に使う)
  previousCombo: number
  // 流星用: このアクションの通常獲得点(gained)を加算した後のスコア
  scoreAfterGained: number
}

type DirectEffect = (ctx: DirectEffectContext, params: ShidasuParams) => number

const DIRECT_EFFECTS: Partial<Record<ItemId, { channel: DirectChannel; effect: DirectEffect }>> = {
  composure: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.hasPlayableColumns ? 0 : p.talismans.composure.n),
  },
  clarity: {
    channel: 'resetDirect',
    effect: (ctx, p) => (ctx.roleFiredThisChain ? 0 : p.talismans.clarity.n),
  },
  echo: {
    channel: 'resetDirect',
    effect: (ctx, p) => ctx.comboBeforeReset * p.talismans.echo.n,
  },
  arrogance: {
    channel: 'stockEmptyDirect',
    effect: (ctx, p) => ctx.remainingTableauCount * p.talismans.arrogance.x,
  },
  shootingStar: {
    channel: 'comboMilestoneDirect',
    effect: (ctx, p) => {
      const c = p.talismans.shootingStar.c
      if (ctx.previousCombo >= c || ctx.combo < c) return 0
      return Math.floor(ctx.scoreAfterGained * p.talismans.shootingStar.p / 100)
    },
  },
  sincerity: {
    channel: 'drawContinueDirect',
    effect: (ctx, p) => (ctx.colorHeld ? p.talismans.sincerity.n : 0),
  },
}

export function applyDirectEffects(
  channel: DirectChannel,
  items: ItemId[],
  ctx: DirectEffectContext,
  params: ShidasuParams
): { value: number; parts: string[] } {
  const parts: string[] = []
  const value = items.reduce((total, id) => {
    const entry = DIRECT_EFFECTS[id]
    if (!entry || entry.channel !== channel) return total
    const amount = entry.effect(ctx, params)
    if (amount !== 0) parts.push(`${itemName(id, params)}+${amount}`)
    return total + amount
  }, 0)
  return { value, parts }
}
