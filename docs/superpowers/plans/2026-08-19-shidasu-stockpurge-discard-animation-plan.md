# 大量放出・少量放出の裏向き移動→フリップ演出 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 星の妨害行動「大量放出」(`stockPurge`)・「少量放出」(`stockPurgeSmall`)が山札から捨て札へカードを移動させる際、裏向きで山札から捨て札へ個別に飛ばし、着地後に捨て札が通常(表向き)ならフリップ演出で表向きに、捨て札埋没等で裏向きのままなら据え置く演出を実装する。

**Architecture:** `stockPurge`/`stockPurgeSmall`が移動させるカードの表裏を捨て札の現在の状態から継承させ(データモデル)、`WaveState.lastSabotage`に移動枚数を明示的に伝える(トリガー検知、前回の`affectedCols`と同じ設計方針)。`PlayArea.svelte`側は、山札位置から捨て札位置へ個別のカードを飛ばす新規アニメーション関数と、捨て札専用の単純なフリップ状態(前回実装した場札のフリップ`flippingCards`の捨て札版、複数列を扱う配列ではなく単一state)を実装する。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-19-shidasu-stockpurge-discard-animation-design.md`

---

## Task 1: `applyStockPurge`/`applyStockPurgeSmall`が捨て札の現在の状態を継承し、移動枚数を返すようにする

**Files:**
- Modify: `src/lib/game/shidasu/sabotageEffects.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `SabotageResult`に`purgedToDiscardCount`を追加する**

`src/lib/game/shidasu/sabotageEffects.ts`内、以下のブロック(`grep -n "export interface SabotageResult"`で位置を特定できる):

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  // 今回のトリガーで実際に再配布された場札の列インデックス。裏向き配布アニメーション
  // (PlayArea.svelte)が対象列を特定するために使う。wave側のCard.faceUpフラグは
  // 過去の別トリガーで裏向きのまま残っているカードとも区別が付かないため、
  // 「今回触った列」を明示的にここで伝える。tableauFullReturn/columnReturn以外は未設定でよい。
  affectedTableauCols?: number[]
}
```

を以下に置き換える:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  // 今回のトリガーで実際に再配布された場札の列インデックス。裏向き配布アニメーション
  // (PlayArea.svelte)が対象列を特定するために使う。wave側のCard.faceUpフラグは
  // 過去の別トリガーで裏向きのまま残っているカードとも区別が付かないため、
  // 「今回触った列」を明示的にここで伝える。tableauFullReturn/columnReturn以外は未設定でよい。
  affectedTableauCols?: number[]
  // 今回「大量放出」「少量放出」で山札から捨て札へ移動した枚数。裏向き移動アニメーション
  // (PlayArea.svelte)が対象枚数を特定するために使う。stockPurge/stockPurgeSmall以外は未設定でよい。
  purgedToDiscardCount?: number
}
```

- [ ] **Step 2: `applyStockPurge`が捨て札の状態を継承し移動枚数を返すようにする**

同ファイル内、以下のブロック(`grep -n "function applyStockPurge"`で位置を特定できる):

```ts
function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}
```

を以下に置き換える:

```ts
function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const discardIsHidden = wave.discardPile[wave.discardPile.length - 1]?.faceUp === false
  const purged = wave.stock.slice(wave.stock.length - n).map(c => (discardIsHidden ? { ...c, faceUp: false } : c))
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }, purgedToDiscardCount: n }
}
```

- [ ] **Step 3: `applyStockPurgeSmall`も同様に修正する**

同ファイル内、以下のブロック(`grep -n "function applyStockPurgeSmall"`で位置を特定できる):

```ts
function applyStockPurgeSmall({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(2, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}
```

を以下に置き換える:

```ts
function applyStockPurgeSmall({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(2, wave.stock.length)
  const discardIsHidden = wave.discardPile[wave.discardPile.length - 1]?.faceUp === false
  const purged = wave.stock.slice(wave.stock.length - n).map(c => (discardIsHidden ? { ...c, faceUp: false } : c))
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] }, purgedToDiscardCount: n }
}
```

- [ ] **Step 4: `stockPurge`のテストに`faceUp`継承・`purgedToDiscardCount`の検証を追加する**

`src/lib/game/shidasu/engine.test.ts`内、以下のテスト(`grep -n "stockPurge: 山札の上から5枚を捨て札に置く"`で位置を特定できる)の直後に、新しいテストを2件追加する:

```ts
  it('stockPurge: 捨て札が通常(表向き)のとき、移動したカードはfaceUpが設定されずlastSabotage.purgedToDiscardCountが5になる', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', () => 0)
    const movedCards = next.wave!.discardPile.slice(-5)
    expect(movedCards.every(c => c.faceUp !== false)).toBe(true)
    expect(next.wave!.lastSabotage?.purgedToDiscardCount).toBe(5)
  })

  it('stockPurge: 捨て札が裏向き(捨て札埋没後)のとき、移動したカードもfaceUp:falseを継承する', () => {
    const discardPile: Card[] = [{ id: 900, deckId: 900, suit: '♠', rank: 5, wild: false, faceUp: false }]
    const run = runWithWave({}, { discardPile })
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', () => 0)
    const movedCards = next.wave!.discardPile.slice(-5)
    expect(movedCards.every(c => c.faceUp === false)).toBe(true)
  })
```

- [ ] **Step 5: `stockPurgeSmall`にも同様のテストを追加する**

同ファイル内、以下の既存テスト(`grep -n "stockPurgeSmall: 山札の上から2枚を捨て札に置く"`で位置を特定できる)の直後に、新しいテストを追加する:

```ts
  it('stockPurgeSmall: 山札の上から2枚を捨て札に置く', () => {
    const run = runWithWave()
    const stockBefore = run.wave!.stock.length
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurgeSmall', () => 0)
    expect(next.wave!.stock.length).toBe(stockBefore - 2)
    expect(next.wave!.discardPile.length).toBe(2)
  })
```

(このテスト自体は変更しない。この直後に以下を追加する。)

```ts
  it('stockPurgeSmall: 捨て札が通常(表向き)のとき、移動したカードはfaceUpが設定されずlastSabotage.purgedToDiscardCountが2になる', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurgeSmall', () => 0)
    const movedCards = next.wave!.discardPile.slice(-2)
    expect(movedCards.every(c => c.faceUp !== false)).toBe(true)
    expect(next.wave!.lastSabotage?.purgedToDiscardCount).toBe(2)
  })
```

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し

- [ ] **Step 7: テストを実行する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS(新規追加テストを含む)

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/sabotageEffects.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: stockPurge/stockPurgeSmallが捨て札の裏表を継承し移動枚数を返すようにする"
```

---

## Task 2: `WaveState.lastSabotage`に`purgedToDiscardCount`を追加し`triggerSabotage`で伝える

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `WaveState.lastSabotage`型に`purgedToDiscardCount`を追加する**

`src/lib/game/shidasu/types.ts`内、以下のブロック(`grep -n "lastSabotage?:"`で位置を特定できる):

```ts
  // 直近発動した妨害行動の識別情報。UI(PlayArea.svelte)がこの値の変化を検知して
  // 専用アニメーションを起動するために使う。発動のたびにseqをインクリメントし、
  // 同じIDが連続発動しても検知できるようにする。undefinedは「まだ一度も妨害が
  // 発動していない」状態を表す。affectedColsは今回のトリガーで実際に再配布された
  // 場札の列インデックス(tableauFullReturn/columnReturn以外はundefined)。
  // Card.faceUpフラグ(過去の別トリガーで裏向きのまま残っているカードとも区別が
  // 付かない)から逆算せず、ここで明示的に伝える。
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[] }
```

を以下に置き換える:

```ts
  // 直近発動した妨害行動の識別情報。UI(PlayArea.svelte)がこの値の変化を検知して
  // 専用アニメーションを起動するために使う。発動のたびにseqをインクリメントし、
  // 同じIDが連続発動しても検知できるようにする。undefinedは「まだ一度も妨害が
  // 発動していない」状態を表す。affectedColsは今回のトリガーで実際に再配布された
  // 場札の列インデックス(tableauFullReturn/columnReturn以外はundefined)。
  // purgedToDiscardCountは今回stockPurge/stockPurgeSmallで山札から捨て札へ移動した
  // 枚数(それ以外はundefined)。いずれもCard.faceUpフラグ(過去の別トリガーで
  // 裏向きのまま残っているカードとも区別が付かない)から逆算せず、ここで明示的に伝える。
  lastSabotage?: { id: SabotageActionId; seq: number; affectedCols?: number[]; purgedToDiscardCount?: number }
```

- [ ] **Step 2: `triggerSabotage`が`purgedToDiscardCount`を伝えるようにする**

`src/lib/game/shidasu/engine.ts`内、以下の行(`grep -n "lastSabotage: { id, seq:"`で位置を特定できる):

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols },
```

を以下に置き換える:

```ts
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1, affectedCols: result.affectedTableauCols, purgedToDiscardCount: result.purgedToDiscardCount },
```

- [ ] **Step 3: `lastSabotage.purgedToDiscardCount`のテストを追加する**

`src/lib/game/shidasu/engine.test.ts`内、`grep -n "triggerSabotage: 発動のたびに"`で該当テストブロックを探し、その直後に新しいテストを1件追加する:

```ts
  it('triggerSabotage: stockPurge発動時、lastSabotage.purgedToDiscardCountに移動枚数が設定される', () => {
    const run = runWithWave()
    const next = triggerSabotage(DEFAULT_PARAMS, run, 'stockPurge', () => 0)
    expect(next.wave!.lastSabotage?.purgedToDiscardCount).toBe(5)
    // 移動を伴わない妨害行動ではundefinedのまま(前のトリガーの値を引きずらない)。
    const next2 = triggerSabotage(DEFAULT_PARAMS, next, 'comboBreather', () => 0)
    expect(next2.wave!.lastSabotage?.purgedToDiscardCount).toBeUndefined()
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
git commit -m "feat: WaveState.lastSabotageにpurgedToDiscardCountを追加しtriggerSabotageで伝える"
```

---

## Task 3: 山札→捨て札の裏向き移動アニメーションとフリップ/据え置きを実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

- [ ] **Step 1: `discardPurgeCards`・`discardFlip`の状態を追加する**

`src/routes/game/shidasu/PlayArea.svelte`内、`let flippingCards = $state<FlippingCard[]>([])`の行(`grep -n "let flippingCards = "`で位置を特定できる)の直後に以下を追加する:

```ts
  // 「大量放出」「少量放出」発動時、山札から捨て札へ飛んでいくカードの状態。
  // 捨て札は常に1枚しか表示しないため、複数枚が同時に飛んでいても着地順に処理する。
  interface DiscardPurgeCard {
    card: Card
    left: number
    top: number
    transitionMs: number
  }
  let discardPurgeCards = $state<DiscardPurgeCard[]>([])
  // 大量放出・少量放出で移動したカードが通常(表向き)の場合のフリップ状態。捨て札は
  // 常に1箇所しか無いため、複数列を扱うflippingCards配列とは別に単純なstateで持つ。
  interface DiscardFlip {
    card: Card
    revealed: boolean
    rotation: number
    transitionMs: number
  }
  let discardFlip = $state<DiscardFlip | null>(null)
```

- [ ] **Step 2: `anyAnimationActive`に新規状態を含める**

同ファイル内、以下の行(`grep -n "let anyAnimationActive = "`で位置を特定できる):

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0)
```

を以下に置き換える:

```ts
  let anyAnimationActive = $derived(playingAnimation !== null || scoreReveal !== null || cleanupAnimation !== null || chainResetAnimation !== null || dealAnimationActive || sabotageRedistributeAnimation !== null || sabotageAnimatingColumns.size > 0 || flippingCards.length > 0 || discardPurgeCards.length > 0 || discardFlip !== null)
```

- [ ] **Step 3: `$effect.pre`に大量放出・少量放出の検知分岐を追加する**

同ファイル内、以下のブロック(`grep -n "let previousSabotageSeq"`で位置を特定できる):

```ts
  let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
  $effect.pre(() => {
    const current = wave.lastSabotage
    if (!current || current.seq === previousSabotageSeq) return
    previousSabotageSeq = current.seq
    if ((current.id === 'tableauFullReturn' || current.id === 'columnReturn') && current.affectedCols) {
      startSabotageRedistributeAnimation(current.affectedCols)
    }
  })
```

を以下に置き換える:

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

- [ ] **Step 4: `displayedDiscardTop`の自動追従effectに新規状態のガードを追加する**

同ファイル内、以下のブロック(`grep -n "displayedDiscardTop = wave.discardPile"`で位置を特定できる):

```ts
  $effect(() => {
    if (chainResetAnimation !== null) return
    displayedDiscardTop = wave.discardPile[wave.discardPile.length - 1]
  })
```

を以下に置き換える:

```ts
  $effect(() => {
    if (chainResetAnimation !== null || discardPurgeCards.length > 0 || discardFlip !== null) return
    displayedDiscardTop = wave.discardPile[wave.discardPile.length - 1]
  })
```

- [ ] **Step 5: `startDiscardFlipReveal`を実装する**

同ファイル内、`startFlipReveal`関数の直後(`grep -n "function startFlipReveal"`で位置を特定し、その関数の閉じ`}`の直後)に以下を追加する:

```ts

  // 大量放出・少量放出で捨て札へ移動したカードが通常(表向き)の場合に呼ぶ。捨て札位置で
  // 裏面のまま真横まで回転させ、真横で不可視になった瞬間にrevealedをtrueへ切り替えて
  // 表向きの中身に差し替え、続けて正面まで回転させる。startFlipRevealの捨て札専用版
  // (捨て札は常に1箇所しか無いため、複数列を扱うflippingCards配列ではなく単一の
  // discardFlip stateで実装する)。完了後はdisplayedDiscardTopを更新し、以後は
  // 通常の捨て札表示(既存のfaceUp={displayedDiscardTop.faceUp !== false}ルール)に
  // そのまま委ねる。
  function startDiscardFlipReveal(card: Card) {
    discardFlip = { card, revealed: false, rotation: 0, transitionMs: 0 }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        discardFlip = discardFlip ? { ...discardFlip, rotation: 90, transitionMs: FLIP_HALF_MS } : null
      })
    })

    const timer1 = setTimeout(() => {
      discardFlip = discardFlip ? { ...discardFlip, revealed: true, rotation: 90, transitionMs: 0 } : null
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          discardFlip = discardFlip ? { ...discardFlip, rotation: 0, transitionMs: FLIP_HALF_MS } : null
        })
      })
      const timer2 = setTimeout(() => {
        discardFlip = null
        displayedDiscardTop = card
      }, FLIP_HALF_MS)
      dealTimers.push(timer2)
    }, FLIP_HALF_MS)
    dealTimers.push(timer1)
  }
```

- [ ] **Step 6: `startStockPurgeAnimation`を実装する**

同ファイル内、`startDiscardFlipReveal`関数の直後に以下を追加する:

```ts

  // 「大量放出」「少量放出」発動時、山札から捨て札へcount枚を裏向きで個別に飛ばす。
  // 最後の1枚が着地したら、移動したカードのfaceUp(sabotageEffects.ts側で捨て札の
  // 現在の状態を継承して確定済み)を見て、フリップ演出(表向き)するか裏向きのまま
  // 据え置くかを決める。
  function startStockPurgeAnimation(count: number) {
    if (count <= 0 || !stockButtonEl || !discardPileEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2
    const toRect = discardPileEl.getBoundingClientRect()
    const toLeft = toRect.left + toRect.width / 2
    const toTop = toRect.top + toRect.height / 2

    const purged = wave.discardPile.slice(wave.discardPile.length - count)

    purged.forEach((card, index) => {
      const timer = setTimeout(() => {
        discardPurgeCards = [...discardPurgeCards, { card, left: fromLeft, top: fromTop, transitionMs: 0 }]

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            discardPurgeCards = discardPurgeCards.map(d => (d.card.id === card.id ? { ...d, left: toLeft, top: toTop, transitionMs: DEAL_MOVE_MS } : d))
          })
        })

        const landTimer = setTimeout(() => {
          discardPurgeCards = discardPurgeCards.filter(d => d.card.id !== card.id)
          if (index === purged.length - 1) {
            if (card.faceUp === false) {
              displayedDiscardTop = card
            } else {
              startDiscardFlipReveal(card)
            }
          }
        }, DEAL_MOVE_MS)
        dealTimers.push(landTimer)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 7: 捨て札の常設表示を、演出中は隠す**

同ファイル内、以下の行(`grep -n "bind:this={discardPileEl}"`で位置を特定できる):

```svelte
    <div bind:this={discardPileEl} class="w-16 {cleanupAnimation?.kind === 'discard' ? 'invisible' : ''}">
```

を以下に置き換える:

```svelte
    <div bind:this={discardPileEl} class="w-16 {cleanupAnimation?.kind === 'discard' || discardPurgeCards.length > 0 || discardFlip !== null ? 'invisible' : ''}">
```

- [ ] **Step 8: `discardPurgeCards`・`discardFlip`のオーバーレイをテンプレートに追加する**

同ファイル内、`{#each dealingCards as dealingCard ...}`ブロックの直後(`grep -n "{#each dealingCards as dealingCard"`で位置を特定し、対応する`{/each}`の直後)に以下を追加する:

```svelte

{#each discardPurgeCards as purgeCard (purgeCard.card.id)}
  <div
    class="fixed pointer-events-none z-[100] ease-out"
    style="left:{purgeCard.left}px; top:{purgeCard.top}px; width:64px; transform: translate(-50%, -50%); transition-property: left, top; transition-duration:{purgeCard.transitionMs}ms;"
  >
    <CardFace card={purgeCard.card} covered={false} faceUp={false} items={[]} />
  </div>
{/each}

{#if discardFlip}
  {@const pileRect = discardPileEl?.getBoundingClientRect()}
  {#if pileRect}
    <div
      class="fixed pointer-events-none z-[100] ease-out"
      style="left:{pileRect.left}px; top:{pileRect.top}px; width:{pileRect.width}px; transform: perspective(600px) rotateY({discardFlip.rotation}deg); transition-property: transform; transition-duration:{discardFlip.transitionMs}ms;"
    >
      <CardFace card={discardFlip.card} covered={false} faceUp={discardFlip.revealed} items={[]} />
    </div>
  {/if}
{/if}
```

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連のエラー無し(プロジェクト全体には`solitaire`・`hepburn-converter`・`vector3-visualizer`など今回の変更と無関係な既存の型エラーが約55件存在するが、それらは無視してよい)

- [ ] **Step 10: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(このタスクは`.svelte`ファイルのみを対象とし、エンジンロジックは変更していないため、既存テストは無修正のまま全てグリーンになるはず)

- [ ] **Step 11: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 12: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開く

- 通常(捨て札が表向き)状態で「大量放出」ボタンを押し、山札から捨て札へカードが裏向きで個別に飛んでいき、最後にフリップして表向きになる一連の流れを確認する
- 同様に「少量放出」も確認する
- 「捨て札埋没」を先に発動して捨て札を裏向きにしてから、「大量放出」または「少量放出」を発動し、移動後もフリップせず裏向きのまま据え置かれることを確認する
- 演出中は他の操作(カードプレイ・山札引き等)が無効化され、完了後は正常に操作できることを確認する

ブラウザ操作が困難な環境であれば、Step 9〜11(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 13: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 大量放出・少量放出の山札→捨て札裏向き移動アニメーションとフリップ/据え置きを実装する"
```

---

## 最終確認

全3タスク完了後:

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `npm run dev`でブラウザから、通常状態・捨て札埋没後の両方で「大量放出」「少量放出」の演出を一通り確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回の実装完了を反映する
