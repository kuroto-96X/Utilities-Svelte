// src/lib/game/culmen/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit } from './types'
import type { CulmenParams } from './params'
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

export interface PatternResult {
  bonus: number
  parts: string[]
  newStairDir: -1 | 0 | 1
  newStairLen: number
}

interface StairTransition {
  newStairDir: -1 | 0 | 1
  newStairLen: number
}

// ランク差から階段の方向・長さを更新する(A-Kのループ跨ぎも±1に正規化する)
function computeStairTransition(
  prevRank: number,
  cardRank: number,
  stairDir: -1 | 0 | 1,
  stairLen: number
): StairTransition {
  let d = cardRank - prevRank
  if (d === 12) d = -1
  if (d === -12) d = 1

  if (Math.abs(d) !== 1) {
    return { newStairDir: 0, newStairLen: 1 }
  }
  if (d === stairDir) {
    return { newStairDir: d as -1 | 1, newStairLen: stairLen + 1 }
  }
  return { newStairDir: d as -1 | 1, newStairLen: 2 }
}

export function evaluatePattern(
  scoring: CulmenParams['scoring'],
  prev: Card | null,
  prevIsWild: boolean,
  card: Card,
  stairDir: -1 | 0 | 1,
  stairLen: number
): PatternResult {
  if (!prev) {
    return { bonus: 0, parts: [], newStairDir: 0, newStairLen: 1 }
  }

  if (prevIsWild) {
    let bonus = scoring.wildSuitBonus
    const parts = [`★同スート+${scoring.wildSuitBonus}`]
    let newStairDir: -1 | 0 | 1 = 0
    let newStairLen = 1
    if (stairDir !== 0) {
      newStairDir = stairDir
      newStairLen = stairLen + 1
      if (newStairLen >= scoring.stairMinLen) {
        bonus += scoring.stairBonus
        parts.push(`階段${newStairLen} +${scoring.stairBonus}`)
      }
    }
    return { bonus, parts, newStairDir, newStairLen }
  }

  let bonus = 0
  const parts: string[] = []
  if (card.suit === prev.suit) {
    bonus += scoring.suitBonus
    parts.push(`同スート+${scoring.suitBonus}`)
  } else if (isRed(card) === isRed(prev)) {
    bonus += scoring.colorBonus
    parts.push(`同色+${scoring.colorBonus}`)
  }

  const { newStairDir, newStairLen } = computeStairTransition(prev.rank, card.rank, stairDir, stairLen)
  if (newStairDir !== 0 && newStairLen >= scoring.stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${newStairLen} +${scoring.stairBonus}`)
  }

  return { bonus, parts, newStairDir, newStairLen }
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

function countItem(items: ItemId[], id: ItemId): number {
  return items.filter(x => x === id).length
}

export function startWave(
  params: CulmenParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  seed?: number
): WaveState {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  const shieldCount = countItem(items, 'shield')
  const stock5Count = countItem(items, 'stock5')
  const wild1Count = countItem(items, 'wild1')
  const hasStart1 = items.includes('start1')

  let deck = shuffle(createDeck(nextId), rand)
  const { cols, rows } = params.layout
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card

  const extra = stock5Count * params.items.extraStockCount
  if (extra > 0) {
    // createDeckは52枚単位でしか生成できないため、extraが52を超える場合は複数回生成して積み増す
    const dupSource: Card[] = []
    while (dupSource.length < extra) {
      const need = extra - dupSource.length
      dupSource.push(...shuffle(createDeck(nextId), rand).slice(0, need))
    }
    deck = shuffle([...deck, ...dupSource], rand)
  }

  const wildCount = wild1Count * params.items.wildPerPick
  for (let i = 0; i < wildCount; i++) {
    const pos = Math.floor(rand() * Math.max(1, deck.length))
    deck.splice(pos, 0, { id: nextId(), suit: '★', rank: 0, wild: true })
  }

  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: hasStart1 ? params.items.startCombo : 0,
    shieldLeft: shieldCount * params.items.shieldChargesPerPick,
    chain: [],
    linked: false,
    stairDir: 0,
    stairLen: 1,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
  }
}

export function playCard(
  params: CulmenParams,
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
  if (isRed(card) && items.includes('red5')) base += params.items.redBonusValue
  if (isFace(card) && items.includes('face10')) base += params.items.faceBonusValue

  const prevCard = wave.linked && wave.chain.length > 0 ? wave.chain[wave.chain.length - 1] : null
  const prevIsWild = !!prevCard?.wild
  const pattern = evaluatePattern(params.scoring, prevCard, prevIsWild, card, wave.stairDir, wave.stairLen)
  base += pattern.bonus

  const gained = base * newCombo
  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const remaining = remainingCount(newTableau)
  const newScore = wave.score + gained

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    linked: true,
    stairDir: pattern.newStairDir,
    stairLen: pattern.newStairLen,
    score: newScore,
    lastGain: { points: gained, parts: pattern.parts },
    status: 'playing',
    endReason: null,
  }

  if (remaining === 0) {
    const bonus = params.scoring.clearBonus + (items.includes('clear300') ? params.items.fullClearItemBonus : 0)
    return { ...next, score: newScore + bonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}

export function drawStock(params: CulmenParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card
  const baseCombo = items.includes('start1') ? params.items.startCombo : 0

  if (card.wild) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      linked: true,
    }
  }

  if (wave.combo > baseCombo && wave.shieldLeft > 0) {
    const prev = wave.linked ? [...wave.chain].reverse().find(c => !c.wild) ?? null : null
    const { newStairDir, newStairLen } = prev
      ? computeStairTransition(prev.rank, card.rank, wave.stairDir, wave.stairLen)
      : { newStairDir: 0 as const, newStairLen: 1 }
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      shieldLeft: wave.shieldLeft - 1,
      chain: [...wave.chain, card],
      linked: true,
      stairDir: newStairDir,
      stairLen: newStairLen,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: baseCombo,
    chain: [],
    linked: false,
    stairDir: 0,
    stairLen: 1,
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

export const ITEM_POOL: ItemId[] = ['red5', 'face10', 'shield', 'stock5', 'wild1', 'start1', 'clear300']
export const UNIQUE_ITEMS: ItemId[] = ['red5', 'face10', 'start1', 'clear300']

export const ITEM_NAMES: Record<ItemId, string> = {
  red5: '紅の目利き',
  face10: '宮廷の紋章',
  shield: 'コンボシールド',
  stock5: '厚めの山札',
  wild1: 'ワイルド★',
  start1: '助走',
  clear300: '完全消去',
}

export function itemDesc(id: ItemId, params: CulmenParams): string {
  switch (id) {
    case 'red5': return `♥♦の基礎点 +${params.items.redBonusValue}`
    case 'face10': return `J/Q/Kの基礎点 +${params.items.faceBonusValue}`
    case 'shield': return `山札めくりのコンボリセットを毎ウェーブ${params.items.shieldChargesPerPick}回無効`
    case 'stock5': return `山札 +${params.items.extraStockCount}枚`
    case 'wild1': return `毎ウェーブ山札に★を${params.items.wildPerPick}枚混入`
    case 'start1': return `コンボが${params.items.startCombo}からスタート`
    case 'clear300': return `全消しボーナス +${params.items.fullClearItemBonus}`
  }
}

function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  shuffleInPlace(arr, rand)
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !(UNIQUE_ITEMS.includes(id) && items.includes(id)))
  return shuffleItems(available, rand).slice(0, 3)
}

export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null }
}

export function beginRun(params: CulmenParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
  }
}

export function resolveWaveEnd(params: CulmenParams, run: RunState, rand: () => number = Math.random): RunState {
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

export function pickItem(params: CulmenParams, run: RunState, itemId: ItemId, seed?: number): RunState {
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

export function advanceStage(params: CulmenParams, run: RunState, seed?: number): RunState {
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

export function restartRun(params: CulmenParams, seed?: number): RunState {
  return beginRun(params, seed)
}

// runがプレイ中でwaveを持つ場合のみfnを適用し、そうでなければrunをそのまま返す
function withActiveWave(run: RunState, fn: (wave: WaveState) => WaveState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  return { ...run, wave: fn(run.wave) }
}

export function applyPlayCard(params: CulmenParams, run: RunState, colIndex: number): RunState {
  return withActiveWave(run, wave => {
    const stage = params.stages[run.stageIndex]
    const target = stage.targets[run.waveIndex]
    return playCard(params, wave, stage.modifier, run.items, target, colIndex)
  })
}

export function applyDrawStock(params: CulmenParams, run: RunState): RunState {
  return withActiveWave(run, wave => drawStock(params, wave, run.items))
}

export function applyStuckCheck(params: CulmenParams, run: RunState): RunState {
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

export function checkFlush(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 4) return false
  const last4 = realCardsIncludingThis.slice(-4)
  const suitsPresent = new Set(last4.map(c => c.suit))
  return ALL_SUITS_REAL.every(s => suitsPresent.has(s))
}

export function checkRoyalSet(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 3) return false
  const last3 = realCardsIncludingThis.slice(-3)
  const ranksPresent = new Set(last3.map(c => c.rank))
  return ranksPresent.has(11) && ranksPresent.has(12) && ranksPresent.has(13)
}

export function countSameRankBefore(realCardsBefore: Card[], rank: Card['rank']): number {
  return realCardsBefore.filter(c => c.rank === rank).length
}

export function checkCompleteRun(realCardsBefore: Card[], realCardsIncludingThis: Card[]): boolean {
  const distinctBefore = new Set(realCardsBefore.map(c => c.rank)).size
  const distinctNow = new Set(realCardsIncludingThis.map(c => c.rank)).size
  return distinctBefore < 13 && distinctNow >= 13
}

export interface ChainBonusResult {
  bonus: number
  parts: string[]
}

export function evaluateChainBonus(
  scoring: CulmenParams['scoring'],
  chainBefore: Card[],
  card: Card
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [] }
  }

  let bonus = 0
  const parts: string[] = []

  const prevIsWild = chainBefore[chainBefore.length - 1].wild
  const realBefore = chainBefore.filter(c => !c.wild)
  const chainIncludingThis = [...chainBefore, card]
  const realIncludingThis = [...realBefore, card]

  if (prevIsWild) {
    bonus += scoring.wildSuitBonus
    parts.push(`★同スート+${scoring.wildSuitBonus}`)
  } else {
    const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= scoring.stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
  }

  if (checkFlush(realIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(realIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }

  const sameRankCount = countSameRankBefore(realBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
  }

  if (checkCompleteRun(realBefore, realIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    if (analyzeSuitColor(realIncludingThis).suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts }
}
