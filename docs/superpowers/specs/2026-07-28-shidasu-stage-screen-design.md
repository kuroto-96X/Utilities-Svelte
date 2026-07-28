# ステージ画面の新設 設計

## 背景・目的

星詠みソリティア「Shidasu」のラン構成再構築(`docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`)で、Wave単位の新概念「星」(`Star`型、`stageStars: Star[]`)がデータモデル層に実装済み。今回のセッションでは、そのデータを活用する「ステージ画面」をUIとして新設する。

ステージ画面は、Wave開始前に毎回(ショップを閉じた後)表示され、そのステージの3Wave分の情報を一覧しつつ、Waveスキップ・リロール操作ができる画面。

## スコープ

このセッションでは以下を対象とする:

- ステージ画面の新規UI実装(`+page.svelte`に追加)
- Waveスキップ機能(`engine.ts`側のロジック含む)
- リロール機能(`engine.ts`側のロジック含む)

対象外:
- 配布アニメーションの誤発火問題(既知、別途保留中)
- `continueChoice`画面(8ステージクリア後の続行確認)の演出見直し
- 管理画面の本格UI化
- `bossTiers`・`bosses`非推奨フィールドの削除

## 表示タイミングとフロー

1. Waveクリア → ショップ画面(既存)
2. ショップで「次のWaveへ」ボタンを押す
3. **ステージ画面を表示**(新規): 新しいステージに入る場合は、この直前に`stageStars`を新規抽選する(既存の`enterShop`ロジックのまま)
4. ステージ画面で「Wave{N}へ進む」ボタンを押す
5. 実際にWaveが開始され、通常のプレイ画面に遷移する

## 表示内容

**ヘッダー**: 「ステージ{stageIndex+1}」・所持通貨(`★{run.currency}`)・「ベース目標点数」(`flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex`の値)を表示する。

**Waveカード一覧**: `stageStars`の3件を、`waveSlot`順(1→2→3)に縦並びのカードで表示する。各カードには以下を表示する:
- WAVEラベルと状態(「WAVE {N}・クリア済み」「WAVE {N}・NEXT」「WAVE {N}・必須」「WAVE {N}」のいずれか)
- 星の名前
- 制限ルールの説明文(既存の`upcomingBossInfo`と同様の文言パターンを流用。`restriction`が`null`の場合は「制限なし」)
- そのWaveの目標点数(`waveTarget`関数で算出)
- そのWaveの報酬(`star.reward`)

**状態別の見た目・操作**:

| 状態 | 見た目 | 操作 |
|---|---|---|
| クリア済み(`waveIndex`より前) | 薄く表示(不透明度を下げる) | ボタンなし |
| NEXT・waveSlot 1 or 2(`waveIndex`と一致、かつWave1/2) | 強調枠 | スキップボタン(即時実行) |
| NEXT・waveSlot 3(`waveIndex`と一致、かつWave3) | 強調枠 | リロールボタンのみ(スキップボタンは表示しない) |
| 未到達(`waveIndex`より後) | 通常表示 | ボタンなし |

## Waveスキップ

**対象**: waveSlot 1・2のみ、かつ「次にプレイするWave」(`run.waveIndex`と一致するカード)のときのみボタンを表示する。

**挙動**: ボタンを押すと確認ダイアログなしで即座に実行する。`WaveState`は一切生成せず、`run.waveIndex`のみを1つ進める(`run.phase`は`'shop'`のまま、ステージ画面は表示され続ける)。報酬は一切得られない。実行後、ステージ画面上で次のWave行が自動的にNEXT表示に切り替わる。

waveSlot 3(Wave3)は常に必須プレイのため、スキップボタン自体を表示しない。

## リロール

**対象**: waveSlot 3(Wave3)のみ、「次にプレイするWave」のときのみボタンを表示する。

**コスト**: 固定額。`params`(`flow`セクション想定)に新しいフィールド(例: `rerollCost`)として追加し、管理画面から調整可能にする。

**挙動**: ボタンを押すと確認ダイアログなしで即座に実行する。所持通貨からコストを差し引き、`stageStars[2]`(waveSlot 3の星)のみを再抽選する。所持通貨がコスト未満の場合はボタンをdisabledにする。

## 「Wave{N}へ進む」ボタン

画面最下部に配置する常設ボタン。文言は「次にプレイするWave番号」に応じて動的に変わる(例: 次がWave1なら「Wave1へ進む」)。押すと`finishShop`相当の処理(実際のWaveを`startWave`で配る)が実行され、`run.phase`が`'playing'`になり通常のプレイ画面に遷移する。

## `engine.ts`側の変更

- **Waveスキップ関数**(新規、例: `skipWave`): `run.phase === 'shop'`かつ`run.waveIndex`がwaveSlot 1・2に対応する場合のみ動作。`run.waveIndex`を1進めた`RunState`を返す。waveSlot 3(`run.waveIndex === 2`)のときは何もせず`run`をそのまま返す(ガード条件、UIでボタン自体を出さないことと合わせた二重の安全策)。スキップの結果`waveIndex`が2(waveSlot 3)を超えることはない。
- **リロール関数**(新規、例: `rerollStageStars`): `run.phase === 'shop'`かつ`run.waveIndex`がwaveSlot 3に対応し、かつ`run.currency >= rerollCost`の場合のみ動作。`stageStars[2]`を再抽選し、`currency`からコストを差し引いた`RunState`を返す。
- `finishShop`関数(既存)は変更しない(「Wave{N}へ進む」ボタンからそのまま呼ぶ)。

## UIコンポーネント構成

現状、ショップ画面の「次のWaveへ」ボタン(`handleFinishShop`)は`finishShop(params, run)`を直接呼び、`run.phase`を`'shop'`から`'playing'`へ即座に切り替えている。ステージ画面を間に挟むため、`run.phase`とは別に、`+page.svelte`内にローカルなSvelte state(例: `let showStageScreen = $state(false)`)を追加する。

- ショップ画面の「次のWaveへ」ボタンの`onclick`を、`finishShop`の直接呼び出しから`showStageScreen = true`に変更する(`run.phase`はまだ`'shop'`のまま据え置く)。
- ステージ画面は`{#if run.phase === 'shop' && showStageScreen}`で表示する(ショップ画面自体は`{#if run.phase === 'shop' && !showStageScreen && ...}`のように、`showStageScreen`が`false`のときだけ表示するよう条件を調整し、両者が同時に表示されないようにする)。
- ステージ画面の「Wave{N}へ進む」ボタンは、`finishShop(params, run)`を呼んで`run.phase`を`'playing'`に切り替えた後、`showStageScreen = false`にリセットする。
- ステージ画面は、ショップ画面と同様`fixed inset-0`のオーバーレイ構造(既存のショップ画面と同じスタイルパターンを踏襲)で実装する。

`showStageScreen`は、Waveクリアの度に(=`run.phase`が新たに`'shop'`になるたびに)`false`にリセットされる必要がある。`run.phase`の変化を監視する`$effect`を追加し、`'shop'`に変わった瞬間に`showStageScreen = false`へ戻す。

## テスト方針

`engine.ts`に追加する`skipWave`・`rerollStageStars`関数はユニットテストを追加する:
- `skipWave`: waveSlot 1/2で`waveIndex`が正しく進むこと、waveSlot 3では何もしないこと(ガード条件)
- `rerollStageStars`: 通貨が正しく減算されること、`stageStars[2]`が変化すること(seed固定で決定的に検証)、通貨不足時は何もしないこと

UI(ステージ画面自体の表示・操作)は自動テストの対象としない(ブラウザでの目視確認)。
