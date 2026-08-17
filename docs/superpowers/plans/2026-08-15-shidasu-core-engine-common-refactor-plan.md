# コア進行系(engine.ts)共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`のコア進行系にある3箇所の機械的重複(Run初期化、playCard/drawStock呼び出しラッパー、秘儀・天啓・神託の使用処理)を共通ヘルパーに切り出す。

**Architecture:** `beginRun`は`createInitialRun()`をスプレッドして差分だけ上書きする形にする。`applyPlayCard`/`applyDrawStock`/`applyStuckCheck`は`resolvePlayContext`(文脈算出)・`resolveActionSabotage`(妨害トリガー判定)の2ヘルパーに委譲する。`useRite`/`useRevelation`/`useOracle`は`applyDiscretionFrostBonus`(果断・星霜加算)ヘルパーに委譲する。3つとも`engine.ts`単体で完結し、公開APIのシグネチャは一切変更しない。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-15-shidasu-core-engine-common-refactor-design.md`

---

## Task 1: `createInitialRun()`/`beginRun()`の重複解消

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`beginRun`)

- [ ] **Step 1: `beginRun`を`createInitialRun()`ベースに書き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "export function beginRun"`で位置を特定できる):

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  return {
    phase: 'shop',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: null,
    waveGeneration: 0,
    pendingNewItem: null,
    deckComposition: standardDeckComposition(),
    rites: [],
    revelations: [],
    relics: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    dedicationX: 1,
    diligenceX: 1,
    divineProtectionX: 1,
    discretionN: 10,
    frostX: 1,
    echoX: 1,
    shootingStarN: 50,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
    cardSetOffer: [],
    shopRerollCount: 0,
    lastUsedRevelationId: null,
    recentUsedRiteIds: [],
    rewardPenalty: 0,
  }
}
```

を以下に置き換える:

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

(末尾の`rewardPenalty: 0,`まで含めて元のブロック全体を1文字も残さず置き換えること。`createInitialRun()`は同ファイル内、`beginRun`の直前に既に定義されている。)

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 3: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`beginRun`関連の既存テストを含め、無修正のまま全てグリーンになるはず。これが本リファクタの正しさの根拠)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: beginRunをcreateInitialRun()ベースの差分上書きに書き換える"
```

---

## Task 2: `applyPlayCard`/`applyDrawStock`/`applyStuckCheck`の重複解消

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`)

- [ ] **Step 1: `resolvePlayContext`・`resolveActionSabotage`ヘルパーを追加し、`applyPlayCard`・`applyDrawStock`を書き換える**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "export function applyPlayCard"`で位置を特定できる):

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const comboCap = resolveComboCap(run.wave.activeSeal)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}

export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const effectiveItems = resolveEffectiveItems(run.items, run.wave.activeSeal)
  const sealedRoleEffect = resolveSealedRoleEffect(run.wave.activeSeal)
  const comboCap = resolveComboCap(run.wave.activeSeal)
  const { wave, deckComposition } = drawStock(params, run.wave, effectiveItems, target, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
  let next: RunState = { ...run, wave, deckComposition }
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    next = triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

を以下に置き換える:

```ts
// playCard/drawStock呼び出しに必要な文脈値(目標スコア・得点ロック・実効護符・役封印効果・コンボ上限)をまとめて算出する。
// stageModifierFor(modifier)はここに含めない: applyStuckCheckがisStuck判定より前に単独で必要とするため、
// このヘルパーに含めると呼び出し元で二重計算・不自然な分離が発生する。
function resolvePlayContext(params: ShidasuParams, run: RunState, wave: WaveState) {
  return {
    target: waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars),
    scoreLock: bossScoreLockFor(params, run),
    effectiveItems: resolveEffectiveItems(run.items, wave.activeSeal),
    sealedRoleEffect: resolveSealedRoleEffect(wave.activeSeal),
    comboCap: resolveComboCap(wave.activeSeal),
  }
}

// playCard/drawStock適用後、妨害発動タイミング(sabotageTurnsRemaining<=0)なら即座にtriggerSabotageを適用する。
function resolveActionSabotage(params: ShidasuParams, next: RunState, wave: WaveState, rand: () => number): RunState {
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    return triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random, rowIndex?: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, effectiveItems, target, colIndex, run.deckComposition, rand, scoreLock, rowIndex, sealedRoleEffect, comboCap)
  return resolveActionSabotage(params, { ...run, wave, deckComposition }, wave, rand)
}

export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const { target, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, run.wave)
  const { wave, deckComposition } = drawStock(params, run.wave, effectiveItems, target, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
  return resolveActionSabotage(params, { ...run, wave, deckComposition }, wave, rand)
}
```

- [ ] **Step 2: `applyStuckCheck`を書き換える**

続けて同ファイル内、`applyStuckCheck`関数(`grep -n "export function applyStuckCheck"`で位置を特定できる)の末尾、以下のブロック:

```ts
  if (resetWave.stock.length > 0) {
    const stageTarget = waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)
    const scoreLock = bossScoreLockFor(params, run)
    const effectiveItems = resolveEffectiveItems(run.items, resetWave.activeSeal)
    const sealedRoleEffect = resolveSealedRoleEffect(resetWave.activeSeal)
    const comboCap = resolveComboCap(resetWave.activeSeal)
    const drawResult = drawStock(params, resetWave, effectiveItems, stageTarget, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
    let next: RunState = { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
    if (drawResult.wave.pendingSabotageId && drawResult.wave.sabotageTurnsRemaining <= 0) {
      next = triggerSabotage(params, next, drawResult.wave.pendingSabotageId, rand)
    }
    return next
  }

  return { ...run, wave: markStuck(resetWave) }
}
```

を以下に置き換える(関数冒頭の`modifier`計算・`isStuck`判定・護符救済処理部分は変更しない、この末尾ブロックのみ置き換える):

```ts
  if (resetWave.stock.length > 0) {
    const { target: stageTarget, scoreLock, effectiveItems, sealedRoleEffect, comboCap } = resolvePlayContext(params, run, resetWave)
    const drawResult = drawStock(params, resetWave, effectiveItems, stageTarget, run.deckComposition, modifier, rand, scoreLock, sealedRoleEffect, comboCap)
    return resolveActionSabotage(params, { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }, drawResult.wave, rand)
  }

  return { ...run, wave: markStuck(resetWave) }
}
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 4: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`applyPlayCard`/`applyDrawStock`/`applyStuckCheck`関連の既存テストを含め、無修正のまま全てグリーンになるはず)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: resolvePlayContext/resolveActionSabotageヘルパーを追加しapplyPlayCard・applyDrawStock・applyStuckCheckを共通化する"
```

---

## Task 3: `useRite`/`useRevelation`/`useOracle`の重複解消

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`(`useRite`・`useRevelation`・`useOracle`)

- [ ] **Step 1: `applyDiscretionFrostBonus`ヘルパーを追加し、`useRite`を書き換える**

`src/lib/game/shidasu/engine.ts`内、`useRite`関数(`grep -n "export function useRite"`で位置を特定できる)内、以下の行:

```ts
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
```

を以下に置き換える:

```ts
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(run, params, wave)
```

`useRite`関数の直前に、以下の`applyDiscretionFrostBonus`ヘルパーを新設する:

```ts
// 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび、waveのdiscretionN/frostXへ永続的に加算する。
function applyDiscretionFrostBonus(run: RunState, params: ShidasuParams, wave: WaveState): WaveState {
  let next = wave
  if (run.items.includes('discretion')) next = { ...next, discretionN: next.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) next = { ...next, frostX: next.frostX + params.talismans.frost.x }
  return next
}
```

- [ ] **Step 2: `useRevelation`を書き換える**

続けて同ファイル内、`useRevelation`関数(`grep -n "export function useRevelation"`で位置を特定できる)内、以下の行:

```ts
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
```

を以下に置き換える:

```ts
  let { wave, deckComposition } = applyRevelationEffect(params, run.wave, run.deckComposition, revelationId, targetCol, rand)
  wave = applyDiscretionFrostBonus(run, params, wave)
```

- [ ] **Step 3: `useOracle`を書き換える**

続けて同ファイル内、`useOracle`関数(`grep -n "export function useOracle"`で位置を特定できる)内、以下のブロック:

```ts
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  // 果断・星霜: 天啓・神託・秘儀のいずれかを使用するたび永続的に加算する
  if (wave) {
    if (run.items.includes('discretion')) wave = { ...wave, discretionN: wave.discretionN + params.talismans.discretion.n }
    if (run.items.includes('frost')) wave = { ...wave, frostX: wave.frostX + params.talismans.frost.x }
  }
```

を以下に置き換える:

```ts
  let wave = run.wave ? { ...run.wave, oracleLevels } : run.wave
  if (wave) wave = applyDiscretionFrostBonus(run, params, wave)
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(`useRite`/`useRevelation`/`useOracle`関連の既存テストを含め、無修正のまま全てグリーンになるはず)

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(コア進行系のリファクタはこれで完了)

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "refactor: applyDiscretionFrostBonusヘルパーを追加しuseRite・useRevelation・useOracleを共通化する"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、カードプレイ・山札引き・手詰まり救済(該当護符所持時)・秘儀使用・天啓使用・神託使用が壊れていないことを一通り確認する(ブラウザ操作が困難な環境であれば、型チェック・ビルドの成功で代替してよい)
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
