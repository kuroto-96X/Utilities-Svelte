# 山札シャッフル演出(揺れアニメーション) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 妨害行動「山札攪拌」(`stockShuffle`)・秘儀「ᛞ」(`dagaz`)発動時、山札ボタンが短く左右に揺れる演出を実装する。

**Architecture:** `WaveState`に`lastStockShuffle?: { seq: number }`を追加し、`triggerSabotage`(stockShuffle時のみ)・`useRite`(dagaz時のみ)がこれを更新する。`PlayArea.svelte`は既存の`lastSabotage`検知と同じ`$effect.pre`パターンで`seq`変化を検知し、山札ボタンの`transform: rotate(...)`をJS駆動で短時間書き換える揺れ演出を起動する。データ(枚数・faceUp)には一切影響しない、純粋な演出。

**Tech Stack:** SvelteKit, Svelte 5 runes (`$state`, `$effect.pre`), TypeScript, Vitest

参照設計: `docs/superpowers/specs/2026-08-20-shidasu-stock-shuffle-animation-design.md`

---

### Task 1: `WaveState.lastStockShuffle`型の追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts:295-312`(`lastSabotage`フィールド定義の直後)

- [ ] **Step 1: 型定義を追加**

`src/lib/game/shidasu/types.ts`の`lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number }`の行の直後に以下を追加する:

```ts
  // 山札シャッフル演出(揺れアニメーション)のトリガー用。stockShuffle(妨害行動)・
  // dagaz(秘儀)発動時にseqをインクリメントする。PlayArea.svelteがseqの変化を検知して
  // 山札ボタンの揺れ演出を起動する。undefinedは「まだ一度も発動していない」状態。
  lastStockShuffle?: { seq: number }
```

- [ ] **Step 2: 型チェックを実行**

Run: `npm run check`
Expected: エラーなし(既存コードは`lastStockShuffle`を参照していないため、追加のみでは何も壊れない)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: WaveStateにlastStockShuffleフィールドを追加する"
```

---

### Task 2: `triggerSabotage`/`useRite`でlastStockShuffleを更新する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:1047-1057`(`useRite`)
- Modify: `src/lib/game/shidasu/engine.ts:1134-1153`(`triggerSabotage`)
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`には`describe('triggerSabotage', ...)`ブロック(4892行目〜)があり、その内部にローカルヘルパー`runWithWave(overrides?, waveOverrides?): RunState`(4893-4897行目)が定義されている。このヘルパーは`RunState`(`wave`込み)を直接返す。新規テストはこの`describe('triggerSabotage', ...)`ブロックの中、最後の`it(...)`の直後(閉じ`})`の直前)に追記し、`runWithWave`をそのまま再利用する:

```ts
  it('triggerSabotage: stockShuffle発動時にlastStockShuffle.seqが1から始まりインクリメントされる', () => {
    const run = runWithWave()
    const next1 = triggerSabotage(DEFAULT_PARAMS, run, 'stockShuffle', () => 0)
    expect(next1.wave!.lastStockShuffle).toEqual({ seq: 1 })
    const next2 = triggerSabotage(DEFAULT_PARAMS, next1, 'stockShuffle', () => 0)
    expect(next2.wave!.lastStockShuffle).toEqual({ seq: 2 })
  })

  it('triggerSabotage: stockShuffle以外の妨害行動発動時はlastStockShuffleの値を維持する', () => {
    const run = runWithWave()
    const afterShuffle = triggerSabotage(DEFAULT_PARAMS, run, 'stockShuffle', () => 0)
    expect(afterShuffle.wave!.lastStockShuffle).toEqual({ seq: 1 })
    const afterOther = triggerSabotage(DEFAULT_PARAMS, afterShuffle, 'comboBreather', () => 0)
    expect(afterOther.wave!.lastStockShuffle).toEqual({ seq: 1 })
  })

  it('useRite: dagaz使用時にlastStockShuffle.seqが1から始まりインクリメントされる', () => {
    const run: RunState = { ...runWithWave(), rites: ['dagaz'] }
    const next = useRite(DEFAULT_PARAMS, run, 'dagaz', () => 0)
    expect(next.wave!.lastStockShuffle).toEqual({ seq: 1 })
  })

  it('useRite: dagaz以外の秘儀使用時はlastStockShuffleの値を維持する', () => {
    const run: RunState = { ...runWithWave(), rites: ['dagaz', 'jera'] }
    const afterDagaz = useRite(DEFAULT_PARAMS, run, 'dagaz', () => 0)
    expect(afterDagaz.wave!.lastStockShuffle).toEqual({ seq: 1 })
    const afterJera = useRite(DEFAULT_PARAMS, afterDagaz, 'jera', () => 0)
    expect(afterJera.wave!.lastStockShuffle).toEqual({ seq: 1 })
  })
```

`useRite`のテストで`runWithWave()`が返す`RunState`をそのまま使っているのは、既存の`runWithWave`が`phase: 'playing'`かつ`wave.status`が`'playing'`のwaveを組み立てるため(`useRite`の先頭ガード`run.phase !== 'playing' ... || run.wave.status !== 'playing'`を満たす必要がある)。`useRite`・`RunState`がファイル冒頭で未importの場合は追加すること(`triggerSabotage`は同ファイル内で既に使われているためimport済みのはず)。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- engine.test.ts -t "lastStockShuffle"`
Expected: FAIL(`lastStockShuffle`が`undefined`のまま、4件とも失敗)

- [ ] **Step 3: `triggerSabotage`を修正**

`src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数(1134行目〜)の戻り値部分:

```ts
  return {
    ...nextRun,
    wave: {
      ...nextWave,
      pendingSabotageId: rolled.pendingSabotageId,
      sabotageTurnsRemaining: rolled.sabotageTurnsRemaining,
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount },
    },
  }
}
```

を以下に置き換える:

```ts
  return {
    ...nextRun,
    wave: {
      ...nextWave,
      pendingSabotageId: rolled.pendingSabotageId,
      sabotageTurnsRemaining: rolled.sabotageTurnsRemaining,
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount },
      lastStockShuffle: id === 'stockShuffle' ? { seq: (wave.lastStockShuffle?.seq ?? 0) + 1 } : wave.lastStockShuffle,
    },
  }
}
```

- [ ] **Step 4: `useRite`を修正**

`src/lib/game/shidasu/engine.ts`の`useRite`関数(1047行目〜):

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}
```

を以下に置き換える:

```ts
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

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm test -- engine.test.ts -t "lastStockShuffle"`
Expected: PASS(4件すべて)

- [ ] **Step 6: 型チェックとフルテストを実行**

Run: `npm run check`
Run: `npm test -- engine.test.ts`
Expected: どちらもエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: stockShuffle/dagaz発動時にlastStockShuffleを更新する"
```

---

### Task 3: PlayArea.svelteに揺れアニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:352`(状態宣言ブロック、`discardPurgeActive`宣言の直後)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:362`(`anyAnimationActive`)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:412-422`(`$effect.pre`、`lastSabotage`検知ブロック)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:1241`(山札ボタンの`style`属性)

- [ ] **Step 1: 揺れ演出用の状態とトリガー関数を追加**

`src/routes/game/shidasu/PlayArea.svelte`の352行目、`let discardPurgeActive = $state(false)`の直後に以下を追加する:

```ts

  // 山札シャッフル演出(揺れアニメーション)用の状態。stockShuffle/dagaz発動時、
  // 山札ボタンを短時間rotateさせるだけの装飾的な演出であり、データ(枚数・faceUp)
  // には一切影響しない。stockShuffleActiveは関数先頭で同期的にtrueへ切り替えることで、
  // 演出中は他の操作(山札引き・秘儀/天啓使用等)をanyAnimationActive経由でブロックする。
  let stockShuffleRotation = $state(0)
  let stockShuffleTransitionMs = $state(0)
  let stockShuffleActive = $state(false)

  function startStockShuffleAnimation() {
    stockShuffleActive = true
    const steps = [-8, 8, -5, 5, 0]
    steps.forEach((deg, i) => {
      const timer = setTimeout(() => {
        stockShuffleRotation = deg
        stockShuffleTransitionMs = 60
        if (i === steps.length - 1) {
          const doneTimer = setTimeout(() => {
            stockShuffleActive = false
          }, 60)
          dealTimers.push(doneTimer)
        }
      }, i * 60)
      dealTimers.push(timer)
    })
  }
```

`stockShuffleActive`は関数の一番先頭、`setTimeout`の外で同期的に`true`にしている点が重要(CLAUDE.mdの「移動アニメーション実装時の注意」・`discardPurgeActive`と同じ原則)。ただしこの演出は移動先UIが新しいデータを先出しする類のバグを起こさない(同じ要素を回転させるだけで、表示内容は変化しない)ため、リスクは低い。念のため既存の同期ガード原則を踏襲する。

- [ ] **Step 2: `anyAnimationActive`に`stockShuffleActive`を含める**

362行目の`anyAnimationActive`定義:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeActive || stockShuffleActive)
```

- [ ] **Step 3: `$effect.pre`でlastStockShuffleの変化を検知する**

412-422行目の既存ブロック:

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
    }
  })
```

の直後(423行目、既存の捨て札追従コメント`// chainResetAnimationが実行されていない間は、...`の直前)に、以下を新規追加する(既存ブロックの中身は変更しない):

```ts

  // 山札シャッフル演出(stockShuffle/dagaz)のトリガー検知。lastSabotageとは別の
  // 発動経路(useRite)からも更新されるため、専用のseq追跡変数で検知する。
  let previousStockShuffleSeq = wave.lastStockShuffle?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastStockShuffle
    if (!current || current.seq === previousStockShuffleSeq) return
    previousStockShuffleSeq = current.seq
    startStockShuffleAnimation()
  })
```

- [ ] **Step 4: 山札ボタンのstyleに揺れ演出を反映する**

1241行目の山札ボタンの`style`属性:

```svelte
      style="aspect-ratio: 2 / 3; {wave.stock.length > 0 ? CARD_BACK_STYLE : ''}"
```

を以下に置き換える:

```svelte
      style="aspect-ratio: 2 / 3; transform: rotate({stockShuffleRotation}deg); transition-duration:{stockShuffleTransitionMs}ms; {wave.stock.length > 0 ? CARD_BACK_STYLE : ''}"
```

- [ ] **Step 5: 型チェックとビルドを実行**

Run: `npm run check`
Run: `npm run build`
Expected: どちらもエラーなし

- [ ] **Step 6: 開発サーバーで目視確認**

Run: `npm run dev`

`http://localhost:5173/admin/shidasu-debug`を開き、以下を確認する:

- 妨害行動パネルから「山札攪拌」を発動し、山札ボタンが短く左右に揺れることを確認する
- 秘儀パネルから「ᛞ」(dagaz、捨て札にカードがある状態で)を使用し、同様に山札ボタンが揺れることを確認する
- 演出中(約300ms)は山札を引く操作や他の秘儀/天啓使用ボタンが無効化され、完了後は正常に操作できることを確認する
- 演出前後で山札の枚数表示・見た目(裏面デザイン)自体は変化しないことを確認する

- [ ] **Step 7: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 山札攪拌・ᛞ発動時に山札ボタンが揺れる演出を実装する"
```
