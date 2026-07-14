// src/lib/game/shidasu/types.ts
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
export type ItemId =
  | 'bridge' | 'grace'
  | 'patience' | 'purify' | 'temperance'
  | 'springBreeze' | 'summerBreeze' | 'autumnBreeze' | 'winterBreeze'
  | 'kinship' | 'thaw' | 'dusk' | 'dawn' | 'wit'
  | 'courage' | 'daybreak' | 'twilight' | 'cheerful' | 'conscience' | 'morningMist'
  | 'calm' | 'serenity' | 'destiny' | 'fate' | 'relief'
  | 'verdantGreen' | 'gem' | 'resolve' | 'grail' | 'moonlight' | 'sunlight'
  | 'crown' | 'cloverLeaf' | 'coin' | 'blade' | 'chalice' | 'balance' | 'harmony'
  | 'nobility' | 'tenacity' | 'determination' | 'cycle' | 'reincarnation' | 'majesty'
  | 'omen' | 'crescent'
  | 'blessing' | 'focus' | 'lapis' | 'jade' | 'emptyMind'
  | 'prologue' | 'interlude' | 'morningDew'
  | 'drizzle'
  | 'eternity' | 'abundance' | 'silence' | 'resilience'

export interface Card {
  id: number
  suit: Suit
  rank: Rank
  wild: boolean
}

// ラン全体で持続するデッキの中身(idを持たない。ウェーブ開始のたびに新しいidを振ってCardを生成する)
export interface DeckCard {
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
export type DrawEffect = 'wild' | 'pattern' | null
export type ChainCardOrigin = 'play' | 'draw'

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  chain: Card[]
  chainOrigin: ChainCardOrigin[]
  linked: boolean
  columnsEmptiedThisCombo: number
  // 各列について、現在の連続コンボが始まった時点(直近でcomboが0にリセットされた瞬間)での残り枚数のスナップショット。
  // コンボが継続している間は更新されず、drawStockでコンボがリセットされる時とstartWaveでのみ再設定される。
  comboStreakColumnLengths: number[]
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
  // ウェーブ開始後、一度でも場札をプレイしたか(朝露の護符の判定に使用。山札めくりでは変化しない)
  firstPlayDone: boolean
  // コンボリセット時にチェーンにあった札が送られる、ウェーブ内限定の捨て札(不屈の護符が参照する。ウェーブを跨いで持続しない)
  discardPile: Card[]
}

export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'stageClear' | 'allClear' | 'gameOver'

export interface RunState {
  phase: RunPhase
  stageIndex: number
  waveIndex: number
  items: ItemId[]
  offer: ItemId[]
  wave: WaveState | null
  pendingNewItem: ItemId | null
  // ラン全体で持続するデッキの構成(永劫・豊穣・静寂によって書き換えられる)
  deckComposition: DeckCard[]
}
