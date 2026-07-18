// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed, fmtMultiplier } from './patterns'
import type { ItemEffect } from './itemEffects'

export const CARD_COMBO_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♣'
        ? { value: v + p.talismans.springBreeze.n, part: `春風+${p.talismans.springBreeze.n}` }
        : { value: v, part: null },
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♦'
        ? { value: v + p.talismans.summerBreeze.n, part: `夏風+${p.talismans.summerBreeze.n}` }
        : { value: v, part: null },
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥'
        ? { value: v + p.talismans.autumnBreeze.n, part: `秋風+${p.talismans.autumnBreeze.n}` }
        : { value: v, part: null },
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♠'
        ? { value: v + p.talismans.winterBreeze.n, part: `冬風+${p.talismans.winterBreeze.n}` }
        : { value: v, part: null },
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥'
        ? { value: v + p.talismans.kinship.n, part: `友愛+${p.talismans.kinship.n}` }
        : { value: v, part: null },
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠'
        ? { value: v + p.talismans.thaw.n, part: `雪解+${p.talismans.thaw.n}` }
        : { value: v, part: null },
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      isRed(ctx.previousFoundation) && !isRed(ctx.card)
        ? { value: v + p.talismans.dusk.n, part: `宵闇+${p.talismans.dusk.n}` }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      !isRed(ctx.previousFoundation) && isRed(ctx.card)
        ? { value: v + p.talismans.dawn.n, part: `払暁+${p.talismans.dawn.n}` }
        : { value: v, part: null },
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild ? { value: v + p.talismans.wit.n, part: `機知+${p.talismans.wit.n}` } : { value: v, part: null },
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.combo * p.talismans.courage.x
      return { value: v * factor, part: `勇気×${fmtMultiplier(factor)}` }
    },
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo <= p.talismans.daybreak.c
        ? { value: v * p.talismans.daybreak.x, part: `暁×${fmtMultiplier(p.talismans.daybreak.x)}` }
        : { value: v, part: null },
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo >= p.talismans.twilight.c
        ? { value: v * p.talismans.twilight.x, part: `黄昏×${fmtMultiplier(p.talismans.twilight.x)}` }
        : { value: v, part: null },
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 === 0
        ? { value: v + p.talismans.cheerful.n, part: `快活+${p.talismans.cheerful.n}` }
        : { value: v, part: null },
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 !== 0
        ? { value: v + p.talismans.conscience.n, part: `良心+${p.talismans.conscience.n}` }
        : { value: v, part: null },
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = ctx.combo < p.talismans.morningMist.c ? 1 / p.talismans.morningMist.x : p.talismans.morningMist.x
      return { value: v * factor, part: `朝霧×${fmtMultiplier(factor)}` }
    },
  },
}
