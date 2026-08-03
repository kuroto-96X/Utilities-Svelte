<script lang="ts">
  import { rankLabel } from '$lib/game/shidasu/engine'
  import { isRed } from '$lib/game/shidasu/patterns'
  import type { Card, ItemId } from '$lib/game/shidasu/types'

  let { card, covered, items = [] }: { card: Card; covered: boolean; items?: ItemId[] } = $props()

  let hideColorAndSuit = $derived(items.includes('silver'))

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
</script>

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
  {@const colorClass = hideColorAndSuit ? 'text-slate-900' : (isRed(card) ? 'text-red-600' : 'text-slate-900')}
  <div
    class="relative w-full rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white select-none"
    style="aspect-ratio: 2 / 3;"
  >
    <div class="flex items-center gap-0.5 leading-none {colorClass}">
      <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      {#if !hideColorAndSuit}
        <span class="text-xs leading-none">{card.suit}</span>
      {/if}
    </div>
    {#if !covered}
      {#if card.rank <= 10}
        <div class="w-full flex-1 relative {colorClass}">
          {#if !hideColorAndSuit}
            {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
              <span
                class="absolute leading-none select-none"
                style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
              >{card.suit}</span>
            {/each}
          {/if}
        </div>
      {:else}
        <div class="w-full flex-1 flex items-center justify-center {colorClass}">
          <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
        </div>
      {/if}
      <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        {#if !hideColorAndSuit}
          <span class="text-xs leading-none">{card.suit}</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
