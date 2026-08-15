# 売却・価格関数・buy/sellハンドラ共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`の売却系4関数(`sellItem`/`sellRite`/`sellRevelation`/`sellOracle`)、`src/lib/game/shidasu/shop.ts`の秘儀・天啓・神託の価格関数6個、`src/routes/game/shidasu/+page.svelte`の対応するbuy/sellハンドラ10個にある機械的な重複を、安全な範囲で共通化する。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

直前のセッションで、福袋(item/rite/revelation/oracle/cardSet)5カテゴリ分のpick/confirm/cancel/closeフローの重複を共通ヘルパー・ファクトリ関数に切り出すリファクタを実施した(`docs/superpowers/specs/2026-08-15-shidasu-pack-flow-common-refactor-design.md`)。今回はその続きとして、`engine.ts`・`shop.ts`・`+page.svelte`に残る別の重複パターンを調査し、以下3箇所の共通化に着手する。

- `engine.ts`の売却系4関数(`sellItem`/`sellRite`/`sellRevelation`/`sellOracle`): 対象配列名・価格関数以外ほぼ完全に同一のパターンで、福袋pick系と同程度に明確な重複
- `shop.ts`の秘儀・天啓・神託の価格関数6個(`riteBuyPrice`/`riteSellPrice`/`revelationBuyPrice`/`revelationSellPrice`/`oracleBuyPrice`/`oracleSellPrice`): `Math.round(価格 * 倍率)`という完全同型の繰り返し
- `+page.svelte`のbuy系6個・sell系4個のハンドラ: 前回導入済みの`bindParamsRunAction`ファクトリにそのまま適合する形なので、新規コードを書かずに流用できる

調査の結果、`engine.ts`のショップ購入(`buyIndividualXxx`)系5関数は、kindチェックの有無・対象配列名・容量チェック関数名がカテゴリごとに微妙に異なり、無理に共通化すると条件分岐が増えるため今回のスコープからは除外する(詳細は「スコープ外」を参照)。

## 方針(スコープ)

3つの独立した共通化を行う。いずれも該当箇所を機械的に置き換えるだけで、公開APIのシグネチャ・戻り値は一切変更しない。

## 技術設計

### A. `engine.ts`: 売却系4関数の共通化

現状の4関数(`sellItem`/`sellRite`/`sellRevelation`/`sellOracle`)は、フェーズガード→対象配列からのindexOf検索→無ければno-op→除去→`currency`加算、という完全に同一の構造を持つ。

```ts
export function sellItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.items.indexOf(itemId)
  if (idx === -1) return run
  const items = [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  return { ...run, items, currency: run.currency + itemSellPrice(params, run, itemId) }
}
```

以下の共通ヘルパーへ切り出す(福袋pick系リファクタの`resolvePackOfferPick`と同様、動的キー+`as RunState`キャストを使う):

```ts
// 所持配列から1個を売却し、通貨を得る共通処理。playing/shopフェーズでのみ呼べる。
function sellFromArray<T>(run: RunState, arrayField: 'items' | 'rites' | 'revelations' | 'oracles', arr: T[], id: T, price: number): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = arr.indexOf(id)
  if (idx === -1) return run
  const newArr = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  return { ...run, [arrayField]: newArr, currency: run.currency + price } as RunState
}

export function sellItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  return sellFromArray(run, 'items', run.items, itemId, itemSellPrice(params, run, itemId))
}

export function sellRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  return sellFromArray(run, 'rites', run.rites, riteId, riteSellPrice(params, run))
}

export function sellRevelation(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  return sellFromArray(run, 'revelations', run.revelations, revelationId, revelationSellPrice(params, run))
}

export function sellOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  return sellFromArray(run, 'oracles', run.oracles, roleName, oracleSellPrice(params, run))
}
```

**技術的な注意点**: `itemSellPrice(params, run, itemId)`等の価格計算は、呼び出し元(`sellItem`等)の引数として渡すため、`sellFromArray`内部のフェーズガード・存在チェックより先に評価される(JavaScript の引数は呼び出し前に評価されるため)。元の実装では`return`文の中でのみ評価されていたため、フェーズガードで早期returnした場合は価格計算自体が発生しなかった。今回の変更により、フェーズ外・非所持のケースでも価格計算が無条件に実行されるようになるが、価格計算関数(`itemSellPrice`等)は副作用のない純粋な算術関数であるため、結果には一切影響しない(無駄な計算が発生するだけで、無視できるレベルの軽微なオーバーヘッド)。

### B. `shop.ts`: rite/revelation/oracleの価格関数6個の共通化

`riteBuyPrice`/`riteSellPrice`/`revelationBuyPrice`/`revelationSellPrice`/`oracleBuyPrice`/`oracleSellPrice`はいずれも`Math.round(params.shop.XPrice.[buy|sell] * 倍率)`という同型(倍率は`buy`なら`relicPriceMultiplier`、`sell`なら`relicSellBonusMultiplier`)。

```ts
export function riteBuyPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.buy * relicPriceMultiplier(params, run))
}
export function riteSellPrice(params: ShidasuParams, run: RunState): number {
  return Math.round(params.shop.ritePrice.sell * relicSellBonusMultiplier(params, run))
}
```

以下の共通ヘルパーへ切り出す:

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
```

revelation・oracleも同様に`params.shop.revelationPrice`・`params.shop.oraclePrice`を渡す形にする。`itemBuyPrice`/`itemSellPrice`(rarity引数があり価格体系が異なる)・`relicBuyPrice`(別の価格体系)は対象外とする。

### C. `+page.svelte`: buy系6個・sell系4個のハンドラをファクトリ化

前回の福袋リファクタで`+page.svelte`に導入済みの`bindParamsRunAction`(`(params: ShidasuParams, run: RunState, arg: TArg) => RunState`という形の関数から、`(arg: TArg) => void`ハンドラを生成するファクトリ)をそのまま再利用する。新規コードは不要。

対象10ハンドラ:

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

これらを以下のように`bindParamsRunAction`経由の生成に置き換える:

```ts
  const handleBuyIndividualItem = bindParamsRunAction(buyIndividualItem)
  const handleBuyIndividualRite = bindParamsRunAction(buyIndividualRite)
  const handleBuyRelic = bindParamsRunAction(buyRelic)
  const handleBuyIndividualRevelationHold = bindParamsRunAction(buyIndividualRevelationHold)
  const handleBuyIndividualOracleUse = bindParamsRunAction(buyIndividualOracleUse)
  const handleBuyIndividualOracleHold = bindParamsRunAction(buyIndividualOracleHold)

  const handleSellItem = bindParamsRunAction(sellItem)
  const handleSellRite = bindParamsRunAction(sellRite)
  const handleSellRevelation = bindParamsRunAction(sellRevelation)
  const handleSellOracle = bindParamsRunAction(sellOracle)
```

`handleBuyIndividualRevelationUse`に相当する処理(`buyIndividualRevelationUse`)は、天啓の列選択プレビュー・盤面適用を伴う複雑なロジック(`handleTargetColumn`内)に組み込まれているため対象外とする(福袋の`pickPackRevelationUse`が同じ理由で対象外だったのと同様)。

## テスト

- `engine.ts`側(A)は純粋なリファクタのため、既存の`engine.test.ts`内の`sellItem`/`sellRite`/`sellRevelation`/`sellOracle`関連テストを無修正のまま実行し、全てグリーンであることを確認する。
- `shop.ts`側(B)も同様に、既存の`shop.test.ts`(または該当テストファイル)の価格関数関連テストを無修正のまま実行し、全てグリーンであることを確認する。
- 新規ヘルパー(`sellFromArray`・`categoryPrice`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。福袋pick系リファクタと同じ方針)。
- `+page.svelte`側(C)の変更は型チェック(`npm run check`)で検証する。UIの目視確認として、ショップでバラ売り(護符・秘儀・レリック・天啓温存・神託使用・神託温存)の購入、および所持護符・秘儀・天啓・神託の売却が壊れていないことを確認する。

## スコープ外

- `engine.ts`のショップ購入(`buyIndividualItem`/`buyIndividualRite`/`buyRelic`/`buyIndividualRevelationHold`/`buyIndividualOracleUse`/`buyIndividualOracleHold`)5関数自体の共通化。kindチェックの有無・対象配列名・容量チェック関数名(`itemMaxCapacity`/`riteMaxCapacity`/`revelationOracleMaxCapacity`)がカテゴリごとに異なり、`buyIndividualRevelationUse`/`buyIndividualOracleUse`(即時使用系)はwave即時適用ロジックも混在するため、無理に共通化すると条件分岐が増え可読性が下がる。将来別セッションで改めて検討する
- `buyPack`(phase遷移主体の別パターン)
- `itemBuyPrice`/`itemSellPrice`(rarity引数がある)・`relicBuyPrice`(別の価格体系)
- `+page.svelte`のショップ画面テンプレート内の`slot.kind`分岐(表示文言・ハンドラ選択のためのマークアップ分岐であり、無理に共通化すると可読性が下がる)
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
