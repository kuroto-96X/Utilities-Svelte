# 福袋のオブジェクト化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハードコードされた福袋パターン(`PACK_DEFINITIONS`)を廃止し、`ShidasuParams.shop.packCatalog`という管理画面で追加・削除・編集できるオブジェクトのリストに置き換える。

**Architecture:** 各福袋を`{name, packKind, offerCount, pickCount, price}`を持つ`PackCatalogEntry`として定義し、`ShidasuParams`配下のデータとして保持する。抽選ロジック(シャッフルして先頭2件を選ぶ)自体は変えず、抽選元をハードコード配列からこのカタログに差し替える。選ばれたエントリの`name`・`price`は`ShopPackSlot`にスナップショットとしてコピーする。新規管理画面`/admin/shidasu-packs`で行の追加・削除ができるテーブルUIを提供する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: 型定義・パラメータ・カタログ初期データの追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`

- [ ] **Step 1: `types.ts`の`PackOfferCount`・`PackPickCount`・`ShopPackSlot`を置き換える**

`src/lib/game/shidasu/types.ts`内、以下の既存コードを探す:

```ts
export type PackOfferCount = 3 | 5 | 7
export type PackPickCount = 1 | 2

// 福袋枠: shop突入時にパターン(kind×offerCount×pickCount)が1つ確定し、以後入れ替わらない。
// 購入時にofferCount択からpickCount個を選ぶ中身選択画面(itemSelect等)へ遷移する。
export interface ShopPackSlot {
  packKind: ShopSlotKind
  offerCount: PackOfferCount
  pickCount: PackPickCount
  sold: boolean
}
```

以下に置き換える:

```ts
// 福袋カタログの1エントリ。管理画面(/admin/shidasu-packs)で自由に追加・削除・編集できる。
// 同じ内容(種別・選択肢数・取得数・価格)のエントリを名前だけ変えて複数用意すると、
// 抽選プール内での比率が上がるため、その福袋が相対的に出現しやすくなる
// (各エントリの抽選確率自体は常に均等)。
export interface PackCatalogEntry {
  name: string
  packKind: ShopSlotKind
  offerCount: number
  pickCount: number
  price: number
}

// 福袋枠: shop突入時にpackCatalogから1エントリが確定し、以後入れ替わらない。選ばれた時点の
// name・priceをスナップショットとしてコピーするため、抽選後に管理画面でカタログを編集しても
// 既に提示中のショップには影響しない。購入時にofferCount択からpickCount個を選ぶ
// 中身選択画面(itemSelect等)へ遷移する。
export interface ShopPackSlot {
  packKind: ShopSlotKind
  offerCount: number
  pickCount: number
  name: string
  price: number
  sold: boolean
}
```

- [ ] **Step 2: `params.ts`のimportに`PackCatalogEntry`を追加する**

`src/lib/game/shidasu/params.ts`内、以下の既存コードを探す:

```ts
import type { Rarity } from './types'
```

以下に置き換える:

```ts
import type { Rarity, PackCatalogEntry } from './types'
```

- [ ] **Step 3: `params.ts`の型定義から`packPrice`を削除し`packCatalog`を追加する**

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
    // ショップの品ぞろえ全体(バラ売り3枠+福袋2枠)を再抽選するリロールのコスト刻み幅。
    // 1回目はrerollCostStep、2回目は2倍、3回目は3倍…と、同一ショップ訪問中のリロール回数に応じて増額する
    rerollCostStep: number
  }
```

以下に置き換える:

```ts
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 福袋のカタログ。管理画面(/admin/shidasu-packs)で自由に追加・削除・編集できる可変長リスト
    packCatalog: PackCatalogEntry[]
    // ショップの品ぞろえ全体(バラ売り3枠+福袋2枠)を再抽選するリロールのコスト刻み幅。
    // 1回目はrerollCostStep、2回目は2倍、3回目は3倍…と、同一ショップ訪問中のリロール回数に応じて増額する
    rerollCostStep: number
  }
```

- [ ] **Step 4: `params.ts`の`DEFAULT_PARAMS`から`packPrice`を削除し`packCatalog`(14件)を追加する**

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
    rerollCostStep: 5,
  },
```

以下に置き換える:

```ts
  shop: {
    itemPrice: { C: { buy: 8, sell: 4 }, U: { buy: 16, sell: 8 }, R: { buy: 30, sell: 15 } },
    ritePrice: { buy: 12, sell: 6 },
    revelationPrice: { buy: 18, sell: 9 },
    oraclePrice: { buy: 15, sell: 7 },
    packCatalog: [
      { name: '護符の福袋', packKind: 'item', offerCount: 3, pickCount: 1, price: 20 },
      { name: '護符の福袋', packKind: 'item', offerCount: 5, pickCount: 1, price: 30 },
      { name: '護符の福袋', packKind: 'item', offerCount: 7, pickCount: 2, price: 50 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 3, pickCount: 1, price: 20 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 5, pickCount: 1, price: 30 },
      { name: '秘儀の福袋', packKind: 'rite', offerCount: 7, pickCount: 2, price: 50 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 3, pickCount: 1, price: 25 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 5, pickCount: 1, price: 38 },
      { name: '天啓の福袋', packKind: 'revelation', offerCount: 7, pickCount: 2, price: 63 },
      { name: '神託の福袋', packKind: 'oracle', offerCount: 3, pickCount: 1, price: 22 },
      { name: '神託の福袋', packKind: 'oracle', offerCount: 5, pickCount: 1, price: 33 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 3, pickCount: 1, price: 20 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 5, pickCount: 1, price: 30 },
      { name: 'トランプセットの福袋', packKind: 'cardSet', offerCount: 7, pickCount: 2, price: 50 },
    ],
    rerollCostStep: 5,
  },
```

- [ ] **Step 5: `shidasu.config.json`から`packPrice`を削除し`packCatalog`(14件、本番価格)を追加する**

`src/lib/game/shidasu/shidasu.config.json`内、以下の既存コードを探す:

```json
    "oraclePrice": {
      "buy": 3,
      "sell": 1
    },
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
    "rerollCostStep": 5
  },
```

以下に置き換える:

```json
    "oraclePrice": {
      "buy": 3,
      "sell": 1
    },
    "packCatalog": [
      { "name": "護符の福袋", "packKind": "item", "offerCount": 3, "pickCount": 1, "price": 4 },
      { "name": "護符の福袋", "packKind": "item", "offerCount": 5, "pickCount": 1, "price": 7 },
      { "name": "護符の福袋", "packKind": "item", "offerCount": 7, "pickCount": 2, "price": 10 },
      { "name": "秘儀の福袋", "packKind": "rite", "offerCount": 3, "pickCount": 1, "price": 4 },
      { "name": "秘儀の福袋", "packKind": "rite", "offerCount": 5, "pickCount": 1, "price": 6 },
      { "name": "秘儀の福袋", "packKind": "rite", "offerCount": 7, "pickCount": 2, "price": 8 },
      { "name": "天啓の福袋", "packKind": "revelation", "offerCount": 3, "pickCount": 1, "price": 4 },
      { "name": "天啓の福袋", "packKind": "revelation", "offerCount": 5, "pickCount": 1, "price": 6 },
      { "name": "天啓の福袋", "packKind": "revelation", "offerCount": 7, "pickCount": 2, "price": 8 },
      { "name": "神託の福袋", "packKind": "oracle", "offerCount": 3, "pickCount": 1, "price": 2 },
      { "name": "神託の福袋", "packKind": "oracle", "offerCount": 5, "pickCount": 1, "price": 4 },
      { "name": "トランプセットの福袋", "packKind": "cardSet", "offerCount": 3, "pickCount": 1, "price": 4 },
      { "name": "トランプセットの福袋", "packKind": "cardSet", "offerCount": 5, "pickCount": 1, "price": 6 },
      { "name": "トランプセットの福袋", "packKind": "cardSet", "offerCount": 7, "pickCount": 2, "price": 8 }
    ],
    "rerollCostStep": 5
  },
```

- [ ] **Step 6: 型チェックを実行し、想定されるエラーを確認する**

Run: `npm run check`

Expected: `src/lib/game/shidasu/shop.ts`・`shop.test.ts`・`engine.ts`・`engine.test.ts`・`src/routes/game/shidasu/+page.svelte`・`src/routes/admin/shidasu-currency/+page.svelte`で、`PACK_DEFINITIONS`・`packPrice`・`PackOfferCount`・`shop.packPrice`などの未解決参照によるエラーが多数出る。これはTask 2以降で順に解消するため、このタスクでは「型定義側の変更が完了し、後続タスクで直すべき箇所が型チェックで洗い出せている」ことだけを確認すればよい。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: 福袋カタログ(PackCatalogEntry)の型定義とパラメータを追加し、旧packPrice/PACK_DEFINITIONS用の型を撤廃"
```

---

### Task 2: `shop.ts`の書き換えと`shop.test.ts`の更新

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts`
- Modify: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: `shop.ts`から`PACK_DEFINITIONS`・`packPrice`を削除し、`packCatalog`ベースの抽選に書き換える**

`src/lib/game/shidasu/shop.ts`の全文を、以下の内容に置き換える:

```ts
// src/lib/game/shidasu/shop.ts
import type { RunState, ItemId, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { shuffleInPlace } from './deck'

const SHOP_SLOT_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle']

function poolFor(kind: ShopSlotKind): readonly string[] {
  if (kind === 'item') return ITEM_POOL
  if (kind === 'rite') return RITE_POOL
  if (kind === 'revelation') return REVELATION_POOL
  return ORACLE_POOL
}

// 護符のみ「所持中」「同一ショップ内の他のバラ売り枠」を除外する。秘儀・天啓・神託は重複所持が
// 許容される仕様のため除外しない。除外後の候補が尽きた場合(87種のプールでは実質起こり得ないが)は
// プール全体にフォールバックしてクラッシュを避ける。
function rollIndividualSlot(run: RunState, usedItemIds: Set<ItemId>, rand: () => number): ShopIndividualSlot {
  const kind = SHOP_SLOT_KINDS[Math.floor(rand() * SHOP_SLOT_KINDS.length)]
  if (kind === 'item') {
    const available = ITEM_POOL.filter(id => !run.items.includes(id) && !usedItemIds.has(id))
    const pool = available.length > 0 ? available : ITEM_POOL
    const id = pool[Math.floor(rand() * pool.length)]
    usedItemIds.add(id)
    return { kind, id, sold: false }
  }
  const pool = poolFor(kind)
  const id = pool[Math.floor(rand() * pool.length)]
  return { kind, id, sold: false }
}

// params.shop.packCatalogをシャッフルし、先頭2件を選ぶ(均等抽選)。選ばれたエントリの
// name・priceはこの時点でShopPackSlotにスナップショットとしてコピーする。
function rollPackSlots(params: ShidasuParams, rand: () => number): ShopPackSlot[] {
  const entries = [...params.shop.packCatalog]
  shuffleInPlace(entries, rand)
  return entries.slice(0, 2).map(e => ({ packKind: e.packKind, offerCount: e.offerCount, pickCount: e.pickCount, name: e.name, price: e.price, sold: false }))
}

export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(params, rand) }
}

export function itemBuyPrice(params: ShidasuParams, id: ItemId): number {
  return params.shop.itemPrice[params.talismans[id].rarity].buy
}

export function itemSellPrice(params: ShidasuParams, id: ItemId): number {
  return params.shop.itemPrice[params.talismans[id].rarity].sell
}

export function riteBuyPrice(params: ShidasuParams): number {
  return params.shop.ritePrice.buy
}

export function riteSellPrice(params: ShidasuParams): number {
  return params.shop.ritePrice.sell
}

export function revelationBuyPrice(params: ShidasuParams): number {
  return params.shop.revelationPrice.buy
}

export function revelationSellPrice(params: ShidasuParams): number {
  return params.shop.revelationPrice.sell
}

export function oracleBuyPrice(params: ShidasuParams): number {
  return params.shop.oraclePrice.buy
}

export function oracleSellPrice(params: ShidasuParams): number {
  return params.shop.oraclePrice.sell
}
```

(`PackDefinition`インターフェース・`PACK_DEFINITIONS`定数・`packPrice()`関数を削除し、`rollPackSlots`が`params`を受け取って`params.shop.packCatalog`から抽選するようにした。`rollShop`も`params`を先頭引数に追加した。)

- [ ] **Step 2: `shop.test.ts`を全面的に書き換える**

`src/lib/game/shidasu/shop.test.ts`の全文を、以下の内容に置き換える:

```ts
// src/lib/game/shidasu/shop.test.ts
import { describe, test, expect } from 'vitest'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'

describe('rollShop', () => {
  test('バラ売り3枠・福袋2枠を返す', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    expect(shop.individual).toHaveLength(3)
    expect(shop.packs).toHaveLength(2)
    shop.individual.forEach(slot => expect(slot.sold).toBe(false))
    shop.packs.forEach(slot => expect(slot.sold).toBe(false))
  })

  test('バラ売り枠のitem種別idはITEM_POOLに含まれ、rite/revelation/oracleも各プールに含まれる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(3))
    shop.individual.forEach(slot => {
      if (slot.kind === 'item') expect(ITEM_POOL).toContain(slot.id)
      if (slot.kind === 'rite') expect(RITE_POOL).toContain(slot.id)
      if (slot.kind === 'revelation') expect(REVELATION_POOL).toContain(slot.id)
      if (slot.kind === 'oracle') expect(ORACLE_POOL).toContain(slot.id)
    })
  })

  test('バラ売りitem枠は所持中の護符を候補から除外する', () => {
    const run = { ...createInitialRun(), items: ITEM_POOL.slice(0, ITEM_POOL.length - 1) as typeof ITEM_POOL }
    const shop = rollShop(DEFAULT_PARAMS, run, createRng(1))
    const itemSlots = shop.individual.filter(s => s.kind === 'item')
    itemSlots.forEach(s => expect(run.items).not.toContain(s.id))
  })

  test('バラ売りitem枠は同一ショップ内で重複しない', () => {
    // 何度か抽選し、item種別の枠が複数あるケースでidが重複していないことを確認する
    for (let seed = 1; seed <= 20; seed++) {
      const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(seed))
      const itemIds = shop.individual.filter(s => s.kind === 'item').map(s => s.id)
      expect(new Set(itemIds).size).toBe(itemIds.length)
    }
  })

  test('福袋2枠はpackCatalogのエントリから重複なく選ばれ、name・priceがコピーされる', () => {
    const shop = rollShop(DEFAULT_PARAMS, createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      const entry = DEFAULT_PARAMS.shop.packCatalog.find(e => e.packKind === p.packKind && e.offerCount === p.offerCount && e.pickCount === p.pickCount)
      expect(entry).toBeDefined()
      expect(p.name).toBe(entry!.name)
      expect(p.price).toBe(entry!.price)
    })
  })

  test('packCatalogにcardSetの3-1・5-1・7-2パターンが含まれる', () => {
    const cardSetEntries = DEFAULT_PARAMS.shop.packCatalog.filter(e => e.packKind === 'cardSet')
    expect(cardSetEntries).toHaveLength(3)
    expect(cardSetEntries.some(e => e.offerCount === 3 && e.pickCount === 1)).toBe(true)
    expect(cardSetEntries.some(e => e.offerCount === 5 && e.pickCount === 1)).toBe(true)
    expect(cardSetEntries.some(e => e.offerCount === 7 && e.pickCount === 2)).toBe(true)
  })
})

describe('価格関数', () => {
  test('itemBuyPrice/itemSellPriceはレアリティ別価格表を参照する', () => {
    const rarityC = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    const rarityR = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'R')!
    expect(itemBuyPrice(DEFAULT_PARAMS, rarityC)).toBe(8)
    expect(itemSellPrice(DEFAULT_PARAMS, rarityC)).toBe(4)
    expect(itemBuyPrice(DEFAULT_PARAMS, rarityR)).toBe(30)
    expect(itemSellPrice(DEFAULT_PARAMS, rarityR)).toBe(15)
  })

  test('rite/revelation/oracleの価格', () => {
    expect(riteBuyPrice(DEFAULT_PARAMS)).toBe(12)
    expect(riteSellPrice(DEFAULT_PARAMS)).toBe(6)
    expect(revelationBuyPrice(DEFAULT_PARAMS)).toBe(18)
    expect(revelationSellPrice(DEFAULT_PARAMS)).toBe(9)
    expect(oracleBuyPrice(DEFAULT_PARAMS)).toBe(15)
    expect(oracleSellPrice(DEFAULT_PARAMS)).toBe(7)
  })
})
```

(`PACK_DEFINITIONS`・`packPrice`関連のテストを削除し、`rollShop`の呼び出しに`DEFAULT_PARAMS`を先頭引数として追加。福袋抽選テストは`DEFAULT_PARAMS.shop.packCatalog`を参照する形に書き換え、選ばれたスロットの`name`・`price`がカタログエントリと一致することを検証するアサーションを追加した。)

- [ ] **Step 3: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`

Expected: PASS(全件)

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`

Expected: `shop.ts`・`shop.test.ts`に関するエラーはゼロになる。`engine.ts`・`engine.test.ts`・`+page.svelte`・`shidasu-currency/+page.svelte`関連のエラーはまだ残る(Task 3以降で解消)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/shop.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: shop.tsの福袋抽選をPACK_DEFINITIONS固定配列からpackCatalogベースに書き換え"
```

---

### Task 3: `engine.ts`の追随と`engine.test.ts`の更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `engine.ts`のimportから`packPrice`を削除する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, packPrice } from './shop'
```

以下に置き換える:

```ts
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice } from './shop'
```

- [ ] **Step 2: `enterShop`の`rollShop`呼び出しに`params`を渡す**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
  return { ...next, shop: rollShop(next, rand) }
}

// ショップ系フェーズでの天啓ターゲット選択用に、現在のdeckCompositionから使い捨ての
```

以下に置き換える:

```ts
  return { ...next, shop: rollShop(params, next, rand) }
}

// ショップ系フェーズでの天啓ターゲット選択用に、現在のdeckCompositionから使い捨ての
```

- [ ] **Step 3: `rerollShop`の`rollShop`呼び出しに`params`を渡す**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
export function rerollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const cost = shopRerollCost(params, run)
  if (run.currency < cost) return run
  return { ...run, currency: run.currency - cost, shop: rollShop(run, rand), shopRerollCount: run.shopRerollCount + 1 }
}
```

以下に置き換える:

```ts
export function rerollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const cost = shopRerollCost(params, run)
  if (run.currency < cost) return run
  return { ...run, currency: run.currency - cost, shop: rollShop(params, run, rand), shopRerollCount: run.shopRerollCount + 1 }
}
```

- [ ] **Step 4: `buyPack`を`slot.price`ベースに書き換える**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  const price = packPrice(params, slot.packKind, slot.offerCount)
  if (run.currency < price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
```

以下に置き換える:

```ts
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  if (run.currency < slot.price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - slot.price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
```

- [ ] **Step 5: `engine.test.ts`のimportから`packPrice`を削除する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
import { itemBuyPrice, riteBuyPrice, revelationBuyPrice, packPrice, itemSellPrice, riteSellPrice, revelationSellPrice, oracleSellPrice, rollShop } from './shop'
```

以下に置き換える:

```ts
import { itemBuyPrice, riteBuyPrice, revelationBuyPrice, itemSellPrice, riteSellPrice, revelationSellPrice, oracleSellPrice, rollShop } from './shop'
```

- [ ] **Step 6: `rollShop`の3箇所の呼び出しに`DEFAULT_PARAMS`を追加する(`finishShop`テストブロック)**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
  test('phaseがshopのとき、waveが新規生成されplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const shopRun = { ...run, shop: rollShop(run, () => 0.5) }
    const result = finishShop(DEFAULT_PARAMS, shopRun, 1)
```

以下に置き換える:

```ts
  test('phaseがshopのとき、waveが新規生成されplayingへ遷移する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const shopRun = { ...run, shop: rollShop(DEFAULT_PARAMS, run, () => 0.5) }
    const result = finishShop(DEFAULT_PARAMS, shopRun, 1)
```

同ファイル内、以下の既存コードを探す:

```ts
  test('waveGenerationがWave生成のたびに1ずつ増える(waveKeyの配布アニメ発火キーとして使う)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.waveGeneration).toBe(0)
    const shopRun = { ...run, shop: rollShop(run, () => 0.5) }
    const started = finishShop(DEFAULT_PARAMS, shopRun, 1)
    expect(started.waveGeneration).toBe(1)
    const secondShopRun = { ...started, phase: 'shop' as const, shop: rollShop(started, () => 0.5) }
```

以下に置き換える:

```ts
  test('waveGenerationがWave生成のたびに1ずつ増える(waveKeyの配布アニメ発火キーとして使う)', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.waveGeneration).toBe(0)
    const shopRun = { ...run, shop: rollShop(DEFAULT_PARAMS, run, () => 0.5) }
    const started = finishShop(DEFAULT_PARAMS, shopRun, 1)
    expect(started.waveGeneration).toBe(1)
    const secondShopRun = { ...started, phase: 'shop' as const, shop: rollShop(DEFAULT_PARAMS, started, () => 0.5) }
```

- [ ] **Step 7: `トランプセット福袋の購入・選択フロー`ブロックの`ShopPackSlot`リテラルに`name`・`price`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
describe('トランプセット福袋の購入・選択フロー', () => {
  test('buyPackでcardSet福袋を購入すると、cardSetSelectフェーズへ遷移しcardSetOfferが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('cardSetSelect')
    expect(result.cardSetOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('buyPackでcardSet福袋を購入すると通貨が価格分減る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(100 - packPrice(DEFAULT_PARAMS, 'cardSet', 3))
  })
```

以下に置き換える:

```ts
describe('トランプセット福袋の購入・選択フロー', () => {
  test('buyPackでcardSet福袋を購入すると、cardSetSelectフェーズへ遷移しcardSetOfferが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, name: 'トランプセットの福袋', price: 20, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('cardSetSelect')
    expect(result.cardSetOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('buyPackでcardSet福袋を購入すると通貨が価格分減る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, name: 'トランプセットの福袋', price: 20, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(100 - 20)
  })
```

- [ ] **Step 8: `buyPack / pickPackItem(護符の福袋)`ブロックのヘルパーに`name`・`price`を追加し、`packPrice`依存を撤廃する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
describe('buyPack / pickPackItem(護符の福袋)', () => {
  function shopRunWithItemPack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 3, pickCount: 1, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackは通貨を減らし、itemSelectフェーズへ遷移してoffer件数分の候補を提示する', () => {
    const run = shopRunWithItemPack()
    const price = packPrice(DEFAULT_PARAMS, 'item', 3)
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(999 - price)
```

以下に置き換える:

```ts
describe('buyPack / pickPackItem(護符の福袋)', () => {
  function shopRunWithItemPack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 3, pickCount: 1, name: '護符の福袋', price: 20, sold: false }] },
      ...overrides,
    }
  }

  test('buyPackは通貨を減らし、itemSelectフェーズへ遷移してoffer件数分の候補を提示する', () => {
    const run = shopRunWithItemPack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(999 - 20)
```

- [ ] **Step 9: 同ブロックの7-2パターンテストの`ShopPackSlot`リテラルに`name`・`price`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
    const packRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 7, pickCount: 2, sold: false }] },
    }
```

以下に置き換える:

```ts
    const packRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 7, pickCount: 2, name: '護符の福袋', price: 50, sold: false }] },
    }
```

- [ ] **Step 10: `buyPack / pickPackRite(秘儀の福袋)`ブロックのヘルパーに`name`・`price`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
describe('buyPack / pickPackRite(秘儀の福袋)', () => {
  function shopRunWithRitePack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'rite', offerCount: 3, pickCount: 1, sold: false }] },
      ...overrides,
    }
```

以下に置き換える:

```ts
describe('buyPack / pickPackRite(秘儀の福袋)', () => {
  function shopRunWithRitePack(overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      shop: { individual: [], packs: [{ packKind: 'rite', offerCount: 3, pickCount: 1, name: '秘儀の福袋', price: 20, sold: false }] },
      ...overrides,
    }
```

- [ ] **Step 11: `buyPack / pickPackRevelation`ブロックのヘルパーに`name`・`price`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
  function shopRunWithRevelationPack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'revelation', offerCount: 3, pickCount: 1, sold: false }] },
      ...overrides,
    }
  }
```

以下に置き換える:

```ts
  function shopRunWithRevelationPack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'revelation', offerCount: 3, pickCount: 1, name: '天啓の福袋', price: 25, sold: false }] },
      ...overrides,
    }
  }
```

- [ ] **Step 12: `buyPack / pickPackOracle`ブロックのヘルパーに`name`・`price`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下の既存コードを探す:

```ts
  function shopRunWithOraclePack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'oracle', offerCount: 3, pickCount: 1, sold: false }] },
      ...overrides,
    }
  }
```

以下に置き換える:

```ts
  function shopRunWithOraclePack(overrides: Partial<RunState> = {}): RunState {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave,
      shop: { individual: [], packs: [{ packKind: 'oracle', offerCount: 3, pickCount: 1, name: '神託の福袋', price: 22, sold: false }] },
      ...overrides,
    }
  }
```

- [ ] **Step 13: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`

Expected: PASS(全件)

- [ ] **Step 14: 型チェックを実行する**

Run: `npm run check`

Expected: `engine.ts`・`engine.test.ts`に関するエラーはゼロになる。`+page.svelte`・`shidasu-currency/+page.svelte`関連のエラーはまだ残る(Task 4・5で解消)。

- [ ] **Step 15: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: engine.tsのrollShop呼び出し・buyPackをpackCatalog/slot.priceベースに追随"
```

---

### Task 4: ショップ画面UI更新(`+page.svelte`)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importから`packPrice`を削除する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```ts
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice, packPrice,
  } from '$lib/game/shidasu/shop'
```

以下に置き換える:

```ts
  import {
    itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice,
    oracleBuyPrice, oracleSellPrice,
  } from '$lib/game/shidasu/shop'
```

- [ ] **Step 2: 未使用になる`SHOP_SLOT_KIND_LABEL`を削除する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```ts
  const SHOP_SLOT_KIND_LABEL: Record<ShopSlotKind, string> = {
    item: '護符', rite: '秘儀', revelation: '天啓', oracle: '神託', cardSet: 'トランプセット',
  }

  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
```

以下に置き換える:

```ts
  // タイトル画面の高さをプレイ画面に揃えるための計測専用ダミーウェーブ(実際のゲームには使わない)
```

- [ ] **Step 3: 福袋表示・購入ボタンを`slot.name`・`slot.price`ベースに変更する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```svelte
          {#each run.shop.packs as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold text-slate-800">{SHOP_SLOT_KIND_LABEL[slot.packKind]}福袋 {slot.offerCount}択{slot.pickCount}</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < packPrice(params, slot.packKind, slot.offerCount)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({packPrice(params, slot.packKind, slot.offerCount)})
                </button>
              {/if}
            </div>
          {/each}
```

以下に置き換える:

```svelte
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
```

- [ ] **Step 4: 未使用になった`ShopSlotKind`の型importを削除する**

`SHOP_SLOT_KIND_LABEL`の削除(Step 2)により、`ShopSlotKind`型がこのファイル内で使われなくなる(`grep -n "ShopSlotKind" src/routes/game/shidasu/+page.svelte`で確認すると、型importの行以外に出現しないことを確認できる)。

`src/routes/game/shidasu/+page.svelte`内、以下の既存コードを探す:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult, Star, WaveState, CardSetGenreId } from '$lib/game/shidasu/types'
```

以下に置き換える:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId } from '$lib/game/shidasu/types'
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`

Expected: `+page.svelte`に関するエラー・未使用importの警告がゼロになる。`shidasu-currency/+page.svelte`関連のエラーはまだ残る(Task 5で解消)。

- [ ] **Step 6: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-debug`または実際のゲームプレイ経由でショップ画面に入り、福袋の表示が「{名前}({選択肢数}択{取得数})」形式になっており、価格・購入が正しく機能することをブラウザで確認する。

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面の福袋表示をpackCatalogのname/priceベースに変更"
```

---

### Task 5: 管理画面(`shidasu-currency`)から旧`packPrice`関連を削除

**Files:**
- Modify: `src/routes/admin/shidasu-currency/+page.svelte`

- [ ] **Step 1: バリデーションから`packPrice`関連の12行を削除する**

`src/routes/admin/shidasu-currency/+page.svelte`内、以下の既存コードを探す:

```ts
    if (!Number.isFinite(config.shop.oraclePrice.buy) || config.shop.oraclePrice.buy < 0) return true
    if (!Number.isFinite(config.shop.oraclePrice.sell) || config.shop.oraclePrice.sell < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.threeOne) || config.shop.packPrice.item.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.fiveOne) || config.shop.packPrice.item.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.sevenTwo) || config.shop.packPrice.item.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.threeOne) || config.shop.packPrice.rite.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.fiveOne) || config.shop.packPrice.rite.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.sevenTwo) || config.shop.packPrice.rite.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.threeOne) || config.shop.packPrice.revelation.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.fiveOne) || config.shop.packPrice.revelation.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.sevenTwo) || config.shop.packPrice.revelation.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.oracle.threeOne) || config.shop.packPrice.oracle.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.oracle.fiveOne) || config.shop.packPrice.oracle.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.cardSet.threeOne) || config.shop.packPrice.cardSet.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.cardSet.fiveOne) || config.shop.packPrice.cardSet.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.cardSet.sevenTwo) || config.shop.packPrice.cardSet.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.rerollCostStep) || config.shop.rerollCostStep < 0) return true
    return false
  })
```

以下に置き換える:

```ts
    if (!Number.isFinite(config.shop.oraclePrice.buy) || config.shop.oraclePrice.buy < 0) return true
    if (!Number.isFinite(config.shop.oraclePrice.sell) || config.shop.oraclePrice.sell < 0) return true
    if (!Number.isFinite(config.shop.rerollCostStep) || config.shop.rerollCostStep < 0) return true
    return false
  })
```

- [ ] **Step 2: 「福袋価格」セクション全体を削除する**

`src/routes/admin/shidasu-currency/+page.svelte`内、以下の既存コードを探す:

```svelte
      <div>
        <p class="text-xs text-slate-500 mb-1">福袋価格(護符・秘儀・天啓・トランプセットは3-1/5-1/7-2、神託は3-1/5-1のみ)</p>
        <div class="grid grid-cols-3 gap-3">
          <label class="text-xs text-slate-500">
            護符 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.item.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.item.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.item.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">ショップリロールのコスト刻み幅(1回目はこの値、2回目は2倍、3回目は3倍…と同一ショップ訪問中に増額)</p>
```

以下に置き換える:

```svelte
      <div>
        <p class="text-xs text-slate-500 mb-1">福袋の価格・種類・出現比率は<a href="/admin/shidasu-packs" class="text-teal-600 underline">福袋カタログ設定</a>で編集する。</p>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">ショップリロールのコスト刻み幅(1回目はこの値、2回目は2倍、3回目は3倍…と同一ショップ訪問中に増額)</p>
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`

Expected: `shidasu-currency/+page.svelte`に関するエラーはゼロになる。

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-currency`を開き、福袋価格の入力欄が「福袋カタログ設定へのリンク」案内に置き換わっていることをブラウザで確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: 通貨設定画面から旧packPriceの入力欄を削除し福袋カタログ設定へ誘導"
```

---

### Task 6: 新規管理画面(`/admin/shidasu-packs`)の作成

**Files:**
- Create: `src/routes/admin/shidasu-packs/+page.svelte`
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: `/admin/shidasu-packs/+page.svelte`を新規作成する**

`src/routes/admin/shidasu-packs/+page.svelte`を新規作成する:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import type { ShopSlotKind } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  const PACK_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const PACK_KIND_LABEL: Record<ShopSlotKind, string> = {
    item: '護符', rite: '秘儀', revelation: '天啓', oracle: '神託', cardSet: 'トランプセット',
  }

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return config.shop.packCatalog.some(entry => {
      if (!entry.name.trim()) return true
      if (!Number.isFinite(entry.offerCount) || entry.offerCount < 1) return true
      if (!Number.isFinite(entry.pickCount) || entry.pickCount < 1 || entry.pickCount > entry.offerCount) return true
      if (!Number.isFinite(entry.price) || entry.price < 0) return true
      return false
    })
  })

  function addEntry() {
    if (!config) return
    config.shop.packCatalog = [...config.shop.packCatalog, { name: '', packKind: 'item', offerCount: 3, pickCount: 1, price: 0 }]
  }

  function removeEntry(index: number) {
    if (!config) return
    config.shop.packCatalog = config.shop.packCatalog.filter((_, i) => i !== index)
  }

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 福袋カタログ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 福袋カタログ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前が空、選択肢数が1未満、取得数が範囲外、または価格が負の行があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs text-slate-500 mb-3">ショップで抽選される福袋の一覧。同じ内容(種別・選択肢数・取得数・価格)の行を名前だけ変えて複数用意すると、その福袋の出現率を相対的に上げられる(各行の抽選確率は常に均等)。</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:12rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">アイテム種別</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">選択肢数</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">取得数</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">価格</th>
              <th class="px-2 py-1.5 text-left" style="width:4rem;"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each config.shop.packCatalog as entry, i (i)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.packKind} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each PACK_KINDS as kind (kind)}
                      <option value={kind}>{PACK_KIND_LABEL[kind]}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.offerCount} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.pickCount} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.price} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <button onclick={() => removeEntry(i)} class="text-slate-400 hover:text-red-600">削除</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <button onclick={addEntry} class="mt-3 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        + 行を追加
      </button>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: adminトップページにリンクを追加する**

`src/routes/admin/+page.svelte`内、以下の既存コードを探す:

```svelte
    <a href="/admin/shidasu-currency" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 通貨設定</p>
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
```

以下に置き換える:

```svelte
    <a href="/admin/shidasu-currency" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 通貨設定</p>
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
    <a href="/admin/shidasu-packs" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 福袋カタログ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">福袋(名前・種別・選択肢数・取得数・価格)の追加・削除・編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
  </div>
</div>
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`

Expected: shidasu関連のエラーがゼロになる(全タスク完了により全体がクリーンになる想定)。

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin`から「福袋カタログ設定」リンクをたどり、`/admin/shidasu-packs`で以下をブラウザで確認する。

- 既存14件の福袋が一覧表示される
- 「行を追加」で新しい行が追加できる
- 行の「削除」ボタンで行が消せる
- 名前を空にする、選択肢数を0にする等でバリデーションエラーが表示され保存ボタンが無効化される
- 保存後、`/admin/shidasu-currency`の福袋価格入力欄が案内リンクに置き換わっていることを確認する
- ゲーム画面(`/game/shidasu`)のショップで、編集した福袋カタログの内容が反映されることを確認する

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-packs/+page.svelte src/routes/admin/+page.svelte
git commit -m "feat: 福袋カタログの追加・削除・編集ができる管理画面/admin/shidasu-packsを新設"
```

---

## 全タスク完了後の確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`でリポジトリ全体のテストスイートを実行し、全てPASSすることを確認する
- [ ] `npm run dev`で開発サーバーを起動し、ショップで福袋を購入する一連の流れ(表示名・価格・購入・選択画面遷移)が問題なく動作することを目視確認する
- [ ] `/admin/shidasu-packs`で福袋を1件追加・保存し、ショップ画面のリロールボタンで実際にその新規福袋が出現しうることを確認する
