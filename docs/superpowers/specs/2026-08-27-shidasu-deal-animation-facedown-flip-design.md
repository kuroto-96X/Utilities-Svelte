# 配布アニメーションの裏向き統一・着地時フリップ演出 実装設計

## 背景・目的

月スプレッドの実装により、Wave開始時に配られる場札の一部(各列の奥側`floor(rows/2)`枚)が`Card.faceUp: false`になった。しかし現状の通常配布アニメーション(`startDealAnimation`)は常に表向き(`faceUp: true`固定)でカードを飛ばしているため、実際には裏向きのカードもアニメーション中は表向きに見えてしまっている。

この問題を、単に「裏向きカードは配布アニメーション中も裏向き表示にする」という最小修正ではなく、配布アニメーション全体を「常に裏向きの見た目で移動し、着地の瞬間にそのカードが表向きであるべきかどうかを判定してフリップする」という共通パターンに統一することで解決する。これにより、既存の妨害系再配布(`startSabotageDealAnimation`)が既に持っている「列の一番上だけ着地後にフリップ」という演出パターンと、通常配布のロジックが統一される。

## 変更内容

対象ファイル: `src/routes/game/shidasu/PlayArea.svelte`

### 1. `dealOneCard`を「常に裏向きで移動し、着地時にフリップ判定コールバックを呼ぶ」形に変更する

現状のシグネチャ:

```ts
function dealOneCard(
  entry: { card: Card; colIndex: number; rowIndex: number },
  fromLeft: number,
  fromTop: number,
  faceUp: boolean = true,
  onLanded?: (entry: { card: Card; colIndex: number; rowIndex: number }) => void
)
```

変更後のシグネチャ:

```ts
function dealOneCard(
  entry: { card: Card; colIndex: number; rowIndex: number },
  fromLeft: number,
  fromTop: number,
  shouldFlipToFaceUp: boolean
)
```

- `dealingCards`への追加時、`faceUp`は常に`false`で登録する(移動中は常に裏向き見た目)
- 着地時(`setTimeout(DEAL_MOVE_MS)`完了時)の処理:
  - `shouldFlipToFaceUp`が`true`の場合: 既存の`startFlipReveal(entry.colIndex, entry.rowIndex, entry.card)`を呼ぶ(着地の瞬間にフリップ開始)
  - `false`の場合: 従来通り`dealtCells`へ直接登録する(裏向きのまま確定表示に切り替え)
- `onLanded`引数は削除する(呼び出し元は`startSabotageDealAnimation`のみで、この呼び出し元も新しい`shouldFlipToFaceUp`パターンに統一されるため不要になる)

### 2. `startDealAnimation`(通常のWave開始配布)の呼び出しを変更する

現状:

```ts
order.forEach((entry, index) => {
  const timer = setTimeout(() => {
    dealOneCard(entry, fromLeft, fromTop)
  }, index * DEAL_INTERVAL_MS)
  dealTimers.push(timer)
})
```

変更後:

```ts
order.forEach((entry, index) => {
  const timer = setTimeout(() => {
    dealOneCard(entry, fromLeft, fromTop, entry.card.faceUp !== false)
  }, index * DEAL_INTERVAL_MS)
  dealTimers.push(timer)
})
```

`entry.card.faceUp !== false`は、そのカードが表向き想定(`undefined`または`true`)かどうかの既存の判定パターン(`displayFaceUp`等で使われているものと同じ式)をそのまま流用する。

### 3. `startSabotageDealAnimation`(妨害系再配布)の呼び出しを変更する

現状:

```ts
order.forEach((entry, index) => {
  const timer = setTimeout(() => {
    const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
    dealOneCard(entry, fromLeft, fromTop, false, landedEntry => {
      if (isTopOfColumn) {
        startFlipReveal(landedEntry.colIndex, landedEntry.rowIndex, landedEntry.card)
      } else {
        dealtCells = new Set([...dealtCells, `${landedEntry.colIndex}-${landedEntry.rowIndex}`])
      }
    })
  }, index * DEAL_INTERVAL_MS)
  dealTimers.push(timer)
})
```

変更後:

```ts
order.forEach((entry, index) => {
  const timer = setTimeout(() => {
    const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
    dealOneCard(entry, fromLeft, fromTop, isTopOfColumn)
  }, index * DEAL_INTERVAL_MS)
  dealTimers.push(timer)
})
```

`isTopOfColumn`かどうかの判定ロジック自体は変更しない。着地時のフリップ/確定登録の分岐が`dealOneCard`内部の共通ロジックに統合されるだけ。

### 4. 挙動の変化点

- **表向きになるべきカード**: 着地の瞬間からフリップアニメーション(裏→表)が始まる。移動アニメーションの終了とフリップ開始が同一タイミングなので、体感としては移動とフリップが接続して見える
- **裏向きのままでよいカード**(月スプレッドの奥側`floor(rows/2)`枚、または妨害系再配布で列の一番上でない位置): 移動中もフリップせず、着地後も裏向きのまま確定表示に切り替わる

### 5. `dealingCards`型定義への影響

`DealingCard`インターフェース自体(`src/routes/game/shidasu/PlayArea.svelte`内、250行目付近)の`faceUp: boolean`フィールドは変更不要。呼び出し元が渡す値が常に`false`になるだけで、型定義はそのまま使える。

## テスト方針

配布アニメーションはこれまで通り自動テスト対象外(タイマー・DOM操作が主体のため)。`npm run dev`でのブラウザ確認で担保する。

- 月スプレッドでランを開始し、最初のWaveの配布を確認する: 各列の奥側`floor(rows/2)`枚が裏向きのまま移動・着地し、手前側の残りは着地と同時にフリップして表向きになることを確認する
- 愚者・教皇スプレッドでランを開始し、通常配布で全カードが着地と同時にフリップして表向きになることを確認する(回帰確認)
- 妨害行動(総戻し・一列戻し等)による再配布を発生させ、従来通り列の一番上だけ着地後にフリップし、それ以外は裏向きのまま留まることを確認する(回帰確認)

## スコープ外

- `dealingCards`の状態に`rotation`/`revealed`を統合し、「移動とフリップを1つのDOM要素・1つのCSS transitionで完結させる」方式は採用しない。着地→フリップの2段階(既存の`dealingCards`→`flippingCards`のリレー方式)のまま実装する
- カードプレイ・得点清算・チェーンリセットなど、配布アニメーション以外のアニメーションへの変更は行わない
- `startFlipReveal`関数自体のロジック変更は行わない(呼び出されるタイミング・呼び出し元が変わるのみ)
