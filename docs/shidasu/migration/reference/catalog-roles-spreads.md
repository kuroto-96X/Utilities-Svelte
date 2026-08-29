# 役(Role)・スプレッド(Spread)全件カタログ

Godot移植フェーズ1向けの資料。対象は`src/lib/game/shidasu/`配下。

---

# 第1部: 役(Role)全10種

- 型定義(正本): `types.ts`の`RoleName`(10件)
- 表示名・簡易説明: `roles.ts`の`ROLE_LIST`(10件、`RoleName`と完全一致)
- 判定ロジック: `patterns.ts`(`suit`/`color`/`stair`/`alternating`/`flush`/`royalSet`/`sameRank`/`completeRun`/`pair`)、`engine.ts`の`playCard`内(`columnSweep`のみ、`patterns.ts`には実装が無い)
- 基礎点: `roles.ts`の`roleBasePoint`関数(`params.scoring`から引く)

件数は`RoleName`ユニオン型10件・`ROLE_LIST`10件で完全一致を確認済み(`shidasu.config.json`には役自体のセクションは無く、基礎点は`scoring`セクションの個別フィールドとして格納されている)。

## 共通の前提

- 役はプレイ中に形成される「チェーン」(`WaveState.chain: Card[]`、直近にプレイ/めくったカードの連なり)に対して、カードを1枚追加するたびに`evaluateChainBonus`(`patterns.ts`)が全役をまとめて判定する。
- 各役の基礎点(`roleBasePoint`で取得)には、その役の`oracleLevel`(神託レベル、`WaveState.oracleLevels[name]`、初期値1・上限無し)を乗算し、さらに一部の役(`flush`/`royalSet`/`sameRank`/`completeRun`/`pair`)には`roleBonusMultiplier(name)`(鋼鉄・明星等の護符由来の追加倍率)も乗算する。`columnSweep`も`oracleLevel`と`roleBonusMultiplier`の両方を乗算する(`engine.ts`)。
- 「ワイルド」カード(`Card.wild === true`)は、`flush`/`royalSet`/`completeRun`/`sameRank`/`pair`の判定で不足分の穴埋め・代役として扱われる(将来のワイルド供給手段を見越した先行実装。現状ワイルドを山札に供給する手段は無いため、`suit`統一スプレッド`strength`を除き実プレイでは稀にしか関与しない)。

以下、`RoleName`の宣言順(`types.ts`)に全10件を記載する。

---

### 1. `flush`(フラッシュ)

- **ラベル**: `label: 'フラッシュ'`
- **判定ロジック(自然文)**: チェーンの直近4枚(`chainIncludingThis.slice(-4)`)を見て、♠♥♦♣の4スートが全て揃っているか判定する(`checkFlush`)。チェーンが4枚未満なら不成立。ワイルドは不足しているスートの穴埋めとして扱う(不足スート数 ≤ ワイルド枚数なら成立)。
- **基礎点**: `params.scoring.flushBonus`(`roleBasePoint`)
- **判定関数**: `checkFlush(chainIncludingThis)`(`patterns.ts`)

### 2. `royalSet`(ロイヤルセット)

- **ラベル**: `label: 'ロイヤルセット'`
- **判定ロジック(自然文)**: チェーンの直近3枚を見て、J(11)・Q(12)・K(13)の3ランクが全て揃っているか判定する(`checkRoyalSet`)。チェーンが3枚未満なら不成立。ワイルドは不足ランクの穴埋めとして扱う。
- **基礎点**: `params.scoring.royalSetBonus`
- **判定関数**: `checkRoyalSet(chainIncludingThis)`(`patterns.ts`)

### 3. `sameRank`(同ランク)

- **ラベル**: `label: '同ランク'`
- **判定ロジック(自然文)**: チェーン内に、今回プレイしたカードと同じランクが既に存在するか(枚数分)判定する累積型役。ワイルドはチェーン内に存在する枚数分がそのまま加算される。今回プレイしたカード自身がワイルドの場合は、チェーン内で最も多く出現している実ランクの枚数を基準に代役枚数を算出する(`countSameRankForWildPlay`)。成立するたび(`sameRankCount > 0`)、`sameRankBonusUnit × 該当枚数`が加点される(枚数に比例した累積加点、他の役のような一発成立/不成立ではない)。
- **基礎点(単価)**: `params.scoring.sameRankBonusUnit`(枚数を乗算)
- **判定関数**: `countSameRankBefore(chainBefore, rank)` / `countSameRankForWildPlay(chainBefore)`(`patterns.ts`)

### 4. `completeRun`(コンプリートラン)

- **ラベル**: `label: 'コンプリートラン'`
- **判定ロジック(自然文)**: チェーン内に出現した異なるランク数(ワイルド分を加算、最大13でクランプ)が、今回のプレイ「前」は13未満、「後」に13以上に到達した瞬間(初めて13ランク揃った瞬間)にのみ成立する一回性の役。成立と同時に、その時点でチェーンが同スート(`suitHeld`)で揃っていれば`completeRunSuitBonus`の追加ボーナスも加算される。
- **基礎点**: `params.scoring.completeRunBonus`(+条件成立時`completeRunSuitBonus`)
- **判定関数**: `checkCompleteRun(chainBefore, chainIncludingThis)`(`patterns.ts`)

### 5. `columnSweep`(列一掃)

- **ラベル**: `label: '列一掃'`
- **判定ロジック(自然文)**: 場札の1列を最後の1枚まで取り切った(列が空になった)瞬間に成立する。**判定関数は`patterns.ts`ではなく`engine.ts`の`playCard`内に直接実装されている**(`sweepQualifies`変数)。条件は「その列がこのプレイで空になった(`columnJustEmptied`)」かつ「そのコンボが始まった時点(直近でコンボが0にリセットされた瞬間)での列の残り枚数(`comboStreakColumnLengths[colIndex]`)が、配布行数(`wave.dealtRows`)と等しいこと(護符「恩寵」所持時は`dealtRows - grace.m`以下でも可)」。つまり「1コンボの中で列を最初から最後まで(あるいは恩寵の緩和条件付きで)取り切った」場合のみ成立し、複数コンボにまたがって少しずつ減らした列を最後に0にしても成立しない。
- **基礎点**: `params.scoring.columnSweepBonus`。1コンボ中に複数列を一掃した場合、`newColumnsEmptied`(そのコンボ内での累計列一掃数)を乗算して加点が増える(`Math.floor(columnSweepBonus × oracleLevel × newColumnsEmptied × roleBonusMultiplier)`)。
- **判定箇所**: `engine.ts`の`playCard`内、`sweepQualifies`/`newColumnsEmptied`(L445〜L460付近)

### 6. `suit`(同スート)

- **ラベル**: `label: '同スート'`
- **判定ロジック(自然文)**: チェーンが`suitColorMinLen`(既定3)枚以上、かつ実カード(ワイルド除く)が全て同じスートであれば成立する(`analyzeSuitColor`の`suitHeld`)。紅蓮・漆黒等の色拡張アイテムはスート判定には影響しない(色判定`color`専用)。
- **基礎点**: `params.scoring.suitBonus`
- **判定関数**: `analyzeSuitColor(chainIncludingThis, items).suitHeld`(`patterns.ts`)、最小枚数`suitColorMinLen`(護符「橋」所持時は`stairMinLen`/`suitColorMinLen`双方が`bridge.m`分緩和される)

### 7. `color`(同色)

- **ラベル**: `label: '同色'`
- **判定ロジック(自然文)**: `suit`(同スート)が不成立、かつチェーンが`suitColorMinLen`以上、かつ実カードが全て同じ色(赤/黒)であれば成立する(`colorHeld`)。「紅蓮」所持時は全カードが赤としても扱われ、「漆黒」所持時は全カードが黒としても扱われる(両方所持時はどちらの色判定も常に真)。
- **基礎点**: `params.scoring.colorBonus`
- **判定関数**: `analyzeSuitColor(chainIncludingThis, items).colorHeld`(`patterns.ts`)。`patterns.evaluateChainBonus`内では`suitHeld`が偽の場合のみ`colorHeld`を評価する(同スートと同色は排他、同時成立時は同スートのみ加点)。

### 8. `stair`(階段)

- **ラベル**: `label: '階段'`
- **判定ロジック(自然文)**: チェーンが同一方向(昇順または降順、K⇔Aのループを跨ぐことも可)に連続したランクで並んでおり、かつ連続枚数(`len`、ワイルドを含むチェーン全長)が`stairMinLen`(既定3)以上であれば成立する。ワイルドは実カード同士の間隔(`gap`)分の橋渡しとして扱われ、実カードだけを見て方向性・整合性を判定する(`analyzeStair`)。
- **基礎点**: `params.scoring.stairBonus`
- **判定関数**: `analyzeStair(chain)`(`patterns.ts`)、最小枚数`stairMinLen`(護符「橋」で緩和可)。K⇔Aループを跨いだかどうかは`stairUsesKALoop`で別途判定(ボス制限`noLoop`用)。

### 9. `pair`(ペア)

- **ラベル**: `label: 'ペア'`
- **判定ロジック(自然文)**: チェーン全体でランクごとに集計し、2枚以上あるランクの「組」が2組以上になった瞬間に成立する累積・マイルストーン型役。同一チェーン内で一度到達した組数は再度加点されず、組数が新記録(2→3→4…)を更新した瞬間にのみ、その時点の組数×`pairBonusUnit`を加点する。ワイルドは今回プレイしたカードのランク(自身がワイルドならチェーン内最大枚数の実ランク)にのみ加算される(複数ランクへの二重カウントを避ける)。
- **基礎点(単価)**: `params.scoring.pairBonusUnit`(組数を乗算)
- **判定関数**: `computePairCount(cardsBefore, playedCard)`(`patterns.ts`内のプライベート関数)、`evaluateChainBonus`内で過去の各時点の`pairCount`の最大値(`maxPairCountBefore`)と比較してマイルストーン更新を検出する。

### 10. `alternating`(交互)

- **ラベル**: `label: '交互'`
- **判定ロジック(自然文)**: チェーンの実カード(ワイルド除く)が`alternatingMinLen`(既定4)枚以上、かつ隣接するカード同士の色が常に異なる(赤黒交互)場合に成立する。「紅蓮」「漆黒」等で拡張された色同士が共通性を持つ場合は「同色」とみなされ不成立になる(`suit`/`color`とは逆方向の影響)。
- **基礎点**: `params.scoring.alternatingBonus`
- **判定関数**: `analyzeAlternatingColor(chain, items, minLen)`(`patterns.ts`)

---

# 第2部: スプレッド(Spread)全10種

- 型定義(正本): `types.ts`の`SpreadId`(10件)、各スプレッドの設定項目の型は`SpreadConfig`インターフェース(`types.ts`)
- 実データ: `shidasu.config.json`の`spreads`セクション(10件)
- 適用ロジック: `engine.ts`の`beginRun`(ラン開始時の初期化処理、デッキ変換チェーン)、`waveTarget`(目標スコアへの倍率適用)、`startWave`(月スプレッドの裏向き配布のみ、行数自体は`extraTableauRows`経由で反映)
- 設計時の検討メモ: `docs/shidasu/shidasu-spread-candidates.md`(現状実装と完全一致、差異なし。以下で個別に言及)

件数は`SpreadId`ユニオン型10件・`shidasu.config.json`の`spreads`セクション10件で完全一致を確認済み。

## `SpreadConfig`の全フィールド(共通仕様)

`types.ts`のコメントより:

| フィールド | 型 | 既定値 | 意味 |
|---|---|---|---|
| `name` | string | - | 表示名 |
| `desc` | string | - | 説明文 |
| `initialExtraTableauRows` | number | 0 | ウェーブ開始時の配布行数への初期オフセット |
| `deckMultiplier` | number | 1 | 初期デッキ生成時、標準デッキ(52枚)を何組連結するか |
| `tableauRowMultiplier` | number | 1 | 場札の配布行数への倍率。`params.layout.rows × tableauRowMultiplier − params.layout.rows`を`initialExtraTableauRows`に加算する形で反映(基準行数変更に自動追従) |
| `targetScoreMultiplier` | number | 1 | 目標スコア(waveTarget)への倍率 |
| `initialOracleLevel` | number | 1 | 神託の初期レベル。ラン開始時、全10役一律にこの値で`oracleLevels`を初期化する |
| `bannedShopKinds` | `ShopSlotKind[]` | `[]` | ショップのバラ売り枠・福袋カタログの両方から除外する種別 |
| `initialCurrencyBonus` | number | 0 | 初期所持金(`currency.initialAmount`)へのオフセット |
| `initialItemCapacityBonus` | number | 0 | 護符の所持上限(`itemMaxCapacity`)へのオフセット |
| `excludedRanks` | `Rank[]` | `[]` | 初期デッキ生成時に除外するランクの一覧 |
| `unifyBlackRedSuits` | boolean | false | 初期デッキ生成時、黒スート(♠♣)・赤スート(♥♦)をそれぞれ一方へランダム統一するか(統一先はラン開始のたびランダム決定) |
| `randomizeDeck` | boolean | false | 初期デッキ52枚それぞれのsuit・rankを独立にランダム抽選するか(trueなら`deckMultiplier`の複製結果を上書き、52枚固定生成) |
| `randomizeWildPerSuit` | boolean | false | 初期デッキ生成時、4スートそれぞれから1枚ずつランダムにワイルド変換するか(対象候補0枚のスートはスキップ) |

`beginRun`(`engine.ts`)でのデッキ変換チェーンの適用順序: `baseDeckComposition`(`deckMultiplier`由来) → `deckCompositionAfterRandomize`(`randomizeDeck`由来、trueなら上書き) → `deckCompositionAfterExclusion`(`excludedRanks`由来) → `deckCompositionAfterUnify`(`unifyBlackRedSuits`由来) → `deckComposition`(`randomizeWildPerSuit`由来)。

以下、`SpreadId`の宣言順(`types.ts`)に全10件を記載する。

---

### 1. `fool`(愚者)

- **desc**: 「特殊ルールなし」
- **設定値**: 全フィールドが既定値(`initialExtraTableauRows:0`, `deckMultiplier:1`, `tableauRowMultiplier:1`, `targetScoreMultiplier:1`, `initialOracleLevel:1`, `bannedShopKinds:[]`, `initialCurrencyBonus:0`, `initialItemCapacityBonus:0`, `excludedRanks:[]`, `unifyBlackRedSuits:false`, `randomizeDeck:false`, `randomizeWildPerSuit:false`)
- **効果(自然文)**: 特殊ルールなしの基準スプレッド。他スプレッド設計時の比較基準として維持される。

### 2. `moon`(月)

- **desc**: 「場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。」
- **設定値**: `initialExtraTableauRows: 1`(他は既定値)
- **効果(自然文)**: 毎ウェーブ、場札の配布行数が基準(`params.layout.rows`、既定5)より1行多い状態(計6行)で始まる。加えて、`engine.ts`の`startWave`関数内に**このスプレッドのみの専用分岐**が直接書かれている(`spreadId === 'moon'`の一箇所のみ、`SpreadConfig`の汎用フィールドでは表現できない特殊処理): 配布直後の各列について、奥側(列の先頭側、`floor(rows/2)`枚。`rows`は`extraTableauRows`込みの実配布行数)を`faceUp: false`(裏向き)に上書きする。表側(末尾側、プレイヤーが操作できる手前側)は表向きのまま。表示側(`PlayArea.svelte`)は列の末尾かどうかで裏向き表示を都度判定するため、この裏向きの行が操作可能な一番手前になることはない(取り切るまで裏向きのカードは見えない)。
- **注記(types.tsコメントとの食い違い)**: `types.ts`のコメント(L27付近)には「moon(月)=場札が常に1行少ない状態で始まる」と記載されているが、実データ(`shidasu.config.json`の`initialExtraTableauRows: 1`)およびロジック(`beginRun`が`initialExtraTableauRows`をそのまま加算)を確認した結果、実際の挙動は「1行**多い**」が正しい。`docs/shidasu/shidasu-spread-candidates.md`の記述(「場札が常に1行多い状態」)は実装と一致しており、`types.ts`側のコメントが古い誤記と判断される。本カタログは実装(config値)を正としている。

### 3. `pope`(教皇)

- **desc**: 「神託の初期レベルが5になるが、ショップで神託が販売されない」
- **設定値**: `initialOracleLevel: 5`, `bannedShopKinds: ["oracle"]`(他は既定値)
- **効果(自然文)**: ラン開始時、10役全ての神託レベル(`oracleLevels`)が一律5からスタートする(`oracleLevelsWithUniformValue`)。代わりに、ショップのバラ売り枠・福袋カタログの両方から`kind: 'oracle'`(神託)が除外され、以後のショップ訪問で神託を購入できない。

### 4. `empress`(女帝)

- **desc**: 「初期所持金が10多い状態で始まる」
- **設定値**: `initialCurrencyBonus: 10`(他は既定値)
- **効果(自然文)**: ラン開始時の所持通貨(星片)が`params.currency.initialAmount`(既定5)+10=15からスタートする。

### 5. `magician`(魔術師)

- **desc**: 「護符の所持スロットが1多いが、場札は1行少ない状態で始まる」
- **設定値**: `initialItemCapacityBonus: 1`, `initialExtraTableauRows: -1`(他は既定値)
- **効果(自然文)**: 護符の所持上限(`itemMaxCapacity`)が基準値+1になる一方、毎ウェーブの場札配布行数が基準より1行少ない(既定4行)状態で始まる。

### 6. `justice`(正義)

- **desc**: 「初期デッキから絵札(J・Q・K)が除外された状態で始まる」
- **設定値**: `excludedRanks: [11, 12, 13]`(他は既定値)
- **効果(自然文)**: ラン開始時の初期デッキ生成時、ランク11(J)・12(Q)・13(K)に該当するカードが全て`removed: true`(デッキから永久除外)としてマークされた状態で始まる(配列から削除はしない)。

### 7. `lovers`(恋人)

- **desc**: 「初期デッキの黒スート(♠♣)・赤スート(♥♦)が、それぞれランダムにどちらか一方へ統一された状態で始まる」
- **設定値**: `unifyBlackRedSuits: true`(他は既定値)
- **効果(自然文)**: ラン開始時、初期デッキの♠・♣のカードがランダムにどちらか一方のスートへ、♥・♦のカードもランダムにどちらか一方のスートへ、それぞれ統一される(`unifyBlackRedSuits`ヘルパー、`deck.ts`)。統一先はラン開始のたびにランダムに再決定される。

### 8. `emperor`(皇帝)

- **desc**: 「初期デッキの枚数・場札の配布行数・目標スコアが全て2倍になるが、護符の所持スロットが1減った状態で始まる」
- **設定値**: `deckMultiplier: 2`, `tableauRowMultiplier: 2`, `targetScoreMultiplier: 2`, `initialItemCapacityBonus: -1`(他は既定値)
- **効果(自然文)**: 初期デッキが標準52枚の2組連結(104枚)になり、場札の配布行数が基準の2倍(既定10行)、Waveの目標スコア(`waveTarget`)も2倍になる。代わりに護符の所持上限が基準値-1になる。

### 9. `wheelOfFortune`(運命の輪)

- **desc**: 「初期デッキ52枚それぞれのランク・スートが完全ランダムに再抽選された状態で始まる」
- **設定値**: `randomizeDeck: true`(他は既定値)
- **効果(自然文)**: ラン開始時、初期デッキ52枚それぞれのsuit・rankが独立にランダム抽選される(`randomizedDeckComposition`、`deck.ts`)。`randomizeDeck: true`は`deckMultiplier`による複製結果を上書きするため、52枚固定生成になる。

### 10. `strength`(力)

- **desc**: 「初期デッキの各スート(♠♥♦♣)から1枚ずつランダムに選ばれたカードがワイルドに変換された状態で始まる」
- **設定値**: `randomizeWildPerSuit: true`(他は既定値)
- **効果(自然文)**: ラン開始時、初期デッキの4スート(♠♥♦♣)それぞれから、ワイルドでも除外済みでもないカードを1枚ずつランダムに選び、ワイルドへ変換する(`convertOneCardPerSuitToWild`、`engine.ts`、護符「豊穣」の単一ランダム変換のスート版)。対象候補が0枚のスートはスキップする。結果として最大4枚がワイルド化された状態で始まる。

---

## 補足: `shidasu-spread-candidates.md`との差異確認

設計検討メモ(`docs/shidasu/shidasu-spread-candidates.md`)の「現状10種類が実装済み」表と、実コード(`shidasu.config.json`の`spreads`セクション、`engine.ts`の`beginRun`/`startWave`)を突き合わせた結果、**内容面での差異は無い**(全10スプレッドの効果説明・パラメータ値が一致)。

ただし、`types.ts`の`SpreadId`宣言直前のコメント(L27)にある`moon`の説明文「場札が常に1行少ない状態で始まる」は、実装(`initialExtraTableauRows: 1`=1行多い)および設計メモ(「1行多い」)の両方と矛盾しており、コードコメント側の誤記と判断される(上記「2. `moon`」の注記を参照)。移植時はコメントではなく実データ・実装ロジックを正とすること。
