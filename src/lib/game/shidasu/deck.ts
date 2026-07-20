import type { Card, Suit, Rank, DeckCard } from './types'

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
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false })
    }
  }
  return composition
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

export function shuffle(deck: Card[], rand: () => number = Math.random): Card[] {
  const arr = deck.map(c => ({ ...c }))
  shuffleInPlace(arr, rand)
  return arr
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 999999) + 1
}
