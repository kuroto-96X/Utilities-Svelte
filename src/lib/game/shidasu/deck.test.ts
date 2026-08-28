import { describe, test, expect } from 'vitest'
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition, unifyBlackRedSuits, multipliedDeckComposition } from './deck'

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

  test('全エントリがremoved:falseで初期化される', () => {
    const composition = standardDeckComposition()
    expect(composition[0]).toEqual({ deckId: 0, suit: '♠', rank: 1, wild: false, removed: false })
    expect(composition.every(c => c.removed === false)).toBe(true)
  })
})

describe('rollOffer', () => {
  test('countで指定した件数を返す(プールがcountを超える場合)', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 3, createRng(1))
    expect(result).toHaveLength(3)
  })

  test('プールがcount未満なら全件を返す', () => {
    const result = rollOffer([1, 2], 3, createRng(1))
    expect(result).toHaveLength(2)
    expect(new Set(result)).toEqual(new Set([1, 2]))
  })

  test('重複を含まない非復元抽出になる', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 5, createRng(1))
    expect(new Set(result).size).toBe(5)
  })

  test('同じシードなら同じ結果になる(再現性)', () => {
    const a = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    const b = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    expect(a).toEqual(b)
  })

  test('元の配列を書き換えない', () => {
    const pool = [1, 2, 3, 4, 5]
    const copy = [...pool]
    rollOffer(pool, 3, createRng(1))
    expect(pool).toEqual(copy)
  })
})

describe('addCardsToDeckComposition', () => {
  test('既存のdeckCompositionにカードを追加した長さになる', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [
      { suit: '♠', rank: 1, wild: false },
      { suit: '♥', rank: 13, wild: false },
    ])
    expect(result).toHaveLength(54)
  })

  test('追加されたカードのdeckIdは既存の最大値の続きから連番で振られる', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [
      { suit: '♠', rank: 1, wild: false },
      { suit: '♥', rank: 13, wild: false },
      { suit: '★', rank: 0, wild: true },
    ])
    const addedIds = result.slice(52).map(c => c.deckId)
    expect(addedIds).toEqual([52, 53, 54])
  })

  test('追加されたカードのsuit/rank/wildが入力通りに反映される', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [{ suit: '♦', rank: 7, wild: false }])
    const added = result[result.length - 1]
    expect(added.suit).toBe('♦')
    expect(added.rank).toBe(7)
    expect(added.wild).toBe(false)
  })

  test('元のdeckCompositionを書き換えない(イミュータブル)', () => {
    const composition = standardDeckComposition()
    const copy = composition.map(c => ({ ...c }))
    addCardsToDeckComposition(composition, [{ suit: '♠', rank: 1, wild: false }])
    expect(composition).toEqual(copy)
  })

  test('deckIdが既に飛び飛びの場合でも配列長を基準に採番する(既存の永劫等と同じ方式)', () => {
    const composition = [
      { deckId: 0, suit: '♠' as const, rank: 1 as const, wild: false, removed: false },
      { deckId: 5, suit: '♥' as const, rank: 2 as const, wild: false, removed: false },
    ]
    const result = addCardsToDeckComposition(composition, [{ suit: '♦', rank: 3, wild: false }])
    expect(result[2].deckId).toBe(2)
  })
})

describe('unifyBlackRedSuits', () => {
  test('rand()が常に0未満0.5以上を返さない(常に0を返す)場合、黒スートは全て♠、赤スートは全て♥になる', () => {
    const composition = standardDeckComposition()
    const alwaysZero = () => 0
    const result = unifyBlackRedSuits(composition, alwaysZero)
    const blackCards = result.filter(c => c.suit === '♠' || c.suit === '♣')
    const redCards = result.filter(c => c.suit === '♥' || c.suit === '♦')
    expect(blackCards.every(c => c.suit === '♠')).toBe(true)
    expect(redCards.every(c => c.suit === '♥')).toBe(true)
  })

  test('rand()が常に0.5以上を返す場合、黒スートは全て♣、赤スートは全て♦になる', () => {
    const composition = standardDeckComposition()
    const alwaysHalf = () => 0.5
    const result = unifyBlackRedSuits(composition, alwaysHalf)
    const blackCards = result.filter(c => c.suit === '♠' || c.suit === '♣')
    const redCards = result.filter(c => c.suit === '♥' || c.suit === '♦')
    expect(blackCards.every(c => c.suit === '♣')).toBe(true)
    expect(redCards.every(c => c.suit === '♦')).toBe(true)
  })

  test('変換後、スートは♠か♣のどちらか一方、♥か♦のどちらか一方のみになる(混在しない)', () => {
    const composition = standardDeckComposition()
    const result = unifyBlackRedSuits(composition, createRng(1))
    const distinctBlackSuits = new Set(result.filter(c => c.suit === '♠' || c.suit === '♣').map(c => c.suit))
    const distinctRedSuits = new Set(result.filter(c => c.suit === '♥' || c.suit === '♦').map(c => c.suit))
    expect(distinctBlackSuits.size).toBe(1)
    expect(distinctRedSuits.size).toBe(1)
  })

  test('カードの総枚数・各ランクの枚数構成は変わらない(rankやremovedは書き換えない)', () => {
    const composition = standardDeckComposition()
    const result = unifyBlackRedSuits(composition, createRng(1))
    expect(result).toHaveLength(composition.length)
    const originalRanks = composition.map(c => c.rank).sort((a, b) => a - b)
    const resultRanks = result.map(c => c.rank).sort((a, b) => a - b)
    expect(resultRanks).toEqual(originalRanks)
    expect(result.every(c => c.removed === false)).toBe(true)
  })

  test('元のdeckCompositionを書き換えない(イミュータブル)', () => {
    const composition = standardDeckComposition()
    const copy = composition.map(c => ({ ...c }))
    unifyBlackRedSuits(composition, createRng(1))
    expect(composition).toEqual(copy)
  })
})

describe('multipliedDeckComposition', () => {
  test('multiplier=1のとき、standardDeckComposition()と同じ52枚になる', () => {
    const result = multipliedDeckComposition(1)
    expect(result).toHaveLength(52)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const cards = result.filter(c => c.suit === suit)
      expect(cards).toHaveLength(13)
    })
  })

  test('multiplier=2のとき、104枚になり各スート・ランクの組み合わせが2枚ずつ存在する', () => {
    const result = multipliedDeckComposition(2)
    expect(result).toHaveLength(104)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      for (let rank = 1; rank <= 13; rank++) {
        const cards = result.filter(c => c.suit === suit && c.rank === rank)
        expect(cards).toHaveLength(2)
      }
    })
  })

  test('multiplier=2のとき、deckIdは0〜103の重複しない連番になる', () => {
    const result = multipliedDeckComposition(2)
    const deckIds = result.map(c => c.deckId).sort((a, b) => a - b)
    expect(deckIds).toEqual(Array.from({ length: 104 }, (_, i) => i))
  })

  test('全カードがwild:false, removed:falseで生成される', () => {
    const result = multipliedDeckComposition(2)
    expect(result.every(c => c.wild === false && c.removed === false)).toBe(true)
  })
})
