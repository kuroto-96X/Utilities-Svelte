import { describe, test, expect } from 'vitest'
import { dealInitial, drawFromStock } from './engine'
import type { GameState } from './types'

describe('dealInitial', () => {
  test('タブロー7列を生成する', () => {
    expect(dealInitial(1).tableau).toHaveLength(7)
  })

  test('各列のカード枚数は列番号+1', () => {
    const state = dealInitial(1)
    state.tableau.forEach((col, i) => {
      expect(col).toHaveLength(i + 1)
    })
  })

  test('各列の最上段のカードだけ表向き（それ以外は裏向き）', () => {
    const state = dealInitial(1)
    state.tableau.forEach(col => {
      col.slice(0, -1).forEach(c => expect(c.faceUp).toBe(false))
      expect(col[col.length - 1].faceUp).toBe(true)
    })
  })

  test('タブロー + 山札で52枚になる', () => {
    const state = dealInitial(1)
    const tableauCount = state.tableau.reduce((sum, col) => sum + col.length, 0)
    expect(tableauCount + state.stock.length).toBe(52)
  })

  test('捨て札・組札は空、historyは空', () => {
    const state = dealInitial(1)
    expect(state.waste).toHaveLength(0)
    state.foundation.forEach(pile => expect(pile).toHaveLength(0))
    expect(state.history).toHaveLength(0)
  })

  test('drawMode を保持する', () => {
    expect(dealInitial(3).drawMode).toBe(3)
  })

  test('score=0, elapsed=0, isComplete=false で初期化される', () => {
    const state = dealInitial(1)
    expect(state.score).toBe(0)
    expect(state.elapsed).toBe(0)
    expect(state.isComplete).toBe(false)
  })
})

describe('drawFromStock', () => {
  test('ドロー1: stock末尾1枚が waste の末尾に移り faceUp になる', () => {
    const state = dealInitial(1)
    const topCard = state.stock[state.stock.length - 1]
    const next = drawFromStock(state)
    expect(next.waste[next.waste.length - 1]).toMatchObject({ ...topCard, faceUp: true })
    expect(next.stock).toHaveLength(state.stock.length - 1)
  })

  test('ドロー3: stock末尾3枚が waste に追加される', () => {
    const state = dealInitial(3)
    const before = state.stock.length
    const next = drawFromStock(state)
    expect(next.stock).toHaveLength(before - 3)
    expect(next.waste).toHaveLength(3)
    expect(next.waste.every(c => c.faceUp)).toBe(true)
  })

  test('stock が空のとき waste を逆順で stock に戻し waste を空にする', () => {
    const base = dealInitial(1)
    const withEmpty: GameState = {
      ...base,
      stock: [],
      waste: [
        { suit: 'spades', rank: 1, faceUp: true },
        { suit: 'hearts', rank: 2, faceUp: true },
      ],
    }
    const next = drawFromStock(withEmpty)
    expect(next.waste).toHaveLength(0)
    expect(next.stock).toHaveLength(2)
    expect(next.stock.every(c => !c.faceUp)).toBe(true)
    // 逆順確認: waste末尾が stock末尾に
    expect(next.stock[next.stock.length - 1]).toMatchObject({ suit: 'spades', rank: 1 })
  })

  test('history にスナップショットが push される', () => {
    const state = dealInitial(1)
    const next = drawFromStock(state)
    expect(next.history).toHaveLength(1)
    expect(next.history[0].waste).toHaveLength(0) // 移動前の空の waste
  })
})
