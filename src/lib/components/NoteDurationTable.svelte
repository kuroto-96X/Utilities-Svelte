<script lang="ts">
  import type { NoteDuration } from '$lib/noteDuration'
  import { formatSec, formatMs } from '$lib/noteDuration'
  import NoteIcon from './NoteIcon.svelte'

  let { durations }: { durations: NoteDuration[] } = $props()
</script>

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
          <td class="py-2 px-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.normalSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.normalSec)}ms</span>
          </td>
          <td class="py-2 px-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.dottedSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.dottedSec)}ms</span>
          </td>
          <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.tripletSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.tripletSec)}ms</span>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
