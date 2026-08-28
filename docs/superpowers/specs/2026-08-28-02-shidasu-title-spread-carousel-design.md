# タイトル画面のスプレッド選択UIをカルーセル形式に変更する 実装設計

## 背景・目的

「星詠みソリティア -Shidasu-」のタイトル画面(`run.phase === 'title'`)では、全10スプレッド(fool/moon/pope/empress/magician/justice/lovers/emperor/wheelOfFortune/strength)が縦一列のボタンとして並び、タップすると即座にそのスプレッドでランが開始される構造になっている(`src/routes/game/shidasu/+page.svelte:759-791`)。

スプレッドが10種類に増えたことで縦一列が長くなりすぎている。1件ずつ大きく表示し、左右ボタンで切り替え、下部のスタートボタンで確定するカルーセル形式に変更する。今後スプレッドが増えても画面の縦幅に影響しない構成にする。

## 変更内容

対象ファイルは`src/routes/game/shidasu/+page.svelte`の759-791行目のみ。`SPREAD_IDS`・`handleStartWithSpread`・`params.spreads`など既存のロジック・データソースはそのまま活用し、表示部分のみを差し替える。ゲームロジック側(`engine.ts`・`params.ts`等)への変更は無い。

### 1. 選択中インデックスの保持

タイトル画面用に、選択中スプレッドのインデックスをローカル`$state`で保持する:

```ts
let selectedSpreadIndex = $state(0) // 0 = SPREAD_IDS[0] = 'fool'(愚者)
```

`SPREAD_IDS`配列の先頭が`'fool'`であるため、初期値`0`で「初期表示は愚者」の要件を満たす。

### 2. 左右ボタンによる切り替え(ループあり)

```ts
function goToPrevSpread() {
  selectedSpreadIndex = (selectedSpreadIndex - 1 + SPREAD_IDS.length) % SPREAD_IDS.length
}
function goToNextSpread() {
  selectedSpreadIndex = (selectedSpreadIndex + 1) % SPREAD_IDS.length
}
```

最後(`strength`、9番目)で「▶」を押すと最初(`fool`)へ、最初で「◀」を押すと最後へループする。

### 3. 表示レイアウト

現在の「全件ボタンを縦に並べる」`<div class="flex flex-col gap-3 w-full max-w-xs">`ブロックを、以下の構成に置き換える:

- 中央: 選択中スプレッド1件のみを表示するカード(名前・説明文。既存の`font-black text-yellow-300 text-lg`・`text-xs text-emerald-100/80`のスタイルを踏襲)
- カードの左右: 「◀」「▶」ボタン(`goToPrevSpread`・`goToNextSpread`を呼ぶ)
- カード下部: ドットインジケーター(`SPREAD_IDS.length`個の小さな丸。選択中のインデックスのみ色を変えてハイライト)
- 最下部: 「スタート」ボタン(`handleStartWithSpread(SPREAD_IDS[selectedSpreadIndex])`を呼ぶ。既存の`handleStartWithSpread`関数はそのまま流用し、呼び出し元だけを変更する)

### 4. 切り替え時のフェード演出

スプレッドが切り替わった際、カード内容(名前・説明文)がフェードで切り替わる。Svelteの`{#key selectedSpreadIndex}...{/key}`ブロックと`transition:fade`(`svelte/transition`)を使い、インデックスが変わるたびにカード内容をフェードイン/アウトさせる。既存の他のアニメーション(配布アニメーション等)と同様、軽量なCSSトランジションで実装し、新規の複雑なアニメーションロジックは追加しない。

### 5. アクセシビリティ・誤操作防止

「◀」「▶」ボタンは常に有効(ループするため無効化状態は発生しない)。スタートボタンを押すまでランは開始されないため、誤タップでの即時ラン開始は発生しない(現状の「ボタンタップ即ラン開始」から「切り替え→確定」の2段階操作に変わることが、今回の変更の主目的の一つ)。

## 影響範囲・スコープ外

- `SPREAD_IDS`・`SpreadConfig`・`handleStartWithSpread`関数のシグネチャ・`params.spreads`など、データ層・ロジック層は一切変更しない
- タイトル画面以外(ゲームプレイ画面・admin画面)への影響は無い
- スプレッドの追加・削除時の対応(`SPREAD_IDS`に追記するだけで自動的にカルーセルの件数に反映される)は既存の設計のまま維持される
- キーボード操作(矢印キーでの切り替え)・スワイプ操作のサポートは今回のスコープ外(タップ操作のみ)

## テスト方針

このタイトル画面はSvelteコンポーネントのUI変更であり、既存のプロジェクトのテスト方針(`vitest`によるロジック単体テスト)の対象外(ゲームロジック関数を変更しないため新規のvitestテストは追加しない)。`npm run build`・`npm run check`でのビルド・型チェック通過と、`npm run dev`でのブラウザ目視確認(初期表示が愚者であること、左右ボタンでの切り替え、端でのループ、ドットインジケーターの表示、スタートボタンでのラン開始)を完了確認の手段とする。
