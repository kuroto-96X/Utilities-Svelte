// src/lib/game/shidasu/clearBonusEffects.ts
import type { ItemId } from './types'
import { fmtMultiplier } from './patterns'
import type { ItemEffect } from './itemEffects'

export const CLEAR_BONUS_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const add = ctx.stockRemaining * p.talismans.patience.x
      return { value: v + add, part: `忍耐+${add}` }
    },
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => ({ value: v + p.talismans.purify.n, part: `浄化+${p.talismans.purify.n}` }),
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.stockRemaining * p.talismans.temperance.x
      return { value: v * factor, part: `節制×${fmtMultiplier(factor)}` }
    },
  },
}
