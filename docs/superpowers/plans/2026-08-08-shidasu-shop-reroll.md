# ショップ品ぞろえリロール機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ショップ画面にバラ売り3枠+福袋2枠の品ぞろえを一括で再抽選する「リロール」ボタンを追加する。売り切れ済みの枠も含めて全て入れ替わり、コストは同一ショップ訪問中のリロール回数に応じて増額する。

**Architecture:** `RunState`に新フィールド`shopRerollCount`を追加し、`enterShop`(次のショップに入るたび)で0にリセットする。既存の`rollShop`関数(`shop.ts`)をそのまま再利用してショップ全体を差し替える新関数`rerollShop`を`engine.ts`に追加し、コストは`shopRerollCost`ヘルパーで計算する。UIは既存のボスWaveリロールボタン(`rerollStageStars`)と同じdisabledパターンを踏襲する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: 型定義・パラメータの追加とRunState構築箇所の追随

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `types.ts`に`RunState.shopRerollCount`を追加する**

`src/lib/game/shidasu/types.ts`内、以下の既存コードを探す:

```ts
  // カードセット福袋('cardSetSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  cardSetOffer: CardSetOffer[]
}
```

以下に置き換える:

```ts
  // カードセット福袋('cardSetSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  cardSetOffer: CardSetOffer[]
  // 現在のショップ訪問でリロール(品ぞろえの再抽選)した回数。次のショップに入る(enterShop)たびに0にリセットされる
  shopRerollCount: number
}
```

- [ ] **Step 2: `params.ts`の型定義に`shop.rerollCostStep`を追加する**

`src/lib/game/shidasu/params.ts`内、以下の既存コードを探す:

```ts
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 護符/秘儀/天啓/カードセットは3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
      cardSet: { threeOne: number; fiveOne: number; sevenTwo: number }
    }
  }
```

以下に置き換える:

```ts
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 護符/秘儀/天啓/カードセットは3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
      cardSet: { threeOne: number; fiveOne: number; sevenTwo: number }
    }
    // ショップの品ぞろえ全体(バラ売り3枠+福袋2枠)を再抽選するリロールのコスト刻み幅。
    // 1回目はrerollCostStep、2回目は2倍、3回目は3倍…と、同一ショップ訪問中のリロール回数に応じて増額する
    rerollCostStep: number
  }
```

- [ ] **Step 3: `params.ts`の`DEFAULT_PARAMS`に`rerollCostStep`の値を追加する**

`src/lib/game/shidasu/params.ts`内、以下の既存コードを探す:

```ts
  shop: {
    itemPrice: { C: { buy: 8, sell: 4 }, U: { buy: 16, sell: 8 }, R: { buy: 30, sell: 15 } },
    ritePrice: { buy: 12, sell: 6 },
    revelationPrice: { buy: 18, sell: 9 },
    oraclePrice: { buy: 15, sell: 7 },
    packPrice: {
      item: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      rite: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      revelation: { threeOne: 25, fiveOne: 38, sevenTwo: 63 },
      oracle: { threeOne: 22, fiveOne: 33 },
      cardSet: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
    },
  },
```

以下に置き換える:

```ts
  shop: {
    itemPrice: { C: { buy: 8, sell: 4 }, U: { buy: 16, sell: 8 }, R: { buy: 30, sell: 15 } },
    ritePrice: { buy: 12, sell: 6 },
    revelationPrice: { buy: 18, sell: 9 },
    oraclePrice: { buy: 15, sell: 7 },
    packPrice: {
      item: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      rite: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      revelation: { threeOne: 25, fiveOne: 38, sevenTwo: 63 },
      oracle: { threeOne: 22, fiveOne: 33 },
      cardSet: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
    },
    rerollCostStep: 5,
  },
```

- [ ] **Step 4: `shidasu.config.json`の`shop`に`rerollCostStep`を追加する**

`src/lib/game/shidasu/shidasu.config.json`内、以下の既存コードを探す:

```json
    "packPrice": {
      "item": {
        "threeOne": 4,
        "fiveOne": 7,
        "sevenTwo": 10
      },
      "rite": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "revelation": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "oracle": {
        "threeOne": 2,
        "fiveOne": 4
      },
      "cardSet": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      }
    }
  },
```

以下に置き換える:

```json
    "packPrice": {
      "item": {
        "threeOne": 4,
        "fiveOne": 7,
        "sevenTwo": 10
      },
      "rite": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "revelation": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "oracle": {
        "threeOne": 2,
        "fiveOne": 4
      },
      "cardSet": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      }
    },
    "rerollCostStep": 2
  },
```

- [ ] **Step 5: `engine.ts`の`createInitialRun`・`beginRun`・`enterShop`に`shopRerollCount: 0`を追加する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す(`createInitialRun`関数):

```ts
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
    cardSetOffer: [],
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
```

以下に置き換える:

```ts
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
    cardSetOffer: [], shopRerollCount: 0,
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
```

同ファイル内、以下の既存コードを探す(`beginRun`関数の末尾):

```ts
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
    cardSetOffer: [],
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
```

以下に置き換える:

```ts
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
    cardSetOffer: [],
    shopRerollCount: 0,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
```

同ファイル内、以下の既存コードを探す(`enterShop`関数):

```ts
function enterShop(params: ShidasuParams, run: RunState, _seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
    cardSetOffer: [],
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

以下に置き換える:

```ts
function enterShop(params: ShidasuParams, run: RunState, _seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
    cardSetOffer: [],
    shopRerollCount: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

- [ ] **Step 6: 型チェックを実行し、直接`RunState`を構築している箇所を確認する**

Run: `npm run check`

Expected: `src/lib/game/shidasu/engine.test.ts`内の、`applyStuckCheck`テストスイートにある6箇所の直接`RunState`オブジェクトリテラル構築で`Property 'shopRerollCount' is missing`エラーが出る。それ以外のshidasu関連エラーは出ない想定。

- [ ] **Step 7: `engine.test.ts`の6箇所に`shopRerollCount: 0`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コード(6箇所全てに同一パターンで出現する)を探す:

```ts
      cardSetOffer: [],
    }
```

全て(6箇所)以下に置き換える:

```ts
      cardSetOffer: [], shopRerollCount: 0,
    }
```

- [ ] **Step 8: 型チェックを再実行し、エラーが解消されたことを確認する**

Run: `npm run check`

Expected: shidasu関連の新規エラーなし。

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ショップリロール機能の型定義・パラメータを追加"
```

---

### Task 2: `rerollShop`・`shopRerollCost`関数の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の先頭、以下の既存importを探す:

```ts
  skipWave,
  rerollStageStars,
  startRevelationPreview,
} from './engine'
```

以下に置き換える:

```ts
  skipWave,
  rerollStageStars,
  rerollShop,
  shopRerollCost,
  startRevelationPreview,
} from './engine'
```

同ファイル内、以下の既存コード(`describe('rerollStageStars'`ブロックの直後、`describe('finishShop'`ブロックの直前)を探す:

```ts
  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 2, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})

describe('finishShop', () => {
```

以下に置き換える:

```ts
  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'playing', waveIndex: 2, currency: 100 }
    const result = rerollStageStars(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})

describe('shopRerollCost', () => {
  test('shopRerollCountが0のとき、rerollCostStepそのままの値になる', () => {
    const run = { ...beginRun(DEFAULT_PARAMS, 1), shopRerollCount: 0 }
    expect(shopRerollCost(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
  })

  test('shopRerollCountが増えるたびに、rerollCostStep×(回数+1)になる', () => {
    const run = { ...beginRun(DEFAULT_PARAMS, 1), shopRerollCount: 2 }
    expect(shopRerollCost(DEFAULT_PARAMS, run)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 3)
  })
})

describe('rerollShop', () => {
  function shopRun(currency: number, shopRerollCount = 0): RunState {
    const base = shopStateAfterWaveClear()
    return { ...base, currency, shopRerollCount }
  }

  // enterShopはmodule非公開のため、resolveWaveEndを経由してshopが確定したRunStateを用意する
  function shopStateAfterWaveClear(): RunState {
    const begun = beginRun(DEFAULT_PARAMS, 1)
    const { wave } = startWave(DEFAULT_PARAMS, begun.stageIndex, begun.waveIndex, begun.items, begun.deckComposition, 1, begun.extraTableauRows, begun.oracleLevels)
    const ended: RunState = { ...begun, wave: { ...wave, score: waveTarget(DEFAULT_PARAMS, 0, 0, begun.stageStars), status: 'ended', endReason: 'target' } }
    return resolveWaveEnd(DEFAULT_PARAMS, ended, createRng(5))
  }

  test('コスト以上の通貨があるとき、通貨が減りshopが入れ替わりshopRerollCountが1増える', () => {
    const run = shopRun(100)
    const originalShop = run.shop
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result.currency).toBe(100 - DEFAULT_PARAMS.shop.rerollCostStep)
    expect(result.shop).not.toBe(originalShop)
    expect(result.shop!.individual).toHaveLength(3)
    expect(result.shop!.packs).toHaveLength(2)
    expect(result.shopRerollCount).toBe(1)
  })

  test('通貨がコスト未満のとき、何も変化しない', () => {
    const run = shopRun(DEFAULT_PARAMS.shop.rerollCostStep - 1)
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('リロールを繰り返すたびにコストが増額する(1回目5、2回目10、3回目15)', () => {
    let current = shopRun(1000)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep)
    current = rerollShop(DEFAULT_PARAMS, current, () => 0.9)
    expect(current.currency).toBe(1000 - DEFAULT_PARAMS.shop.rerollCostStep)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 2)
    const currencyBeforeSecond = current.currency
    current = rerollShop(DEFAULT_PARAMS, current, () => 0.9)
    expect(current.currency).toBe(currencyBeforeSecond - DEFAULT_PARAMS.shop.rerollCostStep * 2)
    expect(shopRerollCost(DEFAULT_PARAMS, current)).toBe(DEFAULT_PARAMS.shop.rerollCostStep * 3)
  })

  test('phaseがshop以外のとき、何も変化しない', () => {
    const run: RunState = { ...shopRun(100), phase: 'playing' }
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })

  test('shopがnull(ラン開始直後でまだ品ぞろえが確定していない状態)のとき、何も変化しない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.shop).toBeNull()
    const result = rerollShop(DEFAULT_PARAMS, run, () => 0.9)
    expect(result).toEqual(run)
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "shopRerollCost|rerollShop"`

Expected: FAIL(`rerollShop`・`shopRerollCost`が`./engine`からexportされていない)

- [ ] **Step 3: `engine.ts`に`shopRerollCost`・`rerollShop`関数を実装する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(`rerollStageStars`関数の直後、`buyIndividualItem`関数の直前)を探す:

```ts
export function rerollStageStars(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop') return run
  const bossWaveIndex = params.flow.wavesPerStage - 1
  if (run.waveIndex > bossWaveIndex) return run
  if (run.currency < params.flow.rerollCost) return run
  const newStar = rollStarForSlot(params, 3, rand, run.stageStars[bossWaveIndex]?.id)
  const stageStars = [...run.stageStars]
  stageStars[bossWaveIndex] = newStar
  return { ...run, currency: run.currency - params.flow.rerollCost, stageStars }
}

// バラ売り護符購入。所持上限(maxItems)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
```

以下に置き換える:

```ts
export function rerollStageStars(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop') return run
  const bossWaveIndex = params.flow.wavesPerStage - 1
  if (run.waveIndex > bossWaveIndex) return run
  if (run.currency < params.flow.rerollCost) return run
  const newStar = rollStarForSlot(params, 3, rand, run.stageStars[bossWaveIndex]?.id)
  const stageStars = [...run.stageStars]
  stageStars[bossWaveIndex] = newStar
  return { ...run, currency: run.currency - params.flow.rerollCost, stageStars }
}

// ショップの品ぞろえ(バラ売り3枠+福袋2枠)全体を再抽選するリロールのコスト。同一ショップ訪問中の
// リロール回数(shopRerollCount)に応じて回数ごとにrerollCostStep分ずつ増額する
// (1回目はrerollCostStep、2回目は2倍、3回目は3倍…)。
export function shopRerollCost(params: ShidasuParams, run: RunState): number {
  return (run.shopRerollCount + 1) * params.shop.rerollCostStep
}

// ショップ画面のリロールボタンから呼ぶ。バラ売り3枠+福袋2枠を丸ごと再抽選する(売り切れ済みの
// 枠も含めて全て新しい商品に入れ替わる、既存のrollShopをそのまま再利用)。通貨からshopRerollCost分を
// 差し引き、shopRerollCountを+1する。phaseがshop以外、shopがnull、通貨不足のいずれかの場合は
// runをそのまま返す。
export function rerollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const cost = shopRerollCost(params, run)
  if (run.currency < cost) return run
  return { ...run, currency: run.currency - cost, shop: rollShop(run, rand), shopRerollCount: run.shopRerollCount + 1 }
}

// バラ売り護符購入。所持上限(maxItems)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "shopRerollCost|rerollShop"`

Expected: PASS(全件)

- [ ] **Step 5: `resolveWaveEnd`のテストに、新しいショップに入るたび`shopRerollCount`が0にリセットされることを検証するテストを追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コード(`describe('resolveWaveEnd'`ブロック内、`beginRun直後、currencyは初期所持数になる`テストの直前)を探す:

```ts
  test('beginRun直後、currencyは初期所持数になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.currency).toBe(DEFAULT_PARAMS.currency.initialAmount)
  })
```

直前に以下を追加する:

```ts
  test('新しいショップに入るたび、shopRerollCountは0にリセットされる', () => {
    const run = endedRun({ waveIndex: 0, shopRerollCount: 3 }, waveTarget(DEFAULT_PARAMS, 0, 0, beginRun(DEFAULT_PARAMS, 1).stageStars))
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.shopRerollCount).toBe(0)
  })

```

- [ ] **Step 6: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: PASS(全件)

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run check`

Expected: shidasu関連の新規エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ショップ品ぞろえリロール関数rerollShop/shopRerollCostを実装"
```

---

### Task 3: UI実装(`+page.svelte`)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importとハンドラー関数を追加する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存importを探す:

```ts
    waveTarget, stageModifierFor, isBossWave, skipWave, rerollStageStars,
```

以下に置き換える:

```ts
    waveTarget, stageModifierFor, isBossWave, skipWave, rerollStageStars, rerollShop, shopRerollCost,
```

同ファイル内、以下の既存コードを探す(`handleRerollStageStars`関数):

```ts
  function handleRerollStageStars() {
    run = rerollStageStars(params, run)
  }
```

直後に以下を追加する:

```ts

  function handleRerollShop() {
    run = rerollShop(params, run)
  }
```

- [ ] **Step 2: ショップ画面ヘッダーにリロールボタンを追加する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ショップ</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">バラ売り</p>
```

以下に置き換える:

```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ショップ</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>

      <button
        onclick={handleRerollShop}
        disabled={run.currency < shopRerollCost(params, run)}
        class="w-full px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        リロール({shopRerollCost(params, run)})
      </button>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">バラ売り</p>
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-debug`または実際のゲームプレイ経由でショップ画面に入り、以下をブラウザで確認する。

- 「リロール(5)」ボタンが表示される
- 押すとバラ売り3枠+福袋2枠が全て新しい商品に入れ替わり、通貨が5減る
- いずれかの枠を購入(売り切れに)した後にリロールすると、その枠にも新しい商品が表示される
- 2回目のリロールボタンの表示が「リロール(10)」に増額している
- 通貨がコスト未満のとき、ボタンが無効化される

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面にリロールボタンのUIを追加"
```

---

### Task 4: 管理画面の価格編集UI

**Files:**
- Modify: `src/routes/admin/shidasu-currency/+page.svelte`

- [ ] **Step 1: バリデーションに`rerollCostStep`のチェックを追加する**

`src/routes/admin/shidasu-currency/+page.svelte`内、以下の既存コードを探す:

```ts
    if (!Number.isFinite(config.shop.packPrice.cardSet.sevenTwo) || config.shop.packPrice.cardSet.sevenTwo < 0) return true
    return false
  })
```

以下に置き換える:

```ts
    if (!Number.isFinite(config.shop.packPrice.cardSet.sevenTwo) || config.shop.packPrice.cardSet.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.rerollCostStep) || config.shop.rerollCostStep < 0) return true
    return false
  })
```

- [ ] **Step 2: 価格編集フォームに`rerollCostStep`の入力欄を追加する**

`src/routes/admin/shidasu-currency/+page.svelte`内、以下の既存コードを探す(福袋価格セクションの末尾):

```svelte
          <label class="text-xs text-slate-500">
            トランプセット 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>
    </section>
```

以下に置き換える:

```svelte
          <label class="text-xs text-slate-500">
            トランプセット 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">ショップリロールのコスト刻み幅(1回目はこの値、2回目は2倍、3回目は3倍…と同一ショップ訪問中に増額)</p>
        <div class="grid grid-cols-3 gap-3">
          <label class="text-xs text-slate-500">
            リロールコスト刻み幅
            <input type="number" step="1" bind:value={config.shop.rerollCostStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>
    </section>
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-currency`を開き、「リロールコスト刻み幅」の入力欄が表示され、値を編集・保存できることをブラウザで確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: 管理画面にショップリロールのコスト編集欄を追加"
```

---

## 全タスク完了後の確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`でリポジトリ全体のテストスイートを実行し、全てPASSすることを確認する
- [ ] `npm run dev`で開発サーバーを起動し、実際にショップでリロールボタンを押して品ぞろえが入れ替わること(売り切れ枠も含む)、コストが回数ごとに増額すること、通貨不足で無効化されることを目視確認する
- [ ] `/admin/shidasu-currency`でリロールコスト刻み幅を変更し、ショップ画面の表示・実際の消費額に反映されることを確認する
