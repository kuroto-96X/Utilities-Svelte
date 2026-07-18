// src/lib/game/shidasu/testHelpers.ts
import type { Card } from './types'
import type { DirectEffectContext } from './directEffects'
import type { ItemEffectContext } from './itemEffects'
import { DEFAULT_PARAMS } from './params'

export function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

export function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
  return {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: false,
    remainingTableauCount: 10,
    combo: 1,
    colorHeld: false,
    previousCombo: 0,
    scoreAfterGained: 0,
    ...overrides,
  }
}

export function ctx(overrides: Partial<ItemEffectContext> = {}, params = DEFAULT_PARAMS): ItemEffectContext {
  return {
    card: card(1, '♠', 5),
    previousFoundation: card(2, '♣', 4),
    combo: 1,
    stockRemaining: 0,
    chain: [card(2, '♣', 4), card(1, '♠', 5)],
    remainingTableauCount: 10,
    chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
    isFirstPlayOfWave: false,
    isPlayAction: true,
    playCountInChain: 1,
    effectiveStairMinLen: params.scoring.stairMinLen,
    effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
    sameColumnStreak: 1,
    totalColumnsEmptiedThisWave: 0,
    maxComboThisWave: 1,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    drawContinueCountThisChain: 0,
    mercyActiveNextCombo: false,
    ...overrides,
  }
}
