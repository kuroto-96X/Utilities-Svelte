// src/lib/game/solitaire/types.ts
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type Color = 'red' | 'black'

export interface Card {
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export interface Move {
  from: { pile: 'tableau' | 'waste' | 'foundation'; index: number }
  to:   { pile: 'tableau' | 'foundation'; index: number }
  count: number
}

export type Snapshot = Omit<GameState, 'history'>

export interface GameState {
  tableau: Card[][]    // 7列。tableau[i][0] が列の一番下、末尾が一番上
  stock: Card[]        // 山札（全枚裏向き）。末尾が一番上
  waste: Card[]        // 捨て札（引いたカード）。末尾が一番上
  foundation: Card[][] // 4つのゴール置き場（index 0:♠ 1:♥ 2:♦ 3:♣）。末尾が一番上
  drawMode: 1 | 3
  score: number
  elapsed: number      // 経過秒数
  history: Snapshot[]  // アンドゥ用スナップショット列（古い順）
  isComplete: boolean
}
