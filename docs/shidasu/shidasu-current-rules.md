# 星詠みソリティア -Shidasu- 現行仕様書

`src/lib/game/shidasu/{engine,params,types,deck,items,rites,revelations,oracles,shop,patterns}.ts`および`shidasu.config.json`の実装内容を元にした、現時点(2026-08-06時点)のゲームルール仕様書。護符・アイテムのバランス検討など、今後の設計作業の土台として参照する。

数値は実行時に読み込まれる`shidasu.config.json`(`loadParams()`が返す実体)を正とする。`params.ts`の`DEFAULT_PARAMS`はテスト・管理画面のフォールバック用の別値で、`shidasu.config.json`と完全には一致しない箇所がある(例: `stairMinLen`・`columnSweepBonus`・アイテム価格など)。数値を参照する際はconfig.json側を優先すること。

## 1. 概要

トランプ1組(52枚、ジョーカーなし)を使うソリティア風のスコアアタックゲーム。場札(tableau)の各列の一番手前のカードを、基準カード(foundation)とランクが±1(またはK⇔Aループ)であれば取れる。取ったカードが新しい基準カードになる。連鎖(コンボ)を繋いでスコアを稼ぎ、ウェーブごとの目標スコアを超えればクリア。

護符(①Talisman)・秘儀(②Rite)・天啓(③Revelation)・神託(④Oracle)の4種類のアイテムを、ウェーブクリア時の選択やショップでの購入を通じて集め、スコア計算・場札・デッキ構成を強化していく。

## 2. 進行構造(Run > Stage > Wave)と「星」システム

- **Run(1周)**: `flow.stagesPerRun`(既定**8**)ステージ×各`flow.wavesPerStage`(既定**3**)ウェーブ=**計24ウェーブ**を順にクリアしていく。最終ステージの最終ウェーブ(ボスWave)クリア時のみ`continueChoice`(続行確認)を経由し、続行選択でショップへ、終了選択で`allClear`。
- **Wave(1回のプレイ)**: 山を1組配り直して、目標スコアに届くか、場札を全消しするか、山札が尽きて手詰まりになるまで続く1回のプレイ単位。目標未達の場合、猶予や残機は無く即座に`gameOver`。

### フェーズ遷移(`RunPhase`)

`title`(タイトル)→`playing`(プレイ中)→(ウェーブ終了)→`shop`(ショップ、通常のウェーブクリア後)/`itemSelect`・`riteSelect`・`revelationSelect`・`oracleSelect`(各アイテムの選択画面)/`continueChoice`(最終ステージのボスWaveクリア時のみ)/`allClear`(全クリア)/`gameOver`(目標未達)。

### 目標スコア

`waveTarget()` = `floor(stageTargetBase(2000) × stageTargetMultiplier(1.8)^stageIndex × その回の星のtargetMultiplier)`。ステージが進むほど目標倍率(1.8倍/ステージ)が指数的に上昇する。

### 「星」(`Star`)システム

各ウェーブには、そのウェーブ枠(`waveSlot`: 1/2/3)ごとに用意された候補群から1つ抽選された「星」が割り当てられる。ステージ突入時に3ウェーブ分がまとめて確定する(`rollStageStars`)。

| waveSlot | 種類 | 目標倍率 | 報酬 | 制限・妨害 |
|---|---|---|---|---|
| 1 | 普通の衛星 | ×1 | 3 | なし |
| 2 | 少し大きな衛星 | ×1.5 | 4 | なし |
| 3 | 6種類(いずれか1つ抽選) | ×2 | 5 | 後述 |

waveSlot3の星は必ず何らかの制限・妨害を伴う。制限は2系統に分かれる:

- **取得可否そのものを制限**(`StageModifier`経由): noLoop(A⇔Kループ禁止)/faceLock(絵札はコンボ2以上でのみ取得可)
- **取得はできるが得点をロック**(`BossScoreLock`経由): lowCombo(最大到達コンボ2以下で無得点)/oddCombo(奇数コンボで無得点)/suit(抽選された特定スートを取ると無得点)/face(絵札を取ると無得点)

waveSlot3の星はショップ画面で通貨`flow.rerollCost`(既定**30**)を消費してリロールできる(直前と異なる星が保証される)。

### spreadId(展開)

`fool`(愚者、特殊ルールなし)と`moon`(月、`initialExtraTableauRows: -1`で場札が常に1行少ない状態で開始)の2種類。

## 3. 場札・山札の初期配置

- 場札(tableau): `layout.cols`(既定**7**)列×実配布行数を裏向き山から配る。実配布行数は`layout.rows`(既定**5**)+暗雲の護符所持時`+r`+虚(天啓)使用済みなら`+n`(累積、`extraTableauRows`としてラン全体で永続)。
- 基準カード(foundation): 場札配布後の山から1枚。
- 山札(stock): 残り枚数(標準52枚から場札配布分・基準カード分を引いた枚数)。
- 標準デッキ(`standardDeckComposition`)は常に**ワイルドカードを含まない52枚**。ワイルドは永劫・豊穣等の護符や虚(天啓)でのみ供給される(6.7節参照)。

## 4. スコアリング詳細

### 4.1 獲得点(`gained`)の計算順序

`playCard`内で、1枚プレイするごとに以下の順序で獲得点が確定する:

1. `base = scoring.basePoint`(既定**100**)
2. 水鏡(鋼鉄)による前回役ボーナスの遅延複製があれば加算
3. `evaluateChainBonus`によるチェーンボーナス(4.2節)を加算
4. 列一掃ボーナス(4.3節、成立時)を加算
5. 所持護符を**並び順(左→右、プレイヤーがドラッグ&ドロップで変更可能)に走査**し、加算・倍算系の護符効果を逐次適用(`applyItemEffects`)
6. 果断(discretion)の永続加算値`discretionN`、流星(shootingStar)の永続加算値`shootingStarN`を加算
7. 最終乗算チェーン(所持順に依らず固定順で適用): コンボ倍率 × マンナズ(秘儀) × 献身(dedicationX) × 勤勉(diligenceX) × 加護(divineProtectionX) × 星霜(frostX) × 残響(echoX) × 慢心(arroganceX、山札0枚時のみ)
8. 最後に`Math.floor`で切り捨て
9. 星の得点ロック(`BossScoreLock`)が成立している場合は、それまでの内訳を破棄し獲得点0にする

コンボ倍率は`1 + effectiveCombo × comboMultiplierStep(0.1)`。`effectiveCombo`は実際のコンボ数(`wave.combo`)に基礎コンボ数(`baseComboCount`、祝福・剛毅等で永続的に加算される)を足した計算専用値で、さらに庇護(下限を保証)・大地(固定加算)を所持順に適用したもの。

**永続累積型の護符**(献身・勤勉・加護・果断・星霜・残響・流星)は、いずれも「対象条件を満たすたびにラン全体で永続する専用カウンタを加算し、その値を以後のgained計算に反映する」という共通パターンで、`playCard`/`drawStock`/秘儀・天啓・神託使用処理に直書きされている(汎用の護符効果テーブル外)。

### 4.2 チェーンボーナス(`evaluateChainBonus`)

チェーン(現在のコンボで取得/めくった順のカード履歴)を元に、**パターンボーナス**(チェーン全体が条件を保ち続けている間、毎回加点。一度崩れるとコンボリセットまで二度と成立しない)と**役ボーナス**(局所条件のみを見るため、繰り返し成立しうる)に分けて判定・合算する。

| ボーナス名 | 分類 | 条件概要 | 加点(config.json既定値) |
|---|---|---|---|
| 同スート | パターン | チェーンが最小枚数(`suitColorMinLen`既定3)以上かつ全て同スート | +100(suitBonus) |
| 同色 | パターン | 同スート不成立、かつ最小枚数以上かつ全て同色 | +50(colorBonus) |
| 交互 | パターン | 実カードが`alternatingMinLen`(既定4)枚以上、赤黒が隣接して常に異なる | +80(alternatingBonus) |
| 階段 | パターン | 同方向(+1固定、ループ跨ぎ含む)に最小連続枚数(`stairMinLen`既定3)以上連続 | +150(stairBonus) |
| フラッシュ | 役 | 直近4枚で♠♥♦♣が全て揃う | +300(flushBonus) |
| ロイヤルセット | 役 | 直近3枚でJ・Q・Kが揃う | +400(royalSetBonus) |
| 同ランク | 役 | チェーン内の同ランク枚数(既出分)×固定値 | 100×既出枚数(sameRankBonusUnit) |
| ペア | 役 | チェーン内で2枚以上あるランクの組が2組以上成立、組数倍 | 50×組数(pairBonusUnit) |
| コンプリートラン | 役 | このプレイで初めて13ランクが出揃った瞬間 | +1000(completeRunBonus) |
| コンプリートラン(同スート) | 役 | コンプリートラン成立時、実カードが全て同じスートなら追加 | +1000(completeRunSuitBonus) |

ワイルドはいずれの判定でも「その判定にとって都合の良いランク・スート」として独立に解釈され、母数(枚数)にも含まれる(判定間で値を一致させる必要はない)。

各役ボーナスは、明星(所持護符)・ソウィロ(秘儀)による`roleBonusMultiplier`、および神託によるレベル(`oracleLevel`、成立するたびレベル+1で恒久強化)の倍率がかかる。パターンボーナスは神託レベルのみがかかる。

### 4.3 列一掃ボーナス(役ボーナスの一種)

場札の列を最後の1枚まで取り、その列が空になった時に加算される。「連続コンボ開始時点で全実配布行数残っていた」場合のみ成立(寛容の護符所持時は「残り`実配布行数-m`枚以下」に緩和)。加点額は`columnSweepBonus(既定500) × 同じコンボ内で今まで一掃した列数`(列数倍で増加)。

### 4.4 全消しボーナス

場札が0枚になった瞬間、ウェーブは即座に終了(`endReason: 'fullClear'`)し、`clearBonus(既定2000) + 残り山札枚数 × clearBonusPerStock(既定50)`がコンボ倍率を通さず加算される(忍耐・浄化・節制の護符のみこのチャンネルに介入できる)。

### 4.5 目標スコア到達

全消し前にプレイ後のスコアが目標(`target`)以上になった時点で、そのウェーブは即座に終了(`endReason: 'target'`)する。

### 4.6 山札めくり(`drawStock`)

山札からめくると、パターンボーナス(同スート/同色/階段/交互のいずれか)が継続していれば、コンボを維持したままチェーンに追加される(素朴(naive)所持時のみ通常プレイ同様に得点計算、それ以外は無得点で継続)。誠実(sincerity)所持時は、この継続のたびに`wave.combo`へ直接加算される(素朴の有無に関わらず適用)。継続しなければコンボ・チェーンがリセットされ、めくった札1枚だけの新しいチェーンとして再スタートする(エイワズ(秘儀)所持時、残り回数があればリセットを無効化できる)。

### 4.7 ワイルドカードについて

ワイルドカードは、その時点で必要とされるランク・スートそのものの代役となるだけで、それ以外の特別ルールは無い。標準デッキにはワイルドが含まれず、永劫・豊穣・静寂などの護符や虚(天啓)によって供給される。

## 5. 場札が取れる条件(`isPlayable`)

列の一番手前のカードは、以下を満たせば取れる:

1. faceLock制約中(星の制限による)、かつそのカードが絵札(J/Q/K)で、かつ現在のコンボが2未満の場合 → **取れない**(最優先)
2. カード自身がワイルド、または現在の基準カードがワイルドの場合 → 取れる
3. ランク差が1、またはランク差が12(A⇔Kの境界、noLoop制約でない場合) → 取れる
4. エワズ(秘儀)所持中は、ランク差2(ループ跨ぎ含む)も追加で取れる
5. 誓約・契り(護符)所持時は、チェーン最新の実カードと色/スートが一致しないと取れない
6. 上記いずれにも当てはまらなければ取れない

## 6. ステージ制約・手詰まり判定

`StageModifier`は`none`(制約なし)・`noLoop`(A⇔Kループ禁止)・`faceLock`(絵札はコンボ2以上でのみ取得可)の3種類。いずれも星の制限内容から`stageModifierFor`で導出される(5節参照)。

手詰まり判定(`isStuck`): 場札が1枚以上残っており、山札が0枚で、かつ取れる列が1つもない場合に成立し、`endReason: 'stuck'`でウェーブ終了(ダガズ(秘儀)所持中かつ捨て札があれば手詰まりにならない)。UI側では操作後600msの無操作を検知して判定する。

## 7. アイテムシステム

4種類のアイテムがあり、いずれもウェーブクリア時の選択画面、またはショップでの購入を通じて入手する。

### 7.1 護符(①Talisman)

- 自由命名。現在**99種**実装済み(`ITEM_POOL`)。抽選はレアリティを考慮しない完全均等抽選。
- 所持上限: `items.maxItems`(既定**5**)。上限到達時は入れ替え選択フローに切り替わる。
- 加算・倍算型の護符が複数所持されている場合、適用順は所持順(ドラッグ&ドロップで並べ替え可能、常設バッジ表示にも反映)に固定される。
- 効果の詳細な一覧は`docs/shidasu/done/shidasu-gofu-candidates.md`(実装済み)を参照。

### 7.2 秘儀(②Rite)

- モチーフは北欧ルーン文字(エルダー・フサルク)。全**24種**実装済み(`RITE_POOL`)。
- ウェーブを跨いで永続所持(所持上限**3**)。プレイ中に能動的に使用する消費アイテムで、`useRite`で1個消費して即時効果を発動する。一部(ゲボ・フェフ、ティワズ・ラグズ)は使用条件(山札・捨て札の枚数、チェーン長)がある。
- 詳細は`docs/shidasu/done/shidasu-higi-candidates.md`(実装済み)を参照。

### 7.3 天啓(③Revelation)

- モチーフは二十八宿。全28宿中**12宿**が効果実装済み(`REVELATION_POOL`)。残り16宿は`mansions.ts`に見た目候補として温存されている(未実装)。
- いつでも使用可能で、場札・デッキ構成の両方に永続的な効果を発揮する消費アイテム。所持上限は神託と合算で**2**。
- 未実装分の効果候補は`docs/shidasu/shidasu-revelation-candidates.md`を参照。

### 7.4 神託(④Oracle)

- モチーフは六十四卦。10役(コンプリートラン・ロイヤルセット・フラッシュ・階段・同色・同スート・列一掃・同ランク・ペア・交互)に対応する10卦を`ORACLE_POOL`に実装済み。
- 効果は対応する役のレベルを永続+1(`RunState.oracleLevels`)し、以後その役のボーナスに乗算で効く。所持は天啓と合算枠を共有(上限2)。

## 8. 通貨・ショップ

- 通貨「星片」(☆): 初期所持`currency.initialAmount`(既定**5**)。ウェーブクリアごとに`currency.waveClearAmount`(既定**5**) + そのウェーブの星の報酬(3〜5)を獲得。
- ショップ(`rollShop`): バラ売り3枠(護符・秘儀・天啓・神託から均等抽選、護符は所持中・同ショップ内重複を除外)+福袋2枠(11パターンの複数枚セットから重複無しで2つ抽選)。
- 価格(既定): 護符 C6/U8/R10(売却半額)、秘儀5(売却2)、天啓5(売却2)、神託3(売却1)。福袋は種類・パターンごとに個別価格。

## 9. 現在のデフォルト数値一覧(`shidasu.config.json`)

| パラメータ | 値 |
|---|---|
| layout.cols / rows | 7 / 5 |
| scoring.basePoint | 100 |
| scoring.suitBonus | 100 |
| scoring.colorBonus | 50 |
| scoring.suitColorMinLen | 3 |
| scoring.stairBonus | 150 |
| scoring.stairMinLen | 3 |
| scoring.alternatingBonus | 80 |
| scoring.alternatingMinLen | 4 |
| scoring.flushBonus | 300 |
| scoring.royalSetBonus | 400 |
| scoring.sameRankBonusUnit | 100 |
| scoring.pairBonusUnit | 50 |
| scoring.completeRunBonus | 1000 |
| scoring.completeRunSuitBonus | 1000 |
| scoring.columnSweepBonus | 500 |
| scoring.clearBonus | 2000 |
| scoring.clearBonusPerStock | 50 |
| scoring.comboMultiplierStep | 0.1 |
| items.maxItems | 5 |
| flow.wavesPerStage | 3 |
| flow.stagesPerRun | 8 |
| flow.stageTargetBase | 2000 |
| flow.stageTargetMultiplier | 1.8 |
| flow.rerollCost | 30 |
| flow.clearDelayMs | 450(目標達成時の演出待ち。全消し・手詰まりは即遷移) |
| currency.initialAmount | 5 |
| currency.waveClearAmount | 5 |

なお`ui.*`(`comboTierThresholds`・`chainCardOffsetX`等)は表示・演出専用のパラメータで、ゲームルール・スコア計算には一切影響しない。
