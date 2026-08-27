# 月スプレッドの効果変更(上半分裏向き配布) 実装設計

## 背景・目的

スプレッド「月」(`moon`)の現行効果は「場札が常に1行少ない状態で始まる」(`initialExtraTableauRows: -1`)。これを「場札が常に1行多い状態で始まる。Wave開始時に場札を配るとき、上半分(端数切捨て)の行は裏向きで配られる。」という効果に変更する。

## 変更内容

### 1. `initialExtraTableauRows`を`-1`から`+1`へ変更

対象: `src/lib/game/shidasu/params.ts`の`DEFAULT_PARAMS.spreads.moon`、`src/lib/game/shidasu/shidasu.config.json`の`spreads.moon`。

- `initialExtraTableauRows: -1` → `1`
- `desc`を「場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。」に更新
- `name`(「月」)は変更しない

### 2. 配布時の裏向き付与ロジックを`startWave`に追加

対象: `src/lib/game/shidasu/engine.ts`の`startWave`関数。

- `startWave`の引数末尾に`spreadId: SpreadId = 'fool'`を追加する(既存の`extraTableauRows`等と同じ位置引数スタイルを踏襲)
- 配布ループ(`for (let c = 0; c < cols; c++) { tableau.push(deck.splice(0, rows)) }`)の直後、`spreadId === 'moon'`のとき各列に対して先頭側(配列インデックス0起点、`Math.floor(rows / 2)`枚)の要素に`faceUp: false`を設定する
  - `rows`はこの関数内で既に計算済みの`params.layout.rows + extraTableauRows`(月の場合は`+1`を含んだ実際の配布行数)を使う
  - 各列の行数は`rows`で揃っているため、列ごとに同じ枚数(`Math.floor(rows / 2)`)を裏向きにする
- 呼び出し元2箇所(`engine.ts`内、`beginRun`相当の初回Wave開始処理と`playCard`等から呼ばれる次Wave開始処理)で、`run.spreadId`を新しい引数として渡す

### 3. カードの奥/手前の向き

各列の配列は`deck.splice(0, rows)`で生成される。配列の先頭側(index 0)が「奥」、末尾側(`col.length - 1`)が「操作可能な一番手前」であり、表示側(`PlayArea.svelte`)の`isTop`判定(`ri === col.length - 1`)はこの末尾側を指す。月の裏向きは配列の先頭側`Math.floor(rows / 2)`枚に適用するため、操作可能な一番手前のカードは常に表向きのまま維持される。

### 4. 表示側(`PlayArea.svelte`)は変更不要

既存の判定式`displayFaceUp = !tableauShuffleActive && (card.faceUp !== false || isTop)`をそのまま使う。月の裏向き行は`isTop`ではない(先頭側)ため、この式で正しく裏向き表示される。プレイが進んで列が縮み、これまで裏向きだったカードが`isTop`になった時点で自動的に表向き表示へ切り替わる。これは既存の妨害行動(総戻し・一列戻し等)由来の`faceUp: false`が解消される仕組みと同一。

### 5. `Card.faceUp`フラグの流用

既存の`Card.faceUp?: boolean`(現状は妨害行動由来の一時的な裏向き専用)をそのまま使う。新規フィールドは追加しない。`types.ts`のコメントに、月スプレッドの配布時裏向きもこのフラグを使う旨を追記する。

## テスト方針

`engine.test.ts`に`startWave`のテストケースを追加する。

- `spreadId: 'moon'`を渡して配布した場合、各列の先頭`Math.floor(rows / 2)`枚が`faceUp === false`、それ以降が`faceUp !== false`(未設定=表向き)になることを確認する。`rows`は`params.layout.rows + extraTableauRows`(月は`+1`)から算出される実際の配布行数を使う
- `spreadId`未指定(デフォルト`'fool'`)または`'pope'`を渡した場合、従来通り全カードの`faceUp`が未設定のままであることを確認する
- 既存の`startWave`呼び出しテスト(引数リストに`spreadId`を追加していないもの)は、デフォルト値`'fool'`で従来の挙動を維持するため、修正不要

## スコープ外

- `SpreadConfig`型への新規フィールド追加は行わない(裏向き行数は`moon`固有の固定式`Math.floor(rows / 2)`であり、他スプレッドでの再利用予定がないためadmin編集対象にしない)
- 既存の妨害行動由来`faceUp: false`ロジックとの統合・共通化は行わない(どちらも`faceUp: false`を設定するだけで、既存の解消・表示ロジックがそのまま両方に効くため統合不要)
- `params.layout.cols`(列数)や配布順序自体の変更は対象外
