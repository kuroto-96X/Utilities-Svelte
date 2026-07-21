# Shidasu デバッグ画面(/admin/shidasu-debug)に天啓実行パネルを追加 設計

## 0. 背景・目的

`/admin/shidasu-debug`には、秘儀(RiteId)を所持数無視で直接発動できる`RiteExecutePanel`が既に存在する。天啓(RevelationId、12種)にも同様の直接発動パネルを追加し、開発時に天啓の効果(スート/ランク変換・場札拡張・ワイルド追加)を素早く確認できるようにする。

## 1. `RevelationExecutePanel.svelte`(新規コンポーネント)

`RiteExecutePanel.svelte`と同じ構造・スタイルで実装する。

- `REVELATION_POOL`(12種)を1件ずつ、ボタン(天啓名)+説明文(`revelationDesc`)の行として一覧表示する
- 見出しは「天啓(12種・所持数無視で直接発動)」とし、`RiteExecutePanel`の見出し文言の踏襲とする
- **所持数・使用条件(`canUseRevelation`、例: 虚の山札枚数チェック)は判定せず、常にボタンを押せる**(`RiteExecutePanel`が`canUseRite`を判定しない方針と同じ)
- 列選択が必要な天啓(角・亢・氐・房・牛・女・危、`revelationNeedsTarget`が`true`を返すもの)をクリックすると、即座には発動せず「列選択待ち」状態になる。パネル内に「列を選択してください」という案内文とキャンセルボタンを表示し、この間は他の天啓ボタンを無効化する
- 列選択が不要な天啓(心・尾・箕・斗・虚)をクリックすると即座に発動する

### Props

```ts
{
  onExecute: (revelationId: RevelationId) => void
  pendingRevelationId: RevelationId | null
  onCancelTarget: () => void
}
```

`onExecute`が呼ばれた時点で列選択が必要かどうかの判定(`revelationNeedsTarget`)は行わず、そのまま呼び出し元(`+page.svelte`)に委ねる。パネル側は`pendingRevelationId`が非nullの間、対応するボタンの見た目を「選択中」にし、他のボタンをdisabledにする。

## 2. `+page.svelte`の状態・配線

- 新規state: `pendingDebugRevelation = $state<RevelationId | null>(null)`
- `handleExecuteRevelation(revelationId: RevelationId)`:
  - `revelationNeedsTarget(revelationId)`が`true`なら`pendingDebugRevelation = revelationId`にして待機するのみ(効果は適用しない)
  - `false`なら即座に`applyRevelationEffect(params, wave, deckComposition, revelationId, null, Math.random)`を実行し、結果の`wave`・`deckComposition`で状態を更新する。既存の`handleExecuteRite`と同様に`lastSnapshot = wave`(適用前の`wave`)を保存する
- `handleTargetDebugColumn(colIndex: number)`:
  - `pendingDebugRevelation`が`null`なら何もしない
  - 非nullなら、その`revelationId`と`colIndex`を対象に`applyRevelationEffect`を実行し、`wave`・`deckComposition`を更新、`lastSnapshot`を保存、`pendingDebugRevelation`を`null`に戻す
- `canTargetDebugColumn(colIndex: number): boolean`:
  - `pendingDebugRevelation === 'aya'`なら常に`true`(空列も対象可)
  - それ以外は`wave.tableau[colIndex].length > 0`
- `handleCancelDebugRevelationTarget()`: `pendingDebugRevelation = null`のみ
- 既存の`<PlayArea>`呼び出しに以下を追加する:
  ```svelte
  columnTargetMode={pendingDebugRevelation !== null}
  canTargetColumn={canTargetDebugColumn}
  onTargetColumn={handleTargetDebugColumn}
  ```
  (`PlayArea.svelte`は既に本編機能実装時にこれらのpropsに対応済みのため、`PlayArea.svelte`自体の変更は不要)

### 「元に戻す」との関係(既存の制約を踏襲)

`lastSnapshot`は`WaveState`のみを保持し、`deckComposition`は含まない。これは現状のカード直接プレイ(護符効果による`deckComposition`変化を伴う既存の`handlePlayCard`/`handleDraw`)でも同じ制約であり、今回新たに導入する制限ではない。天啓によるデッキ構成の永続変化についても、「元に戻す」ボタンでは戻せない(`wave`のみ元に戻る)仕様を踏襲する。

## 3. レイアウト

4列目のグリッドセル内で、`RiteExecutePanel`と`RevelationExecutePanel`をまとめて1つの共有スクロール領域にする。

- `+page.svelte`側で、4列目に以下のようなラッパーを追加する:
  ```svelte
  <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
    <RiteExecutePanel onExecute={handleExecuteRite} />
    <RevelationExecutePanel
      onExecute={handleExecuteRevelation}
      pendingRevelationId={pendingDebugRevelation}
      onCancelTarget={handleCancelDebugRevelationTarget}
    />
  </div>
  ```
- `RiteExecutePanel.svelte`自身が現在持つ`max-h-[70vh] overflow-y-auto`という外側ラッパーは削除し(二重スクロールバーを避けるため)、上記の共有ラッパーにスクロールを一本化する。`RiteExecutePanel`のルート要素は`<div class="space-y-1">`(スクロール指定なし)に変更する
- 各パネルの見出し(`sticky top-0 bg-slate-50`)は、共有スクロール領域内でも変わらず機能するためそのまま維持する
- この変更により、2つのパネルがそれぞれ独立に最大70vhを確保して合計140vh相当になり、過去に修正した「ページ全体の不要な縦スクロール」が再発する事態を避ける

## 4. 受け入れ基準

1. `/admin/shidasu-debug`の4列目(RiteExecutePanelがある列)に、天啓12種のボタン一覧が秘儀パネルの下に表示される
2. 列選択不要な天啓(心・尾・箕・斗・虚)のボタンを押すと、所持数・使用条件を問わず即座に場札・デッキ構成に効果が反映される
3. 列選択が必要な天啓(角・亢・氐・房・牛・女・危)のボタンを押すと「列を選択してください」表示になり、他の天啓ボタンが無効化される。デバッグ用のプレイエリア(本編と共通の`PlayArea`コンポーネント)の場札列をクリックすると、その列を対象に効果が発動し、選択待ち状態が解除される
4. 危(aya)のみ、空の列であっても対象として選択できる
5. キャンセルボタンを押すと、効果を発動せずに選択待ち状態が解除される
6. 天啓パネル追加後も、ページ全体に不要な縦スクロールバーが表示されない(RiteExecutePanel・RevelationExecutePanelを合わせた4列目全体が70vh以内に収まり、内部スクロールのみで完結する)
7. 「新しいウェーブ」「デッキリセット」「元に戻す」など既存のデバッグ操作は今回の変更で壊れない
