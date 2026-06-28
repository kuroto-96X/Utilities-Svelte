<!-- src/routes/game/solitaire/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { GameState, Move, Card } from '$lib/game/solitaire/types'
  import {
    dealInitial, drawFromStock, moveCards,
    undo, getHints, canAutoComplete, autoCompleteStep, isVictory
  } from '$lib/game/solitaire/engine'

  // ---- TOP10スコア型 ----
  interface ScoreEntry {
    score: number
    elapsed: number
    drawMode: 1 | 3
    date: string
  }

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

  // ---- 状態 ----
  let state = $state<GameState>(dealInitial(1))
  let selected = $state<{ pile: 'tableau' | 'waste' | 'foundation'; index: number; count: number } | null>(null)
  let hints = $state<Move[]>([])
  let hintIndex = $state(0)
  let showHints = $state(false)
  let showVictory = $state(false)
  let autoCompleting = $state(false)
  let pendingMode = $state<1 | 3>(1)
  let dragInfo = $state<DragInfo | null>(null)
  let dropTarget = $state<{ pile: 'tableau' | 'foundation'; index: number } | null>(null)
  let top10 = $state<ScoreEntry[]>(loadTop10())
  let clearRank = $state(0)

  // ---- タイマー ----
  let timerInterval: ReturnType<typeof setInterval> | null = null
  let gameStarted = $state(false)

  function startTimer() {
    if (timerInterval) return
    timerInterval = setInterval(() => {
      state = { ...state, elapsed: state.elapsed + 1 }
    }, 1000)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }

  // ---- オートコンプリート ----
  let autoInterval: ReturnType<typeof setInterval> | null = null

  function startAutoComplete() {
    autoCompleting = true
    autoInterval = setInterval(() => {
      state = autoCompleteStep(state)
      if (isVictory(state)) {
        clearInterval(autoInterval!); autoInterval = null
        stopTimer()
        showVictory = true
        autoCompleting = false
      }
    }, 300)
  }

  // ---- ゲーム操作 ----
  function newGame(mode: 1 | 3 = pendingMode) {
    stopTimer()
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null }
    state = dealInitial(mode)
    selected = null; hints = []; showHints = false; hintIndex = 0
    showVictory = false; autoCompleting = false; gameStarted = false; clearRank = 0
  }

  function ensureStarted() {
    if (!gameStarted) { gameStarted = true; startTimer() }
  }

  function handleStockClick() {
    ensureStarted()
    state = drawFromStock(state)
    selected = null
    checkAfterMove()
  }

  function handleCardClick(
    pile: 'tableau' | 'waste' | 'foundation',
    pileIndex: number,
    cardIndex?: number
  ) {
    ensureStarted()
    showHints = false

    if (selected === null) {
      if (pile === 'waste' && state.waste.length > 0) {
        selected = { pile: 'waste', index: 0, count: 1 }
      } else if (pile === 'tableau' && cardIndex !== undefined) {
        const col = state.tableau[pileIndex]
        if (col[cardIndex]?.faceUp) {
          selected = { pile: 'tableau', index: pileIndex, count: col.length - cardIndex }
        }
      } else if (pile === 'foundation' && state.foundation[pileIndex].length > 0) {
        selected = { pile: 'foundation', index: pileIndex, count: 1 }
      }
      return
    }

    if (pile === selected.pile && pileIndex === selected.index) {
      selected = null
      return
    }

    const move: Move = {
      from: { pile: selected.pile, index: selected.index },
      to: { pile, index: pileIndex },
      count: selected.count,
    }
    const next = moveCards(state, move)
    if (next !== state) {
      state = next
      checkAfterMove()
    }
    selected = null
  }

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

  function cardBg(rank: number): string {
    if (rank === 13) return 'bg-amber-50'
    if (rank === 12) return 'bg-rose-50'
    if (rank === 11) return 'bg-indigo-50'
    return 'bg-white'
  }

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

  function handleUndo() {
    state = undo(state)
    selected = null; showHints = false
  }

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

  function checkAfterMove() {
    if (isVictory(state)) {
      stopTimer()
      clearRank = saveToTop10(state.score, state.elapsed, state.drawMode)
      showVictory = true
      return
    }
    if (!autoCompleting && canAutoComplete(state)) startAutoComplete()
  }

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

  // ---- 表示ヘルパー ----
  function rankLabel(rank: number): string {
    if (rank === 1) return 'A'
    if (rank === 11) return 'J'
    if (rank === 12) return 'Q'
    if (rank === 13) return 'K'
    return String(rank)
  }

  const SUIT_SYMBOL: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
  const SUIT_COLOR: Record<string, string> = { spades: 'text-slate-900', hearts: 'text-red-600', diamonds: 'text-red-600', clubs: 'text-slate-900' }
  const FOUNDATION_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'] as const

  function formatTime(s: number): string {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function currentHint(): Move | null {
    if (!showHints || hints.length === 0) return null
    return hints[hintIndex % hints.length]
  }

  function isSelected(pile: 'tableau' | 'waste' | 'foundation', index: number): boolean {
    return selected?.pile === pile && selected?.index === index
  }

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
</script>

{#snippet cardFace(card: Card, full: boolean)}
  <div class="absolute inset-0 rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white">
    <div class="leading-none {SUIT_COLOR[card.suit]}">
      <div class="text-sm font-bold leading-none">{rankLabel(card.rank)}</div>
      <div class="text-xs leading-none">{SUIT_SYMBOL[card.suit]}</div>
    </div>
    {#if full}
      <div class="w-full flex-1 flex flex-col items-center justify-center {SUIT_COLOR[card.suit]}">
        <span class="text-xl font-bold leading-none">{rankLabel(card.rank)}</span>
        <span class="text-sm leading-none">{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <div class="rotate-180 self-end leading-none {SUIT_COLOR[card.suit]}">
        <div class="text-sm font-bold leading-none">{rankLabel(card.rank)}</div>
        <div class="text-xs leading-none">{SUIT_SYMBOL[card.suit]}</div>
      </div>
    {/if}
  </div>
{/snippet}

<div class="max-w-[560px] mx-auto px-4 py-4 flex flex-col gap-4">

  <!-- ツールバー -->
  <div class="flex items-center gap-3 flex-wrap">
    <span class="text-xs font-bold text-slate-500">DRAW</span>
    <div class="flex gap-1">
      {#each [1, 3] as mode (mode)}
        <button
          onclick={() => { pendingMode = mode as 1 | 3; newGame(mode as 1 | 3) }}
          class="px-3 py-1 text-xs rounded border transition-colors"
          class:bg-teal-600={state.drawMode === mode}
          class:text-white={state.drawMode === mode}
          class:border-teal-600={state.drawMode === mode}
          class:bg-white={state.drawMode !== mode}
          class:text-slate-600={state.drawMode !== mode}
          class:border-slate-300={state.drawMode !== mode}
        >{mode}枚</button>
      {/each}
    </div>
    <div class="ml-auto flex items-center gap-3">
      <span class="text-sm text-amber-600 font-mono">⏱ {formatTime(state.elapsed)}</span>
      <span class="text-sm text-emerald-600 font-mono">🏆 {state.score}pt</span>
      <button onclick={handleUndo} disabled={state.history.length === 0}
        class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50">
        ↩ アンドゥ
      </button>
      <button onclick={handleHint}
        class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
        💡 ヒント
      </button>
      <button onclick={() => newGame()}
        class="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
        ↺ 新ゲーム
      </button>
    </div>
  </div>

  <!-- ゲームエリア -->
  <div class="bg-green-800 rounded-xl p-4 select-none" style="min-height: 520px;">

    <!-- 上段: 山札・捨て札・組札 -->
    <div class="flex gap-2 mb-4">
      <!-- 山札 -->
      <button
        onclick={handleStockClick}
        class="w-16 h-[98px] rounded-lg border-2 border-green-600 bg-green-900 relative hover:bg-green-700 transition-colors flex items-center justify-center overflow-hidden"
      >
        {#if state.stock.length > 0}
          {#each { length: stockLayers() } as _, i}
            <div
              class="absolute w-14 h-[90px] rounded-md border border-indigo-500/50"
              style="{CARD_BACK_STYLE} top:{(stockLayers() - 1 - i) * 2}px; left:{(stockLayers() - 1 - i) * 2}px;"
            ></div>
          {/each}
        {:else}
          <span class="text-green-500 text-lg relative z-10">↺</span>
        {/if}
      </button>

      <!-- 捨て札 -->
      <button
        onpointerdown={(e) => onCardPointerDown(e, 'waste', 0)}
        onclick={() => handleCardClick('waste', 0)}
        ondblclick={() => state.waste.length > 0 ? handleDoubleClick('waste', 0) : undefined}
        class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
        class:border-yellow-400={currentHint()?.from.pile === 'waste'}
        class:ring-2={isSelected('waste', 0)}
        class:ring-blue-400={isSelected('waste', 0)}
        class:border-green-600={currentHint()?.from.pile !== 'waste' && !isSelected('waste', 0)}
        class:bg-green-900={state.waste.length === 0}
      >
        {#if state.waste.length > 0}
          {@render cardFace(state.waste[state.waste.length - 1], true)}
        {/if}
      </button>

      <div class="flex-1"></div>

      <!-- 組札 4つ -->
      {#each FOUNDATION_SUIT as suit, i (suit)}
        <button
          onpointerdown={(e) => onCardPointerDown(e, 'foundation', i)}
          onclick={() => handleCardClick('foundation', i)}
          data-pile="foundation"
          data-pile-index={i}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
          class:ring-2={isSelected('foundation', i) || (currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i)}
          class:ring-blue-400={isSelected('foundation', i)}
          class:ring-yellow-400={currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i && !isSelected('foundation', i)}
          class:border-blue-400={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
          class:border-dashed={dropTarget?.pile === 'foundation' && dropTarget?.index === i}
          class:border-green-600={!isSelected('foundation', i) && !(currentHint()?.from.pile === 'foundation' && currentHint()?.from.index === i) && !(dropTarget?.pile === 'foundation' && dropTarget?.index === i)}
          class:bg-green-700={state.foundation[i].length === 0}
          class:bg-white={state.foundation[i].length > 0}
        >
          {#if state.foundation[i].length === 0}
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-green-500 text-2xl opacity-60">{SUIT_SYMBOL[suit]}</span>
            </div>
          {:else}
            {@const top = state.foundation[i][state.foundation[i].length - 1]}
            {@render cardFace(top, true)}
          {/if}
        </button>
      {/each}
    </div>

    <!-- タブロー 7列 -->
    <div class="flex gap-2">
      {#each state.tableau as col, colIdx (colIdx)}
        <div
          class="w-16 shrink-0 relative"
          data-pile="tableau"
          data-pile-index={colIdx}
          style="min-height: {Math.max(98, col.length * 28 + 70)}px;"
        >
          <!-- 空列クリック領域 -->
          <button
            onclick={() => { if (selected !== null) handleCardClick('tableau', colIdx) }}
            class="absolute inset-x-0 top-0 h-[98px] rounded-lg border-2 z-0 transition-colors"
            class:border-blue-400={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-dashed={dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx}
            class:border-green-600={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            class:border-dotted={!(dropTarget?.pile === 'tableau' && dropTarget?.index === colIdx)}
            aria-label="列{colIdx + 1}"
          ></button>
          <!-- カード -->
          {#each col as card, cardIdx (cardIdx)}
            {@const hint = currentHint()}
            <button
              onpointerdown={(e) => onCardPointerDown(e, 'tableau', colIdx, cardIdx)}
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={() => card.faceUp ? handleDoubleClick('tableau', colIdx, cardIdx) : undefined}
              class="absolute left-0 right-0 rounded-lg transition-all"
              style="top: {cardIdx * 28}px; height: {cardIdx === col.length - 1 ? 98 : 46}px; z-index: {cardIdx + 1}; opacity: {dragInfo?.isDragging && dragInfo.pile === 'tableau' && dragInfo.pileIndex === colIdx && cardIdx >= col.length - dragInfo.count ? 0.4 : 1};"
              class:ring-2={
                (hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count) ||
                (isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0))
              }
              class:ring-yellow-400={hint?.from.pile === 'tableau' && hint?.from.index === colIdx && cardIdx >= col.length - hint.count && !isSelected('tableau', colIdx)}
              class:ring-blue-400={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
              class:-translate-y-1={isSelected('tableau', colIdx) && cardIdx >= col.length - (selected?.count ?? 0)}
            >
              {#if card.faceUp}
                {@render cardFace(card, cardIdx === col.length - 1)}
              {:else}
                <div class="absolute inset-0 rounded-lg border border-indigo-500/50" style="{CARD_BACK_STYLE}"></div>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

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

  <!-- ドラッグゴースト -->
  {#if dragInfo?.isDragging}
    <div
      class="pointer-events-none fixed z-[200]"
      style="left:{dragInfo.currentX - 32}px; top:{dragInfo.currentY - 20}px;"
    >
      {#each getDragCards() as card, i (i)}
        <div
          class="absolute w-16 rounded-lg border border-slate-200 shadow-2xl overflow-hidden"
          style="top:{i * 28}px; height:{i === getDragCards().length - 1 ? 98 : 28}px; opacity:0.9;"
        >
          {@render cardFace(card, i === getDragCards().length - 1)}
        </div>
      {/each}
    </div>
  {/if}

  <!-- 勝利モーダル -->
  {#if showVictory}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div class="text-5xl mb-4">🎉</div>
        <h2 class="text-2xl font-bold text-slate-800 mb-2">クリア！</h2>
        {#if clearRank > 0}
          <p class="text-amber-500 font-bold text-lg mb-2">🏆 {clearRank}位入り！</p>
        {/if}
        <p class="text-slate-500 mb-1">タイム: <span class="font-mono font-bold text-slate-700">{formatTime(state.elapsed)}</span></p>
        <p class="text-slate-500 mb-6">スコア: <span class="font-bold text-emerald-600">{state.score} pt</span></p>
        <button
          onclick={() => newGame()}
          class="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 transition-colors"
        >
          もう一度
        </button>
      </div>
    </div>
  {/if}
</div>
