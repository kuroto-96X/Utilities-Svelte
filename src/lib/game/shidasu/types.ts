// src/lib/game/shidasu/types.ts
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる
export type SpreadId = 'fool' | 'moon'
// ボスウェーブの制約候補。挙動(kind)そのものはコードに紐づく固定値で、
// どの階級(小凶/中凶/大凶)に属するかはparams.bosses[kind].tierとして管理画面から変更できる。
// noLoop/faceLock=小凶向け(isPlayableの可否制約)、lowCombo/oddCombo=中凶向け、suit/face=大凶向け(得点ロック)
// という想定だが、実際にどの階級で抽選されるかはtierの値のみが決める。
export type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
export type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'
export type Rarity = 'C' | 'U' | 'R'
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair'
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

// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)
// 全24種すべてに効果を実装済みで、ここにメンバーとして揃っている。
export type RiteId =
  | 'raidho' | 'jera' | 'wunjo' | 'othala' | 'perthro'
  | 'uruz' | 'ingwaz'
  | 'gebo' | 'fehu' | 'dagaz'
  | 'algiz' | 'tiwaz' | 'laguz'
  | 'eihwaz' | 'ansuz' | 'kenaz' | 'thurisaz'
  | 'hagalaz'
  | 'nauthiz' | 'isa'
  | 'sowilo'
  | 'berkano'
  | 'mannaz'
  | 'ehwaz'

// 天啓(Revelation): いつでも使用可能で、場札・デッキ構成の両方に永続的な効果を発揮する消費アイテム。
// 二十八宿のうち今回効果を実装した12種のみをメンバーとする(残り16種はmansions.tsの見た目候補にのみ存在)。
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'

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
  // startWaveで実際に配られた1列あたりの行数(暗雲護符・虚(天啓)によるextraTableauRowsを含んだ値)。
  // 列一掃ボーナスの「列を1コンボで全て空にしたか」判定(playCardのsweepQualifies)は、
  // params.layout.rowsそのものではなくこの値と比較する(暗雲・虚を考慮せず判定すると、
  // それらを持つ間ずっと列一掃ボーナスが成立しなくなるバグがあったため)。
  dealtRows: number
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
  // 祝福用: 役成立のたび+1(ウェーブ単位、永続)。コンボリセット処理では参照せず、
  // 得点計算時の実効コンボ(effectiveCombo)に常に加算する別枠の値として扱う
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
  // マンナズ用: そのウェーブが終わるまで、得点計算に護符レア度倍率を掛けるか
  mannazActiveThisWave: boolean
  // エワズ用: そのウェーブが終わるまで、場札の許容ランク差を2まで拡張するか
  ehwazActiveThisWave: boolean
  // 神託用: 各役のレベル(ラン全体で持続)。useOracleでプレイ中いつでも加算されうるため、
  // ウェーブ中も変化しうる。得点計算時、各役の基礎点にこのレベルを乗算する(patterns.ts・engine.ts参照)
  oracleLevels: Record<RoleName, number>
}

export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'

export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle'

// バラ売り枠: shop突入時に種類と個体が1つ確定し、以後入れ替わらない。購入するとsoldがtrueになるだけで
// 配列自体(枠の並び)は変化しない。idはkindに応じてItemId | RiteId | RevelationId | RoleNameのいずれか。
export interface ShopIndividualSlot {
  kind: ShopSlotKind
  id: string
  sold: boolean
}

export type PackOfferCount = 3 | 5 | 7
export type PackPickCount = 1 | 2

// 福袋枠: shop突入時にパターン(kind×offerCount×pickCount)が1つ確定し、以後入れ替わらない。
// 購入時にofferCount択からpickCount個を選ぶ中身選択画面(itemSelect等)へ遷移する。
export interface ShopPackSlot {
  packKind: ShopSlotKind
  offerCount: PackOfferCount
  pickCount: PackPickCount
  sold: boolean
}

export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
}

// 福袋の天啓・神託パックで上限到達時にスワップ対象を指定するための判別共用体。
// 天啓・神託は合算枠(上限2)を共有するため、スワップ対象がどちらの配列に属するかを明示する必要がある。
export type HeldRevelationOrOracleRef =
  | { kind: 'revelation'; id: RevelationId }
  | { kind: 'oracle'; id: RoleName }

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
  // 所持中の天啓(最大2、同じ種類を複数所持できる)。ウェーブを跨いで持続する(秘儀と同様)
  revelations: RevelationId[]
  // 天啓選択画面('revelationSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  revelationOffer: RevelationId[]
  // 天啓「虚」由来の、ウェーブ開始時の配布行数への永続的な追加分(暗雲護符のrと合算される)
  extraTableauRows: number
  // 各役の現在レベル(初期値1、上限なし)。ラン全体で持続する(神託選択画面で+1される)
  oracleLevels: Record<RoleName, number>
  // 神託選択画面('oracleSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  oracleOffer: RoleName[]
  // 大凶ステージ(stageIndex % 3 === 2)の対象スート。中凶クリア直後(大凶ステージの1ウェーブ目を
  // 配る時点)にrandで抽選して確定し、そのステージが終わるまで(1〜3ウェーブ目)固定で使い回す。
  // 小凶・中凶ステージの間は常にnull
  currentGreatMisfortuneSuit: Suit | null
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
  // 現在のステージのボスウェーブで適用される候補。ステージ突入時(そのステージのウェーブ0を
  // 配る時点)にそのステージの階級(bossTierOf(stageIndex))に属する候補群からrandで1つ抽選し、
  // そのステージの3ウェーブ間(表示・実際の判定とも)固定で使い回す。titleフェーズではnull
  currentBossKind: BossKind | null
  // ラン単位で保持する通貨(星片)の所持数。continueChoiceを挟んでもリセットされず、
  // beginRun(新しいラン開始)のときのみ初期値に戻る
  currency: number
  // 温存中の神託(合算上限2をrevelationsと共有)。同じ役を複数所持できる
  oracles: RoleName[]
  // 現在のショップの商品構成。'shop'フェーズおよびそこから派生する福袋中身選択フェーズの間のみ非null
  shop: ShopState | null
  // 福袋購入後、あと何個選べば中身選択画面が終了するか(0ならその画面にいない)
  offerPickRemaining: number
  // 秘儀の福袋('riteSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  riteOffer: RiteId[]
  // 秘儀の福袋中身選択で上限到達時、選ばれたが未確定の秘儀(スワップ待ち)。待機中でなければnull
  pendingNewRite: RiteId | null
  // 天啓の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の天啓(スワップ待ち)。待機中でなければnull
  pendingNewRevelation: RevelationId | null
  // 神託の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の神託(スワップ待ち)。待機中でなければnull
  pendingNewOracle: RoleName | null
}
