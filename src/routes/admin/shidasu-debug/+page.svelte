<script lang="ts">
  import { onMount } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop, ITEM_POOL } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'
  import CardPalette from './CardPalette.svelte'
  import CardFace from '../../game/shidasu/CardFace.svelte'
  import PlayArea from '../../game/shidasu/PlayArea.svelte'

  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER

  let items = $state<ItemId[]>([])
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition).wave)
  let lastSnapshot = $state<{ tableau: Card[][]; stock: Card[] } | null>(null)

  interface DragState {
    source: { suit: Suit; rank: Rank; wild: boolean }
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }
  let dragState = $state<DragState | null>(null)
  let dropTarget = $state<{ col: number; row: number } | 'stockTop' | null>(null)

  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function resetDeck() {
    deckComposition = standardDeckComposition()
  }

  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
    lastSnapshot = null
  }

  function handleDraw() {
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
    lastSnapshot = null
  }

  function handleSetAllItems(checked: boolean) {
    items = checked ? [...ITEM_POOL] : []
    lastSnapshot = null
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    wave = forceStockTop(wave, suit, rank, wild)
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
    lastSnapshot = null
  }

  function onPaletteCardPointerDown(source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) {
    e.preventDefault()
    dragState = {
      source,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }

  function updateDropTarget(x: number, y: number) {
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const colEl = (el as HTMLElement).closest?.('[data-drop-col]') as HTMLElement | null
      if (colEl) {
        dropTarget = { col: Number(colEl.dataset.dropCol), row: Number(colEl.dataset.dropRow) }
        return
      }
      const stockEl = (el as HTMLElement).closest?.('[data-drop-stock]') as HTMLElement | null
      if (stockEl) {
        dropTarget = 'stockTop'
        return
      }
    }
    dropTarget = null
  }

  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const newCard: Card = { id: wave.stock[idx].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const newCard: Card = { id: column[row].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
    }
  }

  function unifySuit(suit: Suit) {
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
  }

  function stairifyTableau() {
    if (wave.tableau.length === 0 || wave.tableau[0].length === 0) return
    // 列優先: 列0を手前(末尾)→奥(先頭)、次に列1を手前→奥…の順に走査する
    const order: { ci: number; ri: number }[] = []
    wave.tableau.forEach((col, ci) => {
      for (let ri = col.length - 1; ri >= 0; ri--) order.push({ ci, ri })
    })
    const baseRank = wave.tableau[0][wave.tableau[0].length - 1].rank
    const newRanks = new Map<string, Rank>()
    order.forEach(({ ci, ri }, i) => {
      const rank = (((baseRank - 1 + i) % 13) + 1) as Rank
      newRanks.set(`${ci}-${ri}`, rank)
    })
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
  }

  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...wave, tableau: lastSnapshot.tableau, stock: lastSnapshot.stock, lastGain: null, lastBonusGains: [] }
    lastSnapshot = null
  }

  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      const isDragging = dragState.isDragging || Math.sqrt(dx * dx + dy * dy) > 5
      dragState = { ...dragState, currentX: e.clientX, currentY: e.clientY, isDragging }
      if (isDragging) updateDropTarget(e.clientX, e.clientY)
    }
    function onPointerUp(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      if (dragState.isDragging && dropTarget) {
        applySwap(dropTarget, dragState.source)
      }
      dragState = null
      dropTarget = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
</script>

<svelte:head>
  <title>Shidasu デバッグサンドボックス</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 px-4 py-4">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-lg font-bold text-slate-800">Shidasu デバッグサンドボックス</h1>
    <div class="flex items-center gap-2">
      <button type="button" onclick={stairifyTableau} class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-bold">場札を階段にする</button>
      <button type="button" onclick={handleUndo} disabled={!lastSnapshot} class="px-3 py-1.5 rounded text-sm font-bold {lastSnapshot ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
      <button type="button" onclick={resetDeck} class="px-3 py-1.5 rounded bg-rose-600 text-white text-sm font-bold">デッキリセット</button>
    </div>
  </div>

  <div class="grid gap-4 items-start" style="grid-template-columns: 1fr 360px;">
    <div class="bg-emerald-950 rounded-lg p-3">
      <PlayArea {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget} />
      <div class="mt-4">
        <DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />
      </div>
    </div>
    <div class="space-y-4">
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
    </div>
  </div>

  {#if dragState?.isDragging}
    <div class="fixed pointer-events-none z-50" style="left:{dragState.currentX - 32}px; top:{dragState.currentY - 48}px; width:64px;">
      <CardFace card={{ id: -1, suit: dragState.source.suit, rank: dragState.source.rank, wild: dragState.source.wild }} covered={false} />
    </div>
  {/if}
</div>
