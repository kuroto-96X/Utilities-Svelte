import type { Card, Suit, Rank, DeckCard } from './types'

export type NewCardSpec = { suit: Suit; rank: Rank; wild: boolean }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

export function createDeck(nextId: () => number): Card[] {
  const deck: Card[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: nextId(), deckId: deckId++, suit, rank: rank as Rank, wild: false })
    }
  }
  return deck
}

export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
    }
  }
  return composition
}

// 標準デッキ(52枚)をmultiplier組連結したdeckCompositionを生成する。deckIdは重複しないよう
// 通し番号で振り直す(例: multiplier=2なら0〜103の104個)。multiplier=1のときは
// standardDeckComposition()と同じ結果になる。
export function multipliedDeckComposition(multiplier: number): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (let i = 0; i < multiplier; i++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
      }
    }
  }
  return composition
}

// deckCompositionに複数枚のカードを一括追加する。deckIdは既存の配列長を基準に連番で振る
// (天啓のワイルド供給処理revelationEffects.tsのnewDeckIdと同じ採番方式)。
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: NewCardSpec[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild, removed: false }))
  return [...deckComposition, ...added]
}

// 黒スートペア(♠・♣)をどちらか一方へ、赤スートペア(♥・♦)をどちらか一方へ、
// それぞれランダムに統一する。統一先の決定にrandを2回消費する(黒→赤の順)。
// ★(ワイルド専用スート)のカードはそのまま素通しする。
export function unifyBlackRedSuits(composition: DeckCard[], rand: () => number): DeckCard[] {
  const blackTarget: Suit = rand() < 0.5 ? '♠' : '♣'
  const redTarget: Suit = rand() < 0.5 ? '♥' : '♦'
  return composition.map(c => {
    if (c.suit === '♠' || c.suit === '♣') return { ...c, suit: blackTarget }
    if (c.suit === '♥' || c.suit === '♦') return { ...c, suit: redTarget }
    return c
  })
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

export function shuffleInPlace<T>(arr: T[], rand: () => number = Math.random): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// count個を重複なく無作為抽出する共通ヘルパー。福袋・バラ売り・各種オファー抽選はすべてこれを経由する。
// プールがcount未満の場合は全件を返す(呼び出し側でエラー扱いにはしない)。
export function rollOffer<T>(pool: T[], count: number, rand: () => number = Math.random): T[] {
  const arr = [...pool]
  shuffleInPlace(arr, rand)
  return arr.slice(0, count)
}

export function shuffle(deck: Card[], rand: () => number = Math.random): Card[] {
  const arr = deck.map(c => ({ ...c }))
  shuffleInPlace(arr, rand)
  return arr
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 999999) + 1
}
