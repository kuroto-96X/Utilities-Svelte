import type { Card, Suit, Rank } from './types'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

export function createDeck(nextId: () => number): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: nextId(), suit, rank: rank as Rank, wild: false })
    }
  }
  return deck
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

export function shuffle(deck: Card[], rand: () => number = Math.random): Card[] {
  const arr = deck.map(c => ({ ...c }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 999999) + 1
}
