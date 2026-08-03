// src/lib/game/shidasu/chainAttributeEffects.ts
import type { Card, ItemId, Suit } from './types'
import { isFace, analyzeSuitColor, analyzeStair, stairUsesKALoop, cardColors } from './patterns'
import { addPart, multiplyPart } from './scoreParts'
import type { ItemEffect } from './itemEffects'

function chainHasNoFace(chain: Card[]): boolean {
  return chain.every(c => c.wild || !isFace(c))
}
function chainIsFaceOnly(chain: Card[]): boolean {
  return chain.every(c => c.wild || isFace(c))
}

function chainSuitExclusive(chain: Card[], suit: Suit): boolean {
  return chain.every(c => c.wild || c.suit === suit)
}

// red=trueなら「全カードがredを含む」、red=falseなら「全カードがblackを含む」で判定する
// (紅蓮・漆黒所持時、複数色を持つカードはどちらの専有判定も満たしうる)
function chainColorExclusive(chain: Card[], red: boolean, items: ItemId[]): boolean {
  return chain.every(c => {
    if (c.wild) return true
    const colors = cardColors(c, items)
    return red ? colors.red : colors.black
  })
}

function countSuitInChain(chain: Card[], suit: Suit): number {
  const real = chain.filter(c => !c.wild && c.suit === suit).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

function countRankInChain(chain: Card[], rank: Card['rank']): number {
  const real = chain.filter(c => !c.wild && c.rank === rank).length
  const wild = chain.filter(c => c.wild).length
  return real + wild
}

// 赤黒の差(diff)をワイルドで埋めて同数にできるかを判定する。紅蓮・漆黒所持時、両方の性質を
// 持つカード(例: 紅蓮所持時の黒札はred:true・black:trueの両方)は、赤としても黒としても
// カウントできる「都合の良い解釈」を適用する。具体的には、実カードのうち「赤のみ(blackを
// 持たない)」枚数をrealRedOnly、「黒のみ」枚数をrealBlackOnly、「両方持つ(紅蓮/漆黒の
// 効果で拡張されたカード)」枚数をflexibleとし、flexibleはワイルドと同様どちらにも
// 割り振れる母数として扱う。
function redBlackBalanced(chain: Card[], items: ItemId[]): boolean {
  const realCards = chain.filter(c => !c.wild)
  let realRedOnly = 0
  let realBlackOnly = 0
  let flexible = 0
  for (const c of realCards) {
    const colors = cardColors(c, items)
    if (colors.red && colors.black) flexible += 1
    else if (colors.red) realRedOnly += 1
    else realBlackOnly += 1
  }
  const wildCount = chain.filter(c => c.wild).length
  const totalFlexible = wildCount + flexible
  const diff = Math.abs(realRedOnly - realBlackOnly)
  const totalIsEven = (realRedOnly + realBlackOnly + totalFlexible) % 2 === 0
  return diff <= totalFlexible && totalIsEven
}

export const CHAIN_ATTRIBUTE_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  calm: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: addPart('平穏', p.talismans.calm.n) } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: multiplyPart('安寧', factor) }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: addPart('運命', p.talismans.destiny.n) } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: multiplyPart('宿命', factor) }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: addPart('安堵', p.talismans.relief.n) }
        : { value: v, part: null },
  },
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: multiplyPart('深緑', factor) }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: multiplyPart('宝石', factor) }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: multiplyPart('真剣', factor) }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: multiplyPart('聖杯', factor) }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: multiplyPart('月光', factor) }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: multiplyPart('陽光', factor) }
    },
  },
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: multiplyPart('王冠', factor) }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: addPart('青葉', add) }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: addPart('硬貨', add) }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: addPart('武器', add) }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: addPart('献杯', add) }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain, ctx.items) ? { value: v + p.talismans.balance.n, part: addPart('均衡', p.talismans.balance.n) } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain, ctx.items)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: multiplyPart('調和', factor) }
    },
  },
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: addPart('高潔', p.talismans.nobility.n) }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < ctx.effectiveSuitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: multiplyPart('執念', factor) }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: multiplyPart('覚悟', factor) }
    },
  },
  cycle: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const matches = (c: Card, rank: Card['rank']) => c.wild || c.rank === rank
      const kToA = matches(ctx.previousFoundation, 13) && matches(ctx.card, 1)
      const aToK = matches(ctx.previousFoundation, 1) && matches(ctx.card, 13)
      if (!kToA && !aToK) return { value: v, part: null }
      const factor = p.talismans.cycle.x
      return { value: v * factor, part: multiplyPart('循環', factor) }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: multiplyPart('輪廻', factor) }
    },
  },
  majesty: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !suitHeld) return { value: v, part: null }
      const factor = p.talismans.majesty.x
      return { value: v * factor, part: multiplyPart('威光', factor) }
    },
  },
}
