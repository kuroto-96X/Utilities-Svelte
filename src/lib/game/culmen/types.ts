// src/lib/game/culmen/types.ts
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
export type ItemId = 'red5' | 'face10' | 'shield' | 'stock5' | 'wild1' | 'start1' | 'clear300'

export interface Card {
  id: number
  suit: Suit
  rank: Rank
  wild: boolean
}

export interface ScoreGain {
  points: number
  parts: string[]
}

export type WaveStatus = 'playing' | 'ended'
export type WaveEndReason = 'target' | 'fullClear' | 'stuck' | null

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  shieldLeft: number
  chain: Card[]
  linked: boolean
  stairDir: -1 | 0 | 1
  stairLen: number
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}

export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'stageClear' | 'allClear' | 'gameOver'

export interface RunState {
  phase: RunPhase
  stageIndex: number
  waveIndex: number
  items: ItemId[]
  offer: ItemId[]
  wave: WaveState | null
}
