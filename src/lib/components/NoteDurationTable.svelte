<script lang="ts">
  import type { NoteDuration } from '$lib/noteDuration'
  import { formatMsLarge, formatHzSmall } from '$lib/noteDuration'
  import NoteIcon from './NoteIcon.svelte'

  let { durations }: { durations: NoteDuration[] } = $props()

  let copiedMsg = $state('')
  let fadeTimer: ReturnType<typeof setTimeout> | null = null

  function copyValue(sec: number) {
    const text = formatMsLarge(sec)
    navigator.clipboard.writeText(text).then(() => {
      if (fadeTimer) clearTimeout(fadeTimer)
      copiedMsg = `${text}ms コピー`
      fadeTimer = setTimeout(() => { copiedMsg = '' }, 1500)
    })
  }
</script>

{#if copiedMsg}
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-3 py-1.5 rounded shadow-lg pointer-events-none">
    {copiedMsg}
  </div>
{/if}

<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-200">
        <th scope="col" class="py-2 pr-2 text-left text-xs font-semibold text-slate-500">音符</th>
        <th scope="col" class="py-2 px-1.5 text-right text-xs font-semibold text-slate-500">通常</th>
        <th scope="col" class="py-2 px-1.5 text-right text-xs font-semibold text-slate-500">付点</th>
        <th scope="col" class="py-2 pl-1.5 text-right text-xs font-semibold text-slate-500">3連符</th>
      </tr>
    </thead>
    <tbody>
      {#each durations as d (d.id)}
        <tr class="border-b border-slate-100 odd:bg-slate-50">
          <td class="py-1.5 pr-2">
            <div class="flex items-center gap-1">
              <span class="text-slate-700 shrink-0">
                <NoteIcon filled={d.symbol.filled} stem={d.symbol.stem} flags={d.symbol.flags} size={18} />
              </span>
              <span class="font-medium text-slate-800 text-xs whitespace-nowrap">{d.label}</span>
            </div>
          </td>
          {#each [d.normalSec, d.dottedSec, d.tripletSec] as sec, ci}
            <td
              class="py-1.5 {ci === 2 ? 'pl-1.5' : 'px-1.5'} text-right tabular-nums whitespace-nowrap cursor-pointer select-none hover:bg-teal-50 active:bg-teal-100 transition-colors"
              onclick={() => copyValue(sec)}
              title="クリックでコピー"
            >
              <span class="font-semibold text-slate-800 text-xs">{formatMsLarge(sec)}ms</span>
              <br /><span class="text-[10px] text-slate-400">{formatHzSmall(sec)}Hz</span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
