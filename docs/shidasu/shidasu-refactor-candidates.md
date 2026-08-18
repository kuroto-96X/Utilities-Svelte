# リファクタリング候補一覧(調査用メモ)

過去10回のリファクタセッション(詳細は`shidasu-roadmap.md`参照)で手をつけていない範囲を対象に、shidasuソース全体(`src/lib/game/shidasu/`配下の全`.ts`ファイル、`src/routes/game/shidasu/`配下の全`.svelte`ファイル)を改めて広く調査した結果のメモ。実装はまだ行っていない。次回以降のリファクタセッションで候補として使う想定。

## 推奨候補(安全に共通化できると判断)

### 候補1: `shop.ts`の`itemBuyPrice`/`itemSellPrice`が`categoryPrice`に未移行

`src/lib/game/shidasu/shop.ts` 65-76行目。

```ts
export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].buy * relicPriceMultiplier(params, run))
}
export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].sell * relicSellBonusMultiplier(params, run))
}

function categoryPrice(params: ShidasuParams, run: RunState, priceConfig: { buy: number; sell: number }, direction: 'buy' | 'sell'): number {
  const multiplier = direction === 'buy' ? relicPriceMultiplier(params, run) : relicSellBonusMultiplier(params, run)
  return Math.round(priceConfig[direction] * multiplier)
}
```

`categoryPrice`は既にこのセッション(ラウンド2「売却・価格関数・buy/sellハンドラ共通化リファクタ」)で秘儀/天啓/神託の4価格関数の共通化用に導入済みだが、`itemBuyPrice`/`itemSellPrice`だけはこの共通化に乗らず、全く同じ`Math.round(X[direction] * multiplier)`のロジックを個別に再実装したまま残っている。`itemBuyPrice(params, run, id)`を`categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'buy')`と展開すると数式・丸め処理・乗数選択ロジックが1文字違わず一致する(sell側も同様)。関数呼び出しへの置き換えだけで挙動は一切変わらない、最小規模の候補。

### 候補2: `riteEffects.ts`の`applyWunjo`/`applyHagalaz`/`applyKenaz`で再配布ループが完全一致

`src/lib/game/shidasu/riteEffects.ts`の`applyWunjo`(26-38行目)・`applyHagalaz`(189-201行目)・`applyKenaz`(106-129行目、後半)。

「列ごとの現在の枚数(`col.length`)を維持したまま、シャッフル済みの1本のプールから`cursor`を進めながらスライスして再配布し、余りを別の場所(discardPile/stock)へ回す」というカーソルベースのループが、変数名の違い(`pool`/`dealSequence`)を除いて一字一句同一。

```ts
let cursor = 0
const tableau = wave.tableau.map(col => {
  const take = col.length
  const newCol = pool.slice(cursor, cursor + take)
  cursor += take
  return newCol
})
const discardPile = pool.slice(cursor) // applyHagalaz/applyKenazではstock、applyKenazはdealSequence.slice(cursor)
```

差分はプールの組み立て方(単純結合 vs スート別グルーピング)と、余りの格納先フィールド名だけであり、再配布アルゴリズム自体は3箇所とも同一の副作用のない純粋な計算。`redistributeAcrossTableau(tableau: Card[][], source: Card[]): { tableau: Card[][]; remainder: Card[] }`のようなヘルパーへ抽出しても、各呼び出し元の挙動(スロットへの割当順序・境界条件)は完全に保存される。

### 候補3: `revelationEffects.ts`の`REVELATION_HANDLERS`で「列未選択なら何もしない」ガードが9回同型

`src/lib/game/shidasu/revelationEffects.ts` 255-281行目付近(`kaku`/`kou`/`tei`/`bou`/`gyu`/`jo`/`aya`/`shitsu`/`hitsu`)。前回のリファクタ(ラウンド10「revelationEffects.ts applyRevelationEffect Record化」)のコード品質レビューでMinor指摘として既出。

```ts
kaku: (wave, deckComposition, targetCol) =>
  targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠'),
kou: (wave, deckComposition, targetCol) =>
  targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥'),
// ...(tei/bou/gyu/jo/aya/shitsu/hitsuも同型)
```

列選択が必要な9つの天啓(`revelationNeedsTarget`がtrueを返す全種)すべてで、`targetCol === null ? { wave, deckComposition } : 実処理(wave, deckComposition, targetCol, ...)`という同一形のガードが手書きで繰り返されている。`withTarget(fn) => (wave, deckComposition, targetCol, params, rand) => targetCol === null ? {wave, deckComposition} : fn(wave, deckComposition, targetCol, params, rand)`のような高階関数でラップしても、nullチェックの評価順序・早期リターンの意味は完全に保存される。

## 調査したが非推奨と判断した候補

### `cardComboEffects.ts`のスート判定4護符(春風/夏風/秋風/冬風)

`src/lib/game/shidasu/cardComboEffects.ts` 8-35行目。「今回取得したカードのスートが特定の1種なら固定加点」という同一ロジックが、スート・護符ID・表示ラベルの3点だけを差し替えて4回繰り返されている。ロジック自体は完全一致するが、このプロジェクトでは「1護符=1個の名前付きリテラル実装」という一貫したスタイルを100護符すべてで意図的に採っており、ファクトリ関数化するとgrep性・可読性がむしろ下がる懸念がある。過去の教訓(表面的な一致だけで共通化に踏み切らない)に基づき対象外と判断した。

### `chainAttributeEffects.ts`のスート専有×倍率系4護符・スート枚数×加算系4護符

`src/lib/game/shidasu/chainAttributeEffects.ts`の専有系(`verdantGreen`・`gem`・`resolve`・`grail`、98-129行目)、枚数加算系(`cloverLeaf`・`coin`・`blade`・`chalice`、155-190行目)。既存の共通ヘルパー(`chainSuitExclusive`/`countSuitInChain`)を呼ぶだけの薄いラッパーで計算式・分岐構造が完全一致するが、上記と同じ理由(1護符=1リテラル実装のスタイル維持)で対象外と判断した。なお`moonlight`/`sunlight`(`chainColorExclusive`を使う近い構造)は2件のみかつ異なるboolean引数(`red`/`black`)を取るため、無理に3系統目としてまとめるより2護符専用のままの方が可読性の観点で妥当。

## 次回セッションでの使い方

候補1〜3はいずれも単独で安全に着手できる小〜中規模のリファクタ。次回`/superpowers:brainstorming`で「次のリファクタリング」を検討する際は、本メモを起点に候補を選定し、通常のbrainstorming→design→plan→subagent-driven-developmentフローに従って進める。
