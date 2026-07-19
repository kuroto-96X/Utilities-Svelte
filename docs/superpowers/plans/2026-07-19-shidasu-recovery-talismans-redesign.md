# Shidasu 復活系護符(再生・治癒・不屈)再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 再生・治癒・不屈の3護符の発動タイミング・条件を再設計し、「コンボリセット」を護符に依存しない共通処理として実装、目標スコア判定をスコア変動のたびに即時化する。

**Architecture:** `resetComboFields`(コンボ単位でリセットされる全フィールドの初期化)と`resolveHealingRestoration`(治癒の列復活ロジック)という2つの共通ヘルパーをengine.tsに新設し、通常のコンボリセット(`drawStock`)・全消し(`playCard`)・手詰まり(`applyStuckCheck`)の3箇所すべてから呼び出す。全消し・手詰まり後の「山札を捲る」は既存の`drawStock`をそのまま呼び出すことで実現し、これに伴い`playCard`・`applyStuckCheck`のシグネチャに`deckComposition`の受け渡しを追加する。

**Tech Stack:** TypeScript, Vitest

**この計画の性質について:** これは挙動を変更する機能追加であり、既存の「治癒・再生・不屈」関連テストの多くは新仕様に合わせて**置き換え**が必要になる(移動のみのリファクタリングとは異なる)。各タスクの末尾で`npm run test`・`npm run check`を実行し、影響範囲外のテストが壊れていないことを確認すること。

---

## 事前準備: 対象ファイルの現状

- `src/lib/game/shidasu/types.ts`: `WaveState`インターフェース(このplan作成時点で`mercyActiveNextCombo: boolean`が最後のフィールド)
- `src/lib/game/shidasu/engine.ts`: 814行。`playCard`(140行目〜)・`drawStock`(431行目〜)・`applyStuckCheck`/`tryResilienceRevive`(776行目〜)が対象
- `src/lib/game/shidasu/engine.test.ts`: `makeWave`フィクスチャ(52行目〜)、`describe('playCard', ...)`内の治癒・再生関連テスト(614〜761行目)、`describe('applyStuckCheck (不屈の護符)', ...)`(1720〜1773行目)が対象
- `src/routes/admin/shidasu-debug/+page.svelte`: `playCard`・`drawStock`を直接呼び出している

**重要:** 各タスクは直前のタスクの結果を前提に行番号がずれるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。

---

### Task 1: `WaveState`拡張とテストフィクスチャ更新

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `WaveState`に3フィールドを追加する**

`types.ts`の`WaveState`インターフェース末尾(`mercyActiveNextCombo: boolean`の直後)に以下を追加する:

```ts
  // 治癒用: 現在のコンボ中に列一掃を達成した列のインデックスと、その列のコンボ開始時点の枚数
  sweptColumnsThisCombo: { colIndex: number; startLength: number }[]
  // 再生用: ウェーブ中に再生が既に発動したか(ウェーブ中1回のみ)
  regenerationUsedThisWave: boolean
  // 不屈用: ウェーブ中に不屈が既に発動したか(ウェーブ中1回のみ)
  resilienceUsedThisWave: boolean
```

- [ ] **Step 2: `startWave`で初期化する**

`engine.ts`の`startWave`関数内、`wave`オブジェクトリテラルの`mercyActiveNextCombo: false,`の直後に以下を追加する:

```ts
    sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false,
    resilienceUsedThisWave: false,
```

- [ ] **Step 3: テストフィクスチャ`makeWave`を更新する**

`engine.test.ts`の`makeWave`関数内、`mercyActiveNextCombo: false,`の直後(`...overrides,`の手前)に以下を追加する:

```ts
    sweptColumnsThisCombo: [],
    regenerationUsedThisWave: false,
    resilienceUsedThisWave: false,
```

- [ ] **Step 4: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功(挙動変更はまだ無いため既存テストはすべてそのまま通る)。

- [ ] **Step 5: コミット**

現在のブランチは`feat`です。プロジェクトのCLAUDE.md規約により、`feat`ブランチではユーザーへの確認なしでコミットしてよい規約になっています。コミットメッセージは日本語で書いてください。

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 復活系護符再設計用にWaveStateへsweptColumnsThisCombo等を追加"
```

---

### Task 2: 共通ヘルパー実装 + 治癒・再生の全面書き換え + `playCard`シグネチャ変更

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**この関数の役割:**
- `resetComboFields(wave, params, items, newFoundation?, newOrigin?)`: コンボ単位でリセットされる全フィールドを初期化した新しい`WaveState`を返す(治癒・再生・不屈の解決は含まない)。`newFoundation`/`newOrigin`を省略した場合は`foundation`を変更せず、`chain`は`[wave.foundation]`・`chainOrigin`は現在の末尾要素を1件だけ残す(全消し・手詰まり時に使う)。通常のドロー起因リセット時は新しく引いたカードとその起源(`'draw'`)を明示的に渡す
- `resolveHealingRestoration(resetWave, sweptColumns, rand)`: `resetComboFields`適用後の`WaveState`(discardPileにチェーンの札が加わった後)と、リセット直前の`sweptColumnsThisCombo`を受け取り、列一掃した列を先頭から順に(捨て札を1回シャッフルしたプールから)コンボ開始時枚数を上限に復活させる

- [ ] **Step 1: `sweptColumnsThisCombo`の追跡を`playCard`に追加する**

`engine.ts`の`playCard`内、以下の行:

```ts
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  const roleFired = [...chainResult.roleFired]
```

の直後に、以下を追加する:

```ts
  const newSweptColumnsThisCombo = sweepQualifies
    ? [...wave.sweptColumnsThisCombo, { colIndex, startLength: streakStartLength }]
    : wave.sweptColumnsThisCombo
```

- [ ] **Step 2: 共通ヘルパー2つを`playCard`の直前に追加する**

`engine.ts`の`export function playCard(...)`の直前に、以下の2関数を追加する:

```ts
// コンボリセット時に共通で初期化するフィールドをまとめて返す(治癒・再生・不屈の解決は含まない)。
// newFoundation/newOriginを省略した場合はfoundationを変更せず、chainは[wave.foundation]・
// chainOriginは現在の末尾要素のみを残す(全消し・手詰まり時に使う。まだ新しいカードを引いていないため)。
// 通常のdrawStockリセットでは、新しく引いたカードとその起源('draw')を明示的に渡す。
function resetComboFields(
  wave: WaveState,
  params: ShidasuParams,
  items: ItemId[],
  newFoundation: Card = wave.foundation,
  newOrigin: ChainCardOrigin = wave.chainOrigin[wave.chainOrigin.length - 1]
): WaveState {
  return {
    ...wave,
    foundation: newFoundation,
    combo: items.includes('sanctify') ? wave.baseComboCount : 0,
    chain: [newFoundation],
    chainOrigin: [newOrigin],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    discardPile: [...wave.discardPile, ...wave.chain],
    drawContinueCountThisChain: 0,
    flushActiveThisCombo: false,
    sameColumnStreak: 0,
    lastPlayedColumn: null,
    benevolenceUsedThisCombo: false,
    roleEchoUsedThisCombo: {},
    sameRankEchoUsedThisCombo: [],
    pendingRoleEcho: null,
    mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
    sweptColumnsThisCombo: [],
    roleFiredThisChain: false,
  }
}

// 治癒: コンボリセット直前に列一掃していた列を、コンボ開始時点の枚数を上限に捨て札から復活させる。
// resetWaveはresetComboFields適用後(discardPileにチェーンの札が加わった後)の状態を渡すこと。
// sweptColumnsはリセット直前(resetComboFields呼び出し前)のwave.sweptColumnsThisComboを渡す。
// 捨て札は1回だけシャッフルし、列一掃した順(sweptColumnsの並び順)に在庫が尽きるまで割り振る。
function resolveHealingRestoration(
  resetWave: WaveState,
  sweptColumns: { colIndex: number; startLength: number }[],
  rand: () => number
): WaveState {
  if (sweptColumns.length === 0 || resetWave.discardPile.length === 0) return resetWave

  const pool = [...resetWave.discardPile]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = resetWave.tableau.map(col => [...col])
  const comboStreakColumnLengths = [...resetWave.comboStreakColumnLengths]

  for (const { colIndex, startLength } of sweptColumns) {
    if (tableau[colIndex].length !== 0) continue
    const available = pool.length - cursor
    if (available <= 0) break
    const take = Math.min(startLength, available)
    tableau[colIndex] = pool.slice(cursor, cursor + take)
    comboStreakColumnLengths[colIndex] = take
    cursor += take
  }

  return {
    ...resetWave,
    tableau,
    discardPile: pool.slice(cursor),
    comboStreakColumnLengths,
  }
}
```

`ChainCardOrigin`型を`engine.ts`冒頭のimportに追加する必要がある。現在の`import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'`を以下に変更する:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin } from './types'
```

- [ ] **Step 3: `drawStock`の通常リセット分岐を共通ヘルパー経由に書き換える**

`drawStock`内、以下の既存コード(`hasPlayableColumns`計算以降、関数末尾の`return`まで)を丸ごと置き換える。

置き換え前(削除対象):
```ts
  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained: wave.score,
  }
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
  if (resetResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: resetDirectGain, parts: resetResult.parts })
  }

  return {
    wave: {
      ...wave,
      stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
      foundation: card,
      combo: items.includes('sanctify') ? wave.baseComboCount : 0,
      chain: [card],
      chainOrigin: ['draw'],
      linked: false,
      columnsEmptiedThisCombo: 0,
      comboStreakColumnLengths: wave.tableau.map(col => col.length),
      lastDrawEffect: null,
      lastGain: null,
      discardPile: [...wave.discardPile, ...wave.chain],
      score: scoreAfterStockEmpty + resetDirectGain,
      roleFiredThisChain: false,
      drawContinueCountThisChain: 0,
      flushActiveThisCombo: false,
      sameColumnStreak: 0,
      lastPlayedColumn: null,
      benevolenceUsedThisCombo: false,
      roleEchoUsedThisCombo: {},
      sameRankEchoUsedThisCombo: [],
      pendingRoleEcho: null,
      mercyActiveNextCombo: wave.combo <= params.talismans.mercy.c,
      lastBonusGains: resetBonusGains,
    },
    deckComposition: newDeckComposition,
  }
```

置き換え後:
```ts
  const resetCtx: DirectEffectContext = {
    comboBeforeReset: wave.combo,
    hasPlayableColumns,
    roleFiredThisChain: wave.roleFiredThisChain,
    remainingTableauCount: remainingCount(wave.tableau),
    combo: wave.combo,
    colorHeld: false,
    previousCombo: wave.combo,
    scoreAfterGained: wave.score,
  }
  const resetResult = applyDirectEffects('resetDirect', items, resetCtx, params)
  const resetDirectGain = resetResult.value

  const resetBonusGains: BonusGain[] = []
  if (stockEmptyResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: stockEmptyResult.value, parts: stockEmptyResult.parts })
  }
  if (resetResult.parts.length > 0) {
    resetBonusGains.push({ label: '護符による直接加算', points: resetDirectGain, parts: resetResult.parts })
  }

  let resetWave: WaveState = {
    ...resetComboFields(wave, params, items, card, 'draw'),
    stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [card], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
    lastDrawEffect: null,
    lastGain: null,
    score: scoreAfterStockEmpty + resetDirectGain,
    lastBonusGains: resetBonusGains,
  }

  if (items.includes('healing')) {
    resetWave = resolveHealingRestoration(resetWave, wave.sweptColumnsThisCombo, rand)
  }

  return {
    wave: resetWave,
    deckComposition: newDeckComposition,
  }
```

- [ ] **Step 4: `playCard`のシグネチャを変更し、全消し処理を全面書き換える**

`playCard`の関数シグネチャを以下に変更する:

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
```

関数冒頭の3つの早期returnを、それぞれ`{ wave, deckComposition }`を返す形に変更する:

```ts
  if (wave.status !== 'playing') return { wave, deckComposition }
  const col = wave.tableau[colIndex]
  const card = col?.[col.length - 1]
  if (!card) return { wave, deckComposition }
  if (!isPlayable(modifier, wave, card)) return { wave, deckComposition }
```

`next`オブジェクトの直後、`sweptColumnsThisCombo: newSweptColumnsThisCombo`を`next`のプロパティに追加する(既存の`lastBonusGains: bonusGains,`の直後に追加):

```ts
    lastBonusGains: bonusGains,
    sweptColumnsThisCombo: newSweptColumnsThisCombo,
```

関数末尾の全消し判定以降(`if (remainingBeforeRevival === 0) { ... }`と、それに続く目標判定・`return next`)を、以下にまるごと置き換える:

```ts
  if (remainingBeforeRevival === 0) {
    const rawClearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const clearBonusResult = applyItemEffects('clearBonus', rawClearBonus, items, itemEffectCtx, params)
    const clearBonus = Math.floor(clearBonusResult.value)
    const scoreAfterClear = newScore + clearBonus
    const clearBonusGain: BonusGain = {
      label: '全消しボーナス',
      points: clearBonus,
      parts: [
        `基礎+${params.scoring.clearBonus}`,
        `山札残数+${wave.stock.length * params.scoring.clearBonusPerStock}`,
        ...clearBonusResult.parts,
      ],
    }
    const bonusGainsWithClear = [...bonusGains, clearBonusGain]
    const waveAfterClearBonus: WaveState = { ...next, score: scoreAfterClear, lastBonusGains: bonusGainsWithClear }

    if (scoreAfterClear >= target) {
      return { wave: { ...waveAfterClearBonus, status: 'ended', endReason: 'target' }, deckComposition }
    }

    let resetWave = resetComboFields(waveAfterClearBonus, params, items)

    for (const id of items) {
      if (id === 'healing') {
        resetWave = resolveHealingRestoration(resetWave, waveAfterClearBonus.sweptColumnsThisCombo, rand)
      } else if (
        id === 'regeneration' &&
        remainingCount(resetWave.tableau) === 0 &&
        !resetWave.regenerationUsedThisWave &&
        resetWave.stock.length > 0
      ) {
        const cost = Math.floor(resetWave.score * params.talismans.regeneration.p / 100)
        const pool = [...resetWave.discardPile]
        shuffleInPlace(pool, rand)
        const reviveTotal = Math.min(params.layout.cols * rows, pool.length)
        let cursor = 0
        const revivedTableau: Card[][] = []
        for (let c = 0; c < params.layout.cols; c++) {
          const take = Math.min(rows, reviveTotal - cursor)
          revivedTableau.push(take > 0 ? pool.slice(cursor, cursor + take) : [])
          cursor += Math.max(take, 0)
        }
        resetWave = {
          ...resetWave,
          tableau: revivedTableau,
          discardPile: pool.slice(reviveTotal),
          comboStreakColumnLengths: revivedTableau.map(col => col.length),
          score: resetWave.score - cost,
          regenerationUsedThisWave: true,
        }
      }
    }

    if (remainingCount(resetWave.tableau) > 0) {
      if (resetWave.stock.length > 0) {
        return drawStock(params, resetWave, items, deckComposition, modifier, rand)
      }
      return { wave: resetWave, deckComposition }
    }

    return { wave: { ...resetWave, status: 'ended', endReason: 'fullClear' }, deckComposition }
  }

  if (newScore >= target) {
    return { wave: { ...next, status: 'ended', endReason: 'target' }, deckComposition }
  }

  return { wave: next, deckComposition }
```

(`rows`は`playCard`冒頭付近で既に`const rows = params.layout.rows`として定義済みの変数をそのまま使う。新たに定義し直さないこと。)

- [ ] **Step 5: `applyPlayCard`を更新する**

`engine.ts`の`applyPlayCard`関数を以下に置き換える(`withActiveWave`は使わない形にする):

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const stage = params.stages[run.stageIndex]
  const target = stage.targets[run.waveIndex]
  const { wave, deckComposition } = playCard(params, run.wave, stage.modifier, run.items, target, colIndex, run.deckComposition, rand)
  return { ...run, wave, deckComposition }
}
```

- [ ] **Step 6: 既存の治癒・再生関連テストを新仕様に置き換える**

`engine.test.ts`の`describe('playCard', ...)`内、614行目付近の`test('治癒: 列一掃が成立すると捨て札から最大rows枚が空いた列へ戻る', ...)`から761行目付近の`test('治癒・再生の発動条件が重ならない通常の全消し...', ...)`までの一連のテスト(治癒単体・再生単体・治癒と再生の相互作用のテスト、合計10件程度)をすべて削除し、以下のテストに置き換える。

`playCard`の呼び出しはすべてシグネチャ変更に合わせ、`deckComposition`引数(`standardDeckComposition()`)を追加すること。呼び出し結果は`{ wave, deckComposition }`の形になるため、`const next = playCard(...)`ではなく`const { wave: next } = playCard(...)`のように受け取ること。

```ts
  test('治癒: 列一掃した列は、そのコンボが継続している間はまだ復活しない(コンボリセット時に初めて効く)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', ['healing'], 1000000, 0, standardDeckComposition(), createRng(1))
    expect(next.tableau[0]).toHaveLength(0) // まだ復活しない
    expect(next.sweptColumnsThisCombo).toEqual([{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }])
  })

  test('治癒: 通常のコンボリセット(drawStockでパターン不継続)時に、列一掃した列がコンボ開始時の枚数を上限に復活する', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)], // 差5で継続しない
      chain: [card(0, '♠', 5), card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: DEFAULT_PARAMS.layout.rows }],
      discardPile: [],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], standardDeckComposition())
    // discardPileにはコンボリセットでチェーンの2枚が加わってから復活に使われる
    expect(result.wave.tableau[0].length).toBe(Math.min(2, DEFAULT_PARAMS.layout.rows))
    expect(result.wave.sweptColumnsThisCombo).toEqual([])
  })

  test('治癒: コンボ開始時の枚数を上限に復活し、それ以上は復活しない', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1), card(31, '♦', 2), card(32, '♦', 3), card(33, '♦', 4)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, ['healing'], standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(2) // startLength=2が上限
    expect(result.wave.discardPile).toHaveLength(4 + 1 - 2) // 元4枚+チェーン1枚 - 復活2枚
  })

  test('治癒を持っていなければ、コンボリセット時も列は空のまま', () => {
    const afterSweep = makeWave({
      foundation: card(1, '♣', 6),
      tableau: [[], [card(2, '♦', 9)]],
      stock: [card(20, '♠', 1)],
      chain: [card(1, '♣', 6)],
      linked: true,
      sweptColumnsThisCombo: [{ colIndex: 0, startLength: 2 }],
      discardPile: [card(30, '♦', 1)],
    })
    const result = drawStock(DEFAULT_PARAMS, afterSweep, [], standardDeckComposition())
    expect(result.wave.tableau[0]).toHaveLength(0)
  })

  test('再生: 全消し時に山札が残っていれば、スコアp%消費して場札を復活させ、その後山札を1枚捲る', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)], // 差3、継続しない(パターン不成立)想定
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.endReason).toBeNull()
    expect(result.wave.regenerationUsedThisWave).toBe(true)
    // 山札を1枚捲った後なのでstockは0枚(元々1枚だけだった)
    expect(result.wave.stock).toHaveLength(0)
  })

  test('再生: 山札が0枚の全消しでは発動しない(通常の全消し終了になる)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
    expect(result.wave.regenerationUsedThisWave).toBe(false)
  })

  test('再生: 捨て札が無ければ通常通り全消し終了になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('再生: ウェーブ中2回目は発動しない(regenerationUsedThisWaveがtrueなら通常の全消し終了)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1)],
      regenerationUsedThisWave: true,
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('fullClear')
  })

  test('治癒と再生を同時所持し、所持順で治癒が先なら治癒が優先され再生は発動しない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['healing', 'regeneration'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(false) // 治癒が先に場札を埋めたため再生は不発動
  })

  test('治癒と再生を同時所持し、所持順で再生が先なら再生が優先され場札全体が復活する', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(20, '♠', 9)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
      discardPile: [card(10, '♦', 1), card(11, '♦', 2), card(12, '♦', 3)],
    })
    const result = playCard(DEFAULT_PARAMS, wave, 'none', ['regeneration', 'healing'], 100000000, 0, standardDeckComposition(), createRng(1))
    expect(result.wave.status).toBe('playing')
    expect(result.wave.regenerationUsedThisWave).toBe(true)
  })
```

- [ ] **Step 7: `playCard`を直接呼んでいる他のテストに`deckComposition`引数を追加する**

`engine.test.ts`内で`playCard(`を呼んでいる箇所すべてを`grep`で確認し(Step6で置き換えた箇所を除く)、シグネチャ変更(第7引数に`deckComposition`が増えた)に合わせてすべての呼び出しを修正する。呼び出しの戻り値を`const next = playCard(...)`のように直接`WaveState`として使っている箇所はすべて`const { wave: next } = playCard(...)`のように分割代入へ変更する。`deckComposition`の値は`standardDeckComposition()`を使ってよい(`import { standardDeckComposition } from './deck'`が既にファイル冒頭でimportされていることを確認し、なければ追加する)。

- [ ] **Step 8: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功。型エラーなし(`playCard`のシグネチャ変更に伴う呼び出し元の修正漏れがあれば型エラーで検出される)。

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 治癒をコンボリセット時発動に変更し、再生をウェーブ内1回・山札を捲る仕様に再設計"
```

---

### Task 3: `applyStuckCheck`の全面書き換え(不屈の再設計)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `tryResilienceRevive`と`withActiveWave`を削除し、`applyStuckCheck`を書き換える**

`engine.ts`から`tryResilienceRevive`関数全体(コメント含む)を削除する。`withActiveWave`関数はこの時点で他に呼び出し元が無くなるはずなので、`grep`で確認した上で削除する。

`applyStuckCheck`関数を以下に置き換える:

```ts
export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = params.stages[run.stageIndex].modifier
  const wave = run.wave
  if (!isStuck(modifier, wave)) return run

  let resetWave = resetComboFields(wave, params, run.items)

  for (const id of run.items) {
    if (id === 'healing') {
      resetWave = resolveHealingRestoration(resetWave, wave.sweptColumnsThisCombo, rand)
    } else if (id === 'resilience' && resetWave.discardPile.length > 0 && !resetWave.resilienceUsedThisWave) {
      const pool = [...resetWave.discardPile]
      shuffleInPlace(pool, rand)
      const reviveCount = Math.max(1, Math.ceil(pool.length / 2))
      const revived = pool.slice(0, reviveCount)
      const cost = Math.floor(resetWave.score * params.talismans.resilience.p / 100)
      resetWave = {
        ...resetWave,
        score: resetWave.score - cost,
        stock: [...resetWave.stock, ...revived],
        discardPile: pool.slice(reviveCount),
        resilienceUsedThisWave: true,
      }
    }
  }

  if (resetWave.stock.length > 0) {
    const drawResult = drawStock(params, resetWave, run.items, run.deckComposition, modifier, rand)
    return { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
  }

  return { ...run, wave: markStuck(resetWave) }
}
```

- [ ] **Step 2: 既存の不屈関連テストを新仕様に置き換える**

`engine.test.ts`の`describe('applyStuckCheck (不屈の護符)', ...)`ブロック(1720行目付近〜1773行目付近)を、以下に置き換える。

```ts
describe('applyStuckCheck (不屈の護符)', () => {
  test('不屈を持ち捨て札があれば、手詰まり時にスコア消費して山札へ約半数戻し、その後山札を1枚捲って手詰まりを回避する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1), // 差が4で取れない
      chain: [card(0, '♣', 1)],
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.status).toBe('playing') // 手詰まりが解消されている
    expect(next.wave!.score).toBe(700) // 1000 - 30%
    expect(next.wave!.resilienceUsedThisWave).toBe(true)
    // 4枚の半数=2枚が山札へ、そのうち1枚は自動でめくられるため最終的なstockは1枚
    expect(next.wave!.stock).toHaveLength(1)
    expect(next.wave!.discardPile).toHaveLength(2)
  })

  test('不屈を持っていても捨て札が無ければ通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈を持っていなければ捨て札があっても通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: [], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈: ウェーブ中2回目は発動しない(resilienceUsedThisWaveがtrueなら通常通り手詰まりになる)', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
      resilienceUsedThisWave: true,
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('治癒と不屈を同時所持: 手詰まり直前に列一掃していた列も、不屈による復活と合わせて処理される', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)], []],
      stock: [],
      foundation: card(0, '♣', 1),
      chain: [card(0, '♣', 1)],
      score: 1000,
      sweptColumnsThisCombo: [{ colIndex: 1, startLength: 2 }],
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['healing', 'resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.tableau[1].length).toBeGreaterThan(0) // 治癒によって列1が復活している
  })
})
```

- [ ] **Step 3: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: 不屈をコンボリセット・ウェーブ内1回・山札を捲る仕様に再設計"
```

---

### Task 4: `drawStock`への`target`パラメータ追加と目標スコア即時判定

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**背景:** 現在`drawStock`は`target`(目標スコア)を受け取っておらず、山札めくり由来のスコア加算(誠実・回響・沈着・冷静・慢心など)では目標スコア到達によるウェーブ終了が一切発生しない。本タスクで`drawStock`に`target`を追加し、`playCard`・`drawStock`の両方で、スコアが変動する箇所すべての直後に目標判定を行うよう変更する。

- [ ] **Step 1: `drawStock`のシグネチャに`target`を追加する**

`drawStock`の関数シグネチャを以下に変更する(`items`の直後に`target`を追加):

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
```

- [ ] **Step 2: `drawStock`内のスコア変動箇所すべてに目標判定を追加する**

`drawStock`内の以下の各箇所で、スコアが確定した直後に目標判定を追加する。

まず、山札切れ時の直接加算(`stockEmptyResult`)適用直後(`patternContinues`分岐の判定より前、`newStock.length === 0`のブロックの直後)に、判定用の変数を用意する。既存の

```ts
  let scoreAfterStockEmpty = wave.score
  let stockEmptyResult: { value: number; parts: string[] } = { value: 0, parts: [] }
  if (newStock.length === 0) {
    const stockEmptyCtx: DirectEffectContext = {
      comboBeforeReset: 0,
      hasPlayableColumns: true,
      roleFiredThisChain: false,
      remainingTableauCount: remainingCount(wave.tableau),
      combo: wave.combo,
      colorHeld: false,
      previousCombo: wave.combo,
      scoreAfterGained: wave.score,
    }
    stockEmptyResult = applyDirectEffects('stockEmptyDirect', items, stockEmptyCtx, params)
    scoreAfterStockEmpty += stockEmptyResult.value
  }
```

の直後に、以下を追加する:

```ts
  if (scoreAfterStockEmpty >= target) {
    return {
      wave: { ...wave, stock: newStock, score: scoreAfterStockEmpty, status: 'ended', endReason: 'target' },
      deckComposition,
    }
  }
```

次に、`patternContinues`分岐の中、`return`文の直前(`score: scoreAfterStockEmpty + directGain + naiveGained,`を含むwaveオブジェクトを構築する箇所)で、この`return`の直前に以下を挿入する:

```ts
  const scoreAfterPatternContinue = scoreAfterStockEmpty + directGain + naiveGained
  if (scoreAfterPatternContinue >= target) {
    return {
      wave: {
        ...wave,
        stock: items.includes('promise') ? arrangeNextCardForContinuation(params.scoring, newStock, [...wave.chain, drawnCard], effectiveStairMinLen, effectiveSuitColorMinLen) : newStock,
        foundation: drawnCard,
        combo: naiveCombo,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: naiveGained > 0 ? { points: naiveGained, parts: naiveParts } : null,
        score: scoreAfterPatternContinue,
        drawContinueCountThisChain: newDrawContinueCount,
        benevolenceUsedThisCombo: benevolenceFires ? true : wave.benevolenceUsedThisCombo,
        maxComboThisWave: Math.max(wave.maxComboThisWave, naiveCombo),
        roleFiredThisChain: naiveRoleFiredThisChain,
        flushActiveThisCombo: naiveFlushActiveThisCombo,
        lastBonusGains: patternContinueBonusGains,
        status: 'ended',
        endReason: 'target',
      },
      deckComposition,
    }
  }
```

この判定の直後に、既存の(変更なしの)`return { wave: { ...wave, ..., score: scoreAfterPatternContinue, ... }, deckComposition }`を続ける(`score: scoreAfterStockEmpty + directGain + naiveGained`という式を`score: scoreAfterPatternContinue`という既に計算済みの変数の参照に置き換える。計算内容は変わらない)。

最後に、通常のコンボリセット分岐(Task2で書き換えた`resetWave`構築後)、`items.includes('healing')`の判定の直前に、以下を追加する:

```ts
  if (resetWave.score >= target) {
    return { wave: { ...resetWave, status: 'ended', endReason: 'target' }, deckComposition: newDeckComposition }
  }
```

- [ ] **Step 3: `playCard`内、`scoreAfterGained`確定直後にも目標判定を追加する**

`playCard`内、`const scoreAfterGained = wave.score + gained`の直後、`next`オブジェクトを構築する箇所より前に、以下のように`next`の構築順序を変更する。

現在`next`は`newScore`(=`scoreAfterGained + milestoneResult.value`)を使って1回だけ構築されているはずである(Task2までの状態を確認すること)。これを次のように、`scoreAfterGained`の時点で一度`next`を構築し目標判定を行い、その後`milestoneResult`を適用した最終版を構築する2段階に変更する。

`milestoneCtx`・`milestoneResult`・`newScore`・`bonusGains`を計算する行より前に、`next`オブジェクトの`score`を`scoreAfterGained`にした版を先に構築し、以下の判定を追加する:

```ts
  if (scoreAfterGained >= target) {
    return { wave: { ...next, score: scoreAfterGained, lastBonusGains: [], status: 'ended', endReason: 'target' }, deckComposition }
  }
```

(`next`は元のコードのまま`score: newScore`を使って構築されているので、この判定用には`{ ...next, score: scoreAfterGained, lastBonusGains: [] }`のように`newScore`ベースの`next`から`score`を上書きして使う。)

- [ ] **Step 4: `applyDrawStock`・`playCard`内の`drawStock`呼び出し・`applyStuckCheck`内の`drawStock`呼び出しに`target`を渡す**

`applyDrawStock`関数を以下に変更する:

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const stage = params.stages[run.stageIndex]
  const target = stage.targets[run.waveIndex]
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, target, run.deckComposition, stage.modifier, rand)
  return { ...run, wave, deckComposition }
}
```

`playCard`内、全消し処理の「山札を捲る」箇所(`return drawStock(params, resetWave, items, deckComposition, modifier, rand)`)を以下に変更する:

```ts
        return drawStock(params, resetWave, items, target, deckComposition, modifier, rand)
```

`applyStuckCheck`内の`drawStock`呼び出しを以下に変更する:

```ts
    const stageTarget = params.stages[run.stageIndex].targets[run.waveIndex]
    const drawResult = drawStock(params, resetWave, run.items, stageTarget, run.deckComposition, modifier, rand)
```

(`stageTarget`という変数名にしているのは、`applyStuckCheck`内で既に`target`という名前の変数が使われていないことを確認しつつ、他の変数と衝突しないようにするため。)

- [ ] **Step 5: 既存の`drawStock`呼び出しすべてに`target`引数を追加する**

`engine.test.ts`内で`drawStock(`を直接呼んでいる箇所すべてを`grep`で確認し、シグネチャ変更(第4引数に`target`が増えた)に合わせて呼び出しを修正する。値は`1000000`のように十分大きな値を渡し、既存テストの目標判定に引っかからないようにする。

- [ ] **Step 6: 目標判定の即時性を検証するテストを追加する**

`engine.test.ts`の`describe('drawStock', ...)`ブロック内に、以下のテストを追加する:

```ts
  test('コンボリセット時の直接加算護符でスコアが目標に達したら、その時点でendReason=targetとなりウェーブが終了する', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 差4、パターン不継続
      chain: [card(3, '♥', 5)],
      linked: true,
      score: 100,
    })
    const result = drawStock(DEFAULT_PARAMS, wave, ['composure'], 100 + 1, standardDeckComposition())
    expect(result.wave.status).toBe('ended')
    expect(result.wave.endReason).toBe('target')
  })
```

`describe('playCard', ...)`ブロック内に、以下のテストを追加する:

```ts
  test('護符gainedの時点で目標スコアに達したら、コンボ到達直接加算(流星等)は適用されずその時点でendReason=targetとなる', () => {
    const items: ItemId[] = ['shootingStar']
    const wave = baseWave({
      score: 0,
      combo: DEFAULT_PARAMS.talismans.shootingStar.c - 1,
      chain: [card(20, '♥', 3), card(21, '♦', 4)],
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', items, scoring.basePoint, 0, standardDeckComposition())
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
    expect(next.lastBonusGains).toEqual([]) // 流星の直接加算は行われていない
  })
```

- [ ] **Step 7: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: drawStockにtargetを追加し、スコア変動のたびに目標判定を即時化する"
```

---

### Task 5: `admin/shidasu-debug/+page.svelte`の呼び出し箇所更新

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `playCard`・`drawStock`の呼び出しを新シグネチャに対応させる**

`src/routes/admin/shidasu-debug/+page.svelte`を`Read`で確認する。現在の`handlePlayCard`関数:

```ts
  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
    lastSnapshot = null
  }
```

を、以下に変更する:

```ts
  function handlePlayCard(colIndex: number) {
    const result = playCard(params, wave, 'none', items, TARGET, colIndex, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }
```

現在の`handleDraw`関数・`handleForceDraw`関数内の`drawStock`呼び出し(`drawStock(params, wave, items, deckComposition, 'none')`)を、シグネチャ変更(第4引数に`target`が増えた)に合わせて`drawStock(params, wave, items, TARGET, deckComposition, 'none')`に変更する(`TARGET`は既にファイル内で定義済みの定数`Number.MAX_SAFE_INTEGER`を使う)。

- [ ] **Step 2: 型チェック**

```bash
npm run check
```

Expected: 型エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "refactor: admin/shidasu-debugのplayCard/drawStock呼び出しを新シグネチャに対応"
```

---

### Task 6: 最終検証・ブラウザ動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体テスト・型チェック・ビルド**

```bash
npm run test
npm run check
npm run build
```

Expected: すべて成功。

- [ ] **Step 2: 開発サーバーを起動し`/admin/shidasu-debug`で動作確認する**

```bash
npm run dev
```

以下を確認する:
- 治癒を有効化し、列を一掃した直後はまだ列が空のままであること、山札をめくって(パターン不継続の)コンボリセットが起きた瞬間にその列が復活すること
- 再生を有効化し、山札が残っている状態で全消しさせると、スコア消費の上場札が復活し、直後に山札が1枚自動でめくられること。2回目の全消しでは発動しないこと
- 不屈を有効化し、手詰まり状態(山札0・取れる場札なし)を作ると、スコア消費の上山札が復活し直後に1枚自動でめくられ、手詰まりが解消されること
- コンソールエラーが出ていないこと

- [ ] **Step 3: 開発サーバーを停止する**

## Self-Review 結果

- **spec coverage:** spec section1(共通処理)→Task2-3、section2(WaveState拡張)→Task1、section3(目標判定即時化)→Task4、section4(全消しフロー)→Task2、section5(手詰まりフロー)→Task3、section6(API影響)→Task2,3,5、受け入れ基準1-8→Task1-6でそれぞれ充足。
- **placeholder scan:** 全タスクで変更対象の完全なコードを記載済み。既存テストの削除範囲・置き換え後のテストコードも具体的に記載した。
- **type consistency:** `resetComboFields`/`resolveHealingRestoration`の関数名・シグネチャ、`sweptColumnsThisCombo`/`regenerationUsedThisWave`/`resilienceUsedThisWave`のフィールド名は全タスクを通して一貫させた。`playCard`/`drawStock`の新シグネチャ(引数順序)もTask2-5で一致させた。
