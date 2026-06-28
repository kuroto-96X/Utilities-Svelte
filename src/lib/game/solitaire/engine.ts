// src/lib/game/solitaire/engine.ts
import { createDeck, shuffle } from './deck'
import type { Card, GameState, Snapshot, Suit } from './types'

// ---- 内部ユーティリティ ----

function colorOf(suit: Suit): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black'
}

function snapshot(state: GameState): Snapshot {
  return {
    tableau: state.tableau.map(col => col.map(c => ({ ...c }))),
    stock: state.stock.map(c => ({ ...c })),
    waste: state.waste.map(c => ({ ...c })),
    foundation: state.foundation.map(pile => pile.map(c => ({ ...c }))),
    drawMode: state.drawMode,
    score: state.score,
    elapsed: state.elapsed,
    isComplete: state.isComplete,
  }
}

function canPlaceOnTableau(card: Card, target: Card | undefined): boolean {
  if (!target) return card.rank === 13
  return colorOf(card.suit) !== colorOf(target.suit) && card.rank === target.rank - 1
}

function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 1
  const top = pile[pile.length - 1]
  return card.suit === top.suit && card.rank === top.rank + 1
}

// ---- エクスポート関数 ----

export function dealInitial(drawMode: 1 | 3): GameState {
  const deck = shuffle(createDeck())
  const tableau: Card[][] = []
  let idx = 0
  for (let col = 0; col < 7; col++) {
    const column: Card[] = []
    for (let row = 0; row <= col; row++) {
      column.push({ ...deck[idx++] })
    }
    column[column.length - 1] = { ...column[column.length - 1], faceUp: true }
    tableau.push(column)
  }
  return {
    tableau,
    stock: deck.slice(idx).map(c => ({ ...c })),
    waste: [],
    foundation: [[], [], [], []],
    drawMode,
    score: 0,
    elapsed: 0,
    history: [],
    isComplete: false,
  }
}

export function drawFromStock(state: GameState): GameState {
  const snap = snapshot(state)
  if (state.stock.length === 0) {
    return {
      ...state,
      stock: [...state.waste].reverse().map(c => ({ ...c, faceUp: false })),
      waste: [],
      history: [...state.history, snap],
    }
  }
  const count = Math.min(state.drawMode, state.stock.length)
  const drawn = state.stock.slice(-count).map(c => ({ ...c, faceUp: true }))
  return {
    ...state,
    stock: state.stock.slice(0, -count),
    waste: [...state.waste, ...drawn],
    history: [...state.history, snap],
  }
}
