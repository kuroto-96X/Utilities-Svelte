# 妨害行動「総戻し」「一列戻し」の裏向き演出(アニメーション) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星の妨害行動「総戻し」(`tableauFullReturn`)・「一列戻し」(`columnReturn`)発動時に、対象カードが山札へ収束→裏向きで場札へ配布→列の一番上だけフリップして表向きになる、という3段階演出を実装する。あわせて`/admin/shidasu-debug`に妨害行動を直接発動するデバッグボタンを追加する。

**Architecture:** `WaveState`に発動検知用フィールド`lastSabotage`を追加し、`triggerSabotage`が更新する(Task 1)。デバッグ画面に発動ボタンを追加し、動作確認を可能にする(Task 2)。`PlayArea.svelte`側は、既存の`runGatherAndMoveAnimation`(片付けアニメーションが使用)・`dealOneCard`/`startDealAnimation`(配布アニメーションが使用)のパターンを流用し、対象列のみを再収束・再配布する専用アニメーションを実装する(Task 3)。着地したカードのうち列の一番上になるものは、即座に表向き表示せず、フリップ演出を挟んでから表向きにする(Task 4)。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-facedown-redistribute-animation-design.md`

---

## Task 1: `WaveState.lastSabotage`フィールドを追加し`triggerSabotage`で更新する

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `WaveState`に`lastSabotage`フィールドを追加する**

`src/lib/game/shidasu/types.ts`内、`WaveState`インターフェース内の`activeSeal`フィールド定義の直後(`grep -n "activeSeal:"`で位置を特定できる)に以下を追加する:

```ts
  // 直近発動した妨害行動の識別情報。UI(PlayArea.svelte)がこの値の変化を検知して
  // 専用アニメーションを起動するために使う。発動のたびにseqをインクリメントし、
  // 同じIDが連続発動しても検知できるようにする。undefinedは「まだ一度も妨害が
  // 発動していない」状態を表す。
  lastSabotage?: { id: SabotageActionId; seq: number }
```

- [ ] **Step 2: `triggerSabotage`が`lastSabotage`を更新するようにする**

`src/lib/game/shidasu/engine.ts`内、以下のブロック(`grep -n "export function triggerSabotage"`で位置を特定できる):

```ts
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return { ...nextRun, wave: { ...nextWave, pendingSabotageId: rolled.pendingSabotageId, sabotageTurnsRemaining: rolled.sabotageTurnsRemaining } }
}
```

を以下に置き換える:

```ts
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return {
    ...nextRun,
    wave: {
      ...nextWave,
      pendingSabotageId: rolled.pendingSabotageId,
      sabotageTurnsRemaining: rolled.sabotageTurnsRemaining,
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1 },
    },
  }
}
```

- [ ] **Step 3: `lastSabotage`更新のテストを追加する**

`src/lib/game/shidasu/engine.test.ts`内、`grep -n "it('stockPurge: 山札の上から5枚を捨て札に置く'"`で該当テストブロックを探し、その直後に新しいテストを1件追加する:

```ts
  it('triggerSabotage: 発動のたびにwave.lastSabotageのidとseqが更新される', () => {
    const run = runWithWave()
    const next1 = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', () => 0)
    expect(next1.wave!.lastSabotage).toEqual({ id: 'stockPurge', seq: 1 })
    const next2 = triggerSabotage(DEFAULT_PARAMS, next1, 'comboBreather', () => 0)
    expect(next2.wave!.lastSabotage).toEqual({ id: 'comboBreather', seq: 2 })
  })
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 5: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(新規追加テストを含む)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: WaveStateにlastSabotageを追加しtriggerSabotageで更新する"
```

---

## Task 2: `/admin/shidasu-debug`に妨害行動の発動ボタンを追加する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `triggerSabotage`・`createInitialRun`・`SABOTAGE_POOL`をインポートする**

`src/routes/admin/shidasu-debug/+page.svelte`内、以下の行(`grep -n "import { startWave, playCard, drawStock, forceStockTop }"`で位置を特定できる):

```ts
  import { startWave, playCard, drawStock, forceStockTop } from '$lib/game/shidasu/engine'
```

を以下に置き換える:

```ts
  import { startWave, playCard, drawStock, forceStockTop, triggerSabotage, createInitialRun } from '$lib/game/shidasu/engine'
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
```

同ファイル内、`import type { WaveState, Card, ItemId, DeckCard, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'`の行を以下に置き換える:

```ts
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank, RiteId, RevelationId, RoleName, SabotageActionId } from '$lib/game/shidasu/types'
```

- [ ] **Step 2: 妨害行動を発動するハンドラを追加する**

同ファイル内、`function handleDraw()`ブロックの直後(`grep -n "function handleDraw"`で位置を特定できる)に以下を追加する:

```ts
  function handleTriggerSabotage(id: SabotageActionId) {
    const run = { ...createInitialRun(), items, wave }
    const next = triggerSabotage(params, run, id, Math.random)
    if (next.wave) wave = next.wave
    lastSnapshot = null
  }
```

- [ ] **Step 3: 発動ボタンのUIを追加する**

同ファイル内、`PlayArea`コンポーネントが描画されているブロックを`grep -n "<PlayArea"`で探し、その直前に以下のセクションを追加する:

```svelte
<div class="p-2 border rounded space-y-1">
  <p class="text-xs text-slate-500">星の妨害行動を直接発動(デバッグ用)</p>
  <div class="flex flex-wrap gap-1">
    {#each SABOTAGE_POOL as def (def.id)}
      <button
        type="button"
        onclick={() => handleTriggerSabotage(def.id)}
        class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
      >{def.name}</button>
    {/each}
  </div>
</div>
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 5: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(このタスクはデバッグ画面のみを対象とし、エンジンロジックは変更していないため、既存テストは無修正のまま全てグリーンになるはず)

- [ ] **Step 6: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開く

- 「総戻し」「一列戻し」ボタンを押すと、場札が(この時点ではまだ演出無しで即座に)再配布されること
- 他の妨害行動のボタンも押せること(エラーが出ないこと)

ブラウザ操作が困難な環境であれば、Step 4〜6(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: shidasu-debugに妨害行動の直接発動ボタンを追加する"
```

---

## Task 3: 対象列の収束→裏向き配布アニメーションを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: アニメーション状態を追加する**

`src/routes/game/shidasu/PlayArea.svelte`内、`let chainResetAnimation = $state<ChainResetAnimation | null>(null)`の行(`grep -n "let chainResetAnimation = "`で位置を特定できる)の直後に以下を追加する:

```ts
  interface SabotageRedistributeAnimation {
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
    gatherCards: GatherMoveCardPosition[]
  }
  let sabotageRedistributeAnimation = $state<SabotageRedistributeAnimation | null>(null)
  let sabotageRedistributeTimer: ReturnType<typeof setTimeout> | undefined
  // 「総戻し」「一列戻し」発動により再収束・再配布中の列インデックス。この間、対象列の
  // 本物の場札描画(既に妨害後のデータになっている)を隠し、代わりにアニメーション用の
  // オーバーレイを表示する。
  let sabotageAnimatingColumns = $state<Set<number>>(new Set())
```

- [ ] **Step 2: `DealingCard`に`faceUp`を追加し、`dealOneCard`/`startDealAnimation`が受け取れるようにする**

同ファイル内、以下のブロック(`grep -n "interface DealingCard"`で位置を特定できる):

```ts
  // 配布アニメーション中、1枚のカードが山札から場札のマス目へ飛んでいく状態。
  interface DealingCard {
    card: Card
    colIndex: number
    rowIndex: number
    left: number
    top: number
    transitionMs: number
  }
```

を以下に置き換える:

```ts
  // 配布アニメーション中、1枚のカードが山札から場札のマス目へ飛んでいく状態。
  interface DealingCard {
    card: Card
    colIndex: number
    rowIndex: number
    left: number
    top: number
    transitionMs: number
    faceUp: boolean
  }
```

同ファイル内、以下のブロック(`grep -n "function dealOneCard"`で位置を特定できる):

```ts
  // 1枚のカードを山札の位置からマス目の位置へ移動させ、着地したらdealtCellsに登録して
  // 実表示へ切り替える。複数枚が時間差で同時並行するため、dealingCardsは配列で管理する。
  function dealOneCard(entry: { card: Card; colIndex: number; rowIndex: number }, fromLeft: number, fromTop: number) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0 },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }
```

を以下に置き換える(`faceUp`引数を追加し、着地時のコールバックを差し替え可能にする):

```ts
  // 1枚のカードを山札の位置からマス目の位置へ移動させ、着地したらdealtCellsに登録して
  // 実表示へ切り替える。複数枚が時間差で同時並行するため、dealingCardsは配列で管理する。
  // faceUpは配布中の表示に使う(通常配布は常にtrue、妨害再配布はfalse)。onLandedは
  // 着地時にdealtCells登録の代わりに独自処理をしたい呼び出し元(妨害再配布)向けのフック。
  function dealOneCard(
    entry: { card: Card; colIndex: number; rowIndex: number },
    fromLeft: number,
    fromTop: number,
    faceUp: boolean = true,
    onLanded?: (entry: { card: Card; colIndex: number; rowIndex: number }) => void
  ) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0, faceUp },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
      if (onLanded) {
        onLanded(entry)
      } else {
        dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      }
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }
```

同ファイル内、`startDealAnimation`関数内で`dealOneCard(entry, fromLeft, fromTop)`を呼んでいる行(`grep -n "dealOneCard(entry, fromLeft, fromTop)"`で位置を特定できる)はそのまま(引数を追加していないため、`faceUp`のデフォルト値`true`・`onLanded`未指定=既存の`dealtCells`登録動作がそのまま使われる)で変更不要。

- [ ] **Step 3: `anyAnimationActive`に新規状態を含める**

同ファイル内、以下の行(`grep -n "let anyAnimationActive = "`で位置を特定できる):

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0)
```

- [ ] **Step 4: 妨害発動を検知して収束アニメーションを起動する`$effect.pre`を追加する**

同ファイル内、`$effect.pre`のチェーンリセット検知ブロックの直後(`grep -n "startChainResetAnimation(resetCards)"`で位置を特定し、そのブロックの`})`の直後)に以下を追加する:

```ts

  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if (current.id === 'tableauFullReturn' || current.id === 'columnReturn') {
      const affectedCols = wave.tableau
        .map((col, ci) => ({ ci, hidden: col.some(c => c.faceUp === false) }))
        .filter(x => x.hidden)
        .map(x => x.ci)
      startSabotageRedistributeAnimation(affectedCols)
    }
  })
```

- [ ] **Step 5: 収束アニメーション(フェーズ1)を実装する**

同ファイル内、`startDealAnimation`関数の直前(`grep -n "function startDealAnimation"`で位置を特定できる)に以下を追加する:

```ts
  // 「総戻し」「一列戻し」発動時、対象列のカードを山札の位置へ収束させるアニメーションを
  // 開始する。完了後、startSabotageDealAnimationへ引き継ぐ。
  function startSabotageRedistributeAnimation(affectedCols: number[]) {
    if (affectedCols.length === 0 || !tableauEl || !stockButtonEl) return

    const gatherCards: GatherMoveCardPosition[] = []
    affectedCols.forEach(ci => {
      const col = wave.tableau[ci]
      col.forEach((card, ri) => {
        const cardEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${ci}"][data-drop-row="${ri}"]`)
        if (!cardEl) return
        const cardRect = cardEl.getBoundingClientRect()
        gatherCards.push({ card, left: cardRect.left + cardRect.width / 2, top: cardRect.top + cardRect.height / 2 })
      })
    })
    if (gatherCards.length === 0) return

    sabotageAnimatingColumns = new Set(affectedCols)

    const firstCardEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${affectedCols[0]}"][data-drop-row="0"]`)
    const gatherRect = (firstCardEl ?? tableauEl).getBoundingClientRect()
    const gatherLeft = gatherRect.left + gatherRect.width / 2
    const gatherTop = gatherRect.top + gatherRect.height / 2

    sabotageRedistributeAnimation = {
      phase: 'gather',
      left: gatherLeft,
      top: gatherTop,
      transitionMs: 0,
      gatherCards,
    }

    runGatherAndMoveAnimation({
      getAnimation: () => sabotageRedistributeAnimation,
      setAnimation: next => { sabotageRedistributeAnimation = next },
      setTimer: timer => { sabotageRedistributeTimer = timer },
      gatherCards,
      representativeCard: gatherCards[0].card,
      gatherLeft,
      gatherTop,
      getMoveTarget: () => {
        if (!stockButtonEl) return null
        const rect = stockButtonEl.getBoundingClientRect()
        return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 }
      },
      gatherMs: CLEANUP_GATHER_MS,
      moveMs: CLEANUP_MOVE_MS,
      onComplete: () => startSabotageDealAnimation(affectedCols),
    })
  }
```

- [ ] **Step 6: 裏向き配布アニメーション(フェーズ2)を実装する**

同ファイル内、`startSabotageRedistributeAnimation`関数の直後に以下を追加する:

```ts
  // 収束アニメーション完了後、対象列のみへカードを裏向きで配り直す。配布順序は
  // 対象列内でrow=0から順に、複数列がある場合は列をまたいでrow単位で揃える
  // (startDealAnimationと同じ考え方)。着地したカードがその列の一番上であれば
  // フリップ演出(startFlipReveal)を、そうでなければ即座にdealtCellsへ登録する。
  function startSabotageDealAnimation(affectedCols: number[]) {
    // 対象列を「未配布」扱いに戻す(isNotYetDealtの判定に使うdealtCellsから除去)。
    dealtCells = new Set([...dealtCells].filter(key => !affectedCols.includes(Number(key.split('-')[0]))))

    if (!stockButtonEl) {
      sabotageAnimatingColumns = new Set()
      return
    }
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...affectedCols.map(ci => wave.tableau[ci].length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (const ci of affectedCols) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    let landedCount = 0
    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
        dealOneCard(entry, fromLeft, fromTop, false, landedEntry => {
          landedCount += 1
          if (isTopOfColumn) {
            startFlipReveal(landedEntry.colIndex, landedEntry.rowIndex, landedEntry.card)
          } else {
            dealtCells = new Set([...dealtCells, `${landedEntry.colIndex}-${landedEntry.rowIndex}`])
          }
          if (landedCount === order.length) {
            sabotageAnimatingColumns = new Set()
          }
        })
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 7: テンプレート側で`sabotageRedistributeAnimation`のオーバーレイを描画する**

同ファイル内、配布アニメーション用のテンプレート(`grep -n "{#each dealingCards as dealingCard"`で位置を特定できる)の直前に、以下のオーバーレイ描画ブロックを追加する:

```svelte
{#if sabotageRedistributeAnimation}
  {#each sabotageRedistributeAnimation.gatherCards as gatherCard, i (i)}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{sabotageRedistributeAnimation.left}px; top:{sabotageRedistributeAnimation.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{sabotageRedistributeAnimation.transitionMs}ms;"
    >
      <CardFace card={gatherCard.card} covered={false} faceUp={false} {items} />
    </div>
  {/each}
{/if}
```

- [ ] **Step 8: `dealingCards`の描画に`faceUp`を反映する**

同ファイル内、以下の行(`grep -n "CardFace card={dealingCard.card}"`で位置を特定できる):

```svelte
      <CardFace card={dealingCard.card} covered={false} {items} />
```

を以下に置き換える:

```svelte
      <CardFace card={dealingCard.card} covered={false} faceUp={dealingCard.faceUp} {items} />
```

- [ ] **Step 9: 対象列の本物の場札描画を、アニメーション中は隠す**

同ファイル内、以下の行(`grep -n "isNotYetDealt = dealAnimationActive"`で位置を特定できる):

```svelte
          {@const isNotYetDealt = dealAnimationActive && !dealtCells.has(`${ci}-${ri}`)}
```

の直後に、以下を追加する:

```svelte
          {@const isHiddenForSabotageRedistribute = sabotageAnimatingColumns.has(ci)}
```

同ファイル内、この2つのconstを使っている`invisible`判定のクラス文字列(`grep -n "isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt"`で位置を特定できる)を、以下のように書き換える:

```svelte
{isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute ? 'invisible' : ''}
```

- [ ] **Step 10: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し。`startFlipReveal`はTask 4で実装するため、この時点では未定義エラーが出る。仮実装として、Step 5の直前に以下の空実装を追加しておく(Task 4で本実装に置き換える):

```ts
  // Task 4で本実装に置き換える。現時点では即座にdealtCellsへ登録するだけの仮実装。
  function startFlipReveal(colIndex: number, rowIndex: number, _card: Card) {
    dealtCells = new Set([...dealtCells, `${colIndex}-${rowIndex}`])
  }
```

この仮実装は`startSabotageRedistributeAnimation`関数の直前に追加する。

- [ ] **Step 11: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 12: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 13: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開く

- 「総戻し」ボタンを押すと、全列のカードが山札へ収束→裏向きで各列へ配布される演出が流れること(この時点では、着地後は仮実装によりすぐ表向き表示になる。フリップ演出はTask 4で確認する)
- 「一列戻し」ボタンを押すと、対象の1列だけが同様に演出され、他の列は動かないこと
- 演出中、山札を引くボタン等が無効化されること

ブラウザ操作が困難な環境であれば、Step 10〜12(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 14: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 総戻し・一列戻し発動時の山札収束→裏向き配布アニメーションを実装する"
```

---

## Task 4: フリップ演出を実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: フリップ状態を追加する**

`src/routes/game/shidasu/PlayArea.svelte`内、`sabotageAnimatingColumns`の定義の直後(Task 3 Step 1で追加した箇所)に以下を追加する:

```ts
  interface FlippingCard {
    colIndex: number
    rowIndex: number
    card: Card
    revealed: boolean
    rotation: number
    transitionMs: number
  }
  let flippingCards = $state<FlippingCard[]>([])

  const FLIP_HALF_MS = 100
```

- [ ] **Step 2: `anyAnimationActive`にフリップ中を含める**

同ファイル内、Task 3 Step 3で書き換えた`anyAnimationActive`の行を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0)
```

- [ ] **Step 3: Task 3の仮実装を本実装に置き換える**

同ファイル内、Task 3 Step 10で追加した仮実装ブロック:

```ts
  // Task 4で本実装に置き換える。現時点では即座にdealtCellsへ登録するだけの仮実装。
  function startFlipReveal(colIndex: number, rowIndex: number, _card: Card) {
    dealtCells = new Set([...dealtCells, `${colIndex}-${rowIndex}`])
  }
```

を以下に置き換える:

```ts
  // 配布アニメーションで着地したカードが列の一番上だった場合に呼ぶ。裏面のまま真横まで
  // 回転させ(見た目上不可視になった瞬間にrevealedをtrueへ切り替えて表向きの中身に差し替え)、
  // 続けて正面まで回転させて表向き表示を完了する。完了後はdealtCellsへ登録し、以後は
  // 通常の場札描画(既存のfaceUp={card.faceUp !== false || isTop}ルール)にそのまま委ねる。
  function startFlipReveal(colIndex: number, rowIndex: number, card: Card) {
    flippingCards = [...flippingCards, { colIndex, rowIndex, card, revealed: false, rotation: 0, transitionMs: 0 }]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flippingCards = flippingCards.map(f =>
          f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, rotation: 90, transitionMs: FLIP_HALF_MS } : f
        )
      })
    })

    const timer1 = setTimeout(() => {
      flippingCards = flippingCards.map(f =>
        f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, revealed: true, rotation: 90, transitionMs: 0 } : f
      )
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flippingCards = flippingCards.map(f =>
            f.colIndex === colIndex && f.rowIndex === rowIndex ? { ...f, rotation: 0, transitionMs: FLIP_HALF_MS } : f
          )
        })
      })
      const timer2 = setTimeout(() => {
        flippingCards = flippingCards.filter(f => !(f.colIndex === colIndex && f.rowIndex === rowIndex))
        dealtCells = new Set([...dealtCells, `${colIndex}-${rowIndex}`])
      }, FLIP_HALF_MS)
      dealTimers.push(timer2)
    }, FLIP_HALF_MS)
    dealTimers.push(timer1)
  }
```

- [ ] **Step 4: テンプレート側でフリップ中のカードをオーバーレイ表示する**

同ファイル内、Task 3 Step 9で追加した`isHiddenForSabotageRedistribute`の直後に、以下を追加する:

```svelte
          {@const flippingHere = flippingCards.find(f => f.colIndex === ci && f.rowIndex === ri)}
```

同じブロック内、`isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute`の判定に`flippingHere`を追加する:

```svelte
{isAnimatingThisCard || isCleaningUpThisColumn || isNotYetDealt || isHiddenForSabotageRedistribute || flippingHere ? 'invisible' : ''}
```

同ファイル内、`{#if sabotageRedistributeAnimation}`ブロック(Task 3 Step 7で追加)の直後に、フリップ中カードのオーバーレイを追加する:

```svelte
{#each flippingCards as flippingCard (`${flippingCard.colIndex}-${flippingCard.rowIndex}`)}
  {@const cellEl = tableauEl?.querySelector(`[data-drop-col="${flippingCard.colIndex}"][data-drop-row="${flippingCard.rowIndex}"]`)}
  {@const cellRect = cellEl?.getBoundingClientRect()}
  {#if cellRect}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{cellRect.left}px; top:{cellRect.top}px; width:{cellRect.width}px; transform: perspective(600px) rotateY({flippingCard.rotation}deg); transition-property: transform; transition-duration:{flippingCard.transitionMs}ms;"
    >
      <CardFace card={flippingCard.card} covered={false} faceUp={flippingCard.revealed} items={[]} />
    </div>
  {/if}
{/each}
```

(フリップ中オーバーレイの座標は、着地済みマス目のDOM要素の位置をそのまま参照する簡易実装とする。より厳密な追従が必要になった場合は別途調整する。)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 6: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS

- [ ] **Step 7: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開く

- 「総戻し」ボタンを押し、山札への収束→裏向き配布→各列の一番上のカードだけがフリップして表向きになる、という一連の流れを確認する
- 「一列戻し」ボタンを押し、対象の1列だけで同様の流れが再生されることを確認する
- 演出完了後、場札をクリックしてプレイし、次に一番上になったカード(元々裏向きだったもの)が正しく表向きで表示されることを確認する(フリップ演出は初回の revelation のみで、以降は通常の表示ルールに委ねられる想定)
- 演出中は他の操作が無効化され、完了後は正常に操作できることを確認する

ブラウザ操作が困難な環境であれば、Step 5〜7(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 9: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 総戻し・一列戻し配布時の列トップカードにフリップ演出を実装する"
```

---

## 最終確認

全4タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、`/admin/shidasu-debug`で「総戻し」「一列戻し」を発動し、3段階演出(収束→裏向き配布→フリップ)が意図通りに再生されることを通しで確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回の実装完了を反映する
