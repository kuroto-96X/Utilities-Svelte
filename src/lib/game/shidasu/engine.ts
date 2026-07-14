// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank } from './types'
import type { ShidasuParams } from './params'
import { createDeck, createRng, shuffle, shuffleInPlace } from './deck'

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}

export function isFace(card: Card): boolean {
  return card.rank >= 11
}

export function rankLabel(card: Card): string {
  if (card.wild) return '★'
  return RANK_LABEL[card.rank] ?? String(card.rank)
}

export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  return false
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    const top = col[col.length - 1]
    if (top && isPlayable(modifier, wave, top)) result.add(i)
  })
  return result
}

export function remainingCount(tableau: Card[][]): number {
  return tableau.reduce((n, c) => n + c.length, 0)
}

export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  _items: ItemId[],
  seed?: number
): WaveState {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  const deck = shuffle(createDeck(nextId), rand)
  const { cols, rows } = params.layout
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card

  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: 0,
    chain: [foundation],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: tableau.map(col => col.length),
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
    firstPlayDone: false,
  }
}

export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number
): WaveState {
  if (wave.status !== 'playing') return wave
  const col = wave.tableau[colIndex]
  const card = col?.[col.length - 1]
  if (!card) return wave
  if (!isPlayable(modifier, wave, card)) return wave

  const newCombo = wave.combo + 1
  let base = params.scoring.basePoint
  const parts = [`基礎点+${base}`]

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen)
  base += chainResult.bonus
  parts.push(...chainResult.parts)

  const chainIncludingThis = [...wave.chain, card]

  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const streakStartLength = wave.comboStreakColumnLengths[colIndex]
  const rows = params.layout.rows
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.items.columnSweepRelaxCards
      : streakStartLength === rows
  )
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  const roleFired = [...chainResult.roleFired]
  if (sweepQualifies) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
    roleFired.push({ name: 'columnSweep', usedWild: false })
  }

  const remaining = remainingCount(newTableau)

  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: newCombo,
    stockRemaining: wave.stock.length,
    chain: chainIncludingThis,
    remainingTableauCount: remaining,
    chainBonus: { ...chainResult, roleFired },
    isFirstPlayOfWave: !wave.firstPlayDone,
    effectiveStairMinLen,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  if (multiplier !== 1) parts.push(`コンボ倍率×${fmtMultiplier(multiplier)}`)
  const rawGained = Math.floor(base * multiplier)
  const itemResult = applyItemEffects('gained', rawGained, items, itemEffectCtx, params)
  parts.push(...itemResult.parts)
  const gained = Math.floor(itemResult.value)

  const newScore = wave.score + gained

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    // コンボが継続する間はこのスナップショットを維持する。列の残り枚数が変化しても、
    // 次にdrawStockでコンボがリセットされるまでは更新しない。
    comboStreakColumnLengths: wave.comboStreakColumnLengths,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
    firstPlayDone: true,
  }

  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params).value)
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}

export function drawStock(params: ShidasuParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card, effectiveStairMinLen)

  if (patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: card.wild ? 'wild' : 'pattern',
      lastGain: null,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: 0,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    lastDrawEffect: null,
    lastGain: null,
  }
}

export function isStuck(modifier: StageModifier, wave: WaveState): boolean {
  const remaining = remainingCount(wave.tableau)
  if (remaining === 0) return false
  if (wave.stock.length > 0) return false
  return getPlayableColumns(modifier, wave).size === 0
}

export function markStuck(wave: WaveState): WaveState {
  if (wave.status !== 'playing') return wave
  return { ...wave, status: 'ended', endReason: 'stuck' }
}

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
  // 護符(架橋等)による緩和を反映した、現在有効な階段成立の最小連続枚数
  effectiveStairMinLen: number
}

// 護符の内訳表示用に倍率を丸めて整形する(浮動小数の誤差で末尾が長くなるのを防ぐ)
function fmtMultiplier(n: number): string {
  return String(Math.round(n * 100) / 100)
}

type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => { value: number; part: string | null }

function chainHasNoFace(chain: Card[]): boolean {
  return chain.every(c => c.wild || !isFace(c))
}
function chainIsFaceOnly(chain: Card[]): boolean {
  return chain.every(c => c.wild || isFace(c))
}

function chainSuitExclusive(chain: Card[], suit: Suit): boolean {
  return chain.every(c => c.wild || c.suit === suit)
}

function chainColorExclusive(chain: Card[], red: boolean): boolean {
  return chain.every(c => c.wild || isRed(c) === red)
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

// 赤黒の差(diff)をワイルドで埋めて同数にできるかを判定する。
// ワイルドをwildToRed/wildToBlackに振り分けてrealRed+wildToRed = realBlack+wildToBlackを
// 満たすには、wildToRed-wildToBlack = diffかつwildToRed+wildToBlack = wildCountを共に
// 満たす非負整数解が要る。これはdiff<=wildCountに加えて、両者の差(wildCount-diff)が
// 偶数である場合のみ整数解になる(そうでなければワイルドを半端に割ることになり不可能)。
// (wildCount-diff)の偶奇は合計枚数(realRed+realBlack+wildCount)の偶奇と一致するため、
// 後者で判定する。
function redBlackBalanced(chain: Card[]): boolean {
  const realRed = chain.filter(c => !c.wild && isRed(c)).length
  const realBlack = chain.filter(c => !c.wild && !isRed(c)).length
  const wildCount = chain.filter(c => c.wild).length
  const diff = Math.abs(realRed - realBlack)
  const totalIsEven = (realRed + realBlack + wildCount) % 2 === 0
  return diff <= wildCount && totalIsEven
}

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
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
  calm: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainHasNoFace(ctx.chain) ? { value: v + p.talismans.calm.n, part: `平穏+${p.talismans.calm.n}` } : { value: v, part: null },
  },
  serenity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainHasNoFace(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.serenity.x
      return { value: v * factor, part: `安寧×${fmtMultiplier(factor)}` }
    },
  },
  destiny: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      chainIsFaceOnly(ctx.chain) ? { value: v + p.talismans.destiny.n, part: `運命+${p.talismans.destiny.n}` } : { value: v, part: null },
  },
  fate: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainIsFaceOnly(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.fate.x
      return { value: v * factor, part: `宿命×${fmtMultiplier(factor)}` }
    },
  },
  relief: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.wild || (ctx.card.rank >= 1 && ctx.card.rank <= 10)
        ? { value: v + p.talismans.relief.n, part: `安堵+${p.talismans.relief.n}` }
        : { value: v, part: null },
  },
  verdantGreen: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♣')) return { value: v, part: null }
      const factor = p.talismans.verdantGreen.x
      return { value: v * factor, part: `深緑×${fmtMultiplier(factor)}` }
    },
  },
  gem: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♦')) return { value: v, part: null }
      const factor = p.talismans.gem.x
      return { value: v * factor, part: `宝石×${fmtMultiplier(factor)}` }
    },
  },
  resolve: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♠')) return { value: v, part: null }
      const factor = p.talismans.resolve.x
      return { value: v * factor, part: `真剣×${fmtMultiplier(factor)}` }
    },
  },
  grail: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainSuitExclusive(ctx.chain, '♥')) return { value: v, part: null }
      const factor = p.talismans.grail.x
      return { value: v * factor, part: `聖杯×${fmtMultiplier(factor)}` }
    },
  },
  moonlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, false)) return { value: v, part: null }
      const factor = p.talismans.moonlight.x
      return { value: v * factor, part: `月光×${fmtMultiplier(factor)}` }
    },
  },
  sunlight: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!chainColorExclusive(ctx.chain, true)) return { value: v, part: null }
      const factor = p.talismans.sunlight.x
      return { value: v * factor, part: `陽光×${fmtMultiplier(factor)}` }
    },
  },
  crown: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countRankInChain(ctx.chain, 13)
      if (count === 0) return { value: v, part: null }
      const factor = 1 + count * p.talismans.crown.x
      return { value: v * factor, part: `王冠×${fmtMultiplier(factor)}` }
    },
  },
  cloverLeaf: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♣')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.cloverLeaf.n
      return { value: v + add, part: `青葉+${add}` }
    },
  },
  coin: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♦')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.coin.n
      return { value: v + add, part: `硬貨+${add}` }
    },
  },
  blade: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♠')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.blade.n
      return { value: v + add, part: `武器+${add}` }
    },
  },
  chalice: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const count = countSuitInChain(ctx.chain, '♥')
      if (count === 0) return { value: v, part: null }
      const add = count * p.talismans.chalice.n
      return { value: v + add, part: `献杯+${add}` }
    },
  },
  balance: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      redBlackBalanced(ctx.chain) ? { value: v + p.talismans.balance.n, part: `均衡+${p.talismans.balance.n}` } : { value: v, part: null },
  },
  harmony: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      if (!redBlackBalanced(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.harmony.x
      return { value: v * factor, part: `調和×${fmtMultiplier(factor)}` }
    },
  },
  nobility: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      return { value: v + p.talismans.nobility.n, part: `高潔+${p.talismans.nobility.n}` }
    },
  },
  tenacity: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const { suitHeld } = analyzeSuitColor(ctx.chain)
      if (ctx.chain.length < p.scoring.suitColorMinLen || !suitHeld) return { value: v, part: null }
      const factor = 1 + ctx.chain.length * p.talismans.tenacity.x
      return { value: v * factor, part: `執念×${fmtMultiplier(factor)}` }
    },
  },
  determination: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      if (!stairInfo.held || stairInfo.dir === 0 || stairInfo.len < ctx.effectiveStairMinLen) return { value: v, part: null }
      const factor = 1 + stairInfo.len * p.talismans.determination.x
      return { value: v * factor, part: `覚悟×${fmtMultiplier(factor)}` }
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
      return { value: v * factor, part: `循環×${fmtMultiplier(factor)}` }
    },
  },
  reincarnation: {
    channel: 'gained',
    effect: (v, ctx, p) => {
      const stairInfo = analyzeStair(ctx.chain)
      const completeRunFired = ctx.chainBonus.roleFired.some(r => r.name === 'completeRun')
      if (!completeRunFired || !stairInfo.held || stairInfo.dir === 0 || !stairUsesKALoop(ctx.chain)) return { value: v, part: null }
      const factor = p.talismans.reincarnation.x
      return { value: v * factor, part: `輪廻×${fmtMultiplier(factor)}` }
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
      return { value: v * factor, part: `威光×${fmtMultiplier(factor)}` }
    },
  },
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
      if (ctx.chainBonus.roleFired.length < 2) return { value: v, part: null }
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

export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
]

export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
  grace: '寛容の護符',
  patience: '忍耐の護符',
  purify: '浄化の護符',
  temperance: '節制の護符',
  springBreeze: '春風の護符',
  summerBreeze: '夏風の護符',
  autumnBreeze: '秋風の護符',
  winterBreeze: '冬風の護符',
  kinship: '友愛の護符',
  thaw: '雪解の護符',
  dusk: '宵闇の護符',
  dawn: '払暁の護符',
  wit: '機知の護符',
  courage: '勇気の護符',
  daybreak: '暁の護符',
  twilight: '黄昏の護符',
  cheerful: '快活の護符',
  conscience: '良心の護符',
  morningMist: '朝霧の護符',
  calm: '平穏の護符',
  serenity: '安寧の護符',
  destiny: '運命の護符',
  fate: '宿命の護符',
  relief: '安堵の護符',
  verdantGreen: '深緑の護符',
  gem: '宝石の護符',
  resolve: '真剣の護符',
  grail: '聖杯の護符',
  moonlight: '月光の護符',
  sunlight: '陽光の護符',
  crown: '王冠の護符',
  cloverLeaf: '青葉の護符',
  coin: '硬貨の護符',
  blade: '武器の護符',
  chalice: '献杯の護符',
  balance: '均衡の護符',
  harmony: '調和の護符',
  nobility: '高潔の護符',
  tenacity: '執念の護符',
  determination: '覚悟の護符',
  cycle: '循環の護符',
  reincarnation: '輪廻の護符',
  majesty: '威光の護符',
  omen: '兆しの護符',
  crescent: '三日月の護符',
  blessing: '恩寵の護符',
  focus: '集中の護符',
  lapis: '瑠璃の護符',
  jade: '翡翠の護符',
  emptyMind: '無心の護符',
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
    case 'patience': return `全消しボーナスに残り山札枚数×${params.talismans.patience.x}点を加算`
    case 'purify': return `全消しボーナスに${params.talismans.purify.n}点を加算`
    case 'temperance': return `全消しボーナスを残り山札枚数×${params.talismans.temperance.x}分だけ倍加`
    case 'springBreeze': return `クラブ(♣)を取ったとき、${params.talismans.springBreeze.n}点加算`
    case 'summerBreeze': return `ダイヤ(♦)を取ったとき、${params.talismans.summerBreeze.n}点加算`
    case 'autumnBreeze': return `ハート(♥)を取ったとき、${params.talismans.autumnBreeze.n}点加算`
    case 'winterBreeze': return `スペード(♠)を取ったとき、${params.talismans.winterBreeze.n}点加算`
    case 'kinship': return `他のスートからハート(♥)を取ったとき、${params.talismans.kinship.n}点加算`
    case 'thaw': return `スペード(♠)から別のスートを取ったとき、${params.talismans.thaw.n}点加算`
    case 'dusk': return `赤から黒に変わったとき、${params.talismans.dusk.n}点加算`
    case 'dawn': return `黒から赤に変わったとき、${params.talismans.dawn.n}点加算`
    case 'wit': return `ワイルドを取ったとき、${params.talismans.wit.n}点加算`
    case 'courage': return `コンボ数×${params.talismans.courage.x}分、獲得点を倍加`
    case 'daybreak': return `コンボ数が${params.talismans.daybreak.c}以下のとき、獲得点を${params.talismans.daybreak.x}倍`
    case 'twilight': return `コンボ数が${params.talismans.twilight.c}以上のとき、獲得点を${params.talismans.twilight.x}倍`
    case 'cheerful': return `コンボ数が偶数のとき、${params.talismans.cheerful.n}点加算`
    case 'conscience': return `コンボ数が奇数のとき、${params.talismans.conscience.n}点加算`
    case 'morningMist': return `コンボ数が${params.talismans.morningMist.c}未満のとき獲得点を1/${params.talismans.morningMist.x}に、${params.talismans.morningMist.c}以上のとき${params.talismans.morningMist.x}倍に`
    case 'calm': return `コンボ内にJQKが無いとき、${params.talismans.calm.n}点加算`
    case 'serenity': return `コンボ内にJQKが無いとき、獲得点を${params.talismans.serenity.x}倍`
    case 'destiny': return `コンボ内がJQKのみのとき、${params.talismans.destiny.n}点加算`
    case 'fate': return `コンボ内がJQKのみのとき、獲得点を${params.talismans.fate.x}倍`
    case 'relief': return `取得したカード1枚のランクが1〜10のとき、${params.talismans.relief.n}点加算`
    case 'verdantGreen': return `コンボがクラブ(♣)専有のとき、獲得点を${params.talismans.verdantGreen.x}倍`
    case 'gem': return `コンボがダイヤ(♦)専有のとき、獲得点を${params.talismans.gem.x}倍`
    case 'resolve': return `コンボがスペード(♠)専有のとき、獲得点を${params.talismans.resolve.x}倍`
    case 'grail': return `コンボがハート(♥)専有のとき、獲得点を${params.talismans.grail.x}倍`
    case 'moonlight': return `コンボが黒専有のとき、獲得点を${params.talismans.moonlight.x}倍`
    case 'sunlight': return `コンボが赤専有のとき、獲得点を${params.talismans.sunlight.x}倍`
    case 'crown': return `コンボ内のK枚数×${params.talismans.crown.x}分、獲得点を倍加`
    case 'cloverLeaf': return `コンボ内のクラブ(♣)枚数×${params.talismans.cloverLeaf.n}点を加算`
    case 'coin': return `コンボ内のダイヤ(♦)枚数×${params.talismans.coin.n}点を加算`
    case 'blade': return `コンボ内のスペード(♠)枚数×${params.talismans.blade.n}点を加算`
    case 'chalice': return `コンボ内のハート(♥)枚数×${params.talismans.chalice.n}点を加算`
    case 'balance': return `コンボ内の赤黒枚数が同数のとき、${params.talismans.balance.n}点加算`
    case 'harmony': return `コンボ内の赤黒枚数が同数のとき、獲得点を${params.talismans.harmony.x}倍`
    case 'nobility': return `同スートパターン成立時、${params.talismans.nobility.n}点加算`
    case 'tenacity': return `同スートパターン成立時、コンボ内枚数×${params.talismans.tenacity.x}分、獲得点を倍加`
    case 'determination': return `階段成立時、階段の長さ×${params.talismans.determination.x}分、獲得点を倍加`
    case 'cycle': return `KからA、またはAからKを取ったとき、獲得点を${params.talismans.cycle.x}倍`
    case 'reincarnation': return `コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を${params.talismans.reincarnation.x}倍`
    case 'majesty': return `同スートかつ全ランク階段を達成したとき、獲得点を${params.talismans.majesty.x}倍`
    case 'omen': return `場札の残り枚数が${params.talismans.omen.m}枚以下のとき、獲得点を${params.talismans.omen.x}倍`
    case 'crescent': return `場札の残り枚数が${params.talismans.crescent.m}枚以下のとき、獲得点を${params.talismans.crescent.x}倍`
    case 'blessing': return `役が成立したとき、獲得点を${params.talismans.blessing.x}倍`
    case 'focus': return `同ランクの役が含まれるとき、獲得点を${params.talismans.focus.x}倍`
    case 'lapis': return `2種類以上の役ボーナスが同時に発生したとき、獲得点を${params.talismans.lapis.x}倍`
    case 'jade': return `役の成立にワイルドが使われたとき、${params.talismans.jade.n}点加算`
    case 'emptyMind': return `役・パターンがどちらも無いとき、獲得点を${params.talismans.emptyMind.x}倍`
  }
}

function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  shuffleInPlace(arr, rand)
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return shuffleItems(available, rand).slice(0, 3)
}

export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null }
}

export function beginRun(params: ShidasuParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
    pendingNewItem: null,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = params.stages[run.stageIndex].targets[run.waveIndex]
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const isLastWave = run.waveIndex === params.flow.wavesPerStage - 1
  const isLastStage = run.stageIndex === params.stages.length - 1

  if (isLastWave) {
    return { ...run, phase: isLastStage ? 'allClear' : 'stageClear' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}

export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
  }
}

export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
  }
}

export function cancelItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave: startWave(params, run.stageIndex, newWaveIndex, run.items, seed),
  }
}

export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  return {
    ...run,
    phase: 'playing',
    stageIndex: newStageIndex,
    waveIndex: 0,
    wave: startWave(params, newStageIndex, 0, run.items, seed),
  }
}

export function restartRun(params: ShidasuParams, seed?: number): RunState {
  return beginRun(params, seed)
}

// runがプレイ中でwaveを持つ場合のみfnを適用し、そうでなければrunをそのまま返す
function withActiveWave(run: RunState, fn: (wave: WaveState) => WaveState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  return { ...run, wave: fn(run.wave) }
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number): RunState {
  return withActiveWave(run, wave => {
    const stage = params.stages[run.stageIndex]
    const target = stage.targets[run.waveIndex]
    return playCard(params, wave, stage.modifier, run.items, target, colIndex)
  })
}

export function applyDrawStock(params: ShidasuParams, run: RunState): RunState {
  return withActiveWave(run, wave => drawStock(params, wave, run.items))
}

export function applyStuckCheck(params: ShidasuParams, run: RunState): RunState {
  return withActiveWave(run, wave => {
    const modifier = params.stages[run.stageIndex].modifier
    return isStuck(modifier, wave) ? markStuck(wave) : wave
  })
}

export interface SuitColorAnalysis {
  suitHeld: boolean
  colorHeld: boolean
}

export function analyzeSuitColor(chain: Card[]): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    colorHeld: realCards.every(c => isRed(c) === isRed(first)),
  }
}

export interface StairAnalysis {
  held: boolean
  dir: -1 | 0 | 1
  len: number
}

// rankをdir方向にsteps回分ずらした値を返す(1〜13の循環、K⇔Aのループも跨ぐ)
function stepRank(rank: number, dir: -1 | 1, steps: number): number {
  const zeroBased = rank - 1
  const shifted = ((zeroBased + dir * steps) % 13 + 13) % 13
  return shifted + 1
}

export function analyzeStair(chain: Card[]): StairAnalysis {
  if (chain.length === 0) return { held: true, dir: 0, len: 1 }

  const realPositions = chain
    .map((c, i) => ({ card: c, index: i }))
    .filter(p => !p.card.wild)

  if (realPositions.length === 0) {
    // 実カードが1枚も無い場合、比較対象が無く矛盾しないため都合よく一直線とみなす
    return { held: true, dir: chain.length >= 2 ? 1 : 0, len: chain.length }
  }
  if (realPositions.length === 1) {
    // 方向を確立する相手(2つ目の実カード)が無いため未確立のまま
    return { held: true, dir: 0, len: 1 }
  }

  let dir: -1 | 0 | 1 = 0
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index // 間にあるワイルド枚数+1

    const matchesAscending = stepRank(prev.card.rank, 1, gap) === curr.card.rank
    const matchesDescending = stepRank(prev.card.rank, -1, gap) === curr.card.rank

    if (dir === 0) {
      if (matchesAscending) dir = 1
      else if (matchesDescending) dir = -1
      else return { held: false, dir: 0, len: 1 }
    } else if (!(dir === 1 ? matchesAscending : matchesDescending)) {
      return { held: false, dir: 0, len: 1 }
    }
  }
  return { held: true, dir, len: chain.length }
}

// 階段のチェーンが13→1、または1→13の境界を跨いだか(ワイルドで橋渡しされた区間内の越境も検出する)
export function stairUsesKALoop(chain: Card[]): boolean {
  const analysis = analyzeStair(chain)
  if (!analysis.held || analysis.dir === 0) return false
  const realPositions = chain.map((c, i) => ({ card: c, index: i })).filter(p => !p.card.wild)
  if (realPositions.length < 2) return true
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index
    if (analysis.dir === 1 && prev.card.rank + gap > 13) return true
    if (analysis.dir === -1 && prev.card.rank - gap < 1) return true
  }
  return false
}

const ALL_SUITS_REAL: Suit[] = ['♠', '♥', '♦', '♣']

// checkFlush/checkRoyalSet/checkCompleteRunは、いずれもワイルド1枚につき不足分を1つ埋めたものとして扱う。
// ただし現時点ではワイルドカードを山札に供給する手段が無いため(既存のワイルド供給アイテムは削除済み)、
// この緩和ルールは実際のプレイでは発動しない。将来ワイルド供給アイテムが追加された際に機能する先行実装。
export function checkFlush(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 4) return false
  const last4 = chainIncludingThis.slice(-4)
  const wildCount = last4.filter(c => c.wild).length
  const suitsPresent = new Set(last4.filter(c => !c.wild).map(c => c.suit))
  const missingSuits = ALL_SUITS_REAL.filter(s => !suitsPresent.has(s)).length
  return missingSuits <= wildCount
}

export function checkRoyalSet(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 3) return false
  const last3 = chainIncludingThis.slice(-3)
  const wildCount = last3.filter(c => c.wild).length
  const ranksPresent = new Set(last3.filter(c => !c.wild).map(c => c.rank))
  const requiredRanks: Card['rank'][] = [11, 12, 13]
  const missingRanks = requiredRanks.filter(r => !ranksPresent.has(r)).length
  return missingRanks <= wildCount
}

export function countSameRankBefore(chainBefore: Card[], rank: Card['rank']): number {
  const realMatches = chainBefore.filter(c => !c.wild && c.rank === rank).length
  const wildCount = chainBefore.filter(c => c.wild).length
  return realMatches + wildCount
}

// ワイルド自身をプレイした場合の同ランクボーナス判定用: チェーン内で既に発生している
// 同ランクの最大枚数(既存ワイルドの代役分を含む)に+1枚した数で発生させる(まだ発生していなければ2枚)
export function countSameRankForWildPlay(chainBefore: Card[]): number {
  const realRankCounts = new Map<Card['rank'], number>()
  for (const c of chainBefore) {
    if (!c.wild) realRankCounts.set(c.rank, (realRankCounts.get(c.rank) ?? 0) + 1)
  }
  const maxRealRankCount = realRankCounts.size === 0 ? 0 : Math.max(...realRankCounts.values())
  const wildCountInChain = chainBefore.filter(c => c.wild).length
  return Math.max(maxRealRankCount + wildCountInChain, 1) + 1
}

export function checkCompleteRun(chainBefore: Card[], chainIncludingThis: Card[]): boolean {
  const distinctRealBefore = new Set(chainBefore.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountBefore = chainBefore.filter(c => c.wild).length
  const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountNow = chainIncludingThis.filter(c => c.wild).length

  const distinctBefore = Math.min(13, distinctRealBefore + wildCountBefore)
  const distinctNow = Math.min(13, distinctRealNow + wildCountNow)
  return distinctBefore < 13 && distinctNow >= 13
}

export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'

export interface ChainBonusResult {
  bonus: number
  parts: string[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  roleFired: { name: RoleName; usedWild: boolean }[]
}

export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, roleFired: [] }
  }

  let bonus = 0
  const parts: string[] = []
  let patternFired = false
  const roleFired: { name: RoleName; usedWild: boolean }[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
      patternFired = true
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
      patternFired = true
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
    patternFired = true
  }

  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
    const last4 = chainIncludingThis.slice(-4)
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
    const last3 = chainIncludingThis.slice(-3)
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild })
    if (suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts, patternFired, roleFired }
}

export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}

let debugCardIdSeq = 900000

// デバッグパネル専用: 山札の一番上(次にめくられる札)を指定カードに差し替える。
// idは既存デッキ(最大でも数百枚程度)と衝突しないよう90万番台から発番する。
export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  const card: Card = { id: ++debugCardIdSeq, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
