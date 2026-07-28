# Wave生成タイミング再設計・タイトル直後ステージ画面表示 設計

## 背景・目的

現状、`enterShop`(Waveクリア後のショップ突入処理)はショップ画面に入ると同時に次Waveの場札を`startWave`で事前生成し`run.wave`にセットしている(天啓ターゲット選択のプレビュー用)。`+page.svelte`はショップ画面表示中でも`run.wave`があれば裏で`PlayArea`を描画し続けており、`waveKey`(`${stageIndex}-${waveIndex}`)の変化を監視して配布アニメーションを自動発火させる仕組みになっている。そのため、ショップに入った瞬間に次Waveの配布アニメーションが(ユーザーに見えない形で、または意図せず見える形で)誤発火してしまう。`finishShop`(「次のWaveへ」ボタン)では、この事前生成された`wave`をもう一度`startWave`で配り直しており、二重生成になっている。

また、現状`beginRun`(タイトル画面でのスプレッド選択)はラン開始と同時にWave1を`startWave`し`phase: 'playing'`へ直接遷移しており、[ステージ画面の新設](./2026-07-28-shidasu-stage-screen-design.md)で追加したステージ画面(Wave一覧・スキップ・リロール)を経由しない。

このセッションでは、Wave生成のタイミングを「プレイヤーが明示的にWave開始を選択した瞬間」の1箇所に統一し、上記の問題を解消する。

## スコープ

対象:
- `beginRun`をステージ画面経由に変更(タイトル→スプレッド選択→ステージ画面→Wave1開始)
- `enterShop`から次Wave事前生成を除去し、ショップ画面中は直前Waveの終了状態をそのまま保持する
- 天啓のターゲット選択(コラム選択)を、現在のデッキ構成から都度生成する専用プレビュー盤面に切り離す
- プレビュー盤面の配布アニメーション(表示時)・片付けアニメーション(選択完了時)の発火

対象外:
- ステージ画面自体のUI変更(既存のまま)
- スキップ・リロールのロジック変更(既存のまま)
- 天啓・秘儀・神託の効果内容そのもの

## フロー全体

```
title
  → (スプレッド選択) beginRun
  → ステージ画面(Wave未生成、shopはnull)
  → 「Wave1へ進む」→ startWave → playing(配布アニメ再生)
playing
  → Waveクリア → 片付けアニメ再生
  → resolveWaveEnd → enterShop(Wave未生成、run.waveは片付け後の直前Waveの状態を保持)
  → shop画面
shop画面
  → 天啓使用ボタン → 現在デッキから専用プレビュー盤面を生成・配布アニメ再生
    → コラム選択完了 → 片付けアニメ再生 → プレビュー盤面破棄 → shop画面に戻る
  → 「次のWaveへ」→ ステージ画面(Wave未生成)
    → 「WaveNへ進む」→ startWave → playing(配布アニメ再生)
```

## `engine.ts`側の変更

### `beginRun`

`phase: 'shop'`で終わるよう変更する。Wave(`wave`)は生成しない(`null`)。ショップの商品構成(`shop`フィールド)も`null`のままとする(ラン開始直後は買い物をさせない)。`stageStars`はこれまで通り`rollStageStars`で初期抽選する。

`+page.svelte`側は、`beginRun`呼び出し直後に`showStageScreen = true`をセットし、ステージ画面を表示する。ステージ画面の表示条件(`{#if run.phase === 'shop' && ...}`)から`run.shop`の非null判定を外し、`run.phase === 'shop'`のみで判定するよう変更する(ショップ画面本体側は引き続き`run.shop`の非null判定を保持し、`shop === null`のときはショップ画面自体が出ないようにする)。

### `enterShop`

`startWave`の呼び出しを削除する。`run.wave`は変更せず、直前Waveの終了状態(片付けアニメ後の状態)をそのまま保持する。`deckComposition`・`extraTableauRows`・`oracleLevels`などWave生成に使っていた値は、実際のWave開始(`finishShop`)まで`run`側に保持され続ける(既存のフィールドのまま、生成タイミングだけ後ろにずれる)。

### `finishShop`

変更なし。ステージ画面の「WaveNへ進む」ボタンから呼ばれ、その時点の`deckComposition`・`extraTableauRows`から`startWave`する。これが実質的にゲーム全体で唯一の`startWave`呼び出し箇所になる(ラン開始時のWave1も含む)。

### 天啓プレビュー生成・破棄

新規関数を追加する(具体的な関数名・シグネチャは実装計画フェーズで決定):
- **生成**: ショップ画面で天啓使用ボタンを押した瞬間、`run.deckComposition`から`startWave`相当のロジックで場札を配ったプレビュー用`WaveState`を生成する。このプレビューは本番Waveの`stageIndex`/`waveIndex`やスコア状態とは無関係な、コラムターゲット選択専用の使い捨て状態として扱う。
- **破棄**: コラム選択が完了した時点(天啓効果適用後)で、プレビュー盤面に対して片付けアニメーションを発火させ、完了後にプレビュー状態を破棄してショップ画面表示に戻る。既存の片付けアニメは`wave.status === 'ended' && wave.endReason === 'target'`のときのみ発火する仕組みのため、プレビュー破棄用に別トリガー(例: 明示的なフラグまたは新しい`endReason`)を追加する必要がある。この拡張方法は実装計画フェーズで既存コード(`PlayArea.svelte`のアニメーション状態機械)を精査した上で決定する。

## `+page.svelte`側の変更

- `beginRun`呼び出し直後(`handleStartWithSpread`)に`showStageScreen = true`を追加する
- ステージ画面の表示条件から`run.shop`の非null判定を除く
- ショップ画面中の「裏のPlayArea描画」(511行目付近の`{:else if wave}`)は、`run.wave`が直前Waveの終了状態を保持するようになるため、意図せず配布アニメが再発火することはなくなる想定(`waveKey`は`stageIndex-waveIndex`のままWave開始時にしか変化しないため)
- 天啓ターゲット選択のプレビュー表示・完了後の片付け・破棄のハンドリングを新規実装する(現状の`pendingRevelationTarget`まわりのロジックを、実Wave参照からプレビュー専用状態参照に置き換える)

## テスト方針

`engine.ts`の自動テスト(`engine.test.ts`)で以下を確認する:
- `beginRun`が`phase: 'shop'`・`wave: null`・`shop: null`で返ること
- `enterShop`(`resolveWaveEnd`経由)が`run.wave`を変更しないこと(直前Waveの状態を保持すること)
- `finishShop`が正しく`startWave`してWaveを開始すること(既存動作の回帰確認)

天啓プレビュー生成・破棄および各種アニメーションの見た目は既存方針通り自動テスト対象外とし、ブラウザでの目視確認とする。

## 既存ドキュメントとの関係

既存の「移動アニメーション実装時の注意(全般)」(CLAUDE.md)の対象パターンにも合致するため、実装後は同様の確認(常設UIの先出し表示がないか)を行う。
