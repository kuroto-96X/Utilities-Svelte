# レリックシステムの実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 護符・秘儀・天啓・神託に続く5つ目のアイテム種別「レリック」の仕組み(データ構造・ショップ連携・表示UI)を実装する。個別レリックの効果・名前は別セッションで検討するため、動作確認用の仮レリック`placeholder`を1つだけ持たせる。

**Architecture:** 既存の秘儀・天啓の実装パターン(`RiteId`型+`RITE_POOL`+`params.rites`+`riteName`/`riteDesc`ヘルパー)をそのまま踏襲する。レリックは「所持数無制限・重複不可・売却不可・付喪化という個体状態を持つ」という点で既存4種と異なるため、`RunState.relics`は`RelicId[]`ではなく`{ id: RelicId; tsukumoka: boolean }[]`のオブジェクト配列にする。ショップには既存のバラ売り3枠・福袋2枠とは別の専用4枠目(`ShopState.relic`)を新設する。

**Tech Stack:** TypeScript、Svelte 5、Vitest。既存の`rites.ts`/`shop.ts`/`engine.ts`/`+page.svelte`のパターンをそのまま踏襲する。

**参照spec:** `docs/superpowers/specs/2026-08-12-shidasu-relic-system-design.md`

---

## Task 1: データ構造を追加する

型・プール・パラメータ・`RunState`初期化をまとめて追加し、ビルド・型チェックが通る状態にする。

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Create: `src/lib/game/shidasu/relics.ts`
- Test: `src/lib/game/shidasu/relics.test.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: `types.ts`に`RelicId`型を追加する**

`src/lib/game/shidasu/types.ts`の`RevelationId`型の末尾(`| 'karasu'`の直後、`export interface Card`の直前)に以下を追加する:

```ts
// 変更前
  | 'karasu'

export interface Card {
```

```ts
// 変更後
  | 'karasu'

// レリック(Relic): ショップ販売価格・提示数・リロールコストの減少、秘儀・天啓・神託の所持上限増加など、
// ラン単位の経済・メタ的な効果を持つ、護符の守備範囲外のアイテム。所持数に上限は無いが重複所持はできない。
// 個体ごとに「付喪化」(進化)状態を持ち、付喪化すると効果が上方修正される。個別候補は未確定のため、
// 現状はシステム動作確認用のplaceholderのみを持つ(個別候補確定時にここへ実際の値を追加する)。
export type RelicId = 'placeholder'

export interface Card {
```

- [ ] **Step 2: `ShopState`に`relic`枠を追加する**

`src/lib/game/shidasu/types.ts`の`ShopState`インターフェースを置き換える:

```ts
// 変更前
export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
}
```

```ts
// 変更後
export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
  // レリック専用枠。既存のバラ売り3枠(individual)・福袋2枠(packs)とは別に、ショップ訪問のたびに
  // 未所持のレリックから1つ抽選する。未所持のレリックが無ければnull(枠自体を非表示にする)。
  // オプショナルにしているのは、ShopStateをリテラルで直接組み立てている既存テスト(レリックと無関係な
  // 護符・秘儀・天啓・神託・福袋のテスト)を変更せずに済ませるため。本番コードでShopStateを生成する
  // 唯一の経路であるrollShopは必ずこのフィールドを設定する
  relic?: { id: RelicId; sold: boolean } | null
}
```

- [ ] **Step 3: `RunState`に`relics`フィールドを追加する**

`src/lib/game/shidasu/types.ts`の`RunState`インターフェース内、`revelations: RevelationId[]`の直後に追加する:

```ts
// 変更前
  // 所持中の秘儀(最大3、同じ種類を複数所持できる)。ウェーブを跨いで持続する(護符と同様)
  rites: RiteId[]
  // 所持中の天啓(最大2、同じ種類を複数所持できる)。ウェーブを跨いで持続する(秘儀と同様)
  revelations: RevelationId[]
  // 天啓選択画面('revelationSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  revelationOffer: RevelationId[]
```

```ts
// 変更後
  // 所持中の秘儀(最大3、同じ種類を複数所持できる)。ウェーブを跨いで持続する(護符と同様)
  rites: RiteId[]
  // 所持中の天啓(最大2、同じ種類を複数所持できる)。ウェーブを跨いで持続する(秘儀と同様)
  revelations: RevelationId[]
  // 所持中のレリック。同じidを複数所持することはできない(重複不可)。所持数に上限は無い。
  // tsukumokaは個体ごとの付喪化(進化)状態。trueになると効果がtsukumokaDescの内容に上方修正される
  // (付喪化させる手段=天啓は未実装のため、現状は常にfalseのまま)
  relics: { id: RelicId; tsukumoka: boolean }[]
  // 天啓選択画面('revelationSelect'フェーズ)で提示中のオファー(3択)。それ以外のフェーズでは空配列
  revelationOffer: RevelationId[]
```

- [ ] **Step 4: `relics.ts`を新規作成する**

`src/lib/game/shidasu/relics.ts`を作成する:

```ts
// src/lib/game/shidasu/relics.ts
import type { RelicId } from './types'
import type { ShidasuParams } from './params'

// レリックの抽選プール。個別候補は未確定のため、現状はシステム動作確認用のplaceholderのみ。
export const RELIC_POOL: RelicId[] = ['placeholder']

export function relicName(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].name
}

export function relicDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].desc
}

export function relicTsukumokaDesc(id: RelicId, params: ShidasuParams): string {
  return params.relics[id].tsukumokaDesc
}
```

- [ ] **Step 5: `relics.ts`のテストを書く**

`src/lib/game/shidasu/relics.test.ts`を作成する:

```ts
// src/lib/game/shidasu/relics.test.ts
import { describe, test, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc } from './relics'
import { DEFAULT_PARAMS } from './params'

describe('relics', () => {
  test('RELIC_POOLはplaceholderのみを含む', () => {
    expect(RELIC_POOL).toEqual(['placeholder'])
  })

  test('relicName/relicDesc/relicTsukumokaDescはparams.relicsを参照する', () => {
    expect(relicName('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.name)
    expect(relicDesc('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.desc)
    expect(relicTsukumokaDesc('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.tsukumokaDesc)
  })
})
```

このテストはまだ`params.ts`に`relics`が無いため型エラーで失敗する(Step 6で解消する)。

- [ ] **Step 6: `params.ts`に`relics`を追加する**

`src/lib/game/shidasu/params.ts`冒頭のimportを置き換える:

```ts
// 変更前
import type { Rarity, PackCatalogEntry } from './types'
```

```ts
// 変更後
import type { Rarity, PackCatalogEntry, RelicId } from './types'
```

型定義側、`oracles: {...}`ブロックの直後(`flow: {`の直前)に追加する:

```ts
// 変更前
    alternating: { name: string; desc: string }
  }
  flow: {
```

```ts
// 変更後
    alternating: { name: string; desc: string }
  }
  relics: Record<RelicId, { name: string; desc: string; tsukumokaDesc: string; price: number }>
  flow: {
```

`DEFAULT_PARAMS`側、`oracles: {...}`ブロックの直後(`flow: {`の直前)に追加する:

```ts
// 変更前
    alternating: { name: '水火既済', desc: '交互　レベル+1' },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
```

```ts
// 変更後
    alternating: { name: '水火既済', desc: '交互　レベル+1' },
  },
  relics: {
    // 動作確認用の仮レリック。ゲームプレイに実効果を持たないダミー。個別候補確定時に実際の内容へ差し替える
    placeholder: { name: '仮の置物', desc: '(動作確認用の仮レリック。効果なし)', tsukumokaDesc: '(動作確認用の仮レリック・付喪化状態。効果なし)', price: 10 },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
```

- [ ] **Step 7: `shidasu.config.json`に`relics`を追加する**

`src/lib/game/shidasu/shidasu.config.json`の`"oracles"`ブロックの直後(`"flow": {`の直前)に追加する:

```json
// 変更前
    "alternating": {
      "name": "水火既済",
      "desc": "交互　レベル+1"
    }
  },
  "flow": {
```

```json
// 変更後
    "alternating": {
      "name": "水火既済",
      "desc": "交互　レベル+1"
    }
  },
  "relics": {
    "placeholder": {
      "name": "仮の置物",
      "desc": "(動作確認用の仮レリック。効果なし)",
      "tsukumokaDesc": "(動作確認用の仮レリック・付喪化状態。効果なし)",
      "price": 10
    }
  },
  "flow": {
```

- [ ] **Step 8: `engine.ts`の`createInitialRun`・`beginRun`に`relics: []`を追加する**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`を置き換える:

```ts
// 変更前
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
```

```ts
// 変更後
    deckComposition: standardDeckComposition(), rites: [], revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
```

続けて`beginRun`を置き換える:

```ts
// 変更前
    rites: [],
    revelations: [],
    revelationOffer: [],
```

```ts
// 変更後
    rites: [],
    revelations: [],
    relics: [],
    revelationOffer: [],
```

- [ ] **Step 9: テスト・ビルド・型チェックを実行して確認する**

Run: `npx vitest run src/lib/game/shidasu/relics.test.ts && npm run build && npm run check`
Expected: `relics.test.ts`の2件がPASS。ビルド成功。型チェックはshidasu関連のエラー無し(既存の無関係なエラー(solitaire/hepburn-converter/vector3-visualizer)以外は出ない)

- [ ] **Step 10: コミットする**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/relics.ts src/lib/game/shidasu/relics.test.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts
git commit -m "feat: レリックの型・プール・パラメータを追加"
```

---

## Task 2: ショップの抽選ロジックを実装する

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts`
- Test: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/shop.test.ts`の`describe('rollShop', ...)`ブロック内、末尾のテスト(`'packCatalogにcardSetの3-1・5-1・7-2パターンが含まれる'`)の直前に追加する:

```ts
  test('レリック枠は未所持のレリックから1つ選ばれる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    expect(shop.relic).not.toBeNull()
    expect(RELIC_POOL).toContain(shop.relic!.id)
    expect(shop.relic!.sold).toBe(false)
  })

  test('全レリックを所持していればレリック枠はnull', () => {
    const run = { ...createInitialRun(), relics: RELIC_POOL.map(id => ({ id, tsukumoka: false })) }
    const shop = rollShop(DEFAULT_PARAMS, run, createRng(1))
    expect(shop.relic).toBeNull()
  })

```

続けて、`describe('価格関数', ...)`ブロック内、`'rite/revelation/oracleの価格'`テストの直後に追加する:

```ts
  test('レリックの価格', () => {
    expect(relicBuyPrice(DEFAULT_PARAMS, 'placeholder')).toBe(10)
  })

```

`shop.test.ts`冒頭のimportを置き換える:

```ts
// 変更前
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
```

```ts
// 変更後
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, relicBuyPrice } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { RELIC_POOL } from './relics'
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts -t "レリック"`
Expected: FAIL(`rollShop`の戻り値に`relic`が無い、`relicBuyPrice`が存在しない)

- [ ] **Step 3: `shop.ts`に抽選ロジックと価格関数を実装する**

`src/lib/game/shidasu/shop.ts`冒頭のimportを置き換える:

```ts
// 変更前
import type { RunState, ItemId, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { shuffleInPlace } from './deck'
```

```ts
// 変更後
import type { RunState, ItemId, RelicId, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { RELIC_POOL } from './relics'
import { shuffleInPlace } from './deck'
```

`rollPackSlots`関数の直後(`export function rollShop`の直前)に以下を追加する:

```ts
// 未所持のレリックからランダムに1つ選ぶ。未所持のレリックが無ければnull(ショップ画面で枠自体を非表示にする)
function rollRelicSlot(run: RunState, rand: () => number): { id: RelicId; sold: boolean } | null {
  const ownedIds = new Set(run.relics.map(r => r.id))
  const available = RELIC_POOL.filter(id => !ownedIds.has(id))
  if (available.length === 0) return null
  const id = available[Math.floor(rand() * available.length)]
  return { id, sold: false }
}

```

`rollShop`関数を置き換える:

```ts
// 変更前
export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(params, rand) }
}
```

```ts
// 変更後
export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(params, rand), relic: rollRelicSlot(run, rand) }
}
```

ファイル末尾(`oracleSellPrice`関数の直後)に以下を追加する:

```ts

export function relicBuyPrice(params: ShidasuParams, id: RelicId): number {
  return params.relics[id].price
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`
Expected: 全件PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/shop.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: ショップにレリック専用枠の抽選ロジックを追加"
```

---

## Task 3: 購入処理を実装する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('buyIndividualRite(バラ売り秘儀購入)', ...)`ブロックの直後に追加する:

```ts
describe('buyRelic(レリック購入)', () => {
  test('購入すると所持に追加され通貨が減る', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: { id: 'placeholder', sold: false } },
    }
    const result = buyRelic(DEFAULT_PARAMS, run)
    expect(result.relics).toEqual([{ id: 'placeholder', tsukumoka: false }])
    expect(result.currency).toBe(999 - relicBuyPrice(DEFAULT_PARAMS, 'placeholder'))
    expect(result.shop!.relic!.sold).toBe(true)
  })

  test('レリック枠がnullなら購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: null },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })

  test('売り切れ済みなら購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [], relic: { id: 'placeholder', sold: true } },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })

  test('通貨が足りなければ購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 0,
      shop: { individual: [], packs: [], relic: { id: 'placeholder', sold: false } },
    }
    expect(buyRelic(DEFAULT_PARAMS, run)).toBe(run)
  })
})

```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "buyRelic"`
Expected: FAIL(`buyRelic`が存在しない)

- [ ] **Step 3: `engine.ts`に`buyRelic`を実装する**

`src/lib/game/shidasu/engine.ts`冒頭のimportを置き換える:

```ts
// 変更前
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId } from './types'
```

```ts
// 変更後
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId, RelicId } from './types'
```

続けて同じimportブロック内を置き換える:

```ts
// 変更前
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice } from './shop'
```

```ts
// 変更後
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, relicBuyPrice } from './shop'
```

`buyIndividualRite`関数の直後(`export function buyIndividualRite`の閉じ`}`の直後、`buyIndividualRevelationUse`の前)に追加する:

```ts

// レリックを1つ購入する。ショップのレリック専用枠(run.shop.relic)から購入する単品購入のみ。
// 売り切れ済み・枠が無い(null)・通貨不足のいずれかならno-op
export function buyRelic(params: ShidasuParams, run: RunState): RunState {
  if (run.phase !== 'shop' || !run.shop || !run.shop.relic || run.shop.relic.sold) return run
  const relicId = run.shop.relic.id
  const price = relicBuyPrice(params, relicId)
  if (run.currency < price) return run
  return {
    ...run,
    currency: run.currency - price,
    relics: [...run.relics, { id: relicId, tsukumoka: false }],
    shop: { ...run.shop, relic: { ...run.shop.relic, sold: true } },
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "buyRelic"`
Expected: 4件全てPASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: レリックの購入処理(buyRelic)を実装"
```

---

## Task 4: 表示UIを実装する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importを追加する**

`src/routes/game/shidasu/+page.svelte`冒頭のimportを置き換える:

```ts
// 変更前
    finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold,
    buyIndividualOracleUse, buyIndividualOracleHold, buyPack,
```

```ts
// 変更後
    finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold,
    buyIndividualOracleUse, buyIndividualOracleHold, buyPack, buyRelic,
```

続けて、`items.ts`のimportの直後に追加する:

```ts
// 変更前
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { riteName, riteDesc } from '$lib/game/shidasu/rites'
```

```ts
// 変更後
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { riteName, riteDesc } from '$lib/game/shidasu/rites'
  import { relicName, relicDesc, relicTsukumokaDesc } from '$lib/game/shidasu/relics'
```

続けて、`shop.ts`のimportを置き換える:

```ts
// 変更前
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice,
  } from '$lib/game/shidasu/shop'
```

```ts
// 変更後
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice, relicBuyPrice,
  } from '$lib/game/shidasu/shop'
```

続けて、型importに`RelicId`を追加する:

```ts
// 変更前
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId, ShopSlotKind } from '$lib/game/shidasu/types'
```

```ts
// 変更後
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId, ShopSlotKind, RelicId } from '$lib/game/shidasu/types'
```

- [ ] **Step 2: 購入ハンドラを追加する**

`handleBuyIndividualRite`関数の直後に追加する:

```ts
// 変更前
  function handleBuyIndividualRite(slotIndex: number) {
    run = buyIndividualRite(params, run, slotIndex)
  }
```

```ts
// 変更後
  function handleBuyIndividualRite(slotIndex: number) {
    run = buyIndividualRite(params, run, slotIndex)
  }

  function handleBuyRelic() {
    run = buyRelic(params, run)
  }
```

- [ ] **Step 3: ゲーム中の常設バッジ表示にレリックを追加する**

`itemBadges`スニペット内、`run.oracles`の`{#if}`ブロックの直後(スニペットを閉じる`</div>`の直前)に追加する:

```svelte
// 変更前
    {#if run.oracles.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.oracles as roleName, i (i)}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
```

```svelte
// 変更後
    {#if run.oracles.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.oracles as roleName, i (i)}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.relics.length > 0}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each run.relics as relic, i (i)}
          <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
          </span>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
```

- [ ] **Step 4: ショップ画面にレリック専用枠を追加する**

「福袋」セクション(`<div class="space-y-2">`〜`</div>`、`run.shop.packs`をループしている箇所)の直後、「所持護符」セクションの直前に、レリック専用枠のセクションを追加する:

```svelte
// 変更前
      <div class="space-y-2">
        <p class="text-xs text-slate-500">福袋</p>
        <div class="grid grid-cols-2 gap-2">
          {#each run.shop.packs as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold text-slate-800">{slot.name}({slot.offerCount}択{slot.pickCount})</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < slot.price} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({slot.price})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
```

```svelte
// 変更後
      <div class="space-y-2">
        <p class="text-xs text-slate-500">福袋</p>
        <div class="grid grid-cols-2 gap-2">
          {#each run.shop.packs as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold text-slate-800">{slot.name}({slot.offerCount}択{slot.pickCount})</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < slot.price} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({slot.price})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      {#if run.shop.relic}
        <div class="space-y-2">
          <p class="text-xs text-slate-500">レリック</p>
          <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1 w-1/3">
            <p class="font-semibold text-slate-800">{relicName(run.shop.relic.id, params)}</p>
            <p class="text-[11px] text-slate-500">{relicDesc(run.shop.relic.id, params)}</p>
            {#if run.shop.relic.sold}
              <p class="text-slate-400">売り切れ</p>
            {:else}
              <button onclick={handleBuyRelic} disabled={run.currency < relicBuyPrice(params, run.shop.relic.id)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                購入({relicBuyPrice(params, run.shop.relic.id)})
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
```

- [ ] **Step 5: ショップ画面に所持レリック一覧を追加する**

「その他の所持品(売却可)」セクションの直後、「次のWaveへ」ボタンの直前に追加する:

```svelte
// 変更前
          {#each run.oracles as roleName}
            <button title={oracleDesc(roleName, params)} onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>

      <button onclick={() => { showStageScreen = true }} class="w-full px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold">次のWaveへ</button>
```

```svelte
// 変更後
          {#each run.oracles as roleName}
            <button title={oracleDesc(roleName, params)} onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>

      {#if run.relics.length > 0}
        <div class="space-y-2">
          <p class="text-xs text-slate-500">所持レリック(売却不可)</p>
          <div class="flex flex-wrap gap-1">
            {#each run.relics as relic, i (i)}
              <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
                {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <button onclick={() => { showStageScreen = true }} class="w-full px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold">次のWaveへ</button>
```

- [ ] **Step 6: ビルド・型チェックを実行して確認する**

Run: `npm run build && npm run check`
Expected: ビルド成功。型チェックはshidasu関連のエラー無し

- [ ] **Step 7: 開発サーバーで実際の購入フローを確認する**

Run: `npm run dev`(バックグラウンド起動)し、ブラウザ(または`curl`でページ取得)で以下を確認する:
1. 新しいランを開始し、最初のショップ画面で「レリック」枠に「仮の置物」が表示され、購入ボタンが押せること
2. 購入すると通貨が減り、「所持レリック(売却不可)」に「仮の置物」バッジが表示され、マウスオーバーで説明文が出ること
3. 次にショップに入ったとき、レリック枠が非表示(全種所持済みのため)になること
4. ゲームプレイ画面(Wave中)でも所持レリックのバッジが表示されること

- [ ] **Step 8: コミットする**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: レリックの表示UI(バッジ・ショップ専用枠)を実装"
```

---

## Task 5: ドキュメントを更新する

**Files:**
- Modify: `docs/shidasu/shidasu-roadmap.md`

- [ ] **Step 1: 項目5にシステム実装完了の記録を追記する**

`docs/shidasu/shidasu-roadmap.md`の項目5を置き換える:

```
// 変更前
5. **レリックの実装**
   レリックは、ショップ販売価格の減少、ショップ商品提示数の増加、リロールコストの減少、秘儀・天啓・神託の所持上限増加などランを通して効果があり、護符の守備範囲外（ゲームプレイに直接かかわる部分以外）で有利になる効果を持つアイテム。
   候補メモ: 天啓候補審査(項目3)で不採用となった「オファー拡張」(次回ショップのオファー数を一時的に増やす)は、天啓ではなくレリックの効果候補として転用できる(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`の候補24を参照)。
```

```
// 変更後
5. **レリックの実装**
   レリックは、ショップ販売価格の減少、ショップ商品提示数の増加、リロールコストの減少、秘儀・天啓・神託の所持上限増加などランを通して効果があり、護符の守備範囲外（ゲームプレイに直接かかわる部分以外）で有利になる効果を持つアイテム。
   2026-08-12、システムの仕組み(データ構造・ショップ専用枠での単品購入・所持数無制限かつ重複不可・売却不可・「付喪化」という個体ごとの進化状態・バッジ表示)を設計・実装した(詳細は`docs/superpowers/specs/2026-08-12-shidasu-relic-system-design.md`を参照)。個別レリックの効果・名前(仮称)の候補出しと、付喪化のトリガーとなる天啓の実装は未着手。現状は動作確認用の仮レリック`placeholder`のみを持つ。
   候補メモ: 天啓候補審査(項目3)で不採用となった「オファー拡張」(次回ショップのオファー数を一時的に増やす)は、天啓ではなくレリックの効果候補として転用できる(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`の候補24を参照)。
```

- [ ] **Step 2: コミットする**

```bash
git add docs/shidasu/shidasu-roadmap.md
git commit -m "docs: レリックシステムの実装完了をroadmapに記録"
```

---

## Task 6: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストスイートを実行する**

Run: `npx vitest run`
Expected: 全テストパス(既存+今回追加した約10件の新規テスト)

- [ ] **Step 2: ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し(既存の無関係なエラー(solitaire/hepburn-converter/vector3-visualizer)のみ残存)

- [ ] **Step 4: 開発サーバーで`/game/shidasu`が正常に読み込めることを確認する**

Run: `npm run dev`(バックグラウンド起動)
続けて `curl -s -L http://localhost:5173/game/shidasu -o /dev/null -w "%{http_code}\n"` を実行
Expected: 200
