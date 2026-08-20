# 妨害行動アニメーション(グループC: 強制発動系+通常発動共通化) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 強制発動系の妨害行動2個(`riteForceActivate`・`revelationOracleForceActivate`)に発動演出(自動プレス+パルス)を実装し、この演出をプレイヤーの通常クリック発動(秘儀・天啓・神託)にも共通適用する。

**Architecture:** `SabotageResult`に`forceActivatedTarget`フィールドを新設し、強制発動系2効果関数が選択済みの対象を明示的に返す。`PlayArea.svelte`に`pressPulseTarget`という共通stateを持たせ、強制発動検知(`lastSabotage`経由)・通常クリック(`onclick`経由)の両方から同じstateをセットする。秘儀・天啓ボタンは`PlayArea.svelte`内で完結し、神託「使」ボタンは`+page.svelte`側にあるため、既存の`onSealFlashChange`/`onConfiscateFadingChange`と同じコールバックprops(`onPressPulseChange`)経由で連携する。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-20-shidasu-sabotage-force-activate-animation-design.md`

---

### Task 1: `SabotageResult.forceActivatedTarget`と`WaveState.lastSabotage.forceActivatedTarget`の型追加

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:27-47`(`SabotageResult`インターフェース)
- Modify: `src/lib/game/shidasu/types.ts:312`(`WaveState.lastSabotage`)

- [ ] **Step 1: `SabotageResult`に`forceActivatedTarget`を追加**

`src/lib/game/shidasu/sabotageEffects.ts`の`SabotageResult`インターフェースの末尾(`confiscatedTarget`フィールドの閉じ`}`の直前)に以下を追加する:

```ts
  // 今回「強制発動系」(riteForceActivate/revelationOracleForceActivate)で即座に使用された対象。
  // 通常のプレイヤークリックと同じ処理(useRite/useRevelation/useOracle)を経由するため、活性化した
  // 対象自体を保持する仕組みが無い。ここで明示的に伝える。
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
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
  // 今回「強制発動系」(riteForceActivate/revelationOracleForceActivate)で即座に使用された対象。
  // 通常のプレイヤークリックと同じ処理(useRite/useRevelation/useOracle)を経由するため、活性化した
  // 対象自体を保持する仕組みが無い。ここで明示的に伝える。
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
}
```

- [ ] **Step 2: `WaveState.lastSabotage`に`forceActivatedTarget`を追加**

`src/lib/game/shidasu/types.ts`の312行目、現在の内容:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number; confiscatedTarget?: { kind: 'talisman'; id: ItemId; idx: number } | { kind: 'rite'; id: RiteId; idx: number } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number } | { kind: 'relic'; id: RelicId; idx: number } }
```

を以下に置き換える:

```ts
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number; confiscatedTarget?: { kind: 'talisman'; id: ItemId; idx: number } | { kind: 'rite'; id: RiteId; idx: number } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef; idx: number } | { kind: 'relic'; id: RelicId; idx: number }; forceActivatedTarget?: { kind: 'rite'; id: RiteId } | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef } }
```

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし(型追加のみで、既存コードはこれらの新規フィールドを参照していないため何も壊れない)

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/types.ts
git commit -m "feat: SabotageResultとWaveState.lastSabotageにforceActivatedTargetを追加する"
```

---

### Task 2: 強制発動系2効果関数がforceActivatedTargetを返すよう修正する

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:220-226`(`applyRiteForceActivate`)
- Modify: `src/lib/game/shidasu/sabotageEffects.ts:262-281`(`applyRevelationOracleForceActivate`)
- Modify: `src/lib/game/shidasu/engine.ts:1153`(`triggerSabotage`の`lastSabotage`組み立て)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('triggerSabotage', ...)`ブロック内(`runWithWave`ヘルパーが使えるスコープ)に、以下のテストを追記する。既存の`riteForceActivate`・`revelationOracleForceActivate`関連テストが定義されている箇所を探して、その付近に追加する:

```bash
grep -n "riteForceActivate:\|revelationOracleForceActivate:" src/lib/game/shidasu/engine.test.ts
```

見つかった既存テストの直後に、以下のテストを追記する:

```ts
  it('riteForceActivate: lastSabotage.forceActivatedTargetに強制発動した秘儀のidを設定する', () => {
    const run = runWithWave({ rites: ['gebo', 'fehu'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteForceActivate', () => 0)
    expect(next.wave!.lastSabotage?.forceActivatedTarget).toEqual({ kind: 'rite', id: 'gebo' })
  })

  it('riteForceActivate: 使用可能な秘儀が0件ならforceActivatedTargetは設定されない', () => {
    const run = runWithWave({ rites: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'riteForceActivate', () => 0)
    expect(next.wave!.lastSabotage?.forceActivatedTarget).toBeUndefined()
  })

  it('revelationOracleForceActivate: 天啓が選ばれた場合、forceActivatedTargetにref.kind=revelationを設定する', () => {
    const run = runWithWave({ revelations: ['kaku'], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.wave!.lastSabotage?.forceActivatedTarget).toEqual({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: 'kaku' } })
  })

  it('revelationOracleForceActivate: 神託が選ばれた場合、forceActivatedTargetにref.kind=oracleを設定する', () => {
    const run = runWithWave({ revelations: [], oracles: ['pair'] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.wave!.lastSabotage?.forceActivatedTarget).toEqual({ kind: 'revelationOrOracle', ref: { kind: 'oracle', id: 'pair' } })
  })

  it('revelationOracleForceActivate: 天啓・神託とも0件ならforceActivatedTargetは設定されない', () => {
    const run = runWithWave({ revelations: [], oracles: [] })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'revelationOracleForceActivate', () => 0)
    expect(next.wave!.lastSabotage?.forceActivatedTarget).toBeUndefined()
  })
```

**注意:** `riteForceActivate`は`canUseRite`で使用可能な秘儀のみを対象にするため、テストで使う秘儀(`gebo`・`fehu`)が実際に`canUseRite`の条件(場札・山札・チェーンの状態など)を満たすかどうかは、既存の`riteForceActivate`関連テストの前提条件(`runWithWave`のデフォルト盤面)に合わせること。既存テストが`gebo`を使っているならそのまま使えるはずだが、`npm test`で実際に確認すること。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- engine.test.ts -t "forceActivatedTarget"`
Expected: FAIL(`forceActivatedTarget`が`undefined`のまま、5件のうち成功する2件(0件ケースの`toBeUndefined()`)以外は失敗)

- [ ] **Step 3: `applyRiteForceActivate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRiteForceActivate`関数(220-226行目):

```ts
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

を以下に置き換える:

```ts
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'rite', id: target } }
}
```

- [ ] **Step 4: `applyRevelationOracleForceActivate`を修正**

`src/lib/game/shidasu/sabotageEffects.ts`の`applyRevelationOracleForceActivate`関数(262-281行目):

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
    return { wave: { ...used.wave!, activeSeal: null }, run: used }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used }
}
```

を以下に置き換える:

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

- [ ] **Step 5: `triggerSabotage`が`forceActivatedTarget`を`lastSabotage`へ含めるよう修正**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数内、`lastSabotage`の組み立て部分(1153行目):

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget },
```

を以下に置き換える:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount, confiscatedTarget: result.confiscatedTarget, forceActivatedTarget: result.forceActivatedTarget },
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npm test -- engine.test.ts -t "forceActivatedTarget"`
Expected: PASS(5件すべて)

- [ ] **Step 7: 型チェックとフルテストを実行**

Run: `npm run check`
Run: `npm test -- engine.test.ts`
Expected: どちらもエラーなし

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 強制発動系2種の効果関数がforceActivatedTargetを返すようにする"
```

---

### Task 3: PlayArea.svelteにpressPulseTarget状態と検知ロジックを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`startConfiscateFadeAnimation`関数の直後、状態・関数追加)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`anyAnimationActive`は変更しない、下記注意参照)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(`$effect.pre`、`lastSabotage`検知ブロック)
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(props定義、`onPressPulseChange`追加)
- Modify: `src/routes/game/shidasu/sabotageAnimations.css`(新規keyframes追加)

**重要な設計上の注意:** グループA(`sealFlashActive`)・グループB(`confiscateFadingActive`)は演出中`anyAnimationActive`に含めて他の操作をブロックしていたが、今回の`pressPulseActive`は**`anyAnimationActive`に含めない**(design doc「D. 操作ブロックの扱い」参照)。理由: 通常クリックで秘儀・天啓・神託を発動する場合、効果自体は同期的に即座へ適用されるため、パルス演出(装飾)の完了を待ってから次の操作を許可する必要が無い。

- [ ] **Step 1: `sabotageAnimations.css`に自動プレス+パルスのkeyframesを追加**

`src/routes/game/shidasu/sabotageAnimations.css`の末尾に以下を追記する(既存の`shidasu-seal-flash`・`shidasu-confiscate-fade`定義は変更しない):

```css

/* 妨害行動「強制発動系」発動時、および秘儀・天啓・神託の通常クリック発動時に共通適用する演出。
   対象ボタンが自動でクリックされたように、一瞬縮んでから戻り強く光る。 */
@keyframes shidasu-press-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(217, 70, 239, 0); }
  30% { transform: scale(0.85); box-shadow: 0 0 24px rgba(217, 70, 239, 0.9); }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(217, 70, 239, 0); }
}

.shidasu-press-pulse {
  animation: shidasu-press-pulse 0.5s ease-out;
}
```

- [ ] **Step 2: `PressPulseTarget`型・状態・トリガー関数を追加**

`src/routes/game/shidasu/PlayArea.svelte`の`startConfiscateFadeAnimation`関数の直後(`startStockShuffleAnimation`関数の直前)を探す:

```bash
grep -n "function startConfiscateFadeAnimation\|function startStockShuffleAnimation" src/routes/game/shidasu/PlayArea.svelte
```

以下を追加する:

```ts

  // 妨害行動「強制発動系」(riteForceActivate・revelationOracleForceActivate)発動時、および
  // 秘儀・天啓・神託の通常クリック発動時に共通適用する自動プレス+パルス演出用。
  // lastSabotage.forceActivatedTargetと同じ型をそのまま再利用する。+page.svelte側からも
  // 同じ型をimportして使うため、exportする。
  export type PressPulseTarget = Exclude<WaveState['lastSabotage'], undefined>['forceActivatedTarget']

  let pressPulseTarget = $state<PressPulseTarget | null>(null)
  let pressPulseActive = $state(false)

  // pressPulseActiveは関数の先頭で同期的にtrueへ切り替える(CLAUDE.mdの「移動アニメーション
  // 実装時の注意」・sealFlashActive/confiscateFadingActiveと同じ原則)。ただしこのstate自体は
  // anyAnimationActiveには含めない(通常クリック発動は効果が同期的に即座へ適用されるため、
  // パルス演出=装飾の完了を待ってから次の操作を許可する必要が無い)。
  function startPressPulseAnimation(target: NonNullable<PressPulseTarget>) {
    pressPulseActive = true
    pressPulseTarget = target
    onPressPulseChange?.(target)
    const timer = setTimeout(() => {
      pressPulseActive = false
      pressPulseTarget = null
      onPressPulseChange?.(null)
    }, 500)
    dealTimers.push(timer)
  }
```

**注意:** `anyAnimationActive`の`$derived`定義には`pressPulseActive`を追加しない(design doc記載の意図的な設計判断)。

- [ ] **Step 3: `$effect.pre`で強制発動系2種の発動を検知する**

既存の`lastSabotage`検知ブロックを探す:

```bash
grep -n "let previousSabotageSeq" src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループB実装後の状態):

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
    }
  })
```

を以下に置き換える(既存の4つの分岐はそのまま残し、5つ目の`else if`を追加する):

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

- [ ] **Step 4: `onPressPulseChange`コールバックpropsを追加**

props定義の分割代入部分(31-43行目)の`onConfiscateFadingChange,`の行:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange,
    onScorePartHighlight,
```

を以下に置き換える:

```ts
    onScoreRevealDone, waveKey, onCleanupDone, onSealFlashChange, onConfiscateFadingChange, onPressPulseChange,
    onScorePartHighlight,
```

型定義部分の`onConfiscateFadingChange?: (target: ConfiscatedTarget | null) => void`の行(71行目)の直後に追加する:

```ts
    onPressPulseChange?: (target: PressPulseTarget | null) => void
```

- [ ] **Step 5: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte src/routes/game/shidasu/sabotageAnimations.css
git commit -m "feat: PlayAreaに強制発動系妨害行動のパルス演出状態と検知ロジックを追加する"
```

---

### Task 4: 秘儀・天啓ボタンにパルス演出を適用する(通常クリック+強制発動の両方)

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`(秘儀ボタンブロック、天啓ボタンブロック)

- [ ] **Step 1: 秘儀ボタンの`onclick`をパルス演出付きに変更**

秘儀ボタンブロックの現在の内容を確認する:

```bash
grep -n "{#if rites.length > 0" -A 18 src/routes/game/shidasu/PlayArea.svelte
```

現在の内容(グループB実装後の状態):

```svelte
{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite')}
  {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
  {@const displayedRites = withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0)}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each displayedRites as riteId, i (i)}
      {@const fading = riteFading !== undefined && i === riteFading.idx}
      {@const usable = !fading && canUseRite(params, wave, riteId) && !anyAnimationActive && !disableRites}
      {@const flashing = sealFlashTarget?.kind === 'rite' && sealFlashTarget.id === riteId}
      <button
        type="button"
        onclick={() => onUseRite?.(riteId)}
        disabled={!usable}
        title={riteDesc(riteId, params)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl font-black transition-transform active:scale-95 {fading ? 'shidasu-confiscate-fade' : ''} {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 hover:bg-fuchsia-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.rites[riteId].name}</button>
    {/each}
  </div>
{/if}
```

を以下に置き換える(`{@const pulsing}`の追加、`onclick`のラップ、クラスに`shidasu-press-pulse`を追加):

```svelte
{#if rites.length > 0 || (confiscateFadingTarget?.kind === 'rite')}
  {@const riteFading = confiscateFadingTarget?.kind === 'rite' ? confiscateFadingTarget : undefined}
  {@const displayedRites = withFadingId(rites, riteFading?.id, riteFading?.idx ?? 0)}
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

- [ ] **Step 2: 天啓ボタンの`onclick`をパルス演出付きに変更**

天啓ボタンブロックの現在の内容を確認する:

```bash
grep -n "{#if revelations.length > 0" -A 12 src/routes/game/shidasu/PlayArea.svelte
```

現在の内容:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
      {@const flashing = sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'revelation' && sealFlashTarget.ref.id === revelationId}
      <button
        type="button"
        onclick={() => onUseRevelationClick?.(revelationId)}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

を以下に置き換える:

```svelte
{#if revelations.length > 0}
  <div class="px-4 pb-4 flex items-center gap-2">
    {#each revelations as revelationId, i (i)}
      {@const usable = canUseRevelation(params, wave, revelationId, relics) && !anyAnimationActive}
      {@const flashing = sealFlashTarget?.kind === 'revelationOrOracle' && sealFlashTarget.ref.kind === 'revelation' && sealFlashTarget.ref.id === revelationId}
      {@const pulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'revelation' && pressPulseTarget.ref.id === revelationId}
      <button
        type="button"
        onclick={() => { startPressPulseAnimation({ kind: 'revelationOrOracle', ref: { kind: 'revelation', id: revelationId } }); onUseRevelationClick?.(revelationId) }}
        disabled={!usable}
        title={revelationDesc(revelationId, params)}
        class="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black transition-transform active:scale-95 {flashing ? 'shidasu-seal-flash' : ''} {pulsing ? 'shidasu-press-pulse' : ''} {usable ? 'bg-indigo-900 border-indigo-500 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'}"
      >{params.revelations[revelationId].name}</button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 3: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 秘儀・天啓ボタンに強制発動・通常発動共通のパルス演出を適用する"
```

---

### Task 5: +page.svelteで神託「使」ボタンにパルス演出を適用する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`(import、状態宣言、`handleUseOracle`、`itemBadges`スニペット、`<PlayArea>`呼び出し)

- [ ] **Step 1: `PressPulseTarget`型のimportと`pressPulseTarget`用の`$state`を追加**

`src/routes/game/shidasu/+page.svelte`の35行目:

```ts
  import type { SealFlashTarget, ConfiscatedTarget } from './PlayArea.svelte'
```

を以下に置き換える:

```ts
  import type { SealFlashTarget, ConfiscatedTarget, PressPulseTarget } from './PlayArea.svelte'
```

`let confiscateFadingTarget = $state<ConfiscatedTarget | null>(null)`の行を探す:

```bash
grep -n "let confiscateFadingTarget = \$state" src/routes/game/shidasu/+page.svelte
```

その行の直後に追加する:

```ts

  // PlayArea側で発動検知したpressPulseTarget(強制発動系妨害行動・秘儀/天啓の通常クリック発動に
  // 共通のパルス演出対象)を受け取って保持する。神託「使」ボタンはPlayAreaの外側にあるため、
  // コールバックprops経由で値を受け渡す。神託の通常クリック発動時は、+page.svelte側で
  // 直接このstateを更新する(handleUseOracle参照)。
  let pressPulseTarget = $state<PressPulseTarget | null>(null)
```

- [ ] **Step 2: `handleUseOracle`にパルス演出を追加**

`src/routes/game/shidasu/+page.svelte`の`handleUseOracle`関数:

```ts
  function handleUseOracle(roleName: RoleName) {
    run = useOracle(params, run, roleName)
  }
```

を以下に置き換える:

```ts
  function handleUseOracle(roleName: RoleName) {
    pressPulseTarget = { kind: 'revelationOrOracle', ref: { kind: 'oracle', id: roleName } }
    setTimeout(() => { pressPulseTarget = null }, 500)
    run = useOracle(params, run, roleName)
  }
```

**注意:** `PlayArea.svelte`側の`startPressPulseAnimation`と異なり、`dealTimers`(`PlayArea.svelte`内のタイマー管理配列)は`+page.svelte`側からアクセスできないため、通常の`setTimeout`をそのまま使う(このタイマーは`+page.svelte`のコンポーネントライフサイクル中は問題なく動作し、既存の`+page.svelte`内の他の一時的な`setTimeout`利用パターンとも整合する)。

- [ ] **Step 3: `<PlayArea>`呼び出しに`onPressPulseChange`を渡す**

本編用`<PlayArea>`呼び出し(`onConfiscateFadingChange={(target) => { confiscateFadingTarget = target }}`を含む行、現在721行目)の直後に追加する:

```svelte
    onPressPulseChange={(target) => { pressPulseTarget = target }}
```

**注意:** 天啓プレビュー用の`<PlayArea>`呼び出し(`disableRites={true}`を渡している方)には追加不要。強制発動系妨害行動は`playing`フェーズ中のみ発動し、天啓プレビュー中には発動しないため(グループA・Bと同じ判断)。

- [ ] **Step 4: `itemBadges`スニペットの神託バッジに`pulsing`判定を追加**

`itemBadges`スニペット内の神託バッジ部分の現在の内容:

```bash
grep -n "{#if run.oracles.length > 0" -A 14 src/routes/game/shidasu/+page.svelte
```

現在の内容(グループB実装後の状態):

```svelte
{#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle'}
  {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
  {@const oracleFading = revelationOrOracleFading?.ref.kind === 'oracle' ? { idx: revelationOrOracleFading.idx, id: revelationOrOracleFading.ref.id } : undefined}
  {@const displayedOracles = withFadingId(run.oracles, oracleFading?.id, oracleFading?.idx ?? 0)}
  <div class="flex flex-wrap gap-1 justify-end">
    {#each displayedOracles as roleName, i (i)}
      {@const fading = oracleFading !== undefined && i === oracleFading.idx}
      <span class="text-xs bg-purple-900 text-purple-200/90 border border-purple-600/40 rounded px-1.5 py-0.5 flex items-center gap-1 {fading ? 'shidasu-confiscate-fade' : ''}" title={oracleDesc(roleName, params)}>
        {oracleName(roleName, params)}
        <button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline">使</button>
        <button onclick={() => handleSellOracle(roleName)} class="text-purple-300/70 underline">売</button>
      </span>
    {/each}
  </div>
{/if}
```

を以下に置き換える(「使」ボタンに`pulsing`判定とクラス適用を追加。「売」ボタンには適用しない、design docのスコープ外事項の通り):

```svelte
{#if run.oracles.length > 0 || confiscateFadingTarget?.kind === 'revelationOrOracle' && confiscateFadingTarget.ref.kind === 'oracle'}
  {@const revelationOrOracleFading = confiscateFadingTarget?.kind === 'revelationOrOracle' ? confiscateFadingTarget : undefined}
  {@const oracleFading = revelationOrOracleFading?.ref.kind === 'oracle' ? { idx: revelationOrOracleFading.idx, id: revelationOrOracleFading.ref.id } : undefined}
  {@const displayedOracles = withFadingId(run.oracles, oracleFading?.id, oracleFading?.idx ?? 0)}
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

- [ ] **Step 5: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 神託の使ボタンに強制発動・通常発動共通のパルス演出を適用する"
```

---

### Task 6: 実プレイ画面での動作確認

**Files:** なし(コード変更を伴わない確認タスク)

デバッグ画面(`/admin/shidasu-debug`)は`PlayArea`に`rites`/`revelations`propsを渡しておらず、秘儀・天啓ボタン自体が表示されない(グループB実装時に確認済みの制約)。神託「使」ボタンもデバッグ画面には神託所持手段が無く表示されない。そのため今回は実プレイ画面(`/game/shidasu`)で確認する。

- [ ] **Step 1: 開発サーバーを起動**

Run: `npm run dev`

- [ ] **Step 2: `/game/shidasu`で通常クリック発動時のパルス演出を目視確認する**

ブラウザで`http://localhost:5173/game/shidasu`を開き、ゲームを開始して以下を確認する(Playwrightのadhocスクリプトを使う場合は`.superpowers/`配下に作成し、確認後に削除する):

- ショップ等で秘儀を入手し、秘儀ボタンを通常クリックする。ボタンが縮んでから戻り強く光る(自動プレス+パルス)演出が発生することを確認する
- 天啓を入手し、天啓ボタンを通常クリックして同様の演出を確認する
- 神託を入手し、神託バッジの「使」ボタンを通常クリックして同様の演出を確認する
- パルス演出中も、山札を引く・カードをプレイするなど他の操作が正常にできる(ブロックされない)ことを確認する
- 秘儀・天啓の実際の効果(所持数減少・盤面反映)が、演出とは独立して正しく発生していることを確認する

- [ ] **Step 3: `forceActivatedTarget`のエンジンテストが正しく動作することの再確認**

強制発動系(`riteForceActivate`・`revelationOracleForceActivate`)は星の妨害行動設定経由でないと実プレイ中に自然発生させにくいため、目視確認の代わりにTask 2で追加したエンジンレベルのテストで正確性を担保する。改めて実行して確認する:

Run: `npm test -- engine.test.ts -t "forceActivatedTarget"`
Expected: PASS(5件すべて)

- [ ] **Step 4: 型チェック・ビルド・既存テストの最終確認**

Run: `npm run check`
Run: `npm run build`
Run: `npm test -- engine.test.ts`
Expected: いずれもエラーなし
