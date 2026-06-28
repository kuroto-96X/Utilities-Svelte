<!-- src/routes/game/solitaire/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { GameState, Move } from '$lib/game/solitaire/types'
  import {
    dealInitial, drawFromStock, moveCards,
    undo, getHints, canAutoComplete, autoCompleteStep, isVictory
  } from '$lib/game/solitaire/engine'

  // ---- 状態 ----
  let state = $state<GameState>(dealInitial(1))
  let selected = $state<{ pile: 'tableau' | 'waste' | 'foundation'; index: number; count: number } | null>(null)
  let hints = $state<Move[]>([])
  let hintIndex = $state(0)
  let showHints = $state(false)
  let showVictory = $state(false)
  let autoCompleting = $state(false)
  let pendingMode = $state<1 | 3>(1)

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
    showVictory = false; autoCompleting = false; gameStarted = false
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

  function handleHint() {
    const h = getHints(state)
    if (h.length === 0) return
    hints = h
    showHints = true
    hintIndex = (hintIndex + 1) % h.length
  }

  function handleUndo() {
    state = undo(state)
    selected = null; showHints = false
  }

  function checkAfterMove() {
    if (isVictory(state)) { stopTimer(); showVictory = true; return }
    if (!autoCompleting && canAutoComplete(state)) startAutoComplete()
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

  function isHintedFrom(pile: 'tableau' | 'waste' | 'foundation', index: number): boolean {
    if (!showHints || hints.length === 0) return false
    const h = hints[hintIndex % hints.length]
    return h.from.pile === pile && h.from.index === index
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

  onMount(() => () => { stopTimer(); if (autoInterval) clearInterval(autoInterval) })
</script>

<div class="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4">

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

      <!-- 捨て札 -->
      <button
        onclick={() => handleCardClick('waste', 0)}
        ondblclick={() => state.waste.length > 0 ? handleDoubleClick('waste', 0) : undefined}
        class="w-16 h-[98px] rounded-lg border-2 transition-colors relative overflow-hidden"
        class:border-yellow-400={isHintedFrom('waste', 0) && !isSelected('waste', 0)}
        class:ring-2={isSelected('waste', 0)}
        class:ring-blue-400={isSelected('waste', 0)}
        class:border-green-600={!isHintedFrom('waste', 0) && !isSelected('waste', 0)}
        class:bg-green-900={state.waste.length === 0}
      >
        {#if state.waste.length > 0}
          {#each state.waste.slice(-3) as card, i (i)}
            {@const isTop = i === Math.min(2, state.waste.length - 1)}
            <div
              class="absolute inset-0 rounded-lg bg-white flex flex-col p-1"
              style="left: {i * 6}px; z-index: {i};"
            >
              {#if isTop}
                <span class="text-xs font-bold leading-none {SUIT_COLOR[card.suit]}">{rankLabel(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
                <span class="text-2xl flex-1 flex items-center justify-center {SUIT_COLOR[card.suit]}">{SUIT_SYMBOL[card.suit]}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </button>

      <div class="flex-1"></div>

      <!-- 組札 4つ -->
      {#each FOUNDATION_SUIT as suit, i (suit)}
        <button
          onclick={() => handleCardClick('foundation', i)}
          class="w-16 h-[98px] rounded-lg border-2 transition-colors flex items-center justify-center"
          class:border-yellow-400={isHintedFrom('foundation', i) && !isSelected('foundation', i)}
          class:ring-2={isSelected('foundation', i)}
          class:ring-blue-400={isSelected('foundation', i)}
          class:border-green-600={!isSelected('foundation', i) && !isHintedFrom('foundation', i)}
          class:bg-green-700={state.foundation[i].length === 0}
          class:bg-white={state.foundation[i].length > 0}
        >
          {#if state.foundation[i].length === 0}
            <span class="text-green-500 text-2xl opacity-60">{SUIT_SYMBOL[suit]}</span>
          {:else}
            {@const top = state.foundation[i][state.foundation[i].length - 1]}
            <div class="h-full w-full flex flex-col p-1">
              <span class="text-xs font-bold leading-none {SUIT_COLOR[top.suit]}">{rankLabel(top.rank)}{SUIT_SYMBOL[top.suit]}</span>
              <span class="text-2xl flex-1 flex items-center justify-center {SUIT_COLOR[top.suit]}">{SUIT_SYMBOL[top.suit]}</span>
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- タブロー 7列 -->
    <div class="flex gap-2">
      {#each state.tableau as col, colIdx (colIdx)}
        <div class="flex-1 relative" style="min-height: {Math.max(98, col.length * 28 + 70)}px;">
          <!-- 空列クリック領域 -->
          <button
            onclick={() => { if (selected !== null) handleCardClick('tableau', colIdx) }}
            class="absolute inset-0 rounded-lg border-2 border-dashed border-green-600 z-0"
            aria-label="列{colIdx + 1}"
          ></button>
          <!-- カード -->
          {#each col as card, cardIdx (cardIdx)}
            <button
              onclick={() => handleCardClick('tableau', colIdx, cardIdx)}
              ondblclick={() => card.faceUp ? handleDoubleClick('tableau', colIdx, cardIdx) : undefined}
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
              {#if card.faceUp}
                <div class="h-full bg-white rounded-lg p-1 flex flex-col overflow-hidden">
                  <span class="text-xs font-bold leading-none {SUIT_COLOR[card.suit]}">{rankLabel(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
                  {#if cardIdx === col.length - 1}
                    <span class="text-2xl flex-1 flex items-center justify-center {SUIT_COLOR[card.suit]}">{SUIT_SYMBOL[card.suit]}</span>
                  {/if}
                </div>
              {:else}
                <div class="h-full rounded-lg border border-indigo-500/50"
                  style="{CARD_BACK_STYLE}">
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- 勝利モーダル -->
  {#if showVictory}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div class="text-5xl mb-4">🎉</div>
        <h2 class="text-2xl font-bold text-slate-800 mb-2">クリア！</h2>
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
