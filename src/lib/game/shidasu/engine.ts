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

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen)
  base += chainResult.bonus
  const parts = [...chainResult.parts]

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
  if (sweepQualifies) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
  }

  const itemEffectCtx: ItemEffectContext = {
    card,
    previousFoundation: wave.foundation,
    combo: newCombo,
    stockRemaining: wave.stock.length,
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  const rawGained = Math.floor(base * multiplier)
  const gained = Math.floor(applyItemEffects('gained', rawGained, items, itemEffectCtx, params))

  const remaining = remainingCount(newTableau)
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
  }

  if (remaining === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonus = Math.floor(applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params))
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
}

type ItemEffect = (value: number, ctx: ItemEffectContext, params: ShidasuParams) => number

const ITEM_EFFECTS: Partial<Record<ItemId, { channel: 'gained' | 'clearBonus'; effect: ItemEffect }>> = {
  patience: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => v + ctx.stockRemaining * p.talismans.patience.x,
  },
  purify: {
    channel: 'clearBonus',
    effect: (v, _ctx, p) => v + p.talismans.purify.n,
  },
  temperance: {
    channel: 'clearBonus',
    effect: (v, ctx, p) => v * (1 + ctx.stockRemaining * p.talismans.temperance.x),
  },
  springBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♣' ? v + p.talismans.springBreeze.n : v),
  },
  summerBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♦' ? v + p.talismans.summerBreeze.n : v),
  },
  autumnBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♥' ? v + p.talismans.autumnBreeze.n : v),
  },
  winterBreeze: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.suit === '♠' ? v + p.talismans.winterBreeze.n : v),
  },
  kinship: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.card.suit === '♥' && ctx.previousFoundation.suit !== '♥' ? v + p.talismans.kinship.n : v,
  },
  thaw: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.previousFoundation.suit === '♠' && ctx.card.suit !== '♠' ? v + p.talismans.thaw.n : v,
  },
  dusk: {
    channel: 'gained',
    effect: (v, ctx, p) => (isRed(ctx.previousFoundation) && !isRed(ctx.card) ? v + p.talismans.dusk.n : v),
  },
  dawn: {
    channel: 'gained',
    effect: (v, ctx, p) => (!isRed(ctx.previousFoundation) && isRed(ctx.card) ? v + p.talismans.dawn.n : v),
  },
  wit: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.card.wild ? v + p.talismans.wit.n : v),
  },
  courage: {
    channel: 'gained',
    effect: (v, ctx, p) => v * (1 + ctx.combo * p.talismans.courage.x),
  },
  daybreak: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo <= p.talismans.daybreak.c ? v * p.talismans.daybreak.x : v),
  },
  twilight: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo >= p.talismans.twilight.c ? v * p.talismans.twilight.x : v),
  },
  cheerful: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo % 2 === 0 ? v + p.talismans.cheerful.n : v),
  },
  conscience: {
    channel: 'gained',
    effect: (v, ctx, p) => (ctx.combo % 2 !== 0 ? v + p.talismans.conscience.n : v),
  },
  morningMist: {
    channel: 'gained',
    effect: (v, ctx, p) =>
      ctx.combo < p.talismans.morningMist.c ? v / p.talismans.morningMist.x : v * p.talismans.morningMist.x,
  },
}

export function applyItemEffects(
  channel: 'gained' | 'clearBonus',
  baseValue: number,
  items: ItemId[],
  ctx: ItemEffectContext,
  params: ShidasuParams
): number {
  return items.reduce((v, id) => {
    const entry = ITEM_EFFECTS[id]
    return entry && entry.channel === channel ? entry.effect(v, ctx, params) : v
  }, baseValue)
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

export interface ChainBonusResult {
  bonus: number
  parts: string[]
}

export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [] }
  }

  let bonus = 0
  const parts: string[] = []

  const chainIncludingThis = [...chainBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (chainIncludingThis.length >= scoring.suitColorMinLen) {
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
  }

  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    if (suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts }
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
