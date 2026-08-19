# 大量放出・少量放出の裏向き移動→フリップ演出 実装 設計

> 対象: 星の妨害行動「大量放出」(`stockPurge`)・「少量放出」(`stockPurgeSmall`)が山札から捨て札へカードを移動させる際の演出を実装する。移動中は常に裏向きで、山札の位置から捨て札の位置へ個別に飛ばす。着地後、捨て札が通常(表向き)の状態であればフリップ演出で表向きにし、`捨て札埋没`等により捨て札が裏向きのままの状態であればフリップせずそのまま据え置く。

## 背景・目的

前々回・前回のセッションで、星の妨害行動「総戻し」「一列戻し」に裏向き挙動(データ・表示)とアニメーション(山札への収束→裏向き配布→フリップ)を実装した。今回はその関連機能として、「大量放出」「少量放出」(山札から捨て札へカードを移動させる妨害行動)にも同様の演出を追加する。

「捨て札埋没」(`discardBury`)により捨て札が裏向きのまま据え置かれる仕組みは既に実装済みで、捨て札の表示(`displayedDiscardTop`)は`Card.faceUp`を素直に反映するだけの単純なルール(場札の列トップのような「常に表向き」の例外は無い)になっている。今回はこの既存ルールと整合する形で、「大量放出」「少量放出」で新たに捨て札へ積まれるカードの表裏を、捨て札の現在の状態を継承する形で決定する。

## 方針(スコープ)

- 「大量放出」(`stockPurge`)・「少量放出」(`stockPurgeSmall`)発動時の演出のみを対象とする。
- 他の山札→捨て札・場札→捨て札の移動(`一枚没収`等)への演出拡張は対象外。

## 技術設計

### A. データモデル(移動先の裏表を継承する)

`stockPurge`/`stockPurgeSmall`が移動させるカードの表裏は、移動先(捨て札)の**現在の状態を継承**する。現在の`wave.discardPile`の末尾(先頭表示中)カードが`faceUp === false`であれば、今回移動するカードも`faceUp: false`にする。そうでなければ`faceUp`は設定しない(表向き)。

```ts
function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const discardIsHidden = wave.discardPile[wave.discardPile.length - 1]?.faceUp === false
  const purged = wave.stock.slice(wave.stock.length - n).map(c => (discardIsHidden ? { ...c, faceUp: false } : c))
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }, purgedToDiscardCount: n }
}
```

`applyStockPurgeSmall`も同様(`n = Math.min(2, wave.stock.length)`)。

`SabotageResult`(`sabotageEffects.ts`)に、今回何枚移動したかを明示する`purgedToDiscardCount?: number`を追加する。前回`affectedTableauCols`で「対象列をCard.faceUpフラグから逆算するとバグる」という教訓を得ているため、同様に妨害行動側から明示的に伝える設計にする。

### B. トリガー検知

`WaveState.lastSabotage`に`purgedToDiscardCount`を追加する:

```ts
lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number }
```

`triggerSabotage`(`engine.ts`)が`result.purgedToDiscardCount`をそのまま伝える。`PlayArea.svelte`の既存`$effect.pre`(前回`lastSabotage.seq`の変化を検知する仕組みを実装済み)に分岐を追加する:

```ts
if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
  startSabotageRedistributeAnimation(current.affectedCols)
} else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
  startStockPurgeAnimation(current.purgedToDiscardCount)
}
```

### C. 移動アニメーション

`count`枚(5枚 or 2枚、山札残り枚数に応じて実際はそれ以下になりうる)を、山札の位置(`stockButtonEl`)から捨て札の位置(`discardPileEl`)へ、`DEAL_INTERVAL_MS`(既存定数、30ms)ずつずらして個別に飛ばす。既存の`dealOneCard`と同じ「`transitionMs:0`で開始位置に配置→2段`requestAnimationFrame`後に`transitionMs`付きで移動→着地」という手法をそのまま踏襲するが、対象が場札のマス目ではなく捨て札1点という違いがあるため、新規の小さな専用関数として実装する(既存の`dealOneCard`を無理に一般化せず、このコードベースの流儀通り機能ごとに専用の小関数を用意する)。

新規`$state`配列(例: `discardPurgeCards: { card: Card; left: number; top: number; transitionMs: number }[]`)でオーバーレイ管理し、移動中は常に`faceUp={false}`で描画する。

### D. 着地後のフリップ or 据え置き

最後の1枚が着地したタイミングで、移動したカードの`faceUp`(セクションAで確定済み)を見て分岐する。

- `faceUp !== false`(通常): 捨て札位置で裏→表のフリップ演出を行う。前回実装した列トップのフリップ(`startFlipReveal`・`flippingCards`)と同じ回転シーケンス(裏面のまま90度回転→真横で不可視のタイミングで中身を表に差し替え→正面まで回転)を踏襲するが、捨て札は常に1箇所しか存在しないため、複数列を同時に扱う配列`flippingCards`は使わず、専用の単純な状態(例: `discardFlip: { card: Card; revealed: boolean; rotation: number; transitionMs: number } | null`)で実装する。
- `faceUp === false`(捨て札埋没等により捨て札が裏向き継続中): フリップせず、裏向きのまま据え置く。

### E. `displayedDiscardTop`との連携

既存の`$effect`(`chainResetAnimation`実行中は`wave.discardPile`への自動追従を止める仕組み、CLAUDE.mdの「移動アニメーション実装時の注意」に対応する既存パターン)に、新しいアニメーション実行中を示す条件を追加する。これにより、移動・フリップ(または据え置き確定)が完了するまで、捨て札の常設表示(`displayedDiscardTop`)が新しい内容を先出ししないようにする。

```ts
$effect(() => {
  if (chainResetAnimation !== null || discardPurgeCards.length > 0 || discardFlip !== null) return
  displayedDiscardTop = wave.discardPile[wave.discardPile.length - 1]
})
```

### F. `anyAnimationActive`への追加

新規の2状態(`discardPurgeCards.length > 0`・`discardFlip !== null`)を`anyAnimationActive`に含め、演出中は他の操作を無効化する。

## テスト

- **データモデル**: `applyStockPurge`/`applyStockPurgeSmall`が、捨て札の現在の状態(表向き/裏向き)に応じて正しく`faceUp`を継承すること、`purgedToDiscardCount`が正しい枚数(山札残り枚数による上限含む)を返すことをエンジンレベルのテストで確認する。
- **トリガー**: `triggerSabotage`が`lastSabotage.purgedToDiscardCount`を正しく設定することを確認する。
- **アニメーション**: コンポーネントレベルの自動テストは無いため、`npm run dev`+`/admin/shidasu-debug`のデバッグ発動ボタンで目視確認する:
  - 通常(捨て札が表向き)状態で「大量放出」「少量放出」を発動し、山札→捨て札への移動→フリップで表向きになる一連の流れを確認する
  - 「捨て札埋没」発動後(捨て札が裏向き)の状態で「大量放出」「少量放出」を発動し、移動後もフリップせず裏向きのまま据え置かれることを確認する
  - 演出中は他の操作が無効化され、完了後は正常に操作できることを確認する
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- 他の山札→捨て札・場札→捨て札の移動(`一枚没収`等)への演出拡張
- 捨て札→山札(`捨て札埋没`)・捨て札→チェーン(`捨て札消去`)の演出(いずれも既に対象外として確定済み、または別の形の再配布であり今回のスコープに含まれない)
