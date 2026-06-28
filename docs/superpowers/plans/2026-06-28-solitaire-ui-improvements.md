# Solitaire UI改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ソリティアUIのカードビジュアル統一・操作性改善（ドラッグ・ダブルクリック・ヒント修正）・TOP10スコア保存を実装する

**Architecture:** 変更はすべて `src/routes/game/solitaire/+page.svelte` のみ。エンジン（engine.ts）は変更しない。Svelte 5 runes ($state) + Pointer Events API でドラッグを実装。

**Tech Stack:** SvelteKit 5、Svelte 5 runes、TypeScript、Tailwind CSS v3

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/routes/game/solitaire/+page.svelte` | 全6タスクの変更（330行→約550行） |

---

## Task 1: カードビジュアル改善（比率統一・裏面デザイン・山札積み重ね）

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

- [ ] **Step 1: script に定数とヘルパー関数を追加する**

`onMount` の行の直前（`onMount(() => ...` の前）に以下を追加する：

```typescript
  // ---- カードビジュアル ----
  const CARD_BACK_STYLE =
    'background:#0f172a;' +
    'background-image:' +
    'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px),' +
    'repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px);'

  function stockLayers(): number {
    if (state.stock.length === 0) return 0
    if (state.stock.length <= 10) return 1
    if (state.stock.length <= 20) return 2
    return 3
  }
```

- [ ] **Step 2: カード高さを h-24(96px) → h-[98px] に変更する**

以下の3箇所を変更する：

**変更1** — 山札ボタン（stock）の `h-24` を変更：
```svelte
<!-- 変更前 -->
class="w-16 h-24 rounded-lg border-2 border-green-600 bg-green-900 flex items-center justify-center text-2xl hover:bg-green-700 transition-colors"

<!-- 変更後 -->
class="w-16 h-[98px] rounded-lg border-2 border-green-600 bg-green-900 flex items-center justify-center text-2xl hover:bg-green-700 transition-colors"
```

**変更2** — 捨て札ボタン（waste）の `h-24` を変更：
```svelte
<!-- 変更前 -->
class="w-16 h-24 rounded-lg border-2 transition-colors relative overflow-hidden"

<!-- 変更後 -->
class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
```

**変更3** — 組札ボタン（foundation×4）の `h-24` を変更：
```svelte
<!-- 変更前 -->
class="w-16 h-24 rounded-lg border-2 transition-colors flex items-center justify-center"

<!-- 変更後 -->
class="w-16 h-[98px] rounded-lg border-2 transition-colors flex items-center justify-center"
```

**変更4** — タブローカードの高さ（style属性内の `96` を `98` に）：
```svelte
<!-- 変更前 -->
style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 96 : 28}px; z-index: {cardIdx + 1};"

<!-- 変更後 -->
style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 98 : 28}px; z-index: {cardIdx + 1};"
```

- [ ] **Step 3: 山札を裏面積み重ね表示に変更する**

山札ボタン（stock button）の中身を以下に全置換する：

```svelte
      <!-- 山札 -->
      <button
        onclick={handleStockClick}
        class="w-16 h-[98px] rounded-lg border-2 border-green-600 bg-green-900 relative hover:bg-green-700 transition-colors flex items-center justify-center"
      >
        {#if state.stock.length > 0}
          {#each { length: stockLayers() } as _, i}
            <div
              class="absolute w-14 h-[90px] rounded-md border border-indigo-500/50"
              style="{CARD_BACK_STYLE} top:{(stockLayers() - 1 - i) * 2 + 4}px; left:{(stockLayers() - 1 - i) * 2 + 4}px;"
            ></div>
          {/each}
        {:else}
          <span class="text-green-500 text-lg relative z-10">↺</span>
        {/if}
      </button>
```

- [ ] **Step 4: タブロー裏面カードのデザインを新スタイルに変更する**

タブロー内の `{:else}` ブロック（裏面カード描画部分）を以下に置換する：

```svelte
              {:else}
                <div class="h-full rounded-lg border border-indigo-500/50"
                  style="{CARD_BACK_STYLE}">
                </div>
```

- [ ] **Step 5: ビルドを確認する**

```bash
npm run build
```

期待出力: エラーなし

- [ ] **Step 6: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: カード比率統一・裏面デザイン変更・山札積み重ね表示"
```

---

## Task 2: 選択中カードのビジュアル改善（青リング）

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

- [ ] **Step 1: タブローカードの選択ハイライトを青リングに変更する**

タブローカード buttons の class を以下に変更する。現在の4つの `class:border-*` / `class:shadow-*` ブロックをまとめて置換する：

```svelte
            <button
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 98 : 28}px; z-index: {cardIdx + 1};"
              class:ring-2={
                (isHintedFrom('tableau', colIdx) && cardIdx === col.findIndex(c => c.faceUp)) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={isHintedFrom('tableau', colIdx) && cardIdx === col.findIndex(c => c.faceUp) && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
            >
```

- [ ] **Step 2: 捨て札（waste）の選択ハイライトを青リングに変更する**

捨て札ボタンの class を変更する：

```svelte
      <!-- 捨て札 -->
      <button
        onclick={() => handleCardClick('waste', 0)}
        class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
        class:border-yellow-400={isHintedFrom('waste', 0)}
        class:ring-2={isSelected('waste', 0)}
        class:ring-blue-400={isSelected('waste', 0)}
        class:border-green-600={!isHintedFrom('waste', 0) && !isSelected('waste', 0)}
        class:bg-green-900={state.waste.length === 0}
      >
```

- [ ] **Step 3: 組札（foundation）の選択ハイライトを青リングに変更する**

組札ボタンの class を変更する：

```svelte
        <button
          onclick={() => handleCardClick('foundation', i)}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors flex items-center justify-center"
          class:ring-2={isSelected('foundation', i)}
          class:ring-blue-400={isSelected('foundation', i)}
          class:border-yellow-400={isHintedFrom('foundation', i)}
          class:border-green-600={!isSelected('foundation', i) && !isHintedFrom('foundation', i)}
          class:bg-green-700={state.foundation[i].length === 0}
          class:bg-white={state.foundation[i].length > 0}
        >
```

- [ ] **Step 4: ビルドを確認する**

```bash
npm run build
```

期待出力: エラーなし

- [ ] **Step 5: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: 選択中カードを青リング表示に変更"
```

---

## Task 3: ダブルクリック → Foundation自動移動

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

- [ ] **Step 1: handleDoubleClick 関数を script に追加する**

`handleCardClick` 関数の直後に追加する：

```typescript
  function handleDoubleClick(
    pile: 'tableau' | 'waste',
    pileIndex: number,
    cardIndex?: number
  ) {
    ensureStarted()
    const hint = getHints(state).find(h =>
      h.from.pile === pile &&
      h.from.index === pileIndex &&
      h.to.pile === 'foundation' &&
      (pile !== 'tableau' || (cardIndex !== undefined && cardIndex === state.tableau[pileIndex].length - 1))
    )
    if (!hint) return
    state = moveCards(state, hint)
    selected = null
    showHints = false
    checkAfterMove()
  }
```

- [ ] **Step 2: タブロー表向きカードに ondblclick を追加する**

タブローカードの button に `ondblclick` を追加する：

```svelte
            <button
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={() => card.faceUp ? handleDoubleClick('tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              ...
```

- [ ] **Step 3: 捨て札トップカードに ondblclick を追加する**

捨て札ボタンに `ondblclick` を追加する：

```svelte
      <button
        onclick={() => handleCardClick('waste', 0)}
        ondblclick={() => state.waste.length > 0 ? handleDoubleClick('waste', 0) : undefined}
        class="w-16 h-[98px] ..."
```

- [ ] **Step 4: ビルドを確認する**

```bash
npm run build
```

期待出力: エラーなし

- [ ] **Step 5: 動作確認する**

```bash
npm run dev
```

`http://localhost:5173/game/solitaire` を開き：
- Aをダブルクリック → 組札に移動することを確認
- 置けないカードをダブルクリック → 何も起きないことを確認

- [ ] **Step 6: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: ダブルクリックでfoundationへ自動移動"
```

---

## Task 4: ヒントのバグ修正（3件）

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

### バグ1: hintIndex のズレ（初回クリックでhint[1]が表示される）
### バグ2: タブローのハイライト対象カードが間違い
### バグ3: Foundation のヒントハイライト未実装

- [ ] **Step 1: handleHint を修正する**

`handleHint` 関数を以下に置換する：

```typescript
  function handleHint() {
    if (showHints && hints.length > 0) {
      hintIndex = (hintIndex + 1) % hints.length
      return
    }
    const h = getHints(state)
    if (h.length === 0) return
    hints = h
    showHints = true
    hintIndex = 0
  }
```

- [ ] **Step 2: currentHint ヘルパー関数を追加する**

`isHintedFrom` 関数を以下の2関数に置換する（`isHintedFrom` は削除して `currentHint` に一本化）：

```typescript
  function currentHint(): Move | null {
    if (!showHints || hints.length === 0) return null
    return hints[hintIndex % hints.length]
  }

  function isSelected(pile: 'tableau' | 'waste' | 'foundation', index: number): boolean {
    return selected?.pile === pile && selected?.index === index
  }
```

- [ ] **Step 3: タブローカードのハイライト条件を修正する**

タブローカード button の `class:ring-*` 条件を以下に変更する：

```svelte
            {@const hint = currentHint()}
            <button
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={() => card.faceUp ? handleDoubleClick('tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 98 : 28}px; z-index: {cardIdx + 1};"
              class:ring-2={
                (hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
            >
```

注意: `{@const hint = currentHint()}` は `{#each col as card, cardIdx (cardIdx)}` ブロックの中、`<button>` の直前に置く。

- [ ] **Step 4: 捨て札のヒントハイライトを修正する**

捨て札ボタンを以下に変更する（`isHintedFrom` → `currentHint()` を使うように）：

```svelte
      <!-- 捨て札 -->
      <button
        onclick={() => handleCardClick('waste', 0)}
        ondblclick={() => state.waste.length > 0 ? handleDoubleClick('waste', 0) : undefined}
        class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
        class:border-yellow-400={currentHint()?.from.pile === 'waste'}
        class:ring-2={isSelected('waste', 0)}
        class:ring-blue-400={isSelected('waste', 0)}
        class:border-green-600={currentHint()?.from.pile !== 'waste' && !isSelected('waste', 0)}
        class:bg-green-900={state.waste.length === 0}
      >
```

- [ ] **Step 5: 組札のヒントハイライトを追加する**

組札ボタンを以下に変更する：

```svelte
        <button
          onclick={() => handleCardClick('foundation', i)}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors flex items-center justify-center"
          class:ring-2={isSelected('foundation', i) || (currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i)}
          class:ring-blue-400={isSelected('foundation', i)}
          class:ring-yellow-400={currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i && !isSelected('foundation', i)}
          class:border-green-600={!isSelected('foundation', i) && !(currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i)}
          class:bg-green-700={state.foundation[i].length === 0}
          class:bg-white={state.foundation[i].length > 0}
        >
```

- [ ] **Step 6: ビルドを確認する**

```bash
npm run build
```

期待出力: エラーなし

- [ ] **Step 7: 動作確認する**

```bash
npm run dev
```

`http://localhost:5173/game/solitaire` を開き：
- 💡 ヒントボタンを押す → 移動可能カードに黄色リングが表示されることを確認
- 再度押す → 次のヒントに進むことを確認
- カードをクリック → ヒントが消えることを確認

- [ ] **Step 8: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "fix: ヒントのhintIndexズレ・ハイライト対象・foundation未対応を修正"
```

---

## Task 5: ドラッグ＆ドロップ（Pointer Events）

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

- [ ] **Step 1: ドラッグ用の状態変数と型を script 先頭に追加する**

`import` ブロックの直後（`// ---- 状態 ----` の前）に追加する：

```typescript
  // ---- ドラッグ型 ----
  interface DragInfo {
    pile: 'tableau' | 'waste' | 'foundation'
    pileIndex: number
    cardIndex: number | undefined
    count: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }
```

`// ---- 状態 ----` ブロック内の既存変数の後に追加する：

```typescript
  let dragInfo = $state<DragInfo | null>(null)
  let dropTarget = $state<{ pile: 'tableau' | 'foundation'; index: number } | null>(null)
```

- [ ] **Step 2: ドラッグ用の関数を script に追加する**

`checkAfterMove` 関数の直後に追加する：

```typescript
  // ---- ドラッグ操作 ----
  function getDragCards(): import('$lib/game/solitaire/types').Card[] {
    if (!dragInfo) return []
    if (dragInfo.pile === 'waste') return state.waste.slice(-1)
    if (dragInfo.pile === 'foundation') return [state.foundation[dragInfo.pileIndex].at(-1)!]
    const col = state.tableau[dragInfo.pileIndex]
    return col.slice(col.length - dragInfo.count)
  }

  function updateDropTarget(x: number, y: number) {
    if (!dragInfo) return
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const target = (el as HTMLElement).closest?.('[data-pile]') as HTMLElement | null
      if (!target) continue
      const pile = target.dataset.pile as 'tableau' | 'foundation'
      const index = parseInt(target.dataset.pileIndex ?? '0')
      const move: Move = {
        from: { pile: dragInfo.pile, index: dragInfo.pileIndex },
        to: { pile, index },
        count: dragInfo.count,
      }
      if (moveCards(state, move) !== state) {
        dropTarget = { pile, index }
      } else {
        dropTarget = null
      }
      return
    }
    dropTarget = null
  }

  function onCardPointerDown(
    e: PointerEvent,
    pile: 'tableau' | 'waste' | 'foundation',
    pileIndex: number,
    cardIndex?: number
  ) {
    e.preventDefault()
    let count = 1
    if (pile === 'tableau') {
      if (cardIndex === undefined) return
      const col = state.tableau[pileIndex]
      if (!col[cardIndex]?.faceUp) return
      count = col.length - cardIndex
    } else if (pile === 'waste') {
      if (state.waste.length === 0) return
    } else {
      if (state.foundation[pileIndex].length === 0) return
    }
    dragInfo = {
      pile,
      pileIndex,
      cardIndex,
      count,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }
```

- [ ] **Step 3: onMount を更新してポインターイベントリスナーを追加する**

現在の `onMount` の行：

```typescript
  onMount(() => () => { stopTimer(); if (autoInterval) clearInterval(autoInterval) })
```

を以下に置換する：

```typescript
  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return
      dragInfo = { ...dragInfo, currentX: e.clientX, currentY: e.clientY }
      const dx = e.clientX - dragInfo.startX
      const dy = e.clientY - dragInfo.startY
      if (!dragInfo.isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        dragInfo = { ...dragInfo, isDragging: true }
      }
      if (dragInfo.isDragging) updateDropTarget(e.clientX, e.clientY)
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragInfo || e.pointerId !== dragInfo.pointerId) return
      if (dragInfo.isDragging) {
        if (dropTarget) {
          const move: Move = {
            from: { pile: dragInfo.pile, index: dragInfo.pileIndex },
            to: { pile: dropTarget.pile, index: dropTarget.index },
            count: dragInfo.count,
          }
          const next = moveCards(state, move)
          if (next !== state) {
            state = next
            selected = null
            showHints = false
            checkAfterMove()
          }
        }
      } else {
        handleCardClick(dragInfo.pile, dragInfo.pileIndex, dragInfo.cardIndex)
      }
      dragInfo = null
      dropTarget = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      stopTimer()
      if (autoInterval) clearInterval(autoInterval)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
```

- [ ] **Step 4: タブロー列コンテナに data 属性とドロップ表示を追加する**

タブロー列の外側 `div` を以下に変更する：

```svelte
      {#each state.tableau as col, colIdx (colIdx)}
        <div
          class="flex-1 relative"
          data-pile="tableau"
          data-pile-index={colIdx}
          style="min-height: {Math.max(98, col.length * 28 + 70)}px;"
        >
          <!-- 空列クリック領域 -->
          <button
            onclick={() => { if (selected !== null) handleCardClick('tableau', colIdx) }}
            class="absolute inset-0 rounded-lg border-2 z-0 transition-colors"
            class:border-blue-400={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-dashed={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-green-600={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            class:border-dotted={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            aria-label="列{colIdx + 1}"
          ></button>
```

- [ ] **Step 5: タブローカードに onpointerdown を追加し、ドラッグ中は半透明にする**

タブローカードの button を以下の完全なコードに置換する（`{@const hint = currentHint()}` を button の直前に置く）：

```svelte
            {@const hint = currentHint()}
            <button
              onpointerdown={(e) => onCardPointerDown(e, 'tableau', colIdx, cardIdx)}
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={() => card.faceUp ? handleDoubleClick('tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 98 : 28}px; z-index: {cardIdx + 1}; opacity: {dragInfo?.isDragging && dragInfo.pile === 'tableau' && dragInfo.pileIndex === colIdx && cardIdx >= col.length - dragInfo.count ? 0.4 : 1};"
              class:ring-2={
                (hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
            >
```

- [ ] **Step 6: 捨て札・組札に onpointerdown と data 属性を追加する**

捨て札ボタンに追加：
```svelte
        onpointerdown={(e) => onCardPointerDown(e, 'waste', 0)}
```

組札ボタンに追加（`{#each FOUNDATION_SUIT as suit, i (suit)}` ブロック内）：
```svelte
          onpointerdown={(e) => onCardPointerDown(e, 'foundation', i)}
          data-pile="foundation"
          data-pile-index={i}
          class:border-blue-400={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
          class:border-dashed={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
```

- [ ] **Step 7: ドラッグゴースト要素をテンプレート末尾に追加する**

`<!-- 勝利モーダル -->` ブロックの直前に追加する：

```svelte
  <!-- ドラッグゴースト -->
  {#if dragInfo?.isDragging}
    <div
      class="pointer-events-none fixed z-[200]"
      style="left:{dragInfo.currentX - 32}px; top:{dragInfo.currentY - 20}px;"
    >
      {#each getDragCards() as card, i (i)}
        <div
          class="absolute w-16 bg-white rounded-lg border border-slate-200 p-1 flex flex-col shadow-2xl"
          style="top:{i * 28}px; height:{i === getDragCards().length - 1 ? 98 : 28}px; opacity:0.9;"
        >
          <span class="text-xs font-bold leading-none {SUIT_COLOR[card.suit]}">{rankLabel(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
          {#if i === getDragCards().length - 1}
            <span class="text-2xl flex-1 flex items-center justify-center {SUIT_COLOR[card.suit]}">{SUIT_SYMBOL[card.suit]}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
```

- [ ] **Step 8: ビルドを確認する**

```bash
npm run build
```

TypeScript エラーが出た場合の対処：
- `Card` 型のインポートエラー → `import type { GameState, Move, Card } from '$lib/game/solitaire/types'` に変更
- `closest` の型エラー → `(el as HTMLElement).closest?.('[data-pile]') as HTMLElement | null` の `?.` を確認

- [ ] **Step 9: 動作確認する**

```bash
npm run dev
```

`http://localhost:5173/game/solitaire` を開き：
- カードをドラッグ → ゴーストがカーソルに追従することを確認
- 有効な移動先にホバー → 点線の青い枠が表示されることを確認
- 有効な移動先でドロップ → カードが移動することを確認
- 5px以内の動き後に離す → クリックとして処理されることを確認
- 複数枚（表向きの積み重ね）をドラッグ → まとめて移動できることを確認

- [ ] **Step 10: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: Pointer Eventsによるドラッグ＆ドロップを実装"
```

---

## Task 6: TOP10スコア（localStorage・常時表示）

**Files:**
- Modify: `src/routes/game/solitaire/+page.svelte`

- [ ] **Step 1: ScoreEntry 型と localStorage 関数を script に追加する**

`import` 行の直後（型インポートの後）に追加する：

```typescript
  // ---- TOP10スコア型 ----
  interface ScoreEntry {
    score: number
    elapsed: number
    drawMode: 1 | 3
    date: string
  }
```

`// ---- 状態 ----` ブロック内の既存変数の後に追加する：

```typescript
  let top10 = $state<ScoreEntry[]>(loadTop10())
  let clearRank = $state(0)
```

`checkAfterMove` 関数の直前に追加する：

```typescript
  function loadTop10(): ScoreEntry[] {
    try {
      return JSON.parse(localStorage.getItem('solitaire-top10') ?? '[]') as ScoreEntry[]
    } catch {
      return []
    }
  }

  function saveToTop10(score: number, elapsed: number, drawMode: 1 | 3): number {
    const entries = loadTop10()
    const newEntry: ScoreEntry = {
      score,
      elapsed,
      drawMode,
      date: new Date().toISOString().slice(0, 10),
    }
    entries.push(newEntry)
    entries.sort((a, b) => b.score - a.score || a.elapsed - b.elapsed)
    const ranked = entries.slice(0, 10)
    const rank = ranked.findIndex(e => e === newEntry) + 1
    localStorage.setItem('solitaire-top10', JSON.stringify(ranked))
    top10 = ranked
    return rank > 0 ? rank : 0
  }
```

- [ ] **Step 2: checkAfterMove でスコアを保存するように変更する**

`checkAfterMove` 関数を以下に置換する：

```typescript
  function checkAfterMove() {
    if (isVictory(state)) {
      stopTimer()
      clearRank = saveToTop10(state.score, state.elapsed, state.drawMode)
      showVictory = true
      return
    }
    if (!autoCompleting && canAutoComplete(state)) startAutoComplete()
  }
```

- [ ] **Step 3: 勝利モーダルに順位を追加する**

勝利モーダルの `<h2>クリア！</h2>` の直下に追加する：

```svelte
        {#if clearRank > 0}
          <p class="text-amber-500 font-bold text-lg mb-2">🏆 {clearRank}位入り！</p>
        {/if}
```

- [ ] **Step 4: ゲームエリア下に TOP10 テーブルを追加する**

`<!-- 勝利モーダル -->` ブロックの直前に追加する：

```svelte
  <!-- TOP10スコア -->
  <div class="mt-2 border border-slate-200 rounded-lg overflow-hidden">
    <div class="bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🏆 TOP 10</div>
    {#if top10.length === 0}
      <p class="text-xs text-slate-400 px-3 py-3">まだ記録がありません。クリアして登録しよう！</p>
    {:else}
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-2 py-1 text-left text-slate-500 font-medium">#</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">スコア</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">タイム</th>
            <th class="px-2 py-1 text-center text-slate-500 font-medium">ドロー</th>
            <th class="px-2 py-1 text-right text-slate-500 font-medium">日付</th>
          </tr>
        </thead>
        <tbody>
          {#each top10 as entry, i (i)}
            <tr
              class="border-b border-slate-100 last:border-0"
              class:bg-amber-50={i + 1 === clearRank}
            >
              <td class="px-2 py-1.5 font-mono text-slate-600">{i + 1}</td>
              <td class="px-2 py-1.5 text-right font-mono font-bold text-emerald-600">{entry.score}pt</td>
              <td class="px-2 py-1.5 text-right font-mono text-slate-600">{formatTime(entry.elapsed)}</td>
              <td class="px-2 py-1.5 text-center text-slate-500">{entry.drawMode}枚</td>
              <td class="px-2 py-1.5 text-right text-slate-500">{entry.date.slice(5).replace('-', '/')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
```

- [ ] **Step 5: ビルドを確認する**

```bash
npm run build
```

期待出力: エラーなし

- [ ] **Step 6: 動作確認する**

```bash
npm run dev
```

`http://localhost:5173/game/solitaire` を開き：
- ゲームエリア下にTOP10テーブルが表示されることを確認（初期は「まだ記録がありません」）
- ゲームをクリアする → テーブルにエントリが追加されることを確認
- 再読み込み後もスコアが残っていることを確認
- 勝利モーダルに順位（「🏆 1位入り！」など）が表示されることを確認

- [ ] **Step 7: コミットする**

```bash
git add src/routes/game/solitaire/+page.svelte
git commit -m "feat: TOP10スコアをlocalStorageに保存し常時表示"
```

---

## 最終確認

- [ ] `npm run build` がエラーなし
- [ ] `npm run dev` でブラウザ動作確認:
  - カード比率・裏面デザインが正しい
  - 山札が積み重ね表示になっている
  - 選択中カードが青リングで表示される
  - ドラッグでカードが移動できる
  - ドロップ先に点線枠が表示される
  - ダブルクリックでfoundationに自動移動できる
  - ヒントが正しいカードをハイライトする
  - TOP10テーブルが常時表示され、クリアすると更新される
