// src/lib/game/shidasu/cardComboEffects.ts
import type { ItemId } from './types'
import { isRed, cardColors } from './patterns'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

export const CARD_COMBO_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♣'
        ? { value: v + p.talismans.springBreeze.n, part: addPart('春風', p.talismans.springBreeze.n) }
        : { value: v, part: null },
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♦'
        ? { value: v + p.talismans.summerBreeze.n, part: addPart('夏風', p.talismans.summerBreeze.n) }
        : { value: v, part: null },
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥'
        ? { value: v + p.talismans.autumnBreeze.n, part: addPart('秋風', p.talismans.autumnBreeze.n) }
        : { value: v, part: null },
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♠'
        ? { value: v + p.talismans.winterBreeze.n, part: addPart('冬風', p.talismans.winterBreeze.n) }
        : { value: v, part: null },
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥'
        ? { value: v + p.talismans.kinship.n, part: addPart('友愛', p.talismans.kinship.n) }
        : { value: v, part: null },
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠'
        ? { value: v + p.talismans.thaw.n, part: addPart('雪解', p.talismans.thaw.n) }
        : { value: v, part: null },
  },
  dusk: {
    channel: 'gained',
    // 直前の札がredを含み、かつ今回の札がblackを含めば成立(紅蓮所持時は黒札もredを含むため、
    // 黒札→黒札の連続でも成立しうる)
    effect: (v, ctx, p) =>
      cardColors(ctx.previousFoundation, ctx.items).red && cardColors(ctx.card, ctx.items).black
        ? { value: v + p.talismans.dusk.n, part: addPart('宵闇', p.talismans.dusk.n) }
        : { value: v, part: null },
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      cardColors(ctx.previousFoundation, ctx.items).black && cardColors(ctx.card, ctx.items).red
        ? { value: v + p.talismans.dawn.n, part: addPart('払暁', p.talismans.dawn.n) }
        : { value: v, part: null },
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild ? { value: v + p.talismans.wit.n, part: addPart('機知', p.talismans.wit.n) } : { value: v, part: null },
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = 1 + ctx.combo * p.talismans.courage.x
      return { value: v * factor, part: multiplyPart('勇気', factor) }
    },
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo <= p.talismans.daybreak.c
        ? { value: v * p.talismans.daybreak.x, part: multiplyPart('暁', p.talismans.daybreak.x) }
        : { value: v, part: null },
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo >= p.talismans.twilight.c
        ? { value: v * p.talismans.twilight.x, part: multiplyPart('黄昏', p.talismans.twilight.x) }
        : { value: v, part: null },
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 === 0
        ? { value: v + p.talismans.cheerful.n, part: addPart('快活', p.talismans.cheerful.n) }
        : { value: v, part: null },
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo % 2 !== 0
        ? { value: v + p.talismans.conscience.n, part: addPart('良心', p.talismans.conscience.n) }
        : { value: v, part: null },
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const factor = ctx.combo < p.talismans.morningMist.c ? 1 / p.talismans.morningMist.x : p.talismans.morningMist.x
      return { value: v * factor, part: multiplyPart('朝霧', factor) }
    },
  },
}
