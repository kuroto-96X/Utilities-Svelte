// src/lib/game/solitaire/engine.ts
import { createDeck, shuffleWithSeed, generateSeed } from './deck'
import type { Card, GameState, Move, Snapshot, Suit } from './types'

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
    seed: state.seed,
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

export function dealInitial(drawMode: 1 | 3, seed?: number): GameState {
  const gameSeed = seed ?? generateSeed()
  const deck = shuffleWithSeed(createDeck(), gameSeed)
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
    seed: gameSeed,
  }
}

export function drawFromStock(state: GameState): GameState {
  const snap = snapshot(state)
  if (state.stock.length === 0) {
    const recyclePenalty = state.drawMode === 3 ? 50 : 100
    return {
      ...state,
      stock: [...state.waste].reverse().map(c => ({ ...c, faceUp: false })),
      waste: [],
      score: Math.max(0, state.score - recyclePenalty),
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

export function moveCards(state: GameState, move: Move): GameState {
  const { from, to, count } = move

  // 1. 移動するカードを特定（合法性チェック込み）
  let movingCards: Card[]
  if (from.pile === 'waste') {
    if (state.waste.length === 0) return state
    movingCards = [state.waste[state.waste.length - 1]]
  } else if (from.pile === 'tableau') {
    const col = state.tableau[from.index]
    if (col.length < count) return state
    movingCards = col.slice(col.length - count)
    if (!movingCards[0].faceUp) return state
  } else {
    if (count !== 1) return state
    const pile = state.foundation[from.index]
    if (pile.length === 0) return state
    movingCards = [pile[pile.length - 1]]
  }

  // 2. 移動先の合法性チェック
  if (to.pile === 'foundation') {
    if (!canPlaceOnFoundation(movingCards[0], state.foundation[to.index])) return state
  } else {
    const targetCol = state.tableau[to.index]
    if (!canPlaceOnTableau(movingCards[0], targetCol[targetCol.length - 1])) return state
  }

  // 3. 合法なので実行
  const snap = snapshot(state)
  let scoreAdd = 0
  const newTableau = state.tableau.map(col => [...col])
  let newWaste = [...state.waste]
  const newFoundation = state.foundation.map(pile => [...pile])

  // 移動元を更新
  if (from.pile === 'waste') {
    newWaste = state.waste.slice(0, -1)
  } else if (from.pile === 'tableau') {
    const col = [...state.tableau[from.index]]
    col.splice(col.length - count, count)
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1] = { ...col[col.length - 1], faceUp: true }
    }
    newTableau[from.index] = col
  } else {
    newFoundation[from.index] = state.foundation[from.index].slice(0, -1)
    scoreAdd -= 50 // foundation→tableau ペナルティ
  }

  // 移動先を更新
  if (to.pile === 'foundation') {
    newFoundation[to.index] = [...newFoundation[to.index], ...movingCards]
    scoreAdd += 100 // →foundation +100
  } else {
    newTableau[to.index] = [...newTableau[to.index], ...movingCards]
  }

  return {
    ...state,
    tableau: newTableau,
    waste: newWaste,
    foundation: newFoundation,
    score: Math.max(0, state.score + scoreAdd),
    history: [...state.history, snap],
  }
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state
  const prev = state.history[state.history.length - 1]
  return {
    ...prev,
    history: state.history.slice(0, -1),
  }
}

export function getHints(state: GameState): Move[] {
  const hints: Move[] = []

  if (state.waste.length > 0) {
    const top = state.waste[state.waste.length - 1]
    state.tableau.forEach((col, i) => {
      if (canPlaceOnTableau(top, col[col.length - 1])) {
        hints.push({ from: { pile: 'waste', index: 0 }, to: { pile: 'tableau', index: i }, count: 1 })
      }
    })
    state.foundation.forEach((pile, i) => {
      if (canPlaceOnFoundation(top, pile)) {
        hints.push({ from: { pile: 'waste', index: 0 }, to: { pile: 'foundation', index: i }, count: 1 })
      }
    })
  }

  state.tableau.forEach((col, fromIdx) => {
    const faceUpStart = col.findIndex(c => c.faceUp)
    if (faceUpStart === -1) return
    for (let start = faceUpStart; start < col.length; start++) {
      const movingCards = col.slice(start)
      const count = movingCards.length
      state.tableau.forEach((targetCol, toIdx) => {
        if (toIdx === fromIdx) return
        if (canPlaceOnTableau(movingCards[0], targetCol[targetCol.length - 1])) {
          hints.push({ from: { pile: 'tableau', index: fromIdx }, to: { pile: 'tableau', index: toIdx }, count })
        }
      })
      if (count === 1) {
        state.foundation.forEach((pile, i) => {
          if (canPlaceOnFoundation(movingCards[0], pile)) {
            hints.push({ from: { pile: 'tableau', index: fromIdx }, to: { pile: 'foundation', index: i }, count: 1 })
          }
        })
      }
    }
  })

  return hints
}

export function canAutoComplete(state: GameState): boolean {
  return (
    state.stock.length === 0 &&
    state.waste.length === 0 &&
    state.tableau.every(col => col.every(c => c.faceUp))
  )
}

export function getAutoCompleteMove(state: GameState): Move | null {
  if (state.waste.length > 0) {
    const top = state.waste[state.waste.length - 1]
    for (let i = 0; i < state.foundation.length; i++) {
      if (canPlaceOnFoundation(top, state.foundation[i])) {
        return { from: { pile: 'waste', index: 0 }, to: { pile: 'foundation', index: i }, count: 1 }
      }
    }
  }
  for (let col = 0; col < state.tableau.length; col++) {
    const column = state.tableau[col]
    if (column.length === 0) continue
    const top = column[column.length - 1]
    for (let i = 0; i < state.foundation.length; i++) {
      if (canPlaceOnFoundation(top, state.foundation[i])) {
        return { from: { pile: 'tableau', index: col }, to: { pile: 'foundation', index: i }, count: 1 }
      }
    }
  }
  return null
}

export function autoCompleteStep(state: GameState): GameState {
  if (state.waste.length > 0) {
    const top = state.waste[state.waste.length - 1]
    for (let i = 0; i < state.foundation.length; i++) {
      if (canPlaceOnFoundation(top, state.foundation[i])) {
        return moveCards(state, { from: { pile: 'waste', index: 0 }, to: { pile: 'foundation', index: i }, count: 1 })
      }
    }
  }
  for (let col = 0; col < state.tableau.length; col++) {
    const column = state.tableau[col]
    if (column.length === 0) continue
    const top = column[column.length - 1]
    for (let i = 0; i < state.foundation.length; i++) {
      if (canPlaceOnFoundation(top, state.foundation[i])) {
        return moveCards(state, { from: { pile: 'tableau', index: col }, to: { pile: 'foundation', index: i }, count: 1 })
      }
    }
  }
  return state
}

export function isVictory(state: GameState): boolean {
  return state.foundation.every(pile => pile.length === 13)
}
