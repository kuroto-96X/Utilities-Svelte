# バラ売り購入(buyIndividual)系共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`のバラ売り購入4関数(`buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationHold`/`buyIndividualOracleHold`)の機械的重複を共通ヘルパー`buyIndividualHold`に切り出す。

**Architecture:** 4関数それぞれのフェーズ・shop存在ガード、枠の存在・売り切れ・kind一致チェックはそのまま残し、容量チェック→価格取得→通貨チェック→枠をsold化→対象配列へ追加という末尾処理だけを`buyIndividualHold`ヘルパーに委譲する。容量チェックの式(item/riteは自配列長、revelation/oracleは天啓・神託合算数)は呼び出し元で計算した真偽値として渡す。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-buy-individual-hold-common-refactor-design.md`

---

## Task 1: `buyIndividualHold`ヘルパーの追加と4関数の書き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`buyIndividualItem`・`buyIndividualRite`・`buyIndividualRevelationHold`・`buyIndividualOracleHold`)

- [ ] **Step 1: 現在の4関数をまとめて置き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "export function buyIndividualItem"`で位置を特定できる。`buyIndividualRite`の直後に`buyRelic`があるが、これは変更しない):

```ts
// バラ売り護符購入。所持上限(maxItems、招き布袋像所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  if (run.items.length >= itemMaxCapacity(params, run)) return run
  const price = itemBuyPrice(params, run, itemId)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, items: [...run.items, itemId], shop: { ...run.shop, individual } }
}

// バラ売り秘儀購入。所持上限(基本3、破魔矢所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない。
export function buyIndividualRite(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'rite') return run
  const riteId = slot.id as RiteId
  if (run.rites.length >= riteMaxCapacity(params, run)) return run
  const price = riteBuyPrice(params, run)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, rites: [...run.rites, riteId], shop: { ...run.shop, individual } }
}
```

を以下に置き換える(`buyIndividualHold`ヘルパーを`buyIndividualItem`の直前に新設する):

```ts
// バラ売り枠を1つ購入し、対象配列へ追加する共通処理。容量超過・通貨不足ならno-op(スワップは発生しない)。
// 呼び出し元は既にフェーズ・shop存在・枠のkind一致を確認済みの前提(このヘルパーはその後の
// 容量判定〜確定処理だけを担当する)。フィールドの動的キーアクセスのため戻り値をRunStateに
// キャストしている(福袋pick系・売却系リファクタのresolvePackOfferPick/sellFromArrayと同じ理由・同じパターン)。
function buyIndividualHold<T>(
  run: RunState,
  shop: ShopState,
  slotIndex: number,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: T[],
  value: T,
  atCapacity: boolean,
  price: number
): RunState {
  if (atCapacity) return run
  if (run.currency < price) return run
  const individual = shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, [arrayField]: [...arr, value], shop: { ...shop, individual } } as RunState
}

// バラ売り護符購入。所持上限(maxItems、招き布袋像所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない(スワップは発生しない)。
export function buyIndividualItem(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'item') return run
  const itemId = slot.id as ItemId
  return buyIndividualHold(run, run.shop, slotIndex, 'items', run.items, itemId, run.items.length >= itemMaxCapacity(params, run), itemBuyPrice(params, run, itemId))
}

// バラ売り秘儀購入。所持上限(基本3、破魔矢所持時は拡張)到達時・通貨不足時・売り切れ時は何もしない。
export function buyIndividualRite(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'rite') return run
  const riteId = slot.id as RiteId
  return buyIndividualHold(run, run.shop, slotIndex, 'rites', run.rites, riteId, run.rites.length >= riteMaxCapacity(params, run), riteBuyPrice(params, run))
}
```

`ShopState`型は`engine.ts`で未importなので、ファイル冒頭のimport文に追加する。`src/lib/game/shidasu/engine.ts`2行目の以下:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId, RelicId, StarSabotage, SabotageActionId } from './types'
```

を以下に置き換える(末尾に`ShopState`を追加):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId, RelicId, StarSabotage, SabotageActionId, ShopState } from './types'
```

- [ ] **Step 2: `buyIndividualRevelationHold`・`buyIndividualOracleHold`を書き換える**

続けて同ファイル内、以下のブロック(`grep -n "export function buyIndividualRevelationHold"`で位置を特定できる。直前に`buyIndividualRevelationUse`があるが、これは変更しない):

```ts
// バラ売り天啓・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする(スワップは発生しない)。
export function buyIndividualRevelationHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) return run
  const revelationId = slot.id as RevelationId
  const price = revelationBuyPrice(params, run)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, revelations: [...run.revelations, revelationId], shop: { ...run.shop, individual } }
}
```

を以下に置き換える:

```ts
// バラ売り天啓・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする(スワップは発生しない)。
export function buyIndividualRevelationHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'revelation') return run
  const revelationId = slot.id as RevelationId
  return buyIndividualHold(run, run.shop, slotIndex, 'revelations', run.revelations, revelationId, run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run), revelationBuyPrice(params, run))
}
```

続けて、以下のブロック(`grep -n "export function buyIndividualOracleHold"`で位置を特定できる。直前に`buyIndividualOracleUse`があるが、これは変更しない):

```ts
// バラ売り神託・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする。
export function buyIndividualOracleHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) return run
  const roleName = slot.id as RoleName
  const price = oracleBuyPrice(params, run)
  if (run.currency < price) return run
  const individual = run.shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  return { ...run, currency: run.currency - price, oracles: [...run.oracles, roleName], shop: { ...run.shop, individual } }
}
```

を以下に置き換える:

```ts
// バラ売り神託・温存。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はブロックする。
export function buyIndividualOracleHold(params: ShidasuParams, run: RunState, slotIndex: number): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.individual[slotIndex]
  if (!slot || slot.sold || slot.kind !== 'oracle') return run
  const roleName = slot.id as RoleName
  return buyIndividualHold(run, run.shop, slotIndex, 'oracles', run.oracles, roleName, run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run), oracleBuyPrice(params, run))
}
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationHold`/`buyIndividualOracleHold`関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 5: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 6: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: buyIndividualHoldヘルパーを追加しバラ売り購入4関数を共通化する"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、ショップのバラ売り枠(護符・秘儀・天啓温存・神託温存)の購入が壊れていないことを確認する(ブラウザ操作が困難な環境であれば、型チェック・ビルドの成功で代替してよい)
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
