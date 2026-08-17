# playCard/drawStock安全断片共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`の`playCard`・`drawStock`にある、完全一致する3つの小さな計算断片(橋の護符による長さ補正・神託レベル解決クロージャ・庇護/大地によるコンボ下駄履かせ)を共通ヘルパーへ切り出す。

**Architecture:** `resolveBridgeAdjustedLengths`・`makeOracleLevelResolver`・`applyProtectionEarthFloor`の3つの純粋関数を追加し、`playCard`・`drawStock`の該当箇所をそれぞれの呼び出しに置き換える。`drawStock`のnaiveパス全体(playCardとは意図的に異なる縮小版のスコア計算式)は対象外とする。スコア計算式そのもの(どの乗数がどの順序で適用されるか)は一切変更しない。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-scoring-helper-common-refactor-design.md`

---

## Task 1: `resolveBridgeAdjustedLengths`の追加と置き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`playCard`・`drawStock`)

- [ ] **Step 1: `resolveBridgeAdjustedLengths`ヘルパーを追加する**

`src/lib/game/shidasu/engine.ts`内、`playCard`関数の直前(`grep -n "export function playCard"`で位置を特定できる)に以下を追加する:

```ts
function resolveBridgeAdjustedLengths(params: ShidasuParams, items: ItemId[]): { effectiveStairMinLen: number; effectiveSuitColorMinLen: number } {
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  return { effectiveStairMinLen, effectiveSuitColorMinLen }
}

```

- [ ] **Step 2: `playCard`内の該当箇所を置き換える**

`playCard`関数内、以下の行(`grep -n "const effectiveStairMinLen = items.includes"`で位置を特定できる。1箇所目):

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

を以下に置き換える:

```ts
  const { effectiveStairMinLen, effectiveSuitColorMinLen } = resolveBridgeAdjustedLengths(params, items)
```

- [ ] **Step 3: `drawStock`内の該当箇所を置き換える**

続けて同ファイル内、`drawStock`関数内の以下の行(2箇所目、`grep -n "const effectiveStairMinLen = items.includes"`で確認できる):

```ts
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

を以下に置き換える:

```ts
  const { effectiveStairMinLen, effectiveSuitColorMinLen } = resolveBridgeAdjustedLengths(params, items)
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(護符「橋」関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: resolveBridgeAdjustedLengthsヘルパーを追加しplayCard・drawStockの橋補正を共通化する"
```

---

## Task 2: `makeOracleLevelResolver`の追加と置き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`playCard`・`drawStock`)

- [ ] **Step 1: `makeOracleLevelResolver`ヘルパーを追加する**

`src/lib/game/shidasu/engine.ts`内、Task 1で追加した`resolveBridgeAdjustedLengths`の直後に以下を追加する:

```ts
function makeOracleLevelResolver(wave: WaveState, sealedRoleEffect: SealedRoleEffect): (name: RoleName) => number {
  return (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    const base = wave.oracleLevels[name] ?? 1
    const mult = sealedRoleEffect.multipliers?.[name]
    return mult !== undefined ? base * mult : base
  }
}

```

- [ ] **Step 2: `playCard`内の該当箇所を置き換える**

`playCard`関数内、以下のブロック(`grep -n "const oracleLevel = (name: RoleName)"`で位置を特定できる。1箇所目):

```ts
  const oracleLevel = (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    const base = wave.oracleLevels[name] ?? 1
    const mult = sealedRoleEffect.multipliers?.[name]
    return mult !== undefined ? base * mult : base
  }
```

を以下に置き換える:

```ts
  const oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)
```

- [ ] **Step 3: `drawStock`内の該当箇所を置き換える**

続けて同ファイル内、`drawStock`のnaiveパス内、以下のブロック(2箇所目、`grep -n "const oracleLevel = (name: RoleName)"`で確認できる):

```ts
      const oracleLevel = (name: RoleName): number => {
        if (sealedRoleEffect.zeroRoles.includes(name)) return 0
        if (sealedRoleEffect.oracleBaselineRole === name) return 1
        const base = wave.oracleLevels[name] ?? 1
        const mult = sealedRoleEffect.multipliers?.[name]
        return mult !== undefined ? base * mult : base
      }
```

を以下に置き換える(インデントはこのブロックの元の位置に合わせる):

```ts
      const oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(神託・役封印・役偏重関連の既存テストを含め、無修正のまま全てグリーンになるはず)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: makeOracleLevelResolverヘルパーを追加しplayCard・drawStockの神託レベル解決を共通化する"
```

---

## Task 3: `applyProtectionEarthFloor`の追加と置き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`playCard`・`drawStock`)

- [ ] **Step 1: `applyProtectionEarthFloor`ヘルパーを追加する**

`src/lib/game/shidasu/engine.ts`内、Task 2で追加した`makeOracleLevelResolver`の直後に以下を追加する:

```ts
// 庇護: effectiveComboがprotection.c未満なら底上げする。大地: effectiveComboにearth.cを加算する。
// 所持順(items配列の並び順)で順に適用する。
function applyProtectionEarthFloor(items: ItemId[], params: ShidasuParams, startingCombo: number): number {
  let effectiveCombo = startingCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }
  return effectiveCombo
}

```

- [ ] **Step 2: `playCard`内の該当箇所を置き換える**

`playCard`関数内、以下のブロック(`grep -n "let effectiveCombo = newCombo + newBaseComboCount"`で位置を特定できる):

```ts
  let effectiveCombo = newCombo + newBaseComboCount
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }
```

を以下に置き換える:

```ts
  const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + newBaseComboCount)
```

- [ ] **Step 3: `drawStock`内の該当箇所を置き換える**

続けて同ファイル内、`drawStock`のnaiveパス内、以下のブロック(`grep -n "let effectiveCombo = newCombo + sincerityAdd"`で位置を特定できる):

```ts
      let effectiveCombo = newCombo + sincerityAdd + wave.baseComboCount
      for (const id of items) {
        if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
          effectiveCombo = params.talismans.protection.c
        } else if (id === 'earth') {
          effectiveCombo += params.talismans.earth.c
        }
      }
```

を以下に置き換える(インデントはこのブロックの元の位置に合わせる):

```ts
      const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + sincerityAdd + wave.baseComboCount)
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し(`effectiveCombo`は`playCard`・`drawStock`いずれもループ後は参照のみで再代入されないため、`let`から`const`への変更は安全)

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(護符「庇護」「大地」関連の既存テストを含め、無修正のまま全てグリーンになるはず)

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(3つのヘルパー追加はこれで完了)

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: applyProtectionEarthFloorヘルパーを追加しplayCard・drawStockのコンボ下駄履かせ処理を共通化する"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、護符「橋」「庇護」「大地」を所持した状態でのプレイ、神託所持時のプレイ、役封印・役偏重の妨害発動時のプレイを一通り確認し、スコア計算が壊れていないことを確認する(ブラウザ操作が困難な環境であれば、型チェック・ビルド・テストの成功で代替してよい)
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
