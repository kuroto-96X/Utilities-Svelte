<script lang="ts">
  import type { NoteDuration } from '$lib/noteDuration'
  import { formatMsLarge, formatHzSmall } from '$lib/noteDuration'
  import NoteIcon from './NoteIcon.svelte'

  let { durations }: { durations: NoteDuration[] } = $props()

  let copiedMsg = $state(false)
  let fadeTimer: ReturnType<typeof setTimeout> | null = null

  function copyValue(raw: number) {
    const text = formatMsLarge(raw)
    navigator.clipboard.writeText(text).then(() => {
      if (fadeTimer) clearTimeout(fadeTimer)
      copiedMsg = true
      fadeTimer = setTimeout(() => { copiedMsg = false }, 1500)
    })
  }
</script>

{#if copiedMsg}
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow-lg pointer-events-none">
    Copied!
  </div>
{/if}

<div class="overflow-x-auto">
  <table class="w-full text-sm min-w-[400px]">
    <thead>
      <tr class="border-b border-slate-200">
        <th scope="col" class="py-2 pr-3 text-left text-xs font-semibold text-slate-500">音符</th>
        <th scope="col" class="py-2 px-3 text-right text-xs font-semibold text-slate-500">通常</th>
        <th scope="col" class="py-2 px-3 text-right text-xs font-semibold text-slate-500">付点</th>
        <th scope="col" class="py-2 pl-3 text-right text-xs font-semibold text-slate-500">3連符</th>
      </tr>
    </thead>
    <tbody>
      {#each durations as d (d.id)}
        <tr class="border-b border-slate-100 odd:bg-slate-50">
          <td class="py-2 pr-3">
            <div class="flex items-center gap-2">
              <span class="text-slate-700 shrink-0">
                <NoteIcon filled={d.symbol.filled} stem={d.symbol.stem} flags={d.symbol.flags} size={22} />
              </span>
              <span class="font-medium text-slate-800 whitespace-nowrap">{d.label}</span>
              <span class="text-xs text-slate-400 whitespace-nowrap">{d.fraction}</span>
            </div>
          </td>
          {#each [d.normalSec, d.dottedSec, d.tripletSec] as sec, ci}
            <td
              class="py-2 {ci === 2 ? 'pl-3' : 'px-3'} text-right tabular-nums whitespace-nowrap cursor-pointer select-none hover:bg-teal-50 active:bg-teal-100 transition-colors"
              onclick={() => copyValue(sec)}
              title="クリックでコピー"
            >
              <span class="font-semibold text-slate-800">{formatMsLarge(sec)}ms</span>
              <br /><span class="text-xs text-slate-400">{formatHzSmall(sec)}Hz</span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
