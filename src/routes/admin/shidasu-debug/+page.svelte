<script lang="ts">
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop, getPlayableColumns, isRed, rankLabel } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'

  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER

  let items = $state<ItemId[]>([])
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition).wave)

  const PIP_LAYOUTS: Record<number, [number, number, boolean][]> = {
    1:  [[50, 50, false]],
    2:  [[50, 18, false], [50, 82, true]],
    3:  [[50, 14, false], [50, 50, false], [50, 86, true]],
    4:  [[25, 18, false], [75, 18, false], [25, 82, true], [75, 82, true]],
    5:  [[25, 18, false], [75, 18, false], [50, 50, false], [25, 82, true], [75, 82, true]],
    6:  [[25, 15, false], [75, 15, false], [25, 50, false], [75, 50, false], [25, 85, true], [75, 85, true]],
    7:  [[25, 13, false], [75, 13, false], [50, 30, false], [25, 52, false], [75, 52, false], [25, 85, true], [75, 85, true]],
    8:  [[25, 11, false], [75, 11, false], [50, 28, false], [25, 50, false], [75, 50, false], [50, 72, true], [25, 89, true], [75, 89, true]],
    9:  [[25, 9, false], [75, 9, false], [25, 35, false], [75, 35, false], [50, 50, false], [25, 65, true], [75, 65, true], [25, 91, true], [75, 91, true]],
    10: [[25, 9, false], [75, 9, false], [50, 26, false], [25, 37, false], [75, 37, false], [25, 63, true], [75, 63, true], [50, 74, true], [25, 91, true], [75, 91, true]],
  }
  const FACE_CHAR: Record<number, string> = { 11: '♞', 12: '♛', 13: '♚' }

  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
  }

  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
  }

  function handleDraw() {
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
  }

  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
  }

  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    wave = forceStockTop(wave, suit, rank, wild)
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
  }

  let playableCols = $derived(getPlayableColumns('none', wave))
</script>

<svelte:head>
  <title>Shidasu デバッグサンドボックス</title>
</svelte:head>

{#snippet cardFace(card: Card, covered: boolean)}
  {#if card.wild}
    <div
      class="relative w-full rounded-lg border p-1 flex flex-col items-start overflow-hidden select-none"
      style="aspect-ratio: 2 / 3; background:#EDE4FF; border-color:#A78BFA; color:#6D28D9;"
    >
      <div class="flex items-center gap-0.5 leading-none">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      </div>
      {#if !covered}
        <div class="w-full flex-1 flex items-center justify-center">
          <span class="leading-none" style="font-size:26px;">{rankLabel(card)}</span>
        </div>
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        </div>
      {/if}
    </div>
  {:else}
    {@const colorClass = isRed(card) ? 'text-red-600' : 'text-slate-900'}
    <div
      class="relative w-full rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white select-none"
      style="aspect-ratio: 2 / 3;"
    >
      <div class="flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        <span class="text-xs leading-none">{card.suit}</span>
      </div>
      {#if !covered}
        {#if card.rank <= 10}
          <div class="w-full flex-1 relative {colorClass}">
            {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
              <span
                class="absolute leading-none select-none"
                style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
              >{card.suit}</span>
            {/each}
          </div>
        {:else}
          <div class="w-full flex-1 flex items-center justify-center {colorClass}">
            <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
          </div>
        {/if}
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
          <span class="text-xs leading-none">{card.suit}</span>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="min-h-screen bg-slate-50 px-4 py-4">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-lg font-bold text-slate-800">Shidasu デバッグサンドボックス</h1>
    <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
  </div>

  <div class="grid gap-4 items-start" style="grid-template-columns: 1fr 360px;">
    <div class="bg-emerald-950 rounded-lg p-3">
      <div class="text-emerald-100 text-xs mb-2">score: {wave.score} / status: {wave.status} / endReason: {wave.endReason ?? 'null'}</div>
      <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
        {#each wave.tableau as col, ci (ci)}
          <div class="relative" style="min-height: 12rem;">
            {#each col as card, ri (card.id)}
              {@const isTop = ri === col.length - 1}
              <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri}; width:64px;">
                {#if isTop}
                  <button type="button" onclick={() => handlePlayCard(ci)} class="w-full text-left {playableCols.has(ci) ? 'ring-2 ring-yellow-300' : ''}">
                    {@render cardFace(card, false)}
                  </button>
                {:else}
                  {@render cardFace(card, false)}
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="mt-16 flex items-center gap-3">
        <button
          type="button"
          onclick={handleDraw}
          disabled={wave.stock.length === 0}
          style="aspect-ratio: 2/3; width:64px;"
          class="rounded-lg border-2 flex flex-col items-center justify-center font-black {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
        >
          <div class="text-xs">山札</div>
          <div class="text-lg tabular-nums">{wave.stock.length}</div>
        </button>
        <div class="flex flex-wrap gap-1">
          {#each wave.chain as c (c.id)}
            <div style="width:48px;">{@render cardFace(c, false)}</div>
          {/each}
        </div>
      </div>
    </div>
    <div class="space-y-4">
      <ItemChecklist {items} onToggle={handleToggleItem} />
      <DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />
      <div class="text-xs text-slate-500">カードパレットは次のタスクで追加します。</div>
    </div>
  </div>
</div>
