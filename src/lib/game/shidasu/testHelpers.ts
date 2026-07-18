// src/lib/game/shidasu/testHelpers.ts
import type { Card } from './types'
import type { DirectEffectContext } from './directEffects'

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
