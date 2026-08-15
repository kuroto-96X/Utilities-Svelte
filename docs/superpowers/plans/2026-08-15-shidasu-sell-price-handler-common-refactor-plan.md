# 売却・価格関数・buy/sellハンドラ共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`の売却系4関数、`src/lib/game/shidasu/shop.ts`の秘儀・天啓・神託の価格関数6個の機械的重複を共通ヘルパーに切り出し、`src/routes/game/shidasu/+page.svelte`の対応するbuy/sellハンドラ10個を既存ファクトリで置き換える。

**Architecture:** `engine.ts`に`sellFromArray`ヘルパー、`shop.ts`に`categoryPrice`ヘルパーを追加し、既存の4+6関数をそれぞれ委譲する形へ書き換える。`+page.svelte`側は前回の福袋リファクタで導入済みの`bindParamsRunAction`ファクトリをそのまま再利用する(新規コード不要)。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-sell-price-handler-common-refactor-design.md`

---

## Task 1: `engine.ts`の売却系4関数を`sellFromArray`ヘルパーに委譲する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`sellItem`・`sellRite`・`sellRevelation`・`sellOracle`)

- [ ] **Step 1: 現在の4関数をまとめて置き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "export function sellItem"`で位置を特定できる):

```ts
// 所持中の護符を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.items.indexOf(itemId)
  if (idx === -1) return run
  const items = [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  return { ...run, items, currency: run.currency + itemSellPrice(params, run, itemId) }
}

// 所持中の秘儀を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, rites, currency: run.currency + riteSellPrice(params, run) }
}

// 所持中の天啓を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRevelation(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, revelations, currency: run.currency + revelationSellPrice(params, run) }
}

// 所持中の神託を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return { ...run, oracles, currency: run.currency + oracleSellPrice(params, run) }
}
```

を以下に置き換える:

```ts
// 所持配列から1個を売却し、通貨を得る共通処理。playing/shopフェーズでのみ呼べる。
// フィールドの動的キーアクセスのため戻り値をRunStateにキャストしている(呼び出し元は
// 決まった4パターンに限定されるため、型安全性は既存テストで担保する。福袋pick系リファクタの
// resolvePackOfferPickと同じ理由・同じパターン)。
function sellFromArray<T>(run: RunState, arrayField: 'items' | 'rites' | 'revelations' | 'oracles', arr: T[], id: T, price: number): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = arr.indexOf(id)
  if (idx === -1) return run
  const newArr = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  return { ...run, [arrayField]: newArr, currency: run.currency + price } as RunState
}

// 所持中の護符を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  return sellFromArray(run, 'items', run.items, itemId, itemSellPrice(params, run, itemId))
}

// 所持中の秘儀を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  return sellFromArray(run, 'rites', run.rites, riteId, riteSellPrice(params, run))
}

// 所持中の天啓を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRevelation(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  return sellFromArray(run, 'revelations', run.revelations, revelationId, revelationSellPrice(params, run))
}

// 所持中の神託を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  return sellFromArray(run, 'oracles', run.oracles, roleName, oracleSellPrice(params, run))
}
```

(`sellFromArray`が呼び出し前に`price`引数を評価するため、フェーズガードや所持チェックで早期returnするケースでも価格計算自体は必ず実行されるようになる。ただし`itemSellPrice`等は副作用の無い純粋な算術関数なので、結果には一切影響しない。)

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 3: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`sellItem`/`sellRite`/`sellRevelation`/`sellOracle`関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: sellFromArrayヘルパーを追加し護符・秘儀・天啓・神託の売却処理を共通化する"
```

---

## Task 2: `shop.ts`のrite/revelation/oracle価格関数6個を`categoryPrice`ヘルパーに委譲する

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts`(`riteBuyPrice`・`riteSellPrice`・`revelationBuyPrice`・`revelationSellPrice`・`oracleBuyPrice`・`oracleSellPrice`)

- [ ] **Step 1: 現在の6関数をまとめて置き換える**

`src/lib/game/shidasu/shop.ts`内、以下のブロック(`grep -n "export function riteBuyPrice"`で位置を特定できる):

```ts
export function riteBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.buy * relicPriceMultiplier(params, run))
}

export function riteSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.sell * relicSellBonusMultiplier(params, run))
}

export function revelationBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.buy * relicPriceMultiplier(params, run))
}

export function revelationSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.revelationPrice.sell * relicSellBonusMultiplier(params, run))
}

export function oracleBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.buy * relicPriceMultiplier(params, run))
}

export function oracleSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.oraclePrice.sell * relicSellBonusMultiplier(params, run))
}
```

を以下に置き換える(`itemBuyPrice`/`itemSellPrice`/`relicBuyPrice`はこのブロックの前後にあるが、価格体系が異なるため変更しない):

```ts
function categoryPrice(params: ShidasuParams, run: RunState, priceConfig: { buy: number; sell: number }, direction: 'buy' | 'sell'): number {
  const multiplier = direction === 'buy' ? relicPriceMultiplier(params, run) : relicSellBonusMultiplier(params, run)
  return Math.round(priceConfig[direction] * multiplier)
}

export function riteBuyPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.ritePrice, 'buy')
}

export function riteSellPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.ritePrice, 'sell')
}

export function revelationBuyPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.revelationPrice, 'buy')
}

export function revelationSellPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.revelationPrice, 'sell')
}

export function oracleBuyPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.oraclePrice, 'buy')
}

export function oracleSellPrice(params: ShidasuParams, run: RunState): number {
  return categoryPrice(params, run, params.shop.oraclePrice, 'sell')
}
```

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 3: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`
Expected: 全件PASS(価格関数6個の既存テストを含め、無修正のまま全てグリーンになるはず)

- [ ] **Step 4: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(engine.ts・shop.ts側のリファクタはこれで完了)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/shop.ts
git commit -m "refactor: categoryPriceヘルパーを追加し秘儀・天啓・神託の価格関数を共通化する"
```

---

## Task 3: `+page.svelte`のbuy/sellハンドラを既存ファクトリで置き換える

前回の福袋リファクタで導入済みの`bindParamsRunAction`ファクトリ(`(params: ShidasuParams, run: RunState, arg: TArg) => RunState`という形の関数から`(arg: TArg) => void`ハンドラを生成する)をそのまま再利用する。新規ファクトリの追加は不要。engine.ts側の関数シグネチャは一切変わっていないため、この変更は`+page.svelte`単体で完結する。

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: buy系6ハンドラを置き換える**

`src/routes/game/shidasu/+page.svelte`内、以下のブロック(`grep -n "function handleBuyIndividualItem"`で位置を特定できる):

```ts
  function handleBuyIndividualItem(slotIndex: number) {
    run = buyIndividualItem(params, run, slotIndex)
  }

  function handleBuyIndividualRite(slotIndex: number) {
    run = buyIndividualRite(params, run, slotIndex)
  }

  function handleBuyRelic(slotIndex: number) {
    run = buyRelic(params, run, slotIndex)
  }

  function handleBuyIndividualRevelationHold(slotIndex: number) {
    run = buyIndividualRevelationHold(params, run, slotIndex)
  }

  function handleBuyIndividualOracleUse(slotIndex: number) {
    run = buyIndividualOracleUse(params, run, slotIndex)
  }

  function handleBuyIndividualOracleHold(slotIndex: number) {
    run = buyIndividualOracleHold(params, run, slotIndex)
  }
```

を以下に置き換える(直後にある`handleBuyPack`は天啓プレビュー起動の追加ロジックを持つため変更しない):

```ts
  const handleBuyIndividualItem = bindParamsRunAction(buyIndividualItem)
  const handleBuyIndividualRite = bindParamsRunAction(buyIndividualRite)
  const handleBuyRelic = bindParamsRunAction(buyRelic)
  const handleBuyIndividualRevelationHold = bindParamsRunAction(buyIndividualRevelationHold)
  const handleBuyIndividualOracleUse = bindParamsRunAction(buyIndividualOracleUse)
  const handleBuyIndividualOracleHold = bindParamsRunAction(buyIndividualOracleHold)
```

- [ ] **Step 2: sell系4ハンドラを置き換える**

続けて同ファイル内、以下のブロック(`grep -n "function handleSellItem"`で位置を特定できる):

```ts
  function handleSellItem(itemId: ItemId) {
    run = sellItem(params, run, itemId)
  }
  function handleSellRite(riteId: RiteId) {
    run = sellRite(params, run, riteId)
  }
  function handleSellRevelation(revelationId: RevelationId) {
    run = sellRevelation(params, run, revelationId)
  }
  function handleSellOracle(roleName: RoleName) {
    run = sellOracle(params, run, roleName)
  }
```

を以下に置き換える:

```ts
  const handleSellItem = bindParamsRunAction(sellItem)
  const handleSellRite = bindParamsRunAction(sellRite)
  const handleSellRevelation = bindParamsRunAction(sellRevelation)
  const handleSellOracle = bindParamsRunAction(sellOracle)
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し(`bindParamsRunAction`は前回の福袋リファクタで既に`+page.svelte`に定義済みのはず。`grep -n "function bindParamsRunAction"`で存在を確認すること。念のため`grep -n "handleBuyIndividualItem\|handleSellItem"`等でテンプレート側の呼び出し箇所を確認し、関数からconstへの変更で参照が壊れていないことを確認する)

- [ ] **Step 4: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: 開発サーバーで目視確認する**

Run: `npm run dev`(既にポート5173で稼働中ならこのステップはスキップしてよい)

`http://localhost:5173/game/shidasu`でショップに入り、バラ売り枠(護符・秘儀・レリック・天啓温存・神託使用・神託温存)の購入、および所持護符・秘儀・天啓・神託の売却が壊れていないことを確認する。ブラウザ操作が困難な環境であれば、型チェック・ビルドの成功で代替してよい。

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "refactor: buy/sellハンドラをbindParamsRunActionファクトリ経由の生成に置き換える"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、バラ売り購入・売却の一連の操作(護符・秘儀・レリック・天啓・神託)を一通り試し、画面崩れ・挙動の変化が無いことを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
