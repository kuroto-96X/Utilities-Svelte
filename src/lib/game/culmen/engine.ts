// src/lib/game/culmen/engine.ts
import type { Card, StageModifier, WaveState } from './types'
import type { CulmenParams } from './params'

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
