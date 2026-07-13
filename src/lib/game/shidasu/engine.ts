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

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  const gained = Math.floor(base * multiplier)

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
    const clearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}

export function drawStock(params: ShidasuParams, wave: WaveState, _items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card

  if (card.wild) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: 'wild',
      lastGain: null,
    }
  }

  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card)

  if (patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: 'pattern',
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

export const ITEM_POOL: ItemId[] = ['bridge', 'grace']

export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
  grace: '寛容の護符',
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
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
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null }
}

export function beginRun(params: ShidasuParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
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
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand) }
}

export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
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

export function analyzeStair(chain: Card[]): StairAnalysis {
  let dir: -1 | 0 | 1 = 0
  let len = 1
  let prevReal: Card | null = null
  let justHadWild = false

  for (const c of chain) {
    if (c.wild) {
      justHadWild = true
      continue
    }
    if (prevReal === null) {
      prevReal = c
      continue
    }
    if (justHadWild) {
      if (dir !== 0) len += 1
      justHadWild = false
      prevReal = c
      continue
    }
    let d = c.rank - prevReal.rank
    if (d === 12) d = -1
    if (d === -12) d = 1
    if (Math.abs(d) !== 1) {
      return { held: false, dir: 0, len: 1 }
    }
    if (dir === 0) {
      dir = d as -1 | 1
      len = 2
    } else if (d === dir) {
      len += 1
    } else {
      return { held: false, dir: 0, len: 1 }
    }
    prevReal = c
  }
  return { held: true, dir, len }
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

export function countSameRankBefore(realCardsBefore: Card[], rank: Card['rank']): number {
  return realCardsBefore.filter(c => c.rank === rank).length
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

  const realBefore = chainBefore.filter(c => !c.wild)
  const chainIncludingThis = [...chainBefore, card]
  const realIncludingThis = [...realBefore, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
  if (realIncludingThis.length >= scoring.suitColorMinLen) {
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

  const sameRankCount = countSameRankBefore(realBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    if (analyzeSuitColor(realIncludingThis).suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts }
}

export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card
): boolean {
  if (chain.length === 0) return false

  const realChain = chain.filter(c => !c.wild)
  const { suitHeld, colorHeld } = analyzeSuitColor(chain)
  if (realChain.length > 0) {
    const anchor = realChain[0]
    // suitHeldは実カード1枚のみの場合も便宜上trueになる(analyzeSuitColorの仕様)ため、
    // 「同スート」条件を優先評価し、それが不成立の場合のみ「同色」条件にフォールバックする
    // (evaluateChainBonusのsuitBonus/colorBonus判定と同じ優先順位)
    if (suitHeld) {
      if (card.suit === anchor.suit) return true
    } else if (colorHeld) {
      if (isRed(card) === isRed(anchor)) return true
    }
  }

  const stairInfo = analyzeStair(chain)
  if (stairInfo.held && stairInfo.dir !== 0 && realChain.length > 0) {
    const lastReal = realChain[realChain.length - 1]
    let d = card.rank - lastReal.rank
    if (d === 12) d = -1
    if (d === -12) d = 1
    if (d === stairInfo.dir) return true
  }

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
