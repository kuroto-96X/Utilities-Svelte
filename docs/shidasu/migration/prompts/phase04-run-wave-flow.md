# フェーズ4: Run/Wave進行フロー・デッキ生成の移植

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - `Utilities-Svelte/docs/shidasu/migration/reference/godot-project-location.md`(Godotプロジェクトの実パス)
> - Godotプロジェクトの`docs/adr/`配下のADR一式(フェーズ2成果物)
> - フェーズ3成果物(`logic/data/`配下の型・enum・パラメータローダー。本フェーズはこれらをそのまま使う)

## 目的

`src/lib/game/shidasu/engine.ts`が持つRun進行の骨格(Run開始→ステージ/ウェーブ遷移→ショップ突入)をGodotへ移植する。**効果ロジック(護符・秘儀・天啓・妨害・役判定・スコア計算)は本フェーズの対象外で、未実装のスタブ(何もしない、またはダミー値を返す)でよい。** 目標は「効果なしで、Runの最初(タイトル/スプレッド選択)から最後(全クリア/ゲームオーバー)まで、Wave⇔ショップの往復を含めて一通り状態遷移させられること」。

## 前提・依存

- 依存フェーズ: フェーズ2(状態管理パターン・`duplicate_state()`規約)、フェーズ3(型定義・`ShidasuParams`ローダー・コンテンツIDプール)。本フェーズはこれらの上に進行フローだけを組み立てる。
- 後続フェーズ(5: スコアリング、6〜9: 各種効果)は、本フェーズが作る`RunState`/`WaveState`の状態遷移の骨格に、スコア計算・効果処理を後から差し込んでいく前提。ここで骨格の状態遷移が正確でないと、後続フェーズ全てに影響する。

## 作業内容(具体的な箇条書き)

1. **`deck.ts`の移植**(RNG・シャッフル・デッキ生成・スプレッド固有変形)
   - `createRng(seed)`(79〜87行目、mulberry32型PRNG)は、フェーズ2のADR(`0004-rng-policy.md`)の決定に従い、Godot標準`RandomNumberGenerator`ベースの同等機能に置き換える。「シードから独立した乱数系列を作る」という利用パターン(`finishShop`が`createRng(baseSeed + 1)`のように意図的に系列をずらす箇所、`engine.ts`1274行目)を再現できるようにする。
   - `shuffleInPlace`/`shuffle`(89〜108行目、Fisher-Yatesシャッフル)、`rollOffer`(98〜102行目、プールからcount件を重複なく無作為抽出する共通ヘルパー。福袋・バラ売り・各種オファー抽選が全てこれを経由する)を移植する。
   - `createDeck`(7〜16行目)・`standardDeckComposition`(18〜27行目、標準52枚のデッキ構成)・`multipliedDeckComposition(multiplier)`(32〜43行目、スプレッド「皇帝」用に標準デッキをmultiplier組連結)・`randomizedDeckComposition(rand)`(48〜56行目、スプレッド「運命の輪」用に52枚それぞれのsuit/rankを独立ランダム抽選)・`addCardsToDeckComposition`(60〜64行目、天啓のワイルド供給等で使う一括追加ヘルパー)・`unifyBlackRedSuits`(69〜77行目、スプレッド「恋人」用に黒スート♠♣・赤スート♥♦をそれぞれ一方に統一)を全て移植する。
   - `generateSeed`(110〜112行目)も移植する。
2. **Run開始処理の移植**
   - `createInitialRun()`(`engine.ts`1031〜1045行目): `RunState`の初期値(phase: 'title'、各種カウンタの初期値等)を生成する。
   - `beginRun(params, seed, spreadId)`(1047〜1082行目): スプレッド設定(`params.spreads[spreadId]`)に基づき、`extraTableauRows`のオフセット計算、`rollStageStars`によるステージ突入時の星3つの初期抽選、`oracleLevelsWithUniformValue`による神託レベル初期化、デッキ構成の変形(`deckMultiplier`→`randomizeDeck`→`excludedRanks`除外→`unifyBlackRedSuits`→`randomizeWildPerSuit`という適用順序に注意、1055〜1071行目)を行い、`phase: 'shop'`で返す。**この適用順序を変えるとスプレッド組み合わせ時の挙動が変わるため、順序をそのまま踏襲すること。**
3. **Wave開始処理の移植**
   - `startWave(params, stageIndex, waveIndex, items, deckComposition, seed, extraTableauRows, oracleLevels, dedicationX, diligenceX, divineProtectionX, discretionN, frostX, echoX, shootingStarN, sabotage, spreadId)`(136〜258行目)を移植する。関数シグネチャの引数が多いため、GDScriptでは名前付き引数の代わりに小さな設定オブジェクト(構造体的なクラス)にまとめることも検討してよいが、**渡している値の意味・既定値はすべて維持すること**。
   - 内部処理: 永劫(`eternity`)・豊穣(`abundance`)護符によるデッキ構成へのワイルド追加(160〜167行目)、デッキシャッフル→場札(`tableau`)への配布(169〜175行目)、スプレッド「月」(`moon`)固有の場札裏向き配布(176〜186行目、各列の奥側`floor(rows/2)`枚を`faceUp: false`にする)、基準カード(`foundation`)の確定、約束(`promise`)護符による山札の並べ替え(`arrangeNextCardForContinuation`、188〜191行目)、剛毅(`fortitude`)護符による初期コンボ数の計算(193〜197行目)、`rollSabotage`による妨害の初期抽選(253行目)を経て`WaveState`を組み立てる(199〜255行目)。
   - 護符由来の効果(永劫・豊穣・月・約束・剛毅等)は、本フェーズでは効果自体の全容(itemEffects.ts側)を実装する必要はないが、**`startWave`内で直接呼ばれているこれらの分岐だけは移植する**(Wave開始時の配牌そのものに関わるため、進行フローの一部として扱う)。それ以外の護符効果(プレイ中の得点計算フック等)はフェーズ6のスタブのままでよい。
4. **ステージ/ウェーブ位置・星・目標スコアの移植**
   - `isBossWave(params, waveIndex)`(902〜904行目): `waveIndex === params.flow.wavesPerStage - 1`。
   - `stageModifierFor(params, run)`(910〜916行目): 現在Waveの星(`run.stageStars[run.waveIndex]`)の`restriction.kind`が`noLoop`/`faceLock`ならそれを返す(取得可否そのものを制限する系統)。
   - `bossScoreLockFor(params, run)`(922〜932行目): 同じ星の`restriction.kind`が`lowCombo`/`oddCombo`/`suit`/`face`なら対応する`BossScoreLock`を返す(得点ロック系統。判定ロジック自体はフェーズ5が使うが、本関数自体は進行状態から導出するだけなのでここで移植する)。
   - `waveTarget(params, stageIndex, waveIndex, stageStars, spreadId)`(937〜942行目): `floor(stageTargetBase × stageTargetMultiplier^stageIndex × star.targetMultiplier × spreads[spreadId].targetScoreMultiplier)`。
   - `toStarRestriction`(947〜959行目)・`rollStarForSlot`(964〜982行目)・`rollStageStars`(985〜987行目、waveSlot 1/2/3それぞれから1つずつ抽選): ステージ突入時の星確定ロジックを移植する。
   - `nextWaveLocation(params, run)`(995〜1001行目): `waveIndex + 1`が`wavesPerStage`に達したら次ステージへ繰り上がる、という単純な進行計算。
   - `nextStageStars(params, run, newLocation, rand)`(1005〜1013行目): 同じステージ内に留まる場合は`stageStars`を維持、新しいステージに入る場合のみ`rollStageStars`で再抽選する。
   - `isStuck(modifier, wave, rites)`(1015〜1024行目)・`markStuck(wave)`(1026〜1029行目): 手詰まり判定(残り枚数・山札・プレイ可能列の有無、ダガズ秘儀所持時の例外)。効果ロジック自体(`getPlayableColumns`等)はisPlayable判定を含むためフェーズ5寄りだが、Wave終了理由の確定に直結するため本フェーズで進行フローの一部として移植する。
   - `src/lib/game/shidasu/bosses.ts`の`starsInSlot(params, waveSlot)`(5〜7行目)も合わせて移植する(管理画面向けヘルパーだが単純なフィルタ処理なので併せてやってよい)。
5. **Wave終了・ショップ遷移の移植**
   - `resolveWaveEnd(params, run, rand, seed)`(1084〜1164行目)の**遷移部分**を移植する。目標未達なら`phase: 'gameOver'`(1089〜1091行目)。クリアなら各種護符由来の通貨・sellBonus加算処理(決算・還元・報奨・褒賞・恩賞・活気・瑞祝・市況、1096〜1155行目)があるが、**これらは護符効果なのでフェーズ6が本実装する。本フェーズでは「該当護符を所持していなければ何も起きない」スタブ(常に0加算、または恒等関数)で進行を止めないことを優先してよい**。ただし関数の骨格・呼び出し位置・戻り値の型はそのまま用意すること。
   - **重要(注意点に格上げされている累積カウンタの同期)**: `resolveWaveEnd`のクリア成功パスでは、`dedicationX`/`diligenceX`/`divineProtectionX`/`discretionN`/`frostX`/`echoX`/`shootingStarN`という7つの値を`wave`側から`run`側へ書き戻している(1148〜1154行目、`runWithCurrency`オブジェクト)。これらは「`WaveState`側に正本を持つ、ラン全体で永続する累積値」であり、Wave開始時(`startWave`の引数として`run`から渡す)にコピーし、Wave終了時にここで書き戻す、という同期タイミングを1つでもズラすとバグになる。`types.ts`のコメント(286〜302行目付近)も参照し、正確に再現すること。
   - 最終ステージの最終ウェーブ(ボスWave)クリア時のみ`continueChoice`フェーズへ遷移する分岐(1159〜1162行目、`isFinalWaveOfRun`)、それ以外は`enterShop`を呼ぶ分岐を実装する。
   - `enterShop(params, run, seed, rand)`(1218〜1237行目): `nextWaveLocation`→`nextStageStars`で次の位置・星を確定し、各種オファー配列(`offer`/`revelationOffer`/`oracleOffer`/`riteOffer`/`cardSetOffer`)をリセットし、`phase: 'shop'`にする。`shop: rollShop(params, next, rand)`でショップの商品構成を抽選する部分があるが、**`rollShop`自体(`shop.ts`)はフェーズ8の担当**なので、本フェーズでは空のショップ構成を返すスタブ、または最小限のダミー実装で進行を止めないようにする。
   - `finishShop(params, run, seed)`(1267〜1278行目): `phase !== 'shop'`なら何もしない、`rerollRandomTargets`(1253〜1265行目、賞金・祝儀護符のランダム対象再抽選。護符効果なのでフェーズ6でよいがスタブとして関数自体は用意する)を経て`startWave`を呼び、`phase: 'playing'`・`waveGeneration + 1`で返す。
   - `continueAfterGreatMisfortune(params, run, rand, seed)`(1909〜1912行目、`continueChoice`から`enterShop`を呼ぶ)・`stopAfterGreatMisfortune(run)`(1915〜1918行目、`phase: 'allClear'`)・`restartRun(params, seed)`(1920〜1922行目、`beginRun`の呼び出しだけ)も移植する。
6. **`RunPhase`状態機械の実装**
   - `RunPhase`(`types.ts`372行目)の全11状態(`title`/`playing`/`shop`/`itemSelect`/`riteSelect`/`revelationSelect`/`oracleSelect`/`cardSetSelect`/`continueChoice`/`allClear`/`gameOver`)について、本フェーズで移植した関数群がどの状態からどの状態へ遷移するかを、GDScriptの状態機械(例えば現在の`phase`を保持しつつ許可される遷移だけを行うヘルパー、または単純にフェーズ2で決めたステートクラスの`phase`フィールドを更新する形)として整理・実装する。
   - `itemSelect`/`riteSelect`/`revelationSelect`/`oracleSelect`/`cardSetSelect`(ショップ内の各種選択画面)への遷移自体はフェーズ8(ショップ/福袋システム)の担当関数(`buyPack`等)が行うため、本フェーズでは`RunPhase`の型定義とこれらの値が状態機械上に存在することの確認に留めてよい。

## 参照すべき既存ファイル(Utilities-Svelte内、パス明記、各ファイルで何を見るべきか)

- `src/lib/game/shidasu/engine.ts`(2022行): 本フェーズの主対象。関数と行番号の対応は上記「作業内容」に記載の通り。特に`startWave`(136〜258行目)・`beginRun`(1047〜1082行目)・`resolveWaveEnd`(1084〜1164行目)・`enterShop`(1218〜1237行目)・`finishShop`(1267〜1278行目)。
- `src/lib/game/shidasu/deck.ts`(112行): 全関数が対象。特に`createRng`(79〜87行目)はフェーズ2のADR(乱数方針)に沿って置き換える対象であることに注意。
- `src/lib/game/shidasu/waveReset.ts`(66行): `resetComboFields`。1プレイごとのコンボリセット処理でありスコア計算本体(フェーズ5)が主に使う関数だが、`comboResetShieldRemaining`等`WaveState`のフィールド初期値が`startWave`側でどう設定されるか(243行目、常に0)との対応関係を理解するために目を通しておく。本フェーズでの実装(呼び出し配線)は必須ではない。
- `src/lib/game/shidasu/bosses.ts`(7行): `starsInSlot`。
- `Utilities-Svelte/docs/shidasu/migration/reference/00-updated-rules.md`(フェーズ1成果物): Run/Stage/Wave進行構造・「星」システムの仕様まとめ。
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-roles-spreads.md`(フェーズ1成果物): スプレッド10種の固有ルール一覧(`beginRun`のスプレッド分岐の正確な仕様確認に使う)。

## 成果物・保存先

Godotプロジェクト配下に作成する。

- `logic/core/deck_ops.gd`(または`logic/data/`配下、フェーズ2のフォルダ規約に従う): `deck.ts`の全関数の移植
- `logic/core/run_flow.gd`: `createInitialRun`/`beginRun`/`resolveWaveEnd`(遷移部分)/`enterShop`/`finishShop`/`continueAfterGreatMisfortune`/`stopAfterGreatMisfortune`/`restartRun`
- `logic/core/wave_flow.gd`: `startWave`/`isBossWave`/`stageModifierFor`/`bossScoreLockFor`/`waveTarget`/`rollStageStars`関連/`nextWaveLocation`/`nextStageStars`/`isStuck`/`markStuck`
- `logic/core/run_phase_machine.gd`(または既存ファイルに統合): `RunPhase`の状態遷移整理
- 動作確認用の最小スモークテスト(GUT未導入のため、`--headless`で実行できる簡易スクリプトや`_ready()`内での手動確認コードで可): 効果なしでRunを1回、タイトル→スプレッド選択相当→Wave開始→(スタブ判定で)クリア扱い→ショップ→次Wave...→最終ステージ→continueChoice→allClearまで、または目標未達で`gameOver`まで、状態遷移が一通り流れることを確認する

## 完了条件(チェックリスト形式)

- [ ] `deck.ts`の全関数(`createRng`は方針に沿って置換、それ以外は忠実に移植)がGodot側に実装されている
- [ ] `beginRun`が全10スプレッドそれぞれで(効果ロジック抜きでも)エラーなくデッキ構成・初期状態を生成できる
- [ ] `startWave`が場札配布・基準カード確定・妨害初期抽選までを含めて実装され、`WaveState`相当のオブジェクトを返す
- [ ] `waveTarget`/`stageModifierFor`/`bossScoreLockFor`/`nextWaveLocation`/`nextStageStars`/`isBossWave`が移植され、Web版と同じ計算式・分岐条件になっている
- [ ] `resolveWaveEnd`の遷移部分(目標未達→`gameOver`、最終ステージ最終ウェーブ→`continueChoice`、それ以外→`enterShop`)が実装されている
- [ ] `dedicationX`/`diligenceX`/`divineProtectionX`/`discretionN`/`frostX`/`echoX`/`shootingStarN`の7値について、Wave開始時に`run`から`wave`へコピーし、Wave終了時に`wave`から`run`へ書き戻す同期が正確に再現されている
- [ ] `enterShop`/`finishShop`が実装され(`rollShop`はスタブでよい)、ショップ⇔プレイ画面の往復が`phase`の値として正しく遷移する
- [ ] 効果なし(護符・秘儀・天啓・妨害の効果を一切適用しない)状態で、Runを最初から最後まで(何らかの方法でクリア/ゲームオーバーを発生させて)流せることを確認した
- [ ] 効果ロジック(スコア計算・護符/秘儀/天啓/妨害の実処理)は実装していない、または明示的なスタブになっている

## 注意点

- 本フェーズは「骨格を通す」ことが目的であり、護符・秘儀等の効果を正しく再現することは目的ではない。効果に関わる分岐に出会ったら、まずスタブ(無効果)で先に進め、進行フロー全体が最後まで流れることを優先すること。ただし`startWave`内の月・約束・剛毅・永劫・豊穣のようにWave開始の配牌そのものを変える処理は、進行フローの一部として本フェーズで扱う(作業内容3参照)。
- `WaveState`に正本を持つ7つの累積カウンタの同期タイミングは、work-plan.mdでも名指しで注意喚起されている最重要ポイント。`startWave`の引数リストの順序(`dedicationX, diligenceX, divineProtectionX, discretionN, frostX, echoX, shootingStarN`)と`resolveWaveEnd`の書き戻し順序を突き合わせ、取りこぼしが無いか必ず確認すること。
- `startWave`の引数が16個と多く、GDScriptで素朴に移植すると呼び出し側が読みにくくなる。フェーズ2のADRに沿って設定オブジェクトへまとめる等の整理をしてよいが、その場合は各フィールドがWeb版のどの引数に対応するかをコード内コメントで明示すること(後続フェーズの担当AIが対応関係を追えるようにするため)。
- `rollShop`・`rollSabotage`・各種`roll*Offer`など、他フェーズ担当のロジックへの依存箇所は、関数シグネチャ(引数・戻り値の型)だけ先に確定させ、中身はスタブにする。後続フェーズが同じシグネチャを実装すればそのまま差し替わるようにしておくこと。
