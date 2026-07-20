// src/lib/game/shidasu/types.ts
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
export type Rarity = 'C' | 'U' | 'R'
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep'
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
  | 'gentleBreeze' | 'resonance'
  | 'azureSky' | 'amber'
  | 'composure' | 'clarity' | 'arrogance' | 'echo' | 'shootingStar'
  | 'naive' | 'intuition' | 'sincerity'
  | 'promise' | 'darkClouds' | 'regeneration'
  | 'benevolence' | 'healing'
  | 'guidance'
  | 'passion' | 'fightingSpirit'
  | 'sanctify' | 'protection' | 'earth' | 'golden'
  | 'morningStar' | 'mercy' | 'mirror' | 'deadline'

// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)の
// うち今回効果を実装した20種のみをメンバーとする(残り4種はrunes.tsの見た目候補にのみ存在し、
// 効果が実装されて初めてここに追加する)。
export type RiteId =
  | 'raidho' | 'jera' | 'wunjo' | 'othala' | 'perthro'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz' | 'tiwaz' | 'laguz'
  | 'eihwaz' | 'ansuz' | 'kenaz' | 'thurisaz'
  | 'hagalaz'
  | 'nauthiz' | 'isa'
  | 'sowilo'

export interface Card {
  id: number
  // 由来のdeckComposition内での永続的な識別子(deckComposition[].deckIdをそのまま引き継ぐ)。
  // スート・ランクが変換されても不変。idはウェーブごとに振り直される一時的な連番なのに対し、
  // deckIdはラン全体で「同じデッキ枠」を指し続ける(静寂の護符が参照する)。
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
}

// ラン全体で持続するデッキの中身(idを持たない。ウェーブ開始のたびに新しいidを振ってCardを生成する)。
// deckIdは生成時に一度だけ振られる永続的な識別子で、以後配列内での位置が変わらない限り不変。
export interface DeckCard {
  deckId: number
  suit: Suit
  rank: Rank
  wild: boolean
}

export interface ScoreGain {
  points: number
  parts: string[]
}

// 全消しボーナス・護符による直接加算など、通常のプレイ得点(ScoreGain/lastGain)とは
// 別枠でログ表示する得点イベント。labelでイベント種別を表す。
export interface BonusGain {
  label: string
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
  // このアクションで発生した、lastGainとは別枠の得点(全消しボーナス・護符の直接加算)。
  // 何も発生しなければ空配列。
  lastBonusGains: BonusGain[]
  // ウェーブ開始後、一度でも場札をプレイしたか(朝露の護符の判定に使用。山札めくりでは変化しない)
  firstPlayDone: boolean
  // コンボリセット時にチェーンにあった札が送られる、ウェーブ内限定の捨て札(不屈の護符が参照する。ウェーブを跨いで持続しない)
  discardPile: Card[]
  // 微風・共鳴用: 直前にプレイした列番号(未プレイならnull)
  lastPlayedColumn: number | null
  // 微風・共鳴用: 同一列を連続でプレイした回数(1回目は1、以後連続でインクリメント)
  sameColumnStreak: number
  // 琥珀用: ウェーブ内で過去に到達した最大コンボ数
  maxComboThisWave: number
  // 蒼穹用: ウェーブ内で列一掃が発生した累計回数
  totalColumnsEmptiedThisWave: number
  // 冷静用: 現在のチェーン中に一度でも役ボーナスが成立したか
  roleFiredThisChain: boolean
  // 直感用: 現在のチェーン中に山札めくりでコンボ継続した回数(プレイを挟んでも加算され続け、コンボ/チェーンのリセットでのみ0に戻る)
  drawContinueCountThisChain: number
  // 情熱用: 現在のコンボ中にフラッシュが成立したか
  flushActiveThisCombo: boolean
  // 闘志用: このウェーブ中に列一掃が一度でも発生したか
  columnSweepActiveThisWave: boolean
  // 博愛用: 現在のコンボで無効化を既に使ったか
  benevolenceUsedThisCombo: boolean
  // 祝福用: 役成立のたび+1、コンボリセット時にwave.comboの復帰先になる(ウェーブ単位)
  baseComboCount: number
  // 水鏡用: 役の種類ごと(sameRank以外)に、今コンボで遅延複製をスケジュール済みか
  roleEchoUsedThisCombo: Partial<Record<RoleName, boolean>>
  // 水鏡用: sameRankは枚数段階(sameRankCountの値)ごとに使用済みかを記録する
  sameRankEchoUsedThisCombo: number[]
  // 水鏡用: 次の1プレイで上乗せ予定の役ボーナス(未予約ならnull)
  pendingRoleEcho: { name: RoleName; amount: number } | null
  // 明星用: 役の種類ごとのウェーブ内累積成立回数(今回成立分は含まない)
  roleOccurrenceCountThisWave: Partial<Record<RoleName, number>>
  // 慈悲用: 次のコンボの間、倍率xを適用中か
  mercyActiveNextCombo: boolean
  // 治癒用: 現在のコンボ中に列一掃を達成した列のインデックスと、その列のコンボ開始時点の枚数
  sweptColumnsThisCombo: { colIndex: number; startLength: number }[]
  // 再生用: ウェーブ中に再生が既に発動したか(ウェーブ中1回のみ)
  regenerationUsedThisWave: boolean
  // 不屈用: ウェーブ中に不屈が既に発動したか(ウェーブ中1回のみ)
  resilienceUsedThisWave: boolean
  // エイワズ用: コンボリセットを防ぐ残り回数(0なら通常通りリセットする)
  comboResetShieldRemaining: number
  // アルギズ用: そのウェーブが終わるまで、isPlayable判定をバイパスして全列からプレイ可能にするか
  playFromAnywhereActiveThisWave: boolean
  // ナウジズ用: そのウェーブが終わるまで、コンボリセット時の再開式を変更するか
  nauthizActiveThisWave: boolean
  // イサ用: そのウェーブが終わるまで、コンボ数の変化を凍結するか
  comboFrozenThisWave: boolean
  // ソウィロ用: 発動済みか(役未確定の待機状態を含む)
  sowiloActiveThisWave: boolean
  // ソウィロ用: 倍率対象として確定した役(未確定ならnull)
  sowiloBoostedRole: RoleName | null
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
  // 所持中の秘儀(最大3、同じ種類を複数所持できる)。ウェーブを跨いで持続する(護符と同様)
  rites: RiteId[]
}
