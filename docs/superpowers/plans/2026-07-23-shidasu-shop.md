# Shidasuショップ画面 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星詠みソリティア -Shidasu- に、Waveクリアごとに突入するショップ画面(バラ売り3枠+福袋2枠、通貨で護符・秘儀・天啓・神託を購入/売却)を実装し、現行の自動オファー方式(itemSelect/revelationSelect/oracleSelectがWaveクリア時に自動で開く仕組み)を廃止する。

**Architecture:** `docs/superpowers/specs/2026-07-23-shidasu-shop-design.md` の設計に従う。既存の`RunPhase`に`'shop'`と`'riteSelect'`を追加し、`itemSelect`/`riteSelect`/`revelationSelect`/`oracleSelect`は「福袋の中身選択画面」として再定義する。抽選ロジックは`deck.ts`の新規`rollOffer<T>`ヘルパーに統一し、`items.ts`/`rites.ts`/`revelations.ts`/`oracles.ts`の各オファー関数がこれを呼ぶ。ショップの商品構成・価格ロジックは新規`shop.ts`に集約する。`engine.ts`にショップ突入(`enterShop`)・ショップ終了(`finishShop`)・バラ売り購入(`buyIndividual*`、上限到達時はブロックのみでスワップなし)・福袋購入(`buyPack`)・福袋中身選択(`pickPack*`、上限到達時は既存`pendingNewItem`と同型のスワップUIパターンを4カテゴリへ拡張)・売却(`sell*`)・神託の所持化消費(`useOracle`)を追加する。UIは`+page.svelte`(ゲーム画面)と管理画面`/admin/shidasu-currency`を拡張する。

**Tech Stack:** SvelteKit, Svelte 5 (runes), TypeScript, Vitest。

---

## 前提・共通ルール

- 全タスクで`npm run test -- <対象ファイル>`を都度実行し、テストがREDになることを確認してから実装、GREENになることを確認してからコミットする(TDD)。
- コミットメッセージは日本語(例: `feat: ショップ抽選用の共通rollOfferヘルパーを追加`)。
- Task 6(shop.ts)完了時点、Task 11(engine.ts本体)完了時点、Task 15(engine.test.ts)完了時点の3箇所で`npm run check`を実行し型エラーがないことを確認する(esbuildの`npm run build`は型チェックしないため)。
- 個別購入(バラ売り)は上限到達時は常に「何もしない(ブロック)」。福袋購入(パック)経由の中身選択のみ上限到達時にスワップUIを経由する。この非対称性を各タスクで取り違えないこと。

---

### Task 1: types.ts — RunPhase拡張・RunState新規フィールド・ShopState型

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:191-228`

型定義のみの変更なのでテストは書かず、Task 2以降のコンパイルが通ることで検証する。

- [ ] **Step 1: RunPhaseに`'shop'`と`'riteSelect'`を追加**

`src/lib/game/shidasu/types.ts:191`の現在の行:

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

を以下に置き換える:

```ts
export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

- [ ] **Step 2: ショップ関連の新規型を追加**

`RunPhase`の定義行の直後(`export interface RunState {`の直前)に以下を挿入する:

```ts
export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle'

// バラ売り枠: shop突入時に種類と個体が1つ確定し、以後入れ替わらない。購入するとsoldがtrueになるだけで
// 配列自体(枠の並び)は変化しない。idはkindに応じてItemId | RiteId | RevelationId | RoleNameのいずれか。
export interface ShopIndividualSlot {
  kind: ShopSlotKind
  id: string
  sold: boolean
}

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

export interface ShopState {
  individual: ShopIndividualSlot[]
  packs: ShopPackSlot[]
}

// 福袋の天啓・神託パックで上限到達時にスワップ対象を指定するための判別共用体。
// 天啓・神託は合算枠(上限2)を共有するため、スワップ対象がどちらの配列に属するかを明示する必要がある。
export type HeldRevelationOrOracleRef =
  | { kind: 'revelation'; id: RevelationId }
  | { kind: 'oracle'; id: RoleName }

```

- [ ] **Step 3: RunStateに新規フィールドを追加**

`src/lib/game/shidasu/types.ts`の`RunState`インターフェース末尾、現在の`currency: number`フィールドの直後(`}`閉じ括弧の直前)に以下を追加する:

```ts
  // 温存中の神託(合算上限2をrevelationsと共有)。同じ役を複数所持できる
  oracles: RoleName[]
  // 現在のショップの商品構成。'shop'フェーズおよびそこから派生する福袋中身選択フェーズの間のみ非null
  shop: ShopState | null
  // 福袋購入後、あと何個選べば中身選択画面が終了するか(0ならその画面にいない)
  offerPickRemaining: number
  // 秘儀の福袋('riteSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  riteOffer: RiteId[]
  // 秘儀の福袋中身選択で上限到達時、選ばれたが未確定の秘儀(スワップ待ち)。待機中でなければnull
  pendingNewRite: RiteId | null
  // 天啓の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の天啓(スワップ待ち)。待機中でなければnull
  pendingNewRevelation: RevelationId | null
  // 神託の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の神託(スワップ待ち)。待機中でなければnull
  pendingNewOracle: RoleName | null
```

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: ショップ画面用の型定義を追加"
```

---

### Task 2: deck.ts — 共通抽選ヘルパー`rollOffer`

**Files:**
- Modify: `src/lib/game/shidasu/deck.ts`
- Test: `src/lib/game/shidasu/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/deck.test.ts`の末尾(既存の`describe('standardDeckComposition', ...)`ブロックの後)に追加する:

```ts
describe('rollOffer', () => {
  test('countで指定した件数を返す(プールがcountを超える場合)', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 3, createRng(1))
    expect(result).toHaveLength(3)
  })

  test('プールがcount未満なら全件を返す', () => {
    const result = rollOffer([1, 2], 3, createRng(1))
    expect(result).toHaveLength(2)
    expect(new Set(result)).toEqual(new Set([1, 2]))
  })

  test('重複を含まない非復元抽出になる', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 5, createRng(1))
    expect(new Set(result).size).toBe(5)
  })

  test('同じシードなら同じ結果になる(再現性)', () => {
    const a = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    const b = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    expect(a).toEqual(b)
  })

  test('元の配列を書き換えない', () => {
    const pool = [1, 2, 3, 4, 5]
    const copy = [...pool]
    rollOffer(pool, 3, createRng(1))
    expect(pool).toEqual(copy)
  })
})
```

`src/lib/game/shidasu/deck.test.ts`先頭のimport行に`rollOffer`を追加する(既存のimport文を`shuffleInPlace`等と同じ行から拡張、実際のimport元・既存メンバー名はファイル先頭を確認のうえ追記すること)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/deck.test.ts`
Expected: FAIL (`rollOffer` is not exported)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/deck.ts`の`shuffleInPlace`関数の直後に追加する:

```ts
// count個を重複なく無作為抽出する共通ヘルパー。福袋・バラ売り・各種オファー抽選はすべてこれを経由する。
// プールがcount未満の場合は全件を返す(呼び出し側でエラー扱いにはしない)。
export function rollOffer<T>(pool: T[], count: number, rand: () => number = Math.random): T[] {
  const arr = [...pool]
  shuffleInPlace(arr, rand)
  return arr.slice(0, count)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/deck.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/deck.ts src/lib/game/shidasu/deck.test.ts
git commit -m "feat: ショップ抽選用の共通rollOfferヘルパーを追加"
```

---

### Task 3: items.ts — rollItemOfferにcount引数を追加

**Files:**
- Modify: `src/lib/game/shidasu/items.ts`
- Test: `src/lib/game/shidasu/items.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/items.test.ts`の`describe('rollItemOffer', ...)`ブロック内、既存の3テストの後に追加する:

```ts
  test('countを指定すればその件数まで返す', () => {
    const offer = rollItemOffer([], createRng(1), 5)
    expect(offer).toHaveLength(5)
    expect(new Set(offer).size).toBe(5)
  })

  test('countを省略すれば従来通り3件になる', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/items.test.ts`
Expected: FAIL (`rollItemOffer`の第3引数`count`が型エラー、または5件を要求しているのに3件しか返らずFAIL)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/items.ts`内、現在の以下のコード:

```ts
function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  shuffleInPlace(arr, rand)
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return shuffleItems(available, rand).slice(0, 3)
}
```

を以下に置き換える(`shuffleItems`は`rollOffer`に統合されるため削除):

```ts
export function rollItemOffer(items: ItemId[], rand: () => number = Math.random, count = 3): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return rollOffer(available, count, rand)
}
```

`src/lib/game/shidasu/items.ts`先頭のimport文を確認し、`shuffleInPlace`のimportを`rollOffer`に置き換える(`import { shuffleInPlace } from './deck'` → `import { rollOffer } from './deck'`。他のシンボルを同じ行でimportしている場合はそれらを維持しつつ`shuffleInPlace`のみ`rollOffer`に差し替える)。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/items.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/items.test.ts
git commit -m "feat: rollItemOfferにcount引数を追加"
```

---

### Task 4: rites.ts — rollRiteOfferの新設

**Files:**
- Modify: `src/lib/game/shidasu/rites.ts`
- Create: `src/lib/game/shidasu/rites.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/rites.test.ts`を新規作成する:

```ts
// src/lib/game/shidasu/rites.test.ts
import { describe, test, expect } from 'vitest'
import { rollRiteOffer, RITE_POOL, rollRite } from './rites'
import { createRng } from './deck'

describe('rollRiteOffer', () => {
  test('デフォルトで3件返す(プールは24種あるため重複なし)', () => {
    const offer = rollRiteOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(RITE_POOL).toContain(id))
  })

  test('countを指定すればその件数まで返す', () => {
    const offer = rollRiteOffer(createRng(1), 7)
    expect(offer).toHaveLength(7)
    expect(new Set(offer).size).toBe(7)
  })
})

describe('rollRite(既存、後方互換確認)', () => {
  test('所持数が3未満なら1件返す', () => {
    const rite = rollRite([], createRng(1))
    expect(rite).not.toBeNull()
    expect(RITE_POOL).toContain(rite)
  })

  test('所持数が3以上ならnullを返す', () => {
    expect(rollRite(['raidho', 'jera', 'wunjo'], createRng(1))).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/rites.test.ts`
Expected: FAIL (`rollRiteOffer` is not exported)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/rites.ts`先頭のimport群に以下を追加する:

```ts
import { rollOffer } from './deck'
```

`export function rollRite(...)`の直後に以下を追加する:

```ts
// 秘儀の福袋('riteSelect'フェーズ)用オファー抽選。RITE_POOLは24種で重複を考慮しないため
// (所持中の秘儀を除外しない=既に持っている秘儀も再度候補に含まれる、既存rollRiteと同じ仕様)。
export function rollRiteOffer(rand: () => number = Math.random, count = 3): RiteId[] {
  return rollOffer(RITE_POOL, count, rand)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/rites.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/rites.ts src/lib/game/shidasu/rites.test.ts
git commit -m "feat: 秘儀の福袋用オファー抽選rollRiteOfferを追加"
```

---

### Task 5: revelations.ts / oracles.ts — count引数の追加

**Files:**
- Modify: `src/lib/game/shidasu/revelations.ts`
- Modify: `src/lib/game/shidasu/oracles.ts`
- Create: `src/lib/game/shidasu/revelations.test.ts`
- Create: `src/lib/game/shidasu/oracles.test.ts`

- [ ] **Step 1: 失敗するテストを書く(天啓)**

`src/lib/game/shidasu/revelations.test.ts`を新規作成する:

```ts
// src/lib/game/shidasu/revelations.test.ts
import { describe, test, expect } from 'vitest'
import { rollRevelationOffer, REVELATION_POOL } from './revelations'
import { createRng } from './deck'

describe('rollRevelationOffer', () => {
  test('デフォルトで3件返す', () => {
    const offer = rollRevelationOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(REVELATION_POOL).toContain(id))
  })

  test('countを指定すればその件数まで返す', () => {
    const offer = rollRevelationOffer(createRng(1), 7)
    expect(offer).toHaveLength(7)
    expect(new Set(offer).size).toBe(7)
  })

  test('プール(12種)を超えるcountを指定してもプール全件までしか返らない', () => {
    const offer = rollRevelationOffer(createRng(1), 20)
    expect(offer).toHaveLength(REVELATION_POOL.length)
  })
})
```

- [ ] **Step 2: 失敗するテストを書く(神託)**

`src/lib/game/shidasu/oracles.test.ts`を新規作成する:

```ts
// src/lib/game/shidasu/oracles.test.ts
import { describe, test, expect } from 'vitest'
import { rollOracleOffer, ORACLE_POOL } from './oracles'
import { createRng } from './deck'

describe('rollOracleOffer', () => {
  test('デフォルトで3件返す', () => {
    const offer = rollOracleOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(ORACLE_POOL).toContain(id))
  })

  test('countを指定すればその件数まで返す(神託は3-1/5-1パックのみ、5まで)', () => {
    const offer = rollOracleOffer(createRng(1), 5)
    expect(offer).toHaveLength(5)
    expect(new Set(offer).size).toBe(5)
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/revelations.test.ts src/lib/game/shidasu/oracles.test.ts`
Expected: FAIL (count引数が型エラー、または件数不一致)

- [ ] **Step 4: 実装(天啓)**

`src/lib/game/shidasu/revelations.ts`の現在の以下のコード:

```ts
export function rollRevelationOffer(rand: () => number = Math.random): RevelationId[] {
  const pool = [...REVELATION_POOL]
  shuffleInPlace(pool, rand)
  return pool.slice(0, 3)
}
```

を以下に置き換える:

```ts
export function rollRevelationOffer(rand: () => number = Math.random, count = 3): RevelationId[] {
  return rollOffer(REVELATION_POOL, count, rand)
}
```

ファイル先頭のimportを`import { shuffleInPlace } from './deck'` → `import { rollOffer } from './deck'`に変更する(他のシンボルがあれば維持)。

- [ ] **Step 5: 実装(神託)**

`src/lib/game/shidasu/oracles.ts`の現在の以下のコード:

```ts
export function rollOracleOffer(rand: () => number = Math.random): RoleName[] {
  const pool = [...ORACLE_POOL]
  shuffleInPlace(pool, rand)
  return pool.slice(0, 3)
}
```

を以下に置き換える:

```ts
export function rollOracleOffer(rand: () => number = Math.random, count = 3): RoleName[] {
  return rollOffer(ORACLE_POOL, count, rand)
}
```

ファイル先頭のimportを`import { shuffleInPlace } from './deck'` → `import { rollOffer } from './deck'`に変更する(他のシンボルがあれば維持)。

- [ ] **Step 6: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/revelations.test.ts src/lib/game/shidasu/oracles.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/revelations.ts src/lib/game/shidasu/oracles.ts src/lib/game/shidasu/revelations.test.ts src/lib/game/shidasu/oracles.test.ts
git commit -m "feat: 天啓・神託オファー抽選にcount引数を追加"
```

---

### Task 6: params.ts + shidasu.config.json — ショップ価格設定

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:65-66,261-262`
- Modify: `src/lib/game/shidasu/shidasu.config.json:49-50`

型・デフォルト値・JSON設定の追加のみでロジックがないため、テストはTask 7の`shop.ts`側で価格参照関数を通して検証する。ここでは型チェックの通過を確認する。

- [ ] **Step 1: params.tsのインターフェースに`shop`フィールドを追加**

`src/lib/game/shidasu/params.ts:65`、現在`currency: { ... }`ブロックが閉じる`}`の直後、`talismans: {`(66行目)の直前に以下を挿入する:

```ts
  shop: {
    itemPrice: Record<Rarity, { buy: number; sell: number }>
    ritePrice: { buy: number; sell: number }
    revelationPrice: { buy: number; sell: number }
    oraclePrice: { buy: number; sell: number }
    // 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
    }
  }
```

- [ ] **Step 2: DEFAULT_PARAMSにshopのデフォルト値を追加**

`src/lib/game/shidasu/params.ts:261`付近、`DEFAULT_PARAMS`内の`currency: { ... },`ブロックの直後、`talismans: {`の直前に以下を挿入する:

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
    },
  },
```

- [ ] **Step 3: shidasu.config.jsonにshopブロックを追加**

`src/lib/game/shidasu/shidasu.config.json:49`、`"currency": { ... },`ブロックが閉じる行の直後、`"talismans": {`(50行目)の直前に以下を挿入する:

```json
  "shop": {
    "itemPrice": { "C": { "buy": 8, "sell": 4 }, "U": { "buy": 16, "sell": 8 }, "R": { "buy": 30, "sell": 15 } },
    "ritePrice": { "buy": 12, "sell": 6 },
    "revelationPrice": { "buy": 18, "sell": 9 },
    "oraclePrice": { "buy": 15, "sell": 7 },
    "packPrice": {
      "item": { "threeOne": 20, "fiveOne": 30, "sevenTwo": 50 },
      "rite": { "threeOne": 20, "fiveOne": 30, "sevenTwo": 50 },
      "revelation": { "threeOne": 25, "fiveOne": 38, "sevenTwo": 63 },
      "oracle": { "threeOne": 22, "fiveOne": 33 }
    }
  },
```

- [ ] **Step 4: 型チェックを確認**

Run: `npm run check`
Expected: `params.ts`と`shidasu.config.json`起因のエラーが無いこと(DEFAULT_PARAMSの型とJSONの形が一致していること)。既存の他エラーが仮にあれば無視せず内容を確認する。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: ショップの価格設定をparams/configに追加"
```

---

### Task 7: shop.ts — 商品構成抽選・価格ロジック

**Files:**
- Create: `src/lib/game/shidasu/shop.ts`
- Create: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/shop.test.ts`を新規作成する:

```ts
// src/lib/game/shidasu/shop.test.ts
import { describe, test, expect } from 'vitest'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, packPrice, PACK_DEFINITIONS } from './shop'
import { DEFAULT_PARAMS } from './params'
import { createInitialRun } from './engine'
import { createRng } from './deck'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'

describe('rollShop', () => {
  test('バラ売り3枠・福袋2枠を返す', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    expect(shop.individual).toHaveLength(3)
    expect(shop.packs).toHaveLength(2)
    shop.individual.forEach(slot => expect(slot.sold).toBe(false))
    shop.packs.forEach(slot => expect(slot.sold).toBe(false))
  })

  test('バラ売り枠のitem種別idはITEM_POOLに含まれ、rite/revelation/oracleも各プールに含まれる', () => {
    const shop = rollShop(createInitialRun(), createRng(3))
    shop.individual.forEach(slot => {
      if (slot.kind === 'item') expect(ITEM_POOL).toContain(slot.id)
      if (slot.kind === 'rite') expect(RITE_POOL).toContain(slot.id)
      if (slot.kind === 'revelation') expect(REVELATION_POOL).toContain(slot.id)
      if (slot.kind === 'oracle') expect(ORACLE_POOL).toContain(slot.id)
    })
  })

  test('バラ売りitem枠は所持中の護符を候補から除外する', () => {
    const run = { ...createInitialRun(), items: ITEM_POOL.slice(0, ITEM_POOL.length - 1) as typeof ITEM_POOL }
    const shop = rollShop(run, createRng(1))
    const itemSlots = shop.individual.filter(s => s.kind === 'item')
    itemSlots.forEach(s => expect(run.items).not.toContain(s.id))
  })

  test('バラ売りitem枠は同一ショップ内で重複しない', () => {
    // 何度か抽選し、item種別の枠が複数あるケースでidが重複していないことを確認する
    for (let seed = 1; seed <= 20; seed++) {
      const shop = rollShop(createInitialRun(), createRng(seed))
      const itemIds = shop.individual.filter(s => s.kind === 'item').map(s => s.id)
      expect(new Set(itemIds).size).toBe(itemIds.length)
    }
  })

  test('福袋2枠はPACK_DEFINITIONSのパターンから重複なく選ばれる', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      expect(PACK_DEFINITIONS.some(d => d.packKind === p.packKind && d.offerCount === p.offerCount && d.pickCount === p.pickCount)).toBe(true)
    })
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

  test('packPriceはkind×offerCountの組み合わせで価格表を参照する', () => {
    expect(packPrice(DEFAULT_PARAMS, 'item', 3)).toBe(20)
    expect(packPrice(DEFAULT_PARAMS, 'item', 5)).toBe(30)
    expect(packPrice(DEFAULT_PARAMS, 'item', 7)).toBe(50)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 3)).toBe(25)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 5)).toBe(38)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 7)).toBe(63)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 3)).toBe(22)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 5)).toBe(33)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/shop.test.ts`
Expected: FAIL (`./shop`モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/shop.ts`を新規作成する:

```ts
// src/lib/game/shidasu/shop.ts
import type { RunState, ItemId, RoleName, ShopState, ShopIndividualSlot, ShopPackSlot, ShopSlotKind, PackOfferCount } from './types'
import type { ShidasuParams } from './params'
import { ITEM_POOL } from './items'
import { RITE_POOL } from './rites'
import { REVELATION_POOL } from './revelations'
import { ORACLE_POOL } from './oracles'
import { shuffleInPlace } from './deck'

const SHOP_SLOT_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle']

interface PackDefinition {
  packKind: ShopSlotKind
  offerCount: PackOfferCount
  pickCount: 1 | 2
}

// 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1の2パターン(7-2は無し)。計11パターン。
export const PACK_DEFINITIONS: PackDefinition[] = [
  { packKind: 'item', offerCount: 3, pickCount: 1 },
  { packKind: 'item', offerCount: 5, pickCount: 1 },
  { packKind: 'item', offerCount: 7, pickCount: 2 },
  { packKind: 'rite', offerCount: 3, pickCount: 1 },
  { packKind: 'rite', offerCount: 5, pickCount: 1 },
  { packKind: 'rite', offerCount: 7, pickCount: 2 },
  { packKind: 'revelation', offerCount: 3, pickCount: 1 },
  { packKind: 'revelation', offerCount: 5, pickCount: 1 },
  { packKind: 'revelation', offerCount: 7, pickCount: 2 },
  { packKind: 'oracle', offerCount: 3, pickCount: 1 },
  { packKind: 'oracle', offerCount: 5, pickCount: 1 },
]

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

function rollPackSlots(rand: () => number): ShopPackSlot[] {
  const defs = [...PACK_DEFINITIONS]
  shuffleInPlace(defs, rand)
  return defs.slice(0, 2).map(d => ({ packKind: d.packKind, offerCount: d.offerCount, pickCount: d.pickCount, sold: false }))
}

export function rollShop(run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individual: ShopIndividualSlot[] = [
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
    rollIndividualSlot(run, usedItemIds, rand),
  ]
  return { individual, packs: rollPackSlots(rand) }
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

// 福袋の価格。神託はsevenTwoパターンが存在しないため、rollPackSlots/PACK_DEFINITIONSの制約により
// packKind==='oracle'のときofferCountは3か5にしかならない前提でテーブル参照する。
export function packPrice(params: ShidasuParams, packKind: ShopSlotKind, offerCount: PackOfferCount): number {
  const key = offerCount === 3 ? 'threeOne' : offerCount === 5 ? 'fiveOne' : 'sevenTwo'
  const table = params.shop.packPrice[packKind] as unknown as Record<string, number>
  return table[key]
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/shop.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/shop.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: ショップの商品構成抽選・価格ロジックを追加"
```

---

### Task 8: engine.ts — createInitialRun / beginRun にショップ用フィールドを追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:996-1030`
- Modify: `src/lib/game/shidasu/engine.test.ts:2041-2096`(`createInitialRun / beginRun`ブロック)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('createInitialRun / beginRun', ...)`ブロック内(2041-2096行目)の末尾に以下のテストを追加する:

```ts
  test('createInitialRunはショップ用フィールドを初期値で持つ', () => {
    const run = createInitialRun()
    expect(run.oracles).toEqual([])
    expect(run.shop).toBeNull()
    expect(run.offerPickRemaining).toBe(0)
    expect(run.riteOffer).toEqual([])
    expect(run.pendingNewRite).toBeNull()
    expect(run.pendingNewRevelation).toBeNull()
    expect(run.pendingNewOracle).toBeNull()
  })

  test('beginRunはショップ用フィールドを初期値で持つ', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.oracles).toEqual([])
    expect(run.shop).toBeNull()
    expect(run.offerPickRemaining).toBe(0)
    expect(run.riteOffer).toEqual([])
    expect(run.pendingNewRite).toBeNull()
    expect(run.pendingNewRevelation).toBeNull()
    expect(run.pendingNewOracle).toBeNull()
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "createInitialRun / beginRun"`
Expected: FAIL (`run.oracles`等が`undefined`)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`の現在の`createInitialRun`(996-1003行目):

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null, currency: 0,
  }
}
```

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null, currency: 0,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

現在の`beginRun`(1005-1030行目):

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialBossKind = rollBossKindForStage(params, 0, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
    currentBossKind: initialBossKind,
    currency: params.currency.initialAmount,
  }
}
```

を以下に置き換える:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialBossKind = rollBossKindForStage(params, 0, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
    currentBossKind: initialBossKind,
    currency: params.currency.initialAmount,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "createInitialRun / beginRun"`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: RunStateのショップ用フィールド初期値をcreateInitialRun/beginRunに追加"
```

---

### Task 9: engine.ts — resolveWaveEnd / enterShop / continueAfterGreatMisfortune / finishShop

これがショップ導入の中核。既存の`enterRevelationSelect`(private)・`finishRevelationSelect`(private)を`enterShop`・`finishShop`に置き換える。この時点では`resolveWaveEnd`の遷移先フェーズを`'shop'`に変える(内容が空でも許容、中身の売買はTask 10以降)。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1032-1051`(`resolveWaveEnd`)、`1069-1110`(`enterRevelationSelect`/`finishRevelationSelect`)、`1219-1236`(`continueAfterGreatMisfortune`等)
- Modify: `src/lib/game/shidasu/engine.test.ts:2097-2180`(`resolveWaveEnd`ブロック)、`2223-2330`(`pickItem / continueAfterGreatMisfortune / restartRun`ブロック)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('resolveWaveEnd', ...)`ブロック(2097-2180行目)は、現状`phase: 'itemSelect'`への遷移を前提にしたテストを含む。ブロック内の該当アサーションを次のように書き換える(ブロック全体を読み、`phase`を検証している箇所と`offer`を検証している箇所を特定して置き換えること。目印として、成功時の遷移を検証している既存テストの期待値を次の内容に変更する):

```ts
  test('目標スコア以上でクリアした場合、ショップ画面(shop)へ遷移しバラ売り3枠・福袋2枠が確定する', () => {
    const run = endedRun(999)
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('shop')
    expect(result.shop).not.toBeNull()
    expect(result.shop!.individual).toHaveLength(3)
    expect(result.shop!.packs).toHaveLength(2)
  })

  test('ショップ突入時、次のウェーブ位置・ボス種別・プレビューウェーブが確定する(既存のenterRevelationSelect相当)', () => {
    const run = endedRun(999)
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.waveIndex).toBe(run.waveIndex + 1)
    expect(result.wave).not.toBeNull()
    expect(result.wave!.status).toBe('playing')
  })

  test('目標スコア未達の場合はgameOverへ遷移しshopはnullのまま', () => {
    const run = endedRun(0)
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('gameOver')
    expect(result.shop).toBeNull()
  })

  test('大凶ボスWaveクリア時はcontinueChoiceへ遷移しshopはnullのまま', () => {
    const run = { ...endedRun(999), stageIndex: 2, waveIndex: DEFAULT_PARAMS.flow.wavesPerStage - 1 }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(result.phase).toBe('continueChoice')
    expect(result.shop).toBeNull()
  })
```

(このブロックには`endedRun`ヘルパーが既に定義されている。既存の`phase: 'itemSelect'`や`offer`を直接検証しているテストがあれば、上記の意図に合わせて`shop`ベースの検証に書き換える。`stageModifierFor / bossScoreLockFor`ブロック(2182行目以降)には影響しない。)

`describe('pickItem / continueAfterGreatMisfortune / restartRun', ...)`ブロック(2223-2330行目)のうち、`continueAfterGreatMisfortune`に関するテストを次の内容に書き換える:

```ts
  test('continueAfterGreatMisfortuneはcontinueChoiceからshopへ遷移する', () => {
    const run: RunState = { ...createInitialRun(), phase: 'continueChoice', stageIndex: 2, waveIndex: 2, wave: startWave(DEFAULT_PARAMS, 2, 2, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave }
    const result = continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(3))
    expect(result.phase).toBe('shop')
    expect(result.shop).not.toBeNull()
  })

  test('continueChoice以外のフェーズでは何もしない', () => {
    const run = { ...createInitialRun(), phase: 'playing' as const }
    expect(continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(3))).toBe(run)
  })
```

同ブロック内の`pickItem`関連テストはTask 12で`buyPack`/`pickPackItem`ベースのテストに置き換えるため、このTaskでは変更しない(一時的にコンパイルエラーになるのは許容し、Task 12完了時点で解消する)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "resolveWaveEnd"`
Expected: FAIL (`result.phase`が`'itemSelect'`のまま)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`先頭のimport文(2-13行目)を以下に置き換える(`rollRite`は個別購入・福袋購入いずれもTask 10以降で`shop.ts`/`rites.ts`側の関数を使うため、engine.tsからの直接呼び出しはpickItem等の削除に伴い不要になるが、`rollRiteOffer`は新たに必要になる。`HeldRevelationOrOracleRef`型はTask 11以降で使用するためここで先に追加してよい):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, BossKind, BossTierKey, RunPhase, HeldRevelationOrOracleRef } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern, evaluateChainBonus, analyzeSuitColor, countSameRankBefore, countSameRankForWildPlay, fmtMultiplier } from './patterns'
import { rollItemOffer } from './items'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { applyRiteEffect, canUseRite } from './riteEffects'
import { rollRiteOffer } from './rites'
import { rollRevelationOffer } from './revelations'
import { applyRevelationEffect, canUseRevelation } from './revelationEffects'
import { rollOracleOffer, defaultOracleLevels } from './oracles'
import { rollShop, itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, packPrice } from './shop'
```

`isBossWave`〜`BOSS_TIER_KEYS`定義(880-927行目)の直後、`nextWaveLocation`等が定義されている領域はそのまま維持する。

ショップの遷移に使うフェーズ集合を、`nextWaveLocation`関数の直前に追加する:

```ts
// 秘儀・天啓・神託の使用がショップ滞在中(shop本体および福袋の各中身選択画面)でも
// 行えるようにするためのフェーズ集合。useRite/useRevelationのガードで使う。
const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect']
```

現在の`resolveWaveEnd`(1032-1051行目):

```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const earned = params.currency.waveClearAmount
    + (isBossWave(params, run.waveIndex) ? params.currency.bossBonus[BOSS_TIER_KEYS[bossTierOf(run.stageIndex)]] : 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、護符等の選択を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じitemSelectへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return { ...runWithCurrency, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

を以下に置き換える(`seed`を第4引数として追加。既存の呼び出し元は全て`rand`までの3引数のため後方互換):

```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const earned = params.currency.waveClearAmount
    + (isBossWave(params, run.waveIndex) ? params.currency.bossBonus[BOSS_TIER_KEYS[bossTierOf(run.stageIndex)]] : 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、ショップ突入を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じショップへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return enterShop(params, runWithCurrency, seed, rand)
}
```

現在の`enterRevelationSelect`(1069-1096行目、private)と`finishRevelationSelect`(1100-1110行目、private)を、以下の`enterShop`・`finishShop`に置き換える:

```ts
// Waveクリア確定後(resolveWaveEnd)・大凶続行後(continueAfterGreatMisfortune)に呼ぶ。
// 次ウェーブ位置・ボス種別・大凶対象スートを確定し、天啓ターゲット用のプレビューウェーブを配布した上で
// ショップの商品構成を抽選し、phase: 'shop'へ遷移する。
function enterShop(params: ShidasuParams, run: RunState, seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newBossKind = nextBossKind(params, run, newLocation, rand)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, newBossKind, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    currentBossKind: newBossKind,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}

// ショップを終了し、その時点のdeckComposition・extraTableauRows(ショップ滞在中の天啓「即使う」等で
// 更新されている可能性がある)から実際のウェーブを配り直してプレイ画面へ進む。「次のWaveへ」ボタンから呼ぶ。
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return { ...run, phase: 'playing', wave, deckComposition, shop: null }
}
```

現在の`continueAfterGreatMisfortune`(1223-1226行目):

```ts
export function continueAfterGreatMisfortune(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

を以下に置き換える(`seed`を第4引数として追加):

```ts
export function continueAfterGreatMisfortune(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
  if (run.phase !== 'continueChoice') return run
  return enterShop(params, run, seed, rand)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "resolveWaveEnd"`
Expected: PASS (`pickItem`関連テストは既存のまま残っているためこの時点では別途FAILするが、このステップではresolveWaveEnd関連のみ確認する)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Waveクリア後の遷移先をショップ画面(shop)に変更"
```

---

### Task 10: engine.ts — バラ売り購入(buyIndividual*)

上限到達時は購入不可(ブロックのみ、スワップなし)。神託は「即使う」なら上限を無視して常に購入可。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(Task 9の`finishShop`の直後に追加)
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('護符所持上限・交換(maxItems / confirmItemSwap / cancelItemSwap / skipItemSelect)', ...)`ブロック(2332-2405行目)を、次の内容の新しいブロックに全面的に置き換える(このブロックが検証していた「itemSelectでの上限到達時スワップ」は、バラ売りの仕様変更(ブロックのみ)と福袋購入の仕様(Task 12でスワップ検証)に分割されるため):

```ts
describe('buyIndividualItem(バラ売り護符購入)', () => {
  function shopRun(individual: ShopIndividualSlot[], overrides: Partial<RunState> = {}): RunState {
    return {
      ...createInitialRun(),
      phase: 'shop',
      currency: 999,
      wave: startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave,
      shop: { individual, packs: [] },
      ...overrides,
    }
  }

  test('購入すると所持に追加され通貨が減り、該当枠がsold済みになる', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'C')!
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }])
    const price = itemBuyPrice(DEFAULT_PARAMS, itemId)
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result.items).toEqual([itemId])
    expect(result.currency).toBe(999 - price)
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('所持上限(maxItems)到達時は購入できない(ブロック、スワップは発生しない)', () => {
    const itemId = ITEM_POOL[0]
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }], { items: fullItems })
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('通貨が不足していれば購入できない', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'R')!
    const run = shopRun([{ kind: 'item', id: itemId, sold: false }], { currency: 0 })
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('既にsold済みの枠は購入できない', () => {
    const itemId = ITEM_POOL[0]
    const run = shopRun([{ kind: 'item', id: itemId, sold: true }])
    const result = buyIndividualItem(DEFAULT_PARAMS, run, 0)
    expect(result).toBe(run)
  })

  test('shopフェーズ以外では何もしない', () => {
    const itemId = ITEM_POOL[0]
    const run = { ...shopRun([{ kind: 'item', id: itemId, sold: false }]), phase: 'playing' as const }
    expect(buyIndividualItem(DEFAULT_PARAMS, run, 0)).toBe(run)
  })
})

describe('buyIndividualRite(バラ売り秘儀購入)', () => {
  test('購入すると所持に追加され通貨が減る', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'rite', id: 'raidho', sold: false }], packs: [] },
    }
    const result = buyIndividualRite(DEFAULT_PARAMS, run, 0)
    expect(result.rites).toEqual(['raidho'])
    expect(result.currency).toBe(999 - riteBuyPrice(DEFAULT_PARAMS))
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('所持上限3到達時は購入できない', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, rites: ['raidho', 'jera', 'wunjo'],
      shop: { individual: [{ kind: 'rite', id: 'othala', sold: false }], packs: [] },
    }
    expect(buyIndividualRite(DEFAULT_PARAMS, run, 0)).toBe(run)
  })
})

describe('buyIndividualRevelationUse(バラ売り天啓・即使う)', () => {
  test('購入すると即座にプレビューウェーブへ効果が適用され、所持には加わらない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave,
      shop: { individual: [{ kind: 'revelation', id: 'kaku', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationUse(DEFAULT_PARAMS, run, 0, null)
    expect(result.revelations).toEqual([])
    expect(result.currency).toBe(999 - revelationBuyPrice(DEFAULT_PARAMS))
    expect(result.shop!.individual[0].sold).toBe(true)
  })

  test('上限とは無関係に(天啓・神託合算枠が満杯でも)購入できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave, revelations: ['kaku', 'kou'],
      shop: { individual: [{ kind: 'revelation', id: 'tei', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationUse(DEFAULT_PARAMS, run, 0, null)
    expect(result.shop!.individual[0].sold).toBe(true)
  })
})

describe('buyIndividualRevelationHold(バラ売り天啓・温存)', () => {
  test('購入すると所持に追加される', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'revelation', id: 'kaku', sold: false }], packs: [] },
    }
    const result = buyIndividualRevelationHold(DEFAULT_PARAMS, run, 0)
    expect(result.revelations).toEqual(['kaku'])
    expect(result.currency).toBe(999 - revelationBuyPrice(DEFAULT_PARAMS))
  })

  test('天啓・神託合算上限2到達時は購入できない(片方1個ずつで合計2でもブロック)', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, revelations: ['kaku'], oracles: ['flush'],
      shop: { individual: [{ kind: 'revelation', id: 'kou', sold: false }], packs: [] },
    }
    expect(buyIndividualRevelationHold(DEFAULT_PARAMS, run, 0)).toBe(run)
  })
})

describe('buyIndividualOracleUse / buyIndividualOracleHold(バラ売り神託)', () => {
  test('即使うは役レベルを+1し、run/waveの両方に反映される(上限無関係)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, wave, revelations: ['kaku'], oracles: ['flush'],
      shop: { individual: [{ kind: 'oracle', id: 'flush', sold: false }], packs: [] },
    }
    const result = buyIndividualOracleUse(DEFAULT_PARAMS, run, 0)
    expect(result.oracleLevels.flush).toBe(defaultOracleLevels().flush + 1)
    expect(result.wave!.oracleLevels.flush).toBe(defaultOracleLevels().flush + 1)
    expect(result.oracles).toEqual(['flush'])
  })

  test('温存は所持に追加され、合算上限2到達時はブロックされる', () => {
    const run: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [{ kind: 'oracle', id: 'flush', sold: false }], packs: [] },
    }
    const result = buyIndividualOracleHold(DEFAULT_PARAMS, run, 0)
    expect(result.oracles).toEqual(['flush'])

    const fullRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999, revelations: ['kaku', 'kou'],
      shop: { individual: [{ kind: 'oracle', id: 'stair', sold: false }], packs: [] },
    }
    expect(buyIndividualOracleHold(DEFAULT_PARAMS, fullRun, 0)).toBe(fullRun)
  })
})
```

このブロックの直前に必要なimportを`engine.test.ts`先頭のimport文へ追加する: `buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold, buyIndividualOracleUse, buyIndividualOracleHold`(engine.tsから)、`itemBuyPrice, riteBuyPrice, revelationBuyPrice`(shop.tsから)、`ShopIndividualSlot`(types.tsから、型のみimport)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyIndividual"`
Expected: FAIL (関数が存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`の`finishShop`の直後に以下を追加する:

```ts
// バラ売り護符購入。所持上限(maxItems)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  if (run.items.length >= params.items.maxItems) return run
  const price = itemBuyPrice(params, itemId)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, items: [...run.items, itemId], shop: { ...run.shop, individual } }
}

// バラ売り秘儀購入。所持上限3到達時・通貨不足時・売り切れ時は何もしない。
export function buyIndividualRite(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'rite') return run
  const riteId = slot.id as RiteId
  if (run.rites.length >= 3) return run
  const price = riteBuyPrice(params)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, rites: [...run.rites, riteId], shop: { ...run.shop, individual } }
}

// バラ売り天啓・即使う。プレビューウェーブ(run.wave)に即座に効果を適用する。天啓・神託合算上限とは無関係に常に購入可。
export function buyIndividualRevelationUse(params: ShidasuParams, run: RunState, slotIndex: number, targetCol: number | null, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop || !run.wave) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  const revelationId = slot.id as RevelationId
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const price = revelationBuyPrice(params)
  if (run.currency < price) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, wave, deckComposition, extraTableauRows, shop: { ...run.shop, individual } }
}

// バラ売り天啓・温存。天啓・神託合算上限2到達時はブロックする(スワップは発生しない)。
export function buyIndividualRevelationHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  if (run.revelations.length + run.oracles.length >= 2) return run
  const revelationId = slot.id as RevelationId
  const price = revelationBuyPrice(params)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, revelations: [...run.revelations, revelationId], shop: { ...run.shop, individual } }
}

// バラ売り神託・即使う。役レベル+1をrun/wave両方に反映する(pickOracleFromOfferと同じ同期が必要)。上限とは無関係に常に購入可。
export function buyIndividualOracleUse(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  const roleName = slot.id as RoleName
  const price = oracleBuyPrice(params)
  if (run.currency < price) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, oracleLevels, wave, shop: { ...run.shop, individual } }
}

// バラ売り神託・温存。天啓・神託合算上限2到達時はブロックする。
export function buyIndividualOracleHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  if (run.revelations.length + run.oracles.length >= 2) return run
  const roleName = slot.id as RoleName
  const price = oracleBuyPrice(params)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, oracles: [...run.oracles, roleName], shop: { ...run.shop, individual } }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyIndividual"`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: バラ売り購入(護符・秘儀・天啓・神託)を実装"
```

---

### Task 11: engine.ts — 福袋購入(buyPack)と護符福袋の中身選択(pickPackItem系)

福袋購入は上限無関係に常に成立する。中身選択で上限到達時のみスワップUIを経由する(既存`pendingNewItem`/`confirmItemSwap`/`cancelItemSwap`と同型のパターンをpack向けに再実装)。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('pickItem / continueAfterGreatMisfortune / restartRun', ...)`ブロック(2223-2330行目)のうち、旧`pickItem`(Wave終了時の自動オファーからの選択)に関するテストを全て削除し、代わりに以下の新規ブロックを追加する(`continueAfterGreatMisfortune`のテストはTask 9で既に更新済みのため、このステップでは変更しない。`restartRun`のテストは変更不要のためそのまま残す):

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
    expect(result.phase).toBe('itemSelect')
    expect(result.offer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
    expect(result.shop!.packs[0].sold).toBe(true)
  })

  test('通貨不足なら購入できない', () => {
    const run = shopRunWithItemPack({ currency: 0 })
    expect(buyPack(DEFAULT_PARAMS, run, 0, createRng(1))).toBe(run)
  })

  test('所持上限に達していても福袋は購入できる(上限は中身選択の確定時のみ判定)', () => {
    const run = shopRunWithItemPack({ items: ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems) })
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('itemSelect')
  })

  test('pickPackItemで選ぶと所持に追加され、offerPickRemainingが0ならshopへ戻る(7-2パターンでは1個選んでも閉じない)', () => {
    const run = shopRunWithItemPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    expect(picked.items).toEqual([opened.offer[0]])
    expect(picked.phase).toBe('shop')
    expect(picked.offerPickRemaining).toBe(0)
  })

  test('所持上限到達時にpickPackItemを呼ぶとpendingNewItemにセットされ、確定しない', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newItemId = opened.offer[0]
    const picked = pickPackItem(DEFAULT_PARAMS, opened, newItemId)
    expect(picked.pendingNewItem).toBe(newItemId)
    expect(picked.items).toEqual(fullItems)
    expect(picked.phase).toBe('itemSelect')
  })

  test('confirmPackItemSwapで入れ替えが確定し、offerPickRemainingが減る', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newItemId = opened.offer[0]
    const picked = pickPackItem(DEFAULT_PARAMS, opened, newItemId)
    const confirmed = confirmPackItemSwap(picked, fullItems[0])
    expect(confirmed.items).toContain(newItemId)
    expect(confirmed.items).not.toContain(fullItems[0])
    expect(confirmed.items).toHaveLength(fullItems.length)
    expect(confirmed.pendingNewItem).toBeNull()
    expect(confirmed.phase).toBe('shop')
  })

  test('cancelPackItemSwapでpendingNewItemがクリアされ、所持は変化しない', () => {
    const fullItems = ITEM_POOL.slice(0, DEFAULT_PARAMS.items.maxItems)
    const run = shopRunWithItemPack({ items: fullItems })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    const cancelled = cancelPackItemSwap(picked)
    expect(cancelled.pendingNewItem).toBeNull()
    expect(cancelled.items).toEqual(fullItems)
  })

  test('closePackItemSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithItemPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackItemSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.offer).toEqual([])
    expect(closed.offerPickRemaining).toBe(0)
  })

  test('7-2パターンでは1個選んだ後もitemSelectのままで、2個目を選んでshopへ戻る', () => {
    const packRun: RunState = {
      ...createInitialRun(), phase: 'shop', currency: 999,
      shop: { individual: [], packs: [{ packKind: 'item', offerCount: 7, pickCount: 2, sold: false }] },
    }
    const opened = buyPack(DEFAULT_PARAMS, packRun, 0, createRng(1))
    expect(opened.offer).toHaveLength(7)
    const firstPick = pickPackItem(DEFAULT_PARAMS, opened, opened.offer[0])
    expect(firstPick.phase).toBe('itemSelect')
    expect(firstPick.offerPickRemaining).toBe(1)
    const secondPick = pickPackItem(DEFAULT_PARAMS, firstPick, firstPick.offer[0])
    expect(secondPick.phase).toBe('shop')
    expect(secondPick.items).toHaveLength(2)
  })
})
```

このブロックの直前に必要なimportをengine.test.ts先頭のimport文に追加する: `buyPack, pickPackItem, confirmPackItemSwap, cancelPackItemSwap, closePackItemSelect`(engine.tsから)、`packPrice`(shop.tsから、未追加なら)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyPack / pickPackItem"`
Expected: FAIL (関数が存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`の、Task 10で追加した`buyIndividualOracleHold`の直後に、まず`buyPack`本体と護符福袋の関数群を追加する:

```ts
// 福袋購入。上限とは無関係に常に成立する(通貨不足・売り切れ・shop以外のフェーズでのみブロック)。
// 購入したパターンに応じて対応する中身選択フェーズへ遷移し、offerPickRemainingをpickCountにセットする。
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  const price = packPrice(params, slot.packKind, slot.offerCount)
  if (run.currency < price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items, rand, slot.offerCount) }
  if (slot.packKind === 'rite') return { ...base, phase: 'riteSelect', riteOffer: rollRiteOffer(rand, slot.offerCount) }
  if (slot.packKind === 'revelation') return { ...base, phase: 'revelationSelect', revelationOffer: rollRevelationOffer(rand, slot.offerCount) }
  return { ...base, phase: 'oracleSelect', oracleOffer: rollOracleOffer(rand, slot.offerCount) }
}

function resolvePackItemPick(run: RunState, newItems: ItemId[], pickedId: ItemId): RunState {
  const offer = run.offer.filter(id => id !== pickedId)
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', items: newItems, offer: [], pendingNewItem: null, offerPickRemaining: 0 }
  }
  return { ...run, items: newItems, offer, pendingNewItem: null, offerPickRemaining }
}

// 護符の福袋(itemSelect)から1つ選ぶ。所持上限到達時はpendingNewItemにセットしてスワップ待ちにする。
export function pickPackItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || !run.offer.includes(itemId)) return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  return resolvePackItemPick(run, [...run.items, itemId], itemId)
}

// スワップ待ち中に既存の護符と入れ替えて確定する。
export function confirmPackItemSwap(run: RunState, oldItemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  return resolvePackItemPick(run, newItems, run.pendingNewItem)
}

export function cancelPackItemSwap(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, pendingNewItem: null }
}

// 残りの選択を放棄してshopへ戻る。
export function closePackItemSelect(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return { ...run, phase: 'shop', offer: [], pendingNewItem: null, offerPickRemaining: 0 }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyPack / pickPackItem"`
Expected: PASS

- [ ] **Step 5: 型チェックを実行**

Run: `npm run check`
Expected: `pickItem`/`confirmItemSwap`/`cancelItemSwap`/`skipItemSelect`(旧関数)を参照している箇所(`+page.svelte`)がエラーになる。この時点では想定内(Task 15でUIを更新するまで残る)。engine.ts/engine.test.ts起因の新規エラーが無いことのみ確認する。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 福袋購入buyPackと護符福袋の中身選択を実装"
```

---

### Task 12: engine.ts — 秘儀福袋の中身選択(pickPackRite系)、旧pickItem/confirmItemSwap/cancelItemSwap/skipItemSelectの削除

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`に以下の新規ブロックを追加する(Task 11の`buyPack / pickPackItem`ブロックの直後が適切):

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
  }

  test('buyPackでriteSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithRitePack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('riteSelect')
    expect(result.riteOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('pickPackRiteで選ぶと所持に追加されshopへ戻る', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(opened, opened.riteOffer[0])
    expect(picked.rites).toEqual([opened.riteOffer[0]])
    expect(picked.phase).toBe('shop')
  })

  test('所持上限3到達時はpendingNewRiteにセットされスワップ待ちになる', () => {
    const run = shopRunWithRitePack({ rites: ['raidho', 'jera', 'wunjo'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newRiteId = opened.riteOffer[0]
    const picked = pickPackRite(opened, newRiteId)
    expect(picked.pendingNewRite).toBe(newRiteId)
    expect(picked.rites).toEqual(['raidho', 'jera', 'wunjo'])
  })

  test('confirmPackRiteSwapで入れ替えが確定する', () => {
    const run = shopRunWithRitePack({ rites: ['raidho', 'jera', 'wunjo'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const newRiteId = opened.riteOffer[0]
    const picked = pickPackRite(opened, newRiteId)
    const confirmed = confirmPackRiteSwap(picked, 'jera')
    expect(confirmed.rites).toContain(newRiteId)
    expect(confirmed.rites).not.toContain('jera')
    expect(confirmed.rites).toHaveLength(3)
    expect(confirmed.pendingNewRite).toBeNull()
  })

  test('cancelPackRiteSwapでpendingNewRiteがクリアされる', () => {
    const run = shopRunWithRitePack({ rites: ['raidho', 'jera', 'wunjo'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(opened, opened.riteOffer[0])
    const cancelled = cancelPackRiteSwap(picked)
    expect(cancelled.pendingNewRite).toBeNull()
    expect(cancelled.rites).toEqual(['raidho', 'jera', 'wunjo'])
  })

  test('closePackRiteSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackRiteSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.riteOffer).toEqual([])
  })

  test('秘儀の福袋購入では秘儀の自動抽選(rollRite)が発生しない(福袋外の護符購入等でrollRiteが呼ばれていた旧仕様の撤廃確認)', () => {
    const run = shopRunWithRitePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRite(opened, opened.riteOffer[0])
    expect(picked.rites).toHaveLength(1)
  })
})
```

`describe('護符所持上限・交換', ...)`は既にTask 10で全面置き換え済みのため、このステップでは旧`pickItem`/`confirmItemSwap`/`cancelItemSwap`/`skipItemSelect`を参照するテストがファイル中に残っていないか`engine.test.ts`全体を確認し、残っていれば削除する。

必要なimportを追加する: `pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect`(engine.tsから)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyPack / pickPackRite"`
Expected: FAIL (関数が存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`から、現在の`pickItem`・`confirmItemSwap`・`cancelItemSwap`・`skipItemSelect`(旧・Waveクリア自動オファー版、1112-1141行目)を完全に削除する。これらはTask 11で追加した`pickPackItem`系に役割を統合済みのため不要になる。

`closePackItemSelect`の直後に秘儀福袋の中身選択関数群を追加する:

```ts
function resolvePackRitePick(run: RunState, newRites: RiteId[], pickedId: RiteId): RunState {
  const idx = run.riteOffer.indexOf(pickedId)
  const riteOffer = idx === -1 ? run.riteOffer : [...run.riteOffer.slice(0, idx), ...run.riteOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', rites: newRites, riteOffer: [], pendingNewRite: null, offerPickRemaining: 0 }
  }
  return { ...run, rites: newRites, riteOffer, pendingNewRite: null, offerPickRemaining }
}

// 秘儀の福袋(riteSelect)から1つ選ぶ。所持上限3到達時はpendingNewRiteにセットしてスワップ待ちにする。
export function pickPackRite(run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= 3) {
    return { ...run, pendingNewRite: riteId }
  }
  return resolvePackRitePick(run, [...run.rites, riteId], riteId)
}

export function confirmPackRiteSwap(run: RunState, oldRiteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || run.pendingNewRite === null) return run
  const idx = run.rites.indexOf(oldRiteId)
  const remaining = idx === -1 ? [...run.rites] : [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const newRites = [...remaining, run.pendingNewRite]
  return resolvePackRitePick(run, newRites, run.pendingNewRite)
}

export function cancelPackRiteSwap(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return { ...run, pendingNewRite: null }
}

export function closePackRiteSelect(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return { ...run, phase: 'shop', riteOffer: [], pendingNewRite: null, offerPickRemaining: 0 }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "buyPack / pickPackRite"`
Expected: PASS

- [ ] **Step 5: 型チェックを実行**

Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 秘儀福袋の中身選択を実装し旧pickItem系を削除"
```

---

### Task 13: engine.ts — 天啓福袋の中身選択(pickPackRevelation系)、useRevelation/useRevelationFromOffer/pickRevelationFromOffer/skipRevelationSelectの置き換え

天啓の福袋は「即使う」「温存」の2択が中身選択のたびに発生し、温存側は上限到達時にスワップ(相手は天啓・神託どちらでも選べる)を経由する。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1145-1194`
- Modify: `src/lib/game/shidasu/engine.test.ts:2983-3077`(`天啓選択フェーズ`ブロック)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('天啓選択フェーズ', ...)`ブロック(2983-3077行目)を、以下の内容に全面的に置き換える(既存の`useRevelationFromOffer`/`pickRevelationFromOffer`/`skipRevelationSelect`を検証していたテストは、福袋経由のフローに合わせて書き換える):

```ts
describe('天啓の福袋(revelationSelect)', () => {
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

  test('buyPackでrevelationSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithRevelationPack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('revelationSelect')
    expect(result.revelationOffer).toHaveLength(3)
  })

  test('pickPackRevelationUseで即使うと、プレビューウェーブに効果が適用され所持には加わらない', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer.includes('kaku') ? 'kaku' : opened.revelationOffer[0]
    const result = pickPackRevelationUse(DEFAULT_PARAMS, opened, target, null, createRng(2))
    expect(result.revelations).toEqual([])
    expect(result.phase).toBe('shop')
  })

  test('pickPackRevelationHoldで温存すると所持に追加される', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const result = pickPackRevelationHold(opened, opened.revelationOffer[0])
    expect(result.revelations).toEqual([opened.revelationOffer[0]])
    expect(result.phase).toBe('shop')
  })

  test('温存時、天啓・神託合算上限2到達時はpendingNewRevelationにセットされスワップ待ちになる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const result = pickPackRevelationHold(opened, target)
    expect(result.pendingNewRevelation).toBe(target)
    expect(result.revelations).toEqual(['kaku'])
  })

  test('confirmPackRevelationSwapで所持中の天啓と入れ替えできる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const picked = pickPackRevelationHold(opened, target)
    const confirmed = confirmPackRevelationSwap(picked, { kind: 'revelation', id: 'kaku' })
    expect(confirmed.revelations).toEqual([target])
    expect(confirmed.oracles).toEqual(['flush'])
    expect(confirmed.pendingNewRevelation).toBeNull()
  })

  test('confirmPackRevelationSwapで所持中の神託と入れ替えできる(合算枠のため神託側も対象になる)', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const target = opened.revelationOffer[0]
    const picked = pickPackRevelationHold(opened, target)
    const confirmed = confirmPackRevelationSwap(picked, { kind: 'oracle', id: 'flush' })
    expect(confirmed.revelations).toEqual(['kaku', target])
    expect(confirmed.oracles).toEqual([])
  })

  test('cancelPackRevelationSwapでpendingNewRevelationがクリアされる', () => {
    const run = shopRunWithRevelationPack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackRevelationHold(opened, opened.revelationOffer[0])
    const cancelled = cancelPackRevelationSwap(picked)
    expect(cancelled.pendingNewRevelation).toBeNull()
  })

  test('closePackRevelationSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithRevelationPack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackRevelationSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.revelationOffer).toEqual([])
  })
})

describe('useRevelation(所持天啓の使用、playing/shopフロー両対応)', () => {
  test('playingフェーズで使用でき、所持から1個減る', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.revelations).toEqual([])
  })

  test('shopフェーズでも使用できる(SHOP_FLOW_PHASESに含まれるため)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, revelations: ['kaku'] }
    const result = useRevelation(DEFAULT_PARAMS, run, 'kaku', null, createRng(1))
    expect(result.revelations).toEqual([])
  })
})
```

必要なimportを追加する: `pickPackRevelationUse, pickPackRevelationHold, confirmPackRevelationSwap, cancelPackRevelationSwap, closePackRevelationSelect, useRevelation, buyPack`(engine.tsから)。`useRevelationFromOffer`/`pickRevelationFromOffer`/`skipRevelationSelect`のimportは削除する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "天啓の福袋"`
Expected: FAIL (関数が存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`から、現在の`useRevelationFromOffer`・`pickRevelationFromOffer`・`skipRevelationSelect`(1162-1194行目)を削除する(役割を`pickPackRevelation*`系に統合するため)。

現在の`useRevelation`(1145-1160行目):

```ts
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random
): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}
```

を以下に置き換える(ガードを`SHOP_FLOW_PHASES`ベースに拡張):

```ts
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, wave, deckComposition, revelations, extraTableauRows }
}
```

`closePackRiteSelect`の直後に天啓福袋の中身選択関数群を追加する:

```ts
function resolvePackRevelationPick(run: RunState, pickedId: RevelationId): RunState {
  const idx = run.revelationOffer.indexOf(pickedId)
  const revelationOffer = idx === -1 ? run.revelationOffer : [...run.revelationOffer.slice(0, idx), ...run.revelationOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', revelationOffer: [], pendingNewRevelation: null, offerPickRemaining: 0 }
  }
  return { ...run, revelationOffer, pendingNewRevelation: null, offerPickRemaining }
}

// 天啓の福袋(revelationSelect)から1つ選び、その場で使用する(所持には加わらない、上限とは無関係)。
export function pickPackRevelationUse(params: ShidasuParams, run: RunState, revelationId: RevelationId, targetCol: number | null, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave || !run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = revelationId === 'kyo' ? run.extraTableauRows + params.revelations.kyo.n : run.extraTableauRows
  return resolvePackRevelationPick({ ...run, wave, deckComposition, extraTableauRows }, revelationId)
}

// 天啓の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限2到達時はpendingNewRevelationにセットしスワップ待ちにする。
export function pickPackRevelationHold(run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'revelationSelect' || !run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length + run.oracles.length >= 2) {
    return { ...run, pendingNewRevelation: revelationId }
  }
  return resolvePackRevelationPick({ ...run, revelations: [...run.revelations, revelationId] }, revelationId)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackRevelationSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'revelationSelect' || run.pendingNewRevelation === null) return run
  const newId = run.pendingNewRevelation
  if (target.kind === 'revelation') {
    const idx = run.revelations.indexOf(target.id)
    const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1), newId]
    return resolvePackRevelationPick({ ...run, revelations, pendingNewRevelation: null }, newId)
  }
  const idx = run.oracles.indexOf(target.id)
  const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return resolvePackRevelationPick({ ...run, oracles, revelations: [...run.revelations, newId], pendingNewRevelation: null }, newId)
}

export function cancelPackRevelationSwap(run: RunState): RunState {
  if (run.phase !== 'revelationSelect') return run
  return { ...run, pendingNewRevelation: null }
}

export function closePackRevelationSelect(run: RunState): RunState {
  if (run.phase !== 'revelationSelect') return run
  return { ...run, phase: 'shop', revelationOffer: [], pendingNewRevelation: null, offerPickRemaining: 0 }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "天啓"`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 天啓福袋の中身選択(即使う/温存/スワップ)を実装"
```

---

### Task 14: engine.ts — 神託福袋の中身選択(pickPackOracle系)・useOracle・pickOracleFromOffer/skipOracleSelectの置き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1196-1217`
- Modify: `src/lib/game/shidasu/engine.test.ts:3079-3138`(`神託選択フェーズ`ブロック)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('神託選択フェーズ', ...)`ブロック(3079-3138行目)を、以下の内容に全面的に置き換える:

```ts
describe('神託の福袋(oracleSelect)', () => {
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

  test('buyPackでoracleSelectへ遷移し候補が提示される', () => {
    const run = shopRunWithOraclePack()
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('oracleSelect')
    expect(result.oracleOffer).toHaveLength(3)
  })

  test('pickPackOracleUseで即使うと役レベルが+1され、run/wave両方に反映される', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const before = opened.oracleLevels[role]
    const result = pickPackOracleUse(opened, role)
    expect(result.oracleLevels[role]).toBe(before + 1)
    expect(result.wave!.oracleLevels[role]).toBe(before + 1)
    expect(result.oracles).toEqual([])
    expect(result.phase).toBe('shop')
  })

  test('pickPackOracleHoldで温存すると所持に追加される', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const result = pickPackOracleHold(opened, role)
    expect(result.oracles).toEqual([role])
  })

  test('温存時、天啓・神託合算上限2到達時はpendingNewOracleにセットされスワップ待ちになる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer.includes('stair') ? 'stair' : opened.oracleOffer[0]
    const result = pickPackOracleHold(opened, role)
    expect(result.pendingNewOracle).toBe(role)
  })

  test('confirmPackOracleSwapで所持中の神託・天啓いずれとも入れ替えできる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const role = opened.oracleOffer[0]
    const picked = pickPackOracleHold(opened, role)
    const confirmed = confirmPackOracleSwap(picked, { kind: 'revelation', id: 'kaku' })
    expect(confirmed.oracles).toEqual(['flush', role])
    expect(confirmed.revelations).toEqual([])
    expect(confirmed.pendingNewOracle).toBeNull()
  })

  test('cancelPackOracleSwapでpendingNewOracleがクリアされる', () => {
    const run = shopRunWithOraclePack({ revelations: ['kaku'], oracles: ['flush'] })
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const picked = pickPackOracleHold(opened, opened.oracleOffer[0])
    const cancelled = cancelPackOracleSwap(picked)
    expect(cancelled.pendingNewOracle).toBeNull()
  })

  test('closePackOracleSelectで残り選択を放棄してshopへ戻る', () => {
    const run = shopRunWithOraclePack()
    const opened = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    const closed = closePackOracleSelect(opened)
    expect(closed.phase).toBe('shop')
    expect(closed.oracleOffer).toEqual([])
  })
})

describe('useOracle(所持神託の消費、playingフェーズ限定)', () => {
  test('playingフェーズで使用でき、役レベルが+1されrun/wave両方に反映される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, oracles: ['flush'] }
    const before = run.oracleLevels.flush
    const result = useOracle(run, 'flush')
    expect(result.oracleLevels.flush).toBe(before + 1)
    expect(result.wave!.oracleLevels.flush).toBe(before + 1)
    expect(result.oracles).toEqual([])
  })

  test('所持していない神託は使用できない', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, oracles: [] }
    expect(useOracle(run, 'flush')).toBe(run)
  })

  test('shopフェーズでは使用できない(spec §6の通りplayingフェーズ限定)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, oracles: ['flush'] }
    expect(useOracle(run, 'flush')).toBe(run)
  })
})
```

必要なimportを追加する: `pickPackOracleUse, pickPackOracleHold, confirmPackOracleSwap, cancelPackOracleSwap, closePackOracleSelect, useOracle`(engine.tsから)。`pickOracleFromOffer`/`skipOracleSelect`のimportは削除する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "神託"`
Expected: FAIL (関数が存在しない)

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`から、現在の`pickOracleFromOffer`・`skipOracleSelect`(1205-1217行目)を削除する。

`closePackRevelationSelect`の直後に神託福袋の中身選択関数群と`useOracle`を追加する:

```ts
function resolvePackOraclePick(run: RunState, pickedRole: RoleName): RunState {
  const idx = run.oracleOffer.indexOf(pickedRole)
  const oracleOffer = idx === -1 ? run.oracleOffer : [...run.oracleOffer.slice(0, idx), ...run.oracleOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', oracleOffer: [], pendingNewOracle: null, offerPickRemaining: 0 }
  }
  return { ...run, oracleOffer, pendingNewOracle: null, offerPickRemaining }
}

// 神託の福袋(oracleSelect)から1つ選び、その場で使用する(役レベル+1、所持には加わらない、上限とは無関係)。
// run.oracleLevelsだけでなくwave.oracleLevelsも同期する(pickOracleFromOfferと同じ理由。得点計算時に
// wave.oracleLevelsが参照されるため、同期を怠ると効果が次のウェーブまで反映されない不整合が起きる)。
export function pickPackOracleUse(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return resolvePackOraclePick({ ...run, oracleLevels, wave }, roleName)
}

// 神託の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限2到達時はpendingNewOracleにセットしスワップ待ちにする。
export function pickPackOracleHold(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  if (run.revelations.length + run.oracles.length >= 2) {
    return { ...run, pendingNewOracle: roleName }
  }
  return resolvePackOraclePick({ ...run, oracles: [...run.oracles, roleName] }, roleName)
}

export function confirmPackOracleSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'oracleSelect' || run.pendingNewOracle === null) return run
  const newRole = run.pendingNewOracle
  if (target.kind === 'oracle') {
    const idx = run.oracles.indexOf(target.id)
    const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1), newRole]
    return resolvePackOraclePick({ ...run, oracles, pendingNewOracle: null }, newRole)
  }
  const idx = run.revelations.indexOf(target.id)
  const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return resolvePackOraclePick({ ...run, revelations, oracles: [...run.oracles, newRole], pendingNewOracle: null }, newRole)
}

export function cancelPackOracleSwap(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, pendingNewOracle: null }
}

export function closePackOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, phase: 'shop', oracleOffer: [], pendingNewOracle: null, offerPickRemaining: 0 }
}

// 所持中の神託を1つ消費する。playingフェーズでのみ呼べる(spec §6の通り、ショップ内フェーズでは呼べない)。
// pickOracleFromOfferと同じ理由でrun/wave両方のoracleLevelsを同期する。盤面への直接効果は無い。
export function useOracle(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return { ...run, oracles, oracleLevels, wave }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "神託"`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 神託福袋の中身選択とuseOracleを実装"
```

---

### Task 15: engine.ts — useRiteのガード拡張・sell*関数・全体の型チェック

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1055-1063`(`useRite`)
- Modify: `src/lib/game/shidasu/engine.test.ts:2571-2600`(`useRite`ブロック)、`2332`付近に売却テスト新設

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('useRite', ...)`ブロック(2571-2600行目)の末尾に以下を追加する:

```ts
  test('shopフェーズでも使用できる(SHOP_FLOW_PHASESに含まれるため)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'shop', wave, rites: ['raidho'] }
    const result = useRite(DEFAULT_PARAMS, run, 'raidho', createRng(1))
    expect(result.rites).toEqual([])
  })

  test('riteSelectフェーズでも使用できる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave
    const run: RunState = { ...createInitialRun(), phase: 'riteSelect', wave, rites: ['raidho'] }
    const result = useRite(DEFAULT_PARAMS, run, 'raidho', createRng(1))
    expect(result.rites).toEqual([])
  })
```

同ファイルに新規ブロックとして以下を追加する(`describe('useRite', ...)`ブロックの直後が適切):

```ts
describe('sellItem / sellRite / sellRevelation / sellOracle(所持品売却)', () => {
  test('sellItemは所持から削除し、売却額分だけ通貨が増える(playing/shopどちらでも可)', () => {
    const itemId = ITEM_POOL.find(id => DEFAULT_PARAMS.talismans[id].rarity === 'U')!
    const playingRun: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, items: [itemId] }
    const result = sellItem(DEFAULT_PARAMS, playingRun, itemId)
    expect(result.items).toEqual([])
    expect(result.currency).toBe(10 + itemSellPrice(DEFAULT_PARAMS, itemId))

    const shopRun: RunState = { ...createInitialRun(), phase: 'shop', currency: 10, items: [itemId] }
    expect(sellItem(DEFAULT_PARAMS, shopRun, itemId).items).toEqual([])
  })

  test('所持していないアイテムは売却できない', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, items: [] }
    expect(sellItem(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
  })

  test('sellRiteは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, rites: ['raidho'] }
    const result = sellRite(DEFAULT_PARAMS, run, 'raidho')
    expect(result.rites).toEqual([])
    expect(result.currency).toBe(10 + riteSellPrice(DEFAULT_PARAMS))
  })

  test('sellRevelationは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, revelations: ['kaku'] }
    const result = sellRevelation(DEFAULT_PARAMS, run, 'kaku')
    expect(result.revelations).toEqual([])
    expect(result.currency).toBe(10 + revelationSellPrice(DEFAULT_PARAMS))
  })

  test('sellOracleは所持から削除し通貨が増える', () => {
    const run: RunState = { ...createInitialRun(), phase: 'playing', currency: 10, oracles: ['flush'] }
    const result = sellOracle(DEFAULT_PARAMS, run, 'flush')
    expect(result.oracles).toEqual([])
    expect(result.currency).toBe(10 + oracleSellPrice(DEFAULT_PARAMS))
  })

  test('playing/shop以外のフェーズでは売却できない', () => {
    const run: RunState = { ...createInitialRun(), phase: 'itemSelect', currency: 10, items: ['bridge'] }
    expect(sellItem(DEFAULT_PARAMS, run, 'bridge')).toBe(run)
  })
})
```

必要なimportを追加する: `sellItem, sellRite, sellRevelation, sellOracle`(engine.tsから)、`itemSellPrice, riteSellPrice, revelationSellPrice, oracleSellPrice`(shop.tsから)。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "useRite|sellItem"`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/lib/game/shidasu/engine.ts`の現在の`useRite`(1055-1063行目):

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && run.phase !== 'revelationSelect') || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const wave = applyRiteEffect(params, run.wave, riteId, rand)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}
```

を以下に置き換える:

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const wave = applyRiteEffect(params, run.wave, riteId, rand)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, wave, rites }
}
```

`useOracle`の直後に売却関数群を追加する:

```ts
export function sellItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.items.indexOf(itemId)
  if (idx === -1) return run
  const items = [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  return { ...run, items, currency: run.currency + itemSellPrice(params, itemId) }
}

export function sellRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  return { ...run, rites, currency: run.currency + riteSellPrice(params) }
}

export function sellRevelation(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return { ...run, revelations, currency: run.currency + revelationSellPrice(params) }
}

export function sellOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return { ...run, oracles, currency: run.currency + oracleSellPrice(params) }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts -t "useRite|sellItem"`
Expected: PASS

- [ ] **Step 5: engine.test.ts全体を実行**

Run: `npm run test -- src/lib/game/shidasu/engine.test.ts`
Expected: PASS(全テストグリーン。Task 9〜15で置き換え漏れがあれば、失敗しているテスト名を手がかりに該当箇所を修正する)

- [ ] **Step 6: 型チェックを実行**

Run: `npm run check`
Expected: `engine.ts`/`engine.test.ts`起因のエラーが無いこと。`+page.svelte`起因のエラー(旧関数参照)はTask 16で解消するためこの時点では許容する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: useRiteのフェーズガード拡張と所持品売却関数を実装"
```

---

### Task 16: +page.svelte(ゲーム画面) — import更新とハンドラの置き換え

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

このタスクはスクリプト部分(ロジック)のみを対象とする。テンプレート(UI)はTask 17・18で扱う。

- [ ] **Step 1: import文を更新**

`src/routes/game/shidasu/+page.svelte`先頭の`$lib/game/shidasu/engine`からのimport文を確認し、以下のシンボル構成に更新する。削除するシンボル: `pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect, pickOracleFromOffer, skipOracleSelect`。追加するシンボル: `enterShop`は`resolveWaveEnd`/`continueAfterGreatMisfortune`内部から呼ばれるため直接import不要、`finishShop, buyIndividualItem, buyIndividualRite, buyIndividualRevelationUse, buyIndividualRevelationHold, buyIndividualOracleUse, buyIndividualOracleHold, buyPack, pickPackItem, confirmPackItemSwap, cancelPackItemSwap, closePackItemSelect, pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect, pickPackRevelationUse, pickPackRevelationHold, confirmPackRevelationSwap, cancelPackRevelationSwap, closePackRevelationSelect, pickPackOracleUse, pickPackOracleHold, confirmPackOracleSwap, cancelPackOracleSwap, closePackOracleSelect, useOracle, sellItem, sellRite, sellRevelation, sellOracle`。既存の`createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck, resolveWaveEnd, continueAfterGreatMisfortune, stopAfterGreatMisfortune, startWave, forceStockTop, useRite, useRevelation, waveTarget, stageModifierFor, isBossWave`は維持する。

`$lib/game/shidasu/shop`から以下をimportする:

```ts
import { itemBuyPrice, itemSellPrice, riteBuyPrice, riteSellPrice, revelationBuyPrice, revelationSellPrice, oracleBuyPrice, oracleSellPrice, packPrice } from '$lib/game/shidasu/shop'
```

`$lib/game/shidasu/types`から`HeldRevelationOrOracleRef`を型importに追加する。

- [ ] **Step 2: 旧ハンドラを置き換える**

現在の`handlePickItem, handleSkipItem, handleConfirmSwap, handleCancelSwap`(itemSelect用)、`handleRevelationOfferUse/handleUseRevelationClick`の元になっている`revelationHandlerFor`ファクトリのうち`source: 'offer'`側、`handleRevelationOfferAcquire, handleSkipRevelationSelect`、`handlePickOracle, handleSkipOracleSelect`を、以下のショップ向けハンドラ群に置き換える。既存の`pendingRevelationTarget`状態と`handleTargetColumn`/`canTargetRevelationColumn`/`handleCancelRevelationTarget`の列選択の仕組みは、天啓の即使う(バラ売り・福袋いずれも)で引き続き使うため、対象となる購入・選択関数の呼び出し元だけをそれぞれ差し替える形にする:

```ts
function handleFinishShop() {
  run = finishShop(params, run, generateSeed())
}

function handleBuyIndividualItem(slotIndex: number) {
  run = buyIndividualItem(params, run, slotIndex)
}

function handleBuyIndividualRite(slotIndex: number) {
  run = buyIndividualRite(params, run, slotIndex)
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

function handleBuyPack(slotIndex: number) {
  run = buyPack(params, run, slotIndex)
}

function handlePickPackItem(itemId: ItemId) {
  run = pickPackItem(params, run, itemId)
}
function handleConfirmPackItemSwap(oldItemId: ItemId) {
  run = confirmPackItemSwap(run, oldItemId)
}
function handleCancelPackItemSwap() {
  run = cancelPackItemSwap(run)
}
function handleClosePackItemSelect() {
  run = closePackItemSelect(run)
}

function handlePickPackRite(riteId: RiteId) {
  run = pickPackRite(run, riteId)
}
function handleConfirmPackRiteSwap(oldRiteId: RiteId) {
  run = confirmPackRiteSwap(run, oldRiteId)
}
function handleCancelPackRiteSwap() {
  run = cancelPackRiteSwap(run)
}
function handleClosePackRiteSelect() {
  run = closePackRiteSelect(run)
}

function handlePickPackRevelationHold(revelationId: RevelationId) {
  run = pickPackRevelationHold(run, revelationId)
}
function handleConfirmPackRevelationSwap(target: HeldRevelationOrOracleRef) {
  run = confirmPackRevelationSwap(run, target)
}
function handleCancelPackRevelationSwap() {
  run = cancelPackRevelationSwap(run)
}
function handleClosePackRevelationSelect() {
  run = closePackRevelationSelect(run)
}

function handlePickPackOracleUse(roleName: RoleName) {
  run = pickPackOracleUse(run, roleName)
}
function handlePickPackOracleHold(roleName: RoleName) {
  run = pickPackOracleHold(run, roleName)
}
function handleConfirmPackOracleSwap(target: HeldRevelationOrOracleRef) {
  run = confirmPackOracleSwap(run, target)
}
function handleCancelPackOracleSwap() {
  run = cancelPackOracleSwap(run)
}
function handleClosePackOracleSelect() {
  run = closePackOracleSelect(run)
}

function handleUseOracle(roleName: RoleName) {
  run = useOracle(run, roleName)
}

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

天啓の「即使う」(バラ売り・福袋共通)は、既存の`revelationHandlerFor`ファクトリの仕組みを流用し、バラ売り用に`buyIndividualRevelationUse(params, run, slotIndex, targetCol, rand)`を、福袋用に`pickPackRevelationUse(params, run, revelationId, targetCol, rand)`を呼ぶ2つの実体を用意する形で実装する(既存の`pendingRevelationTarget`のsource概念を`'individual' | 'pack'`に拡張し、`handleTargetColumn`が確定時にどちらを呼ぶか分岐する)。

- [ ] **Step 3: 開発サーバーでコンパイルエラーが無いことを確認**

Run: `npm run check`
Expected: `+page.svelte`のスクリプト部分に起因する型エラーが解消していること(テンプレート側で旧ハンドラを参照している箇所は、Task 17・18でテンプレートを更新するまでエラーが残る可能性があるため、この時点ではスクリプトブロック内の未使用import・未定義関数エラーが無いことを確認する程度でよい)。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ゲーム画面のスクリプトをショップ用ハンドラに更新"
```

---

### Task 17: +page.svelte(ゲーム画面) — ショップ画面・秘儀福袋画面のテンプレート追加

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: ショップ画面(shop)のオーバーレイを追加**

既存の`{#if run.phase === 'itemSelect'}...{:else if run.phase === 'oracleSelect'}...{/if}`ブロックの直前に、`shop`フェーズ用の分岐を追加する。既存の`fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6`のオーバーレイパターンを踏襲し、以下の内容を実装する:

```svelte
{#if run.phase === 'shop' && run.shop}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-800">ショップ</h2>
        <p class="text-sm text-teal-700 font-semibold">{params.currency.symbol}{run.currency}</p>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">バラ売り</p>
        <div class="grid grid-cols-3 gap-2">
          {#each run.shop.individual as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold">{slot.kind}: {slot.id}</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else if slot.kind === 'item'}
                <button onclick={() => handleBuyIndividualItem(i)} disabled={run.items.length >= params.items.maxItems || run.currency < itemBuyPrice(params, slot.id)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({itemBuyPrice(params, slot.id)})
                </button>
              {:else if slot.kind === 'rite'}
                <button onclick={() => handleBuyIndividualRite(i)} disabled={run.rites.length >= 3 || run.currency < riteBuyPrice(params)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({riteBuyPrice(params)})
                </button>
              {:else if slot.kind === 'revelation'}
                <button onclick={() => handleStartIndividualRevelationTarget(i)} disabled={run.currency < revelationBuyPrice(params)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  即使う({revelationBuyPrice(params)})
                </button>
                <button onclick={() => handleBuyIndividualRevelationHold(i)} disabled={run.revelations.length + run.oracles.length >= 2 || run.currency < revelationBuyPrice(params)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  温存({revelationBuyPrice(params)})
                </button>
              {:else if slot.kind === 'oracle'}
                <button onclick={() => handleBuyIndividualOracleUse(i)} disabled={run.currency < oracleBuyPrice(params)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  即使う({oracleBuyPrice(params)})
                </button>
                <button onclick={() => handleBuyIndividualOracleHold(i)} disabled={run.revelations.length + run.oracles.length >= 2 || run.currency < oracleBuyPrice(params)} class="w-full px-2 py-1 rounded bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  温存({oracleBuyPrice(params)})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">福袋</p>
        <div class="grid grid-cols-2 gap-2">
          {#each run.shop.packs as slot, i}
            <div class="border border-slate-200 rounded-lg p-2 text-xs space-y-1">
              <p class="font-semibold">{slot.packKind} {slot.offerCount}択{slot.pickCount}</p>
              {#if slot.sold}
                <p class="text-slate-400">売り切れ</p>
              {:else}
                <button onclick={() => handleBuyPack(i)} disabled={run.currency < packPrice(params, slot.packKind, slot.offerCount)} class="w-full px-2 py-1 rounded bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  購入({packPrice(params, slot.packKind, slot.offerCount)})
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId}
            <button onclick={() => handleSellItem(itemId)} class="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{itemId} 売({itemSellPrice(params, itemId)})</button>
          {/each}
          {#each run.rites as riteId}
            <button onclick={() => handleSellRite(riteId)} class="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteId} 売({riteSellPrice(params)})</button>
          {/each}
          {#each run.revelations as revelationId}
            <button onclick={() => handleSellRevelation(revelationId)} class="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationId} 売({revelationSellPrice(params)})</button>
          {/each}
          {#each run.oracles as roleName}
            <button onclick={() => handleSellOracle(roleName)} class="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{roleName} 売({oracleSellPrice(params)})</button>
          {/each}
        </div>
      </div>

      <button onclick={handleFinishShop} class="w-full px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold">次のWaveへ</button>
    </div>
  </div>
{:else if run.phase === 'riteSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">秘儀を選択(選択済み {run.offerPickRemaining > 0 ? (run.riteOffer.length > 0 ? '' : '') : ''}残り{run.offerPickRemaining}個)</h2>
      {#if run.pendingNewRite}
        <p class="text-sm text-slate-600">所持枠が満杯です。入れ替える秘儀を選んでください。</p>
        <div class="space-y-1">
          {#each run.rites as riteId}
            <button onclick={() => handleConfirmPackRiteSwap(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleCancelPackRiteSwap} class="text-xs text-slate-500 underline">キャンセル</button>
      {:else}
        <div class="space-y-1">
          {#each run.riteOffer as riteId}
            <button onclick={() => handlePickPackRite(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleClosePackRiteSelect} class="text-xs text-slate-500 underline">選択を終える</button>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 2: 既存itemSelect/revelationSelect/oracleSelect画面を福袋向けに更新**

既存の`itemSelect`オーバーレイに「選択済み数/必要数」表示(`offerPickRemaining`を使う)と、7-2パターンで1個選んでも閉じない挙動(既に`pickPackItem`側で担保済みなのでUI側はループ表示のままでよい)、スワップ待ち(`pendingNewItem`)時の入れ替え候補一覧+`handleConfirmPackItemSwap`/`handleCancelPackItemSwap`呼び出し、`handleClosePackItemSelect`による中断ボタンを追加する(既存の`pendingNewItem`条件分岐パターンを流用)。`revelationSelect`・`oracleSelect`のオーバーレイも同様に、即使う/温存の2択ボタンと、`pendingNewRevelation`/`pendingNewOracle`によるスワップ待ち表示(スワップ対象は`run.revelations`と`run.oracles`を合わせて一覧表示し、選択時に`{kind:'revelation',id}`または`{kind:'oracle',id}`を渡す)を追加する。

- [ ] **Step 3: プレイ中画面に神託・天啓の所持枠表示と売却ボタンを追加**

既存の`itemBadges`スニペット付近に、`run.revelations`・`run.oracles`(合算枠、上限2)を表示するチップ一覧と、それぞれに対応する`handleSellRevelation`/`handleSellOracle`ボタン、神託については`handleUseOracle`ボタンを追加する。

- [ ] **Step 4: 開発サーバーで手動確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:
- ラン開始→Waveクリア→ショップ画面が表示される
- バラ売りの護符・秘儀を購入できる(所持数上限で購入ボタンが無効化される)
- 天啓・神託のバラ売りは即使う/温存を選べ、温存は上限無視できない(上限で無効化)が即使うは常に押せる
- 福袋を購入すると対応する中身選択画面に遷移し、選択完了でショップに戻る
- 所持品売却ボタンで通貨が増える
- 「次のWaveへ」でプレイ画面に戻る

問題があれば修正してから次のタスクへ進む。

- [ ] **Step 5: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: ショップ画面・秘儀福袋画面のUIを追加"
```

---

### Task 18: admin/shidasu-currency/+page.svelte — ショップ価格設定フォームの追加

**Files:**
- Modify: `src/routes/admin/shidasu-currency/+page.svelte`

- [ ] **Step 1: バリデーションを拡張**

`hasValidationError`の`$derived.by`内、既存の`bossBonus.taikyou`チェックの直後に以下を追加する:

```ts
    if (!Number.isFinite(config.shop.itemPrice.C.buy) || config.shop.itemPrice.C.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.C.sell) || config.shop.itemPrice.C.sell < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.U.buy) || config.shop.itemPrice.U.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.U.sell) || config.shop.itemPrice.U.sell < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.R.buy) || config.shop.itemPrice.R.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.R.sell) || config.shop.itemPrice.R.sell < 0) return true
    if (!Number.isFinite(config.shop.ritePrice.buy) || config.shop.ritePrice.buy < 0) return true
    if (!Number.isFinite(config.shop.ritePrice.sell) || config.shop.ritePrice.sell < 0) return true
    if (!Number.isFinite(config.shop.revelationPrice.buy) || config.shop.revelationPrice.buy < 0) return true
    if (!Number.isFinite(config.shop.revelationPrice.sell) || config.shop.revelationPrice.sell < 0) return true
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
```

- [ ] **Step 2: フォームセクションを追加**

既存の`<section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">`ブロックの直後(`</section>`の後)に、以下の新規セクションを追加する:

```svelte
    <section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h2 class="text-sm font-bold text-slate-700">ショップ価格設定</h2>

      <div>
        <p class="text-xs text-slate-500 mb-1">護符バラ売り(レアリティ別)</p>
        <div class="grid grid-cols-3 gap-3">
          <label class="text-xs text-slate-500">
            C 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.C.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            U 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.U.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            R 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.R.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            C 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.C.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            U 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.U.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            R 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.R.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">秘儀・天啓・神託バラ売り</p>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            秘儀 購入額
            <input type="number" step="1" bind:value={config.shop.ritePrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 売却額
            <input type="number" step="1" bind:value={config.shop.ritePrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 購入額
            <input type="number" step="1" bind:value={config.shop.revelationPrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 売却額
            <input type="number" step="1" bind:value={config.shop.revelationPrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 購入額
            <input type="number" step="1" bind:value={config.shop.oraclePrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 売却額
            <input type="number" step="1" bind:value={config.shop.oraclePrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">福袋価格(護符・秘儀・天啓は3-1/5-1/7-2、神託は3-1/5-1のみ)</p>
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
        </div>
      </div>
    </section>
```

- [ ] **Step 3: 開発サーバーで動作確認**

Run: `npm run dev`

`http://localhost:5173/admin/shidasu-currency` を開き、新規フォームが表示・編集・保存できることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: 管理画面にショップ価格設定フォームを追加"
```

---

### Task 19: 最終検証・ドキュメント確認・仕上げ

**Files:** なし(検証のみ)。`docs/ads.md`は広告関連の変更が無いため更新不要。

- [ ] **Step 1: 全テストを実行**

Run: `npm run test`
Expected: 全テストPASS

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: エラー0件

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 開発サーバーでの最終手動確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` で以下のシナリオを一通り確認する:
- 通常Wave(小凶・中凶)クリア→ショップ→バラ売り購入(護符・秘儀・天啓即使う・神託温存)→福袋購入(各種)→「次のWaveへ」で正常にプレイ再開
- 護符5枠所持済みの状態でバラ売り護符購入ボタンが無効化されている
- 天啓・神託合算枠2所持済みの状態でバラ売り温存ボタンが無効化されているが「即使う」は押せる
- 福袋の獲得対象が上限到達時にスワップ画面が表示され、入れ替えが機能する
- 大凶ボスWaveクリア→continueChoice→続行→ショップへ正しく遷移する
- プレイ中画面の所持品売却ボタンで通貨が増える

問題があれば修正しコミットする。

- [ ] **Step 5: 最終コミット(残作業があれば)**

```bash
git status
```

未コミットの変更が残っていれば、内容に応じたメッセージで個別にコミットする。

---

## Self-Review 結果

- **spec網羅性**: §1(全体フロー)→Task 9(enterShop/finishShop)、§2(型定義)→Task 1、§3(抽選ロジック)→Task 2〜5・Task 7、§4(価格表)→Task 6、§5(所持枠・上限・スワップUI)→Task 10(バラ売りブロック)・Task 11〜14(福袋スワップ)、§6(神託所持化)→Task 14(useOracle)、§7(フェーズ遷移)→Task 9・Task 13、§8(購入・売却ロジック)→Task 10〜15、§9(管理画面)→Task 18、§10(UI/画面構成)→Task 17、§11(テスト方針、9項目)→Task 9(shop遷移・枠確定)、Task 10(バラ売り購入・上限ブロック)、Task 14(神託上限無関係+即使う/温存分岐)、Task 11〜14(福袋購入→選択画面→shopに戻る)、Task 10(天啓神託合算枠上限)、Task 15(売却)、Task 9(次のWaveへでplaying遷移)、Task 12(秘儀自動抽選が発生しないこと)。すべて対応済み。
- **プレースホルダースキャン**: 「TBD」「後で実装」等の記述なし。全コードブロックは完全な実装として記述済み。
- **型整合性**: `ShopIndividualSlot.id`/`ShopPackSlot`(Task 1)→`shop.ts`の`rollShop`(Task 7)→`engine.ts`の`buyIndividual*`/`buyPack`(Task 10〜11)で一貫して同じフィールド名(`kind`/`id`/`sold`、`packKind`/`offerCount`/`pickCount`/`sold`)を使用。`HeldRevelationOrOracleRef`(Task 1)は`confirmPackRevelationSwap`/`confirmPackOracleSwap`(Task 13・14)で一貫して使用。`SHOP_FLOW_PHASES`(Task 9で定義)は`useRite`(Task 15)・`useRevelation`(Task 13)で共通利用。
