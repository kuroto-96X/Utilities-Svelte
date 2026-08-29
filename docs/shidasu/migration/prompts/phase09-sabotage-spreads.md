# フェーズ9: 星の妨害行動32種・スプレッド固有ルールの移植・統合

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ4〜8の成果物(Run/Wave進行フロー・スコアリングパイプライン・護符/秘儀/天啓/神託/レリック/ショップの実装状況。本フェーズはこれら全部の上に妨害行動とスプレッドを載せて完成させる位置づけ)
> - `Utilities-Svelte/docs/shidasu/migration/reference/`配下(存在すれば)フェーズ1の妨害・スプレッドカタログ

## 目的

骨格のみだった妨害行動(32種)とスプレッド(10種)を実装し、Run/Wave進行・スコアリング・ショップと統合する。このフェーズが完了すると、UIなしでコンソール/テストから1Run分(8ステージ×3ウェーブ=24ウェーブ、妨害発動・スプレッド固有ルールを含む)をシミュレートできる状態になる。

## 前提・依存

- 依存: フェーズ4(Run/Wave進行)〜8(神託/レリック/ショップ)がすべて完了していること。妨害行動の一部(`talismanSeal`/`riteSeal`/`revelationOracleSeal`/`relicConfiscate`/`talismanConfiscate`/`riteConfiscate`/`revelationOracleConfiscate`/`riteForceActivate`/`revelationOracleForceActivate`/`tsukumokaRelease`等)は護符・秘儀・天啓・神託・レリックの実データ(`run.items`/`run.rites`/`run.revelations`/`run.oracles`/`run.relics`)を直接操作するため、これらが未実装だと妨害効果を正しく検証できない。
- Web版はロジック層が純粋関数(引数の`RunState`/`WaveState`を書き換えず新しい状態を返す)というイミュータブル設計になっている。フェーズ2で決定したGodot側の状態管理規約(`duplicate_state()`等)に沿って、本フェーズの実装もこの設計思想を踏襲すること。

## 作業内容

### 1. 妨害行動プール・メタデータの移植

- `src/lib/game/shidasu/sabotage.ts`を移植する。
  - `SABOTAGE_POOL`: 32件の妨害行動ID配列(先行実装11個+PhaseA 11個+PhaseB 10個)。GDScript側でも同じ32件のenum/定数配列として定義する。
  - `eligibleSabotageIds(sabotage: StarSabotage)`: `StarSabotage`は`{kind:'none'}` / `{kind:'all'}`(SABOTAGE_POOL全件が対象) / `{kind:'some', ids:[...]}`(個別指定、現状未使用だが型としては存在)の3種。
  - `rollSabotage(params, sabotage, rand)`: 候補からランダムに1件選び、`pendingSabotageId`と、そのIDの`intervalTurns`(`params.sabotageActions[id].intervalTurns`、`shidasu.config.json`側で管理)を`sabotageTurnsRemaining`として返す。候補0件なら`{pendingSabotageId: null, sabotageTurnsRemaining: 0}`。
  - `sabotageActionName`/`sabotageActionDesc`: 表示名・説明文を`ShidasuParams`(JSONローダー)経由で取得するヘルパー。id自体はコード側の固定プール、name/desc/intervalTurnsは`shidasu.config.json`側の可変フィールドという分離を維持する。

### 2. 妨害行動32種の効果本体の移植

`src/lib/game/shidasu/sabotageEffects.ts`(全32個の`apply*`関数+ディスパッチャ`applySabotageEffect`)を移植する。

- **依存性注入パターン(`SabotageContext`)を維持すること。** `sabotageEffects.ts`はWeb版で`params`/`run`/`wave`/`rand`に加え、`useRite`/`useRevelation`/`useOracle`の3関数を**呼び出し元(`triggerSabotage`)から値として注入されて**受け取る設計になっている。理由はコメントに明記されている通り、`riteForceActivate`(秘儀強制発動)・`revelationOracleForceActivate`(天啓/神託強制発動)がプレイヤーの通常クリックと同じ処理を再利用する必要がある一方、`sabotageEffects.ts`から`engine.ts`(`useRite`等の定義元)を直接importすると循環importになるため。GDScriptにはTSのような循環import制限はないが、**「効果ロジックの純粋な単体テスト可能性」を保つため、同じ依存性注入の考え方(関数参照/`Callable`を渡す設計)を踏襲すること**を推奨する(直接呼び出しに書き換えて密結合にしない)。
- 各`apply*`関数はwave/runへの**部分差分**(`SabotageResult`: `wave?: Partial<WaveState>`, `run?: Partial<RunState>`)を返す設計。GDScript側でも「妨害効果は差分オブジェクトを返し、呼び出し元がマージする」という形を踏襲すると、後続フェーズ(UI用シグナル発火)から見通しが良くなる。
- `SabotageResult`には見た目用の補助フィールド(`affectedTableauCols`/`purgedToDiscardCount`/`confiscatedTarget`/`forceActivatedTarget`/`numericChangeTarget`/`tableauCardRemoved`/`redistributedAreas`)が含まれる。これらは「今回の妨害でどのカード/対象が実際に動いたか」をUI(アニメーション)に伝えるための情報で、スコアやゲーム進行そのものには影響しない。**本フェーズでは型/データ構造として保持しておく**(フェーズ12がシグナル発火の元ネタとして使うため)が、見た目の実装(アニメーション本体)はフェーズ13の担当であり本フェーズでは着手しない。
- 32種の効果を機能グループで大まかに把握しておくと実装・検証がしやすい(グループ分けは実装上の制約ではなく理解の補助):
  - 場札/山札/捨て札操作系: `stockPurge`/`stockPurgeSmall`/`columnReturn`/`tableauFullReturn`/`tableauShuffle`/`tableauCardToDiscard`/`stockShuffle`/`discardErase`/`discardBury`
  - チェーン/コンボ操作系: `chainSettle`/`chainPartialDiscard`/`chainShuffle`/`comboBreather`/`comboReduce`/`comboCap`
  - 封印系(下記3.参照): `talismanSeal`/`riteSeal`/`revelationOracleSeal`/`roleSeal`
  - 没収系: `relicConfiscate`/`talismanConfiscate`/`riteConfiscate`/`revelationOracleConfiscate`
  - 強制発動系: `riteForceActivate`/`revelationOracleForceActivate`
  - 数値変化系: `currencyConfiscate`/`currencyDrain`/`roleLevelDecay`/`roleBias`/`rewardReduce`/`tsukumokaRelease`
  - シャッフル系(所持品並び替え隠蔽): `talismanShuffle`
- `chainSettle`は実装上の注意点が1つある。`triggerSabotage`は`resetWave`(封印リセット済みの`wave`)を渡すが、`applyChainSettle`自体は受け取った`wave`をベースに`resetComboFields`を呼び、結果へ明示的に`activeSeal: null`を含めることで単体でも正しい結果になるようにしている(`sabotageEffects.ts`のコメント参照)。移植時にこの「関数単体で自己完結させる」設計意図を崩さないこと。

### 3. 封印系(同時1件のみ)の設計を維持

- `WaveState.activeSeal`は`{kind:'talisman',...} | {kind:'rite',...} | {kind:'revelationOrOracle',...} | {kind:'role',...} | {kind:'comboCap',...} | {kind:'talismanHidden'} | {kind:'roleBias',...} | null`のUnion型。**常に最大1件しか存在しない**設計であり、`triggerSabotage`は新しい妨害を発動させる直前に必ず`activeSeal`を`null`にリセットしてから、今回の効果が封印系ならそこに設定し直す(`engine.ts`の`triggerSabotage`内、`resetWave: WaveState = { ...wave, activeSeal: null }`)。
- 封印はスコアリングパイプライン(フェーズ5)へ以下の3つの導出関数経由で反映される。いずれも`wave.activeSeal`だけを見て副作用なく値を導出する純粋関数なので、そのままGDScriptの関数として移植できる。
  - `resolveEffectiveItems(items, activeSeal)`: `activeSeal.kind==='talisman'`なら該当`instanceId`の護符**1個体だけ**を除外した`ItemId`配列を返す(同名護符を複数所持していても封印されるのは1個体のみ)。
  - `resolveSealedRoleEffect(activeSeal)`: `role`封印なら対象役をレベル0扱い(`zeroRoles`)、`revelationOracleSeal`で神託が対象の場合は該当役をレベル1(封印前基準値)扱い(`oracleBaselineRole`)、`roleBias`封印なら`buffed`役に`multiplier`倍・`nerfed`役に`1/multiplier`倍を返す。
  - `resolveComboCap(activeSeal)`: `comboCap`封印なら上限値、それ以外は`null`(上限なし)。
  - これら3関数の返り値は`playCard`/`drawStock`/`isStuck`(フェーズ5で移植済み)に渡す前提で、`engine.ts`内の`resolvePlayContext`関数(`target`/`scoreLock`/`effectiveItems`/`sealedRoleEffect`/`comboCap`をまとめて1回で算出するヘルパー)がその呼び出し例になっている。同様の集約ヘルパーをGodot側にも用意すると統合しやすい。

### 4. waveSlot3(星の制限)のスコアリングパイプラインへの統合

- `Star`型(`types.ts`)は`waveSlot: 1|2|3`・`restriction: StarRestriction`・`sabotage: StarSabotage`等を持つ。`restriction`は次の6種+null。
  - 取得可否そのものを制限する種類: `{kind:'noLoop'}` / `{kind:'faceLock'}`
  - 得点を0にロックする種類: `{kind:'lowCombo', maxCombo}` / `{kind:'oddCombo'}` / `{kind:'suit', suit}` / `{kind:'face'}`
- `stageModifierFor(params, run)`: `run.stageStars[run.waveIndex]`の`restriction.kind`が`noLoop`/`faceLock`なら対応する`StageModifier`(`'noLoop'|'faceLock'|'none'`)を返す。得点ロック系は意図的に`'none'`へ落とす(取得可否制限と得点ロックは排他)。
- `bossScoreLockFor(params, run)`: 同じ`restriction`のうち得点ロック系4種を`BossScoreLock`(`{kind:'combo'|'suit'|'oddCombo'|'face', ..., tierLabel: star.name}`)に変換する。`tierLabel`には星の名前をそのまま使う(階級名からの再導出はしない)。
- どちらもフェーズ5で移植済みの`playCard`本体(getPlayableRowsInColumn/isPlayable/最終得点ロック判定)に既に接続されている前提。本フェーズでは**これらの導出関数自体を実装し、実際の星データ(`run.stageStars`)から正しい値が返ることを検証する**ことが作業の中心になる(パイプライン側の骨格はフェーズ5で完成済み)。

### 5. スプレッド10種の統合

`SpreadId`は`'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor' | 'wheelOfFortune' | 'strength'`の10種。各スプレッドの固有ルールは`SpreadConfig`(`types.ts`)としてデータ化されており、`shidasu.config.json`の`spreads`キーに実値が入っている。フィールド一覧:

| フィールド | 意味 |
|---|---|
| `initialExtraTableauRows` | Wave開始時の配布行数への初期オフセット |
| `deckMultiplier` | 初期デッキの連結数(2なら104枚) |
| `tableauRowMultiplier` | 場札配布行数への倍率 |
| `targetScoreMultiplier` | 目標スコアへの倍率 |
| `initialOracleLevel` | 神託の初期レベル(全10役一律) |
| `bannedShopKinds` | ショップのバラ売り/福袋から除外する種別 |
| `initialCurrencyBonus` | 初期所持金へのオフセット |
| `initialItemCapacityBonus` | 護符所持上限へのオフセット |
| `excludedRanks` | 初期デッキ生成時に除外するランク |
| `unifyBlackRedSuits` | 黒/赤スートをランダムにどちらか一方へ統一するか |
| `randomizeDeck` | 52枚それぞれのsuit/rankを独立ランダム抽選するか(`deckMultiplier`を上書き) |
| `randomizeWildPerSuit` | 4スートから1枚ずつランダムにワイルド変換するか |

- **接続先1: デッキ生成(`beginRun`)。** `engine.ts`の`beginRun`が`params.spreads[spreadId]`を読み、`extraTableauRows`/`stageStars`/`oracleLevels`/`currency`/`deckComposition`を`SpreadConfig`の各フィールドに従って順に加工していく(`deckMultiplier`→`randomizeDeck`→`excludedRanks`→`unifyBlackRedSuits`→`randomizeWildPerSuit`の適用順序をそのまま踏襲すること。順序を変えると例えば「randomizeDeckで52枚に上書きした後にexcludedRanksを適用する」という前提が崩れる)。
- **接続先2: 目標スコア(`waveTarget`)。** `params.spreads[spreadId].targetScoreMultiplier`をステージ基準点・星の`targetMultiplier`に掛け合わせる。
- **接続先3: ショップ品揃え。** `bannedShopKinds`をショップ抽選(フェーズ8で移植済みの`rollShop`相当)から除外するフィルタとして使う。
- **`moon`(月)スプレッドの直接分岐という1箇所の例外。** `SpreadConfig`のフィールドでは表現されておらず、`startWave`関数内に`if (spreadId === 'moon') { ... }`という**唯一のハードコードされた条件分岐**がある(場札の奥側=各列の先頭側、操作可能な手前側とは反対の`floor(rows/2)`枚を裏向きにする処理)。これはWeb版でも意図的な唯一の例外であり、他の9スプレッドのように`SpreadConfig`の汎用フィールドへ一般化されていない。**Godot移植でも同じ形(汎用データに無理に押し込めず、`spreadId`を直接比較する1箇所の分岐として実装する)で例外処理すること。** 無理に`SpreadConfig`側のフィールドとして抽象化しようとすると、Web版との対応が取りづらくなるため推奨しない。

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/sabotage.ts`(44行): `SABOTAGE_POOL`・`eligibleSabotageIds`・`rollSabotage`・`sabotageActionName`/`sabotageActionDesc`。全文をそのまま移植の土台にできる短いファイル。
- `src/lib/game/shidasu/sabotageEffects.ts`(約660行): `SabotageContext`/`SabotageResult`の型定義(1〜72行目)、32個の`apply*`関数(74〜397行目付近)、ディスパッチャ`applySabotageEffect`(398行目〜)。
- `src/lib/game/shidasu/sabotage.test.ts`・`sabotageEffects.test.ts`: 妨害系の既存テスト。特に`sabotageEffects.test.ts`は「`SABOTAGE_POOL`全件が正規の`RunState`/`WaveState`に対して例外なく実行できる」ことだけを検証する軽量なテストで、GDScript移植後の疎通確認にそのまま使える発想。
- `src/lib/game/shidasu/engine.ts`: `triggerSabotage`(1314行目付近)、`stageModifierFor`/`bossScoreLockFor`(901〜932行目付近)、`isBossWave`(902行目)、`resolveEffectiveItems`/`resolveSealedRoleEffect`/`resolveComboCap`/`resolvePlayContext`(1282〜1935行目付近)、`beginRun`(1047行目付近、`SpreadConfig`の適用順序)、`startWave`(140行目付近、`moon`分岐は179〜186行目)、`waveTarget`(937行目付近)。
- `src/lib/game/shidasu/types.ts`: `SabotageActionId`/`StarSabotage`(7〜22行目)、`SpreadId`/`SpreadConfig`(24〜67行目のコメントに各スプレッドの効果概要あり)、`StarRestriction`/`Star`(70〜94行目)、`WaveState.activeSeal`/`lastSabotage`/`lastStockShuffle`(348〜369行目)。
- `docs/shidasu/shidasu-spread-candidates.md`: スプレッド10種の設計検討メモ(フェーズ1のカタログと合わせて、各スプレッドの意図・ネーミング由来を把握するのに使う)。
- `shidasu.config.json`: `sabotageActions`(name/descTemplate/intervalTurns等の実データ)・`spreads`(SpreadConfig各フィールドの実データ)・`stars`(waveSlot/restriction/sabotage/reward/targetMultiplier)。

## 成果物・保存先

- Godotプロジェクト側: 妨害行動32種の効果実装(`SabotageContext`相当の依存性注入構造を含む)、封印系の統合、`stageModifierFor`/`bossScoreLockFor`相当の実装、スプレッド10種の`SpreadConfig`データとデッキ生成/Wave開始/ショップへの接続。
- 固定シード+コンソール/テストから、Run開始(スプレッド選択含む)→複数ステージ・複数ウェーブ進行→妨害発動→ショップ→Run終了(All Clear or Game Over)までを一気通貫でシミュレートできるスクリプト/テスト一式(次フェーズ10の土台にもなる)。

## 完了条件

- [ ] `SABOTAGE_POOL`相当が32件、ID重複なしで定義されている
- [ ] 32種すべての`apply*`効果が実装され、正規の`RunState`/`WaveState`を渡してエラーなく完走することを確認した(Web版の`sabotageEffects.test.ts`と同等の疎通テスト)
- [ ] `activeSeal`が常に最大1件しか存在しないこと、新しい妨害発動時に必ずリセットされてから再設定されることを確認した
- [ ] `resolveEffectiveItems`/`resolveSealedRoleEffect`/`resolveComboCap`相当が実装され、フェーズ5のスコアリングパイプラインから呼ばれている
- [ ] `stageModifierFor`/`bossScoreLockFor`相当が実装され、`noLoop`/`faceLock`/`lowCombo`/`oddCombo`/`suit`/`face`の6種の`restriction`が正しく取得可否制限/得点ロックへ振り分けられることを確認した
- [ ] スプレッド10種すべてが`SpreadConfig`相当のデータとして定義され、デッキ生成・目標スコア・ショップ品揃えの3箇所に接続されている
- [ ] `moon`スプレッドのみの直接分岐が(汎用データに一般化せず)1箇所の明示的な条件分岐として実装されている
- [ ] 固定シードで1Run分(複数ステージ・妨害発動・ショップ購入を含む)をUIなしでシミュレートできることを確認した

## 注意点

- 妨害効果の一部(没収系・強制発動系)は護符/秘儀/天啓/神託/レリックの実データを直接書き換える。フェーズ6〜8で移植したそれぞれのデータ構造(`instanceId`による個体識別など)と矛盾がないか、実装時に必ず突き合わせること。
- `SabotageResult`の見た目用フィールド(`affectedTableauCols`等)は本フェーズでは「データとして持たせる」だけで良く、実際のアニメーション接続はフェーズ12(シグナル発火設計)・フェーズ13(演出実装)の担当。本フェーズで見た目まで作り込む必要はない。
- `moon`スプレッドの例外分岐を汎用フィールド化しないこと(上記5.参照)。Web版の設計判断をそのまま踏襲するのが移植の正確性の観点で望ましい。
- 32種・10種という件数はフェーズ1のカタログと必ず突き合わせ、抜け漏れがないか確認すること。
