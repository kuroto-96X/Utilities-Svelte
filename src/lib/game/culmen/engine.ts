// src/lib/game/culmen/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason } from './types'
import type { CulmenParams } from './params'
import { createDeck, createRng, shuffle } from './deck'

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

  let d = card.rank - prev.rank
  if (d === 12) d = -1
  if (d === -12) d = 1

  let newStairDir: -1 | 0 | 1 = 0
  let newStairLen = 1
  if (Math.abs(d) === 1) {
    if (d === stairDir) {
      newStairDir = d as -1 | 1
      newStairLen = stairLen + 1
    } else {
      newStairDir = d as -1 | 1
      newStairLen = 2
    }
    if (newStairLen >= scoring.stairMinLen) {
      bonus += scoring.stairBonus
      parts.push(`階段${newStairLen} +${scoring.stairBonus}`)
    }
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

export function remainingCount(wave: WaveState): number {
  return wave.tableau.reduce((n, c) => n + c.length, 0)
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
    const dupSource = shuffle(createDeck(nextId), rand).slice(0, extra)
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
  const remaining = newTableau.reduce((n, c) => n + c.length, 0)
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
