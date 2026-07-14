import { describe, test, expect } from 'vitest'
import { createDeck, createRng, shuffle, standardDeckComposition } from './deck'

function idGen() {
  let n = 0
  return () => ++n
}

describe('createDeck', () => {
  test('52枚生成される', () => {
    expect(createDeck(idGen())).toHaveLength(52)
  })

  test('全て wild: false', () => {
    expect(createDeck(idGen()).every(c => !c.wild)).toBe(true)
  })

  test('id が重複しない連番になる', () => {
    const deck = createDeck(idGen())
    const ids = deck.map(c => c.id)
    expect(new Set(ids).size).toBe(52)
  })

  test('4スート × 13ランクの組み合わせが揃っている', () => {
    const deck = createDeck(idGen())
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const cards = deck.filter(c => c.suit === suit)
      expect(cards).toHaveLength(13)
      const ranks = cards.map(c => c.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    })
  })
})

describe('createRng', () => {
  test('同じシードなら同じ数列を返す', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  test('0以上1未満の値を返す', () => {
    const rand = createRng(1)
    for (let i = 0; i < 20; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  test('枚数が変わらない', () => {
    const deck = createDeck(idGen())
    expect(shuffle(deck, createRng(1))).toHaveLength(52)
  })

  test('元のデッキを変更しない(イミュータブル)', () => {
    const deck = createDeck(idGen())
    const copy = deck.map(c => ({ ...c }))
    shuffle(deck, createRng(1))
    expect(deck).toEqual(copy)
  })

  test('同じシードなら同じ順序になる', () => {
    const deckA = createDeck(idGen())
    const deckB = createDeck(idGen())
    expect(shuffle(deckA, createRng(7))).toEqual(shuffle(deckB, createRng(7)))
  })

  test('全カードが保たれている(id基準)', () => {
    const deck = createDeck(idGen())
    const shuffled = shuffle(deck, createRng(3))
    expect(shuffled.map(c => c.id).sort((a, b) => a - b))
      .toEqual(deck.map(c => c.id).sort((a, b) => a - b))
  })
})

describe('standardDeckComposition', () => {
  test('52枚、全スート×全ランクを網羅し、全て非ワイルド', () => {
    const composition = standardDeckComposition()
    expect(composition).toHaveLength(52)
    expect(composition.every(c => !c.wild)).toBe(true)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const ranks = composition.filter(c => c.suit === suit).map(c => c.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    })
  })
})
