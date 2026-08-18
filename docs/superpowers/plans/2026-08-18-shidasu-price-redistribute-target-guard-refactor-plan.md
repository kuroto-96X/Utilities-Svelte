# shop価格関数/riteEffects再配布/revelationEffectsガード共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/shidasu/shidasu-refactor-candidates.md`で洗い出し済みの3件(shop.tsの価格関数統一・riteEffects.tsの再配布ループ共通化・revelationEffects.tsのtargetColガード共通化)を一括で対応する。

**Architecture:** 3件は互いに独立したファイル(`shop.ts`・`riteEffects.ts`・`revelationEffects.ts`)への変更のため、3つの独立したタスクに分割する。各タスクとも、既存の計算ロジック・個々のヘルパー関数の実装は一切変更せず、機械的に重複しているディスパッチ/計算の薄い層だけを共通ヘルパーへ切り出す。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-price-redistribute-target-guard-refactor-design.md`

---

## Task 1: `shop.ts`の`itemBuyPrice`/`itemSellPrice`を`categoryPrice`経由にする

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts`

- [ ] **Step 1: `itemBuyPrice`/`itemSellPrice`を置き換える**

`src/lib/game/shidasu/shop.ts`内、以下のブロック(`grep -n "export function itemBuyPrice"`で位置を特定できる。現在65-71行目):

```ts
export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].buy * relicPriceMultiplier(params, run))
}

export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return Math.round(params.shop.itemPrice[params.talismans[id].rarity].sell * relicSellBonusMultiplier(params, run))
}
```

を以下に置き換える:

```ts
export function itemBuyPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'buy')
}

export function itemSellPrice(params: ShidasuParams, run: RunState, id: ItemId): number {
  return categoryPrice(params, run, params.shop.itemPrice[params.talismans[id].rarity], 'sell')
}
```

(`categoryPrice`は同ファイル内の後方(73行目付近)で既に定義済みの関数。TypeScript/JavaScriptの関数宣言は巻き上げされるため、`itemBuyPrice`/`itemSellPrice`が`categoryPrice`より前方に定義されていても問題なく呼び出せる。)

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 3: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`
Expected: 全件PASS(護符の売買価格関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/shop.ts
git commit -m "refactor: shop.tsのitemBuyPrice/itemSellPriceをcategoryPrice経由にする"
```

---

## Task 2: `riteEffects.ts`の`applyWunjo`/`applyHagalaz`/`applyKenaz`の再配布ループを共通化する

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts`

- [ ] **Step 1: `redistributeAcrossTableau`ヘルパーを追加する**

`src/lib/game/shidasu/riteEffects.ts`内、`pickRandom`ヘルパーの直後(`grep -n "function pickRandom"`で位置を特定できる。現在6-8行目の直後)に以下を追加する:

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

- [ ] **Step 2: `applyWunjo`を置き換える**

同ファイル内、以下のブロック(`grep -n "function applyWunjo"`で位置を特定できる):

```ts
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.discardPile]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const discardPile = pool.slice(cursor)
  return { ...wave, tableau, discardPile }
}
```

を以下に置き換える:

```ts
function applyWunjo(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.discardPile]
  shuffleInPlace(pool, rand)
  const { tableau, remainder: discardPile } = redistributeAcrossTableau(wave.tableau, pool)
  return { ...wave, tableau, discardPile }
}
```

- [ ] **Step 3: `applyKenaz`を置き換える**

同ファイル内、以下のブロック(`grep -n "function applyKenaz"`で位置を特定できる):

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
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = dealSequence.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = dealSequence.slice(cursor)
  return { ...wave, tableau, stock }
}
```

を以下に置き換える:

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

- [ ] **Step 4: `applyHagalaz`を置き換える**

同ファイル内、以下のブロック(`grep -n "function applyHagalaz"`で位置を特定できる):

```ts
function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = pool.slice(cursor)
  return { ...wave, tableau, stock }
}
```

を以下に置き換える:

```ts
function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  const { tableau, remainder: stock } = redistributeAcrossTableau(wave.tableau, pool)
  return { ...wave, tableau, stock }
}
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 6: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(秘儀「豊穣(wunjo)」「雹(hagalaz)」「賢(kenaz)」関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.ts
git commit -m "refactor: riteEffects.tsのapplyWunjo/applyHagalaz/applyKenazの再配布ループをredistributeAcrossTableauへ共通化する"
```

---

## Task 3: `revelationEffects.ts`の`withTarget`ラッパーで9箇所のガードを共通化する

**Files:**
- Modify: `src/lib/game/shidasu/revelationEffects.ts`

- [ ] **Step 1: `withTarget`ヘルパーを追加する**

`src/lib/game/shidasu/revelationEffects.ts`内、`RevelationHandler`型エイリアスの直後・`noop`定数の直前(`grep -n "const noop: RevelationHandler"`で位置を特定できる)に以下を追加する:

```ts
function withTarget(
  fn: (wave: WaveState, deckComposition: DeckCard[], targetCol: number, params: ShidasuParams, rand: () => number) => { wave: WaveState; deckComposition: DeckCard[] }
): RevelationHandler {
  return (wave, deckComposition, targetCol, params, rand) =>
    targetCol === null ? { wave, deckComposition } : fn(wave, deckComposition, targetCol, params, rand)
}

```

- [ ] **Step 2: `REVELATION_HANDLERS`内の該当9キーを置き換える**

同ファイル内、`REVELATION_HANDLERS`定数内の以下9キー(`grep -n "kaku: (wave, deckComposition, targetCol)"`で位置を特定できる)を置き換える。

以下のブロック:

```ts
  kaku: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♠'),
  kou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♥'),
  tei: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♦'),
  bou: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToSuit(wave, deckComposition, targetCol, '♣'),
  shin: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♠', '♥'),
  bi: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♥', '♣'),
  ki: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♣', '♦'),
  to: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♦', '♠'),
  gyu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand),
  jo: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand),
  kyo: noop,
  aya: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : addWildToColumnTop(wave, deckComposition, targetCol),
  shitsu: (wave, deckComposition, targetCol) =>
    targetCol === null ? { wave, deckComposition } : convertColumnChainFromLeft(wave, deckComposition, targetCol),
  heki: (wave, deckComposition) => convertTableauSuitCycle(wave, deckComposition),
  kei: (wave, deckComposition) => stairAlignTopCards(wave, deckComposition),
  rou: (wave, deckComposition) => discardColumnTops(wave, deckComposition),
  i: (wave, deckComposition, _targetCol, _params, rand) => wildifyExtremeRanks(wave, deckComposition, rand),
  hitsu: (wave, deckComposition, targetCol, _params, rand) =>
    targetCol === null ? { wave, deckComposition } : convertColumnToStair(wave, deckComposition, targetCol, rand),
  shi: (wave, deckComposition) => wildifyChainTop(wave, deckComposition),
  sei: (wave, deckComposition, _targetCol, params, rand) => wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand),
```

を以下に置き換える(`shin`/`bi`/`ki`/`to`/`heki`/`kei`/`rou`/`i`/`shi`/`sei`は変更しない):

```ts
  kaku: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♠')),
  kou: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♥')),
  tei: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♦')),
  bou: withTarget((wave, deckComposition, targetCol) => convertColumnToSuit(wave, deckComposition, targetCol, '♣')),
  shin: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♠', '♥'),
  bi: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♥', '♣'),
  ki: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♣', '♦'),
  to: (wave, deckComposition) => convertTableauSuit(wave, deckComposition, '♦', '♠'),
  gyu: withTarget((wave, deckComposition, targetCol, _params, rand) =>
    convertColumnToRandomRank(wave, deckComposition, targetCol, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rand)),
  jo: withTarget((wave, deckComposition, targetCol, _params, rand) =>
    convertColumnToRandomRank(wave, deckComposition, targetCol, [11, 12, 13], rand)),
  kyo: noop,
  aya: withTarget((wave, deckComposition, targetCol) => addWildToColumnTop(wave, deckComposition, targetCol)),
  shitsu: withTarget((wave, deckComposition, targetCol) => convertColumnChainFromLeft(wave, deckComposition, targetCol)),
  heki: (wave, deckComposition) => convertTableauSuitCycle(wave, deckComposition),
  kei: (wave, deckComposition) => stairAlignTopCards(wave, deckComposition),
  rou: (wave, deckComposition) => discardColumnTops(wave, deckComposition),
  i: (wave, deckComposition, _targetCol, _params, rand) => wildifyExtremeRanks(wave, deckComposition, rand),
  hitsu: withTarget((wave, deckComposition, targetCol, _params, rand) =>
    convertColumnToStair(wave, deckComposition, targetCol, rand)),
  shi: (wave, deckComposition) => wildifyChainTop(wave, deckComposition),
  sei: (wave, deckComposition, _targetCol, params, rand) => wildifyRandomTableauCards(wave, deckComposition, params.revelations.sei.n, rand),
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 4: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(列選択が必要な天啓(角・亢・氐・房・牛・女・翼・室・畢)関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/revelationEffects.ts
git commit -m "refactor: revelationEffects.tsのtargetCol===nullガードをwithTargetへ共通化する"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
