// src/lib/game/shidasu/stateAndPatternEffects.ts
import type { ItemId } from './types'
import { fmtMultiplier } from './patterns'
import type { ItemEffect } from './itemEffects'

export const STATE_AND_PATTERN_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
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
