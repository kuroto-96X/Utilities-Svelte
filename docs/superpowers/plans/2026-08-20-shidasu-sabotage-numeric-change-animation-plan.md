# 妨害行動アニメーション(グループE: 数値変化系) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 数値変化系の妨害行動7個(`comboBreather`・`comboReduce`・`currencyConfiscate`・`currencyDrain`・`roleLevelDecay`・`roleBias`・`tsukumokaRelease`、`rewardReduce`はスコープ外)に発動演出(シェイク+マイナス数字/倍率/テキストのポップアップ)を実装する。

**Architecture:** `SabotageResult`に`numericChangeTarget`フィールドを新設し、各効果関数が実際の変化量(上限クランプ後)を明示的に返す。`PlayArea.svelte`に`numericPopupTarget`という共通stateを持たせ、`lastSabotage`検知経由でセットする。コンボ表示は`PlayArea.svelte`内で完結するが、通貨表示・`RoleStatusPanel`・レリックバッジは`PlayArea`の外(`+page.svelte`・デバッグ画面)にあるため、既存の`onSealFlashChange`等と同じコールバックprops(`onNumericPopupChange`)経由で連携する。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-20-shidasu-sabotage-numeric-change-animation-design.md`

---

### Task 1: `SabotageResult.numericChangeTarget`と`WaveState.lastSabotage.numericChangeTarget`の型追加

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:27-53`(`SabotageResult`インターフェース)
- Modify: `src/lib/game/shidasu/types.ts:312`(`WaveState.lastSabotage`)

- [ ] **Step 1: `SabotageResult`に`numericChangeTarget`を追加**

`src/lib/game/shidasu/sabotageEffects.ts`の`SabotageResult`インターフェースの末尾(`forceActivatedTarget`フィールドの閉じ`}`の直前)に以下を追加する:

```ts
  // 今回「数値変化系」(comboBreather/comboReduce/currencyConfiscate/currencyDrain/
  // roleLevelDecay/roleBias/tsukumokaRelease)で変化した対象と内容を明示的に伝える。
  // 上限クランプ(0未満にしないなど)により実際の変化量が固定値と一致しないケースが
  // あるため、各効果関数が実際の変化量を計算して返す。
  numericChangeTarget?:
    | { kind: 'combo'; amount: number }
    | { kind: 'currency'; amount: number }
    | { kind: 'roleLevel'; names: RoleName[]; amount: number }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }
    | { kind: 'tsukumoka'; relicId: RelicId }
```

修正後、`SabotageResult`インターフェース全体は以下のようになる:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  affectedTableauCols?: number[]
  purgedToDiscardCount?: number
  confiscatedTarget?:
    | { kind: 'talisman'; id: ItemId; idx: number }
    | { kind: 'rite'; id: RiteId; idx: number }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number }
    | { kind: 'relic'; id: RelicId; idx: number }
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
  // 今回「数値変化系」(comboBreather/comboReduce/currencyConfiscate/currencyDrain/
  // roleLevelDecay/roleBias/tsukumokaRelease)で変化した対象と内容を明示的に伝える。
  // 上限クランプ(0未満にしないなど)により実際の変化量が固定値と一致しないケースが
  // あるため、各効果関数が実際の変化量を計算して返す。
  numericChangeTarget?:
    | { kind: 'combo'; amount: number }
    | { kind: 'currency'; amount: number }
    | { kind: 'roleLevel'; names: RoleName[]; amount: number }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }
    | { kind: 'tsukumoka'; relicId: RelicId }
}
```

- [ ] **Step 2: `WaveState.lastSabotage`に`numericChangeTarget`を追加**

`src/lib/game/shidasu/types.ts`の312行目、現在の内容:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number; confiscatedTarget?: { kind: 'talisman'; id: ItemId; idx: number } | { kind: 'rite'; id: RiteId; idx: number } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number } | { kind: 'relic'; id: RelicId; idx: number }; forceActivatedTarget?: { kind: 'rite'; id: RiteId } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef } }
```

を以下に置き換える:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number; confiscatedTarget?: { kind: 'talisman'; id: ItemId; idx: number } | { kind: 'rite'; id: RiteId; idx: number } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number } | { kind: 'relic'; id: RelicId; idx: number }; forceActivatedTarget?: { kind: 'rite'; id: RiteId } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }; numericChangeTarget?: { kind: 'combo'; amount: number } | { kind: 'currency'; amount: number } | { kind: 'roleLevel'; names: RoleName[]; amount: number } | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] } | { kind: 'tsukumoka'; relicId: RelicId } }
```

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし(型追加のみで、既存コードはこれらの新規フィールドを参照していないため何も壊れない)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/types.ts
git commit -m "feat: SabotageResultとWaveState.lastSabotageにnumericChangeTargetを追加する"
```

---

### Task 2: 数値変化系7効果関数がnumericChangeTargetを返すよう修正する

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`(`applyComboBreather`・`applyComboReduce`・`applyCurrencyConfiscate`・`applyCurrencyDrain`・`applyRoleLevelDecay`・`applyRoleBias`・`applyTsukumokaRelease`)
- Modify: `src/lib/game/shidasu/engine.ts:1153`(`triggerSabotage`の`lastSabotage`組み立て)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック内(`runWithWave`ヘルパーが使えるスコープ)に、既存の該当妨害行動テストの付近を探して追記する:

```bash
grep -n "'comboBreather'\|'comboReduce'\|'currencyConfiscate'\|'currencyDrain'\|'roleLevelDecay'\|'roleBias'\|'tsukumokaRelease'" src/lib/game/shidasu/engine.test.ts
```

見つかった既存テストの直後に、以下のテストを追記する(見つかった行番号によって挿入位置を調整すること。テスト自体は独立しているため、`describe('triggerSabotage', ...)`ブロック内であれば挿入順は問わない):

```ts
  it('comboBreather: lastSabotage.numericChangeTargetに実際の減少量(発動前のcombo値)を設定する', () => {
    const run = runWithWave({}, { combo: 7 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboBreather', () => 0)
    expect(next.wave!.combo).toBe(0)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'combo', amount: 7 })
  })

  it('comboReduce: lastSabotage.numericChangeTargetに実際の減少量(上限クランプ考慮)を設定する', () => {
    const run = runWithWave({}, { combo: 5 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboReduce', () => 0)
    expect(next.wave!.combo).toBe(2)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'combo', amount: 3 })
  })

  it('comboReduce: comboが3未満のとき、実際の減少量は0未満にならずクランプされた値になる', () => {
    const run = runWithWave({}, { combo: 1 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'comboReduce', () => 0)
    expect(next.wave!.combo).toBe(0)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'combo', amount: 1 })
  })

  it('currencyConfiscate: lastSabotage.numericChangeTargetに実際の減少量を設定する', () => {
    const run = runWithWave({ currency: 10 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyConfiscate', () => 0)
    expect(next.currency).toBe(5)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'currency', amount: 5 })
  })

  it('currencyConfiscate: currencyが5未満のとき、実際の減少量は0未満にならずクランプされた値になる', () => {
    const run = runWithWave({ currency: 3 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyConfiscate', () => 0)
    expect(next.currency).toBe(0)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'currency', amount: 3 })
  })

  it('currencyDrain: lastSabotage.numericChangeTargetに実際の減少量(20%切り捨て)を設定する', () => {
    const run = runWithWave({ currency: 10 })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'currencyDrain', () => 0)
    expect(next.currency).toBe(8)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'currency', amount: 2 })
  })

  it('roleLevelDecay: lastSabotage.numericChangeTargetに対象2役とamount=1を設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleLevelDecay', () => 0)
    const changed = next.wave!.lastSabotage?.numericChangeTarget
    expect(changed?.kind).toBe('roleLevel')
    expect((changed as { kind: 'roleLevel'; names: RoleName[]; amount: number }).names).toHaveLength(2)
    expect((changed as { kind: 'roleLevel'; names: RoleName[]; amount: number }).amount).toBe(1)
  })

  it('roleBias: lastSabotage.numericChangeTargetにbuffed/nerfedの5役ずつを設定する', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'roleBias', () => 0)
    const changed = next.wave!.lastSabotage?.numericChangeTarget
    expect(changed?.kind).toBe('roleBias')
    expect((changed as { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }).buffed).toHaveLength(5)
    expect((changed as { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }).nerfed).toHaveLength(5)
  })

  it('tsukumokaRelease: lastSabotage.numericChangeTargetに対象レリックのidを設定する', () => {
    const run = runWithWave({ relics: [{ id: 'kumade', tsukumoka: true }, { id: 'fukuzasa', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tsukumokaRelease', () => 0)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toEqual({ kind: 'tsukumoka', relicId: 'kumade' })
  })

  it('tsukumokaRelease: 付喪化済みレリックが0件ならnumericChangeTargetは設定されない', () => {
    const run = runWithWave({ relics: [{ id: 'fukuzasa', tsukumoka: false }] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'tsukumokaRelease', () => 0)
    expect(next.wave!.lastSabotage?.numericChangeTarget).toBeUndefined()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- engine.test.ts -t "numericChangeTarget"`
Expected: FAIL(`numericChangeTarget`が`undefined`のまま、`tsukumokaRelease`の0件ケース以外は失敗)

- [ ] **Step 3: `applyComboBreather`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyComboBreather`関数:

```ts
function applyComboBreather(_ctx: SabotageContext): SabotageResult {
  return { wave: { combo: 0 } }
}
```

を以下に置き換える:

```ts
function applyComboBreather({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: 0 }, numericChangeTarget: { kind: 'combo', amount: wave.combo } }
}
```

- [ ] **Step 4: `applyComboReduce`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyComboReduce`関数:

```ts
function applyComboReduce({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: Math.max(0, wave.combo - 3) } }
}
```

を以下に置き換える:

```ts
function applyComboReduce({ wave }: SabotageContext): SabotageResult {
  const next = Math.max(0, wave.combo - 3)
  return { wave: { combo: next }, numericChangeTarget: { kind: 'combo', amount: wave.combo - next } }
}
```

- [ ] **Step 5: `applyCurrencyConfiscate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyCurrencyConfiscate`関数:

```ts
function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  return { run: { currency: Math.max(0, run.currency - 5) } }
}
```

を以下に置き換える:

```ts
function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  const next = Math.max(0, run.currency - 5)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}
```

- [ ] **Step 6: `applyCurrencyDrain`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyCurrencyDrain`関数:

```ts
function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  return { run: { currency: Math.max(0, run.currency - loss) } }
}
```

を以下に置き換える:

```ts
function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  const next = Math.max(0, run.currency - loss)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}
```

- [ ] **Step 7: `applyRoleLevelDecay`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRoleLevelDecay`関数:

```ts
function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels } }
}
```

を以下に置き換える:

```ts
function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels }, numericChangeTarget: { kind: 'roleLevel', names, amount: 1 } }
}
```

- [ ] **Step 8: `applyRoleBias`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRoleBias`関数の現在の内容を確認する:

```bash
grep -n "function applyRoleBias" -A 8 src/lib/game/shidasu/sabotageEffects.ts
```

現在の実装(`shuffled`・`half`・`buffed`・`nerfed`を算出し`activeSeal`を返す部分)を、`numericChangeTarget`を追加で返す形に置き換える:

```ts
function applyRoleBias({ rand }: SabotageContext): SabotageResult {
  const shuffled = [...ORACLE_POOL]
  shuffleInPlace(shuffled, rand)
  const half = Math.floor(shuffled.length / 2)
  const buffed = shuffled.slice(0, half)
  const nerfed = shuffled.slice(half)
  return {
    wave: { activeSeal: { kind: 'roleBias', buffed, nerfed, multiplier: 2 } },
    numericChangeTarget: { kind: 'roleBias', buffed, nerfed },
  }
}
```

- [ ] **Step 9: `applyTsukumokaRelease`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyTsukumokaRelease`関数:

```ts
function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics } }
}
```

を以下に置き換える:

```ts
function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics }, numericChangeTarget: { kind: 'tsukumoka', relicId: target.id } }
}
```

- [ ] **Step 10: `triggerSabotage`が`numericChangeTarget`を`lastSabotage`へ含めるよう修正**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、`lastSabotage`の組み立て部分(1153行目):

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget },
```

を以下に置き換える:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget, numericChangeTarget: result.numericChangeTarget },
```

- [ ] **Step 11: テストを実行して成功を確認**

Run: `npm test -- engine.test.ts -t "numericChangeTarget"`
Expected: PASS(11件すべて)

- [ ] **Step 12: 型チェックとフルテストを実行**

Run: `npm run check`
Run: `npm test -- engine.test.ts`
Expected: どちらもエラーなし

- [ ] **Step 13: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 数値変化系7種の効果関数がnumericChangeTargetを返すようにする"
```

---

### Task 3: PlayArea.svelteにnumericPopupTarget状態と検知ロジックを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`startPressPulseAnimation`関数の直後、状態・関数追加)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`$effect.pre`、`lastSabotage`検知ブロック)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(props定義、`onNumericPopupChange`追加)
- Modify: `src/routes/game/shidasu/sabotageAnimations.css`(新規keyframes追加)

**重要な設計上の注意:** グループCの`pressPulseActive`と同様、`numericPopupActive`は`anyAnimationActive`に含め**ない**(design doc記載の意図的な設計判断。効果自体は`triggerSabotage`実行時点で既に確定済みのため、演出=装飾の完了を待ってから次の操作を許可する必要が無い)。

- [ ] **Step 1: `sabotageAnimations.css`にシェイク+ポップアップのkeyframesを追加**

`src/routes/game/shidasu/sabotageAnimations.css`の末尾に以下を追記する(既存の`shidasu-seal-flash`・`shidasu-confiscate-fade`・`shidasu-press-pulse`定義は変更しない):

```css

/* 妨害行動「数値変化系」発動時、対象UI要素(コンボ表示・通貨表示・役ステータス行・
   レリックバッジ)が変化する瞬間の演出。要素自体が赤く縁取られて短くシェイクすると
   同時に、変化内容を示すテキスト(マイナス数字・倍率・状態名)が右上にポップして
   浮かび上がりながら消える。 */
@keyframes shidasu-numeric-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}

.shidasu-numeric-shake {
  animation: shidasu-numeric-shake 0.4s ease-out;
}

@keyframes shidasu-numeric-popup {
  0% { transform: translateY(0) scale(0.8); opacity: 0; }
  20% { transform: translateY(-8px) scale(1.1); opacity: 1; }
  100% { transform: translateY(-36px) scale(1); opacity: 0; }
}

.shidasu-numeric-popup {
  position: absolute;
  top: -4px;
  right: -8px;
  color: #f87171;
  font-weight: 900;
  font-size: 18px;
  pointer-events: none;
  animation: shidasu-numeric-popup 0.5s ease-out forwards;
}
```

- [ ] **Step 2: `NumericChangeTarget`型・状態・トリガー関数を通常の`<script>`に追加**

`src/routes/game/shidasu/PlayArea.svelte`の`startPressPulseAnimation`関数の直後(`startStockShuffleAnimation`関数の直前)を探す:

```bash
grep -n "function startPressPulseAnimation\|function startStockShuffleAnimation" src/routes/game/shidasu/PlayArea.svelte
```

以下を追加する:

```ts

  // 妨害行動「数値変化系」(comboBreather・comboReduce・currencyConfiscate・currencyDrain・
  // roleLevelDecay・roleBias・tsukumokaRelease)発動時のシェイク+ポップアップ演出用。
  // lastSabotage.numericChangeTargetと同じ型をそのまま再利用する。+page.svelte側からも
  // 同じ型をimportして使うため、exportする。
  export type NumericChangeTarget = Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']

  let numericPopupTarget = $state<NumericChangeTarget | null>(null)
  let numericPopupActive = $state(false)

  // numericPopupActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・sealFlashActive等と同じ原則)。ただしこのstate自体はanyAnimationActiveには
  // 含めない(効果は同期的に即座へ適用されるため、演出=装飾の完了を待つ必要が無い、
  // pressPulseActiveと同じ理由)。
  function startNumericPopupAnimation(target: NonNullable<NumericChangeTarget>) {
    numericPopupActive = true
    numericPopupTarget = target
    onNumericPopupChange?.(target)
    const timer = setTimeout(() => {
      numericPopupActive = false
      numericPopupTarget = null
      onNumericPopupChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }
```

- [ ] **Step 3: `numericChangePopupText`関数をモジュールスクリプトに追加**

`numericChangePopupText`は`+page.svelte`・デバッグ画面からも呼び出す必要がある。グループBの実装時に判明した制約として、通常のインスタンス`<script>`内の`export function`は他ファイルから名前付きimportできない(コンポーネントpropsとして扱われる)ため、複数ファイルから再利用する関数は`<script module>`ブロックに書く必要がある(`withFadingId`と同じパターン)。

`src/routes/game/shidasu/PlayArea.svelte`の`<script module lang="ts">`ブロックを探す:

```bash
grep -n "<script module" -A 20 src/routes/game/shidasu/PlayArea.svelte
```

`<script module lang="ts">`ブロック内の`withFadingId`関数の直後に、以下を追加する(`NumericChangeTarget`型はStep 2で追加した通常の`<script>`側の型のため、モジュールスクリプト側では`Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']`を直接使う。`RoleName`・`WaveState`のimportがモジュールスクリプトのimport文に無ければ追加すること):

```ts

  // numericChangeTargetのkindに応じて、ポップアップに表示するテキストを算出する。
  // roleBiasは対象役ごとに強化/減衰いずれかでテキストが変わるため、呼び出し側が
  // 対象のroleNameを渡して判定する(コンボ・通貨・役レベルは単一の値なのでroleName不要)。
  // +page.svelte・デバッグ画面からもimportして使うため、moduleスクリプトでexportする
  // (通常のインスタンススクリプト内のexport functionは他ファイルから名前付きimport
  // できないため、withFadingIdと同じ理由でこちらに配置する)。
  export function numericChangePopupText(target: NonNullable<Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']>, roleName?: RoleName): string {
    if (target.kind === 'combo' || target.kind === 'currency') return `−${target.amount}`
    if (target.kind === 'roleLevel') return `−${target.amount}`
    if (target.kind === 'roleBias') {
      if (roleName && target.buffed.includes(roleName)) return '×2'
      if (roleName && target.nerfed.includes(roleName)) return '×0.5'
      return ''
    }
    return '付喪化解除'
  }
```

- [ ] **Step 4: `$effect.pre`で数値変化系7種の発動を検知する**

既存の`lastSabotage`検知ブロックを探す:

```bash
grep -n "let previousSabotageSeq" src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループC実装後の状態):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    } else if (current.id === 'talismanConfiscate' || current.id === 'riteConfiscate' || current.id === 'revelationOracleConfiscate' || current.id === 'relicConfiscate') {
      if (current.confiscatedTarget) {
        startConfiscateFadeAnimation(current.confiscatedTarget)
      }
    } else if (current.id === 'riteForceActivate' || current.id === 'revelationOracleForceActivate') {
      if (current.forceActivatedTarget) {
        startPressPulseAnimation(current.forceActivatedTarget)
      }
    }
  })
```

を以下に置き換える(既存の5つの分岐はそのまま残し、6つ目の`else if`を追加する):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    } else if ((current.id === 'stockPurge' || current.id === 'stockPurgeSmall') && current.purgedToDiscardCount) {
      startStockPurgeAnimation(current.purgedToDiscardCount)
    } else if (current.id === 'talismanSeal' || current.id === 'riteSeal' || current.id === 'revelationOracleSeal' || current.id === 'roleSeal' || current.id === 'comboCap') {
      if (wave.activeSeal && wave.activeSeal.kind !== 'talismanHidden' && wave.activeSeal.kind !== 'roleBias') {
        startSealFlashAnimation(wave.activeSeal)
      }
    } else if (current.id === 'talismanConfiscate' || current.id === 'riteConfiscate' || current.id === 'revelationOracleConfiscate' || current.id === 'relicConfiscate') {
      if (current.confiscatedTarget) {
        startConfiscateFadeAnimation(current.confiscatedTarget)
      }
    } else if (current.id === 'riteForceActivate' || current.id === 'revelationOracleForceActivate') {
      if (current.forceActivatedTarget) {
        startPressPulseAnimation(current.forceActivatedTarget)
      }
    } else if (current.id === 'comboBreather' || current.id === 'comboReduce' || current.id === 'currencyConfiscate' || current.id === 'currencyDrain' || current.id === 'roleLevelDecay' || current.id === 'roleBias' || current.id === 'tsukumokaRelease') {
      if (current.numericChangeTarget) {
        startNumericPopupAnimation(current.numericChangeTarget)
      }
    }
  })
```

- [ ] **Step 5: `onNumericPopupChange`コールバックpropsを追加**

props定義の分割代入部分(`onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange,`の行、現在52行目)を以下に置き換える:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange, onNumericPopupChange,
```

型定義部分(`onPressPulseChange?: (target: PressPulseTarget | null) => void`の行、現在82行目)の直後に追加する:

```ts
    onNumericPopupChange?: (target: NumericChangeTarget | null) => void
```

- [ ] **Step 6: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/sabotageAnimations.css
git commit -m "feat: PlayAreaに数値変化系妨害行動のポップアップ演出状態と検知ロジックを追加する"
```

---

### Task 4: コンボ表示にシェイク+ポップアップ演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:1271-1292`(コンボ表示ブロック)

- [ ] **Step 1: コンボ表示にシェイク+ポップアップを追加**

コンボ表示ブロックの現在の内容を確認する:

```bash
grep -n "showScoreAndCombo}" -A 22 src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループA実装後の状態、Task 2〜3での変更後も変わらないはず):

```svelte
  {#if showScoreAndCombo}
    {@const comboCapMax = wave.activeSeal?.kind === 'comboCap' ? wave.activeSeal.max : null}
    {@const comboCapFlashing = sealFlashTarget?.kind === 'comboCap'}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div
          bind:this={scoreNumberEl}
          class="text-xl font-black text-amber-50 tabular-nums ease-out"
          style="transform: scale({scoreNumberScale}); transition-property: transform; transition-duration:{scoreNumberTransitionMs}ms;"
        >
          {displayedScore} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboCapFlashing ? 'shidasu-seal-flash' : ''} {comboCapMax !== null ? 'text-rose-400' : comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}{#if comboCapMax !== null}<span class="text-lg not-italic ml-1 text-rose-300">/{comboCapMax}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
```

を以下に置き換える(`comboNumericPopup`判定の追加、コンボ数値の`<div>`に`position: relative`とシェイククラス、ポップアップの`<span>`を追加):

```svelte
  {#if showScoreAndCombo}
    {@const comboCapMax = wave.activeSeal?.kind === 'comboCap' ? wave.activeSeal.max : null}
    {@const comboCapFlashing = sealFlashTarget?.kind === 'comboCap'}
    {@const comboNumericPopup = numericPopupTarget?.kind === 'combo' ? numericPopupTarget : undefined}
    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div
          bind:this={scoreNumberEl}
          class="text-xl font-black text-amber-50 tabular-nums ease-out"
          style="transform: scale({scoreNumberScale}); transition-property: transform; transition-duration:{scoreNumberTransitionMs}ms;"
        >
          {displayedScore} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[displayComboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="relative text-3xl font-black italic tabular-nums leading-none {comboCapFlashing ? 'shidasu-seal-flash' : ''} {comboNumericPopup ? 'shidasu-numeric-shake' : ''} {comboCapMax !== null ? 'text-rose-400' : comboColor[displayComboTier]}">
          {wave.combo}{#if wave.baseComboCount > 0}<span class="text-lg not-italic ml-1 text-emerald-300/80">+{wave.baseComboCount}</span>{/if}{#if comboCapMax !== null}<span class="text-lg not-italic ml-1 text-rose-300">/{comboCapMax}</span>{/if}
          {#if comboNumericPopup}<span class="shidasu-numeric-popup">{numericChangePopupText(comboNumericPopup)}</span>{/if}
        </div>
      </div>
    </div>
  {/if}
```

- [ ] **Step 2: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: コンボ表示に数値変化系妨害行動のシェイク+ポップアップ演出を適用する"
```

---

### Task 5: +page.svelteで通貨表示・RoleStatusPanel・レリックバッジにシェイク+ポップアップ演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(import、状態宣言、`stageRow`スニペット、`itemBadges`スニペット、`<PlayArea>`呼び出し、`shakingRoles`算出、`<RoleStatusPanel>`呼び出し)
- Modify: `src/routes/game/shidasu/RoleStatusPanel.svelte`(`shakingRoles` propsとポップアップ適用)

**注意:** このタスクを開始する前に、Task 3〜4の変更(コミット済み)により`+page.svelte`側の行番号がズレている可能性は低い(`+page.svelte`自体は今回まだ変更していないため)が、念のため以下のコマンドで実際の行番号を確認してから作業すること:

```bash
grep -n "import type { SealFlashTarget\|let pressPulseTarget\|onPressPulseChange=\|snippet stageRow\|run\.relics\.length\|<RoleStatusPanel" src/routes/game/shidasu/+page.svelte
```

- [ ] **Step 1: `NumericChangeTarget`型・`numericChangePopupText`のimportと`numericPopupTarget`用の`$state`を追加**

`src/routes/game/shidasu/+page.svelte`の35-36行目:

```ts
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget } from './PlayArea.svelte'
  import { withFadingId } from './PlayArea.svelte'
```

を以下に置き換える:

```ts
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget, NumericChangeTarget } from './PlayArea.svelte'
  import { withFadingId, numericChangePopupText } from './PlayArea.svelte'
```

`let pressPulseTarget = $state<PressPulseTarget | null>(null)`の行(現在125行目)の直後、`pressPulseTimer`の`onDestroy`ブロックの直後に追加する:

```ts

  // PlayArea側で発動検知したnumericPopupTarget(数値変化系妨害行動のシェイク+ポップアップ
  // 演出対象)を受け取って保持する。通貨表示(stageRow)・RoleStatusPanel・レリックバッジは
  // PlayAreaの外側にあるため、コールバックprops経由で値を受け渡す。
  let numericPopupTarget = $state<NumericChangeTarget | null>(null)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onNumericPopupChange`を渡す**

本編用`<PlayArea>`呼び出し(`onPressPulseChange={(target) => { pressPulseTarget = target }}`を含む行、現在740行目)の直後に追加する:

```svelte
    onNumericPopupChange={(target) => { numericPopupTarget = target }}
```

**注意:** 天啓プレビュー用の`<PlayArea>`呼び出し(`disableRites={true}`を渡している方)には追加不要。数値変化系妨害行動は`playing`フェーズ中のみ発動し、天啓プレビュー中には発動しないため(グループA〜Cと同じ判断)。

- [ ] **Step 3: `stageRow`スニペットの通貨表示にシェイク+ポップアップを追加**

`stageRow`スニペット内の通貨表示部分の現在の内容:

```bash
grep -n "snippet stageRow" -A 12 src/routes/game/shidasu/+page.svelte
```

現在の内容(550-560行目付近):

```svelte
{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
      <span class="text-yellow-300 font-bold">{params.currency.symbol}{run.currency}</span>
    </span>
```

を以下に置き換える(`currencyNumericPopup`判定の追加、通貨表示の`<span>`に`position: relative`とシェイククラス、ポップアップの`<span>`を追加):

```svelte
{#snippet stageRow()}
  {@const currencyNumericPopup = numericPopupTarget?.kind === 'currency' ? numericPopupTarget : undefined}
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
      <span class="relative text-yellow-300 font-bold {currencyNumericPopup ? 'shidasu-numeric-shake' : ''}">
        {params.currency.symbol}{run.currency}
        {#if currencyNumericPopup}<span class="shidasu-numeric-popup">{numericChangePopupText(currencyNumericPopup)}</span>{/if}
      </span>
    </span>
```

**注意:** `{#snippet stageRow()}`の直下は既存のSvelteスニペット構文上、`{@const}`をトップレベルに置ける(スニペットも`{@const}`を許容するブロックの一種)。もし`npm run check`で構文エラーが出た場合は、Svelteのルールに従って`{@const}`の位置を調整すること(このプロジェクトで過去に複数回`{@const}`配置の構文制約に遭遇した実績がある)。

- [ ] **Step 4: `itemBadges`スニペットのレリックバッジにシェイク+ポップアップを追加**

`itemBadges`スニペット内のレリックバッジ部分の現在の内容:

```bash
grep -n "run\.relics\.length > 0 || confiscateFadingTarget" -A 14 src/routes/game/shidasu/+page.svelte
```

現在の内容(625-639行目付近、グループB実装後の状態):

```svelte
    {#if run.relics.length > 0 || confiscateFadingTarget?.kind === 'relic'}
      {@const relicFading = confiscateFadingTarget?.kind === 'relic' ? confiscateFadingTarget : undefined}
      {@const relicFadingPos = relicFading ? Math.min(relicFading.idx, run.relics.length) : -1}
      {@const displayedRelics = relicFading
        ? [...run.relics.slice(0, relicFadingPos), { id: relicFading.id, tsukumoka: false }, ...run.relics.slice(relicFadingPos)]
        : run.relics}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRelics as relic, i (i)}
          {@const fading = relicFading !== undefined && i === relicFadingPos}
          <span class="text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5 {fading ? 'shidasu-confiscate-fade' : ''}" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
          </span>
        {/each}
      </div>
    {/if}
```

を以下に置き換える(`relicShaking`判定の追加、対象レリックバッジに`position: relative`とシェイククラス、ポップアップの`<span>`を追加):

```svelte
    {#if run.relics.length > 0 || confiscateFadingTarget?.kind === 'relic'}
      {@const relicFading = confiscateFadingTarget?.kind === 'relic' ? confiscateFadingTarget : undefined}
      {@const relicFadingPos = relicFading ? Math.min(relicFading.idx, run.relics.length) : -1}
      {@const displayedRelics = relicFading
        ? [...run.relics.slice(0, relicFadingPos), { id: relicFading.id, tsukumoka: false }, ...run.relics.slice(relicFadingPos)]
        : run.relics}
      <div class="flex flex-wrap gap-1 justify-end">
        {#each displayedRelics as relic, i (i)}
          {@const fading = relicFading !== undefined && i === relicFadingPos}
          {@const relicShaking = numericPopupTarget?.kind === 'tsukumoka' && numericPopupTarget.relicId === relic.id}
          <span class="relative text-xs bg-amber-900 text-amber-200/90 border border-amber-600/40 rounded px-1.5 py-0.5 {fading ? 'shidasu-confiscate-fade' : ''} {relicShaking ? 'shidasu-numeric-shake' : ''}" title={relic.tsukumoka ? relicTsukumokaDesc(relic.id, params) : relicDesc(relic.id, params)}>
            {relicName(relic.id, params)}{relic.tsukumoka ? ' ★' : ''}
            {#if relicShaking && numericPopupTarget?.kind === 'tsukumoka'}<span class="shidasu-numeric-popup">{numericChangePopupText(numericPopupTarget)}</span>{/if}
          </span>
        {/each}
      </div>
    {/if}
```

- [ ] **Step 5: `shakingRoles`を算出し`RoleStatusPanel`に渡す**

`flashingRoles`の`$derived.by`定義(現在131-135行目)の直後に追加する:

```ts

  // 妨害行動「数値変化系」(roleLevelDecay・roleBias)発動時、RoleStatusPanelの対象役に
  // シェイク+ポップアップ演出を適用するための算出。役ごとに表示テキストが異なるため
  // (roleLevelDecayは全対象で「−1」固定、roleBiasは強化/減衰で「×2」/「×0.5」)、
  // 単純な役名配列ではなく{ name, text }の配列として渡す。
  let shakingRoles = $derived.by((): { name: RoleName; text: string }[] => {
    if (numericPopupTarget?.kind === 'roleLevel') {
      return numericPopupTarget.names.map(name => ({ name, text: numericChangePopupText(numericPopupTarget, name) }))
    }
    if (numericPopupTarget?.kind === 'roleBias') {
      return [...numericPopupTarget.buffed, ...numericPopupTarget.nerfed].map(name => ({ name, text: numericChangePopupText(numericPopupTarget, name) }))
    }
    return []
  })
```

`<RoleStatusPanel {params} oracleLevels={run.oracleLevels} {sealedRoleEffect} {flashingRoles} />`の行(現在752行目)を以下に置き換える:

```svelte
  <RoleStatusPanel {params} oracleLevels={run.oracleLevels} {sealedRoleEffect} {flashingRoles} {shakingRoles} />
```

- [ ] **Step 6: `RoleStatusPanel.svelte`に`shakingRoles` propsとポップアップ適用を追加**

`src/routes/game/shidasu/RoleStatusPanel.svelte`の現在の内容:

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import type { SealedRoleEffect } from '$lib/game/shidasu/engine'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, sealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null }, flashingRoles = [] }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    sealedRoleEffect?: SealedRoleEffect
    flashingRoles?: RoleName[]
  } = $props()

  // 妨害「役封印」「天啓封印(対象がoracleの場合)」中は、run.oracleLevelsそのものは
  // 書き換わらないまま実際のスコアリングだけが変化する。表示が実態と食い違わないよう、
  // ここでも同じ実効レベルを算出して使う(実際の適用ロジックはengine.tsのresolveSealedRoleEffect)。
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const storedLevel = oracleLevels[role.name]}
      {@const level = effectiveLevel(role.name, storedLevel)}
      {@const score = roleBasePoint(params, role.name) * level}
      {@const sealed = level !== storedLevel}
      {@const flashing = flashingRoles.includes(role.name)}
      <div class="flex items-center justify-between text-xs gap-2 {flashing ? 'shidasu-seal-flash' : ''}">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="font-bold {sealed ? 'text-rose-400' : 'text-yellow-300'}">Lv.{level}</span>
          <span class="ml-1 {sealed ? 'text-rose-300' : 'text-emerald-100/80'}">{score}点</span>
        </div>
      </div>
    {/each}
  </div>
</div>
```

を以下に置き換える(`shakingRoles` propsの追加、対象行への`shidasu-numeric-shake`クラスとポップアップ適用):

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import type { RoleName } from '$lib/game/shidasu/types'
  import type { SealedRoleEffect } from '$lib/game/shidasu/engine'
  import { ROLE_LIST, roleBasePoint } from '$lib/game/shidasu/roles'

  let { params, oracleLevels, sealedRoleEffect = { zeroRoles: [], oracleBaselineRole: null }, flashingRoles = [], shakingRoles = [] }: {
    params: ShidasuParams
    oracleLevels: Record<RoleName, number>
    sealedRoleEffect?: SealedRoleEffect
    flashingRoles?: RoleName[]
    shakingRoles?: { name: RoleName; text: string }[]
  } = $props()

  // 妨害「役封印」「天啓封印(対象がoracleの場合)」中は、run.oracleLevelsそのものは
  // 書き換わらないまま実際のスコアリングだけが変化する。表示が実態と食い違わないよう、
  // ここでも同じ実効レベルを算出して使う(実際の適用ロジックはengine.tsのresolveSealedRoleEffect)。
  function effectiveLevel(roleName: RoleName, storedLevel: number): number {
    if (sealedRoleEffect.zeroRoles.includes(roleName)) return 0
    if (sealedRoleEffect.oracleBaselineRole === roleName) return 1
    const mult = sealedRoleEffect.multipliers?.[roleName]
    return mult !== undefined ? storedLevel * mult : storedLevel
  }
</script>

<div class="px-4 pb-4">
  <div class="bg-emerald-900/50 border border-emerald-800 rounded-lg p-3 space-y-1.5">
    <div class="text-xs font-bold text-emerald-300/70 tracking-widest mb-1">役ステータス</div>
    {#each ROLE_LIST as role (role.name)}
      {@const storedLevel = oracleLevels[role.name]}
      {@const level = effectiveLevel(role.name, storedLevel)}
      {@const score = roleBasePoint(params, role.name) * level}
      {@const sealed = level !== storedLevel}
      {@const flashing = flashingRoles.includes(role.name)}
      {@const shaking = shakingRoles.find(s => s.name === role.name)}
      <div class="relative flex items-center justify-between text-xs gap-2 {flashing ? 'shidasu-seal-flash' : ''} {shaking ? 'shidasu-numeric-shake' : ''}">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-black text-amber-50 shrink-0">{role.label}</span>
          <span class="text-emerald-300/60 truncate">{role.desc}</span>
        </div>
        <div class="shrink-0 text-right">
          <span class="font-bold {sealed ? 'text-rose-400' : 'text-yellow-300'}">Lv.{level}</span>
          <span class="ml-1 {sealed ? 'text-rose-300' : 'text-emerald-100/80'}">{score}点</span>
        </div>
        {#if shaking}<span class="shidasu-numeric-popup">{shaking.text}</span>{/if}
      </div>
    {/each}
  </div>
</div>
```

- [ ] **Step 7: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 8: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte src/routes/game/shidasu/RoleStatusPanel.svelte
git commit -m "feat: 通貨表示・役ステータス・レリックバッジに数値変化系妨害行動のシェイク+ポップアップ演出を適用する"
```

---

### Task 6: デバッグ画面にコンボ・役ステータスのポップアップ演出を反映する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

design docのテストセクションで確認した通り、デバッグ画面には通貨表示・レリック所持機能が存在しないため、`currencyConfiscate`・`currencyDrain`・`tsukumokaRelease`はデバッグ画面では目視確認できない(エンジンレベルのテストで正確性を担保する)。一方、コンボ表示(`PlayArea`の`showScoreAndCombo`はデフォルト`true`)と`RoleStatusPanel`は既にデバッグ画面に存在するため、`comboBreather`・`comboReduce`・`roleLevelDecay`・`roleBias`は目視確認できる。

コンボ表示はTask 4の`PlayArea.svelte`修正がそのまま効くため、デバッグ画面側の追加作業は不要。`RoleStatusPanel`の`shakingRoles`propsのみ、デバッグ画面から接続する必要がある。

- [ ] **Step 1: `NumericChangeTarget`型・`numericChangePopupText`のimportと`numericPopupTarget`用の`$state`を追加**

`src/routes/admin/shidasu-debug/+page.svelte`の現在のimport文を確認する:

```bash
grep -n "import type { SealFlashTarget" src/routes/admin/shidasu-debug/+page.svelte
```

現在の内容(25行目):

```ts
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget } from '../../game/shidasu/PlayArea.svelte'
```

を以下に置き換える:

```ts
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget, NumericChangeTarget } from '../../game/shidasu/PlayArea.svelte'
  import { numericChangePopupText } from '../../game/shidasu/PlayArea.svelte'
```

**注意:** デバッグ画面が既に`withFadingId`をimportしているかどうかを確認し(`grep -n "import { withFadingId }" src/routes/admin/shidasu-debug/+page.svelte`)、既存の`import { withFadingId } from '../../game/shidasu/PlayArea.svelte'`がある場合は、それと同じimport文に`numericChangePopupText`を追記する形にすること(重複するimport文を作らない)。

`let pressPulseTarget = $state<PressPulseTarget | null>(null)`の行を探す:

```bash
grep -n "let pressPulseTarget = \$state" src/routes/admin/shidasu-debug/+page.svelte
```

その行の直後に追加する:

```ts

  let numericPopupTarget = $state<NumericChangeTarget | null>(null)
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onNumericPopupChange`を追加**

`onPressPulseChange={(target) => { pressPulseTarget = target }}`を含む行を探す:

```bash
grep -n "onPressPulseChange=" src/routes/admin/shidasu-debug/+page.svelte
```

その行の直後に追加する:

```svelte
          onNumericPopupChange={(target) => { numericPopupTarget = target }}
```

- [ ] **Step 3: `shakingRoles`を算出し`RoleStatusPanel`に渡す**

`flashingRoles`の`$derived.by`定義を探す:

```bash
grep -n "let flashingRoles = \$derived" src/routes/admin/shidasu-debug/+page.svelte
```

その定義の直後に追加する:

```ts

  let shakingRoles = $derived.by((): { name: RoleName; text: string }[] => {
    if (numericPopupTarget?.kind === 'roleLevel') {
      return numericPopupTarget.names.map(name => ({ name, text: numericChangePopupText(numericPopupTarget, name) }))
    }
    if (numericPopupTarget?.kind === 'roleBias') {
      return [...numericPopupTarget.buffed, ...numericPopupTarget.nerfed].map(name => ({ name, text: numericChangePopupText(numericPopupTarget, name) }))
    }
    return []
  })
```

`<RoleStatusPanel {params} oracleLevels={oracleLevels} {sealedRoleEffect} {flashingRoles} />`の行を探す:

```bash
grep -n "<RoleStatusPanel" src/routes/admin/shidasu-debug/+page.svelte
```

これを以下に置き換える:

```svelte
        <RoleStatusPanel {params} oracleLevels={oracleLevels} {sealedRoleEffect} {flashingRoles} {shakingRoles} />
```

- [ ] **Step 4: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: デバッグ画面に数値変化系妨害行動の役ステータスポップアップ演出を反映する"
```

---

### Task 7: デバッグ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/admin/shidasu-debug`で目視確認できる妨害行動を発動して確認する**

ブラウザで`http://localhost:5173/admin/shidasu-debug`を開き、以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- **comboBreather**(強制小休止): コンボを重ねた状態(カードプレイ等でコンボを積む、またはデバッグパネルの内部状態調整機能があれば利用する)で発動し、コンボ表示がシェイクして実際の減少量(発動前のコンボ数と同じマイナス数字)がポップすることを確認する
- **comboReduce**(コンボ削減): 同様にコンボを重ねた状態で発動し、コンボ表示がシェイクして「−3」(またはコンボが3未満ならクランプされた値)がポップすることを確認する
- **roleLevelDecay**(役減衰): 役レベルを上げた状態(デバッグパネルの`RoleStatusEditor`を使う)で発動し、対象2役がシェイクして「−1」がポップすることを確認する
- **roleBias**(役偏重): 発動し、強化側5役に「×2」、減衰側5役に「×0.5」がポップすることを確認する
- 各演出中(約500ms)も他の操作(カードプレイ・山札引き等)がブロックされないことを確認する(グループCと同じ挙動)

- [ ] **Step 3: `currencyConfiscate`・`currencyDrain`・`tsukumokaRelease`はコードレビュー・エンジンテストで正確性を確認する**

これら3つはデバッグ画面(通貨表示・レリック所持機能が無い)・実プレイ画面(ゲーム進行が必要で自動化困難)のいずれでも簡単には目視確認できない。Task 2で追加したエンジンレベルのテストと、実装時のコード品質レビューで正しさを担保する。

- [ ] **Step 4: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test -- engine.test.ts`
Expected: いずれもエラーなし
