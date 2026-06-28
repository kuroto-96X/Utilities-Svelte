import type { Card, Suit, Rank } from './types'

export function createDeck(): Card[] {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  const cards: Card[] = []
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ suit, rank: rank as Rank, faceUp: false })
    }
  }
  return cards
}

export function shuffle(deck: Card[]): Card[] {
  const arr = deck.map(c => ({ ...c }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
