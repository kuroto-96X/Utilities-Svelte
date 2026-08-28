# スプレッド 候補一覧(検討用)

Shidasuロードマップ項目3「スプレッドの追加検討」のための、スプレッドの説明・名称候補・今後の検討方針をまとめるワークシート。

## スプレッドの説明

スプレッドは、ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナ(タロットカードの22枚)から命名する(`src/lib/game/shidasu/types.ts`の`SpreadId`型のコメントに明記)。1回のランを通して不変で、タイトル画面に戻って選び直すまで固定される(`RunState.spreadId`)。タイトル画面では全スプレッドを1件ずつ表示するカルーセルUI(左右ボタンで切り替え、下部のスタートボタンで確定)から選ぶ。

現状10種類が実装済み(`src/lib/game/shidasu/params.ts`の`ShidasuParams.spreads`、`SPREAD_IDS`定数の順):

| SpreadId | 名称 | 効果 |
|---|---|---|
| `fool` | 愚者 | 特殊ルールなし(基本スプレッド) |
| `moon` | 月 | 場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる(`initialExtraTableauRows: 1`) |
| `pope` | 教皇 | 神託の初期レベルが5になるが、ショップで神託が販売されない(`initialOracleLevel: 5`, `bannedShopKinds: ['oracle']`) |
| `empress` | 女帝 | 初期所持金が10多い状態で始まる(`initialCurrencyBonus: 10`) |
| `magician` | 魔術師 | 護符の所持スロットが1多いが、場札は1行少ない状態で始まる(`initialItemCapacityBonus: 1`, `initialExtraTableauRows: -1`) |
| `justice` | 正義 | 初期デッキから絵札(J・Q・K)が除外された状態で始まる(`excludedRanks: [11, 12, 13]`) |
| `lovers` | 恋人 | 初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる(`unifyBlackRedSuits: true`) |
| `emperor` | 皇帝 | 初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる(`deckMultiplier: 2`, `tableauRowMultiplier: 2`, `targetScoreMultiplier: 2`, `initialItemCapacityBonus: -1`) |
| `wheelOfFortune` | 運命の輪 | 初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる(`randomizeDeck: true`) |
| `strength` | 力 | 初期デッキの各スート(♠♥♦♣)から1枚ずつランダムに選ばれたカードがワイルドに変換された状態で始まる(`randomizeWildPerSuit: true`) |

`ShidasuParams.spreads[id]`(`SpreadConfig`型、`src/lib/game/shidasu/types.ts`)は以下のフィールドを持つ:

- `name` / `desc`: 表示名・説明文
- `initialExtraTableauRows`: ウェーブ開始時の配布行数への初期オフセット
- `deckMultiplier`: 初期デッキ生成時、標準デッキ(52枚)を何組連結するか(既定1)
- `tableauRowMultiplier`: 場札の配布行数への倍率(既定1、`initialExtraTableauRows`に加算する形で反映)
- `targetScoreMultiplier`: 目標スコア(`waveTarget`)への倍率(既定1)
- `initialOracleLevel`: 神託の初期レベル(全役一律、既定1)
- `bannedShopKinds`: ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)
- `initialCurrencyBonus`: 初期所持金(`currency.initialAmount`)へのオフセット(既定0)
- `initialItemCapacityBonus`: 護符の所持上限(`itemMaxCapacity`)へのオフセット(既定0)
- `excludedRanks`: 初期デッキ生成時に除外するランクの一覧(既定は空配列=除外なし)
- `unifyBlackRedSuits`: 初期デッキ生成時、黒スート・赤スートをそれぞれランダムに片方へ統一するか(既定false)
- `randomizeDeck`: 初期デッキ52枚それぞれのsuit・rankを独立にランダム抽選するか(既定false。trueの場合`deckMultiplier`による複製結果を上書きする)
- `randomizeWildPerSuit`: 初期デッキ生成時、4スートそれぞれから1枚ずつランダムにワイルドへ変換するか(既定false)

`/admin/shidasu-spreads`(単一テーブル型admin画面)で全フィールドを編集可能。新規スプレッドを追加する場合は`SPREAD_IDS`(`params.ts`)への追記が必要(ゲーム側のタイトル画面カルーセル・admin画面の両方がここを単一の情報源として参照する)。

`beginRun`(`engine.ts`)内のデッキ変換チェーンは、`baseDeckComposition`(`deckMultiplier`由来)→`deckCompositionAfterRandomize`(`randomizeDeck`由来)→`deckCompositionAfterExclusion`(`excludedRanks`由来)→`deckCompositionAfterUnify`(`unifyBlackRedSuits`由来)→`deckComposition`(`randomizeWildPerSuit`由来)という段階的な三項演算子チェーンで、この順序で各スプレッド効果を適用する。

## 名称候補一覧(大アルカナより、既存10枚を除く12枚)

大アルカナ22枚のうち`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)・`magician`(魔術師)・`justice`(正義)・`lovers`(恋人)・`emperor`(皇帝)・`wheelOfFortune`(運命の輪)・`strength`(力)は実装済みのため、残り12枚を新規スプレッドの名称候補とする。標準的な並び順(0〜21、実装済み10枚を除く)で列挙する。

| # | 名称 | 一般的なモチーフ・象徴 |
|---|---|---|
| 1 | 女教皇 | 知恵・秘密・静寂 |
| 2 | 戦車 | 勝利・前進・意志力 |
| 3 | 隠者 | 内省・孤独・探求 |
| 4 | 吊るされた男 | 停滞・犠牲・視点の転換 |
| 5 | 死神 | 終焉・変容・再生 |
| 6 | 節制 | 調和・中庸・融合 |
| 7 | 悪魔 | 束縛・誘惑・依存 |
| 8 | 塔 | 崩壊・急変・啓示 |
| 9 | 星 | 希望・導き・浄化 |
| 10 | 太陽 | 成功・活力・祝福 |
| 11 | 審判 | 復活・覚醒・総括 |
| 12 | 世界 | 完成・統合・達成 |

**注記:** 「星」(#9)は既存の`Star`型(Wave単位の概念)と、「太陽」は既存レリック候補などとの名称衝突が無いか、実際に採用する際は`SpreadId`型・既存の`ItemId`/`RelicId`/`RiteId`/`RevelationId`と重複しないか確認が必要(過去に「恩賞」→`favor`のように、想定外の衝突が判明した前例がある)。

## スプレッドの固有ルールの方向性(対象になりそうな要素の洗い出し)

スプレッドは「ラン開始時に決まり、以後変わらない」という性質を持つ(プレイ中に動的に変化する護符・レリック・妨害行動とは対照的)。以下、9つの対象軸ごとに、実際のコード上でラン開始時に固定化できそうな要素を洗い出す。

### 初期デッキ内容

`RunState.deckComposition`(`DeckCard[]`)は`standardDeckComposition()`(`src/lib/game/shidasu/deck.ts`)が52枚(4スート×ランク1〜13、全て`wild: false`)を生成する。

- **実装済み**: 初期デッキ枚数を倍にする(`SpreadConfig.deckMultiplier`、`emperor`が`2`を使用。`multipliedDeckComposition()`ヘルパー(`deck.ts`)が標準デッキを指定組数連結する)
- **実装済み**: 特定ランクを最初から除外する(`SpreadConfig.excludedRanks`、`justice`が`[11, 12, 13]`を使用。`removed: true`で初期化)
- **実装済み**: 黒スート・赤スートをそれぞれランダムに片方へ統一する(`SpreadConfig.unifyBlackRedSuits`、`lovers`が使用。`unifyBlackRedSuits()`ヘルパー(`deck.ts`)がラン開始時にランダムな統一先を決定する)
- **実装済み**: 52枚それぞれのランク・スートを完全ランダムに再抽選する(`SpreadConfig.randomizeDeck`、`wheelOfFortune`が使用。`randomizedDeckComposition()`ヘルパー(`deck.ts`))
- **実装済み**: 4スートそれぞれから1枚ずつランダムにワイルド化する(`SpreadConfig.randomizeWildPerSuit`、`strength`が使用。`convertOneCardPerSuitToWild()`ヘルパー(`engine.ts`)、既存護符「豊穣」の`convertRandomCardToWild()`のスート版)
- 未実装: スート別の初期枚数比率を非対称にする(例: 特定スートを減らす/増やす)
- 未実装: 初期ワイルド枚数を、スート別ではなく単純な固定N枚で変える(既存護符「永劫」がWave開始のたびワイルド1枚追加する処理と同型)

### 場札

`startWave`(`engine.ts`)の配布ロジックが対象。

- **実装済み**: 場札の配布行数への倍率(`SpreadConfig.tableauRowMultiplier`、`emperor`が`2`を使用。`params.layout.rows * tableauRowMultiplier - params.layout.rows`を`initialExtraTableauRows`に加算する形で、基準行数の変更に自動追従する)
- 未実装: 列数(`params.layout.cols`、既定7)自体をスプレッドごとに変える(現状はスプレッド非依存の固定値、型拡張が必要)
- 未実装: 配布順序(現状は列ごとに山札の先頭から`rows`枚ずつ配る単純な方式)を変える(例: 行優先配布、特定パターンでの配布)
- 未実装: 基準カード(foundation)の選出方法(現状は配布後の山札末尾を採用)を、特定ランク・スート固定にする

### 報酬

`Star.reward`・`params.flow`(`stageTargetBase`/`stageTargetMultiplier`/`stagesPerRun`/`wavesPerStage`)・`params.currency.initialAmount`が対象。

- **実装済み**: 初期所持金(`currency.initialAmount`)へのオフセット(`SpreadConfig.initialCurrencyBonus`、`empress`が`10`を使用)
- **実装済み**: 目標スコア(`waveTarget`)への倍率(`SpreadConfig.targetScoreMultiplier`、`emperor`が`2`を使用。`waveTarget`関数(`engine.ts`)が`spreadId`を受け取り、対応する`spreadConfig.targetScoreMultiplier`を乗算する)
- 未実装: ステージ数(`stagesPerRun`、既定8)・1ステージあたりのWave数(`wavesPerStage`、既定3)を変える(ラン全体の長さ・テンポに影響)
- 未実装: Wave報酬(`Star.reward`)への倍率適用

### ショップ

`params.shop`(`itemPrice`/`ritePrice`/`revelationPrice`/`oraclePrice`/`packCatalog`/`rerollCostStep`)が対象。

- **実装済み**: 特定スロット種別(護符/秘儀/天啓/神託/トランプセット)をショップから丸ごと除外する(`SpreadConfig.bannedShopKinds`、`pope`が`['oracle']`を使用。`shop.ts`の`rollIndividualSlot`/`rollPackSlots`がフィルタする)
- 未実装: 護符・秘儀・天啓・神託の価格体系(`itemPrice`等)全体に倍率をかける(安く/高くする。専用フィールドを新設せず、レリック「招き猫」と同型の効果を持つレリック・天啓を最初から持たせる「所持品」軸での実現が優先候補)
- 未実装: リロールコストの刻み幅(`rerollCostStep`、既定5)を変える
- 未実装: 福袋カタログ(`packCatalog`)の内容をスプレッドごとに絞る・追加する(特定ジャンルの福袋を除外/優遇する)
- 未実装: ショップの初期枠数(バラ売り・福袋の基本枠数)を変える(現状レリック「熊手」「福笹」がランタイムで増やす仕組みのみ存在、スプレッド側からのベース値変更は要調査・型拡張)

### 星

`params.stars`(星の候補プール)・`StarRestriction`・`StarSabotage`が対象。まだ実装例なし。

- 星の抽選プールをスプレッド専用にフィルタする(例: 特定`restrictionKind`の星を除外、またはスプレッド限定の星を追加する。現状`rollStarForSlot`は`waveSlot`一致のみでフィルタしており、スプレッド軸のフィルタは未実装)
- 各星の`targetMultiplier`/`reward`にスプレッド補正をかけ、難易度・報酬カーブを変える
- 妨害行動の出現強度(`StarSabotage.kind`、現状`'none'`/`'all'`のみ実装、`'some'`は型としては存在するが未使用)をスプレッドごとに調整する
- `StarRestriction`固有パラメータ(例: `lowCombo`の`maxCombo`)の値をスプレッドごとに変える

### 抽選プールの偏り

護符(`ITEM_POOL`)・秘儀(`RITE_POOL`)・天啓(`REVELATION_POOL`)・神託(`ORACLE_POOL`)・レリック(`RELIC_POOL`)のオファー抽選は、いずれも`rollOffer<T>(pool, count, rand)`(`deck.ts`)による均等抽選(シャッフルして先頭`count`個)。カードセット福袋のジャンル抽選のみ`CARD_SET_GENRE_WEIGHTS`(`cardSets.ts`)という重みテーブルを持つ。現状、これらの抽選にスプレッド軸のフィルタ・重み付けは一切実装されていない。

- 特定カテゴリの護符・秘儀・神託が出やすくなる/出にくくなる(重み付き抽選への変更が前提)
- 特定レリックが最初から除外される(出現しなくする)
- カードセット福袋のジャンル出現率(`CARD_SET_GENRE_WEIGHTS`)をスプレッドごとに差し替える(特定ジャンルが出やすい/出ない)

### 神託の初期レベル

`RunState.oracleLevels: Record<RoleName, number>`(各役の現在レベル、上限なし)は`defaultOracleLevels()`(`oracles.ts`)が全役一律1でハードコードして返す。

- **実装済み**: 全役の初期レベルを一律で底上げする(`SpreadConfig.initialOracleLevel`、`pope`が`5`を使用。`oracleLevelsWithUniformValue()`ヘルパー(`oracles.ts`)が`ORACLE_POOL`の全役に同じ値を適用し、`engine.ts`の`beginRun`が反映する)
- 未実装: 特定の役だけ初期レベルを個別に高く/低くする(例: 「フラッシュ」系スプレッドは`flush`の初期レベルだけ+1する等)。現状は全役一律のみ対応

### 所持品

`RunState.relics: { id: RelicId; tsukumoka: boolean }[]`・`RunState.revelations: HeldRevelation[]`(`{ instanceId, id, sellBonus? }`)が対象。ラン開始時、特定のレリック・天啓を最初から所持した状態でスタートする軸。対象はレリック・天啓の2カテゴリに限定する(護符・秘儀・神託は対象外)。まだ実装例なし。

「抽選プールの偏り」「ショップ」「役」の各軸で挙がる効果のうち、「専用のスプレッドフィールドを新設する」のではなく「該当する効果を持つレリック・天啓を最初から持たせる」ことで実現できるものの受け皿になる。

- 特定のレリック・天啓をラン開始時から所持させる(`beginRun`(`engine.ts`)で`RunState.relics`/`revelations`に初期エントリを追加する。護符「橋」と同型の役ボーナス緩和効果を持つレリック・天啓があれば「役」軸の効果を、価格割引効果を持つレリック「招き猫」があれば「ショップ」軸の効果を、それぞれ専用フィールド無しで表現できる)
- 天啓は`HeldRevelation.sellBonus`等の個体差要素を持つため、初期所持時にどう初期化するか(ランダムか固定か)は個別候補の検討時に決める

### 護符所持スロット

`itemMaxCapacity`(`relics.ts`)。

- **実装済み**: 護符の所持上限へのオフセット(`SpreadConfig.initialItemCapacityBonus`、`magician`が`+1`、`emperor`が`-1`を使用)

### 役

`params.scoring`セクション(基礎点・コンボ倍率step・各役/パターンのボーナス点・成立に必要な最小枚数など)は現状スプレッド非依存の単一グローバル値。既存護符「橋」が、階段・同スート/同色の成立に必要な最小枚数(`stairMinLen`/`suitColorMinLen`)を所持時のみ緩和する「実効値」算出パターン(基礎値から護符由来のオフセットを差し引いて都度計算)を持っており、同じパターンをスプレッド由来のオフセットとして流用できる。まだ実装例なし。

- 階段・同スート・同色・交互などパターンの成立に必要な最小枚数を、スプレッドごとに緩和/厳格化する → 「所持品」軸へ統合(該当効果を持つ天啓・レリックを最初から持たせることで実現。専用フィールドを新設せず、護符「橋」と同型の効果を天啓・レリック側に持たせる前提)
- コンボ倍率の伸び方(`comboMultiplierStep`)をスプレッドごとに変える → 同上、所持品軸へ統合
- 特定の役・パターンのボーナス点(`flushBonus`・`royalSetBonus`・`sameRankBonusUnit`・`completeRunBonus`・`pairBonusUnit`・`alternatingBonus`等)をスプレッドごとに増減する → 同上、所持品軸へ統合

### 検討時の留意点

- これらの軸を組み合わせて、大アルカナの各名称が持つ象徴(上記名称候補一覧の「一般的なモチーフ・象徴」列)と紐づいた固有ルールを個別に検討していく
- 「同じ軸に複数のスプレッドが偏らないようにする」「`fool`は特殊ルールなしの基準点として維持する」といった設計方針も、個別候補の検討時に合わせて詰める
- 「場札」列数変更・「ショップ」初期枠数変更・「抽選プールの偏り」(重み付き抽選化)・「星」軸全般は、いずれも現状の型定義に無いフィールドの追加(`ShidasuParams`の拡張)や既存関数の改修が前提になる点に注意
- 「所持品」軸は`ShidasuParams`の拡張ではなく、`beginRun`(`engine.ts`)で`RunState.relics`/`revelations`に初期エントリを追加する形になる見込み
- スプレッドの追加・編集は`/admin/shidasu-spreads`(単一テーブル型admin画面)から行える。新規スプレッドを追加する場合は`SPREAD_IDS`(`params.ts`)への追記が必要(ゲーム側のタイトル画面カルーセル・admin画面の両方がここを単一の情報源として参照する)

## 具体的なルール候補一覧(実装済み)

過去に挙がった具体的なルール候補(候補A〜G)は、いずれも新規スプレッドとして実装済み。対応関係を記録として残す。

| # | 内容 | 実装済みSpreadId | 対象軸 |
|---|---|---|---|
| A | 初期所持金+N(N=10) | `empress`(女帝) | 報酬 |
| B | 護符の所持スロット+N、場札-N行(N=1) | `magician`(魔術師) | 護符所持スロット/場札 |
| C | 初期デッキからJQK(11・12・13)を除外してスタート | `justice`(正義) | 初期デッキ内容 |
| D | 初期デッキの♠と♣がどちらか片方に変換、♥と♦がどちらか片方に変換された状態でスタート | `lovers`(恋人) | 初期デッキ内容 |
| E | 初期デッキの枚数x倍、場札配布行x倍、基礎目標スコアx倍、護符の所持スロット-N(x=2, N=1) | `emperor`(皇帝) | 初期デッキ内容/場札/報酬/護符所持スロット |
| F | 初期デッキのすべてのランクとスートがランダムになる | `wheelOfFortune`(運命の輪) | 初期デッキ内容 |
| G | 初期デッキの各スートから1枚ずつランダムにワイルドに変換してスタート(4枚がワイルド化される) | `strength`(力) | 初期デッキ内容 |

新規の具体的なルール候補は、今後このセクションに追記していく。

## スコープ外

- 各候補の具体的な効果・数値の決定は本ワークシートの対象外。名称候補と検討軸の整理のみを行う
- 実装そのもの(本ドキュメントはブレインストーミング前段階の整理メモであり、効果の方向性が固まった段階で`superpowers:brainstorming`から設計を詰める)
