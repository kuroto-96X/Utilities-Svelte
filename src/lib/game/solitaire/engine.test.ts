import { describe, test, expect } from 'vitest'
import { dealInitial, drawFromStock, moveCards } from './engine'
import type { GameState, Card } from './types'

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

// テスト用ヘルパー: 指定した配置のゲーム状態を作る
function makeState(overrides: Partial<GameState>): GameState {
  return {
    ...dealInitial(1),
    history: [],
    ...overrides,
  }
}

describe('moveCards', () => {
  test('waste → tableau: 交互色・降順ならカードが移動する', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'hearts', rank: 11, faceUp: true }],
        [], [], [], [], [], [],
      ],
      waste: [{ suit: 'spades', rank: 10, faceUp: true }],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'waste', index: 0 },
      to: { pile: 'tableau', index: 0 },
      count: 1,
    })
    expect(next.tableau[0]).toHaveLength(2)
    expect(next.waste).toHaveLength(0)
    expect(next.score).toBe(5) // waste→tableau +5
  })

  test('waste → tableau: 色が同じなら移動しない', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'hearts', rank: 11, faceUp: true }],
        [], [], [], [], [], [],
      ],
      waste: [{ suit: 'diamonds', rank: 10, faceUp: true }], // 赤10
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'waste', index: 0 },
      to: { pile: 'tableau', index: 0 },
      count: 1,
    })
    expect(next).toBe(state) // 変化なし（同じ参照を返す）
  })

  test('tableau → tableau: 複数枚まとめて移動できる', () => {
    const state = makeState({
      tableau: [
        [
          { suit: 'spades', rank: 13, faceUp: true },
          { suit: 'hearts', rank: 12, faceUp: true },
          { suit: 'clubs', rank: 11, faceUp: true },
        ],
        [{ suit: 'spades', rank: 13, faceUp: true }],
        [], [], [], [], [],
      ],
      waste: [],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'tableau', index: 0 },
      to: { pile: 'tableau', index: 1 },
      count: 2, // 赤Q + 黒J
    })
    expect(next.tableau[0]).toHaveLength(1)
    expect(next.tableau[1]).toHaveLength(3)
  })

  test('tableau → tableau: 移動後に列の新しい最上段が表向きになる', () => {
    const state = makeState({
      tableau: [
        [
          { suit: 'spades', rank: 5, faceUp: false }, // 裏向き
          { suit: 'hearts', rank: 4, faceUp: true },
        ],
        [{ suit: 'clubs', rank: 5, faceUp: true }],
        [], [], [], [], [],
      ],
      waste: [],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'tableau', index: 0 },
      to: { pile: 'tableau', index: 1 },
      count: 1,
    })
    expect(next.tableau[0][0].faceUp).toBe(true) // めくれる
    expect(next.score).toBe(5) // めくりボーナス +5
  })

  test('waste → foundation: Aを空のfoundationに置ける', () => {
    const state = makeState({
      tableau: [[], [], [], [], [], [], []],
      waste: [{ suit: 'spades', rank: 1, faceUp: true }],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'waste', index: 0 },
      to: { pile: 'foundation', index: 0 },
      count: 1,
    })
    expect(next.foundation[0]).toHaveLength(1)
    expect(next.waste).toHaveLength(0)
    expect(next.score).toBe(10) // waste→foundation +10
  })

  test('tableau → foundation: 同スート昇順であれば置ける', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'spades', rank: 2, faceUp: true }],
        [], [], [], [], [], [],
      ],
      foundation: [
        [{ suit: 'spades', rank: 1, faceUp: true }],
        [], [], [],
      ],
      waste: [],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'tableau', index: 0 },
      to: { pile: 'foundation', index: 0 },
      count: 1,
    })
    expect(next.foundation[0]).toHaveLength(2)
    expect(next.score).toBe(10) // tableau→foundation +10
  })

  test('foundation → tableau: -15 ペナルティが付く', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'spades', rank: 3, faceUp: true }],
        [], [], [], [], [], [],
      ],
      foundation: [
        [], [{ suit: 'hearts', rank: 1, faceUp: true }, { suit: 'hearts', rank: 2, faceUp: true }],
        [], [],
      ],
      waste: [],
      stock: [],
      score: 20,
    })
    const next = moveCards(state, {
      from: { pile: 'foundation', index: 1 },
      to: { pile: 'tableau', index: 0 },
      count: 1,
    })
    expect(next.foundation[1]).toHaveLength(1)
    expect(next.score).toBe(5) // 20 - 15 = 5
  })

  test('illegal move は state を変更せず同じ参照を返す', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'hearts', rank: 5, faceUp: true }],
        [{ suit: 'diamonds', rank: 6, faceUp: true }], // 赤6の上に赤5は不可
        [], [], [], [], [],
      ],
      waste: [],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'tableau', index: 0 },
      to: { pile: 'tableau', index: 1 },
      count: 1,
    })
    expect(next).toBe(state)
  })

  test('合法な移動後は history にスナップショットが push される', () => {
    const state = makeState({
      tableau: [
        [{ suit: 'hearts', rank: 11, faceUp: true }],
        [], [], [], [], [], [],
      ],
      waste: [{ suit: 'spades', rank: 10, faceUp: true }],
      stock: [],
    })
    const next = moveCards(state, {
      from: { pile: 'waste', index: 0 },
      to: { pile: 'tableau', index: 0 },
      count: 1,
    })
    expect(next.history).toHaveLength(1)
  })
})
