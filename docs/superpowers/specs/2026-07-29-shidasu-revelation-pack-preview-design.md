# 天啓福袋プレビューの詳細フロー拡張 設計

## 背景・目的

[Wave生成タイミング再設計](./2026-07-28-shidasu-wave-flow-redesign-design.md)で、ショップ系フェーズでの天啓ターゲット選択を「現在のデッキ構成から都度生成する使い捨てプレビュー盤面」に切り離した。しかし実装したのは最小限の範囲(単一天啓を選んで即座に列選択→適用→破棄)にとどまり、以下の2点が未対応だった。

1. プレビュー表示中(天啓福袋の候補選択画面)に、手持ちの秘儀・天啓を使用できない
2. 福袋の選択を終える際、片付けアニメーションを経由せず即座にプレビューが消える

このセッションではこの2点を対応する。

## スコープ

対象:
- プレビュー用`PlayArea`に所持秘儀・天啓の使用ボタンを表示する
- プレビュー中の秘儀使用(即時適用)・天啓使用(即時適用 or コラム選択後に適用)をプレビュー盤面に対して行う
- 福袋選択終了時(手動終了・自動終了とも)、片付けアニメーションを経由してからプレビューを破棄する

対象外:
- 天啓福袋以外(護符・秘儀・神託の福袋)の挙動変更
- プレビュー機構自体の再設計(既存の「run.waveを一時的にプレビューへすり替えて既存の適用関数を呼び、wave以外の変更のみ本番runへ反映する」パターンを踏襲する)

## 現状の仕組み(前提知識)

- 天啓福袋を開く(`handleBuyPack`)と同時に`beginRevelationPreview()`が呼ばれ、`run.deckComposition`から使い捨ての`revelationPreviewWave`を生成する
- 候補一覧(`revelationOffer`)から天啓を選ぶと、`offerPickRemaining`が0になるまで複数回選択できる(既存の福袋共通の仕組み)
- ターゲット(コラム選択)が必要な天啓を選ぶと`pendingRevelationTarget`がセットされ、`handleTargetColumn`でコラム確定時に効果を適用する。この際`run.wave`を一時的に`revelationPreviewWave`にすり替えて既存の`buyIndividualRevelationUse`/`pickPackRevelationUse`/`useRevelation`を呼び、結果から`wave`以外(deckComposition・currency等)のみ本番`run`に反映し、`wave`自体は変更しない。プレビュー側は適用後の状態を`{status: 'ended', endReason: 'previewDismissed'}`にして片付けアニメーションを発火させ、完了後(`handleRevelationPreviewCleanupDone`)に`null`へ戻す
- `revelationSelect`フェーズを抜ける経路(`handlePickPackRevelationHold`・`handleConfirmPackRevelationSwap`・`handleClosePackRevelationSelect`・`handlePickPackRevelationUse`のターゲット不要パス)は、末尾で`syncRevelationPreviewWithPhase()`を呼び、`run.phase !== 'revelationSelect'`になっていれば`revelationPreviewWave = null`にして即座にプレビューを消している

## 設計

### 1. プレビュー中の秘儀・天啓使用UI

プレビュー用`PlayArea`(`src/routes/game/shidasu/+page.svelte`、`{#if revelationPreviewWave}`ブロック内)に、本番`PlayArea`と同様の`rites={run.rites} onUseRite={handleUseRiteInPreview}` `revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}`propsを追加する。`PlayArea`コンポーネント自体の変更は不要(既存の所持アイテムボタン一覧表示の仕組みをそのまま使う)。

### 2. 秘儀のプレビュー内使用

新規ハンドラ`handleUseRiteInPreview(riteId: RiteId)`を追加する。`revelationPreviewWave`が非nullのときのみ動作し、`run.wave`を一時的に`revelationPreviewWave`にすり替えて既存の`useRite`を呼び、結果の`wave`を`revelationPreviewWave`に反映する(コラム選択不要なため即時反映、片付けアニメは発火しない)。本番`run`には`wave`以外の変更(秘儀の所持数減少など)を反映する。

### 3. 天啓のプレビュー内使用(held)

既存の`handleUseRevelationClick`を修正する。現状は`SHOP_FLOW_PHASES.includes(run.phase)`のとき無条件で`beginRevelationPreview()`を呼び、新しいプレビューを生成し直してしまう(既にプレビュー表示中の場合、場札が意図せず再シャッフルされるバグになる — 前回セッションで福袋の「使用」ボタンで踏んだのと同種の問題)。

`revelationPreviewWave`が既に非nullの場合は再生成せず、既存のプレビューに対して天啓を適用する:
- ターゲットが必要な天啓: `pendingRevelationTarget = { revelationId, source: 'held' }`をセットするのみ(プレビューは既存のものをそのまま使う、`beginRevelationPreview()`は呼ばない)。以降のコラム選択確定フローは既存の`handleTargetColumn`のプレビュー分岐がそのまま処理する
- ターゲット不要な天啓: `run.wave`を一時的に`revelationPreviewWave`にすり替えて`useRevelation`を呼び、結果を`revelationPreviewWave`に反映する(秘儀と同様、即時反映・片付けアニメなし)

`revelationPreviewWave`が`null`の場合(プレビュー外、通常のプレイ中や単純なショップ画面)は、既存の動作(`beginRevelationPreview()`を呼んでプレビュー開始、または`playing`フェーズならそのまま実Waveに適用)を維持する。

### 4. 福袋選択終了時の自動片付けアニメーション

`syncRevelationPreviewWithPhase()`を変更する。現状の「`run.phase !== 'revelationSelect'`なら即座に`revelationPreviewWave = null`」を、「`run.phase !== 'revelationSelect'`かつプレビューがまだ`ended`になっていなければ`{status: 'ended', endReason: 'previewDismissed'}`にする」に変更する。これにより、`handleTargetColumn`でのコラム確定時と全く同じ経路(片付けアニメ発火→`handleRevelationPreviewCleanupDone`で`null`化)に統一される。

呼び出し元(`handlePickPackRevelationHold`・`handleConfirmPackRevelationSwap`・`handleClosePackRevelationSelect`・`handlePickPackRevelationUse`のターゲット不要パス)は変更不要(関数の中身のみ変更)。

## テスト方針

`engine.test.ts`側の変更はない(今回の変更は`+page.svelte`のUI層のみで、`engine.ts`の既存関数`useRite`・`useRevelation`をそのまま呼ぶだけのため)。UIの動作はブラウザでの目視確認とする。

確認項目:
- 天啓福袋のプレビュー中、所持秘儀のボタンが表示され、使用すると即座にプレビュー盤面に効果が反映される(片付けアニメは発火しない)
- 天啓福袋のプレビュー中、所持天啓(コラム選択不要)を使用すると即座にプレビュー盤面に反映される
- 天啓福袋のプレビュー中、所持天啓(コラム選択必要)を使用すると、同じプレビュー盤面のままコラム選択待ちになり、場札が再シャッフルされない
- 福袋選択を「選択を終える」ボタンで終了すると、片付けアニメーションが再生されてからショップ画面に戻る
- 福袋の選択可能数が0になり自動終了した場合も、同様に片付けアニメーションが再生されてからショップ画面に戻る
