# Waveクリア後の片付けアニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Waveクリア(SCOREがTARGETに到達)確定後、画面遷移前に、場札・チェーン・捨て札のカードを山札へ順番に片付けるアニメーションを追加する。付随して、これまで画面に一切表示されていなかった捨て札(discardPile)の常設UIを新規に追加する。

**Architecture:** `PlayArea.svelte`に新しいアニメーション状態(`cleanupAnimation`)を追加し、既存の`playingAnimation`/`scoreReveal`/`partFlyIn`と同じ設計パターン(`setTimeout`によるフェーズ制御、`getBoundingClientRect`による座標計算、`position:fixed`オーバーレイ)で実装する。`+page.svelte`側は、Wave終了理由が`'target'`の場合、現在の`clearDelayMs`固定待機を廃止し、`PlayArea.svelte`からの片付けアニメーション完了通知(新しいコールバックprop`onCleanupDone`)を待ってから画面遷移(`resolveWaveEnd`)を行うよう変更する。

**Tech Stack:** SvelteKit / Svelte 5 runes(`$state`)、TypeScript、CSS transition

---

## 事前情報(実装者向け)

- 対象ファイルは`src/routes/game/shidasu/PlayArea.svelte`と`src/routes/game/shidasu/+page.svelte`。
- `WaveState`(`src/lib/game/shidasu/types.ts`)には`discardPile: Card[]`というフィールドが既に存在し、コンボリセット時にチェーンの札が送られる、ウェーブ内限定の捨て札として運用されている(不屈の護符などが参照する)。今回のタスクでは、この既存データを画面に表示するUIを新規に追加する(ゲームロジック自体の変更は一切ない)。
- `WaveEndReason = 'target' | 'fullClear' | 'stuck' | null`(`types.ts`)。今回対象とするのは`endReason === 'target'`(スコア到達によるクリア)のケースのみ。手詰まり(`'stuck'`)・全消し(`'fullClear'`)によるWave終了は対象外で、挙動を変更しない。
- `PlayArea.svelte`には既に3つのアニメーション状態(`playingAnimation`, `scoreReveal`, `partFlyIn`)が存在し、いずれも「`setTimeout`でフェーズを進める」「`getBoundingClientRect`で開始・終了座標を計算する」「`position: fixed`のオーバーレイで見た目を表現する」という設計パターンで統一されている。今回追加する`cleanupAnimation`もこのパターンを踏襲する。
- 場札の各カード要素には`data-drop-col={ci}` `data-drop-row={ri}`という属性が付いており、`tableauEl.querySelector('[data-drop-col="X"][data-drop-row="Y"]')`で特定のカード要素のDOM座標を取得できる。`ri`は列内でのインデックスで、`ri === col.length - 1`が「一番上(プレイ可能)のカード」であり、表示上は`top: ri * 18px`によって画面上で最も下にずれて表示されている(既存の積み重ね表現)。
- `+page.svelte`の`afterAction()`関数(既存)は、`run.wave?.status === 'ended'`のとき、`endReason === 'target'`なら`params.flow.clearDelayMs`(450ms)待ってから、そうでなければ即座に(`delay=0`)、`resolveWaveEnd`(画面遷移処理)を呼んでいる。今回のタスクで、`endReason === 'target'`のケースだけ、`clearDelayMs`待機をやめて`PlayArea.svelte`からの通知を待つ形に変更する。`endReason`が`'stuck'`/`'fullClear'`のケースの`delay=0`という既存動作は変更しない。

---

### Task 1: 捨て札の常設UIを追加する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

`wave.discardPile`の一番上のカード(配列の最後の要素)を、山札ボタンの下に常時表示する。空の場合は何も表示しない。

- [ ] **Step 1: 山札ボタンを縦積みラッパーで囲み、捨て札表示を追加する**

`src/routes/game/shidasu/PlayArea.svelte`の山札ボタン部分(現在、`<div class="px-4 pb-5 pt-2 flex items-start gap-4">`の直下にある`<button type="button" onclick={onDraw} ... data-drop-stock ...>`)を、以下に変更する:

```svelte
<div class="px-4 pb-5 pt-2 flex items-start gap-4">
  <div class="flex flex-col items-center gap-1" style="margin-top:20px;">
    <button
      type="button"
      onclick={onDraw}
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null}
      data-drop-stock
      bind:this={stockButtonEl}
      style="aspect-ratio: 2 / 3;"
      class="w-16 shrink-0 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{wave.stock.length}</div>
    </button>
    {#if wave.discardPile.length > 0}
      <div bind:this={discardPileEl} class="w-10">
        <CardFace card={wave.discardPile[wave.discardPile.length - 1]} covered={false} />
      </div>
    {/if}
  </div>
  {#if items.includes('guidance') && wave.stock.length > 0}
    {@const nextCard = wave.stock[wave.stock.length - 1]}
    <div class="flex flex-col items-center justify-center" style="margin-top:20px;">
      <div class="text-[10px] text-emerald-300/70 mb-1">次の札</div>
      <CardFace card={nextCard} covered={false} />
    </div>
  {/if}
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0">
```

(この時点では`{#if wave.discardPile.length > 0}`のみで、片付けアニメーション中の非表示切り替えはTask 3で追加する。既存の`style="aspect-ratio: 2 / 3; margin-top:20px;"`だった山札ボタンの`margin-top:20px`を、外側の新しい`<div class="flex flex-col items-center gap-1">`ラッパーへ移し、ボタン自体は`aspect-ratio: 2 / 3;`のみを残している)

- [ ] **Step 2: `stockButtonEl`・`discardPileEl`のstate宣言を追加する**

`src/routes/game/shidasu/PlayArea.svelte`の`let noPlayableHintEl: HTMLDivElement | undefined = $state()`の直後に、以下を追加する:

```ts
  let stockButtonEl: HTMLButtonElement | undefined = $state()
  let discardPileEl: HTMLDivElement | undefined = $state()
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`に関するエラーが0件(既存の無関係な警告・他ファイルのエラーは無視してよい)

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 捨て札の常設UIを追加(山札の下に一番上のカードを表示)"
```

---

### Task 2: `+page.svelte`側の配線を変更する

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

Wave終了理由が`'target'`のとき、`clearDelayMs`固定待機を廃止し、`PlayArea.svelte`からの片付けアニメーション完了通知を待ってから画面遷移するように変更する。

- [ ] **Step 1: `afterAction()`を変更する**

`src/routes/game/shidasu/+page.svelte`の`afterAction()`関数(現状):

```ts
  function afterAction() {
    clearPendingTimer()
    if (run.wave?.status === 'ended') {
      const delay = run.wave.endReason === 'target' ? params.flow.clearDelayMs : 0
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, delay)
      return
    }
    scheduleStuckCheck()
  }
```

を、以下に変更する:

```ts
  function afterAction() {
    clearPendingTimer()
    if (run.wave?.status === 'ended') {
      if (run.wave.endReason === 'target') {
        // 片付けアニメーション完了(PlayArea側のonCleanupDone経由でhandleCleanupDoneが
        // 呼ばれるまで)を待ってからresolveWaveEndを呼ぶため、ここでは何もしない。
        return
      }
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        run = resolveWaveEnd(params, run)
      }, 0)
      return
    }
    scheduleStuckCheck()
  }

  // PlayArea側の片付けアニメーション(場札・チェーン・捨て札を山札へ戻す演出)が
  // 完了した後に呼ばれる。endReason==='target'のときのafterAction()から委譲される。
  function handleCleanupDone() {
    run = resolveWaveEnd(params, run)
  }
```

- [ ] **Step 2: `<PlayArea>`呼び出しに`onCleanupDone`を渡す**

`src/routes/game/shidasu/+page.svelte`の通常プレイ画面の`<PlayArea>`呼び出し(`onScoreRevealDone={handleScoreRevealDone}`が指定されている箇所)を、以下に変更する:

```svelte
  <PlayArea
    {wave} {params} modifier={currentModifier} {target} items={run.items}
    onPlayCard={handlePlayCard} onDraw={handleDraw}
    onScoreRevealDone={handleScoreRevealDone}
    onCleanupDone={handleCleanupDone}
    waveKey={`${run.stageIndex}-${run.waveIndex}`}
    headerExtra={stageRow} extraFooter={itemBadges}
    rites={run.rites} onUseRite={handleUseRite}
    revelations={run.revelations} onUseRevelationClick={handleUseRevelationClick}
    columnTargetMode={pendingRevelationTarget !== null}
    canTargetColumn={canTargetRevelationColumn}
    onTargetColumn={handleTargetColumn}
    chainAreaExtra={pendingRevelationTarget ? revelationTargetPrompt : undefined}
  />
```

(`onCleanupDone={handleCleanupDone}`の1行を追加するのみ。他のprop・順序は変更しない)

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: この時点では`PlayArea.svelte`側に`onCleanupDone`propがまだ定義されていないため、型エラーが出る(Task 3で解消される想定通りの状態)。エラー内容が「`onCleanupDone`という未知のpropが渡されている」旨であることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: Wave終了理由がtargetの場合、片付けアニメ完了を待って画面遷移するよう変更"
```

---

### Task 3: `PlayArea.svelte`に片付けアニメーション本体を実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

場札の各列(左から右)→チェーン→捨て札、の順に、各カード群を「1山にまとめて山札へ移動」させるアニメーションを実装する。

- [ ] **Step 1: `$props()`に`onCleanupDone`を追加する**

`src/routes/game/shidasu/PlayArea.svelte`の`$props()`の分割代入部分(`onScoreRevealDone, waveKey,`の行)を以下に変更する:

```ts
    onScoreRevealDone, waveKey, onCleanupDone,
```

型定義部分(`onScoreRevealDone?: () => void` `waveKey?: string`の行)の直後に、以下を追加する:

```ts
    onCleanupDone?: () => void
```

- [ ] **Step 2: 片付けアニメーションの定数・型・stateを追加する**

`src/routes/game/shidasu/PlayArea.svelte`の`let noPlayableHintEl: HTMLDivElement | undefined = $state()`(Task 1で`stockButtonEl`/`discardPileEl`を追加した直後)の後に、以下を追加する:

```ts
  const CLEANUP_GATHER_MS = 150
  const CLEANUP_MOVE_MS = 200

  interface CleanupAnimation {
    kind: 'column' | 'chain' | 'discard'
    columnIndex: number
    card: Card
    phase: 'gather' | 'move'
    left: number
    top: number
    transitionMs: number
  }

  let cleanupAnimation = $state<CleanupAnimation | null>(null)
  let cleanupQueue: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }[] = []
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
```

- [ ] **Step 3: `onDestroy`に`cleanupTimer`のクリアを追加する**

既存の`onDestroy`ブロック:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
  })
```

を以下に変更する:

```ts
  onDestroy(() => {
    clearTimeout(animationTimer1)
    clearTimeout(animationTimer2)
    clearTimeout(scoreRevealTimer)
    clearTimeout(cleanupTimer)
  })
```

- [ ] **Step 4: 片付けアニメーションの開始・進行関数を追加する**

Step 2で追加したコードブロックの直後に、以下の関数群を追加する:

```ts
  // Waveクリア確定後、場札の各列(左から右)→チェーン→捨て札の順に、
  // 各カード群を1山にまとめて山札へ移動させるアニメーションを開始する。
  function startCleanupAnimation() {
    const columnItems = wave.tableau
      .map((col, ci) => ({ columnIndex: ci, card: col[col.length - 1] }))
      .filter((entry): entry is { columnIndex: number; card: Card } => entry.card !== undefined)
      .map(entry => ({ kind: 'column' as const, columnIndex: entry.columnIndex, card: entry.card }))
    const chainItems = wave.chain.length > 0
      ? [{ kind: 'chain' as const, columnIndex: -1, card: wave.chain[wave.chain.length - 1] }]
      : []
    const discardItems = wave.discardPile.length > 0
      ? [{ kind: 'discard' as const, columnIndex: -1, card: wave.discardPile[wave.discardPile.length - 1] }]
      : []
    cleanupQueue = [...columnItems, ...chainItems, ...discardItems]
    processNextCleanupItem()
  }

  function processNextCleanupItem() {
    const item = cleanupQueue.shift()
    if (!item) {
      cleanupAnimation = null
      onCleanupDone?.()
      return
    }
    startCleanupItem(item)
  }

  function startCleanupItem(item: { kind: 'column' | 'chain' | 'discard'; columnIndex: number; card: Card }) {
    let fromEl: HTMLElement | null = null
    if (item.kind === 'column') {
      const col = wave.tableau[item.columnIndex]
      fromEl = tableauEl?.querySelector<HTMLElement>(`[data-drop-col="${item.columnIndex}"][data-drop-row="${col.length - 1}"]`) ?? null
    } else if (item.kind === 'chain') {
      fromEl = chainAreaEl ?? null
    } else {
      fromEl = discardPileEl ?? null
    }
    if (!fromEl || !stockButtonEl) {
      // 座標が取得できない(要素未マウント等)場合は、このアイテムをスキップして次へ進む。
      processNextCleanupItem()
      return
    }
    const fromRect = fromEl.getBoundingClientRect()
    const toRect = stockButtonEl.getBoundingClientRect()
    cleanupAnimation = {
      kind: item.kind,
      columnIndex: item.columnIndex,
      card: item.card,
      phase: 'gather',
      left: fromRect.left + fromRect.width / 2,
      top: fromRect.top + fromRect.height / 2,
      transitionMs: 0,
    }
    cleanupTimer = setTimeout(() => {
      if (!cleanupAnimation) return
      cleanupAnimation = {
        ...cleanupAnimation,
        phase: 'move',
        left: toRect.left + toRect.width / 2,
        top: toRect.top + toRect.height / 2,
        transitionMs: CLEANUP_MOVE_MS,
      }
      cleanupTimer = setTimeout(processNextCleanupItem, CLEANUP_MOVE_MS)
    }, CLEANUP_GATHER_MS)
  }
```

- [ ] **Step 5: 得点内訳アニメーション完了時、Wave終了理由が`'target'`なら片付けアニメーションを開始するようにする**

`startScoreReveal`関数内、パーツが0件の早期リターン部分:

```ts
  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      return
    }
```

を以下に変更する:

```ts
  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      onScoreRevealDone?.()
      if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
      return
    }
```

`finishScoreReveal`関数(現状):

```ts
  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
    onScoreRevealDone?.()
  }
```

を以下に変更する:

```ts
  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
    onScoreRevealDone?.()
    if (wave.status === 'ended' && wave.endReason === 'target') startCleanupAnimation()
  }
```

- [ ] **Step 6: 場札・チェーン・捨て札の表示を、片付けアニメーション中は非表示にする**

場札の各カードの`class`属性(`isAnimatingThisCard`によって`invisible`を切り替えている箇所)を確認する。現在:

```svelte
          {@const isTop = ri === col.length - 1}
          {@const isExposedByAnimation = playingAnimation !== null && playingAnimation.colIndex === ci && ri === col.length - 2}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard ? 'invisible' : ''}"
```

これを以下に変更する(`isCleaningUpThisColumn`という新しい`@const`を追加し、`invisible`判定に含める):

```svelte
          {@const isTop = ri === col.length - 1}
          {@const isExposedByAnimation = playingAnimation !== null && playingAnimation.colIndex === ci && ri === col.length - 2}
          {@const isSelectable = columnTargetMode ? isTop : (isTop || wave.playFromAnywhereActiveThisWave)}
          {@const isAnimatingThisCard = playingAnimation?.colIndex === ci && playingAnimation?.rowIndex === ri}
          {@const isCleaningUpThisColumn = cleanupAnimation?.kind === 'column' && cleanupAnimation.columnIndex === ci}
          <div
            class="absolute left-0 right-0 {dropTarget && dropTarget !== 'stockTop' && dropTarget.col === ci && dropTarget.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''} {isAnimatingThisCard || isCleaningUpThisColumn ? 'invisible' : ''}"
```

チェーンエリアの`<div bind:this={chainAreaEl} class="overflow-x-auto min-w-0">`(Task 1で山札ボタンをラッパーに変更した際、この行自体は変更していない)を、以下に変更する:

```svelte
  <div bind:this={chainAreaEl} class="overflow-x-auto min-w-0 {cleanupAnimation?.kind === 'chain' ? 'invisible' : ''}">
```

捨て札表示(Task 1で追加した`{#if wave.discardPile.length > 0}` ブロック)を、以下に変更する(片付けアニメーションで捨て札を処理中は非表示にする):

```svelte
    {#if wave.discardPile.length > 0 && cleanupAnimation?.kind !== 'discard'}
      <div bind:this={discardPileEl} class="w-10">
        <CardFace card={wave.discardPile[wave.discardPile.length - 1]} covered={false} />
      </div>
    {/if}
```

- [ ] **Step 7: 操作ロック条件に`cleanupAnimation`を追加する**

場札のカードボタンの`disabled`条件(`disabled={playingAnimation !== null || scoreReveal !== null}`)を以下に変更する:

```svelte
                disabled={playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
```

同じボタンのハイライト表示条件(`isCardPlayable && playingAnimation === null && scoreReveal === null`という部分を含む`class`属性)を以下に変更する:

```svelte
                class="block w-full text-left {columnTargetMode ? (isTargetable ? 'ring-2 ring-fuchsia-400 shadow-lg -translate-y-0.5' : '') : (isCardPlayable && playingAnimation === null && scoreReveal === null && cleanupAnimation === null ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : '')} transition-transform disabled:cursor-not-allowed"
```

山札めくりボタンの`disabled`条件(`disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null}`)を以下に変更する:

```svelte
      disabled={wave.stock.length === 0 || !allowDraw || playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null}
```

秘儀ボタンの`usable`計算(`{@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null}`)を以下に変更する:

```svelte
      {@const usable = canUseRite(params, wave, riteId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
```

天啓ボタンの`usable`計算(`{@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null}`)を以下に変更する:

```svelte
      {@const usable = canUseRevelation(params, wave, revelationId) && playingAnimation === null && scoreReveal === null && cleanupAnimation === null}
```

- [ ] **Step 8: 片付けアニメーションのオーバーレイを追加する**

ファイル末尾、パーツ拡大移動オーバーレイ(`{#if partFlyIn} ... {/if}`)の直後に、以下を追加する:

```svelte
{#if cleanupAnimation}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{cleanupAnimation.left}px; top:{cleanupAnimation.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{cleanupAnimation.transitionMs}ms;"
  >
    <CardFace card={cleanupAnimation.card} covered={false} />
  </div>
{/if}
```

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`・`+page.svelte`に関するエラーが0件(既存の無関係な警告・他ファイルのエラーは無視してよい)。Task 2 Step 3で確認した`onCleanupDone`未定義エラーがこの時点で解消されていることを確認する。

- [ ] **Step 10: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: Waveクリア後に場札・チェーン・捨て札を山札へ片付けるアニメーションを追加"
```

---

### Task 4: ビルド・型チェック・ブラウザでの動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体ビルドを実行する**

Run: `npm run build`
Expected: `✓ built` で成功終了

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件(他ツールの既存エラー・警告は無視)

- [ ] **Step 3: 全体のユニットテストを実行する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS(このタスクではロジック側のテストは変更していないため、既存件数のまま通ること)

- [ ] **Step 4: devサーバーを起動しブラウザで確認する**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:
- 通常プレイ中、山札ボタンの下に捨て札の一番上のカードが表示されること(コンボリセットが発生し`discardPile`にカードが積まれた後)
- SCOREがTARGETに到達しWaveクリアが確定すると、得点内訳アニメーション完了後、`clearDelayMs`の固定待機なしに、すぐ片付けアニメーションが始まること
- 場札の各列が左から右へ順番に、1つの山にまとまってから山札の位置へ移動して消えること
- 場札の全列が終わった後、チェーンのカードが同様に山札へ移動すること
- チェーンが終わった後、捨て札がある場合は同様に山札へ移動すること(捨て札が空の場合はスキップされ、チェーンの直後に画面遷移すること)
- 片付けアニメーション中は場札・山札・秘儀・天啓のいずれもクリックできないこと
- 片付けアニメーションが全て完了した後に、画面遷移(ショップ画面等)が発生すること
- 手詰まりや全消しによるWave終了時は、従来通り(片付けアニメーションなしで即座に)画面遷移すること(このケースの挙動が変わっていないことを確認する)
- 複数回連続でWaveをクリアしても、アニメーションや表示が壊れずに繰り返し動作すること

- [ ] **Step 5: 問題があれば修正し、再度Step 1-4を実行する。問題なければ完了**

---

## Self-Review メモ(実装者は読み飛ばしてよい)

- spec要件「捨て札の常設UI追加」は Task 1 でカバーしている。
- spec要件「Waveクリア確定後、画面遷移前に片付けアニメーションを挟む」「`clearDelayMs`待機の廃止」は Task 2 でカバーしている。
- spec要件「場札の各列を左から右へ、1山にまとめてから山札へ移動」「チェーンも同様」「捨て札は既に1山なので移動のみ」「空の列・チェーン・捨て札はスキップ」は Task 3 Step 4 の`startCleanupAnimation`(`columnItems`の`filter`で空列を除外、`chainItems`/`discardItems`の`length > 0`チェック)でカバーしている。
- spec要件「操作ロック」は Task 3 Step 7 でカバーしている。
- spec要件「手詰まり・全消しは対象外」は Task 2 Step 1(`endReason === 'target'`のときのみ分岐を変更し、それ以外は`delay=0`で即座に`resolveWaveEnd`という既存動作をそのまま維持)でカバーしている。
- spec要件「既存アニメーションと同じ設計パターンの踏襲」は Task 3 全体(`setTimeout`フェーズ制御・`getBoundingClientRect`・`position:fixed`オーバーレイ)でカバーしている。
