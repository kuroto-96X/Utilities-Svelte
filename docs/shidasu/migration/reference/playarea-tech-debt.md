# PlayArea.svelte 技術的負債の棚卸し(表示専用スナップショット/ガードフラグパターン)

対象: `src/routes/game/shidasu/PlayArea.svelte`(約1900行)

## 背景・問題の一般形

CLAUDE.md「移動アニメーション実装時の注意」に整理されている通り、このファイルには同じ構造のバグが繰り返し発生している。

> 移動先の常設UI要素が、アニメーション完了前の状態を先出ししていないか確認する。
> 実際のデータ状態(ストア・store・propsなど)はアニメーション開始時点で既に「移動後」の内容に更新済みになっている。移動先の常設UI要素がそのデータ状態を直接参照していると、アニメーションが始まった瞬間(移動が完了していないうち)から完了後の絵が見えてしまう。

Shidasuのゲームロジック(`wave: WaveState`)はReactiveなpropsとして親から渡され、カードプレイ・妨害行動・秘儀/天啓/神託の使用などの結果は**同期的に即座にデータへ反映**される。一方、その変化を画面上で「移動する」「消える」ように見せる演出は数百ms〜1秒程度の非同期処理になる。この時間差を埋めるため、PlayArea.svelteでは各演出ごとに個別に

1. **表示専用の`$state`スナップショット変数**(実データのコピーを保持し、アニメーション完了まで固定する)
2. **ガードフラグ**(常設UI側の描画条件やeffectの追従条件に割り込み、実データへの同期を一時停止させる)

という2点セットの対策を、演出の数だけ個別実装している。Godot移植のフェーズ13(アニメーション・演出の再設計)では、この「個別対策の積み重ね」を、AnimationPlayer/Tween/シグナルベースの構造(例: 「アニメーション完了シグナルを受けてからロジック側の状態を反映する」設計や、State同期を一箇所に集約する仕組み)で解消できないか検討する入力として、発生箇所を以下に列挙する。

---

## 発生箇所一覧

### 1. `displayedScore`(177行目)

- **(a) 何の演出か**: カードプレイ後のスコア加算演出(`scoreReveal`: 内訳パーツが1つずつ画面中央→内訳行へ飛び込み、最後にSCORE欄へ加算数値が飛んでいく)。
- **(b) 先出しされる問題**: `wave.score`はカードプレイ結果が確定した時点で既に加算後の値になっている。SCORE表示が`wave.score`を直接参照すると、飛び込み演出の途中(まだ+n表示や内訳が出ている最中)なのにSCORE欄の数字だけ先に加算後の値へジャンプしてしまう。
- **(c) 対策**: `let displayedScore = $state(wave.score)`という表示専用コピーを持ち、SCORE欄は常に`displayedScore`を参照する(1577行目)。`wave.score`への追従は`$effect`による自動追従ではなく、演出完了ポイントで明示的に代入する方式:
  - `startScoreReveal()`内、加算パーツが0件の場合は即座に`displayedScore = wave.score`(1350行目)
  - `finishScoreReveal()`(飛び込み演出完了時)で`displayedScore = wave.score`(1465行目)
  - waveKey変化時の`$effect`(185〜191行目)で`displayedScore = wave.score`にリセット
  - 副次効果として、`displayedScore`が変化するたびにSCORE数字を軽くパルスさせる別の`$effect`(1332〜1345行目、`previousDisplayedScore`で変化検知)も存在する。

### 2. `displayedDiscardTop`(183行目)

- **(a) 何の演出か**: 捨て札常設UI(山札の下に1枚だけ表示される捨て札トップカード)。関連する演出は複数: チェーンリセット時の捨て札移動(`chainResetAnimation`)、「大量放出」「少量放出」による山札→捨て札移動(`startStockPurgeAnimation`)、「一枚没収」による場札→捨て札移動(`startTableauCardToDiscardAnimation`)。
- **(b) 先出しされる問題**: `wave.discardPile`はいずれの演出でもトリガー時点で既に移動後の内容に更新済み。捨て札常設UIが`wave.discardPile`の末尾を直接参照すると、カードが宙を飛んでいる最中に着地先の見た目だけ先に新しいカードへ切り替わってしまう。
- **(c) 対策**: `displayedDiscardTop`という表示専用スナップショット(1698行目で描画に使用)。追従は`$effect`(724〜727行目)で行うが、ガード条件付き: `if (chainResetAnimation !== null || discardPurgeActive) return`。つまりチェーンリセット中・放出/没収の移動中(`discardPurgeActive`)は追従を止め、演出側の完了処理(`startDiscardFlipReveal`内の818行目、`startStockPurgeAnimation`内の裏向き据え置き分岐856行目)で明示的に`displayedDiscardTop = card`を代入する。

### 3. `discardPurgeActive`(421行目)

- **(a) 何の演出か**: 上記2の「大量放出/少量放出」「一枚没収」の移動アニメーション全体を覆うガードフラグ。
- **(b) 先出しされる問題**: 単に「アニメーション中かどうか」を`discardPurgeCards`配列の中身(setTimeout内で1件ずつ積まれる)から判定しようとすると、`$effect.pre`内で開始関数を呼んだ直後・まだ配列に何も積まれていない一瞬の隙間で`displayedDiscardTop`追従effectが素通りしてしまい、移動後カードが一瞬だけ先出しされる(416〜420行目のコメントに明記された既知の罠)。
- **(c) 対策**: `startStockPurgeAnimation`・`startTableauCardToDiscardAnimation`の**関数先頭**で同期的に`discardPurgeActive = true`へ切り替える(832行目・878行目)。非同期処理(setTimeoutやrequestAnimationFrame)を挟む前に同期的にフラグを立てることで、隙間を作らない。解除は演出完了時(`startDiscardFlipReveal`内819行目、または裏向き据え置き分岐857行目)。`anyAnimationActive`にも算入される(615行目)。

### 4. `chainAreaHiddenForRedistribute`(371行目)

- **(a) 何の演出か**: 妨害行動「捨て札消去」(discardErase)・「捨て札埋没」(discardBury)発動時の「収束→再配布」演出(`discardRedistributeAnimation`/`discardRedistributeCards`)。
- **(b) 先出しされる問題**: チェーンエリアの常設描画は`wave.chain`を直接参照するが、`discardErase`/`discardBury`発動時点で`wave.chain`は既に再配布後の新しい内容になっている。ガードなしだと、収束(カードが1点に集まっていく)アニメーションの最中に、背後の常設チェーンエリアだけ新しい配置へ切り替わって見えてしまう。
- **(c) 対策**: `startDiscardRedistributeAnimation`の関数先頭で同期的に`chainAreaHiddenForRedistribute = true`(1140行目)。チェーンエリアのラッパーdivのクラス条件(1711行目)にこのフラグを含め、trueの間`invisible`にする。解除は再配布の全カード着地後、`startDiscardRedistributeDeal`内(1212行目: 対象0件の早期return時、1229行目: 最後のカード着地時)。`anyAnimationActive`にも算入される(615行目)。

### 5. `sabotageAnimatingColumns`(385行目)

- **(a) 何の演出か**: 妨害行動「総戻し」(tableauFullReturn)・「一列戻し」(columnReturn)発動時、対象列のカードが山札位置へ収束してから配り直される演出(`sabotageRedistributeAnimation` → `startSabotageDealAnimation`)。
- **(b) 先出しされる問題**: `wave.tableau`は発動時点で既に戻された後の新しい配置になっている。ガードなしだと収束アニメーション中に対象列の実データ(場札)がいきなり新配置に切り替わって見える。
- **(c) 対策**: `startSabotageRedistributeAnimation`内で`sabotageAnimatingColumns = new Set(affectedCols)`(919行目)をセットし、場札描画側で`isHiddenForSabotageRedistribute`(1636行目)として`invisible`クラスに反映(1640行目)。解除は収束が終わり配り直しフェーズに入った時点(`startSabotageDealAnimation`冒頭、966行目)。**注意点**: 配布完了まで待たずに配布フェーズ開始と同時に解除しており(コメント959〜965行目)、これは「1枚ずつ着地するたびに`dealtCells`登録で表示を切り替える」別の仕組み(下記6)に表示制御を引き継ぐ設計。`anyAnimationActive`にも算入。

### 6. `dealtCells` / `dealAnimationActive`(608〜612行目)

- **(a) 何の演出か**: 新Wave開始時の配布演出(`startDealAnimation`)、および5の「総戻し/一列戻し」後の配り直し演出(`startSabotageDealAnimation`)。山札位置から各マス目へカードが1枚ずつ飛んでいく。
- **(b) 先出しされる問題**: 配布対象のマス目の実データ(`wave.tableau`)は演出開始前から既に埋まっている。ガードなしだと、まだ飛んでいる途中のカードの着地先マス目に、最初から実カードが表示されてしまう(=カードが2重に見える/飛んでいる意味がなくなる)。
- **(c) 対策**: 着地済みマス目を`"col-row"`文字列で`dealtCells`(Set)に登録していく方式。`dealAnimationActive = $derived(dealingCards.length > 0)`が真の間、`dealtCells`に含まれないマス目を`isNotYetDealt`(1635行目)として`invisible`にする(1640行目)。1枚着地するたびに`dealOneCard`内(1058行目)、フリップ演出が絡む場合は`startFlipReveal`完了時(786行目)に登録される。waveKey変化時に`dealtCells = new Set()`へリセット(`startDealAnimation`冒頭997行目)。

### 7. `cleanedUpColumns` / `chainCleanedUp`(343〜344行目)

- **(a) 何の演出か**: Waveクリア確定後、場札の各列→チェーン→捨て札の順に1山にまとめて山札へ吸い込ませる片付け演出(`cleanupAnimation`、`startCleanupAnimation`/`processNextCleanupItem`/`startCleanupItem`)。
- **(b) 先出しされる問題**: この演出はキュー(`cleanupQueue`)を1件ずつ処理する設計で、`cleanupAnimation`は「現在処理中の1件」しか保持しない。ある列の吸い込みが完了して次の列(またはチェーン)の処理に移った瞬間、`cleanupAnimation`はもう前の列を指していないため、ガードなしだと前の列の実データ(`wave.tableau`はWave終了後も次Wave開始まで変化しないため、まだ古いカードが残っている)が再び表示されてしまう(せっかく吸い込んだのに列にカードが戻って見える)。
- **(c) 対策**: 列を吸い込み終わった瞬間(`runGatherAndMoveAnimation`の`onMoveStart`コールバック、1319〜1325行目)に`cleanedUpColumns`へ列インデックスを追加、チェーンなら`chainCleanedUp = true`。場札描画側では`isCleaningUpThisColumn = (cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci) || cleanedUpColumns.has(ci)`(1634行目)、チェーンエリアも`chainCleanedUp`をラッパーの`invisible`条件に含める(1711行目)。リセットは次WaveのwaveKey変化時(`$effect`189〜190行目)と`startCleanupAnimation`冒頭(732〜733行目)。

### 8. `tableauShuffleActive`(436行目)

- **(a) 何の演出か**: 妨害行動「総入れ替え」(tableauShuffle)発動時、場札全体が一瞬裏向き表示+シェイクしてから新配置を見せる演出。
- **(b) 先出しされる問題**: `wave.tableau`は発動と同時に新しい配置(シャッフル後)へ更新済み。ガードなしだと場札の各カードの見た目(絵柄)がシェイク開始と同時に新しい絵柄で表向き表示されてしまい、「入れ替わった」感が出ない。
- **(c) 対策**: `tableauShuffleActive`をtrueにしている間、各カードの`displayFaceUp`計算(1638行目)で`!tableauShuffleActive && (card.faceUp !== false || isTop)`とし、強制的に裏向き扱いにする。400ms後(`startTableauShuffleAnimation`、599〜605行目)にfalseへ戻すと同時に、CSSシェイク(`shidasu-numeric-shake`)がラッパー要素(1627行目)に適用される。`anyAnimationActive`にも算入。

### 9. `confiscateFadingTarget` / `confiscateFadingActive`(493〜494行目)

- **(a) 何の演出か**: 妨害行動「没収系」(talismanConfiscate・riteConfiscate・revelationOracleConfiscate・relicConfiscate)発動時、対象バッジ(護符/秘儀/天啓・神託/レリック)が光ってから崩れ落ちるフェード演出。
- **(b) 先出しされる問題**: 対象アイテムは`triggerSabotage`実行と同時に実データ(`items`/`rites`/`revelations`等のリスト)から削除済み。ガードなしだと、フェード演出を描画しようにも「消える対象」自体がリストから既に消えていて描画できない(=フェードなしで瞬時に消えて見える)。
- **(c) 対策**: `startConfiscateFadeAnimation`の関数先頭で同期的に`confiscateFadingActive = true`とし、削除される直前の対象情報を`confiscateFadingTarget`に保持する(501〜511行目)。各バッジ描画箇所はモジュールスクリプトの`withFadingId()`(17〜21行目)を使い、「本来のリスト(既に削除済み)」+「フェード中要素」を指定位置に補完した配列を作って描画する(例: 1736〜1738行目の秘儀バッジ一覧)。500ms後に`confiscateFadingActive = false`・`confiscateFadingTarget = null`に戻すと、補完されていた要素も自然に消える。

### 10. `pressPulseTarget` / `pressPulseActive`(519〜520行目)

- **(a) 何の演出か**: 妨害行動「強制発動系」(riteForceActivate・revelationOracleForceActivate)、および秘儀・天啓・神託の通常クリック発動時に共通適用する「自動プレスされたように縮んで光る」パルス演出。
- **(b) 先出しされる問題**: 秘儀・天啓・神託は使用と同時に所持リストから即座に消費される(モジュールスクリプト冒頭8〜16行目のコメント参照)。ガードなしだと、パルス対象のボタン自体がリストから消えてしまい描画できない。
- **(c) 対策**: 9と同様に`withFadingId()`で「消費済みだがまだパルス表示すべき対象」を末尾に補完する(1737〜1738行目、1758〜1759行目)。ただし9(没収)と異なりidxを持たない型のため、常に`list.length`(末尾)へ補完する設計(モジュールスクリプトのコメントに既知の制限として、同名インスタンスが複数ある場合に別インスタンスがパルスすることがある旨が明記されている)。`pressPulseActive`自体は`anyAnimationActive`には含めない(通常クリック発動は効果が同期的に即座に適用されるため、演出完了を待って次操作をブロックする必要がない、というコメントが524〜525行目にある)。

### 11. `numericPopupTarget` / `numericPopupActive`(544〜545行目)

- **(a) 何の演出か**: 妨害行動「数値変化系」(comboBreather・comboReduce・currencyConfiscate・currencyDrain・roleLevelDecay・roleBias・tsukumokaRelease)発動時、対象UI要素がシェイクしつつ変化量のポップアップテキスト(例: 「−3」「×0.5」)を表示する演出。
- **(b) 先出しされる問題**: 対象の数値(コンボ・通貨・役レベル等)は発動と同時に変化後の値に更新済み。ポップアップの表示テキスト自体は変化量(`target.amount`等)を保持しているため値そのものの先出しは起きにくいが、シェイク対象の判定(`comboNumericPopup`等、1568行目)や、対象が既に別の状態に変わっている場合(例: 役バイアスの対象役名)に、どのUI要素にシェイク+ポップアップを乗せるかを実データからではなく`numericPopupTarget`スナップショットから判定する必要がある。
- **(c) 対策**: `startNumericPopupAnimation`の関数先頭で同期的に`numericPopupActive = true`、`numericPopupTarget`に対象情報を保持(551〜561行目)。テキスト生成はモジュールスクリプトの`numericChangePopupText()`(29〜38行目)が`numericPopupTarget`の内容から算出する。500ms後にリセット。`pressPulseActive`と同じ理由で`anyAnimationActive`には含めない。

### 12. `sealFlashTarget` / `sealFlashActive`(451〜452行目)

- **(a) 何の演出か**: 妨害行動「封印系」(talismanSeal・riteSeal・revelationOracleSeal・roleSeal・comboCap)発動時、対象UI要素がフラッシュ+シェイクする演出。
- **(b) 先出しされる問題**: 封印状態自体は`wave.activeSeal`としてWave終了まで持続するため、これ単体では「先出し」問題は起きにくい(むしろ`wave.activeSeal`をそのまま使ってフラッシュ対象を判定してよい)。ただし「発動した瞬間だけ」フラッシュ+シェイクを起こしたいので、`wave.activeSeal`の値そのものではなく「今まさに発動した」というタイミング情報を独立した`$state`として持つ必要がある。
- **(c) 対策**: `startSealFlashAnimation`関数先頭で同期的に`sealFlashActive = true`とし、`sealFlashTarget`に対象を保持(463〜473行目)。500ms後にリセットして`sealFlashTarget = null`に戻すと、以後は各UI要素の常設判定(`wave.activeSeal`ベース)にそのまま委ねる設計。`anyAnimationActive`に算入。

### 13. `talismanShuffleFlashActive`(458行目)

- **(a) 何の演出か**: 妨害行動「talismanShuffle」(護符並び替え)発動時、所持護符バッジ全てが同時にフラッシュ+シェイクする演出。
- **(b) 先出しされる問題**: 12(sealFlashTarget)と同種で、対象を1つに絞れない(常に「全護符」固定)ため対象識別情報を持たないboolean一つのみ。それ自体が「先出し」問題を直接解決するものではなく、発動タイミングを独立して保持する12と同型のガードフラグ。
- **(c) 対策**: `startTalismanShuffleFlashAnimation`(478〜486行目)で同期的にtrueへ切り替え、500ms後にfalseへ。`anyAnimationActive`には**含まれていない**(615行目のリストにtalismanShuffleFlashActiveは無い)。

### 14. `stockShuffleActive` / `chainShuffleActive`(427〜429行目、441〜443行目)

- **(a) 何の演出か**: 「山札攪拌」(stockShuffle妨害行動・dagaz秘儀)・「チェーン入れ替え」(chainShuffle妨害行動)発動時、対象要素(山札ボタン/チェーンエリア)がその場で軽く左右にシェイクする演出。共通ロジックは`startShakeAnimation`(567〜583行目)。
- **(b) 先出しされる問題**: 他の項目と異なり、これらは**実データの表示内容そのものを隠す必要がない**(山札は枚数のみ表示、チェーンは個々のカードの絵柄は変わらず並び順が変わるだけ)ため、常設UI側に`invisible`クラス等の隠蔽条件としては使われていない(1627行目のtableauShuffleActiveとは対照的に、チェーンエリアの1711行目のinvisible条件にchainShuffleActiveは含まれていない)。
- **(c) 対策との違い**: `stockShuffleActive`/`chainShuffleActive`は関数先頭で同期的にtrueへ切り替える点は他と同じ原則(423〜426行目のコメントに明記)だが、目的は「見た目の先出し防止」ではなく**「演出中の二重操作防止」**(`anyAnimationActive`経由で山札引き・秘儀/天啓使用をブロックする)。つまり同じ「関数先頭で同期的にフラグを立てる」実装イディオムが、(A)表示の先出し防止、(B)操作の二重発火防止、という2つの異なる目的に流用されている。フェーズ13で構造的な解消を検討する際は、この2種類の目的を混同しないよう注意が必要(`anyAnimationActive`という単一の集約フラグに両方が乗っているため、目的ごとに分離しにくくなっている)。`stockShuffleActive`は`anyAnimationActive`に算入されるが、`chainShuffleActive`は算入されていない(615行目参照。両者の対称性が崩れている点も技術的負債と言える)。

### 15. `anyAnimationActive`(615行目)

- **(a) 何の演出か**: 演出そのものではなく、上記の個別アニメーション状態を1つに集約した`$derived`。
- **(b) 先出しされる問題**: 個別に対応するものではないが、「いずれかの演出中は操作を無効化する」ために、演出ごとに増えていく状態変数を1箇所でOR結合する必要があり、新しい演出を追加するたびにこの式を手動でメンテナンスする必要がある(実装漏れリスクの温床)。
- **(c) 対策/実体**: `playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive || sealFlashActive || confiscateFadingActive || discardRedistributeAnimation !== null || chainAreaHiddenForRedistribute || tableauShuffleActive || chainShuffleActive`という15項目のOR式。前述の通り`talismanShuffleFlashActive`・`pressPulseActive`・`numericPopupActive`は意図的に含まれていない(効果が同期即時適用のため演出完了を待つ必要がないという設計判断だが、この非対称性はコメントを読まないと理由が分からない)。

### 16. `flippingCards`(394行目)/ `discardFlip`(413行目)

- **(a) 何の演出か**: カードの裏返り演出。`startFlipReveal`(場札マス目、762〜791行目)/`startDiscardFlipReveal`(捨て札、800〜824行目)。90度回転→不可視の瞬間に中身(表向きデータ)に差し替え→0度に戻す3D風表現。
- **(b) 先出しされる問題**: 配布・放出・没収の各演出で、着地したカードは既にfaceUpデータを持っているが、裏返り演出中は「まだ裏面のまま」と「もう表面になった」の間の状態を独自に管理する必要がある(`revealed`フラグ)。着地先の実データ(`wave.tableau`のカード自体、または`displayedDiscardTop`)をそのまま参照すると回転演出を待たずに絵柄が変わって見える。
- **(c) 対策**: `flippingCards`/`discardFlip`という一時的な配列/オブジェクトで、対象カードの`revealed`(中身を表向きに差し替え済みか)・`rotation`・`transitionMs`を個別管理。回転が90度(真横=不可視)になった瞬間(`setTimeout`、FLIP_HALF_MS後)に`revealed: true`へ切り替え、続けて0度へ戻す。完了後は`flippingCards`から除去し`dealtCells`へ登録(786行目)、または`discardFlip = null`にして`displayedDiscardTop`へ確定反映(818行目)。上記2・6と密接に連携する組み合わせ技。

---

## 集計

上記の通り、**表示専用スナップショット/ガードフラグパターンの発生箇所は合計16件**(既知として提示された6件: displayedDiscardTop・chainAreaHiddenForRedistribute・discardPurgeActive・displayedScore・anyAnimationActive・cleanedUpColumns/chainCleanedUpをすべて含む)。

内訳(目的別に分類):

- **実データを直接見せると先出しになるため、演出完了まで隠す/固定するもの**: displayedScore、displayedDiscardTop、discardPurgeActive、chainAreaHiddenForRedistribute、sabotageAnimatingColumns、dealtCells/dealAnimationActive、cleanedUpColumns/chainCleanedUp、tableauShuffleActive、flippingCards/discardFlip(9項目)
- **実データから既に消えた/変化した対象を、演出のために一時的に保持し直すもの**: confiscateFadingTarget/Active、pressPulseTarget/Active、numericPopupTarget/Active、sealFlashTarget/Active、talismanShuffleFlashActive(5項目)
- **表示の先出し防止ではなく、演出中の二重操作防止が目的のもの**: stockShuffleActive、chainShuffleActive(2項目、うち構造的には14と同じ「関数先頭で同期的にtrueへ」イディオムを流用)
- **上記を集約する司令塔**: anyAnimationActive(1項目)

---

## 演出実装の技術的特徴(フェーズ13向けメモ)

### カード移動アニメーション(独自JS、FLIP風実装)

`getBoundingClientRect()`で移動元・移動先の座標を取得し、`transitionMs: 0`で即座に開始位置へスタイルを固定した直後、`transitionMs`付きのスタイルへ切り替えることでCSS transitionを発火させる、いわゆるFLIP(First-Last-Invert-Play)風の実装。`runGatherAndMoveAnimation`(276〜340行目)が「複数カードをまとめてから移動」パターンの共通ロジックとして再利用されている。

**2重`requestAnimationFrame`が必要な理由**(266〜275行目・1507〜1508行目などに繰り返しコメントあり): `transitionMs: 0`で位置を固定した直後に`transitionMs`付きで実際の移動用スタイルを設定する際、1段だけの`requestAnimationFrame`だと同一フレーム内でのスタイル変更がブラウザにバッチ処理されてしまい、transitionが発生せず「ワープ」してしまうことがある。2段目の`requestAnimationFrame`まで待つことで、1段目のフレームで最初のスタイル(位置固定)が実際にレイアウト・描画され終わったことを保証してから、2段目のフレームで次のスタイル変更を行う。これによりブラウザがtransition開始点(from)を正しく認識する。

### カード裏返し演出(`startFlipReveal`/`startDiscardFlipReveal`)

90度回転(`rotateY`のCSS transform、`perspective`をラッパーに指定して3D風の奥行きを出す)→回転が真横(=見た目上不可視)になった瞬間に`revealed`フラグを切り替えて中身(裏面/表面のCardFace)を差し替え→0度へ戻す、という3段階。回転の中間点で中身を差し替えることで「めくれた瞬間に絵柄が変わる」古典的なトランプめくり表現を実現している。`FLIP_HALF_MS`(100ms)を半分ずつ使う。

### `runGatherAndMoveAnimation`(gather→move 2段階構成)

複数カードを1点に集約(gather)してから、集約点から移動先へ(move)という2フェーズ構成の共通関数(276〜340行目)。`cleanupAnimation`(Waveクリア後の片付け)・`chainResetAnimation`(チェーンリセット)・`discardRedistributeAnimation`(捨て札消去/埋没の再配布)・`sabotageRedistributeAnimation`(総戻し/一列戻し)の4種の演出がこれを共有する。

実装上の注意点(コメント266〜275行目に集約):
- 対象カードが2枚以上のときのみ「まとめる」動きを見せ、1枚だけならgatherフェーズを省略してmoveへ直行する。
- move開始直後も`gatherCards`配列を空にせず、代表カード1件だけ残した配列にする。空にすると新しいDOM要素がマウントされ、そのタイミングで最終位置とtransitionを同時設定すると同様にワープする。

### 妨害演出(`sabotageAnimations.css`、CSS `@keyframes`)

`sabotageAnimations.css`に4種類のkeyframesが定義されている。いずれもクラス名・keyframes名に`shidasu-`接頭辞を付け、他ページとのグローバルCSS衝突を避けている。

| クラス名 | 対応する妨害カテゴリ | 内容 |
|---|---|---|
| `shidasu-seal-flash` | 封印系(talismanSeal等) | 左右に軽くシェイクしつつ`filter: brightness()`で一瞬明るく光る(0.5s ease-out) |
| `shidasu-confiscate-fade` | 没収系(talismanConfiscate等) | 上に少し浮いてから下に落ちつつ`opacity: 0`・`brightness(0.5)`へフェードアウト。`forwards`指定でアニメーション終了後も透明のまま維持し、State側がDOMから除去するまでのちらつきを防ぐ(0.5s ease-in forwards) |
| `shidasu-press-pulse` | 強制発動系(riteForceActivate等)+通常クリック発動 | `scale`を0.85→1.1→1.0と変化させつつ`box-shadow`で光らせる、「自動的に押された」感を出す演出(0.5s ease-out) |
| `shidasu-numeric-shake`(+`shidasu-numeric-popup`) | 数値変化系(comboBreather等) | 要素自体を左右に軽くシェイク(0.4s ease-out)。同時に`shidasu-numeric-popup`(絶対配置の赤文字)が上へ浮かびながらフェードアウト(0.5s ease-out forwards)し、変化量テキストをポップアップ表示する |

いずれも「JS側でクラスをトリガーし、CSS側は固定尺のkeyframesを1回再生するだけ」という設計で、JS側のタイマー(500ms/400ms、`dealTimers`に積まれる`setTimeout`)がCSSアニメーションの尺と一致するように手動で同期されている(CSSの`animationend`イベントは使われていない)。この「JS側のタイマー尺とCSS側のkeyframes尺を手打ちで一致させる」実装も、ズレが起きると表示が一瞬乱れる潜在的な脆弱ポイントであり、Godot移植時はAnimationPlayerの再生完了シグナルなど、尺を1箇所で管理できる仕組みに置き換えることが望ましい。
