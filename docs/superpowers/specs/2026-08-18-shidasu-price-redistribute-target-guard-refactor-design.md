# shop価格関数/riteEffects再配布/revelationEffectsガード共通化リファクタ 設計

> 対象: `docs/shidasu/shidasu-refactor-candidates.md`で洗い出し済みの3候補を一括で対応する。いずれも個々の計算ロジックは一切変更せず、機械的に重複している薄い部分だけを共通化する。純粋なリファクタであり挙動は一切変更しない。

## 背景・目的

前回のセッションでshidasuソース全体を広く調査し、`docs/shidasu/shidasu-refactor-candidates.md`に3件の安全な共通化候補をまとめた。いずれも独立した小規模な変更で、過去のラウンド4(3件を一括対応)と同様の進め方が可能と判断し、今回は3件まとめて対応する。

## 方針(スコープ)

以下の3件を対応する。

### A. `shop.ts`: `itemBuyPrice`/`itemSellPrice`を`categoryPrice`経由にする

`itemBuyPrice`/`itemSellPrice`(65-71行目)は、ラウンド2で秘儀/天啓/神託向けに導入済みの`categoryPrice`ヘルパーと全く同じ`Math.round(X[direction] * multiplier)`のロジックを個別に再実装している。`categoryPrice`呼び出しに置き換える。

### B. `riteEffects.ts`: `applyWunjo`/`applyHagalaz`/`applyKenaz`の再配布ループを共通化

「列ごとの現在の枚数を維持したまま、シャッフル済みの1本のプールから`cursor`を進めながらスライスして再配布し、余りを別の場所へ回す」というカーソルベースのループが、変数名の違いを除いて3関数で一字一句同一。`redistributeAcrossTableau`ヘルパーへ切り出す。プールの組み立て方(呼び出し元ごとに異なる)は各関数にそのまま残す。

### C. `revelationEffects.ts`: `withTarget`ラッパーで9箇所の`targetCol === null`ガードを共通化

`REVELATION_HANDLERS`内、列選択必須の9つの天啓(`kaku`/`kou`/`tei`/`bou`/`gyu`/`jo`/`aya`/`shitsu`/`hitsu`)で、`targetCol === null ? { wave, deckComposition } : 実処理(...)`という同一形のガードが繰り返されている。`withTarget`という高階関数でラップし、各ハンドラ本体では`targetCol`が`number`型に絞り込まれた状態で実処理を書けるようにする。

## 技術設計

### A. shop.ts

```ts
export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'buy')
}
export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'sell')
}
```

`categoryPrice`は`itemBuyPrice`より後方(73行目)で定義されているが、関数宣言の巻き上げにより問題なく参照できる(`resolveBridgeAdjustedLengths`等、過去のリファクタで既に使っている手法と同じ)。

### B. riteEffects.ts

`riteEffects.ts`内、`pickRandom`ヘルパーの直後に追加する:

```ts
function redistributeAcrossTableau(tableau: Card[][], source: Card[]): { tableau: Card[][]; remainder: Card[] } {
  let cursor = 0
  const newTableau = tableau.map(col => {
    const take = col.length
    const newCol = source.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  return { tableau: newTableau, remainder: source.slice(cursor) }
}
```

`applyWunjo`:
```ts
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const { tableau, remainder: discardPile } = redistributeAcrossTableau(wave.tableau, pool)
  return { ...wave, tableau, discardPile }
}
```

`applyHagalaz`:
```ts
function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  const { tableau, remainder: stock } = redistributeAcrossTableau(wave.tableau, pool)
  return { ...wave, tableau, stock }
}
```

`applyKenaz`(プール組み立て部分=スート別グルーピングは変更せず、末尾の再配布ループのみ置き換える):
```ts
function applyKenaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.stock, ...wave.tableau.flat()]
  const suits: Suit[] = ['♠', '♥', '♦', '♣', '★']
  const groups = new Map<Suit, Card[]>(suits.map(s => [s, []]))
  pool.forEach(c => groups.get(c.suit)!.push(c))
  const ordered = suits
    .filter(s => groups.get(s)!.length > 0)
    .sort((a, b) => groups.get(b)!.length - groups.get(a)!.length)
  const dealSequence: Card[] = []
  ordered.forEach(s => {
    const group = [...groups.get(s)!]
    shuffleInPlace(group, rand)
    dealSequence.push(...group)
  })
  const { tableau, remainder: stock } = redistributeAcrossTableau(wave.tableau, dealSequence)
  return { ...wave, tableau, stock }
}
```

### C. revelationEffects.ts

`revelationEffects.ts`内、`RevelationHandler`型エイリアスの直後(`noop`定数の前)に追加する:

```ts
function withTarget(
  fn: (wave: WaveState, deckComposition: DeckCard[], targetCol: number, params: ShidasuParams, rand: () => number) => { wave: WaveState; deckComposition: DeckCard[] }
): RevelationHandler {
  return (wave, deckComposition, targetCol, params, rand) =>
    targetCol === null ? { wave, deckComposition } : fn(wave, deckComposition, targetCol, params, rand)
}
```

`REVELATION_HANDLERS`内の該当9キーを以下のように置き換える:

```ts
kaku: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♠')),
kou: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♥')),
tei: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♦')),
bou: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♣')),
gyu: withTarget((wave, deckComposition, targetCol, _params, rand) =>
  convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand)),
jo: withTarget((wave, deckComposition, targetCol, _params, rand) =>
  convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand)),
aya: withTarget((wave, deckComposition, targetCol) => addWildToColumnTop(wave, deckComposition, targetCol)),
shitsu: withTarget((wave, deckComposition, targetCol) => convertColumnChainFromLeft(wave, deckComposition, targetCol)),
hitsu: withTarget((wave, deckComposition, targetCol, _params, rand) =>
  convertColumnToStair(wave, deckComposition, targetCol, rand)),
```

`kyo`・`subaru`等の`noop`グループ、`shin`/`bi`/`ki`/`to`/`heki`/`kei`/`rou`/`i`/`shi`/`sei`(列選択不要グループ)は変更しない。

## テスト

- A・B・Cいずれも純粋なディスパッチ/計算層の置き換えのため、既存の`shop.test.ts`・`riteEffects.test.ts`・`revelationEffects.test.ts`・`engine.test.ts`を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。
- 新規追加するヘルパー(`redistributeAcrossTableau`・`withTarget`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。これまでのリファクタと同じ方針)。

## スコープ外

- `docs/shidasu/shidasu-refactor-candidates.md`に記載した非推奨候補(`cardComboEffects.ts`のスート判定4護符、`chainAttributeEffects.ts`のスート専有/枚数加算系4+4護符)は、1護符=1リテラル実装というプロジェクトの一貫したスタイルを崩すため対象外のまま維持する。
- ゲームの挙動変更(本リファクタは純粋なリファクタであり一切の挙動変更を行わない)。
