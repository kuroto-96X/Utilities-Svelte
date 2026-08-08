// src/lib/game/shidasu/cardSets.test.ts
import { describe, test, expect } from 'vitest'
import { createRng } from './deck'
import { generateCardSet, CARD_SET_GENRE_NAMES, rollCardSetOffer } from './cardSets'
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

describe('generateCardSet: pair2/pair3(ペアセット)', () => {
  test('pair2は4枚(2組)、pair3は6枚(3組)になる', () => {
    expect(generateCardSet('pair2', createRng(1))).toHaveLength(4)
    expect(generateCardSet('pair3', createRng(1))).toHaveLength(6)
  })

  test('pair3は3種類の異なるランクが各2枚ずつになる', () => {
    const cards = generateCardSet('pair3', createRng(1))
    const rankCounts = new Map<number, number>()
    cards.forEach(c => rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1))
    expect(rankCounts.size).toBe(3)
    expect([...rankCounts.values()]).toEqual([2, 2, 2])
  })

  test('各組の2枚は異なるスートになる', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('pair3', createRng(seed))
      const rankGroups = new Map<number, string[]>()
      cards.forEach(c => {
        const list = rankGroups.get(c.rank) ?? []
        list.push(c.suit)
        rankGroups.set(c.rank, list)
      })
      rankGroups.forEach(suits => expect(new Set(suits).size).toBe(2))
    }
  })
})

describe('generateCardSet: redBlack4Random/redBlack4Fixed/redBlack6Random/redBlack6Fixed/redBlack8Random/redBlack8Fixed(赤黒バランスセット)', () => {
  test('4枚/6枚/8枚それぞれ正しい枚数になる', () => {
    expect(generateCardSet('redBlack4Random', createRng(1))).toHaveLength(4)
    expect(generateCardSet('redBlack6Random', createRng(1))).toHaveLength(6)
    expect(generateCardSet('redBlack8Random', createRng(1))).toHaveLength(8)
    expect(generateCardSet('redBlack4Fixed', createRng(1))).toHaveLength(4)
    expect(generateCardSet('redBlack6Fixed', createRng(1))).toHaveLength(6)
    expect(generateCardSet('redBlack8Fixed', createRng(1))).toHaveLength(8)
  })

  function isRed(suit: string): boolean {
    return suit === '♥' || suit === '♦'
  }

  test('赤黒が同数になる(6枚なら赤3・黒3)', () => {
    const cards = generateCardSet('redBlack6Random', createRng(1))
    const redCount = cards.filter(c => isRed(c.suit)).length
    expect(redCount).toBe(3)
    expect(cards.length - redCount).toBe(3)
  })

  test('スートランダム版は赤2種・黒2種のスートが個別に決まりうる(複数シードで両方のスートが出るケースを確認)', () => {
    const redSuitsSeen = new Set<string>()
    const blackSuitsSeen = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('redBlack6Random', createRng(seed))
      cards.forEach(c => {
        if (isRed(c.suit)) redSuitsSeen.add(c.suit)
        else blackSuitsSeen.add(c.suit)
      })
    }
    expect(redSuitsSeen.size).toBe(2)
    expect(blackSuitsSeen.size).toBe(2)
  })

  test('スート統一版は赤3枚が同一スート、黒3枚が同一スートになる', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('redBlack6Fixed', createRng(seed))
      const redSuits = new Set(cards.filter(c => isRed(c.suit)).map(c => c.suit))
      const blackSuits = new Set(cards.filter(c => !isRed(c.suit)).map(c => c.suit))
      expect(redSuits.size).toBe(1)
      expect(blackSuits.size).toBe(1)
    }
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

describe('rollCardSetOffer', () => {
  test('countで指定した件数のオファーを返す', () => {
    const offers = rollCardSetOffer(createRng(1), 3)
    expect(offers).toHaveLength(3)
  })

  test('各オファーはgenreIdとcards(生成済みカード内容)を持つ', () => {
    const offers = rollCardSetOffer(createRng(1), 3)
    offers.forEach(o => {
      expect(typeof o.genreId).toBe('string')
      expect(Array.isArray(o.cards)).toBe(true)
      expect(o.cards.length).toBeGreaterThan(0)
    })
  })

  test('同じ福袋内でジャンルが重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const offers = rollCardSetOffer(createRng(seed), 7)
      const genreIds = offers.map(o => o.genreId)
      expect(new Set(genreIds).size).toBe(genreIds.length)
    }
  })

  test('同じシードなら同じ結果になる(再現性)', () => {
    const a = rollCardSetOffer(createRng(7), 5)
    const b = rollCardSetOffer(createRng(7), 5)
    expect(a).toEqual(b)
  })

  test('枚数が少ないジャンルほど出現しやすい(統計的検証: 1000回中、階段セット3枚の出現数が階段セット7枚の出現数を上回る)', () => {
    let stair3Count = 0
    let stair7Count = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const offers = rollCardSetOffer(createRng(seed), 1)
      if (offers[0].genreId === 'stair3') stair3Count++
      if (offers[0].genreId === 'stair7') stair7Count++
    }
    expect(stair3Count).toBeGreaterThan(stair7Count)
  })
})
