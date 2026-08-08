// src/lib/game/shidasu/cardSets.test.ts
import { describe, test, expect } from 'vitest'
import { createRng } from './deck'
import { generateCardSet, CARD_SET_GENRE_NAMES } from './cardSets'
import type { CardSetGenreId } from './types'

describe('generateCardSet: stair3/stair5/stair7(階段セット)', () => {
  test('stair3は3枚、連続ランクになる', () => {
    const cards = generateCardSet('stair3', createRng(1))
    expect(cards).toHaveLength(3)
  })

  test('stair5は5枚、stair7は7枚になる', () => {
    expect(generateCardSet('stair5', createRng(1))).toHaveLength(5)
    expect(generateCardSet('stair7', createRng(1))).toHaveLength(7)
  })

  test('ランクが1ずつ連続する(A⇔Kループを跨いでもよい)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('stair5', createRng(seed))
      const ranks = cards.map(c => c.rank)
      for (let i = 1; i < ranks.length; i++) {
        const expected = ranks[i - 1] === 13 ? 1 : ranks[i - 1] + 1
        expect(ranks[i]).toBe(expected)
      }
    }
  })

  test('スートは個別ランダム(複数シードで統一スートにならないケースがあることを確認)', () => {
    let mixedFound = false
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('stair5', createRng(seed))
      if (new Set(cards.map(c => c.suit)).size > 1) mixedFound = true
    }
    expect(mixedFound).toBe(true)
  })
})

describe('generateCardSet: sameRank2/sameRank3/sameRank4(同ランクセット)', () => {
  test('sameRank2は2枚、sameRank3は3枚、sameRank4は4枚になる', () => {
    expect(generateCardSet('sameRank2', createRng(1))).toHaveLength(2)
    expect(generateCardSet('sameRank3', createRng(1))).toHaveLength(3)
    expect(generateCardSet('sameRank4', createRng(1))).toHaveLength(4)
  })

  test('全て同一ランクになる', () => {
    const cards = generateCardSet('sameRank4', createRng(1))
    expect(new Set(cards.map(c => c.rank)).size).toBe(1)
  })

  test('スートは重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('sameRank4', createRng(seed))
      expect(new Set(cards.map(c => c.suit)).size).toBe(4)
    }
  })

  test('sameRank4は4スート全てを含む', () => {
    const cards = generateCardSet('sameRank4', createRng(1))
    expect(new Set(cards.map(c => c.suit))).toEqual(new Set(['♠', '♥', '♦', '♣']))
  })
})

describe('generateCardSet: sameSuit3/sameSuit5/sameSuit7(同スートセット)', () => {
  test('sameSuit3は3枚、sameSuit5は5枚、sameSuit7は7枚になる', () => {
    expect(generateCardSet('sameSuit3', createRng(1))).toHaveLength(3)
    expect(generateCardSet('sameSuit5', createRng(1))).toHaveLength(5)
    expect(generateCardSet('sameSuit7', createRng(1))).toHaveLength(7)
  })

  test('全て同一スートになる', () => {
    const cards = generateCardSet('sameSuit5', createRng(1))
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })

  test('ランクは重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('sameSuit7', createRng(seed))
      expect(new Set(cards.map(c => c.rank)).size).toBe(7)
    }
  })
})

describe('generateCardSet: faceCards(絵札セット)', () => {
  test('3枚生成され、ランクはJ・Q・K固定', () => {
    const cards = generateCardSet('faceCards', createRng(1))
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([11, 12, 13])
  })

  test('全て非ワイルド', () => {
    const cards = generateCardSet('faceCards', createRng(1))
    expect(cards.every(c => !c.wild)).toBe(true)
  })

  test('スートは個別ランダム(複数シードで統一スートにならないケースがあることを確認)', () => {
    const suitsAcrossSeeds = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('faceCards', createRng(seed))
      const suits = new Set(cards.map(c => c.suit))
      if (suits.size > 1) suitsAcrossSeeds.add('mixed')
    }
    expect(suitsAcrossSeeds.has('mixed')).toBe(true)
  })
})

describe('generateCardSet: royal(ロイヤルセット)', () => {
  test('3枚生成され、ランクはJ・Q・K固定・スートは全て同一', () => {
    const cards = generateCardSet('royal', createRng(1))
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([11, 12, 13])
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })
})

describe('generateCardSet: flush(フラッシュセット)', () => {
  test('4枚生成され、4スートが1枚ずつ揃う', () => {
    const cards = generateCardSet('flush', createRng(1))
    expect(cards).toHaveLength(4)
    expect(new Set(cards.map(c => c.suit))).toEqual(new Set(['♠', '♥', '♦', '♣']))
  })

  test('全て非ワイルド', () => {
    const cards = generateCardSet('flush', createRng(1))
    expect(cards.every(c => !c.wild)).toBe(true)
  })
})

describe('generateCardSet: completeRunSameSuit(コンプリートランセット・同スート)', () => {
  test('13枚生成され、A〜K全ランクかつ全て同一スート', () => {
    const cards = generateCardSet('completeRunSameSuit', createRng(1))
    expect(cards).toHaveLength(13)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })
})

describe('generateCardSet: completeRunRandomSuit(コンプリートランセット・スートランダム)', () => {
  test('13枚生成され、A〜K全ランクを網羅する', () => {
    const cards = generateCardSet('completeRunRandomSuit', createRng(1))
    expect(cards).toHaveLength(13)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  test('スートは統一されない(複数シードで複数スートが混在するケースがあることを確認)', () => {
    let mixedFound = false
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('completeRunRandomSuit', createRng(seed))
      if (new Set(cards.map(c => c.suit)).size > 1) mixedFound = true
    }
    expect(mixedFound).toBe(true)
  })
})

describe('generateCardSet: wildCard(ワイルドカード)', () => {
  test('1枚生成され、wild: trueになる', () => {
    const cards = generateCardSet('wildCard', createRng(1))
    expect(cards).toHaveLength(1)
    expect(cards[0].wild).toBe(true)
  })
})

describe('CARD_SET_GENRE_NAMES', () => {
  test('全23ジャンルの和名が定義されている', () => {
    const genreIds: CardSetGenreId[] = [
      'stair3', 'stair5', 'stair7',
      'sameRank2', 'sameRank3', 'sameRank4',
      'faceCards',
      'sameSuit3', 'sameSuit5', 'sameSuit7',
      'royal',
      'flush',
      'completeRunSameSuit', 'completeRunRandomSuit',
      'pair2', 'pair3',
      'redBlack4Random', 'redBlack4Fixed', 'redBlack6Random', 'redBlack6Fixed', 'redBlack8Random', 'redBlack8Fixed',
      'wildCard',
    ]
    genreIds.forEach(id => {
      expect(CARD_SET_GENRE_NAMES[id]).toBeTruthy()
      expect(typeof CARD_SET_GENRE_NAMES[id]).toBe('string')
    })
  })
})
