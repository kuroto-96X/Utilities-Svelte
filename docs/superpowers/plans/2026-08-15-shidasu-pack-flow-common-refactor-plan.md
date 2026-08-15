# 福袋pick/confirm/cancel/closeフロー共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`の5カテゴリ(item/rite/revelation/oracle/cardSet)分の福袋pick/confirm/close処理の機械的重複を、共通ヘルパー2つに切り出して削減する。あわせて`src/routes/game/shidasu/+page.svelte`の対応する1行ハンドラをファクトリ経由の生成に置き換える。

**Architecture:** `resolvePackOfferPick`(オファー配列からの除去+残数管理+shop遷移)・`closePackOfferSelect`(選択放棄時のリセット)という2つの共通ヘルパーをengine.tsに追加し、既存の5カテゴリの`pickPackXxx`/`confirmPackXxxSwap`/`closePackXxxSelect`をこれらに委譲する形へ書き換える。容量チェック・スワップ相手の解決・use/holdモードなどカテゴリごとに異なるロジックはそのまま残す。+page.svelte側は`bindRunAction`系の薄いファクトリ関数を追加し、副作用の無い16ハンドラをそこから生成する。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-pack-flow-common-refactor-design.md`

---

## Task 1: `resolvePackOfferPick`ヘルパーの追加とitem・rite系の書き換え

護符(item)・秘儀(rite)は所持配列が単一で、天啓・神託のような共有プールを持たない最も単純なカテゴリ。まずここで共通ヘルパーのパターンを確立する。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`resolvePackItemPick`・`pickPackItem`・`confirmPackItemSwap`・`resolvePackRitePick`・`pickPackRite`・`confirmPackRiteSwap`)

- [ ] **Step 1: 現在の`resolvePackItemPick`・`pickPackItem`・`confirmPackItemSwap`をまとめて置き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "function resolvePackItemPick"`で位置を特定できる):

```ts
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
  if (run.items.length >= itemMaxCapacity(params, run)) {
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
```

を以下に置き換える(`resolvePackItemPick`は削除し、新規の`resolvePackOfferPick`ヘルパーに置き換える):

```ts
// 福袋の残り選択が1件確定した後の共通処理。オファー配列からmatchesに一致する最初の1件を除去し、
// offerPickRemainingをデクリメントし、0以下になればphase: 'shop'へ戻る。
// 所持側の更新(items/rites/revelations/oracles等)は呼び出し元がrunへ事前にマージしてから渡すこと
// (このヘルパー自身は所持側には一切関知しない)。
// オファー配列・pendingフィールドの参照はRunStateの動的キーアクセスになるため、戻り値をRunStateに
// キャストしている(呼び出し元は決まった数のパターンに限定されるため、型安全性は既存テストで担保する)。
function resolvePackOfferPick<T>(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null,
  offer: T[],
  matches: (entry: T) => boolean
): RunState {
  const idx = offer.findIndex(matches)
  const newOffer = idx === -1 ? offer : [...offer.slice(0, idx), ...offer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  if (offerPickRemaining <= 0) {
    return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
  }
  return { ...run, ...pendingUpdate, [offerField]: newOffer, offerPickRemaining } as RunState
}

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

- [ ] **Step 2: `resolvePackRitePick`・`pickPackRite`・`confirmPackRiteSwap`を置き換える**

続けて同ファイル内、以下のブロック(`grep -n "function resolvePackRitePick"`で位置を特定できる):

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

// 秘儀の福袋(riteSelect)から1つ選ぶ。所持上限(基本3、破魔矢所持時は拡張)到達時はpendingNewRiteにセットしてスワップ待ちにする。
export function pickPackRite(params: ShidasuParams, run: RunState, riteId: RiteId): RunState {
  if (run.phase !== 'riteSelect' || !run.riteOffer.includes(riteId)) return run
  if (run.rites.length >= riteMaxCapacity(params, run)) {
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
```

を以下に置き換える(`resolvePackRitePick`は削除する):

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

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(item・rite関連のpickPack/confirmPackSwapテストを含め、既存テストは無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: resolvePackOfferPickヘルパーを追加し護符・秘儀の福袋pick処理を共通化する"
```

---

## Task 2: revelation・oracle系の書き換え

天啓(revelation)・神託(oracle)は所持上限を共有しており、スワップ時に相手側カテゴリの配列を操作する必要がある。Task 1で確立した`resolvePackOfferPick`がこの複雑さも吸収できることを確認する。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`resolvePackRevelationPick`・`pickPackRevelationUse`・`pickPackRevelationHold`・`confirmPackRevelationSwap`・`resolvePackOraclePick`・`pickPackOracleUse`・`pickPackOracleHold`・`confirmPackOracleSwap`)

- [ ] **Step 1: `resolvePackRevelationPick`・`pickPackRevelationUse`・`pickPackRevelationHold`・`confirmPackRevelationSwap`を置き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "function resolvePackRevelationPick"`で位置を特定できる):

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
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = run.extraTableauRows
  return resolvePackRevelationPick({ ...run, wave, deckComposition, extraTableauRows }, revelationId)
}

// 天啓の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewRevelationにセットしスワップ待ちにする。
export function pickPackRevelationHold(params: ShidasuParams, run: RunState, revelationId: RevelationId): RunState {
  if (run.phase !== 'revelationSelect' || !run.revelationOffer.includes(revelationId)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
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
    const remaining = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
    return resolvePackRevelationPick({ ...run, revelations: [...remaining, newId], pendingNewRevelation: null }, newId)
  }
  const idx = run.oracles.indexOf(target.id)
  const oracles = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
  return resolvePackRevelationPick({ ...run, oracles, revelations: [...run.revelations, newId], pendingNewRevelation: null }, newId)
}
```

を以下に置き換える(`resolvePackRevelationPick`は削除する):

```ts
// 天啓の福袋(revelationSelect)から1つ選び、その場で使用する(所持には加わらない、上限とは無関係)。
export function pickPackRevelationUse(params: ShidasuParams, run: RunState, revelationId: RevelationId, targetCol: number | null, rand: () => number = Math.random): RunState {
  if (run.phase !== 'revelationSelect' || !run.wave || !run.revelationOffer.includes(revelationId)) return run
  if (!canUseRevelation(params, run.wave, revelationId, run.relics)) return run
  const { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  const extraTableauRows = run.extraTableauRows
  return resolvePackOfferPick({ ...run, wave, deckComposition, extraTableauRows }, 'revelationOffer', 'pendingNewRevelation', run.revelationOffer, id => id === revelationId)
}

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

- [ ] **Step 2: `resolvePackOraclePick`・`pickPackOracleUse`・`pickPackOracleHold`・`confirmPackOracleSwap`を置き換える**

続けて同ファイル内、以下のブロック(`grep -n "function resolvePackOraclePick"`で位置を特定できる):

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
// run.oracleLevelsだけでなくwave.oracleLevelsも同期する。得点計算時にwave.oracleLevelsが参照されるため、
// 同期を怠ると効果が次のウェーブまで反映されない不整合が起きる。
export function pickPackOracleUse(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return resolvePackOraclePick({ ...run, oracleLevels, wave }, roleName)
}

// 神託の福袋から1つ選び、温存する(所持に加える)。天啓・神託合算上限(基本2、千羽鶴所持時は拡張)到達時はpendingNewOracleにセットしスワップ待ちにする。
export function pickPackOracleHold(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  if (run.revelations.length + run.oracles.length >= revelationOracleMaxCapacity(params, run)) {
    return { ...run, pendingNewOracle: roleName }
  }
  return resolvePackOraclePick({ ...run, oracles: [...run.oracles, roleName] }, roleName)
}

// スワップ待ち中、targetで指定した所持中の天啓または神託と入れ替えて確定する。
export function confirmPackOracleSwap(run: RunState, target: HeldRevelationOrOracleRef): RunState {
  if (run.phase !== 'oracleSelect' || run.pendingNewOracle === null) return run
  const newRole = run.pendingNewOracle
  if (target.kind === 'oracle') {
    const idx = run.oracles.indexOf(target.id)
    const remaining = idx === -1 ? run.oracles : [...run.oracles.slice(0, idx), ...run.oracles.slice(idx + 1)]
    return resolvePackOraclePick({ ...run, oracles: [...remaining, newRole], pendingNewOracle: null }, newRole)
  }
  const idx = run.revelations.indexOf(target.id)
  const revelations = idx === -1 ? run.revelations : [...run.revelations.slice(0, idx), ...run.revelations.slice(idx + 1)]
  return resolvePackOraclePick({ ...run, revelations, oracles: [...run.oracles, newRole], pendingNewOracle: null }, newRole)
}
```

を以下に置き換える(`resolvePackOraclePick`は削除する):

```ts
// 神託の福袋(oracleSelect)から1つ選び、その場で使用する(役レベル+1、所持には加わらない、上限とは無関係)。
// run.oracleLevelsだけでなくwave.oracleLevelsも同期する。得点計算時にwave.oracleLevelsが参照されるため、
// 同期を怠ると効果が次のウェーブまで反映されない不整合が起きる。
export function pickPackOracleUse(run: RunState, roleName: RoleName): RunState {
  if (run.phase !== 'oracleSelect' || !run.oracleOffer.includes(roleName)) return run
  const oracleLevels = { ...run.oracleLevels, [roleName]: run.oracleLevels[roleName] + 1 }
  const wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  return resolvePackOfferPick({ ...run, oracleLevels, wave }, 'oracleOffer', 'pendingNewOracle', run.oracleOffer, role => role === roleName)
}

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

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(revelation・oracle関連のpickPack/confirmPackSwapテストを含め、既存テストは無修正のまま全てグリーンになるはず)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: 天啓・神託の福袋pick処理をresolvePackOfferPickヘルパーに委譲する"
```

---

## Task 3: cardSet系の書き換えと`closePackOfferSelect`ヘルパーの追加

カードセット福袋(cardSet)は所持枠・スワップの概念が無く最も単純だが、比較にidの単純一致ではなく`genreId`フィールドの一致が必要という違いがある。あわせて、5カテゴリ分ある`closePackXxxSelect`(いずれもほぼ同一構造)を`closePackOfferSelect`ヘルパーに統合する。

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`resolvePackCardSetPick`・`pickPackCardSet`・`closePackItemSelect`・`closePackRiteSelect`・`closePackRevelationSelect`・`closePackOracleSelect`・`closePackCardSetSelect`)

- [ ] **Step 1: `resolvePackCardSetPick`・`pickPackCardSet`を置き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "function resolvePackCardSetPick"`で位置を特定できる):

```ts
function resolvePackCardSetPick(run: RunState, pickedGenreId: CardSetGenreId): RunState {
  const idx = run.cardSetOffer.findIndex(o => o.genreId === pickedGenreId)
  const cardSetOffer = idx === -1 ? run.cardSetOffer : [...run.cardSetOffer.slice(0, idx), ...run.cardSetOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', cardSetOffer: [], offerPickRemaining: 0 }
  }
  return { ...run, cardSetOffer, offerPickRemaining }
}

// カードセットの福袋(cardSetSelect)から1つ選び、そのカードをdeckCompositionへ即座に追加する。
// 護符・秘儀・天啓/神託と異なり所持枠・スワップ処理は無い(選択即確定)。
// deckIdはこの時点のdeckComposition長を基準に採番する(addCardsToDeckComposition、deck.ts参照)。
export function pickPackCardSet(run: RunState, genreId: CardSetGenreId): RunState {
  if (run.phase !== 'cardSetSelect') return run
  const offer = run.cardSetOffer.find(o => o.genreId === genreId)
  if (!offer) return run
  const deckComposition = addCardsToDeckComposition(run.deckComposition, offer.cards)
  return resolvePackCardSetPick({ ...run, deckComposition }, genreId)
}
```

を以下に置き換える(`resolvePackCardSetPick`は削除する。カードセットには`pendingXxx`フィールードが無いため、`resolvePackOfferPick`の第3引数には`null`を渡す):

```ts
// カードセットの福袋(cardSetSelect)から1つ選び、そのカードをdeckCompositionへ即座に追加する。
// 護符・秘儀・天啓/神託と異なり所持枠・スワップ処理は無い(選択即確定)。
// deckIdはこの時点のdeckComposition長を基準に採番する(addCardsToDeckComposition、deck.ts参照)。
export function pickPackCardSet(run: RunState, genreId: CardSetGenreId): RunState {
  if (run.phase !== 'cardSetSelect') return run
  const offer = run.cardSetOffer.find(o => o.genreId === genreId)
  if (!offer) return run
  const deckComposition = addCardsToDeckComposition(run.deckComposition, offer.cards)
  return resolvePackOfferPick({ ...run, deckComposition }, 'cardSetOffer', null, run.cardSetOffer, o => o.genreId === genreId)
}
```

- [ ] **Step 2: `closePackOfferSelect`ヘルパーを追加する**

`resolvePackOfferPick`関数定義の直後に追加する(`grep -n "function resolvePackOfferPick"`で位置を特定できる。Task 1で追加済みのはず):

```ts

// 福袋の残りの選択を放棄してshopへ戻る共通処理。
function closePackOfferSelect(
  run: RunState,
  offerField: 'offer' | 'riteOffer' | 'revelationOffer' | 'oracleOffer' | 'cardSetOffer',
  pendingField: 'pendingNewItem' | 'pendingNewRite' | 'pendingNewRevelation' | 'pendingNewOracle' | null
): RunState {
  const pendingUpdate = pendingField ? { [pendingField]: null } : {}
  return { ...run, ...pendingUpdate, phase: 'shop', [offerField]: [], offerPickRemaining: 0 } as RunState
}
```

- [ ] **Step 3: 5つの`closePackXxxSelect`関数を書き換える**

以下5つの関数(`grep -n "export function closePack"`で全て見つかる)を、それぞれ以下のように書き換える。

`closePackItemSelect`(現在の`{ ...run, phase: 'shop', offer: [], pendingNewItem: null, offerPickRemaining: 0 }`という本体を書き換える):

```ts
export function closePackItemSelect(run: RunState): RunState {
  if (run.phase !== 'itemSelect') return run
  return closePackOfferSelect(run, 'offer', 'pendingNewItem')
}
```

`closePackRiteSelect`:

```ts
export function closePackRiteSelect(run: RunState): RunState {
  if (run.phase !== 'riteSelect') return run
  return closePackOfferSelect(run, 'riteOffer', 'pendingNewRite')
}
```

`closePackRevelationSelect`:

```ts
export function closePackRevelationSelect(run: RunState): RunState {
  if (run.phase !== 'revelationSelect') return run
  return closePackOfferSelect(run, 'revelationOffer', 'pendingNewRevelation')
}
```

`closePackOracleSelect`:

```ts
export function closePackOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return closePackOfferSelect(run, 'oracleOffer', 'pendingNewOracle')
}
```

`closePackCardSetSelect`(元のコメント「残りの選択を放棄してshopへ戻る。」は残す):

```ts
// 残りの選択を放棄してshopへ戻る。
export function closePackCardSetSelect(run: RunState): RunState {
  if (run.phase !== 'cardSetSelect') return run
  return closePackOfferSelect(run, 'cardSetOffer', null)
}
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(engine.ts側のリファクタはこれで完了)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: closePackOfferSelectヘルパーを追加しカードセット福袋・全5カテゴリのclose処理を共通化する"
```

---

## Task 4: `+page.svelte`のハンドラファクトリ化

engine.ts側の関数シグネチャは一切変わっていないため、この変更は`+page.svelte`単体で完結する。副作用の無い16個の1行ハンドラをファクトリ経由の生成に置き換える。

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `bindRunAction`系ファクトリ関数を追加する**

`src/routes/game/shidasu/+page.svelte`内、`function handlePickPackItem(itemId: ItemId) {`の直前(`grep -n "function handlePickPackItem"`で位置を特定できる)に追加する:

```ts
  // 「run = xxxFn(run, arg)」または「run = xxxFn(params, run, arg)」だけで完結する
  // (追加の副作用呼び出しが無い)ハンドラを生成する薄いファクトリ。天啓関連の一部ハンドラ
  // (syncRevelationPreviewWithPhase()の追加呼び出しや列選択判定を伴うもの)は対象外で、
  // 個別関数のまま残す。
  function bindRunAction<TArg>(fn: (run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
    return (arg: TArg) => { run = fn(run, arg) }
  }
  function bindRunActionNoArg(fn: (run: RunState) => RunState): () => void {
    return () => { run = fn(run) }
  }
  function bindParamsRunAction<TArg>(fn: (params: ShidasuParams, run: RunState, arg: TArg) => RunState): (arg: TArg) => void {
    return (arg: TArg) => { run = fn(params, run, arg) }
  }

```

(`ShidasuParams`型が同ファイルで未importの場合は`import type { ShidasuParams } from '$lib/game/shidasu/params'`を追加する。`grep -n "ShidasuParams"`で既存import状況を確認すること。)

- [ ] **Step 2: item・rite・cardSetのハンドラを置き換える**

以下のブロック(281-313行目付近、`grep -n "function handlePickPackItem"`から`function handleClosePackCardSetSelect"`の直後まで):

```ts
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
    run = pickPackRite(params, run, riteId)
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

  function handlePickPackCardSet(genreId: CardSetGenreId) {
    run = pickPackCardSet(run, genreId)
  }

  function handleClosePackCardSetSelect() {
    run = closePackCardSetSelect(run)
  }
```

を以下に置き換える:

```ts
  const handlePickPackItem = bindParamsRunAction(pickPackItem)
  const handleConfirmPackItemSwap = bindRunAction(confirmPackItemSwap)
  const handleCancelPackItemSwap = bindRunActionNoArg(cancelPackItemSwap)
  const handleClosePackItemSelect = bindRunActionNoArg(closePackItemSelect)

  const handlePickPackRite = bindParamsRunAction(pickPackRite)
  const handleConfirmPackRiteSwap = bindRunAction(confirmPackRiteSwap)
  const handleCancelPackRiteSwap = bindRunActionNoArg(cancelPackRiteSwap)
  const handleClosePackRiteSelect = bindRunActionNoArg(closePackRiteSelect)

  const handlePickPackCardSet = bindRunAction(pickPackCardSet)
  const handleClosePackCardSetSelect = bindRunActionNoArg(closePackCardSetSelect)
```

- [ ] **Step 3: revelation・oracleのハンドラのうち、副作用の無いものを置き換える**

以下のブロック(`grep -n "function handleCancelPackRevelationSwap"`および`function handlePickPackOracleUse`〜`function handleClosePackOracleSelect`):

```ts
  function handleCancelPackRevelationSwap() {
    run = cancelPackRevelationSwap(run)
  }
```

を以下に置き換える(この行の位置はそのまま、`handlePickPackRevelationHold`・`handleConfirmPackRevelationSwap`・`handleClosePackRevelationSelect`は`syncRevelationPreviewWithPhase()`を伴うため変更しない):

```ts
  const handleCancelPackRevelationSwap = bindRunActionNoArg(cancelPackRevelationSwap)
```

続けて、以下のブロック:

```ts
  function handlePickPackOracleUse(roleName: RoleName) {
    run = pickPackOracleUse(run, roleName)
  }
  function handlePickPackOracleHold(roleName: RoleName) {
    run = pickPackOracleHold(params, run, roleName)
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
```

を以下に置き換える:

```ts
  const handlePickPackOracleUse = bindRunAction(pickPackOracleUse)
  const handlePickPackOracleHold = bindParamsRunAction(pickPackOracleHold)
  const handleConfirmPackOracleSwap = bindRunAction(confirmPackOracleSwap)
  const handleCancelPackOracleSwap = bindRunActionNoArg(cancelPackOracleSwap)
  const handleClosePackOracleSelect = bindRunActionNoArg(closePackOracleSelect)
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し(`const handleXxx = bindYyy(zzz)`という書き方でも、Svelteテンプレート側で`onclick={() => handlePickPackItem(id)}`のように呼び出している箇所は無修正で動くはず。念のため`grep -n "handlePickPackItem\|handleConfirmPackItemSwap\|handleCancelPackItemSwap\|handleClosePackItemSelect"`等でテンプレート側の呼び出し箇所を確認し、関数からconstへの変更で参照が壊れていないことを確認する)

- [ ] **Step 5: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: 開発サーバーで目視確認する**

Run: `npm run dev`(既にポート5173で稼働中ならこのステップはスキップしてよい)

`http://localhost:5173/game/shidasu`でショップに入り、護符・秘儀・カードセットの福袋を開封して選択・スワップ・キャンセル・閉じるの一連の操作が壊れていないことを確認する。神託の福袋(use/hold双方)も同様に確認する。天啓の福袋は今回変更していないが、念のため一連の操作(選択・プレビューの片付けアニメーション含む)が壊れていないことも確認する。

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "refactor: 副作用の無い福袋ハンドラをbindRunAction系ファクトリ経由の生成に置き換える"
```

---

## 最終確認

全4タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから5カテゴリ全ての福袋(護符・秘儀・天啓・神託・カードセット)の開封〜選択〜スワップ〜キャンセル〜閉じるを一通り操作し、画面崩れ・挙動の変化が無いことを確認する
- [ ] `src/lib/game/shidasu/engine.ts`の行数が減っていることを確認する(`resolvePackItemPick`・`resolvePackRitePick`・`resolvePackRevelationPick`・`resolvePackOraclePick`・`resolvePackCardSetPick`の5関数が削除され、`resolvePackOfferPick`・`closePackOfferSelect`の2関数に置き換わっているはず)
