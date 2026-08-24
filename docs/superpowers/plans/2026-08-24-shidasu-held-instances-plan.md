# 護符・秘儀・天啓・神託のオブジェクト化(instanceId導入) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `RunState.items`・`rites`・`revelations`・`oracles`を単純なID配列(`ItemId[]`等)から、個体識別用の`instanceId`を持つオブジェクト配列(`HeldItem[]`等)に変換し、同名護符・秘儀・天啓・神託を複数所持していても個体を区別できるようにする。既存の挙動は完全に維持する(唯一の例外: 封印(seal)が「同名全部」から「個体1つだけ」に対象精度が上がる、これは意図した変更)。

**Architecture:** `docs/superpowers/specs/2026-08-24-shidasu-held-instances-design.md`に基づく。型定義(`types.ts`)を4フィールド同時に変更し、その後はファイル単位(`engine.ts`→`riteEffects.ts`/`revelationEffects.ts`→`shop.ts`→`sabotageEffects.ts`→`PlayArea.svelte`→`+page.svelte`→admin debug page→テストファイル)で呼び出し元を追従させる。`buyIndividualHold`・`sellFromArray`という共通ヘルパーが4配列すべてから呼ばれており、天啓・神託は合算所持枠とスワップ処理で密結合しているため、配列ごとに独立した段階分けはできない。**型変更直後から複数ファイルにまたがってTypeScriptのコンパイルエラーが出る状態が、最後のテストタスクまで続く。これは想定内であり、各タスクは「自分が担当するファイルにエラーが無いこと」だけを確認すればよい(他ファイルの残エラーは後続タスクの担当)。**

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

**検証方針について**: 本プランは既存機能のデータ構造移行(挙動を変えないリファクタ)が中心のため、新規ロジックのTDD(red→green)ではなく、「既存のテストスイートが移行後も(fixtureの形式変更を除いて)同じ結果を返すこと」を正しさの基準とする。挙動が意図的に変わる箇所(封印精度)と、新規に生まれる概念(instanceIdの一意性)にのみ新規テストを追加する。

---

### Task 1: types.ts — 型定義の追加・変更

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:295-303`(`WaveState.activeSeal`)
- Modify: `src/lib/game/shidasu/types.ts:312`(`WaveState.lastSabotage`の`forceActivatedTarget`)
- Modify: `src/lib/game/shidasu/types.ts:390-394`(`HeldRevelationOrOracleRef`)
- Modify: `src/lib/game/shidasu/types.ts:400`(`RunState.items`)、`411`(`rites`)、`413`(`revelations`)、`449`(`oracles`)
- Modify: `src/lib/game/shidasu/types.ts`(`RunState`に`nextInstanceId`追加)

- [ ] **Step 1: `HeldItem`・`HeldRite`・`HeldRevelation`・`HeldOracle`型を追加し、`HeldRevelationOrOracleRef`に`instanceId`を追加する**

`src/lib/game/shidasu/types.ts:390-394`の以下のコードを:

```ts
// 福袋の天啓・神託パックで上限到達時にスワップ対象を指定するための判別共用体。
// 天啓・神託は合算枠(上限2)を共有するため、スワップ対象がどちらの配列に属するかを明示する必要がある。
export type HeldRevelationOrOracleRef =
  | { kind: 'revelation'; id: RevelationId }
  | { kind: 'oracle'; id: RoleName }
```

以下に置き換える:

```ts
// 所持中の護符・秘儀・天啓・神託の個体。instanceIdはRunState.nextInstanceIdから払い出される、
// 4配列(items/rites/revelations/oracles)共通で一意なID。同名(同じid)を複数所持していても
// instanceIdで個体を区別できる(封印・売却・並べ替え・将来の個体ごとの可変効果のため)。
export interface HeldItem { instanceId: number; id: ItemId }
export interface HeldRite { instanceId: number; id: RiteId }
export interface HeldRevelation { instanceId: number; id: RevelationId }
export interface HeldOracle { instanceId: number; id: RoleName }

// 福袋の天啓・神託パックで上限到達時にスワップ対象を指定するための判別共用体。
// 天啓・神託は合算枠(上限2)を共有するため、スワップ対象がどちらの配列に属するかを明示する必要がある。
// instanceIdは対象個体の一意識別(封印・スワップ対象の個体特定に使う)。idは表示名解決用。
export type HeldRevelationOrOracleRef =
  | { kind: 'revelation'; instanceId: number; id: RevelationId }
  | { kind: 'oracle'; instanceId: number; id: RoleName }
```

- [ ] **Step 2: `WaveState.activeSeal`の`talisman`・`rite`ケースに`instanceId`を追加する**

`src/lib/game/shidasu/types.ts:295-303`の以下のコードを:

```ts
  activeSeal:
    | { kind: 'talisman'; id: ItemId }
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | { kind: 'comboCap'; max: number }
    | { kind: 'talismanHidden' }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number }
    | null
```

以下に置き換える:

```ts
  activeSeal:
    | { kind: 'talisman'; instanceId: number; id: ItemId }
    | { kind: 'rite'; instanceId: number; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
    | { kind: 'role'; names: RoleName[] }
    | { kind: 'comboCap'; max: number }
    | { kind: 'talismanHidden' }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[]; multiplier: number }
    | null
```

- [ ] **Step 3: `WaveState.lastSabotage`の`forceActivatedTarget`の`rite`ケースに`instanceId`を追加する**

`src/lib/game/shidasu/types.ts:312`の1行(長大な`lastSabotage`のインライン型定義)の中の、以下の部分:

```ts
forceActivatedTarget?: { kind: 'rite'; id: RiteId } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef };
```

を以下に置き換える(`confiscatedTarget`はこの行の別の箇所にあるが、そちらは変更しない):

```ts
forceActivatedTarget?: { kind: 'rite'; instanceId: number; id: RiteId } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef };
```

- [ ] **Step 4: `RunState`の4フィールドの型を変更し、`nextInstanceId`を追加する**

`src/lib/game/shidasu/types.ts:400`の:
```ts
  items: ItemId[]
```
を:
```ts
  items: HeldItem[]
  // items/rites/revelations/oracles共通で一意なinstanceIdを払い出すカウンター。
  // 新規インスタンスを配列に追加するたび(購入・福袋確定・スワップ確定・天啓報酬付与)にこの値を
  // 払い出し、+1する。createInitialRunで1から開始する。
  nextInstanceId: number
```
に変更する。

`src/lib/game/shidasu/types.ts:411`の:
```ts
  rites: RiteId[]
```
を:
```ts
  rites: HeldRite[]
```
に変更する。

`src/lib/game/shidasu/types.ts:413`の:
```ts
  revelations: RevelationId[]
```
を:
```ts
  revelations: HeldRevelation[]
```
に変更する。

`src/lib/game/shidasu/types.ts:449`の:
```ts
  oracles: RoleName[]
```
を:
```ts
  oracles: HeldOracle[]
```
に変更する。

- [ ] **Step 5: このタスクの範囲を確認する**

`npm run check`を実行する。`types.ts`自体にエラーが無いことを確認する。他の多数のファイル(`engine.ts`・`shop.ts`・`sabotageEffects.ts`・Svelteファイル・テストファイル)にエラーが出るのは想定内(後続タスクで解消する)。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "$(cat <<'EOF'
refactor: 護符・秘儀・天啓・神託の型をinstanceId付きオブジェクトに変更(型定義のみ)
EOF
)"
```

---

### Task 2: engine.ts — ロジックの移行

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: 型インポートに`HeldItem`・`HeldRite`・`HeldRevelation`・`HeldOracle`を追加する**

`src/lib/game/shidasu/engine.ts:2`の:
```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId, RelicId, StarSabotage, SabotageActionId, ShopState } from './types'
```
を:
```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, HeldItem, HeldRite, HeldRevelation, HeldOracle, Star, StarRestriction, CardSetGenreId, RelicId, StarSabotage, SabotageActionId, ShopState } from './types'
```
に変更する。

- [ ] **Step 2: `createInitialRun`に`nextInstanceId: 1`を追加する**

`src/lib/game/shidasu/engine.ts:972-986`の:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
```
を:
```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], nextInstanceId: 1, offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], relics: [], revelationOffer: [], extraTableauRows: 0,
```
に変更する(それ以外の行はそのまま)。

- [ ] **Step 3: `applyDiscretionFrostBonus`の所持判定を`.some(h => h.id === ...)`に変更する**

`src/lib/game/shidasu/engine.ts:1037-1043`の:
```ts
function applyDiscretionFrostBonus(params: ShidasuParams, run: RunState, wave: WaveState): WaveState {
  let next = wave
  if (run.items.includes('discretion')) next = { ...next, discretionN: next.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) next = { ...next, frostX: next.frostX + params.talismans.frost.x }
  return next
}
```
を:
```ts
function applyDiscretionFrostBonus(params: ShidasuParams, run: RunState, wave: WaveState): WaveState {
  let next = wave
  if (run.items.some(h => h.id === 'discretion')) next = { ...next, discretionN: next.discretionN + params.talismans.discretion.n }
  if (run.items.some(h => h.id === 'frost')) next = { ...next, frostX: next.frostX + params.talismans.frost.x }
  return next
}
```
に変更する。

- [ ] **Step 4: `useRite`に`instanceId`引数を追加する**

`src/lib/game/shidasu/engine.ts:1045-1060`の:
```ts
// 秘儀を1つ使用する。効果を適用し、所持からその秘儀を1個削除する。
// 使用条件(canUseRite)を満たさない場合、または所持していない場合は何もしない。
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  if (riteId === 'dagaz') {
    wave = { ...wave, lastStockShuffle: { seq: (run.wave.lastStockShuffle?.seq ?? 0) + 1 } }
  }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}
```
を:
```ts
// 秘儀を1つ使用する。効果を適用し、所持からその秘儀を1個削除する。
// 使用条件(canUseRite)を満たさない場合、または所持していない場合は何もしない。
// instanceIdは対象の個体(封印精度・重複所持時の対象特定に使う)。呼び出し元(UI)は
// クリックされたバッジのinstanceIdをそのまま渡す。
export function useRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, instanceId, riteId)) return run
  const idx = run.rites.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  if (riteId === 'dagaz') {
    wave = { ...wave, lastStockShuffle: { seq: (run.wave.lastStockShuffle?.seq ?? 0) + 1 } }
  }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}
```
に変更する。

- [ ] **Step 5: `startRevelationPreview`・`finishShop`が`run.items`を`startWave`へ渡す箇所を`.map(h => h.id)`で変換する**

`src/lib/game/shidasu/engine.ts:1090-1092`の:
```ts
export function startRevelationPreview(params: ShidasuParams, run: RunState, seed?: number): WaveState {
  const { wave } = startWave(params, 0, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
  return wave
}
```
を:
```ts
export function startRevelationPreview(params: ShidasuParams, run: RunState, seed?: number): WaveState {
  const { wave } = startWave(params, 0, 0, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN)
  return wave
}
```
に変更する。

`src/lib/game/shidasu/engine.ts:1097-1102`の:
```ts
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const star = run.stageStars[run.waveIndex]
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
  return { ...run, phase: 'playing', wave, waveGeneration: run.waveGeneration + 1, deckComposition, shop: null }
}
```
を:
```ts
export function finishShop(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'shop') return run
  const star = run.stageStars[run.waveIndex]
  const { wave, deckComposition } = startWave(params, run.stageIndex, run.waveIndex, run.items.map(h => h.id), run.deckComposition, seed, run.extraTableauRows, run.oracleLevels, run.dedicationX, run.diligenceX, run.divineProtectionX, run.discretionN, run.frostX, run.echoX, run.shootingStarN, star?.sabotage ?? { kind: 'none' })
  return { ...run, phase: 'playing', wave, waveGeneration: run.waveGeneration + 1, deckComposition, shop: null }
}
```
に変更する。

- [ ] **Step 6: `resolveEffectiveItems`を`instanceId`ベースのフィルタに変更する**

`src/lib/game/shidasu/engine.ts:1104-1110`の:
```ts
// wave.activeSealがtalisman封印の場合、そのIDをitemsから除外した実効リストを返す。
// playCard/drawStockへ渡すitemsをこれに差し替えることで、所持表示(run.items)自体は
// 変更せずに効果だけを無視させる。
function resolveEffectiveItems(items: ItemId[], activeSeal: WaveState['activeSeal']): ItemId[] {
  if (activeSeal?.kind === 'talisman') return items.filter(id => id !== activeSeal.id)
  return items
}
```
を:
```ts
// wave.activeSealがtalisman封印の場合、その個体(instanceId)をitemsから除外した実効リストを
// ItemId[]で返す(playCard/drawStock等の下流関数は引き続きItemId[]のみを扱う境界)。
// playCard/drawStockへ渡すitemsをこれに差し替えることで、所持表示(run.items)自体は
// 変更せずに効果だけを無視させる。同名護符を複数所持していても、封印された個体1つだけを除外する。
function resolveEffectiveItems(items: HeldItem[], activeSeal: WaveState['activeSeal']): ItemId[] {
  const effective = activeSeal?.kind === 'talisman' ? items.filter(h => h.instanceId !== activeSeal.instanceId) : items
  return effective.map(h => h.id)
}
```
に変更する。

- [ ] **Step 7: `buyIndividualHold`を`{instanceId, id}`共通形状に一般化する**

`src/lib/game/shidasu/engine.ts:1206-1224`の:
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
```
を:
```ts
// バラ売り枠を1つ購入し、対象配列へ追加する共通処理。容量超過・通貨不足ならno-op(スワップは発生しない)。
// 呼び出し元は既にフェーズ・shop存在・枠のkind一致を確認済みの前提(このヘルパーはその後の
// 容量判定〜確定処理だけを担当する)。フィールドの動的キーアクセスのため戻り値をRunStateに
// キャストしている(福袋pick系・売却系リファクタのresolvePackOfferPick/sellFromArrayと同じ理由・同じパターン)。
// 新規インスタンスにはrun.nextInstanceIdを払い出し、+1する。
function buyIndividualHold<TId>(
  run: RunState,
  shop: ShopState,
  slotIndex: number,
  arrayField: 'items' | 'rites' | 'revelations' | 'oracles',
  arr: { instanceId: number; id: TId }[],
  value: TId,
  atCapacity: boolean,
  price: number
): RunState {
  if (atCapacity) return run
  if (run.currency < price) return run
  const individual = shop.individual.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const held = { instanceId: run.nextInstanceId, id: value }
  return { ...run, currency: run.currency - price, [arrayField]: [...arr, held], nextInstanceId: run.nextInstanceId + 1, shop: { ...shop, individual } } as RunState
}
```
に変更する。この変更により、`buyIndividualItem`(engine.ts:1227-1233)・`buyIndividualRite`(1236-1242)・`buyIndividualRevelationHold`(1281-1287)・`buyIndividualOracleHold`(1304-1310)の呼び出し箇所自体はコード変更不要(TypeScriptが`run.items`/`run.rites`/`run.revelations`/`run.oracles`と`itemId`/`riteId`/`revelationId`/`roleName`から`TId`を正しく推論する)。

- [ ] **Step 8: `pickPackItem`・`confirmPackItemSwap`をinstanceId対応にする**

`src/lib/game/shidasu/engine.ts:1361-1377`の:
```ts
// 護符の福袋(itemSelect)から1つ選ぶ。所持上限到達時はpendingNewItemにセットしてスワップ待ちにする。
export function pickPackItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || !run.offer.includes(itemId)) return run
  if (run.items.length >= itemMaxCapacity(params, run)) {
    return { ...run, pendingNewItem: itemId }
  }
  return resolvePackOfferPick({ ...run, items: [...run.items, itemId] }, 'offer', 'pendingNewItem', run.offer, id => id === itemId)
}

// スワップ待ち中に既存の護符と入れ替えて確定する。
export function confirmPackItemSwap(run: RunState, oldItemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItemId = run.pendingNewItem
  return resolvePackOfferPick({ ...run, items: [...remaining, newItemId] }, 'offer', 'pendingNewItem', run.offer, id => id === newItemId)
}
```
を:
```ts
// 護符の福袋(itemSelect)から1つ選ぶ。所持上限到達時はpendingNewItemにセットしてスワップ待ちにする。
export function pickPackItem(params: ShidasuParams, run: RunState, itemId: ItemId): RunState {
  if (run.phase !== 'itemSelect' || !run.offer.includes(itemId)) return run
  if (run.items.length >= itemMaxCapacity(params, run)) {
    return { ...run, pendingNewItem: itemId }
  }
  const held = { instanceId: run.nextInstanceId, id: itemId }
  return resolvePackOfferPick({ ...run, items: [...run.items, held], nextInstanceId: run.nextInstanceId + 1 }, 'offer', 'pendingNewItem', run.offer, id => id === itemId)
}

// スワップ待ち中に既存の護符と入れ替えて確定する。oldInstanceIdは入れ替え対象の個体。
export function confirmPackItemSwap(run: RunState, oldInstanceId: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.findIndex(h => h.instanceId === oldInstanceId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItemId = run.pendingNewItem
  const held = { instanceId: run.nextInstanceId, id: newItemId }
  return resolvePackOfferPick({ ...run, items: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'offer', 'pendingNewItem', run.offer, id => id === newItemId)
}
```
に変更する。

- [ ] **Step 9: `pickPackRite`・`confirmPackRiteSwap`をinstanceId対応にする**

`src/lib/game/shidasu/engine.ts:1390-1405`の:
```ts
// 秘儀の福袋(riteSelect)から1つ選ぶ。所持上限(基本3、破魔矢所持時は拡張)到達時はpendingNewRiteにセットしてスワップ待ちにする。
export function pickPackRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= riteMaxCapacity(params, run)) {
    return { ...run, pendingNewRite: riteId }
  }
  return resolvePackOfferPick({ ...run, rites: [...run.rites, riteId] }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === riteId)
}

export function confirmPackRiteSwap(run: RunState, oldRiteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || run.pendingNewRite === null) return run
  const idx = run.rites.indexOf(oldRiteId)
  const remaining = idx === -1 ? [...run.rites] : [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const newRiteId = run.pendingNewRite
  return resolvePackOfferPick({ ...run, rites: [...remaining, newRiteId] }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === newRiteId)
}
```
を:
```ts
// 秘儀の福袋(riteSelect)から1つ選ぶ。所持上限(基本3、破魔矢所持時は拡張)到達時はpendingNewRiteにセットしてスワップ待ちにする。
export function pickPackRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= riteMaxCapacity(params, run)) {
    return { ...run, pendingNewRite: riteId }
  }
  const held = { instanceId: run.nextInstanceId, id: riteId }
  return resolvePackOfferPick({ ...run, rites: [...run.rites, held], nextInstanceId: run.nextInstanceId + 1 }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === riteId)
}

// oldInstanceIdは入れ替え対象の個体。
export function confirmPackRiteSwap(run: RunState, oldInstanceId: number): RunState {
  if (run.phase !== 'riteSelect' || run.pendingNewRite === null) return run
  const idx = run.rites.findIndex(h => h.instanceId === oldInstanceId)
  const remaining = idx === -1 ? [...run.rites] : [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const newRiteId = run.pendingNewRite
  const held = { instanceId: run.nextInstanceId, id: newRiteId }
  return resolvePackOfferPick({ ...run, rites: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'riteOffer', 'pendingNewRite', run.riteOffer, id => id === newRiteId)
}
```
に変更する。

- [ ] **Step 10: `pickPackRevelationHold`・`confirmPackRevelationSwap`・`pickPackOracleHold`・`confirmPackOracleSwap`をinstanceId対応にする**

`src/lib/game/shidasu/engine.ts:1426-1447`の:
```ts
// 天啓の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewRevelationにセットしスワップ待ちにする。
export function pickPackRevelationHold(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'revelationSelect' || !run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewRevelation: revelationId }
  }
  return resolvePackOfferPick({ ...run, revelations: [...run.revelations, revelationId] }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === revelationId)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackRevelationSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'revelationSelect' || run.pendingNewRevelation === null) return run
  const newId = run.pendingNewRevelation
  if (target.kind === 'revelation') {
    const idx = run.revelations.indexOf(target.id)
    const remaining = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, revelations: [...remaining, newId] }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
  }
  const idx = run.oracles.indexOf(target.id)
  const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, oracles, revelations: [...run.revelations, newId] }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
}
```
を:
```ts
// 天啓の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewRevelationにセットしスワップ待ちにする。
export function pickPackRevelationHold(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'revelationSelect' || !run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewRevelation: revelationId }
  }
  const held = { instanceId: run.nextInstanceId, id: revelationId }
  return resolvePackOfferPick({ ...run, revelations: [...run.revelations, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === revelationId)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
// targetはHeldRevelationOrOracleRef(instanceId込み)なので、対象個体をinstanceId一致で検索する。
export function confirmPackRevelationSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'revelationSelect' || run.pendingNewRevelation === null) return run
  const newId = run.pendingNewRevelation
  const held = { instanceId: run.nextInstanceId, id: newId }
  if (target.kind === 'revelation') {
    const idx = run.revelations.findIndex(h => h.instanceId === target.instanceId)
    const remaining = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, revelations: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
  }
  const idx = run.oracles.findIndex(h => h.instanceId === target.instanceId)
  const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, oracles, revelations: [...run.revelations, held], nextInstanceId: run.nextInstanceId + 1 }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === newId)
}
```
に変更する。

`src/lib/game/shidasu/engine.ts:1564-1585`の:
```ts
// 神託の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewOracleにセットしスワップ待ちにする。
export function pickPackOracleHold(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewOracle: roleName }
  }
  return resolvePackOfferPick({ ...run, oracles: [...run.oracles, roleName] }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === roleName)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackOracleSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'oracleSelect' || run.pendingNewOracle === null) return run
  const newRole = run.pendingNewOracle
  if (target.kind === 'oracle') {
    const idx = run.oracles.indexOf(target.id)
    const remaining = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, oracles: [...remaining, newRole] }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
  }
  const idx = run.revelations.indexOf(target.id)
  const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, revelations, oracles: [...run.oracles, newRole] }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
}
```
を:
```ts
// 神託の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewOracleにセットしスワップ待ちにする。
export function pickPackOracleHold(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewOracle: roleName }
  }
  const held = { instanceId: run.nextInstanceId, id: roleName }
  return resolvePackOfferPick({ ...run, oracles: [...run.oracles, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === roleName)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackOracleSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'oracleSelect' || run.pendingNewOracle === null) return run
  const newRole = run.pendingNewOracle
  const held = { instanceId: run.nextInstanceId, id: newRole }
  if (target.kind === 'oracle') {
    const idx = run.oracles.findIndex(h => h.instanceId === target.instanceId)
    const remaining = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
    return resolvePackOfferPick({ ...run, oracles: [...remaining, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
  }
  const idx = run.revelations.findIndex(h => h.instanceId === target.instanceId)
  const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return resolvePackOfferPick({ ...run, revelations, oracles: [...run.oracles, held], nextInstanceId: run.nextInstanceId + 1 }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === newRole)
}
```
に変更する。

- [ ] **Step 11: `grantRevelationReward`の`subaru`・`mitsu`・`hotori`・`chou`・`yoku`・`karasu`ケースをinstanceId対応にする**

`src/lib/game/shidasu/engine.ts:1483-1524`の該当ケースを以下のように変更する(`kyo`・`oni`・`ryuu`・`default`ケースは変更不要):

```ts
    case 'subaru': {
      if (runAfterRemoval.items.length >= itemMaxCapacity(params, runAfterRemoval)) return {}
      const available = ITEM_POOL.filter(id => !runAfterRemoval.items.some(h => h.id === id))
      if (available.length === 0) return {}
      const picked = available[Math.floor(rand() * available.length)]
      const held = { instanceId: runAfterRemoval.nextInstanceId, id: picked }
      return { items: [...runAfterRemoval.items, held], nextInstanceId: runAfterRemoval.nextInstanceId + 1 }
    }
```
```ts
    case 'hotori': {
      const target = runAfterRemoval.lastUsedRevelationId
      if (target === null) return {}
      if (sharedRevelationSlotsRemaining(params, runAfterRemoval) <= 0) return {}
      const held = { instanceId: runAfterRemoval.nextInstanceId, id: target }
      return { revelations: [...runAfterRemoval.revelations, held], nextInstanceId: runAfterRemoval.nextInstanceId + 1 }
    }
    case 'chou': {
      const slotsLeft = sharedRevelationSlotsRemaining(params, runAfterRemoval)
      if (slotsLeft === 0) return {}
      const picked = rollOffer(ORACLE_POOL, slotsLeft, rand)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { oracles: [...runAfterRemoval.oracles, ...held], nextInstanceId: nextId }
    }
    case 'yoku': {
      const slotsLeft = sharedRevelationSlotsRemaining(params, runAfterRemoval)
      if (slotsLeft === 0) return {}
      const picked = rollOffer(REVELATION_POOL, slotsLeft, rand)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { revelations: [...runAfterRemoval.revelations, ...held], nextInstanceId: nextId }
    }
    case 'mitsu': {
      const total = runAfterRemoval.items.reduce((sum, h) => sum + itemSellPrice(params, runAfterRemoval, h.id), 0)
      return { currency: runAfterRemoval.currency + total }
    }
    case 'karasu': {
      // 秘儀の所持枠は基本上限3(破魔矢所持時は拡張)で、天啓・神託の合算枠(sharedRevelationSlotsRemaining)とは独立している。
      const slotsLeft = Math.max(0, riteMaxCapacity(params, runAfterRemoval) - runAfterRemoval.rites.length)
      if (slotsLeft === 0) return {}
      const picked = runAfterRemoval.recentUsedRiteIds.slice(0, slotsLeft)
      let nextId = runAfterRemoval.nextInstanceId
      const held = picked.map(id => ({ instanceId: nextId++, id }))
      return { rites: [...runAfterRemoval.rites, ...held], nextInstanceId: nextId }
    }
```

- [ ] **Step 12: `useRevelation`に`instanceId`引数を追加する**

`src/lib/game/shidasu/engine.ts:1530-1552`の:
```ts
// 所持中の天啓を1つ使用する(消費される)。プレイ中・天啓選択画面のどちらでも動作し、
// フェーズは変えない(秘儀のuseRiteと同じ位置づけ)。
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random,
  targetRelicId: RelicId | null = null
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.indexOf(revelationId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  const extraTableauRows = run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, targetRelicId, rand)
  // 星(hotori)自身の使用は履歴に残さない(自己参照ループを防ぐ。詳細はtypes.tsのlastUsedRevelationIdコメント参照)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}
```
を:
```ts
// 所持中の天啓を1つ使用する(消費される)。プレイ中・天啓選択画面のどちらでも動作し、
// フェーズは変えない(秘儀のuseRiteと同じ位置づけ)。instanceIdは対象の個体
// (封印精度・重複所持時の対象特定に使う)。呼び出し元(UI)はクリックされたバッジの
// instanceIdをそのまま渡す。
export function useRevelation(
  params: ShidasuParams,
  run: RunState,
  instanceId: number,
  revelationId: RevelationId,
  targetCol: number | null,
  rand: () => number = Math.random,
  targetRelicId: RelicId | null = null
): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  const idx = run.revelations.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  if (!canUseRevelation(params, run.wave, instanceId, revelationId, run.relics)) return run
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  const extraTableauRows = run.extraTableauRows
  const revelations = [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  const reward = grantRevelationReward(params, { ...run, revelations }, revelationId, targetRelicId, rand)
  // 星(hotori)自身の使用は履歴に残さない(自己参照ループを防ぐ。詳細はtypes.tsのlastUsedRevelationIdコメント参照)
  const lastUsedRevelationId = revelationId === 'hotori' ? run.lastUsedRevelationId : revelationId
  return { ...run, wave, deckComposition, revelations, extraTableauRows, lastUsedRevelationId, ...reward }
}
```
に変更する。

- [ ] **Step 13: `buyIndividualRevelationUse`・`pickPackRevelationUse`の`canUseRevelation`呼び出しに`null`(instanceId無し)を渡す**

`src/lib/game/shidasu/engine.ts:1271`の:
```ts
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
```
(`buyIndividualRevelationUse`内)を:
```ts
  if (!canUseRevelation(params, run.wave, null, revelationId, run.relics)) return run
```
に変更する。

`src/lib/game/shidasu/engine.ts:1420`の:
```ts
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
```
(`pickPackRevelationUse`内)を:
```ts
  if (!canUseRevelation(params, run.wave, null, revelationId, run.relics)) return run
```
に変更する。

これら2関数は所持に加える前にショップ・福袋から直接即使用するため、封印中の個体という概念が存在しない(`null`は「所持個体ではない」ことを表す)。

- [ ] **Step 14: `useOracle`の`indexOf`を`findIndex`に変更する(シグネチャ自体は変更しない)**

`src/lib/game/shidasu/engine.ts:1614-1625`の:
```ts
// 所持中の神託を1つ消費する。playingフェーズでのみ呼べる(ショップ内フェーズでは呼べない)。
// run/wave両方のoracleLevelsを同期する。盤面への直接効果は無い。
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.indexOf(roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  if (wave) wave = applyDiscretionFrostBonus(params, run, wave)
  return { ...run, oracles, oracleLevels, wave }
}
```
を:
```ts
// 所持中の神託を1つ消費する。playingフェーズでのみ呼べる(ショップ内フェーズでは呼べない)。
// run/wave両方のoracleLevelsを同期する。盤面への直接効果は無い。神託はoracleLevelsという
// 役名単位の集計値に効果が還元されるため(封印もoracleBaselineRoleという役名ベース)、
// 個体を指定する必要が無く、シグネチャは従来通りroleNameのまま(同名の先頭1個を消費する)。
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'playing') return run
  const idx = run.oracles.findIndex(h => h.id === roleName)
  if (idx === -1) return run
  const oracles = [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  if (wave) wave = applyDiscretionFrostBonus(params, run, wave)
  return { ...run, oracles, oracleLevels, wave }
}
```
に変更する。

- [ ] **Step 15: `sellFromArray`を`instanceId`ベースの検索に一般化し、`sellItem`・`sellRite`・`sellRevelation`・`sellOracle`に`instanceId`引数を追加する**

`src/lib/game/shidasu/engine.ts:1644-1674`の:
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
を:
```ts
// 所持配列から1個を売却し、通貨を得る共通処理。playing/shopフェーズでのみ呼べる。
// フィールドの動的キーアクセスのため戻り値をRunStateにキャストしている(呼び出し元は
// 決まった4パターンに限定されるため、型安全性は既存テストで担保する。福袋pick系リファクタの
// resolvePackOfferPickと同じ理由・同じパターン)。instanceIdで対象個体を一意に特定する。
function sellFromArray<T>(run: RunState, arrayField: 'items' | 'rites' | 'revelations' | 'oracles', arr: { instanceId: number; id: T }[], instanceId: number, price: number): RunState {
  if (run.phase !== 'playing' && run.phase !== 'shop') return run
  const idx = arr.findIndex(h => h.instanceId === instanceId)
  if (idx === -1) return run
  const newArr = [...arr.slice(0, idx), ...arr.slice(idx + 1)]
  return { ...run, [arrayField]: newArr, currency: run.currency + price } as RunState
}

// 所持中の護符を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。instanceIdで対象個体を特定し、
// itemIdは価格計算(itemSellPrice)に使う。
export function sellItem(params: ShidasuParams, run: RunState, instanceId: number, itemId: ItemId): RunState {
  return sellFromArray(run, 'items', run.items, instanceId, itemSellPrice(params, run, itemId))
}

// 所持中の秘儀を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRite(params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId): RunState {
  return sellFromArray(run, 'rites', run.rites, instanceId, riteSellPrice(params, run))
}

// 所持中の天啓を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellRevelation(params: ShidasuParams, run: RunState, instanceId: number, revelationId: RevelationId): RunState {
  return sellFromArray(run, 'revelations', run.revelations, instanceId, revelationSellPrice(params, run))
}

// 所持中の神託を1個売却し、通貨を得る。playing/shopフェーズでのみ呼べる。
export function sellOracle(params: ShidasuParams, run: RunState, instanceId: number, roleName: RoleName): RunState {
  return sellFromArray(run, 'oracles', run.oracles, instanceId, oracleSellPrice(params, run))
}
```
に変更する。

- [ ] **Step 16: `buyPack`の`rollItemOffer`呼び出しを変換する**

`src/lib/game/shidasu/engine.ts:1321`の:
```ts
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items, rand, slot.offerCount) }
```
を:
```ts
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items.map(h => h.id), rand, slot.offerCount) }
```
に変更する。

- [ ] **Step 17: `applyStuckCheck`の`isStuck`呼び出しと`for (const id of run.items)`ループを変換する**

`src/lib/game/shidasu/engine.ts:1739`の:
```ts
  if (!isStuck(modifier, wave, run.rites)) return run
```
を:
```ts
  if (!isStuck(modifier, wave, run.rites.map(h => h.id))) return run
```
に変更する。

`src/lib/game/shidasu/engine.ts:1743`の:
```ts
  for (const id of run.items) {
```
を:
```ts
  for (const { id } of run.items) {
```
に変更する(ループ内部のロジックは変更不要、`id`という変数名がそのまま使えるため)。

- [ ] **Step 18: 型チェックでこのファイルにエラーが無いことを確認する**

`npm run check`を実行し、`src/lib/game/shidasu/engine.ts`自体にエラーが無いことを確認する。`riteEffects.ts`・`revelationEffects.ts`・`sabotageEffects.ts`・`shop.ts`・Svelteファイル・テストファイルのエラーは後続タスクで解消するため無視してよい(`canUseRite`/`canUseRevelation`のシグネチャ変更がまだ`riteEffects.ts`/`revelationEffects.ts`に反映されていないため、実際には`engine.ts`側でも一部エラーが残る可能性がある。その場合はTask 3・4を先に完了させてから本Stepを再実行してよい)。

- [ ] **Step 19: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "$(cat <<'EOF'
refactor: engine.tsの護符・秘儀・天啓・神託ロジックをinstanceIdベースに移行
EOF
)"
```

---

### Task 3: riteEffects.ts — `canUseRite`のinstanceId対応

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.ts:221-223`

- [ ] **Step 1: `canUseRite`に`instanceId`引数を追加する**

`src/lib/game/shidasu/riteEffects.ts:219-223`の:
```ts
// 秘儀が現在の盤面状態で使用可能か判定する(捨て札・山札の枚数不足、チェーン長不足などの条件)。
// UIのボタンdisabled判定に使う。
export function canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId): boolean {
  // 妨害「封印系」により対象秘儀が封印中の場合は、他の条件を満たしていても使用不可にする
  if (wave.activeSeal?.kind === 'rite' && wave.activeSeal.id === riteId) return false
```
を:
```ts
// 秘儀が現在の盤面状態で使用可能か判定する(捨て札・山札の枚数不足、チェーン長不足などの条件)。
// UIのボタンdisabled判定に使う。instanceIdは対象の個体(封印精度のため、id一致ではなくinstanceId一致で判定する)。
export function canUseRite(_params: ShidasuParams, wave: WaveState, instanceId: number, riteId: RiteId): boolean {
  // 妨害「封印系」により対象秘儀(の個体)が封印中の場合は、他の条件を満たしていても使用不可にする
  if (wave.activeSeal?.kind === 'rite' && wave.activeSeal.instanceId === instanceId) return false
```
に変更する(以降の`switch (riteId)`ブロックは変更不要)。

- [ ] **Step 2: 型チェック・コミット**

`npm run check`を実行し、`riteEffects.ts`自体にエラーが無いことを確認する(呼び出し元の`engine.ts`・`sabotageEffects.ts`・`PlayArea.svelte`はTask 2で一部対応済み、残りはTask 6・7で対応する)。

```bash
git add src/lib/game/shidasu/riteEffects.ts
git commit -m "$(cat <<'EOF'
refactor: canUseRiteをinstanceIdベースの封印判定に変更
EOF
)"
```

---

### Task 4: revelationEffects.ts — `canUseRevelation`のinstanceId対応

**Files:**
- Modify: `src/lib/game/shidasu/revelationEffects.ts:208-224`

- [ ] **Step 1: `canUseRevelation`に`instanceId`引数(nullable)を追加する**

`src/lib/game/shidasu/revelationEffects.ts:204-224`の:
```ts
// 天啓が現在の盤面状態で使用可能か判定する。wave.activeSealが自分自身(revelationOrOracle・
// revelation・id一致)を封印中なら他の条件に関わらず常に使用不可。それ以外では、虚(レリック付喪化)は
// 未付喪化の所持レリックが1つ以上あるか、鬼(レリックランダム獲得)は未所持のレリックが1つ以上あるかを
// 判定する(さらにそれ以外は常に使用可)。
export function canUseRevelation(
  _params: ShidasuParams,
  wave: WaveState,
  revelationId: RevelationId,
  relics: { id: RelicId; tsukumoka: boolean }[] = []
): boolean {
  // 妨害「封印系」により対象天啓が封印中の場合は、他の条件を満たしていても使用不可にする
  if (wave.activeSeal?.kind === 'revelationOrOracle' && wave.activeSeal.ref.kind === 'revelation' && wave.activeSeal.ref.id === revelationId) return false
  if (revelationId === 'kyo') {
    return relics.some(r => !r.tsukumoka)
  }
  if (revelationId === 'oni') {
    const ownedIds = new Set(relics.map(r => r.id))
    return RELIC_POOL.some(id => !ownedIds.has(id))
  }
  return true
}
```
を:
```ts
// 天啓が現在の盤面状態で使用可能か判定する。wave.activeSealが自分自身(revelationOrOracle・
// revelation・instanceId一致)を封印中なら他の条件に関わらず常に使用不可。それ以外では、虚(レリック付喪化)は
// 未付喪化の所持レリックが1つ以上あるか、鬼(レリックランダム獲得)は未所持のレリックが1つ以上あるかを
// 判定する(さらにそれ以外は常に使用可)。instanceIdは対象の個体。所持前に即使用する経路
// (buyIndividualRevelationUse・pickPackRevelationUse)では所持個体が存在しないため、instanceIdにnullを渡す
// (この場合、封印チェックは常にfalse=ブロックしない扱いになる。未所持のものは封印対象になり得ないため正しい)。
export function canUseRevelation(
  _params: ShidasuParams,
  wave: WaveState,
  instanceId: number | null,
  revelationId: RevelationId,
  relics: { id: RelicId; tsukumoka: boolean }[] = []
): boolean {
  // 妨害「封印系」により対象天啓(の個体)が封印中の場合は、他の条件を満たしていても使用不可にする
  if (instanceId !== null && wave.activeSeal?.kind === 'revelationOrOracle' && wave.activeSeal.ref.kind === 'revelation' && wave.activeSeal.ref.instanceId === instanceId) return false
  if (revelationId === 'kyo') {
    return relics.some(r => !r.tsukumoka)
  }
  if (revelationId === 'oni') {
    const ownedIds = new Set(relics.map(r => r.id))
    return RELIC_POOL.some(id => !ownedIds.has(id))
  }
  return true
}
```
に変更する。

- [ ] **Step 2: 型チェック・コミット**

`npm run check`を実行し、`revelationEffects.ts`自体にエラーが無いことを確認する。

```bash
git add src/lib/game/shidasu/revelationEffects.ts
git commit -m "$(cat <<'EOF'
refactor: canUseRevelationをinstanceIdベースの封印判定に変更
EOF
)"
```

---

### Task 5: shop.ts — 所持判定の変換

**Files:**
- Modify: `src/lib/game/shidasu/shop.ts:26`

- [ ] **Step 1: `rollIndividualSlot`の護符所持判定を変換する**

`src/lib/game/shidasu/shop.ts:23-30`の:
```ts
function rollIndividualSlot(run: RunState, usedItemIds: Set<ItemId>, rand: () => number): ShopIndividualSlot {
  const kind = SHOP_SLOT_KINDS[Math.floor(rand() * SHOP_SLOT_KINDS.length)]
  if (kind === 'item') {
    const available = ITEM_POOL.filter(id => !run.items.includes(id) && !usedItemIds.has(id))
```
を:
```ts
function rollIndividualSlot(run: RunState, usedItemIds: Set<ItemId>, rand: () => number): ShopIndividualSlot {
  const kind = SHOP_SLOT_KINDS[Math.floor(rand() * SHOP_SLOT_KINDS.length)]
  if (kind === 'item') {
    const available = ITEM_POOL.filter(id => !run.items.some(h => h.id === id) && !usedItemIds.has(id))
```
に変更する(以降の行は変更不要)。

- [ ] **Step 2: 型チェック・コミット**

`npm run check`を実行し、`shop.ts`自体にエラーが無いことを確認する。

```bash
git add src/lib/game/shidasu/shop.ts
git commit -m "$(cat <<'EOF'
refactor: shop.tsの護符重複判定をHeldItem対応に変更
EOF
)"
```

---

### Task 6: sabotageEffects.ts — 妨害行動ロジックの移行

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`

- [ ] **Step 1: `SabotageContext`の`useRite`・`useRevelation`関数型に`instanceId`引数を追加する**

`src/lib/game/shidasu/sabotageEffects.ts:10-24`の:
```ts
export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
  // riteForceActivate・revelationOracleForceActivate用。engine.tsに定義されているが、
  // sabotageEffects.tsからengine.tsを直接importすると循環importになるため、
  // 呼び出し元(triggerSabotage)から値として注入する。
  useRite: (params: ShidasuParams, run: RunState, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}
```
を:
```ts
export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
  // riteForceActivate・revelationOracleForceActivate用。engine.tsに定義されているが、
  // sabotageEffects.tsからengine.tsを直接importすると循環importになるため、
  // 呼び出し元(triggerSabotage)から値として注入する。
  useRite: (params: ShidasuParams, run: RunState, instanceId: number, riteId: RiteId, rand?: () => number) => RunState
  useRevelation: (
    params: ShidasuParams, run: RunState, instanceId: number, revelationId: RevelationId,
    targetCol: number | null, rand?: () => number, targetRelicId?: RelicId | null
  ) => RunState
  useOracle: (params: ShidasuParams, run: RunState, roleName: RoleName) => RunState
}
```
に変更する。

- [ ] **Step 2: `SabotageResult.forceActivatedTarget`の`rite`ケースに`instanceId`を追加する**

`src/lib/game/shidasu/sabotageEffects.ts:50-52`の:
```ts
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
```
を:
```ts
  forceActivatedTarget?:
    | { kind: 'rite'; instanceId: number; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
```
に変更する。

- [ ] **Step 3: `applyTalismanSeal`・`applyRiteSeal`・`applyRevelationOracleSeal`を`instanceId`込みで抽選するよう変更する**

`src/lib/game/shidasu/sabotageEffects.ts:110-130`の:
```ts
function applyTalismanSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const target = run.items[Math.floor(rand() * run.items.length)]
  return { wave: { activeSeal: { kind: 'talisman', id: target } } }
}

function applyRiteSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const target = run.rites[Math.floor(rand() * run.rites.length)]
  return { wave: { activeSeal: { kind: 'rite', id: target } } }
}

function applyRevelationOracleSeal({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(refId => ({ kind: 'revelation' as const, id: refId })),
    ...run.oracles.map(refId => ({ kind: 'oracle' as const, id: refId })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  return { wave: { activeSeal: { kind: 'revelationOrOracle', ref } } }
}
```
を:
```ts
function applyTalismanSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const target = run.items[Math.floor(rand() * run.items.length)]
  return { wave: { activeSeal: { kind: 'talisman', instanceId: target.instanceId, id: target.id } } }
}

function applyRiteSeal({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const target = run.rites[Math.floor(rand() * run.rites.length)]
  return { wave: { activeSeal: { kind: 'rite', instanceId: target.instanceId, id: target.id } } }
}

function applyRevelationOracleSeal({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...run.oracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  return { wave: { activeSeal: { kind: 'revelationOrOracle', ref } } }
}
```
に変更する。

- [ ] **Step 4: `applyTalismanConfiscate`・`applyRiteConfiscate`の`id`取得を`.id`プロパティ経由に変更する**

`src/lib/game/shidasu/sabotageEffects.ts:215-227`の:
```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  const id = run.items[idx]
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }, confiscatedTarget: { kind: 'talisman', id, idx } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  const id = run.rites[idx]
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }, confiscatedTarget: { kind: 'rite', id, idx } }
}
```
を:
```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  const id = run.items[idx].id
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] }, confiscatedTarget: { kind: 'talisman', id, idx } }
}

function applyRiteConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.rites.length === 0) return {}
  const idx = Math.floor(rand() * run.rites.length)
  const id = run.rites[idx].id
  return { run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] }, confiscatedTarget: { kind: 'rite', id, idx } }
}
```
に変更する(`confiscatedTarget`自体の形は変更しない、idxベースのまま維持)。

- [ ] **Step 5: `applyRiteForceActivate`をinstanceId対応にする**

`src/lib/game/shidasu/sabotageEffects.ts:241-253`の:
```ts
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'rite', id: target } }
}
```
を:
```ts
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(h => canUseRite(params, wave, h.instanceId, h.id))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target.instanceId, target.id, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'rite', instanceId: target.instanceId, id: target.id } }
}
```
に変更する。

- [ ] **Step 6: `applyTalismanShuffle`は変更不要であることを確認する**

`src/lib/game/shidasu/sabotageEffects.ts:255-259`の`applyTalismanShuffle`は`run.items`配列(要素が`HeldItem`になる)をそのままシャッフルするだけで、要素の中身に依存しないためコード変更は不要。念のため`shuffleInPlace`のシグネチャがジェネリック(`<T>`)であることを`src/lib/game/shidasu/deck.ts`で確認する。

- [ ] **Step 7: `applyRevelationOracleConfiscate`をHeldオブジェクトの`.id`経由に変更する**

`src/lib/game/shidasu/sabotageEffects.ts:261-285`の:
```ts
function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(id => ({ kind: 'revelation' as const, id })),
    ...run.oracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  // poolIdxをそのままidxの算出元にする(indexOfだと同名の天啓・神託を複数所持している場合、
  // 常に最初の要素の位置を指してしまい、実際に削除される要素の位置とズレるため)。
  const poolIdx = Math.floor(rand() * pool.length)
  const ref = pool[poolIdx]
  if (ref.kind === 'revelation') {
    const idx = poolIdx
    return {
      run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] },
      confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
    }
  }
  // 神託を没収してもoracleLevelsは変更しない: run.oraclesに温存中の神託はまだuseOracleで
  // 消費していないためoracleLevelsに未反映であり、没収してもそこに減らすべき実績が無い
  const idx = poolIdx - run.revelations.length
  return {
    run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] },
    confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
  }
}
```
を:
```ts
function applyRevelationOracleConfiscate({ run, rand }: SabotageContext): SabotageResult {
  const pool: HeldRevelationOrOracleRef[] = [
    ...run.revelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...run.oracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  // poolIdxをそのままidxの算出元にする(indexOfだと同名の天啓・神託を複数所持している場合、
  // 常に最初の要素の位置を指してしまい、実際に削除される要素の位置とズレるため)。
  const poolIdx = Math.floor(rand() * pool.length)
  const ref = pool[poolIdx]
  if (ref.kind === 'revelation') {
    const idx = poolIdx
    return {
      run: { revelations: [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)] },
      confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
    }
  }
  // 神託を没収してもoracleLevelsは変更しない: run.oraclesに温存中の神託はまだuseOracleで
  // 消費していないためoracleLevelsに未反映であり、没収してもそこに減らすべき実績が無い
  const idx = poolIdx - run.revelations.length
  return {
    run: { oracles: [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)] },
    confiscatedTarget: { kind: 'revelationOrOracle', ref, idx },
  }
}
```
に変更する(`ref`が`instanceId`を含むようになった点のみが変更で、idxベースの削除ロジック自体は変更しない)。

- [ ] **Step 8: `applyRevelationOracleForceActivate`をinstanceId対応にする**

`src/lib/game/shidasu/sabotageEffects.ts:287-308`の:
```ts
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(id => canUseRevelation(params, wave, id, run.relics))
  // useOracleはuseRite/useRevelationと違いwave.statusを見ないため、ここで明示的にガードする。
  // (triggerSabotageはwave.status==='ended'になった直後にも呼ばれうる。天啓側はuseRevelation内部の
  // ガードで自然にno-opになるが、神託側だけ無条件に消費されてしまうと非対称な挙動になるため)
  const usableOracles = wave.status === 'playing' ? run.oracles : []
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(id => ({ kind: 'revelation' as const, id })),
    ...usableOracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
}
```
を:
```ts
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(h => canUseRevelation(params, wave, h.instanceId, h.id, run.relics))
  // useOracleはuseRite/useRevelationと違いwave.statusを見ないため、ここで明示的にガードする。
  // (triggerSabotageはwave.status==='ended'になった直後にも呼ばれうる。天啓側はuseRevelation内部の
  // ガードで自然にno-opになるが、神託側だけ無条件に消費されてしまうと非対称な挙動になるため)
  const usableOracles = wave.status === 'playing' ? run.oracles : []
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(h => ({ kind: 'revelation' as const, instanceId: h.instanceId, id: h.id })),
    ...usableOracles.map(h => ({ kind: 'oracle' as const, instanceId: h.instanceId, id: h.id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.instanceId, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
}
```
に変更する。

- [ ] **Step 9: 型チェックでこのファイルにエラーが無いことを確認する**

`npm run check`を実行し、`sabotageEffects.ts`自体にエラーが無いことを確認する。

- [ ] **Step 10: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts
git commit -m "$(cat <<'EOF'
refactor: sabotageEffects.tsの封印・没収・強制発動をinstanceIdベースに移行
EOF
)"
```

---

### Task 7: PlayArea.svelte — 秘儀・天啓バッジのinstanceId対応

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: 型インポートに`HeldRite`・`HeldRevelation`を追加する**

`src/routes/game/shidasu/PlayArea.svelte:45`の:
```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, RelicId, Card, PlayCardResult, ScoreGain, RoleName } from '$lib/game/shidasu/types'
```
を:
```ts
  import type { WaveState, StageModifier, ItemId, RiteId, RevelationId, HeldRite, HeldRevelation, RelicId, Card, PlayCardResult, ScoreGain, RoleName } from '$lib/game/shidasu/types'
```
に変更する。

- [ ] **Step 2: `rites`・`revelations`propsと`onUseRite`・`onUseRevelationClick`propsの型を変更する**

`src/routes/game/shidasu/PlayArea.svelte:82-86`の:
```ts
    rites?: RiteId[]
    onUseRite?: (riteId: RiteId) => void
    disableRites?: boolean
    revelations?: RevelationId[]
    onUseRevelationClick?: (revelationId: RevelationId) => void
```
を:
```ts
    rites?: HeldRite[]
    onUseRite?: (instanceId: number, riteId: RiteId) => void
    disableRites?: boolean
    revelations?: HeldRevelation[]
    onUseRevelationClick?: (instanceId: number, revelationId: RevelationId) => void
```
に変更する(`items`propsの型`ItemId[]`は変更しない。PlayAreaのitems propsは`isPlayable`/`getPlayableColumns`にのみ使われる純粋な配列で、呼び出し元(+page.svelte)で変換する)。

- [ ] **Step 3: 秘儀バッジ描画ブロックをinstanceId対応にする**

`src/routes/game/shidasu/PlayArea.svelte:1735-1755`の:
```svelte
{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite') || (pressPulseTarget?.kind === 'rite' && !rites.includes(pressPulseTarget.id))}
  {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
  {@const ritePulseFading = pressPulseTarget?.kind === 'rite' && !rites.includes(pressPulseTarget.id) ? pressPulseTarget : undefined}
  {@const displayedRites = withFadingId(withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0), ritePulseFading?.id, rites.length)}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each displayedRites as riteId, i (i)}
      {@const fading = riteFading !== undefined && i === riteFading.idx}
      {@const usable = !fading && canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      {@const pulsing = pressPulseTarget?.kind === 'rite' && pressPulseTarget.id === riteId}
      <button
        type="button"
        onclick={() => { startPressPulseAnimation({ kind: 'rite', id: riteId }); onUseRite?.(riteId) }}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {fading ? 'shidasu-confiscate-fade' : ''} {flashing ? 'shidasu-seal-flash' : ''} {pulsing ? 'shidasu-press-pulse' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```
を:
```svelte
{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite') || (pressPulseTarget?.kind === 'rite' && !rites.some(h => h.instanceId === pressPulseTarget.instanceId))}
  {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? { instanceId: -1, id: confiscateFadingTarget.id, idx: confiscateFadingTarget.idx } : undefined}
  {@const ritePulseFading = pressPulseTarget?.kind === 'rite' && !rites.some(h => h.instanceId === pressPulseTarget.instanceId) ? { instanceId: pressPulseTarget.instanceId, id: pressPulseTarget.id } : undefined}
  {@const displayedRites = withFadingId(withFadingId(rites, riteFading, riteFading?.idx ?? 0), ritePulseFading, rites.length)}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each displayedRites as h, i (i)}
      {@const fading = riteFading !== undefined && i === riteFading.idx}
      {@const usable = !fading && canUseRite(params, wave, h.instanceId, h.id) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.instanceId === h.instanceId}
      {@const pulsing = pressPulseTarget?.kind === 'rite' && pressPulseTarget.instanceId === h.instanceId}
      <button
        type="button"
        onclick={() => { startPressPulseAnimation({ kind: 'rite', instanceId: h.instanceId, id: h.id }); onUseRite?.(h.instanceId, h.id) }}
        disabled={!usable}
        title={riteDesc(h.id, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {fading ? 'shidasu-confiscate-fade' : ''} {flashing ? 'shidasu-seal-flash' : ''} {pulsing ? 'shidasu-press-pulse' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[h.id].name}</button>
    {/each}
  </div>
{/if}
```
に変更する。`riteFading`は`confiscatedTarget`(idベース、instanceId無し)から`withFadingId`が要求する`HeldRite`形の値を合成するため、`instanceId: -1`という実在しないダミー値を使う(この要素はフェードアウト演出中のみ表示され、クリック等のインタラクションは`talismanConfiscateFading`相当のガードで既に無効化されるため、instanceIdが本物である必要は無い)。

- [ ] **Step 4: 天啓バッジ描画ブロックをinstanceId対応にする**

`src/routes/game/shidasu/PlayArea.svelte:1757-1770`付近(`{#if revelations.length > 0 ...}`ブロック)を、Step 3と同じ考え方で変更する。まず現在の内容を確認するため、`src/routes/game/shidasu/PlayArea.svelte`の1757行目から、対応する`{/if}`までを`Read`ツールで読み、以下の変換ルールを適用する:
- `revelations.includes(pressPulseTarget.ref.id)` → `revelations.some(h => h.instanceId === pressPulseTarget.ref.instanceId)`
- `withFadingId(revelations, revelationPulseFading, revelations.length)`の`revelationPulseFading`を、`pressPulseTarget.ref.id`ではなく`{ instanceId: pressPulseTarget.ref.instanceId, id: pressPulseTarget.ref.id }`に変更する
- `{#each displayedRevelations as revelationId, i (i)}`を`{#each displayedRevelations as h, i (i)}`に変更し、以降の`revelationId`参照をすべて`h.id`に、`canUseRevelation(params, wave, revelationId, relics)`を`canUseRevelation(params, wave, h.instanceId, h.id, relics)`に変更する
- `sealFlashTarget?.ref.id === revelationId`を`sealFlashTarget?.ref.instanceId === h.instanceId`に変更する
- `pressPulseTarget?.ref.id === revelationId`を`pressPulseTarget?.ref.instanceId === h.instanceId`に変更する
- `onclick`ハンドラの`startPressPulseAnimation({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: revelationId } })`を`startPressPulseAnimation({ kind: 'revelationOrOracle', ref: { kind: 'revelation', instanceId: h.instanceId, id: h.id } })`に変更し、`onUseRevelationClick?.(revelationId)`を`onUseRevelationClick?.(h.instanceId, h.id)`に変更する

- [ ] **Step 5: 型チェックでこのファイルにエラーが無いことを確認する**

`npm run check`を実行し、`PlayArea.svelte`自体にエラーが無いことを確認する(`+page.svelte`・admin debug pageは後続タスクで対応するため、それらのエラーは無視してよい)。

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "$(cat <<'EOF'
refactor: PlayArea.svelteの秘儀・天啓バッジをinstanceId対応にする
EOF
)"
```

---

### Task 8: +page.svelte — 護符・秘儀・天啓・神託UI全体の移行

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: 型インポートを更新する**

`src/routes/game/shidasu/+page.svelte:32`の:
```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId, ShopSlotKind, RelicId } from '$lib/game/shidasu/types'
```
を:
```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, PlayCardResult, Star, WaveState, CardSetGenreId, ShopSlotKind, RelicId } from '$lib/game/shidasu/types'
```
(変更なし、既にimport済みの型で足りる。`HeldItem`等の明示的な型注釈は今回のUIコードでは不要)。

- [ ] **Step 2: `handleUseRite`にinstanceId引数を追加する**

`src/routes/game/shidasu/+page.svelte:235-238`の:
```ts
  function handleUseRite(riteId: RiteId) {
    run = useRite(params, run, riteId)
    if (run.phase === 'playing') afterAction()
  }
```
を:
```ts
  function handleUseRite(instanceId: number, riteId: RiteId) {
    run = useRite(params, run, instanceId, riteId)
    if (run.phase === 'playing') afterAction()
  }
```
に変更する。

- [ ] **Step 3: `pendingRevelationTarget`の`held`バリアントに`instanceId`を追加する**

`src/routes/game/shidasu/+page.svelte:421-426`の:
```ts
  let pendingRevelationTarget = $state<
    | { revelationId: RevelationId; source: 'individual'; slotIndex: number }
    | { revelationId: RevelationId; source: 'pack' }
    | { revelationId: RevelationId; source: 'held' }
    | null
  >(null)
```
を:
```ts
  let pendingRevelationTarget = $state<
    | { revelationId: RevelationId; source: 'individual'; slotIndex: number }
    | { revelationId: RevelationId; source: 'pack' }
    | { revelationId: RevelationId; source: 'held'; instanceId: number }
    | null
  >(null)
```
に変更する。

- [ ] **Step 4: `pendingRelicTargetRevelationId`を`pendingRelicTarget`(instanceId込み)にリネームする**

`src/routes/game/shidasu/+page.svelte:429`の:
```ts
  let pendingRelicTargetRevelationId = $state<RevelationId | null>(null)
```
を:
```ts
  let pendingRelicTarget = $state<{ instanceId: number; revelationId: RevelationId } | null>(null)
```
に変更する。

- [ ] **Step 5: `handleUseRevelationClick`にinstanceId引数を追加する**

`src/routes/game/shidasu/+page.svelte:471-499`の:
```ts
  function handleUseRevelationClick(revelationId: RevelationId) {
    if (revelationId === 'kyo') {
      pendingRelicTargetRevelationId = 'kyo'
      return
    }
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held' }
      // 既にプレビュー表示中(天啓福袋選択中)なら再生成しない。再生成すると場札が
      // 意図せず再シャッフルされ、ユーザーに見せていた盤面と食い違ってしまう
      // (福袋の「使用」ボタンで踏んだのと同種の問題)。
      if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
        beginRevelationPreview()
      }
      return
    }
    if (revelationPreviewWave) {
      // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
      // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
      const previewResultWave = applyToRevelationPreview((runForPreview) =>
        useRevelation(params, runForPreview, revelationId, null)
      )
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, revelationId, null)
    if (run.phase === 'playing') afterAction()
  }

  function handleConfirmRelicTarget(relicId: RelicId) {
    if (!pendingRelicTargetRevelationId) return
    const revelationId = pendingRelicTargetRevelationId
    pendingRelicTargetRevelationId = null
    run = useRevelation(params, run, revelationId, null, Math.random, relicId)
    if (run.phase === 'playing') afterAction()
  }

  function handleCancelRelicTarget() {
    pendingRelicTargetRevelationId = null
  }
```
を:
```ts
  function handleUseRevelationClick(instanceId: number, revelationId: RevelationId) {
    if (revelationId === 'kyo') {
      pendingRelicTarget = { instanceId, revelationId }
      return
    }
    if (revelationNeedsTarget(revelationId)) {
      pendingRevelationTarget = { revelationId, source: 'held', instanceId }
      // 既にプレビュー表示中(天啓福袋選択中)なら再生成しない。再生成すると場札が
      // 意図せず再シャッフルされ、ユーザーに見せていた盤面と食い違ってしまう
      // (福袋の「使用」ボタンで踏んだのと同種の問題)。
      if (SHOP_FLOW_PHASES.includes(run.phase) && !revelationPreviewWave) {
        beginRevelationPreview()
      }
      return
    }
    if (revelationPreviewWave) {
      // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
      // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
      const previewResultWave = applyToRevelationPreview((runForPreview) =>
        useRevelation(params, runForPreview, instanceId, revelationId, null)
      )
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
    run = useRevelation(params, run, instanceId, revelationId, null)
    if (run.phase === 'playing') afterAction()
  }

  function handleConfirmRelicTarget(relicId: RelicId) {
    if (!pendingRelicTarget) return
    const { instanceId, revelationId } = pendingRelicTarget
    pendingRelicTarget = null
    run = useRevelation(params, run, instanceId, revelationId, null, Math.random, relicId)
    if (run.phase === 'playing') afterAction()
  }

  function handleCancelRelicTarget() {
    pendingRelicTarget = null
  }
```
に変更する。

- [ ] **Step 6: `handleTargetColumn`のheldケースにinstanceId引数を追加する**

`src/routes/game/shidasu/+page.svelte:533-564`の`applyToRevelationPreview`内の:
```ts
        return useRevelation(params, runForPreview, target.revelationId, colIndex)
```
を:
```ts
        return useRevelation(params, runForPreview, target.instanceId, target.revelationId, colIndex)
```
に変更する(この行はif/else ifで`individual`/`pack`を除外した残りのケース=`held`のため、`target`は`{ revelationId; source: 'held'; instanceId }`型に絞り込まれており、`target.instanceId`にアクセスできる)。

同じ関数内、if/elseの`else`ブロックの:
```ts
    } else {
      run = useRevelation(params, run, target.revelationId, colIndex)
      if (run.phase === 'playing') afterAction()
    }
```
を:
```ts
    } else {
      run = useRevelation(params, run, target.instanceId, target.revelationId, colIndex)
      if (run.phase === 'playing') afterAction()
    }
```
に変更する。

- [ ] **Step 7: `pendingRelicTargetRevelationId`の残る参照(条件式・オーバーレイ表示)を`pendingRelicTarget`に置き換える**

`src/routes/game/shidasu/+page.svelte:827`の:
```svelte
{#if pendingRelicTargetRevelationId}
```
を:
```svelte
{#if pendingRelicTarget}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:858`の:
```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen && !pendingRelicTargetRevelationId}
```
を:
```svelte
{#if run.phase === 'shop' && run.shop && !pendingRevelationTarget && !revelationPreviewWave && !showStageScreen && !pendingRelicTarget}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:1201`の:
```svelte
{#if run.phase === 'shop' && !pendingRevelationTarget && !revelationPreviewWave && showStageScreen}
```
は`pendingRelicTargetRevelationId`を参照していないため変更不要(確認のみ)。

- [ ] **Step 8: `handleSellItem`・`handleSellRite`・`handleSellRevelation`・`handleSellOracle`をinstanceId対応にする**

`src/routes/game/shidasu/+page.svelte:327-329`の`bindParamsRunAction`は以下の通り、追加引数を1個だけ受け取る前提の実装になっている:
```ts
  function bindParamsRunAction<TArg>(fn: (params: ShidasuParams, run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
    return (arg: TArg) => { run = fn(params, run, arg) }
  }
```
`sellItem`等のシグネチャが`(params, run, instanceId, itemId)`という2つの追加引数を取る形に変わったため、この汎用ラッパーではそのまま包めない。`src/routes/game/shidasu/+page.svelte:414-417`の:
```ts
  const handleSellItem = bindParamsRunAction(sellItem)
  const handleSellRite = bindParamsRunAction(sellRite)
  const handleSellRevelation = bindParamsRunAction(sellRevelation)
  const handleSellOracle = bindParamsRunAction(sellOracle)
```
を:
```ts
  function handleSellItem(instanceId: number, itemId: ItemId) {
    run = sellItem(params, run, instanceId, itemId)
  }
  function handleSellRite(instanceId: number, riteId: RiteId) {
    run = sellRite(params, run, instanceId, riteId)
  }
  function handleSellRevelation(instanceId: number, revelationId: RevelationId) {
    run = sellRevelation(params, run, instanceId, revelationId)
  }
  function handleSellOracle(instanceId: number, roleName: RoleName) {
    run = sellOracle(params, run, instanceId, roleName)
  }
```
に変更する(`bindParamsRunAction`自体は他の1引数アクション、例えば`handlePickPackItem`等で引き続き使われるため、削除せずそのまま残す)。

呼び出し側(`handleSellItem(itemId)`のような1引数呼び出し)は、Step 9・10・12でinstanceId込みの2引数呼び出しに変更する。

- [ ] **Step 9: `itemBadges`スニペット(603-660行目)をinstanceId対応にする**

`src/routes/game/shidasu/+page.svelte:603-660`の:
```svelte
{#snippet itemBadges(anyAnimationActive: boolean)}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? confiscateFadingTarget : undefined}
  {@const displayedItems = withFadingId(run.items, talismanFading?.id, talismanFading?.idx ?? 0)}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItems as itemId, i (i)}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.id === itemId}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.id === itemId}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading !== undefined && i === talismanFading.idx}
        <span
          role="button"
          tabindex="0"
          data-item-index={i}
          onpointerdown={(e) => !anyAnimationActive && !talismanConfiscateFading && handleItemPointerDown(i, e)}
          onpointermove={handleItemPointerMove}
          onpointerup={handleItemPointerUp}
          onpointercancel={handleItemPointerUp}
          class="text-xs rounded px-1.5 py-0.5 touch-none select-none {anyAnimationActive || talismanConfiscateFading ? '' : 'cursor-grab'} {draggingItemIndex === i ? 'ring-2 ring-teal-400' : ''} {highlightedItemId === itemId ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing || talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(itemId, params)}
        >
          {talismanHidden ? '？？？' : itemName(itemId, params)}
        </span>
      {/each}
    </div>
```
を:
```svelte
{#snippet itemBadges(anyAnimationActive: boolean)}
  {@const talismanFading = confiscateFadingTarget?.kind === 'talisman' ? { instanceId: -1, id: confiscateFadingTarget.id, idx: confiscateFadingTarget.idx } : undefined}
  {@const displayedItems = withFadingId(run.items, talismanFading, talismanFading?.idx ?? 0)}
  <div class="flex-1 flex flex-col gap-1 items-end">
    <div class="flex flex-wrap gap-1 justify-end">
      {#each displayedItems as h, i (i)}
        {@const itemId = h.id}
        {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
        {@const talismanSealed = wave?.activeSeal?.kind === 'talisman' && wave.activeSeal.instanceId === h.instanceId}
        {@const talismanFlashing = sealFlashTarget?.kind === 'talisman' && sealFlashTarget.instanceId === h.instanceId}
        {@const talismanShuffleFlashing = talismanShuffleFlashActive && talismanHidden}
        {@const talismanConfiscateFading = talismanFading !== undefined && i === talismanFading.idx}
        <span
          role="button"
          tabindex="0"
          data-item-index={i}
          onpointerdown={(e) => !anyAnimationActive && !talismanConfiscateFading && handleItemPointerDown(i, e)}
          onpointermove={handleItemPointerMove}
          onpointerup={handleItemPointerUp}
          onpointercancel={handleItemPointerUp}
          class="text-xs rounded px-1.5 py-0.5 touch-none select-none {anyAnimationActive || talismanConfiscateFading ? '' : 'cursor-grab'} {draggingItemIndex === i ? 'ring-2 ring-teal-400' : ''} {highlightedItemId === itemId ? 'ring-2 ring-yellow-400' : ''} {talismanConfiscateFading ? 'shidasu-confiscate-fade' : ''} {talismanFlashing || talismanShuffleFlashing ? 'shidasu-seal-flash' : ''} {talismanHidden || talismanSealed ? 'border' : 'bg-emerald-900 text-yellow-200/90 border border-yellow-600/40'}"
          style={talismanHidden || talismanSealed ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
          title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : talismanSealed ? '護符封印: 次の妨害発動まで効果が無効' : itemDesc(itemId, params)}
        >
          {talismanHidden ? '？？？' : itemName(itemId, params)}
        </span>
      {/each}
    </div>
```
に変更する。`highlightedItemId`(型`ItemId | null`)との比較(`highlightedItemId === itemId`)は`itemId`が`h.id`から取り出した`ItemId`のままなので変更不要。

- [ ] **Step 10: `itemBadges`スニペット内の天啓・神託バッジ(630-660行目)をinstanceId対応にする**

`src/routes/game/shidasu/+page.svelte:630-660`の:
```svelte
    {#if run.revelations.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'revelation'}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const revelationFading = revelationOrOracleFading?.ref.kind === 'revelation' ? { idx: revelationOrOracleFading.idx, id: revelationOrOracleFading.ref.id } : undefined}
      {@const displayedRevelations = withFadingId(run.revelations, revelationFading?.id, revelationFading?.idx ?? 0)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRevelations as id, i (i)}
          {@const fading = revelationFading !== undefined && i === revelationFading.idx}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={revelationDesc(id, params)}>
            {revelationName(id, params)}
            <button onclick={() => handleSellRevelation(id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle' || pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.includes(pressPulseTarget.ref.id)}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const oracleFading = revelationOrOracleFading?.ref.kind === 'oracle' ? { idx: revelationOrOracleFading.idx, id: revelationOrOracleFading.ref.id } : undefined}
      {@const oraclePulseFading = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.includes(pressPulseTarget.ref.id) ? pressPulseTarget.ref.id : undefined}
      {@const displayedOracles = withFadingId(withFadingId(run.oracles, oracleFading?.id, oracleFading?.idx ?? 0), oraclePulseFading, run.oracles.length)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedOracles as roleName, i (i)}
          {@const fading = oracleFading !== undefined && i === oracleFading.idx}
          {@const oraclePulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && pressPulseTarget.ref.id === roleName}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={oracleDesc(roleName, params)}>
            {oracleName(roleName, params)}
            <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline {oraclePulsing ? 'shidasu-press-pulse' : ''}">使</button>
            <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
```
を:
```svelte
    {#if run.revelations.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'revelation'}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const revelationFading = revelationOrOracleFading?.ref.kind === 'revelation' ? { idx: revelationOrOracleFading.idx, instanceId: revelationOrOracleFading.ref.instanceId, id: revelationOrOracleFading.ref.id } : undefined}
      {@const displayedRevelations = withFadingId(run.revelations, revelationFading, revelationFading?.idx ?? 0)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRevelations as h, i (i)}
          {@const fading = revelationFading !== undefined && i === revelationFading.idx}
          <span class="text-xs bg-indigo-900 text-indigo-200/90 border border-indigo-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={revelationDesc(h.id, params)}>
            {revelationName(h.id, params)}
            <button onclick={() => handleSellRevelation(h.instanceId, h.id)} class="text-indigo-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
    {#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle' || pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.some(h => h.instanceId === pressPulseTarget.ref.instanceId)}
      {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
      {@const oracleFading = revelationOrOracleFading?.ref.kind === 'oracle' ? { idx: revelationOrOracleFading.idx, instanceId: revelationOrOracleFading.ref.instanceId, id: revelationOrOracleFading.ref.id } : undefined}
      {@const oraclePulseFading = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && !run.oracles.some(h => h.instanceId === pressPulseTarget.ref.instanceId) ? { instanceId: pressPulseTarget.ref.instanceId, id: pressPulseTarget.ref.id } : undefined}
      {@const displayedOracles = withFadingId(withFadingId(run.oracles, oracleFading, oracleFading?.idx ?? 0), oraclePulseFading, run.oracles.length)}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedOracles as h, i (i)}
          {@const fading = oracleFading !== undefined && i === oracleFading.idx}
          {@const oraclePulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && pressPulseTarget.ref.instanceId === h.instanceId}
          <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={oracleDesc(h.id, params)}>
            {oracleName(h.id, params)}
            <button onclick={() => handleUseOracle(h.id)} class="text-purple-300/70 underline {oraclePulsing ? 'shidasu-press-pulse' : ''}">使</button>
            <button onclick={() => handleSellOracle(h.instanceId, h.id)} class="text-purple-300/70 underline">売</button>
          </span>
        {/each}
      </div>
    {/if}
```
に変更する(`handleUseOracle`は`useOracle`のシグネチャ据え置き方針により`roleName`のまま、`h.id`を渡す)。

- [ ] **Step 11: `<PlayArea>`呼び出し3箇所を更新する**

`src/routes/game/shidasu/+page.svelte:743`の:
```svelte
    <PlayArea wave={measurementWave} {params} modifier={currentModifier} {target} items={run.items} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
```
を:
```svelte
    <PlayArea wave={measurementWave} {params} modifier={currentModifier} {target} items={run.items.map(h => h.id)} onPlayCard={handlePlayCard} onDraw={handleDraw} headerExtra={stageRow} extraFooter={itemBadges} rites={run.rites} onUseRite={handleUseRite} />
```
に変更する。

`src/routes/game/shidasu/+page.svelte:772`の:
```svelte
    {wave} {params} modifier={currentModifier} {target} items={run.items}
```
を:
```svelte
    {wave} {params} modifier={currentModifier} {target} items={run.items.map(h => h.id)}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:809`の:
```svelte
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items}
```
を:
```svelte
        wave={revelationPreviewWave} {params} modifier={currentModifier} target={0} items={run.items.map(h => h.id)}
```
に変更する。

`rites={run.rites}`・`revelations={run.revelations}`・`onUseRite={handleUseRite}`・`onUseRevelationClick={handleUseRevelationClick}`は、propsの型・関数シグネチャが既にHeld形/instanceId対応になっているため**変更不要**(直接渡すだけでよい)。念のため`src/routes/game/shidasu/+page.svelte`全体で`items={run.items}`をGrep検索し、上記3箇所以外に残っていないことを確認する。

- [ ] **Step 12: 「所持護符」「その他の所持品」インライン一覧(960-1007行目)をinstanceId対応にする**

`src/routes/game/shidasu/+page.svelte:968-1007`の:
```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as itemId, i (itemId)}
            {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
            <div
              role="button"
              tabindex="0"
              data-item-index={i}
              title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(itemId, params)}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs px-2 py-1 rounded border touch-none select-none {talismanHidden ? '' : (draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md text-slate-800' : 'border-slate-200 bg-white cursor-grab text-slate-800')}"
              style={talismanHidden ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
            >
              <span>{talismanHidden ? '？？？' : itemName(itemId, params)}</span>
              <button onpointerdown={(e) => e.stopPropagation()} onclick={() => handleSellItem(itemId)} class="{talismanHidden ? '' : 'text-slate-400 hover:text-slate-700'}">売({talismanHidden ? '？' : itemSellPrice(params, run, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">その他の所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.rites as riteId}
            <button title={riteDesc(riteId, params)} onclick={() => handleUseRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 使用</button>
            <button title={riteDesc(riteId, params)} onclick={() => handleSellRite(riteId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(riteId, params)} 売({riteSellPrice(params, run)})</button>
          {/each}
          {#each run.revelations as revelationId}
            <button title={revelationDesc(revelationId, params)} onclick={() => handleUseRevelationClick(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 使用</button>
            <button title={revelationDesc(revelationId, params)} onclick={() => handleSellRevelation(revelationId)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(revelationId, params)} 売({revelationSellPrice(params, run)})</button>
          {/each}
          {#each run.oracles as roleName}
            <button title={oracleDesc(roleName, params)} onclick={() => handleSellOracle(roleName)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(roleName, params)} 売({oracleSellPrice(params, run)})</button>
          {/each}
        </div>
      </div>
```
を:
```svelte
      <div class="space-y-2">
        <p class="text-xs text-slate-500">所持護符(ドラッグで並べ替え・売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.items as h, i (h.instanceId)}
            {@const itemId = h.id}
            {@const talismanHidden = wave?.activeSeal?.kind === 'talismanHidden'}
            <div
              role="button"
              tabindex="0"
              data-item-index={i}
              title={talismanHidden ? '護符並び替え: 次の妨害発動まで内容が見えない' : itemDesc(itemId, params)}
              onpointerdown={(e) => handleItemPointerDown(i, e)}
              onpointermove={handleItemPointerMove}
              onpointerup={handleItemPointerUp}
              onpointercancel={handleItemPointerUp}
              class="flex items-center gap-1 text-xs px-2 py-1 rounded border touch-none select-none {talismanHidden ? '' : (draggingItemIndex === i ? 'border-teal-500 bg-teal-50 shadow-md text-slate-800' : 'border-slate-200 bg-white cursor-grab text-slate-800')}"
              style={talismanHidden ? 'background:#1c1917; color:#78350f; border-color: rgba(217,119,6,0.5); background-image: repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(217,119,6,0.35) 5px,rgba(217,119,6,0.35) 6px);' : ''}
            >
              <span>{talismanHidden ? '？？？' : itemName(itemId, params)}</span>
              <button onpointerdown={(e) => e.stopPropagation()} onclick={() => handleSellItem(h.instanceId, itemId)} class="{talismanHidden ? '' : 'text-slate-400 hover:text-slate-700'}">売({talismanHidden ? '？' : itemSellPrice(params, run, itemId)})</button>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-slate-500">その他の所持品(売却可)</p>
        <div class="flex flex-wrap gap-1">
          {#each run.rites as h (h.instanceId)}
            <button title={riteDesc(h.id, params)} onclick={() => handleUseRite(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(h.id, params)} 使用</button>
            <button title={riteDesc(h.id, params)} onclick={() => handleSellRite(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{riteName(h.id, params)} 売({riteSellPrice(params, run)})</button>
          {/each}
          {#each run.revelations as h (h.instanceId)}
            <button title={revelationDesc(h.id, params)} onclick={() => handleUseRevelationClick(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(h.id, params)} 使用</button>
            <button title={revelationDesc(h.id, params)} onclick={() => handleSellRevelation(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{revelationName(h.id, params)} 売({revelationSellPrice(params, run)})</button>
          {/each}
          {#each run.oracles as h (h.instanceId)}
            <button title={oracleDesc(h.id, params)} onclick={() => handleSellOracle(h.instanceId, h.id)} class="text-xs text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">{oracleName(h.id, params)} 売({oracleSellPrice(params, run)})</button>
          {/each}
        </div>
      </div>
```
に変更する。

- [ ] **Step 13: 福袋スワップ選択UI(itemSelect・riteSelect・oracleSelect)をinstanceId対応にする**

`src/routes/game/shidasu/+page.svelte:1032-1034`の(riteSelectのスワップ候補):
```svelte
          {#each run.rites as riteId}
            <button onclick={() => handleConfirmPackRiteSwap(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
```
を:
```svelte
          {#each run.rites as h (h.instanceId)}
            <button onclick={() => handleConfirmPackRiteSwap(h.instanceId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{h.id}</button>
          {/each}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:1093-1102`の(itemSelectのスワップ候補):
```svelte
          {#each run.items as id, i (i)}
            <button
              onclick={() => handleConfirmPackItemSwap(id)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
            </button>
          {/each}
```
を:
```svelte
          {#each run.items as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackItemSwap(h.instanceId)}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >
              <div class="font-black text-yellow-300">{itemName(h.id, params)}</div>
              <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(h.id, params)}</div>
            </button>
          {/each}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:1121-1132`の(oracleSelectのスワップ候補、天啓・神託両方):
```svelte
          {#each run.revelations as id (id)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'revelation', id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{revelationName(id, params)}</button>
          {/each}
          {#each run.oracles as roleName (roleName)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'oracle', id: roleName })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{oracleName(roleName, params)}</button>
          {/each}
```
を:
```svelte
          {#each run.revelations as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'revelation', instanceId: h.instanceId, id: h.id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{revelationName(h.id, params)}</button>
          {/each}
          {#each run.oracles as h (h.instanceId)}
            <button
              onclick={() => handleConfirmPackOracleSwap({ kind: 'oracle', instanceId: h.instanceId, id: h.id })}
              class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
            >{oracleName(h.id, params)}</button>
          {/each}
```
に変更する。

`src/routes/game/shidasu/+page.svelte:695-700`の(`revelationSelect`フェーズの同種スワップUI):
```svelte
        {#each run.revelations as id (id)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'revelation', id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{revelationName(id, params)}</button>
        {/each}
        {#each run.oracles as roleName (roleName)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'oracle', id: roleName })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{oracleName(roleName, params)}</button>
        {/each}
```
を:
```svelte
        {#each run.revelations as h (h.instanceId)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'revelation', instanceId: h.instanceId, id: h.id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{revelationName(h.id, params)}</button>
        {/each}
        {#each run.oracles as h (h.instanceId)}
          <button onclick={() => handleConfirmPackRevelationSwap({ kind: 'oracle', instanceId: h.instanceId, id: h.id })} class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-lg px-2 py-1.5 text-emerald-100">{oracleName(h.id, params)}</button>
        {/each}
```
に変更する。

- [ ] **Step 14: `run.oracles.includes(...)`のような残る所持判定を`.some(h => h.id === ...)`に置き換える**

`src/routes/game/shidasu/+page.svelte`全体を対象に`run.oracles.includes(`・`run.items.includes(`・`run.rites.includes(`・`run.revelations.includes(`をGrepで検索し、Step 9〜13で対応済みの箇所以外に見つかった場合は`.some(h => h.id === ...)`に置き換える。

- [ ] **Step 15: 型チェックでこのファイルにエラーが無いことを確認する**

`npm run check`を実行し、`+page.svelte`自体にエラーが無いことを確認する(admin debug page・テストファイルのエラーは後続タスクで解消するため無視してよい)。

- [ ] **Step 16: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: +page.svelteの護符・秘儀・天啓・神託UIをinstanceId対応にする
EOF
)"
```

---

### Task 9: admin/shidasu-debug/+page.svelte — デバッグ画面の移行

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: 型インポートを更新し、ローカルstateの型を`Held*[]`に変更する**

`src/routes/admin/shidasu-debug/+page.svelte:19`の型インポート行に`HeldItem, HeldRite, HeldRevelation, HeldOracle`を追加する。

`src/routes/admin/shidasu-debug/+page.svelte:33-54`の:
```ts
  function loadSavedItems(): ItemId[] {
    try {
      const saved = localStorage.getItem(ITEMS_STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? (parsed as ItemId[]) : []
    } catch {
      return []
    }
  }

  let items = $state<ItemId[]>(loadSavedItems())
  let draggingItemIndex = $state<number | null>(null)
  // 秘儀・天啓・神託の所持リスト。護符(items)と異なりlocalStorage永続化はせず、
  // プレイ中に手動でチェックして追加・削除する想定のシンプルなstate。
  let rites = $state<RiteId[]>([])
  let revelations = $state<RevelationId[]>([])
  let oracles = $state<RoleName[]>([])
  let highlightedItemId = $state<ItemId | null>(null)
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let oracleLevels = $state<Record<RoleName, number>>(defaultOracleLevels())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition, undefined, 0, oracleLevels).wave)
```
を:
```ts
  function loadSavedItems(): ItemId[] {
    try {
      const saved = localStorage.getItem(ITEMS_STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? (parsed as ItemId[]) : []
    } catch {
      return []
    }
  }

  // デバッグ画面専用のinstanceIdカウンター。本番のRunState.nextInstanceIdとは独立(このstateは
  // RunStateを直接持たず、チェックリスト操作でitems/rites/revelations/oraclesを直接組み立てるため)。
  let nextDebugInstanceId = $state(1)

  let items = $state<HeldItem[]>(loadSavedItems().map(id => ({ instanceId: nextDebugInstanceId++, id })))
  let draggingItemIndex = $state<number | null>(null)
  // 秘儀・天啓・神託の所持リスト。護符(items)と異なりlocalStorage永続化はせず、
  // プレイ中に手動でチェックして追加・削除する想定のシンプルなstate。
  let rites = $state<HeldRite[]>([])
  let revelations = $state<HeldRevelation[]>([])
  let oracles = $state<HeldOracle[]>([])
  let highlightedItemId = $state<ItemId | null>(null)
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let oracleLevels = $state<Record<RoleName, number>>(defaultOracleLevels())
  let wave = $state<WaveState>(startWave(params, 0, 0, items.map(h => h.id), deckComposition, undefined, 0, oracleLevels).wave)
```
に変更する。

- [ ] **Step 2: `handleDraw`・`handleForceDraw`の`items`引数を変換する**

`src/routes/admin/shidasu-debug/+page.svelte:144-149`の:
```ts
  function handleDraw() {
    const result = drawStock(params, wave, items, TARGET, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }
```
を:
```ts
  function handleDraw() {
    const result = drawStock(params, wave, items.map(h => h.id), TARGET, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }
```
に変更する。`handleForceDraw`(209-215行目)内の同じパターン(`drawStock(params, wave, items, TARGET, deckComposition, 'none')`)も同様に`items.map(h => h.id)`へ変更する。

- [ ] **Step 3: `handleToggleItem`・`handleSetAllItems`・rites/revelations/oracles版をinstanceId対応にする**

`src/routes/admin/shidasu-debug/+page.svelte:159-207`の:
```ts
  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
    lastSnapshot = null
  }

  function handleSetAllItems(checked: boolean) {
    items = checked ? [...ITEM_POOL] : []
    lastSnapshot = null
  }

  function handleToggleRite(id: RiteId, checked: boolean) {
    if (checked) {
      if (!rites.includes(id)) rites = [...rites, id]
    } else {
      rites = rites.filter(x => x !== id)
    }
  }

  function handleSetAllRites(checked: boolean) {
    rites = checked ? [...RITE_POOL] : []
  }

  function handleToggleRevelation(id: RevelationId, checked: boolean) {
    if (checked) {
      if (!revelations.includes(id)) revelations = [...revelations, id]
    } else {
      revelations = revelations.filter(x => x !== id)
    }
  }

  function handleSetAllRevelations(checked: boolean) {
    revelations = checked ? [...REVELATION_POOL] : []
  }

  function handleToggleOracle(id: RoleName, checked: boolean) {
    if (checked) {
      if (!oracles.includes(id)) oracles = [...oracles, id]
    } else {
      oracles = oracles.filter(x => x !== id)
    }
  }

  function handleSetAllOracles(checked: boolean) {
    oracles = checked ? [...ORACLE_POOL] : []
  }
```
を:
```ts
  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.some(h => h.id === id)) items = [...items, { instanceId: nextDebugInstanceId++, id }]
    } else {
      const idx = items.findIndex(h => h.id === id)
      if (idx !== -1) items = [...items.slice(0, idx), ...items.slice(idx + 1)]
    }
    lastSnapshot = null
  }

  function handleSetAllItems(checked: boolean) {
    items = checked ? ITEM_POOL.map(id => ({ instanceId: nextDebugInstanceId++, id })) : []
    lastSnapshot = null
  }

  function handleToggleRite(id: RiteId, checked: boolean) {
    if (checked) {
      if (!rites.some(h => h.id === id)) rites = [...rites, { instanceId: nextDebugInstanceId++, id }]
    } else {
      const idx = rites.findIndex(h => h.id === id)
      if (idx !== -1) rites = [...rites.slice(0, idx), ...rites.slice(idx + 1)]
    }
  }

  function handleSetAllRites(checked: boolean) {
    rites = checked ? RITE_POOL.map(id => ({ instanceId: nextDebugInstanceId++, id })) : []
  }

  function handleToggleRevelation(id: RevelationId, checked: boolean) {
    if (checked) {
      if (!revelations.some(h => h.id === id)) revelations = [...revelations, { instanceId: nextDebugInstanceId++, id }]
    } else {
      const idx = revelations.findIndex(h => h.id === id)
      if (idx !== -1) revelations = [...revelations.slice(0, idx), ...revelations.slice(idx + 1)]
    }
  }

  function handleSetAllRevelations(checked: boolean) {
    revelations = checked ? REVELATION_POOL.map(id => ({ instanceId: nextDebugInstanceId++, id })) : []
  }

  function handleToggleOracle(id: RoleName, checked: boolean) {
    if (checked) {
      if (!oracles.some(h => h.id === id)) oracles = [...oracles, { instanceId: nextDebugInstanceId++, id }]
    } else {
      const idx = oracles.findIndex(h => h.id === id)
      if (idx !== -1) oracles = [...oracles.slice(0, idx), ...oracles.slice(idx + 1)]
    }
  }

  function handleSetAllOracles(checked: boolean) {
    oracles = checked ? ORACLE_POOL.map(id => ({ instanceId: nextDebugInstanceId++, id })) : []
  }
```
に変更する。`ItemChecklist`・`RiteChecklist`・`RevelationChecklist`・`OracleChecklist`のprops(`items`/`rites`/`revelations`/`oracles`)は引き続き`ItemId[]`等の素の配列を要求するため、テンプレート側で`items={items.map(h => h.id)}`のように変換して渡す(Step 6で対応)。

- [ ] **Step 4: `handleTriggerSabotage`・`handleUseRite`・`handleUseRevelationClick`・`handleTargetDebugColumn`・`handleUseOracle`をinstanceId対応にする**

`src/routes/admin/shidasu-debug/+page.svelte:151-157`の:
```ts
  function handleTriggerSabotage(id: SabotageActionId) {
    const run = { ...createInitialRun(), items, wave }
    const next = triggerSabotage(params, run, id, Math.random)
    if (next.wave) wave = next.wave
    items = next.items
    lastSnapshot = null
  }
```
は`items`・`run.items`双方が既に`HeldItem[]`同士になるため**コード変更不要**(型が一致する)。念のため`npm run check`で確認する。

`src/routes/admin/shidasu-debug/+page.svelte:330-363`の:
```ts
  function handleUseRite(riteId: RiteId) {
    lastSnapshot = wave
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
    const next = useRite(params, run, riteId, Math.random)
    wave = next.wave ?? wave
    rites = next.rites
  }

  function handleUseRevelationClick(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingUseRevelation = revelationId
      return
    }
    lastSnapshot = wave
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
    const next = useRevelation(params, run, revelationId, null, Math.random)
    wave = next.wave ?? wave
    deckComposition = next.deckComposition
    revelations = next.revelations
  }

  function handleUseOracle(roleName: RoleName) {
    if (pressPulseTimer) clearTimeout(pressPulseTimer)
    pressPulseTarget = { kind: 'revelationOrOracle', ref: { kind: 'oracle', id: roleName } }
    pressPulseTimer = setTimeout(() => {
      pressPulseTimer = null
      pressPulseTarget = null
    }, 500)
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave }
    const next = useOracle(params, run, roleName)
    wave = next.wave ?? wave
    oracles = next.oracles
    oracleLevels = next.oracleLevels
  }
```
を:
```ts
  function handleUseRite(instanceId: number, riteId: RiteId) {
    lastSnapshot = wave
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
    const next = useRite(params, run, instanceId, riteId, Math.random)
    wave = next.wave ?? wave
    rites = next.rites
  }

  function handleUseRevelationClick(instanceId: number, revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingUseRevelation = { instanceId, revelationId }
      return
    }
    lastSnapshot = wave
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
    const next = useRevelation(params, run, instanceId, revelationId, null, Math.random)
    wave = next.wave ?? wave
    deckComposition = next.deckComposition
    revelations = next.revelations
  }

  function handleUseOracle(roleName: RoleName) {
    if (pressPulseTimer) clearTimeout(pressPulseTimer)
    pressPulseTarget = { kind: 'revelationOrOracle', ref: { kind: 'oracle', id: roleName } }
    pressPulseTimer = setTimeout(() => {
      pressPulseTimer = null
      pressPulseTarget = null
    }, 500)
    const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave }
    const next = useOracle(params, run, roleName)
    wave = next.wave ?? wave
    oracles = next.oracles
    oracleLevels = next.oracleLevels
  }
```
に変更する。`pendingUseRevelation`の型宣言(このファイル内、`Read`ツールで検索)を`RevelationId | null`から`{ instanceId: number; revelationId: RevelationId } | null`に変更し、`handleTargetDebugColumn`内(299-308行目)の:
```ts
      const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
      const next = useRevelation(params, run, pendingUseRevelation, colIndex, Math.random)
```
を:
```ts
      const run = { ...createInitialRun(), phase: 'playing' as const, items, rites, revelations, oracles, oracleLevels, wave, deckComposition }
      const next = useRevelation(params, run, pendingUseRevelation.instanceId, pendingUseRevelation.revelationId, colIndex, Math.random)
```
に変更する。

`pendingUseRevelation`の型変更に伴い、`canTargetDebugColumn`関数(このファイル内、`Read`ツールで検索して正確な行番号を確認する)の:
```ts
  function canTargetDebugColumn(colIndex: number): boolean {
    const pending = pendingUseRevelation ?? pendingDebugRevelation
    if (!pending) return false
    if (pending === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }
```
を:
```ts
  function canTargetDebugColumn(colIndex: number): boolean {
    const pendingId = pendingUseRevelation?.revelationId ?? pendingDebugRevelation
    if (!pendingId) return false
    if (pendingId === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }
```
に変更する(`pendingUseRevelation`が`{ instanceId; revelationId } | null`、`pendingDebugRevelation`が引き続き`RevelationId | null`のため、両者を`??`で直接合成できない。`revelationId`だけを取り出してから合成する)。

- [ ] **Step 5: `items`のD&D・バッジ描画ブロック(`itemBadges`スニペット)をinstanceId対応にする**

`src/routes/admin/shidasu-debug/+page.svelte:422-459`の`itemBadges`スニペットを、Task 8 Step 9と同じ変換ルール(`{#each displayedItems as itemId, i (i)}` → `{#each displayedItems as h, i (i)}` + `{@const itemId = h.id}`、`wave.activeSeal.id === itemId` → `wave.activeSeal.instanceId === h.instanceId`、`sealFlashTarget.id === itemId` → `sealFlashTarget.instanceId === h.instanceId`)で変更する。`moveArrayItem(items, draggingItemIndex, targetIndex)`(448行目)は`items`が`HeldItem[]`になっても`moveArrayItem`はジェネリックなため変更不要。

同スニペット内の神託バッジ部分(461-470行目付近)も、Task 8 Step 10のoracle部分と同じ変換ルールを適用する。

- [ ] **Step 6: `ItemChecklist`・`RiteChecklist`・`RevelationChecklist`・`OracleChecklist`への渡し方を変換する**

`src/routes/admin/shidasu-debug/+page.svelte`内、`<ItemChecklist items={items} .../>`のような呼び出し箇所を`<ItemChecklist items={items.map(h => h.id)} .../>`に変更する。`RiteChecklist`・`RevelationChecklist`・`OracleChecklist`も同様に`.map(h => h.id)`を適用する(これらのコンポーネント自体は変更不要、`ItemId[]`等の素の配列を受け取る既存の設計のまま)。

- [ ] **Step 7: localStorage保存処理を`.map(h => h.id)`に変更する**

`src/routes/admin/shidasu-debug/+page.svelte:392-394`の:
```ts
  $effect(() => {
    try { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items)) } catch {}
  })
```
を:
```ts
  $effect(() => {
    try { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items.map(h => h.id))) } catch {}
  })
```
に変更する。

- [ ] **Step 8: `<PlayArea>`呼び出しへの`rites`/`revelations`受け渡しを確認する**

`src/routes/admin/shidasu-debug/+page.svelte`内の`<PlayArea {rites} onUseRite={handleUseRite} {revelations} onUseRevelationClick={handleUseRevelationClick} .../>`は、`rites`/`revelations`ローカルstateが既に`HeldRite[]`/`HeldRevelation[]`になっているため変更不要。`items`を渡している箇所があれば`items={items.map(h => h.id)}`に変更する。

- [ ] **Step 9: 型チェックでこのファイルにエラーが無いことを確認する**

`npm run check`を実行し、`src/routes/admin/shidasu-debug/+page.svelte`自体にエラーが無いことを確認する(テストファイルのエラーは後続タスクで解消するため無視してよい)。

- [ ] **Step 10: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: デバッグ画面の護符・秘儀・天啓・神託UIをinstanceId対応にする
EOF
)"
```

---

### Task 10: engine.test.ts — テストfixtureの移行

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `items:`・`rites:`・`revelations:`・`oracles:`のfixtureリテラルを`HeldItem[]`等の形式に変換する**

このファイルには`items: [...]`・`rites: [...]`・`revelations: [...]`・`oracles: [...]`という形のfixtureリテラルが合計約200箇所ある(`items:`が約59件、`rites:`が約34件、`revelations:`が約66件、`oracles:`が約42件)。以下の変換ルールを**全箇所**に適用する:

- `items: ['discretion']` → `items: [{ instanceId: 1, id: 'discretion' }]`
- `items: ['discretion', 'frost']` → `items: [{ instanceId: 1, id: 'discretion' }, { instanceId: 2, id: 'frost' }]`
- `items: []` → 変更不要(空配列はそのまま有効)
- `rites: ['jera']` → `rites: [{ instanceId: 1, id: 'jera' }]`
- `revelations: ['shin']` → `revelations: [{ instanceId: 1, id: 'shin' }]`
- `oracles: ['flush']` → `oracles: [{ instanceId: 1, id: 'flush' }]`

具体例(`src/lib/game/shidasu/engine.test.ts:504-533`)として、現在の:
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion'], rites: ['jera'] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [], rites: ['jera'] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['frost'], rites: ['jera'] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], oracles: ['flush'] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: ['discretion', 'frost'], revelations: ['shin'] }
```
は、それぞれ:
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [{ instanceId: 1, id: 'discretion' }], rites: [{ instanceId: 2, id: 'jera' }] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [], rites: [{ instanceId: 1, id: 'jera' }] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [{ instanceId: 1, id: 'frost' }], rites: [{ instanceId: 2, id: 'jera' }] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [{ instanceId: 1, id: 'discretion' }, { instanceId: 2, id: 'frost' }], oracles: [{ instanceId: 3, id: 'flush' }] }
```
```ts
    const run: RunState = { ...createInitialRun(), phase: 'playing', wave, items: [{ instanceId: 1, id: 'discretion' }, { instanceId: 2, id: 'frost' }], revelations: [{ instanceId: 3, id: 'shin' }] }
```
のように変換する。**同一fixture内でinstanceIdが重複しなければ、連番の具体的な値自体はテストの正しさに影響しない**(各テストは`instanceId`の値そのものを検証していない限り、1から順に振ればよい)。

- [ ] **Step 2: `useRite`・`useRevelation`・`sellItem`・`sellRite`・`sellRevelation`・`sellOracle`・`confirmPackItemSwap`・`confirmPackRiteSwap`・`confirmPackRevelationSwap`・`confirmPackOracleSwap`の呼び出しにinstanceId引数を追加する**

`engine.test.ts`内でこれらの関数を呼んでいる箇所をGrepで検索し、Step 1で振ったfixtureのinstanceIdと一致する値を第3引数(`sellItem`等は第3引数、`useRite`/`useRevelation`も同様)として追加する。例:
- `useRite(params, run, 'jera')` → `useRite(params, run, 1, 'jera')`(`run.rites`のうち`jera`のinstanceIdが1の場合)
- `sellItem(params, run, 'discretion')` → `sellItem(params, run, 1, 'discretion')`
- `confirmPackItemSwap(run, 'discretion')` → `confirmPackItemSwap(run, 1)`(instanceIdのみになる点に注意)
- `confirmPackRevelationSwap(run, { kind: 'revelation', id: 'shin' })` → `confirmPackRevelationSwap(run, { kind: 'revelation', instanceId: 1, id: 'shin' })`

- [ ] **Step 3: `canUseRite`・`canUseRevelation`を直接呼んでいるテストがあれば、instanceId引数を追加する**

`engine.test.ts`内で`canUseRite(`・`canUseRevelation(`をGrepで検索し、見つかった場合は上記と同じ要領で`instanceId`引数(所持個体を検証する文脈なら対応するinstanceId、所持前の即時使用を検証する文脈なら`canUseRevelation`のみ`null`)を追加する。

- [ ] **Step 4: `run.items[i]`・`run.rites[i]`のような直接インデックスアクセスで`.id`を取り忘れていないか確認する**

`engine.test.ts`内で`expect(run.items).toEqual([`のような配列全体比較をしている箇所は、期待値側も`{ instanceId: ..., id: ... }`形式に変換する必要がある。`expect(run.items.map(h => h.id)).toEqual([...])`のように`.map(h => h.id)`を挟んで従来通りID配列で比較する形に変更する方が、instanceIdの具体的な値に依存しないテストになり保守しやすい。**新規に追加するテスト以外は、可能な限りこの`.map(h => h.id)`比較形式に寄せることを推奨する**(順序を検証したいテストで有効)。

- [ ] **Step 5: テストを実行し、全て通ることを確認する**

```bash
npm run test -- engine.test.ts
```

失敗したテストがあれば、fixtureの変換漏れ・instanceId引数の追加漏れを確認して修正する。

- [ ] **Step 6: 型チェック**

`npm run check`を実行し、`engine.test.ts`自体にエラーが無いことを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
test: engine.test.tsのfixtureをHeldItem等の形式に更新
EOF
)"
```

---

### Task 11: riteEffects.test.ts / revelationEffects.test.ts / shop.test.ts / sabotageEffects.test.ts / cardComboEffects.test.ts — 残りのテストファイルの移行

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.test.ts`
- Modify: `src/lib/game/shidasu/revelationEffects.test.ts`
- Modify: `src/lib/game/shidasu/shop.test.ts`
- Modify: `src/lib/game/shidasu/sabotageEffects.test.ts`(必要な場合のみ)

- [ ] **Step 1: `riteEffects.test.ts`の`canUseRite`呼び出しにinstanceId引数を追加する**

`src/lib/game/shidasu/riteEffects.test.ts`内、`canUseRite(params, wave, 'xxx')`のような呼び出し(約20箇所)を`canUseRite(params, wave, 1, 'xxx')`のように、`instanceId`引数(封印テストで対象個体を検証している場合はその封印対象と一致する値、それ以外は任意の一意な数値でよい)を第3引数として追加する。特に「封印中は使用不可」を検証しているテストでは、`wave.activeSeal`に設定した`instanceId`と`canUseRite`に渡す`instanceId`が一致する(封印される)ケース・一致しない(封印されない、他の個体は使える)ケースの両方を確認し、後者が無ければ新規に追加する(封印精度の変更を検証する、design docで明記した意図的な挙動変化)。

- [ ] **Step 2: `revelationEffects.test.ts`の`canUseRevelation`呼び出しにinstanceId引数を追加する**

`src/lib/game/shidasu/revelationEffects.test.ts`内、`canUseRevelation(params, wave, 'xxx', relics)`のような呼び出し(約10箇所)を`canUseRevelation(params, wave, 1, 'xxx', relics)`のように変更する。Step 1と同様、封印精度(同名を複数持つ場合に片方だけ封印される)を検証するテストケースが無ければ追加する。

- [ ] **Step 3: `shop.test.ts`のfixtureを`HeldItem[]`形式に変換する**

`src/lib/game/shidasu/shop.test.ts`内の`items: [...]`という1箇所のfixtureをTask 10 Step 1と同じ変換ルールで更新する。

- [ ] **Step 4: `sabotageEffects.test.ts`の`SabotageContext`関連のfixture・`useRite`/`useRevelation`のモック関数シグネチャを更新する**

`src/lib/game/shidasu/sabotageEffects.test.ts`をGrepで確認し、`run.items`・`run.rites`・`run.revelations`・`run.oracles`のfixture、および`SabotageContext`に渡す`useRite`/`useRevelation`のモック関数(シグネチャが変わっているため、テスト内でモックを定義している場合は`instanceId`引数を追加する必要がある)を確認して更新する。このファイルに該当のfixture・モックが存在しない場合は変更不要。

- [ ] **Step 5: `cardComboEffects.test.ts`は変更不要であることを確認する**

`src/lib/game/shidasu/cardComboEffects.test.ts`の`items:`は`ItemEffectContext.items`(常に`ItemId[]`のまま、`RunState.items`とは無関係)のfixtureであるため、変更不要であることを`Read`ツールで確認する。

- [ ] **Step 6: テストを実行し、全て通ることを確認する**

```bash
npm run test -- riteEffects.test.ts revelationEffects.test.ts shop.test.ts sabotageEffects.test.ts cardComboEffects.test.ts
```

- [ ] **Step 7: 型チェック**

`npm run check`を実行し、上記全ファイルにエラーが無いことを確認する。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.test.ts src/lib/game/shidasu/revelationEffects.test.ts src/lib/game/shidasu/shop.test.ts src/lib/game/shidasu/sabotageEffects.test.ts
git commit -m "$(cat <<'EOF'
test: riteEffects/revelationEffects/shop/sabotageEffectsのテストをHeldItem等・instanceId対応に更新
EOF
)"
```

---

### Task 12: instanceId一意性の新規テスト追加

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `nextInstanceId`が購入のたびにインクリメントされることを検証するテストを追加する**

`src/lib/game/shidasu/engine.test.ts`の末尾付近(既存の`buyIndividualItem`関連のdescribeブロックの近く)に以下を追加する:

```ts
describe('nextInstanceId', () => {
  it('護符を連続で購入すると、instanceIdが重複せずインクリメントされる', () => {
    const params = loadParams()
    let run: RunState = {
      ...createInitialRun(),
      phase: 'shop',
      currency: 100000,
      shop: {
        individual: [
          { kind: 'item', id: 'discretion', sold: false },
          { kind: 'item', id: 'frost', sold: false },
        ],
        packs: [],
      },
    }
    run = buyIndividualItem(params, run, 0)
    run = buyIndividualItem(params, run, 1)
    expect(run.items).toHaveLength(2)
    expect(run.items[0].instanceId).not.toBe(run.items[1].instanceId)
    expect(run.nextInstanceId).toBe(run.items[1].instanceId + 1)
  })

  it('護符を売却しても、残りの護符のinstanceIdは変化しない', () => {
    const params = loadParams()
    const run: RunState = {
      ...createInitialRun(),
      phase: 'playing',
      items: [
        { instanceId: 5, id: 'discretion' },
        { instanceId: 8, id: 'frost' },
      ],
    }
    const next = sellItem(params, run, 5, 'discretion')
    expect(next.items).toEqual([{ instanceId: 8, id: 'frost' }])
  })
})
```

`loadParams`・`RunState`・`createInitialRun`・`buyIndividualItem`・`sellItem`が既にこのファイルでimportされていることを確認し、されていなければimportを追加する。

- [ ] **Step 2: テストを実行して通ることを確認する**

```bash
npm run test -- engine.test.ts
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
test: nextInstanceIdの一意性・売却時の非影響を検証するテストを追加
EOF
)"
```

---

### Task 13: 封印精度(個体単位)の新規テスト追加

**Files:**
- Modify: `src/lib/game/shidasu/riteEffects.test.ts`

- [ ] **Step 1: 同名秘儀を2個所持し、片方だけ封印されている場合に、封印されていない方は使用可能なことを検証するテストを追加する**

`src/lib/game/shidasu/riteEffects.test.ts`に以下を追加する(既存の`canUseRite`テストの近く。`WaveState`のfixture生成に使っている既存のヘルパー関数があれば、それに合わせて調整する):

```ts
describe('canUseRite - instanceId based sealing', () => {
  it('同名秘儀を複数所持していても、封印されているのはinstanceIdが一致する個体だけである', () => {
    const wave = {
      ...baseWave, // 既存のテストファイル内にある共通fixture変数名に合わせること
      activeSeal: { kind: 'rite' as const, instanceId: 10, id: 'gebo' as const },
    }
    // instanceId 10(封印対象)は使用不可
    expect(canUseRite(params, wave, 10, 'gebo')).toBe(false)
    // instanceId 20(同じ'gebo'だが別個体)は封印対象外なので、他の使用条件を満たせば使用可能
    expect(canUseRite(params, wave, 20, 'gebo')).toBe(wave.discardPile.length >= wave.tableau.length)
  })
})
```

このファイル内の既存テストの`WaveState`fixtureの作り方(`baseWave`という変数名かどうか、`gebo`の使用条件を満たすfixtureの組み方)を`Read`ツールで確認し、実際の変数名・使用条件に合わせて上記コードを調整する。

- [ ] **Step 2: テストを実行して通ることを確認する**

```bash
npm run test -- riteEffects.test.ts
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/riteEffects.test.ts
git commit -m "$(cat <<'EOF'
test: 秘儀封印がinstanceId単位で個体を区別することを検証するテストを追加
EOF
)"
```

---

### Task 14: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体テストスイートを実行する**

```bash
npm run test
```

全テストが通ることを確認する。失敗があれば、該当タスクに戻って修正する。

- [ ] **Step 2: ビルドを確認する**

```bash
npm run build
```

- [ ] **Step 3: 型チェックを確認する**

```bash
npm run check
```

プロジェクト全体でエラーが0件であることを確認する。

- [ ] **Step 4: 開発サーバーで手動確認する**

```bash
npm run dev
```

`http://localhost:5173/game/shidasu`を開き、以下を確認する:
- 護符・秘儀・天啓・神託を購入・福袋で入手できる
- 護符バッジのドラッグ並べ替えが正常に動作する
- 秘儀・天啓を使用できる(コラム選択が必要なものも含む)
- 神託を使用・温存できる
- 護符・秘儀・天啓・神託を売却できる
- 同名護符を2個以上所持した状態でショップに入り、「封印系」の妨害行動が発動するステージまで進める(または`/admin/shidasu-debug`で`triggerSabotage`を直接発動させる)。このとき、封印されるのは同名の護符全部ではなく1個だけであることを確認する
- `/admin/shidasu-debug`でも同様に、護符・秘儀・天啓・神託のチェックリスト追加削除・バッジ操作・妨害行動発動が正常に動作する

問題があれば修正し、該当タスクへ戻って再コミットする。

- [ ] **Step 5: この最終確認の結果を報告する**

ビルド・型チェック・テスト・手動確認の結果をまとめて報告する。
