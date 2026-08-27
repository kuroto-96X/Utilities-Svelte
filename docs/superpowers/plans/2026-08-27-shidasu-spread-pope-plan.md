# 新規スプレッド「教皇」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「神託の初期レベルをLにし、ショップで神託が販売されない」という固有ルールを持つ新規スプレッド「教皇」(`pope`)を実装する。

**Architecture:** `ShidasuParams.spreads`の型を固定2キー(`fool`/`moon`)のオブジェクト型から`Record<SpreadId, SpreadConfig>`にリファクタし、`initialOracleLevel`(神託の初期レベル)・`bannedShopKinds`(ショップで販売しない種別)という2つの汎用フィールドを新設する。`beginRun`が`initialOracleLevel`をラン開始時の`oracleLevels`に反映し、`shop.ts`の抽選関数群が`bannedShopKinds`を参照してバラ売り枠・福袋カタログの両方から対象種別を除外する。最後に新規スプレッド「教皇」(`pope`、`initialOracleLevel: 5`、`bannedShopKinds: ['oracle']`)を追加する。

**Tech Stack:** TypeScript, Vitest, SvelteKit (`src/lib/game/shidasu/`配下の純粋関数群の変更、`src/routes/game/shidasu/+page.svelte`への1行追加)

---

## 前提知識(既存コードの構造)

- `ShidasuParams.spreads`の現在の型定義(`src/lib/game/shidasu/params.ts:51-54`):
  ```ts
  spreads: {
    fool: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
    moon: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
  }
  ```
- `DEFAULT_PARAMS.spreads`の現在の値(`params.ts:343-346`):
  ```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
  },
  ```
- `SpreadId`型(`src/lib/game/shidasu/types.ts:26`): `export type SpreadId = 'fool' | 'moon'`
- `ShopSlotKind`型(`types.ts:332`): `export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'`
- `RunState.oracleLevels: Record<RoleName, number>`(全10役の現在レベル、初期値1・上限なし)。`defaultOracleLevels()`(`src/lib/game/shidasu/oracles.ts`)が全役1で初期化する。
- `beginRun`関数(`engine.ts:1020-1032`)の現在のコード:
  ```ts
  export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
    const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
    const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
    const initialStageStars = rollStageStars(params, rand)
    return {
      ...createInitialRun(),
      phase: 'shop',
      extraTableauRows: initialExtraTableauRows,
      spreadId,
      stageStars: initialStageStars,
      currency: params.currency.initialAmount,
    }
  }
  ```
- `shop.ts`の`SHOP_SLOT_KINDS`(`shop.ts:11`): `const SHOP_SLOT_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle']`(バラ売り枠の抽選対象種別、`cardSet`は含まない=福袋専用)。
- `rollIndividualSlot`関数(`shop.ts:23-35`)は現在`(run: RunState, usedItemIds: Set<ItemId>, rand: () => number)`というシグネチャで`params`を受け取っていない。`bannedShopKinds`の参照に`params`が必要になるため、シグネチャ変更が必要。
- `rollPackSlots`関数(`shop.ts:40-46`)は既に`params`を受け取っている。
- `rollShop`関数(`shop.ts:58-63`)が両方の呼び出し元。
- `+page.svelte`の`SPREAD_IDS`(`src/routes/game/shidasu/+page.svelte:231`): `const SPREAD_IDS: SpreadId[] = ['fool', 'moon']`。UIは`ITEM_GROUPS`と同様、この配列を`{#each}`でループして自動描画する(`+page.svelte:783-791`)。
- `desc`フィールドはプレースホルダー展開の仕組みを持たない(`+page.svelte:789`で`{params.spreads[spreadId].desc}`をそのまま表示するのみ)。数値は文言に直接書く。
- 既存テストパターン: `engine.test.ts:2481-2495`に`beginRun`のfool/moonスプレッドテスト、`params.test.ts:34-42`に`DEFAULT_PARAMS.spreads`の値検証テストがある。

---

## Task 1: ShidasuParams.spreadsをRecord型にリファクタ、initialOracleLevel/bannedShopKindsを追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts` (`SpreadId`型の直後に`SpreadConfig`型を新設)
- Modify: `src/lib/game/shidasu/params.ts` (`spreads`型定義・`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/params.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`params.test.ts`に追記(既存の「月の目標スコア基礎値・倍率は愚者と全く同じ」テストの隣に配置):

```ts
  test('fool/moonのinitialOracleLevelは1、bannedShopKindsは空配列', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialOracleLevel).toBe(1)
    expect(DEFAULT_PARAMS.spreads.fool.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.moon.initialOracleLevel).toBe(1)
    expect(DEFAULT_PARAMS.spreads.moon.bannedShopKinds).toEqual([])
  })
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- params.test.ts`
Expected: FAIL(`initialOracleLevel`・`bannedShopKinds`が`undefined`)

- [ ] **Step 3: types.tsに`SpreadConfig`型を新設**

`types.ts`の`SpreadId`型定義(`export type SpreadId = 'fool' | 'moon'`)の直後に追加:

```ts
// スプレッドごとの固有ルール設定。
export interface SpreadConfig {
  name: string
  desc: string
  // ウェーブ開始時の配布行数への初期オフセット(既存)。
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  // 神託(oracle)の初期レベル。ラン開始時、全10役一律にこの値でoracleLevelsを初期化する(既定1)。
  initialOracleLevel: number
  // ショップのバラ売り枠・福袋カタログの両方から除外する種別(既定は空配列=制限なし)。
  bannedShopKinds: ShopSlotKind[]
}
```

`ShopSlotKind`型は同じ`types.ts`内(332行目付近)に既に定義されているため、追加のimportは不要。

- [ ] **Step 4: params.tsのspreads型定義をRecordに変更**

`params.ts`の`spreads`型定義(`spreads: { fool: {...}; moon: {...} }`という箇所)を以下に変更:

```ts
  spreads: Record<SpreadId, SpreadConfig>
```

`params.ts`のimport文に`SpreadConfig`を追加する(`SpreadId`は既にimport済みのはずなので、その並びに追加)。

- [ ] **Step 5: DEFAULT_PARAMS.spreadsに新規フィールドを追加**

`params.ts`の`DEFAULT_PARAMS.spreads`を以下に変更:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
  },
```

- [ ] **Step 6: shidasu.config.jsonに同内容を追加**

`shidasu.config.json`の`spreads`セクション(`fool`・`moon`のエントリ)に、Step 5と同じ`initialOracleLevel`・`bannedShopKinds`フィールドを追加する。

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- params.test.ts`
Expected: PASS

- [ ] **Step 8: ビルド・型チェック**

Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts
git commit -m "feat: spreadsをRecord型にリファクタし、initialOracleLevel/bannedShopKindsを追加"
```

---

## Task 2: beginRunでinitialOracleLevelを反映

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (`beginRun`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記(既存の「spreadId=moonを指定すると、finishShop後の場札は...」テストの直後に配置。`RoleName`のimportが無ければ追加は不要、`Object.values`でループする):

```ts
  test('spreadIdを省略(fool)すると、oracleLevelsは全役1のまま', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    Object.values(run.oracleLevels).forEach(level => expect(level).toBe(1))
  })
```

これはfoolの既存挙動を保護する回帰テスト。Task 3で「教皇」を追加した後に使う本命テストは以下(Task 4のStep 1でも同じ内容を再掲するが、ここではTask 2の対象である`beginRun`のロジック自体を、まだ存在しないスプレッドIDでは書けないため、Task 2の時点では`initialOracleLevel`を直接いじった`params`オブジェクトで検証する):

```ts
  test('spreadのinitialOracleLevelがoracleLevelsの全役に反映される', () => {
    const customParams = {
      ...DEFAULT_PARAMS,
      spreads: {
        ...DEFAULT_PARAMS.spreads,
        fool: { ...DEFAULT_PARAMS.spreads.fool, initialOracleLevel: 3 },
      },
    }
    const run = beginRun(customParams, 1, 'fool')
    Object.values(run.oracleLevels).forEach(level => expect(level).toBe(3))
  })
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "oracleLevels"`
Expected: 1件目(fool省略時に全役1)はおそらく既に通る(現状の挙動と一致するため)。2件目(`initialOracleLevel`反映)はFAIL。

- [ ] **Step 3: beginRunにinitialOracleLevelの反映を追加**

`engine.ts`の`beginRun`関数を以下に変更:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = Object.fromEntries(
    Object.keys(defaultOracleLevels()).map(name => [name, spreadConfig.initialOracleLevel])
  ) as Record<RoleName, number>
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    oracleLevels,
  }
}
```

`defaultOracleLevels`は既に`engine.ts`内でimport済みのはず(`oracles.ts`から)。もしimportされていなければ、`engine.ts`先頭のimport文に`defaultOracleLevels`を追加すること(`oracles.ts`からexportされている関数)。`RoleName`型のimportも同様に確認する。

- [ ] **Step 4: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "oracleLevels"`
Expected: PASS(2件とも)

- [ ] **Step 5: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: beginRunでinitialOracleLevelをoracleLevelsに反映"
```

---

## Task 3: ショップ抽選でbannedShopKindsを反映

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts` (`rollIndividualSlot`, `rollPackSlots`, `rollShop`)
- Test: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`shop.test.ts`の`describe('rollShop', ...)`ブロック内に追記:

```ts
  test('bannedShopKindsにoracleが含まれるスプレッドでは、バラ売り枠・福袋の両方にoracle種別が出現しない', () => {
    const customParams = {
      ...DEFAULT_PARAMS,
      spreads: {
        ...DEFAULT_PARAMS.spreads,
        fool: { ...DEFAULT_PARAMS.spreads.fool, bannedShopKinds: ['oracle' as const] },
      },
      shop: {
        ...DEFAULT_PARAMS.shop,
        packCatalog: DEFAULT_PARAMS.shop.packCatalog, // 既存カタログには神託の福袋(packKind: 'oracle')が含まれる前提
      },
    }
    const run = { ...createInitialRun(), spreadId: 'fool' as const }
    for (let seed = 1; seed <= 30; seed++) {
      const shop = rollShop(customParams, run, createRng(seed))
      expect(shop.individual.some(s => s.kind === 'oracle')).toBe(false)
      expect(shop.packs.some(p => p.packKind === 'oracle')).toBe(false)
    }
  })

  test('bannedShopKindsが空配列のスプレッドでは、従来通りoracle種別が出現しうる', () => {
    const run = { ...createInitialRun(), spreadId: 'fool' as const }
    let oracleIndividualSeen = false
    let oraclePackSeen = false
    for (let seed = 1; seed <= 30; seed++) {
      const shop = rollShop(DEFAULT_PARAMS, run, createRng(seed))
      if (shop.individual.some(s => s.kind === 'oracle')) oracleIndividualSeen = true
      if (shop.packs.some(p => p.packKind === 'oracle')) oraclePackSeen = true
    }
    expect(oracleIndividualSeen).toBe(true)
    expect(oraclePackSeen).toBe(true)
  })
```

**確認済み:** 2つ目のテスト(「従来通り出現しうる」)は既存の`DEFAULT_PARAMS.shop.packCatalog`に`packKind: 'oracle'`のエントリ(「神託の福袋」、`params.ts`に2件、offerCount 3/price 22とofferCount 5/price 33)が実在することを前提にしている。プラン作成時点でこの前提は`params.ts`を実読して確認済み。

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- shop.test.ts -t "bannedShopKinds"`
Expected: 1件目(除外されるべきなのに出現する)はFAIL、2件目(現状維持)は既に通るはず。

- [ ] **Step 3: rollIndividualSlotにparams引数を追加し、bannedShopKindsを反映**

`shop.ts`の`rollIndividualSlot`関数を以下に変更:

```ts
function rollIndividualSlot(params: ShidasuParams, run: RunState, usedItemIds: Set<ItemId>, rand: () => number): ShopIndividualSlot {
  const bannedShopKinds = params.spreads[run.spreadId].bannedShopKinds
  const availableKinds = SHOP_SLOT_KINDS.filter(kind => !bannedShopKinds.includes(kind))
  const kind = availableKinds[Math.floor(rand() * availableKinds.length)]
  if (kind === 'item') {
    const available = ITEM_POOL.filter(id => !run.items.some(h => h.id === id) && !usedItemIds.has(id))
    const pool = available.length > 0 ? available : ITEM_POOL
    const id = pool[Math.floor(rand() * pool.length)]
    usedItemIds.add(id)
    return { kind, id, sold: false }
  }
  const pool = poolFor(kind)
  const id = pool[Math.floor(rand() * pool.length)]
  return { kind, id, sold: false }
}
```

**重要な注意点:** `bannedShopKinds`によって`availableKinds`が空配列になるケース(全種別が禁止された場合)は現状のスプレッド設計では起こらない想定だが、`availableKinds.length === 0`だと`Math.floor(rand() * 0)`は`0`になり`availableKinds[0]`が`undefined`になってクラッシュする。今回の「教皇」は`oracle`のみを禁止するため`SHOP_SLOT_KINDS`の残り3種別が必ず残り、この問題は発生しない。将来的に全種別を禁止するスプレッドを作る場合は別途ガードが必要になる点をコードコメントで明記すること:

```ts
  // bannedShopKindsで全種別が禁止されるとavailableKindsが空になりクラッシュする。
  // 現状のスプレッド設計では起こらない(教皇はoracleのみ禁止)が、将来全種別禁止のスプレッドを
  // 追加する場合はここにフォールバック処理を追加すること。
```

- [ ] **Step 4: rollPackSlotsでbannedShopKindsを反映**

`shop.ts`の`rollPackSlots`関数を以下に変更:

```ts
function rollPackSlots(params: ShidasuParams, run: RunState, rand: () => number): ShopPackSlot[] {
  const bannedShopKinds = params.spreads[run.spreadId].bannedShopKinds
  const entries = params.shop.packCatalog.filter(e => !bannedShopKinds.includes(e.packKind))
  shuffleInPlace(entries, rand)
  const multiplier = relicPriceMultiplier(params, run)
  const offerBonus = packOfferCountBonus(params, run)
  return entries.slice(0, packSlotCount(params, run)).map(e => ({ packKind: e.packKind, offerCount: e.offerCount + offerBonus, pickCount: e.pickCount, name: e.name, price: Math.round(e.price * multiplier), sold: false }))
}
```

(元の`const entries = [...params.shop.packCatalog]`を、`filter`でbannedShopKindsを除外したコピーに変更。`shuffleInPlace`が破壊的操作のため、`filter`の戻り値は既に新しい配列なので追加のスプレッドコピーは不要。)

- [ ] **Step 5: rollShopの呼び出しを更新**

`shop.ts`の`rollShop`関数内、`rollIndividualSlot`の呼び出し箇所を変更:

```ts
export function rollShop(params: ShidasuParams, run: RunState, rand: () => number = Math.random): ShopState {
  const usedItemIds = new Set<ItemId>()
  const individualCount = individualSlotCount(params, run)
  const individual: ShopIndividualSlot[] = Array.from({ length: individualCount }, () => rollIndividualSlot(params, run, usedItemIds, rand))
  return { individual, packs: rollPackSlots(params, run, rand), relic: rollRelicSlots(params, run, rand) }
}
```

(`rollIndividualSlot(run, usedItemIds, rand)`を`rollIndividualSlot(params, run, usedItemIds, rand)`に変更、`params`を第1引数として追加。)

- [ ] **Step 6: テストを実行し成功を確認**

Run: `npm run test -- shop.test.ts`
Expected: PASS(全件)

- [ ] **Step 7: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/shop.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: ショップ抽選でbannedShopKindsを反映(バラ売り枠・福袋カタログ)"
```

---

## Task 4: 新規スプレッド「教皇」の追加と最終統合確認

**Files:**
- Modify: `src/lib/game/shidasu/types.ts` (`SpreadId`型)
- Modify: `src/lib/game/shidasu/params.ts` (`DEFAULT_PARAMS.spreads`)
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/routes/game/shidasu/+page.svelte` (`SPREAD_IDS`)
- Test: `src/lib/game/shidasu/engine.test.ts`, `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts`に追記(Task 2で追加したoracleLevelsテストの近くに配置):

```ts
  test('spreadId=popeでは、oracleLevelsが全役5になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'pope')
    Object.values(run.oracleLevels).forEach(level => expect(level).toBe(5))
  })
```

`shop.test.ts`の`describe('rollShop', ...)`ブロック内に追記:

```ts
  test('spreadId=popeのランでは、ショップに神託(oracle)のバラ売り枠・福袋が一切出現しない', () => {
    const run = { ...createInitialRun(), spreadId: 'pope' as const }
    for (let seed = 1; seed <= 30; seed++) {
      const shop = rollShop(DEFAULT_PARAMS, run, createRng(seed))
      expect(shop.individual.some(s => s.kind === 'oracle')).toBe(false)
      expect(shop.packs.some(p => p.packKind === 'oracle')).toBe(false)
    }
  })
```

- [ ] **Step 2: テストを実行し失敗を確認**

Run: `npm run test -- engine.test.ts -t "pope"`
Run: `npm run test -- shop.test.ts -t "pope"`
Expected: FAIL(`pope`が`SpreadId`型に存在しない、または`params.spreads.pope`が`undefined`)

- [ ] **Step 3: types.tsのSpreadId型に'pope'を追加**

`types.ts`の`SpreadId`型定義を変更:

```ts
export type SpreadId = 'fool' | 'moon' | 'pope'
```

`SpreadId`型直前のコメント(「fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる」)に「pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない」を追記する。

- [ ] **Step 4: DEFAULT_PARAMS.spreadsに'pope'を追加**

`params.ts`の`DEFAULT_PARAMS.spreads`に追加:

```ts
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [] },
    pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'] },
  },
```

- [ ] **Step 5: shidasu.config.jsonに'pope'を追加**

`shidasu.config.json`の`spreads`セクションに、Step 4と全く同じ内容をJSON形式で追加する。

- [ ] **Step 6: +page.svelteのSPREAD_IDSに'pope'を追加**

`src/routes/game/shidasu/+page.svelte`の`SPREAD_IDS`定数を変更:

```ts
  const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope']
```

- [ ] **Step 7: テストを実行し成功を確認**

Run: `npm run test -- engine.test.ts -t "pope"`
Run: `npm run test -- shop.test.ts -t "pope"`
Expected: PASS

- [ ] **Step 8: 全体テストスイート・ビルド・型チェック**

Run: `npm run test`
Run: `npm run build`
Run: `npm run check`

- [ ] **Step 9: npm run devで実際に動作確認**

Run: `npm run dev`(バックグラウンド起動)
1. `/game/shidasu`にアクセスし、タイトル画面からスプレッド選択画面まで進める(既存のUIフローに従う)。「教皇」が選択肢として表示され、名前・説明文(「神託の初期レベルが5になるが、ショップで神託が販売されない」)が表示されることを確認する。
2. 「教皇」を選んでランを開始し、最初のショップ画面で神託(oracle種別)のバラ売り枠・「神託の福袋」が一度も出現しないことを確認する(必要ならリロールを何度か試す)。
3. 確認後、開発サーバーを停止する。

- [ ] **Step 10: 問題があれば修正、無ければ完了報告**

ビルドエラー・型エラー・画面崩れがあれば修正してから完了とする。Task 1〜3で実装したロジック自体に重大なバグが見つかった場合は、修正を試みず詳細を報告してBLOCKEDまたはDONE_WITH_CONCERNSステータスとすること。

- [ ] **Step 11: 最終コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/routes/game/shidasu/+page.svelte src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: 新規スプレッド「教皇」を追加"
```

---

## 自己レビュー用メモ(実装完了後にplan作成者が確認する事項)

- **spec coverage:** 設計docの5節全てがTask 1〜4でカバーされている。「1. spreadsのRecord化」はTask 1、「2. initialOracleLevel」はTask 1(型・データ)+Task 2(反映ロジック)、「3. bannedShopKinds」はTask 1(型・データ)+Task 3(反映ロジック)、「4. 天啓「張」経由の神託獲得は許容」はコード変更不要のため対応するタスクなし(設計doc通り、意図的にスコープ外)、「5. 新規スプレッド「教皇」の追加」はTask 4。
- **placeholder scan:** 全タスクに具体的なコード・テストコードを記載済み。Task 3 Step 1のテストで「`DEFAULT_PARAMS.shop.packCatalog`に`packKind: 'oracle'`のエントリが実在することが前提」という確認事項を明記しており、未確認のまま丸投げしていない。
- **type consistency:** `SpreadConfig`型のフィールド名(`initialOracleLevel`・`bannedShopKinds`)を全タスクで一貫させている。`rollIndividualSlot`のシグネチャ変更(`params`引数追加)は、Task 3内で定義から呼び出し元(`rollShop`)まで一貫して反映している。`beginRun`の`oracleLevels`構築ロジックは`defaultOracleLevels()`の実際のキー一覧(`Object.keys`)を動的に使う設計にしており、将来`RoleName`が増減しても追従できる。
