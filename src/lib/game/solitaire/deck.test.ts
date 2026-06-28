import { describe, test, expect } from 'vitest'
import { createDeck, shuffle } from './deck'

describe('createDeck', () => {
  test('52枚生成される', () => {
    expect(createDeck()).toHaveLength(52)
  })

  test('全て faceUp: false', () => {
    expect(createDeck().every(c => !c.faceUp)).toBe(true)
  })

  test('4スート × 13ランクの組み合わせが揃っている', () => {
    const deck = createDeck()
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const
    suits.forEach(suit => {
      const cards = deck.filter(c => c.suit === suit)
      expect(cards).toHaveLength(13)
      const ranks = cards.map(c => c.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    })
  })
})

describe('shuffle', () => {
  test('枚数が変わらない', () => {
    const deck = createDeck()
    expect(shuffle(deck)).toHaveLength(52)
  })

  test('元のデッキを変更しない（イミュータブル）', () => {
    const deck = createDeck()
    const copy = deck.map(c => ({ ...c }))
    shuffle(deck)
    expect(deck).toEqual(copy)
  })

  test('全スートと全ランクが保たれている', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck)
    expect(shuffled.map(c => c.suit).sort()).toEqual(deck.map(c => c.suit).sort())
    expect(shuffled.map(c => c.rank).sort((a, b) => a - b))
      .toEqual(deck.map(c => c.rank).sort((a, b) => a - b))
  })
})
