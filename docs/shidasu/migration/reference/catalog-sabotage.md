# 妨害行動(Sabotage Action)全件カタログ

Godot移植フェーズ1向けの資料。対象は`src/lib/game/shidasu/`配下。

- 型定義(正本): `types.ts`の`SabotageActionId`(32件)
- 抽選プール: `sabotage.ts`の`SABOTAGE_POOL`(32件、`types.ts`の`SabotageActionId`と完全一致)
- 実データ(name/target/intervalTurns/descTemplate): `shidasu.config.json`の`sabotageActions`セクション(32件)
- 効果ロジック: `sabotageEffects.ts`(`SABOTAGE_HANDLERS`ディスパッチテーブル、`SabotageContext`経由で依存を注入)
- 抽選・発動トリガーのロジック: `sabotage.ts`(`eligibleSabotageIds`/`rollSabotage`)、`engine.ts`の`triggerSabotage`/`resolveActionSabotage`

件数は`SabotageActionId`ユニオン型32件・`SABOTAGE_POOL`32件・`shidasu.config.json`の`sabotageActions`セクション32件で完全一致を確認済み。

## 発動の仕組み(全件共通の前提)

- 妨害行動は`Star`(Wave単位の「星」)が持つ`StarSabotage`(`{kind:'none'}` / `{kind:'all'}` / `{kind:'some';ids}`)によって有効化される。現状の`shidasu.config.json`の`stars`セクションでは、`waveSlot`1・2の星は`sabotageKind: 'none'`(妨害なし)、`waveSlot`3の4種の星(`closed-loop-planet`/`sealed-noble-planet`/`harsh-planet`/`twisted-odd-planet`/`exiling-color-planet`/`regicide-planet`)はすべて`sabotageKind: 'all'`(=`SABOTAGE_POOL`全32件が抽選対象)。`{kind:'some'}`は型としては存在するが現状未使用。
- `rollSabotage(params, sabotage, rand)`(`sabotage.ts`) — `eligibleSabotageIds`で対象idリストを取得し、空でなければランダムに1件を選び、`pendingSabotageId`と`sabotageTurnsRemaining`(`params.sabotageActions[id].intervalTurns`)を設定する。Wave開始時(`startWave`)に一度呼ばれる。
- プレイヤーが1手(`playCard`または`drawStock`)行うたび、`sabotageTurnsRemaining`が1減る。0になった時点で次のアクション適用後に`resolveActionSabotage`が`triggerSabotage`を呼び、妨害行動が実際に発動する。
- `triggerSabotage(params, run, id, rand)`(`engine.ts`) — 発動直前に必ず`wave.activeSeal`を`null`にリセットしてから、`applySabotageEffect(id, ctx)`(`sabotageEffects.ts`)で効果を適用し、その後`rollSabotage`で次の妨害を再抽選する(サイクルが繰り返される)。
- **封印系は同時に最大1件しか成立しない**: `WaveState.activeSeal`は単一の判別共用体(`null`か下記いずれか1種)であり、新しい妨害が発動するたびに直前の封印は必ず解除されてから新しい封印(あれば)が設定される。封印系の効果一覧: `talismanSeal`(kind: `talisman`)、`riteSeal`(kind: `rite`)、`revelationOracleSeal`(kind: `revelationOrOracle`)、`roleSeal`(kind: `role`)、`comboCap`(kind: `comboCap`)、`talismanShuffle`(kind: `talismanHidden`、UI表示のみを隠す封印で効果自体には影響しない)、`roleBias`(kind: `roleBias`)。
- `SabotageContext`(依存性注入): `sabotageEffects.ts`の各効果関数は`{ params, run, wave, rand, useRite, useRevelation, useOracle }`を受け取る。`useRite`/`useRevelation`/`useOracle`は循環import回避のため`engine.ts`から呼び出し元(`triggerSabotage`)が値として注入する(`riteForceActivate`/`revelationOracleForceActivate`が使用)。
- `activeSeal`が実際の計算に反映される箇所(`engine.ts`):
  - `resolveEffectiveItems(items, activeSeal)` — `kind: 'talisman'`封印中は該当`instanceId`の護符を効果対象から除外する。
  - `resolveSealedRoleEffect(activeSeal)` — `kind: 'role'`封印中は該当役を`zeroRoles`(レベル0=無効)扱いに、`kind: 'revelationOrOracle'`かつ`ref.kind==='oracle'`の封印中はその役を`oracleBaselineRole`(レベル1固定)扱いに、`kind: 'roleBias'`は`buffed`役に`multiplier`倍・`nerfed`役に`1/multiplier`倍を適用する。
  - `resolveComboCap(activeSeal)` — `kind: 'comboCap'`封印中はコンボ増加の上限値(`max`)を返す。

以下、`SabotageActionId`の宣言順(`types.ts`/`SABOTAGE_POOL`と同順)に全32件を記載する。

---

### 1. `stockPurge`(大量放出)

- **target**: 山札 / **intervalTurns**: 6
- **効果**: 山札の上から最大5枚(`Math.min(5, stock.length)`)を捨て札に置く。捨て札の最後尾が裏向き(`faceUp === false`)なら移動するカードも裏向きに揃える。
- **実装**: `applyStockPurge` — `wave.stock`/`wave.discardPile`を更新、`purgedToDiscardCount`(移動枚数)を結果に含める(UI移動アニメ用)。
- **依存State**: `WaveState.stock`, `WaveState.discardPile`。

### 2. `columnReturn`(一列戻し)

- **target**: 場札 / **intervalTurns**: 6
- **効果**: ランダムな1列を選び、その列+山札全体をプールにしてシャッフルし、元の列の枚数分だけ裏向きで同じ列に再配布する(残りは新しい山札になる)。
- **実装**: `applyColumnReturn` — `wave.tableau[colIndex]`と`wave.stock`を更新、`affectedTableauCols: [colIndex]`を返す。
- **依存State**: `WaveState.tableau`, `WaveState.stock`。

### 3. `chainSettle`(強制清算)

- **target**: チェーン / **intervalTurns**: 8
- **効果**: チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする(山札が0枚なら新しいチェーンなしでリセットのみ)。コンボも0にする。
- **実装**: `applyChainSettle` — `resetComboFields`(`waveReset.ts`)をベースに`activeSeal: null`で明示上書き(`wave`基準で呼ぶため古い`activeSeal`が紛れ込むのを防ぐ)。
- **依存State**: `WaveState.chain`, `chainOrigin`, `stock`, `discardPile`, `combo`, `activeSeal`。

### 4. `comboBreather`(強制小休止)

- **target**: コンボ / **intervalTurns**: 5
- **効果**: チェーンはそのまま、コンボ数だけ0にする。
- **実装**: `applyComboBreather` — `wave.combo`を`0`に、`numericChangeTarget: {kind:'combo', amount: 元のcombo値}`を返す。
- **依存State**: `WaveState.combo`。

### 5. `talismanSeal`(護符封印)〔封印系〕

- **target**: 護符 / **intervalTurns**: 5
- **効果**: 所持護符からランダムに1つ選び、次の妨害発動まで効果を無効化する。未所持なら発動しない(no-op)。
- **実装**: `applyTalismanSeal` — `activeSeal: {kind:'talisman', instanceId, id}`を設定。`resolveEffectiveItems`が実際の無効化を担う。
- **依存State**: `RunState.items`, `WaveState.activeSeal`。

### 6. `riteSeal`(秘儀封印)〔封印系〕

- **target**: 秘儀 / **intervalTurns**: 5
- **効果**: 所持秘儀からランダムに1つ選び、次の妨害発動まで使用を禁止する。未所持ならno-op。
- **実装**: `applyRiteSeal` — `activeSeal: {kind:'rite', instanceId, id}`を設定(使用禁止の実判定は`canUseRite`等、秘儀使用処理側が`activeSeal`を参照する)。
- **依存State**: `RunState.rites`, `WaveState.activeSeal`。

### 7. `revelationOracleSeal`(天啓・神託封印)〔封印系〕

- **target**: 天啓・神託 / **intervalTurns**: 5
- **効果**: 所持中の天啓または神託(合算プール)からランダムに1つ選び、次の妨害発動まで使用禁止にする。合算プールが空ならno-op。
- **実装**: `applyRevelationOracleSeal` — `run.revelations`と`run.oracles`を`HeldRevelationOrOracleRef`として合算したプールから抽選し、`activeSeal: {kind:'revelationOrOracle', ref}`を設定。
- **依存State**: `RunState.revelations`, `RunState.oracles`, `WaveState.activeSeal`。

### 8. `relicConfiscate`(レリック没収)〔没収系〕

- **target**: レリック / **intervalTurns**: 7
- **効果**: 所持レリックからランダムに1つ選び、完全に失わせる(即座に削除、封印とは異なり復帰しない)。未所持ならno-op。
- **実装**: `applyRelicConfiscate` — `run.relics`から該当indexを削除、`confiscatedTarget: {kind:'relic', id, idx}`を返す。
- **依存State**: `RunState.relics`。

### 9. `tableauCardToDiscard`(一枚没収)

- **target**: 捨て札 / **intervalTurns**: 4
- **効果**: 場札からランダムに1枚選び捨て札に送る。場札が空ならno-op。
- **実装**: `applyTableauCardToDiscard` — 全マス目から1点ランダム選択し、`wave.tableau`からその1枚を除去、`wave.discardPile`に追加。`tableauCardRemoved: {colIndex, rowIndex, card}`を返す(個別移動アニメの起点)。
- **依存State**: `WaveState.tableau`, `discardPile`。

### 10. `currencyConfiscate`(通貨没収)

- **target**: 資産(星片) / **intervalTurns**: 6
- **効果**: 所持する星片(通貨)を5減らす(0未満にはしない)。
- **実装**: `applyCurrencyConfiscate` — `run.currency`を`Math.max(0, currency - 5)`に、`numericChangeTarget: {kind:'currency', amount: 実際の減少量}`を返す。
- **依存State**: `RunState.currency`。

### 11. `roleSeal`(役封印)〔封印系〕

- **target**: 役ステータス / **intervalTurns**: 6
- **効果**: `ORACLE_POOL`(全役)からランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する。
- **実装**: `applyRoleSeal` — `rollOffer(ORACLE_POOL, 2, rand)`で2役抽選、`activeSeal: {kind:'role', names}`を設定。`resolveSealedRoleEffect`が`zeroRoles`としてレベル0扱いにする。
- **依存State**: `WaveState.activeSeal`。役自体の判定ロジック(`patterns.ts`)は変更されず、得点計算時のオラクルレベルが0になることでボーナス無効化を実現する。

### 12. `stockPurgeSmall`(少量放出)

- **target**: 山札 / **intervalTurns**: 4
- **効果**: 山札の上から最大2枚を捨て札に置く(`stockPurge`の縮小版)。
- **実装**: `applyStockPurgeSmall` — ロジックは`applyStockPurge`と同型(`n = Math.min(2, ...)`)。
- **依存State**: `WaveState.stock`, `discardPile`。

### 13. `stockShuffle`(山札攪拌)

- **target**: 山札 / **intervalTurns**: 5
- **効果**: 山札の順序をランダムに並び替える(枚数は変わらない)。
- **実装**: `applyStockShuffle` — `shuffleInPlace(stock, rand)`。UI側は`WaveState.lastStockShuffle.seq`のインクリメントを検知して山札ボタンの揺れ演出を起動する。
- **依存State**: `WaveState.stock`, `lastStockShuffle`。

### 14. `tableauFullReturn`(総戻し)

- **target**: 場札 / **intervalTurns**: 8
- **効果**: 場札全体を山札に戻し、シャッフル後、元の各列と同じ枚数配分で裏向きに再配布する。
- **実装**: `applyTableauFullReturn` — `wave.stock`+`wave.tableau.flat()`をプールにシャッフルし、元の列ごとの枚数(`counts`)通りに再分配。`affectedTableauCols`は全列インデックス。
- **依存State**: `WaveState.tableau`, `stock`。

### 15. `tableauShuffle`(総入れ替え)

- **target**: 場札 / **intervalTurns**: 6
- **効果**: 場札の中身を列をまたいでランダムに再配置する(山札には触れない、表向き/裏向きの状態は保持)。
- **実装**: `applyTableauShuffle` — `wave.tableau.flat()`をシャッフルし、元の列ごとの枚数配分通りに再分配。
- **依存State**: `WaveState.tableau`。

### 16. `chainPartialDiscard`(チェーン部分放棄)

- **target**: チェーン / **intervalTurns**: 5
- **効果**: チェーンの先頭(最古)から最大2枚(`Math.min(2, Math.max(0, chain.length - 1))`、最低1枚は残す)を捨て札に送る。コンボはそのまま維持。
- **実装**: `applyChainPartialDiscard` — `wave.chain`/`chainOrigin`の先頭を除去し、除去分を`discardPile`へ追加。
- **依存State**: `WaveState.chain`, `chainOrigin`, `discardPile`。

### 17. `chainShuffle`(チェーン入れ替え)

- **target**: チェーン / **intervalTurns**: 6
- **効果**: チェーンをシャッフルし、新しい末尾を基準カード(foundation相当)にする。
- **実装**: `applyChainShuffle` — `chain`/`chainOrigin`を同じ並び替えインデックスでシャッフルし、`foundation: chain[chain.length-1]`を更新。
- **依存State**: `WaveState.chain`, `chainOrigin`, `foundation`。

### 18. `comboReduce`(コンボ削減)

- **target**: コンボ / **intervalTurns**: 5
- **効果**: コンボ数を3減らす(0未満にはしない)。チェーンには触れない(`comboBreather`との違いは0リセットか固定量減算かの一点)。
- **実装**: `applyComboReduce` — `Math.max(0, combo - 3)`、`numericChangeTarget: {kind:'combo', amount: 実際の減少量}`。
- **依存State**: `WaveState.combo`。

### 19. `comboCap`(コンボ頭打ち)〔封印系〕

- **target**: コンボ / **intervalTurns**: 6
- **効果**: 発動時点のコンボ数を上限として、次の妨害発動までコンボの増加を止める。
- **実装**: `applyComboCap` — `activeSeal: {kind:'comboCap', max: wave.combo}`を設定。`resolveComboCap`が得点計算・コンボ増加処理側に上限値を伝える。
- **依存State**: `WaveState.activeSeal`, `combo`(発動時点のスナップショットを`max`として保持)。

### 20. `talismanConfiscate`(護符没収)〔没収系〕

- **target**: 護符 / **intervalTurns**: 7
- **効果**: 所持護符からランダムに1つ選び、完全に失わせる。未所持ならno-op。
- **実装**: `applyTalismanConfiscate` — `run.items`から該当indexを削除、`confiscatedTarget: {kind:'talisman', id, idx}`を返す。
- **依存State**: `RunState.items`。

### 21. `riteConfiscate`(秘儀没収)〔没収系〕

- **target**: 秘儀 / **intervalTurns**: 6
- **効果**: 所持秘儀からランダムに1つ選び、効果を発動させずに消費させる(単純に削除するのみ)。未所持ならno-op。
- **実装**: `applyRiteConfiscate` — `run.rites`から該当indexを削除、`confiscatedTarget: {kind:'rite', id, idx}`を返す。
- **依存State**: `RunState.rites`。

### 22. `riteForceActivate`(秘儀強制発動)

- **target**: 秘儀 / **intervalTurns**: 6
- **効果**: 使用可能な秘儀(`canUseRite`判定を満たすもの)からランダムに1つ選び、即座に効果を発動させて消費する(通常のプレイヤー操作と同じ`useRite`処理を経由する)。使用可能な秘儀が無ければno-op。
- **実装**: `applyRiteForceActivate` — `SabotageContext.useRite`(engine.tsから注入)を呼び出し、返ってきた`used.wave`の`activeSeal`は`null`に上書き(封印を残さない)。`forceActivatedTarget: {kind:'rite', instanceId, id}`を返す。
- **依存State**: `RunState.rites`, `WaveState`全体(`useRite`の全ての副作用、果断・星霜の加算・`recentUsedRiteIds`更新等を含む)。

### 23. `talismanShuffle`(護符並び替え)〔封印系〕

- **target**: 護符 / **intervalTurns**: 5
- **効果**: 所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き(名称非表示)にする。**効果自体は無効化されない**(UI表示のみを隠す封印)。
- **実装**: `applyTalismanShuffle` — `run.items`をシャッフルし、`activeSeal: {kind:'talismanHidden'}`を設定。UI側(`+page.svelte`)がこのkindを見て護符名を「？？？」表示に切り替える。
- **依存State**: `RunState.items`(並び順)、`WaveState.activeSeal`(表示制御のみ)。

### 24. `revelationOracleConfiscate`(天啓・神託没収)〔没収系〕

- **target**: 天啓・神託 / **intervalTurns**: 7
- **効果**: 所持している天啓または神託(合算プール)からランダムに1つ選び、完全に失わせる。神託を没収した場合、`oracleLevels`は変更しない(温存中の神託はまだ`useOracle`で消費されておらずレベルに未反映のため)。
- **実装**: `applyRevelationOracleConfiscate` — `run.revelations`+`run.oracles`合算プールから抽選し、該当配列から削除。プール内indexをそのまま使う(同名複数所持時のズレ防止のためindexOfを使わない設計)。
- **依存State**: `RunState.revelations`, `RunState.oracles`。

### 25. `revelationOracleForceActivate`(天啓・神託強制発動)

- **target**: 天啓・神託 / **intervalTurns**: 6
- **効果**: 使用可能な天啓(`canUseRevelation`判定を満たすもの)、またはWave進行中(`wave.status==='playing'`)なら所持神託全てを対象に加えたプールからランダムに1つ選び、即座に効果を発動させて消費する。プールが空ならno-op。
- **実装**: `applyRevelationOracleForceActivate` — `SabotageContext.useRevelation`/`useOracle`(engine.tsから注入)を呼び出す。神託の場合`useOracle`、天啓の場合は`revelationNeedsTarget`判定に応じてランダムな対象列を選び`useRevelation`を呼ぶ。`activeSeal`は`null`に上書き。`forceActivatedTarget: {kind:'revelationOrOracle', ref}`を返す。
- **依存State**: `RunState.revelations`, `RunState.oracles`, `WaveState`全体(使用処理の全副作用)。

### 26. `tsukumokaRelease`(付喪化解除)

- **target**: レリック / **intervalTurns**: 6
- **効果**: 付喪化済みレリックがあればランダムに1つ選び、未付喪化状態(`tsukumoka: false`)に戻す。付喪化済みレリックが無ければno-op(現状、付喪化させる手段が未実装のため実質常にno-op)。
- **実装**: `applyTsukumokaRelease` — `run.relics.filter(r => r.tsukumoka)`からランダムに1件選び`tsukumoka: false`に更新、`numericChangeTarget: {kind:'tsukumoka', relicId}`を返す。
- **依存State**: `RunState.relics`。

### 27. `discardErase`(捨て札消去)

- **target**: 捨て札 / **intervalTurns**: 6
- **効果**: チェーンのカードを捨て札に送り、捨て札全体(元の捨て札+今回送られたチェーン)をシャッフルしてから、元のチェーン枚数分を新しいチェーンとして引き直す(残りが新しい捨て札になる)。新チェーンの起源は全て`'draw'`扱いになる。
- **実装**: `applyDiscardErase` — `[...discardPile, ...chain]`をシャッフルし、先頭`chainCount`枚を新チェーン、残りを新捨て札に。`foundation`も新チェーンの末尾に更新。`redistributedAreas: {kind:'chainAndDiscard'}`を返す。
- **依存State**: `WaveState.chain`, `chainOrigin`, `discardPile`, `foundation`。

### 28. `discardBury`(捨て札埋没)

- **target**: 捨て札 / **intervalTurns**: 5
- **効果**: 捨て札の中身を山札に戻し混ぜ込み、同じ枚数(元の捨て札枚数)を山札から裏向きで捨て札に移す(実質的に捨て札の中身を山札内に埋没させ、別のランダムなカード群で置き換える)。
- **実装**: `applyDiscardBury` — `[...stock, ...discardPile]`をシャッフルし、先頭`n`(元の捨て札枚数)枚を裏向き(`faceUp:false`)にして新捨て札、残りを新山札に。`redistributedAreas: {kind:'stockAndDiscard'}`を返す。
- **依存State**: `WaveState.stock`, `discardPile`。

### 29. `rewardReduce`(報酬減少)

- **target**: 資産(星片) / **intervalTurns**: 8
- **効果**: Waveクリア時の通貨報酬から-2する。複数回発動した場合は累積する(ラン終了までリセットされない永続的なマイナス)。
- **実装**: `applyRewardReduce` — `run.rewardPenalty += 2`。実際の減算適用は`resolveWaveEnd`(`engine.ts`)側で`Math.max(0, star.reward - run.rewardPenalty)`として行われる。
- **依存State**: `RunState.rewardPenalty`(ラン全体で永続、`beginRun`で0初期化)。

### 30. `currencyDrain`(通貨強制消費)

- **target**: 資産(星片) / **intervalTurns**: 6
- **効果**: 所持通貨の20%を失わせる(端数切り捨て、0未満にはしない)。
- **実装**: `applyCurrencyDrain` — `loss = Math.floor(currency * 0.2)`、`next = Math.max(0, currency - loss)`。`currencyConfiscate`(固定5減算)との違いは比率ベースである点。
- **依存State**: `RunState.currency`。

### 31. `roleLevelDecay`(役減衰)

- **target**: 役ステータス / **intervalTurns**: 7
- **効果**: `ORACLE_POOL`からランダムな2役を選び、`oracleLevel`を1下げる(下限1、永続的なマイナス。`roleSeal`とは異なり一時的な無効化ではなくレベル自体を恒久的に減らす)。
- **実装**: `applyRoleLevelDecay` — `run.oracleLevels`と`wave.oracleLevels`の両方を同時に更新(`Math.max(1, level - 1)`)、`numericChangeTarget: {kind:'roleLevel', names, amount:1}`を返す。
- **依存State**: `RunState.oracleLevels`, `WaveState.oracleLevels`(ラン全体で永続)。

### 32. `roleBias`(役偏重)〔封印系〕

- **target**: 役ステータス / **intervalTurns**: 6
- **効果**: `ORACLE_POOL`をシャッフルして半分ずつ2グループに分け、次の妨害発動まで、一方のグループ(`buffed`)の役ボーナスを2倍、他方(`nerfed`)を1/2倍にする。
- **実装**: `applyRoleBias` — `activeSeal: {kind:'roleBias', buffed, nerfed, multiplier:2}`を設定。`resolveSealedRoleEffect`が`multipliers`として各役に`multiplier`または`1/multiplier`を適用する形でオラクルレベル計算に反映する。
- **依存State**: `WaveState.activeSeal`。

---

## 補足: 効果分類まとめ

| 分類 | 該当ID |
|---|---|
| 封印系(`activeSeal`を設定、次の妨害発動まで持続) | `talismanSeal`, `riteSeal`, `revelationOracleSeal`, `roleSeal`, `comboCap`, `talismanShuffle`(表示のみ), `roleBias` |
| 没収系(即座に完全消失、復帰なし) | `relicConfiscate`, `talismanConfiscate`, `riteConfiscate`, `revelationOracleConfiscate` |
| 強制発動系(所持品を即時消費) | `riteForceActivate`, `revelationOracleForceActivate` |
| 山札・捨て札操作 | `stockPurge`, `stockPurgeSmall`, `stockShuffle`, `discardErase`, `discardBury` |
| 場札操作 | `columnReturn`, `tableauCardToDiscard`, `tableauFullReturn`, `tableauShuffle` |
| チェーン操作 | `chainSettle`, `chainPartialDiscard`, `chainShuffle` |
| コンボ操作(封印以外) | `comboBreather`, `comboReduce` |
| 通貨・報酬への恒久マイナス | `currencyConfiscate`, `currencyDrain`, `rewardReduce` |
| 役レベルへの恒久マイナス | `roleLevelDecay` |
| レリック付喪化への影響 | `tsukumokaRelease` |
