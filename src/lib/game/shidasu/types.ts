// src/lib/game/shidasu/types.ts
import type { ScorePart } from './scoreParts'
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる
export type SpreadId = 'fool' | 'moon'
// Wave単位の新概念「星」が持つ制限ルール。旧BossKind(noLoop/faceLock/lowCombo/oddCombo/suit/face)を
// kindで判別するUnion型として引き継ぐ。suitのみ、星が選出されると同時にスートを抽選し確定させる。
export type StarRestriction =
  | { kind: 'noLoop' }
  | { kind: 'faceLock' }
  | { kind: 'lowCombo'; maxCombo: number }
  | { kind: 'oddCombo' }
  | { kind: 'suit'; suit: Suit }
  | { kind: 'face' }
  | null

// Wave単位の新概念「星」(旧: 小凶/中凶/大凶の階級制を廃止した代わりの仕組み)。
// waveSlotが1/2/3のうちどのWave番号で使われうるかを表す。全ての星はフラットな1つのリストとして
// 定義され、Wave開始時にwaveSlotが一致する星の中からランダムに1つ選ばれる。
export interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: null
  // 制限ルールのプレイヤー向け説明文テンプレート。{maxCombo}等のプレースホルダーを
  // 含む場合があり、starRestrictionDetail(+page.svelte)で展開して表示する。
  // restrictionがnullの星ではdescTemplateも空文字になる。
  descTemplate: string
}
export type Rarity = 'C' | 'U' | 'R'
export type RoleName = 'flush' | 'royalSet' | 'sameRank' | 'completeRun' | 'columnSweep' | 'suit' | 'color' | 'stair' | 'pair' | 'alternating'
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
  | 'dedication' | 'diligence' | 'divineProtection'
  | 'fortitude'
  | 'waterMirror'
  | 'vow' | 'pact' | 'crimson' | 'jetBlack'
  | 'silver'
  | 'discretion' | 'frost'

// 秘儀(Rite): プレイ中に能動的に使用する消費アイテム。エルダー・フサルク(北欧ルーン文字)
// 全24種に効果を実装済み。2026-08-11に一度削除した9種(raidho/wunjo/othala/perthro/tiwaz/laguz/
// ansuz/kenaz/thurisaz)は、docs/shidasu/shidasu-rite-redesign-candidates.mdセクションAの
// 内容で新しい効果を割り当てて復元した(元の効果とは別物)。
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
// 二十八宿のうち今回効果を実装した27種のみをメンバーとする(残り1種はmansions.tsの見た目候補にのみ存在)。
export type RevelationId =
  | 'kaku' | 'kou' | 'tei' | 'bou'
  | 'shin' | 'bi' | 'ki' | 'to'
  | 'gyu' | 'jo'
  | 'kyo'
  | 'aya'
  | 'shitsu'
  | 'heki'
  | 'kei'
  | 'rou'
  | 'i'
  | 'hitsu'
  | 'shi'
  | 'sei'
  | 'subaru'
  | 'ryuu'
  | 'hotori'
  | 'chou'
  | 'yoku'
  | 'mitsu'
  | 'karasu'

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
  // 廃棄された(デッキから永久に除外された)カードか。要素を削除するとdeckIdの採番ロジック
  // (配列長を基準に採番する箇所が複数ある)が壊れるため、削除ではなくフラグで管理する。
  removed: boolean
}

export interface ScoreGain {
  points: number
  parts: ScorePart[]
}

// PlayArea.svelteのonPlayCardが、プレイ結果(得点内訳アニメーションに必要な情報)を
// 呼び出し元へ同期的に返すための型。applyPlayCardが常に同期関数であることを前提にしている。
export interface PlayCardResult {
  lastGain: ScoreGain | null
}

export type WaveStatus = 'playing' | 'ended'
// 'previewDismissed'は本番Waveの終了理由ではなく、ショップ系フェーズでの天啓ターゲット選択用
// プレビュー盤面(使い捨て)をコラム選択完了後に片付けアニメ経由で破棄するためのUI専用の値。
export type WaveEndReason = 'target' | 'fullClear' | 'stuck' | 'previewDismissed' | null
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
  // 献身・勤勉・加護用: 護符ごとの累積倍率(xは1から開始、対象役が成立するたびx+=nされる)。
  // ラン全体で永続する値だが、playCard内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  dedicationX: number
  diligenceX: number
  divineProtectionX: number
  // 果断・星霜用: 天啓・神託・秘儀を使用するたび永続的に加算/加算される値。
  // ラン全体で永続する値だが、playingフェーズ中の使用イベント内でのみ更新されるため
  // WaveState側に正本を持ち、startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  discretionN: number
  frostX: number
  // 残響用: コンボリセットのたびリセット前コンボ数に応じて永続的に加算される倍率(1から開始)。
  // ラン全体で永続する値だが、drawStock内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  echoX: number
  // 流星用: コンボがc(talismans.shootingStar.c)に到達するたび永続的に加算される値。
  // ラン全体で永続する値だが、playCard内でのみ更新されるためWaveState側に正本を持ち、
  // startWaveでRunStateからコピー・resolveWaveEndでRunStateへ書き戻す。
  shootingStarN: number
  // 鋼鉄用: 役の種類ごと(sameRank以外)に、今コンボで遅延複製をスケジュール済みか
  roleEchoUsedThisCombo: Partial<Record<RoleName, boolean>>
  // 鋼鉄用: sameRankは枚数段階(sameRankCountの値)ごとに使用済みかを記録する
  sameRankEchoUsedThisCombo: number[]
  // 鋼鉄用: 次の1プレイで上乗せ予定の役ボーナス(未予約ならnull)
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
  // スリサズ用: 直後の1回のカードプレイ(playCardのみ、drawStockの素朴分岐は対象外)の得点計算に
  // 追加で乗算する倍率。既定1(無効)。そのプレイが完了した時点で無条件に1へリセットされる
  nextPlayScoreMultiplier: number
  // 神託用: 各役のレベル(ラン全体で持続)。useOracleでプレイ中いつでも加算されうるため、
  // ウェーブ中も変化しうる。得点計算時、各役の基礎点にこのレベルを乗算する(patterns.ts・engine.ts参照)
  oracleLevels: Record<RoleName, number>
}

export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'cardSetSelect' | 'continueChoice' | 'allClear' | 'gameOver'

export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'

// バラ売り枠: shop突入時に種類と個体が1つ確定し、以後入れ替わらない。購入するとsoldがtrueになるだけで
// 配列自体(枠の並び)は変化しない。idはkindに応じてItemId | RiteId | RevelationId | RoleNameのいずれか。
export interface ShopIndividualSlot {
  kind: ShopSlotKind
  id: string
  sold: boolean
}

// トランプセット福袋のセットジャンル識別子。枚数バリエーションを持つジャンルは
// 識別子の末尾に枚数(または組数×2など)を含める(例: stair3/stair5/stair7)。
export type CardSetGenreId =
  | 'stair3' | 'stair5' | 'stair7'
  | 'sameRank2' | 'sameRank3' | 'sameRank4'
  | 'faceCards'
  | 'sameSuit3' | 'sameSuit5' | 'sameSuit7'
  | 'royal'
  | 'flush'
  | 'completeRunSameSuit' | 'completeRunRandomSuit'
  | 'pair2' | 'pair3'
  | 'redBlack4Random' | 'redBlack4Fixed' | 'redBlack6Random' | 'redBlack6Fixed' | 'redBlack8Random' | 'redBlack8Fixed'
  | 'wildCard'

// 福袋を開けた瞬間に確定する、1オファー分の中身(ジャンルIDと具体的なカード内容)。
// cardsはこの時点ではdeckIdを持たない(deckIdは実際に選択が確定しdeckCompositionへ
// 追加する瞬間に採番する。福袋を開けてから選ぶまでの間に他の処理でdeckCompositionの
// 長さが変わる可能性を考慮し、確定時点で採番することで常に一意性を保証する)。
export interface CardSetOffer {
  genreId: CardSetGenreId
  cards: { suit: Suit; rank: Rank; wild: boolean }[]
}

// 福袋カタログの1エントリ。管理画面(/admin/shidasu-packs)で自由に追加・削除・編集できる。
// 同じ内容(種別・選択肢数・取得数・価格)のエントリを名前だけ変えて複数用意すると、
// 抽選プール内での比率が上がるため、その福袋が相対的に出現しやすくなる
// (各エントリの抽選確率自体は常に均等)。
export interface PackCatalogEntry {
  name: string
  packKind: ShopSlotKind
  offerCount: number
  pickCount: number
  price: number
}

// 福袋枠: shop突入時にpackCatalogから1エントリが確定し、以後入れ替わらない。選ばれた時点の
// name・priceをスナップショットとしてコピーするため、抽選後に管理画面でカタログを編集しても
// 既に提示中のショップには影響しない。購入時にofferCount択からpickCount個を選ぶ
// 中身選択画面(itemSelect等)へ遷移する。
export interface ShopPackSlot {
  packKind: ShopSlotKind
  offerCount: number
  pickCount: number
  name: string
  price: number
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
  // waveが実際に新規生成(startWave)されるたびに1ずつ増える。stageIndex/waveIndexは
  // enterShopの時点で次Wave位置へ進んでしまい実際の生成(finishShop)より早く変化するため、
  // UI側の配布アニメーション発火キー(waveKey)はこちらを使う。
  waveGeneration: number
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
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
  // 現在のステージの3Wave分の「星」。新しいステージに入る直前(waveIndexが0に戻るタイミング)に
  // waveSlot 1・2・3それぞれの候補群から1つずつ抽選し一括で確定させる。titleフェーズでは空配列。
  // stageStars[waveIndex]が現在Waveの星に相当する(専用フィールドは持たず都度導出する)。
  stageStars: Star[]
  // ラン単位で保持する通貨(星片)の所持数。continueChoiceを挟んでもリセットされず、
  // beginRun(新しいラン開始)のときのみ初期値に戻る
  currency: number
  // 献身・勤勉・加護の累積倍率の永続値。WaveState側のdedicationX等の正本。
  // beginRunで1に初期化され、resolveWaveEnd成功時にwaveの値で更新される。
  dedicationX: number
  diligenceX: number
  divineProtectionX: number
  // 果断・星霜の累積値の永続値。WaveState側のdiscretionN/frostXの正本。
  // beginRunで初期化され(discretionN=10, frostX=1)、resolveWaveEnd成功時にwaveの値で更新される。
  discretionN: number
  frostX: number
  // 残響・流星の累積値の永続値。WaveState側のechoX/shootingStarNの正本。
  // beginRunで初期化され(echoX=1, shootingStarN=50)、resolveWaveEnd成功時にwaveの値で更新される。
  echoX: number
  shootingStarN: number
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
  // カードセット福袋('cardSetSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  cardSetOffer: CardSetOffer[]
  // 現在のショップ訪問でリロール(品ぞろえの再抽選)した回数。次のショップに入る(enterShop)たびに0にリセットされる
  shopRerollCount: number
  // 直前に使用した天啓のID(星・hotoriが参照する)。使用履歴が無ければnull。
  // useRevelationは天啓回帰(hotori)自身を使った場合のみこのフィールドの更新をスキップする
  // (履歴に残さない)。これにより天啓回帰が自分自身を再取得する自己参照ループを構造的に防いでいる。
  lastUsedRevelationId: RevelationId | null
  // 直近に使用した秘儀のID、新しい順で最大2件(秘儀回帰が参照する)。
  recentUsedRiteIds: RiteId[]
}
