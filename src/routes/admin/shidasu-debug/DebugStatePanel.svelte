<script lang="ts">
  import DebugPanel from '../../game/shidasu/DebugPanel.svelte'
  import { ITEM_NAMES } from '$lib/game/shidasu/engine'
  import type { WaveState, ItemId, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, items, onForceDraw }: {
    wave: WaveState
    items: ItemId[]
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()
</script>

<div class="flex flex-wrap items-start gap-3">
  <div class="text-xs bg-slate-800 text-slate-100 rounded px-3 py-2 space-y-1 font-mono" style="min-width: 220px;">
    <div>status: {wave.status} / endReason: {wave.endReason ?? 'null'}</div>
    <div>score: {wave.score}</div>
    <div>stock残り: {wave.stock.length}</div>
  </div>
  <div class="text-xs bg-white border border-slate-200 rounded px-3 py-2" style="min-width: 220px;">
    <div class="font-bold text-slate-600 mb-1">所持中の護符({items.length}種)</div>
    <div class="flex flex-wrap gap-1">
      {#each items as id (id)}
        <span class="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{ITEM_NAMES[id]}</span>
      {/each}
      {#if items.length === 0}<span class="text-slate-400">(なし)</span>{/if}
    </div>
  </div>
  <div class="flex-1" style="min-width: 280px;">
    <DebugPanel {wave} {onForceDraw} />
  </div>
</div>
