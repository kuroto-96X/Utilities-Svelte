# 天啓(Revelation)カタログ

Shidasu → Godot移植プロジェクト フェーズ1(現状仕様の資料化)成果物。

- 件数: **28件**(`src/lib/game/shidasu/types.ts`の`RevelationId`型ユニオンメンバー数、`revelations.ts`の`REVELATION_POOL`要素数、`shidasu.config.json`の`revelations`キー数のすべてで一致を確認済み)
- 天啓はいつでも使用可能な消費アイテムで、大きく2系統に分かれる。
  - **Phase A(盤面変換系)**: `kaku`〜`sei`の18種。`applyRevelationEffect`(`revelationEffects.ts`)により**`WaveState`と`deckComposition`(ラン全体のデッキ構成)の両方**を書き換える。盤面上のカードだけでなく永続的なデッキ構成にも反映される点が秘儀との設計差。
  - **Phase B(即時報酬付与系)**: `subaru`/`ryuu`/`hotori`/`chou`/`yoku`/`mitsu`/`karasu`/`oni`/`kyo`の9種+`kyo`(実質10種)。`grantRevelationReward`(`engine.ts`)により**`RunState`側のitems/relics/revelations/oracles/rites/currency**を書き換える。`applyRevelationEffect`側は全てno-opで、`WaveState`/`deckComposition`には影響しない。
- 所持上限は天啓・神託(oracle)の合算枠として基本2(レリック「千羽鶴」所持時は拡張。`revelationOracleMaxCapacity`、`src/lib/game/shidasu/relics.ts`)。同じ種類を複数所持できる。
- 使用時の共通処理(`useRevelation`、`src/lib/game/shidasu/engine.ts`):
  1. `canUseRevelation`で使用可否を判定(下表「使用条件」を参照。個体が妨害「封印系」で`activeSeal.kind==='revelationOrOracle'`かつ`ref.kind==='revelation'`かつ`instanceId`一致の場合は常に使用不可)
  2. `applyRevelationEffect`で`WaveState`・`deckComposition`を更新
  3. 護符「果断」「星霜」所持時、`WaveState.discretionN`/`frostX`にそれぞれ加算(秘儀と共通の副作用)
  4. `RunState.revelations`から使用した個体を除去
  5. `grantRevelationReward`でPhase B系の即時報酬を`RunState`に反映
  6. **自己参照ループ防止**: `RunState.lastUsedRevelationId`(星「hotori」が参照する「直前に使用した天啓」の履歴)は、使用した天啓が`hotori`自身だった場合に限り更新をスキップする(`revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId`)。これにより、hotoriを使ってhotori自身を再取得する自己参照ループを構造的に防止している。hotori以外の天啓を使った場合は必ず履歴が更新される。
  7. 護符「両替」所持時、Phase B報酬適用後の最終的な`items`配列に対して`sellBonus`を加算(適用順序を誤ると効果が消える既知の注意点としてコード内コメントあり)
- 抽選は`REVELATION_POOL`(28種)からの完全均等抽選(`rollRevelationOffer`)。重み付けなし、所持中の種類も除外しない。常に3件返す(秘儀と異なり抽選自体は上限による中断が無く、上限判定は呼び出し側のUI/engine.tsで行う)。
- 列選択(`targetCol`)が必要な天啓: `kaku`/`kou`/`tei`/`bou`/`gyu`/`jo`/`aya`/`shitsu`/`hitsu`の9種(`revelationNeedsTarget`)。それ以外は列選択不要。

以下、`REVELATION_POOL`(＝`revelations.ts`、二十八宿の伝統的な並び順)の掲載順に全28件を記載する。効果の自然文記述は`revelationActualEffects.ts`の`REVELATION_ACTUAL_EFFECTS`(実装を正とする開発者向け監査コメント)と`revelationEffects.ts`/`engine.ts`本体を突き合わせて記述している。

---

## 1. kaku(角)

- **ID**: `kaku`
- **名称**: `角`(`shidasu.config.json` `revelations.kaku.name`)
- **効果**: 選んだ1列の非ワイルドカードを全て♠に変換し、`deckComposition`の対応する枠(deckId一致)も同じスートに書き換える。ワイルドは対象外。
- **使用条件**: `canUseRevelation`のdefaultケースで常に使用可(列選択自体は`targetCol`がnullなら効果適用がno-opになる)。
- **関連パラメータ**: なし(`name`/`desc`のみ)
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A(盤面変換系)

## 2. kou(亢)

- **ID**: `kou`
- **名称**: `亢`
- **効果**: 選んだ1列の非ワイルドカードを全て♥に変換し、`deckComposition`の対応する枠も同じスートに書き換える。ワイルドは対象外。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 3. tei(氐)

- **ID**: `tei`
- **名称**: `氐`
- **効果**: 選んだ1列の非ワイルドカードを全て♦に変換し、`deckComposition`の対応する枠も同じスートに書き換える。ワイルドは対象外。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 4. bou(房)

- **ID**: `bou`
- **名称**: `房`
- **効果**: 選んだ1列の非ワイルドカードを全て♣に変換し、`deckComposition`の対応する枠も同じスートに書き換える。ワイルドは対象外。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 5. shin(心)

- **ID**: `shin`
- **名称**: `心`
- **効果**: 場札全体の非ワイルド♠を全て♥に変換し、`deckComposition`の対応する枠も書き換える(♠以外・ワイルドは対象外)。列選択不要。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 6. bi(尾)

- **ID**: `bi`
- **名称**: `尾`
- **効果**: 場札全体の非ワイルド♥を全て♣に変換し、`deckComposition`の対応する枠も書き換える(♥以外・ワイルドは対象外)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 7. ki(箕)

- **ID**: `ki`
- **名称**: `箕`
- **効果**: 場札全体の非ワイルド♣を全て♦に変換し、`deckComposition`の対応する枠も書き換える(♣以外・ワイルドは対象外)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 8. to(斗)

- **ID**: `to`
- **名称**: `斗`
- **効果**: 場札全体の非ワイルド♦を全て♠に変換し、`deckComposition`の対応する枠も書き換える(♦以外・ワイルドは対象外)。`shin→bi→ki→to`で♠→♥→♣→♦→♠の循環を構成する4種の最後。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 9. gyu(牛)

- **ID**: `gyu`
- **名称**: `牛`
- **効果**: 選んだ1列の非ワイルドカードを、1枚ごとに個別抽選でランクA〜10(数値1〜10)のいずれかへ変換し、`deckComposition`の対応する枠も同じランクに書き換える。ワイルドは対象外。
- **関連パラメータ**: なし(候補ランク`[1..10]`はコード内定数)
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 10. jo(女)

- **ID**: `jo`
- **名称**: `女`
- **効果**: 選んだ1列の非ワイルドカードを、1枚ごとに個別抽選でランクJ・Q・K(数値11〜13)のいずれかへ変換し、`deckComposition`の対応する枠も同じランクに書き換える。ワイルドは対象外。
- **関連パラメータ**: なし(候補ランク`[11,12,13]`はコード内定数)
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 11. kyo(虚)

- **ID**: `kyo`
- **名称**: `虚`
- **効果**: `applyRevelationEffect`側はno-op(`WaveState`/`deckComposition`は変更しない)。`useRevelation`内の`grantRevelationReward`で実施: `targetRelicId`で指定されたレリックが`RunState.relics`に存在し、かつ未付喪化(`tsukumoka: false`)であれば、そのエントリの`tsukumoka`をtrueに更新する。`targetRelicId`がnull、対象が存在しない、または既に付喪化済みの場合は何もしない。
- **使用条件**: `canUseRevelation`で「未付喪化の所持レリックが1つ以上ある」ことが必要(`relics.some(r => !r.tsukumoka)`)。
- **関連パラメータ**: なし
- **依存State**: `RunState.relics`(読み書き)。系統: Phase B(即時報酬付与系)

## 12. aya(危)

- **ID**: `aya`
- **名称**: `危`
- **効果**: 選んだ1列の一番上にワイルドを1枚追加する。`deckComposition`にも新規ワイルドエントリを1件追加する(`deckId`は配列長を採番して衝突を回避)。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き、新規要素追加)。系統: Phase A

## 13. shitsu(室)

- **ID**: `shitsu`
- **名称**: `室`
- **効果**: 選んだ1列の各カード(位置iごと)を、1つ左の列の同じ位置iのカードのランク+1(A⇔Kループ)に変換する。左端の列(列0)を選んだ場合の参照列は最終列。左列がワイルドの位置・左列の方が短く対応する位置が無い場合・選択列自身がワイルドの位置はスキップする。`deckComposition`の対応する枠も同じランクに書き換える。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 14. heki(壁)

- **ID**: `heki`
- **名称**: `壁`
- **効果**: 場札全体の非ワイルドカードを、変換前のスート基準の対応表(♠→♥、♥→♣、♣→♦、♦→♠)で1回だけ変換する。逐次適用ではないため、変換結果がさらに連鎖してカスケードすることはない。`deckComposition`の対応する枠も書き換える。ワイルドは対象外。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 15. kei(奎)

- **ID**: `kei`
- **名称**: `奎`
- **効果**: 空でない列を左から順に走査し、最初の空でない列の一番上(末尾)のカードのランクを起点(base)に、i番目(空列を除いた順番)の空でない列の一番上のカードを`base+i`(A⇔Kループ)に変換する。空の列は無視(順番のカウントにも含めない)。一番上がワイルドの列は変換しないが、順番(i)としてはカウントする。`deckComposition`の対応する枠も書き換える。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 16. rou(婁)

- **ID**: `rou`
- **名称**: `婁`
- **効果**: 場札の全ての列の一番上(末尾)のカード(ワイルド含む)を`wave.tableau`から取り除く。`deckComposition`側は配列から削除せず`removed: true`にする(`deckId`の採番が配列長基準のため、削除すると新規カード追加時に衝突するのを避けるための設計)。空の列はスキップ。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き、`removed`フラグ更新)。系統: Phase A

## 17. i(胃)

- **ID**: `i`
- **名称**: `胃`
- **効果**: 場札の非ワイルド実カードから最大ランク・最小ランクをそれぞれ求め、該当カード(複数あればランダムに1枚)をそれぞれ`wild: true`に変換する。最大ランクと最小ランクが同じ(場札の実カードが全て同ランク等)の場合、最大側で選んだカードを最小側の候補から除外して二重選出を防ぐ。`wave.tableau`・`deckComposition`双方を更新する。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 18. hitsu(畢)

- **ID**: `hitsu`
- **名称**: `畢`
- **効果**: 選んだ1列の先頭カード(`col[0]`)のランクを起点に、使用ごとにランダムな方向(昇順/降順)で階段状のランク(A⇔Kループ)へ再配置する。秘儀「raidho」が2026-08-11の削除前に持っていたのと同じアルゴリズム。他の天啓と異なり、ワイルドカードもスキップせずランク変換の対象にする(意図的な仕様)。`deckComposition`の対応する枠も書き換える。
- **関連パラメータ**: なし
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 19. shi(觜)

- **ID**: `shi`
- **名称**: `觜`
- **効果**: `wave.chain`の末尾1枚を`wild: true`に変換し、`foundation`も更新する。秘儀「ansuz」が2026-08-11の削除前に持っていたのと同じ効果だが、秘儀版と異なり`deckComposition`側にも書き込んで永続化される。チェーンが空の場合は何もしない。
- **関連パラメータ**: なし
- **依存State**: `WaveState.chain`/`foundation`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 20. sei(井)

- **ID**: `sei`
- **名称**: `井`
- **効果**: 場札の非ワイルド実カードから盤面上の位置(列・行)を2次元でランダム抽選し、`n`枚選んで`wild: true`に変換する。秘儀「gebo」ではなく元は秘儀「アンスズ」と同じ方式だったものが天啓へ転用された(コメント記載どおり)。秘儀版と異なり`deckComposition`側にも書き込んで永続化される。
- **関連パラメータ**: `revelations.sei.n`(現在値1)
- **依存State**: `WaveState.tableau`(読み書き)、`RunState.deckComposition`(読み書き)。系統: Phase A

## 21. subaru(昴)

- **ID**: `subaru`
- **名称**: `昴`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で実施: `ITEM_POOL`から所持中の護符を除いた候補からランダムに1つ選び、`RunState.items.length < itemMaxCapacity(params, run)`(護符所持上限。レリック「招き布袋像」所持時は拡張)なら所持に追加する。選ばれた護符が`favor`(恩賞)の場合、`rewardBonus`を`params.talismans.favor.n`で初期化する。候補が0件、または上限到達時は何もしない。
- **関連パラメータ**: なし(参照する`itemMaxCapacity`の基礎値は`items.maxItems`。`revelations.subaru`自体は`name`/`desc`のみ)
- **依存State**: `RunState.items`(読み書き)、`RunState.nextInstanceId`(書き込み、インクリメント)。系統: Phase B

## 22. ryuu(柳)

- **ID**: `ryuu`
- **名称**: `柳`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`RunState.currency`を2倍にする。
- **関連パラメータ**: なし
- **依存State**: `RunState.currency`(読み書き)。系統: Phase B

## 23. hotori(星)

- **ID**: `hotori`
- **名称**: `星`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`RunState.lastUsedRevelationId`(直前に使用した天啓の履歴)を読み取り、対象がnull(履歴が無い)なら何もしない。天啓・神託の合算所持枠(使用中のhotori自身を除去した後の`revelations.length + oracles.length`との差分、基本上限2・レリック「千羽鶴」所持時拡張)に空きが無ければ何もしない。空きがあれば対象の天啓を新規インスタンスとして`RunState.revelations`に追加する。
- **自己参照ループ防止**: `useRevelation`側で、使用した天啓が`hotori`自身の場合に限り`lastUsedRevelationId`の更新をスキップする仕様があるため、hotoriを使ってもその使用自体は「直前に使用した天啓」として記録されない。これにより、hotoriが自分自身を再取得し続ける無限ループを構造的に防止している。
- **関連パラメータ**: なし
- **依存State**: `RunState.lastUsedRevelationId`(読み取り。更新は使用元の`useRevelation`側でhotori以外の場合のみ)、`RunState.revelations`(書き込み)、`RunState.oracles`(読み取り、枠数計算)、`RunState.nextInstanceId`(書き込み)。系統: Phase B

## 24. chou(張)

- **ID**: `chou`
- **名称**: `張`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`ORACLE_POOL`から`rollOffer`により2つ抽選し、天啓・神託合算の残り枠数(使用中のchou自身を除去した後で計算、基本上限2・千羽鶴所持時拡張)までを`RunState.oracles`に追加する(残り枠が2未満なら抽選数もその枠数に制限される)。残り枠が0なら何もしない。
- **関連パラメータ**: なし
- **依存State**: `RunState.oracles`(読み書き)、`RunState.revelations`(読み取り、枠数計算)、`RunState.nextInstanceId`(書き込み)。系統: Phase B

## 25. yoku(翼)

- **ID**: `yoku`
- **名称**: `翼`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`REVELATION_POOL`から`rollOffer`により2つ抽選し、天啓・神託合算の残り枠数(使用中のyoku自身を除去した後で計算)までを`RunState.revelations`に追加する。残り枠が0なら何もしない。
- **関連パラメータ**: なし
- **依存State**: `RunState.revelations`(読み書き)、`RunState.oracles`(読み取り、枠数計算)、`RunState.nextInstanceId`(書き込み)。系統: Phase B

## 26. mitsu(軫)

- **ID**: `mitsu`
- **名称**: `軫`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で所持する各護符の売値(`itemSellPrice(params, run, id, sellBonus)`)を合計し、`RunState.currency`に加算する。護符(items)限定の仕様で、秘儀・天啓・神託の`sellBonus`(還元/refundが対象とする分)はこの合計に含めない(意図的な非対称仕様、コード内コメントで明記)。
- **関連パラメータ**: なし
- **依存State**: `RunState.items`(読み取り)、`RunState.currency`(書き込み)。系統: Phase B

## 27. karasu(参)

- **ID**: `karasu`
- **名称**: `参`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`RunState.recentUsedRiteIds`(最新2件、新しい順)を、秘儀の所持枠の残り数(基本上限3・レリック「破魔矢」所持時拡張、`riteMaxCapacity`)まで先頭から`RunState.rites`に追加する。秘儀の所持枠は天啓・神託の合算枠とは独立している。残り枠が0なら何もしない。
- **関連パラメータ**: なし
- **依存State**: `RunState.recentUsedRiteIds`(読み取り)、`RunState.rites`(読み書き)、`RunState.nextInstanceId`(書き込み)。系統: Phase B

## 28. oni(鬼)

- **ID**: `oni`
- **名称**: `鬼`
- **効果**: `applyRevelationEffect`側はno-op。`grantRevelationReward`で`RELIC_POOL`から所持済み(`RunState.relics`)のidを除いた候補をフィルタし、候補が無ければ何もしない。候補があればランダムに1つ選び、`tsukumoka: false`の状態で`RunState.relics`に追加する。
- **使用条件**: `canUseRevelation`で「未所持のレリックが1つ以上ある」ことが必要(`RELIC_POOL.some(id => !ownedIds.has(id))`)。
- **関連パラメータ**: なし
- **依存State**: `RunState.relics`(読み書き)。系統: Phase B

---

## 数値パラメータ一覧(`shidasu.config.json` `revelations`セクション)

| ID | パラメータキー | 現在値 | 用途 |
|---|---|---|---|
| sei | `n` | 1 | ワイルド化するカード枚数 |

上記以外の27種は数値パラメータを持たず、`name`/`desc`のみ。

## 系統まとめ

| 系統 | 該当ID | 書き換え対象 |
|---|---|---|
| Phase A(盤面変換系・18種) | kaku, kou, tei, bou, shin, bi, ki, to, gyu, jo, aya, shitsu, heki, kei, rou, i, hitsu, shi, sei | `WaveState` + `RunState.deckComposition` |
| Phase B(即時報酬付与系・10種) | kyo, subaru, ryuu, hotori, chou, yoku, mitsu, karasu, oni | `RunState`(items/relics/revelations/oracles/rites/currency) |

Phase A/Bの分類は`applyRevelationEffect`(`revelationEffects.ts`)のハンドラが`noop`かどうかで機械的に判定できる(`REVELATION_HANDLERS`内で`kyo`/`subaru`/`ryuu`/`hotori`/`chou`/`yoku`/`mitsu`/`karasu`/`oni`の9種が`noop`)。
