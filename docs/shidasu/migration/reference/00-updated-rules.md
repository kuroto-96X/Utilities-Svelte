# 星詠みソリティア -Shidasu- 現行仕様書(移植用リファレンス・2026-08-29更新版)

Godot移植プロジェクトのフェーズ1成果物。`src/lib/game/shidasu/{engine,types,params,deck,items,rites,revelations,oracles,relics,shop,sabotage,patterns}.ts` および `src/lib/game/shidasu/shidasu.config.json` の実装内容を直接突き合わせて作成した、現時点の正確なゲームルール仕様書。**数値・件数は実行時に読み込まれる`shidasu.config.json`を正とする。** `params.ts`の`DEFAULT_PARAMS`はテスト・管理画面のフォールバック用の別値であり、config.jsonと完全には一致しない。

既存の`docs/shidasu/shidasu-current-rules.md`(2026-08-06版)は実装より古く、スプレッドを2種(fool/moon)としか記載していない・護符件数が古い等の問題があるため、本ファイルが最新版として全面的に書き直したものである。旧ファイルは変更していない(参照専用として残す)。

## 0. 実装コンテンツの正確な件数(2026-08-29時点)

| カテゴリ | 件数 | 根拠 |
|---|---|---|
| スプレッド(`SpreadId`) | **10種** | `types.ts`のUnion、`shidasu.config.json`の`spreads`キー数 |
| 護符(`ItemId`、`ITEM_POOL`) | **133種** | `types.ts`のUnion実カウント、`shidasu.config.json`の`talismans`キー数(いずれも133で一致) |
| 秘儀(`RiteId`、`RITE_POOL`) | **24種** | 同上、`rites`キー数24で一致 |
| 天啓(`RevelationId`、`REVELATION_POOL`) | **28種** | 同上、`revelations`キー数28で一致 |
| 神託(`ORACLE_POOL`、役=`RoleName`) | **10種** | `oracles`キー数10。役・パターン10種に1対1対応 |
| レリック(`RelicId`、`RELIC_POOL`) | **10種** | 同上、`relics`キー数10で一致(第1弾13候補のうちWave終了時報酬系3種は護符へ移行済み) |
| 妨害行動(`SabotageActionId`、`SABOTAGE_POOL`) | **32種** | 同上、`sabotageActions`キー数32で一致 |
| 星(`Star`、`params.stars`) | **8件**(waveSlot1:1件、waveSlot2:1件、waveSlot3:6件) | `shidasu.config.json`の`stars`配列 |
| トランプセット福袋ジャンル(`CardSetGenreId`) | **23種** | `types.ts`のUnion実カウント |
| 福袋カタログ(`packCatalog`) | **32件** | `shidasu.config.json`の`shop.packCatalog`配列長 |

計画時点(移行プロジェクト起点)では護符99種とされていたが、実装が進み**133種**まで増加している。この文書ではこの実測値を正とする。

## 1. 概要

トランプ1組(52枚、ジョーカーなし)を使うソリティア風のスコアアタックゲーム。場札(tableau)の各列の一番手前のカードを、基準カード(foundation)とランクが±1(またはK⇔Aループ)であれば取れる。取ったカードが新しい基準カードになる。連鎖(コンボ)を繋いでスコアを稼ぎ、ウェーブごとの目標スコアを超えればクリア。

護符(①Talisman)・秘儀(②Rite)・天啓(③Revelation)・神託(④Oracle)の4種類の消費/所持アイテムと、ショップ関連の恒久バフである⑤レリックを、ウェーブクリア時の選択やショップでの購入を通じて集め、スコア計算・場札・デッキ構成・ショップ構成を強化していく。

## 2. 進行構造(Run > Stage > Wave)

- **Run(1周)**: `flow.stagesPerRun`(既定**8**)ステージ×各`flow.wavesPerStage`(既定**3**)ウェーブ=**計24ウェーブ**を順にクリアしていく。最終ステージの最終ウェーブ(ボスWave、`waveIndex === wavesPerStage - 1`)クリア時のみ`continueChoice`(続行確認)を経由し、続行選択でショップへ、終了選択で`allClear`。
- **Wave(1回のプレイ)**: 山を1組配り直して、目標スコアに届くか、場札を全消しするか、山札が尽きて手詰まりになるまで続く1回のプレイ単位。目標未達の場合、猶予や残機は無く即座に`gameOver`。

### フェーズ遷移(`RunPhase`)

`title`(タイトル、スプレッド選択)→`beginRun`実行直後は**即座に`shop`フェーズへ入る**(Wave1開始前にショップに立ち寄る初期ショップが必ず存在する)→`finishShop`で`playing`(プレイ中)→(ウェーブ終了)→`shop`(通常のウェーブクリア後)/`itemSelect`・`riteSelect`・`revelationSelect`・`oracleSelect`・`cardSetSelect`(各アイテム・福袋の選択画面)/`continueChoice`(最終ステージのボスWaveクリア時のみ)/`allClear`(全クリア)/`gameOver`(目標未達)。

### 目標スコア

```
waveTarget(stageIndex, waveIndex)
  = floor(flow.stageTargetBase(2000) × flow.stageTargetMultiplier(1.8)^stageIndex
          × star.targetMultiplier × spreads[spreadId].targetScoreMultiplier)
```

ステージが進むほど目標倍率(1.8倍/ステージ)が指数的に上昇する。`spreads[spreadId].targetScoreMultiplier`はスプレッド由来の倍率(既定1、`emperor`のみ2)で、旧仕様には存在しなかった乗算項。

## 3. 「星」(`Star`)システム

各ウェーブには、そのウェーブ枠(`waveSlot`: 1/2/3)ごとに用意された候補群から1つ抽選された「星」が割り当てられる。新しいステージに入る直前(`waveIndex`が0に戻るタイミング)に`rollStageStars`で waveSlot 1・2・3 それぞれから1つずつ、3Wave分がまとめて確定する(`RunState.stageStars`、同一ステージ内は不変)。

`params.stars`(config.json)は8件のフラットな配列で、waveSlotごとに以下のように分布する。

| waveSlot | 名称(id) | 目標倍率 | 報酬 | restrictionKind | sabotageKind |
|---|---|---|---|---|---|
| 1 | 普通の衛星(ordinary-moon) | ×1 | 3 | none | none |
| 2 | 少し大きな衛星(slightly-bigger-moon) | ×1.5 | 4 | none | none |
| 3 | 循環の閉じた荒廃惑星(closed-loop-planet) | ×2 | 5 | noLoop | all |
| 3 | 高貴なる封印の惑星(sealed-noble-planet) | ×2 | 5 | faceLock | all |
| 3 | 弱き者を拒む峻厳な惑星(harsh-planet) | ×2 | 5 | lowCombo(maxCombo=2) | all |
| 3 | 奇数を忌む歪んだ惑星(twisted-odd-planet) | ×2 | 5 | oddCombo | all |
| 3 | 排斥の色殺す惑星(exiling-color-planet) | ×2 | 5 | suit(抽選) | all |
| 3 | 王侯を打ち滅ぼす惑星(regicide-planet) | ×2 | 5 | face | all |

waveSlot3の星は必ずいずれかの`restrictionKind`と`sabotageKind: 'all'`(妨害行動、6節参照)を伴う。制限は2系統に分かれる:

- **取得可否そのものを制限**(`StageModifier`経由、`stageModifierFor`で導出): `noLoop`(A⇔Kループ禁止)/`faceLock`(絵札はコンボ2以上でのみ取得可)
- **取得はできるが得点をロック**(`BossScoreLock`経由、`bossScoreLockFor`で導出): `lowCombo`(最大到達コンボ2以下で無得点)/`oddCombo`(奇数コンボで無得点)/`suit`(抽選された特定スートを取ると無得点。抽選候補は♠♥♦♣の4種、星確定のたび`rollStarForSlot`内で決定)/`face`(絵札を取ると無得点)

waveSlot3の星は、ボスWave未クリアかつ通貨`flow.rerollCost`(既定**30**)以上所持していれば`rerollStageStars`でリロールできる(`rollStarForSlot`が直前と異なる`id`の星を優先して抽選するため、候補が2件以上あれば必ず変化する)。

## 4. スプレッド(Spread)— 10種

ラン開始時(タイトル画面)にプレイヤーが選ぶ固有ルールセット。大アルカナから命名され、`RunState.spreadId`としてラン全体を通して不変。`SpreadConfig`(`shidasu.config.json`の`spreads`キー)の各フィールドは以下の意味を持つ。

| フィールド | 意味 |
|---|---|
| `initialExtraTableauRows` | ウェーブ開始時の配布行数への初期オフセット(`beginRun`内で`tableauRowMultiplier`由来の加算分と合算され`RunState.extraTableauRows`になる) |
| `deckMultiplier` | 初期デッキ生成時、標準デッキ(52枚)を何組連結するか(既定1)。2なら104枚になる(`multipliedDeckComposition`) |
| `tableauRowMultiplier` | 場札の配布行数への倍率(既定1)。`beginRun`で`params.layout.rows * tableauRowMultiplier - params.layout.rows`を`initialExtraTableauRows`に加算する形で反映 |
| `targetScoreMultiplier` | 目標スコア(`waveTarget`)への倍率(既定1) |
| `initialOracleLevel` | 神託の初期レベル。ラン開始時、全10役一律にこの値で`oracleLevels`を初期化する(既定1) |
| `bannedShopKinds` | ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列) |
| `initialCurrencyBonus` | 初期所持金(`currency.initialAmount`)へのオフセット(既定0) |
| `initialItemCapacityBonus` | 護符の所持上限(`itemMaxCapacity`)へのオフセット(既定0) |
| `excludedRanks` | 初期デッキ生成時に除外(`removed: true`)するランクの一覧(既定は空配列) |
| `unifyBlackRedSuits` | 黒スート(♠♣)をどちらか一方へ、赤スート(♥♦)をどちらか一方へランダムに統一するか(既定false)。統一先はラン開始のたびにランダム決定 |
| `randomizeDeck` | 初期デッキ52枚それぞれのsuit・rankを独立にランダム抽選するか(既定false)。trueの場合`deckMultiplier`の複製結果を上書きする |
| `randomizeWildPerSuit` | 4スートそれぞれから、ワイルドでも除外済みでもないカードを1枚ずつランダムに選びワイルドへ変換するか(既定false) |

`beginRun`内での適用順序: `deckMultiplier`(複製)→`randomizeDeck`(全体再抽選、trueなら複製結果を上書き)→`excludedRanks`(除外フラグ付与)→`unifyBlackRedSuits`(スート統一)→`randomizeWildPerSuit`(スート別ワイルド変換)。

### 4.1 各スプレッドの固有ルール

| id | 名称 | 固有ルール |
|---|---|---|
| `fool` | 愚者 | 特殊ルールなし(全フィールド既定値) |
| `moon` | 月 | `initialExtraTableauRows: 1`。場札が常に1行多い状態で始まる。**加えて`startWave`内で専用処理があり**、Wave開始時に配られる場札の各列のうち奥側(先頭側)`floor(実配布行数/2)`枚が`faceUp: false`(裏向き)になる(`engine.ts`の`spreadId === 'moon'`分岐)。裏向き行は操作可能な一番手前(末尾側)になることはない。※`types.ts`の型定義コメントには「場札が常に1行少ない」という誤った記述が残っているが、実装(config.json・engine.ts)はこちらが正しい |
| `pope` | 教皇 | `initialOracleLevel: 5`(神託の初期レベルが5)。`bannedShopKinds: ['oracle']`でショップに神託が並ばなくなる |
| `empress` | 女帝 | `initialCurrencyBonus: 10`。初期所持金が10多い状態(既定5+10=15)で始まる |
| `magician` | 魔術師 | `initialItemCapacityBonus: 1`(護符所持スロット+1)、`initialExtraTableauRows: -1`(場札が1行少ない)状態で始まる |
| `justice` | 正義 | `excludedRanks: [11, 12, 13]`。初期デッキから絵札(J・Q・K)が除外された状態で始まる |
| `lovers` | 恋人 | `unifyBlackRedSuits: true`。初期デッキの黒スート(♠♣)・赤スート(♥♦)がそれぞれランダムにどちらか一方へ統一される |
| `emperor` | 皇帝 | `deckMultiplier: 2`・`tableauRowMultiplier: 2`・`targetScoreMultiplier: 2`(初期デッキ枚数・場札配布行数・目標スコアが全て2倍)、`initialItemCapacityBonus: -1`(護符所持スロットが1減る) |
| `wheelOfFortune` | 運命の輪 | `randomizeDeck: true`。初期デッキ52枚それぞれのランク・スートが独立に完全ランダム再抽選される(`randomizedDeckComposition`。同じカードの重複や特定カードの欠落が起こりうる) |
| `strength` | 力 | `randomizeWildPerSuit: true`。初期デッキの4スート(♠♥♦♣)それぞれから1枚ずつランダムに選ばれたカードがワイルドに変換された状態で始まる(候補が0枚のスートはスキップ) |

## 5. 場札・山札の初期配置(`startWave`)

- 場札(tableau): `layout.cols`(既定**7**)列×実配布行数を裏向き山から配る。実配布行数 = `layout.rows`(既定**5**)+`extraTableauRows`(スプレッド由来の初期値+ラン中の累積加算値、現状は増加させる護符・天啓は存在しない)。
- 月スプレッド時のみ、配布直後に各列奥側`floor(実配布行数/2)`枚を裏向き(`faceUp: false`)にする(4.1節参照)。
- 基準カード(foundation): 場札配布後の山から1枚。
- 山札(stock): 残り枚数(標準52枚(またはスプレッド倍率適用後の枚数)から場札配布分・基準カード分を引いた枚数)。
- 標準デッキ(`standardDeckComposition`)は常に**ワイルドカードを含まない52枚**。ワイルドは永劫・豊穣・力スプレッド等でのみ供給される。
- 剛毅(護符)所持時、`floor(deckComposition総数 / n)`が基礎コンボ数(`baseComboCount`)の初期値になる。

## 6. 場札が取れる条件(`isPlayable`)

列の一番手前のカードは、以下を満たせば取れる:

1. faceLock制約中(星の制限による)、かつそのカードが絵札(J/Q/K)で、かつ現在のコンボが2未満の場合 → **取れない**(最優先、ワイルドより先に評価)
2. カード自身がワイルド、または現在の基準カードがワイルドの場合 → 取れる
3. ランク差が1、またはランク差が12(A⇔Kの境界、`noLoop`制約でない場合) → 取れる
4. エワズ(秘儀)所持中は、ランク差2(ループ跨ぎ含む、`noLoop`でなければランク差11も)も追加で取れる
5. 誓約(vow、護符)所持時は、チェーン最新の実カードと色が一致しないと取れない。契り(pact、護符)所持時は、チェーン最新の実カードとスートが一致しないと取れない(チェーンが空、または直近が実ワイルドなら制約なし)
6. 上記いずれにも当てはまらなければ取れない

アルギズ(秘儀)発動中は、列の一番上のカードだけでなく列内の全カードがプレイ対象になる(判定基準自体=`isPlayable`の内容は変わらない)。

## 7. スコアリング詳細

### 7.1 獲得点(`gained`)の計算順序(`playCard`内)

1. `base = scoring.basePoint`(既定**100**)
2. 水鏡(鋼鉄)による前回役ボーナスの遅延複製があれば加算
3. `evaluateChainBonus`によるチェーンボーナス(7.2節)を加算
4. 列一掃ボーナス(7.3節、成立時)を加算
5. 所持護符を**並び順(左→右、プレイヤーがドラッグ&ドロップで変更可能)に走査**し、加算・倍算系の護符効果を逐次適用(`applyItemEffects`)
6. 果断(discretion)の永続加算値`discretionN`、流星(shootingStar)の永続加算値`shootingStarN`を加算
7. このプレイで場札が0枚になった場合のみ、全消しボーナス(7.4節)を加算
8. 最終乗算チェーン(所持順に依らず固定順で適用): コンボ倍率 × マンナズ(秘儀) × 献身(dedicationX) × 勤勉(diligenceX) × 加護(divineProtectionX) × 星霜(frostX) × 残響(echoX) × 慢心(arroganceX、山札0枚時のみ)
9. 最後に`Math.floor`で切り捨て
10. 星の得点ロック(`BossScoreLock`)が成立している場合は、それまでの内訳を破棄し獲得点0にする(全消しボーナスも含めて0になる)

コンボ倍率は`1 + effectiveCombo × comboMultiplierStep(0.1)`。`effectiveCombo`は実際のコンボ数(`wave.combo`)に基礎コンボ数(`baseComboCount`、祝福・剛毅等で永続的に加算される)を足した計算専用値で、さらに庇護(下限を保証)・大地(固定加算)を所持順に適用したもの。

**永続累積型の護符**(献身・勤勉・加護・果断・星霜・残響・流星)は、いずれも「対象条件を満たすたびにラン全体で永続する専用カウンタを加算し、その値を以後のgained計算に反映する」という共通パターン。`RunState`に正本を持ち、`startWave`で`WaveState`側にコピー、`resolveWaveEnd`成功時に`RunState`へ書き戻す。

### 7.2 チェーンボーナス(`evaluateChainBonus`)

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
| 列一掃 | 役(7.3節参照) | 場札の1列を最後の1枚まで取った | 500×同コンボ内の一掃列数(columnSweepBonus) |

ワイルドはいずれの判定でも「その判定にとって都合の良いランク・スート」として独立に解釈され、母数(枚数)にも含まれる。

各役ボーナスは、明星(所持護符)・ソウィロ(秘儀)による`roleBonusMultiplier`、および神託によるレベル(`oracleLevel`、成立するたびレベル+1で恒久強化)の倍率がかかる。パターンボーナスは神託レベルのみがかかる。役・パターンは合計10種類(役6種:flush/royalSet/sameRank/completeRun/columnSweep/pair、パターン4種:suit/color/stair/alternating)で、これが神託10種にそれぞれ対応する。

### 7.3 列一掃ボーナス

場札の列を最後の1枚まで取り、その列が空になった時に加算される。「連続コンボ開始時点で全実配布行数残っていた」場合のみ成立(寛容の護符所持時は「残り`実配布行数-m`枚以下」に緩和)。加点額は`columnSweepBonus(既定500) × 同じコンボ内で今まで一掃した列数`(列数倍で増加)。

### 7.4 全消しボーナス

場札が0枚になった瞬間、ウェーブは即座に終了(`endReason: 'fullClear'`)する。`clearBonus(既定2000) + 残り山札枚数 × clearBonusPerStock(既定50)`(忍耐・浄化・節制の護符のみが加算・倍算で介入できる)は、そのプレイの獲得点(gained)計算に加算項として統合される(7.1節ステップ7)。コンボ倍率・献身・勤勉・加護・星霜・残響・慢心などの乗算、および星の得点ロックの影響を受ける。

### 7.5 目標スコア到達

全消し前にプレイ後のスコアが目標(`target`)以上になった時点で、そのウェーブは即座に終了(`endReason: 'target'`)する。

### 7.6 山札めくり(`drawStock`)

山札からめくると、パターンボーナス(同スート/同色/階段/交互のいずれか)が継続していれば、コンボを維持したままチェーンに追加される(素朴(naive)所持時のみ通常プレイ同様に得点計算、それ以外は無得点で継続)。誠実(sincerity)所持時は、この継続のたびに`wave.combo`へ直接加算される(素朴の有無に関わらず適用)。継続しなければコンボ・チェーンがリセットされ、めくった札1枚だけの新しいチェーンとして再スタートする(エイワズ(秘儀)所持時、`comboResetShieldRemaining`の残り回数があればリセットを無効化できる)。

### 7.7 ワイルドカードについて

ワイルドカードは、その時点で必要とされるランク・スートそのものの代役となるだけで、それ以外の特別ルールは無い。標準デッキにはワイルドが含まれず、永劫・豊穣・静寂・力(スプレッド)などによって供給される。

## 8. ステージ制約・手詰まり判定

`StageModifier`は`none`(制約なし)・`noLoop`(A⇔Kループ禁止)・`faceLock`(絵札はコンボ2以上でのみ取得可)の3種類。いずれも星の制限内容から`stageModifierFor`で導出される(3節参照)。

手詰まり判定(`isStuck`): 場札が1枚以上残っており、山札が0枚で、かつ取れる列が1つもない場合に成立し、`endReason: 'stuck'`でウェーブ終了(ダガズ(秘儀)所持中かつ捨て札があれば手詰まりにならない)。UI側では操作後600msの無操作を検知して判定する。

## 9. 星の妨害行動(SabotageActionId、32種)

waveSlot3の星(現行6種全て`sabotageKind: 'all'`)は、取得可否制限・得点ロックに加えて、一定ターンごとに能動的にゲーム状態を崩す「妨害行動」も持つ。Wave開始時に`SABOTAGE_POOL`(32種)から1つが抽選され(`wave.pendingSabotageId`・`wave.sabotageTurnsRemaining`)、以後「1ターンごとに残りターンを1減らし、0になったら発動して次の妨害を再抽選する(直前と同じ候補が連続する可能性もある)」というサイクルを繰り返す。ターンの定義は7.6節の山札めくりと同じで、`playCard`は常にカウントし、`drawStock`はめくった札がパターン・チェーン・コンボを継続させた場合にカウントする。効果の実発動は`RunState`層の`triggerSabotage`(`sabotageEffects.ts`の`applySabotageEffect`に委譲)が行う。

| 妨害(id) | 名称 | ターゲット | 間隔(ターン) | 効果 |
|---|---|---|---|---|
| stockPurge | 大量放出 | 山札 | 6 | 山札の上から5枚を捨て札に置く |
| columnReturn | 一列戻し | 場札 | 6 | ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する |
| chainSettle | 強制清算 | チェーン | 8 | チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする |
| comboBreather | 強制小休止 | コンボ | 5 | チェーンはそのまま、コンボ数だけ0にする |
| talismanSeal | 護符封印 | 護符 | 5 | 所持護符を1つ選び、次の妨害発動まで効果を無効化する |
| riteSeal | 秘儀封印 | 秘儀 | 5 | 所持秘儀を1つ選び、次の妨害発動まで使用を禁止する |
| revelationOracleSeal | 天啓・神託封印 | 天啓・神託 | 5 | 天啓または神託を1つ選び、次の妨害発動まで使用禁止にする |
| relicConfiscate | レリック没収 | レリック | 7 | 所持レリックを1つ選び、完全に失わせる |
| tableauCardToDiscard | 一枚没収 | 捨て札 | 4 | 場札からランダムに1枚選び捨て札に送る |
| currencyConfiscate | 通貨没収 | 資産(星片) | 6 | 所持する星片を5減らす(0未満にはしない) |
| roleSeal | 役封印 | 役ステータス | 6 | ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する |
| stockPurgeSmall | 少量放出 | 山札 | 4 | 山札の上から2枚を捨て札に置く |
| stockShuffle | 山札攪拌 | 山札 | 5 | 山札の順序をランダムに並び替える(枚数は変わらない) |
| tableauFullReturn | 総戻し | 場札 | 8 | 場札全体を山札に戻し、シャッフル後同じ配分で再配布する |
| tableauShuffle | 総入れ替え | 場札 | 6 | 場札の中身を列をまたいでランダムに再配置する(山札には触れない) |
| chainPartialDiscard | チェーン部分放棄 | チェーン | 5 | チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持) |
| chainShuffle | チェーン入れ替え | チェーン | 6 | チェーンをシャッフルし、新しい末尾を基準カードにする |
| comboReduce | コンボ削減 | コンボ | 5 | コンボ数を3減らす(0未満にはしない) |
| comboCap | コンボ頭打ち | コンボ | 6 | 発動時点のコンボ数を上限として、次の妨害発動まで増加を止める |
| talismanConfiscate | 護符没収 | 護符 | 7 | 所持護符を1つ選び、完全に失わせる |
| riteConfiscate | 秘儀没収 | 秘儀 | 6 | 所持秘儀を1つ選び、効果を発動させずに消費させる |
| riteForceActivate | 秘儀強制発動 | 秘儀 | 6 | 使用可能な秘儀を1つ選び、即座に効果を発動させて消費する(候補が無ければ不発) |
| talismanShuffle | 護符並び替え | 護符 | 5 | 所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする |
| revelationOracleConfiscate | 天啓・神託没収 | 天啓・神託 | 7 | 所持している天啓または神託からランダムに1つ選び、完全に失わせる |
| revelationOracleForceActivate | 天啓・神託強制発動 | 天啓・神託 | 6 | 使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する |
| tsukumokaRelease | 付喪化解除 | レリック | 6 | 付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す |
| discardErase | 捨て札消去 | 捨て札 | 6 | チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す |
| discardBury | 捨て札埋没 | 捨て札 | 5 | 捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す |
| rewardReduce | 報酬減少 | 資産(星片) | 8 | Waveクリア時の通貨報酬を-2する(`RunState.rewardPenalty`に累積し、ラン終了までリセットされない) |
| currencyDrain | 通貨強制消費 | 資産(星片) | 6 | 所持通貨の20%を失わせる |
| roleLevelDecay | 役減衰 | 役ステータス | 7 | ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス) |
| roleBias | 役偏重 | 役ステータス | 6 | 次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする |

封印系・並び替え系(護符・秘儀・天啓/神託・役ステータス・コンボ頭打ち)は、`WaveState.activeSeal`(判別共用体: `talisman`/`rite`/`revelationOrOracle`/`role`/`comboCap`/`talismanHidden`/`roleBias`のいずれか、または`null`)として管理され、常に最大1件しか同時に成立しない。新しい妨害が発動するたびに一旦`null`へリセットしてから、今回の効果が該当種別なら改めて設定される。封印中でも所持表示自体は維持される。役封印(roleSeal)は対象2役のオラクルレベルを0扱いにしてボーナスを完全無効化、天啓・神託封印(revelationOracleSeal)で神託が選ばれた場合は対象役のオラクルレベルを一時的に1相当(未強化の基準値)まで下げる、役偏重(roleBias)は`multipliers`として役ごとの倍率(2倍/0.5倍)を保持する。プレイ中の画面には、星の制限説明の下に次に発動する妨害の名前と残りターン数が表示される。

## 10. アイテムシステム

護符・秘儀・天啓・神託・レリックの5種類のアイテムがあり、いずれもウェーブクリア時の選択画面、またはショップでの購入を通じて入手する(レリックのみショップ専用枠)。

### 10.1 護符(①Talisman)— 133種

- 自由命名。現在**133種**実装済み(`ITEM_POOL`)。抽選はレアリティを考慮しない完全均等抽選。
- 常時発動する**パッシブ**効果。所持上限: `itemMaxCapacity`(基本値`items.maxItems`既定**5**、スプレッド由来オフセット・レリック「招き布袋像」で増減)。上限到達時は入れ替え選択フローに切り替わる。
- 加算・倍算型の護符が複数所持されている場合、適用順は所持順(ドラッグ&ドロップで並べ替え可能、常設バッジ表示にも反映)に固定される。
- レアリティ(C/U/R)を持ち、ショップ購入価格に反映される(11節参照)。
- 効果の詳細な一覧は`docs/shidasu/done/shidasu-gofu-candidates.md`を参照(実装済み一覧。件数は当文書の実測値133が最新)。

### 10.2 秘儀(②Rite)— 24種

- モチーフは北欧ルーン文字(エルダー・フサルク)。全**24種**実装済み(`RITE_POOL`: raidho/jera/wunjo/othala/perthro/uruz/ingwaz/gebo/fehu/dagaz/algiz/tiwaz/laguz/eihwaz/ansuz/kenaz/thurisaz/hagalaz/nauthiz/isa/sowilo/berkano/mannaz/ehwaz)。
- プレイ中に能動的に使用する**消費**アイテム。ウェーブを跨いで永続所持(所持上限`riteMaxCapacity`、基本値3、レリック「破魔矢」で増加)。`useRite`で1個消費して即時効果を発動する。
- 一部(ゲボ・フェフ、ペルスロ・ラグズ)は使用条件(山札・捨て札の枚数、不足列・空列の有無)がある。
- 詳細は`docs/shidasu/done/shidasu-higi-candidates.md`・`docs/shidasu/done/shidasu-rite-redesign-candidates.md`を参照。

### 10.3 天啓(③Revelation)— 28種

- モチーフは二十八宿。全28宿全てに効果実装済み(`REVELATION_POOL`)。
- **いつでも使用可能**な消費アイテムで、場札・デッキ構成の両方に**永続的**な効果を発揮する。カード変換・場札操作系(`wave`・`deckComposition`を書き換える)と即時報酬獲得系(通貨・護符・秘儀・天啓・神託・レリックを即時獲得する、`RunState`レベルの効果)の2系統がある。所持上限は神託と合算で`revelationOracleMaxCapacity`(基本値2、レリック「千羽鶴」で増加)。
- 詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`を参照。

### 10.4 神託(④Oracle)— 10種

- モチーフは六十四卦。10役(コンプリートラン・ロイヤルセット・フラッシュ・階段・同色・同スート・列一掃・同ランク・ペア・交互)に対応する10卦を`ORACLE_POOL`に実装済み。
- 効果は対応する役のレベルを**永続+1**(`RunState.oracleLevels`)し、以後その役のボーナスに乗算で効く。所持は**天啓と合算枠を共有**(上限は10.3節と同じ`revelationOracleMaxCapacity`)。

### 10.5 レリック(⑤Relic)— 10種

- ショップ販売価格・提示数・リロールコストの減少、秘儀・天啓・神託の所持上限増加など、**ラン単位の経済・メタ的な恒久バフ**を持つ、護符の守備範囲外のアイテム。所持数に上限は無いが同じ種類の重複所持はできない。ショップ専用枠(バラ売り3枠・福袋2枠とは別に、`relicSlotCount`枠、基本1枠)からのみ入手する。
- 個体ごとに「付喪化」(進化)状態を持ち、天啓「虚」(kyo)で付喪化させると効果が`tsukumokaDesc`の内容に上方修正される。

| id | 名称 | 効果(未付喪化) | 効果(付喪化) |
|---|---|---|---|
| manekiNeko | 招き猫 | 購入価格を25%値引き | 購入価格を50%値引き |
| fukuDaruma | 福だるま | ショップリロールコストの刻み幅を2減らす | 加えて、同一ショップ訪問中の最初の1回のリロールが無料 |
| kumade | 熊手 | バラ売り枠を1枠増やす | バラ売り枠・福袋枠を両方1枠ずつ増やす |
| manekiHoteizo | 招き布袋像 | 護符の所持上限+1 | さらに+1(合計+2) |
| hamaya | 破魔矢 | 秘儀の所持上限+1 | さらに+1(合計+2) |
| senbazuru | 千羽鶴 | 天啓・神託(合算)の所持上限+1 | さらに+1(合計+2) |
| fukuzasa | 福笹 | 福袋枠を1枠増やす | 福袋枠・バラ売り枠を両方1枠ずつ増やす |
| kaiunKokeshi | 開運こけし | 売却価格を25%上乗せ | 売却価格を50%上乗せ |
| engiKozuchi | 縁起小槌 | 福袋の選択肢数を全ジャンル+1 | さらに+1(合計+2) |
| engiSuzu | 縁起鈴 | レリック専用枠の提示数+1 | さらに+1(合計+2) |

## 11. 通貨・ショップ

- 通貨「星片」(☆): 初期所持`currency.initialAmount`(既定**5**、スプレッド`initialCurrencyBonus`で加算)。ウェーブクリアごとにそのウェーブの星の報酬(3〜5、`rewardPenalty`があれば減算)に加え、護符由来の各種ボーナス(報奨・褒賞・恩賞・活気・瑞祝・市況)を獲得する。
- ショップ(`rollShop`): バラ売り`individualSlotCount`枠(基本3、熊手・福笹で増加。護符/秘儀/天啓/神託から均等抽選、護符は所持中・同ショップ内重複を除外)+福袋`packSlotCount`枠(基本2、福笹・熊手で増加。`shop.packCatalog`から重複無しで抽選)+レリック専用枠`relicSlotCount`(基本1、縁起鈴で増加、未所持レリックのみ)。`bannedShopKinds`(スプレッド由来)に該当する種別はどちらの枠にも出現しない。
- 価格(既定、招き猫所持時は割引・開運こけし所持時は売却価格上乗せ): 護符 C6/U8/R10(売却半額3/4/5)、秘儀5(売却2)、天啓5(売却2)、神託3(売却1)、レリックは`price`個別設定(20〜35)。
- 福袋カタログ(`packCatalog`、`/admin/shidasu-packs`で編集可能)は既定**32件**(護符9件・秘儀6件・天啓6件・神託4件・トランプセット7件)。各エントリは名前・種別・選択肢数(offerCount)・取得数(pickCount)・価格を持つ。選ばれたエントリの名前・価格はショップ枠にスナップショットされ、以後カタログを編集しても提示中のショップには影響しない。
- トランプセット福袋(`packKind: 'cardSet'`): バラ売り無し、福袋限定。開けると23種類のセットジャンル(階段3種・同ランク3種・絵札・同スート3種・ロイヤル・フラッシュ・コンプリートラン2種・ペア2種・赤黒バランス6種・ワイルド)が重み付き抽選(重み=1/枚数、ワイルドのみ1/6)で提示され、選ぶと即座に`RunState.deckComposition`へ永続追加される。
- ショップリロール(`rerollShop`): バラ売り・福袋を一括で再抽選する。コストは`shopRerollCost`=`(shopRerollCount + 1) × relicRerollCostStep`(基本の刻み幅は`shop.rerollCostStep`既定5、福だるまで減少、付喪化福だるま所持時は最初の1回無料)。次のショップに入るたびに`shopRerollCount`は0にリセットされる。
- 星(waveSlot3)のリロール(`rerollStageStars`): ボスWave未クリアかつ通貨`flow.rerollCost`(既定30)以上で、ボスWaveスロットのみ直前と異なる星に再抽選する(ショップの品ぞろえリロールとは別料金・別関数)。

## 12. 現在のデフォルト数値一覧(`shidasu.config.json`)

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
| flow.rerollCost(星のリロール) | 30 |
| flow.clearDelayMs | 450(目標達成時の演出待ち。全消し・手詰まりは即遷移) |
| shop.rerollCostStep(ショップ全体リロール) | 5 |
| currency.initialAmount | 5 |

なお`ui.*`(`comboTierThresholds`・`chainCardOffsetX`・`chainCardsPerRow`等)は表示・演出専用のパラメータで、ゲームルール・スコア計算には一切影響しない。

## 13. 用語対応

より詳細な用語定義は既存の`docs/shidasu/shidasu-glossary.md`(世界観対応: 護符=北欧ルーン、天啓=二十八宿、神託=六十四卦、スプレッド=大アルカナ)を参照。本文書とあわせて読むことを推奨する。
