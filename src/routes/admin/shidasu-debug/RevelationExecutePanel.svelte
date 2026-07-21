<script lang="ts">
  import { revelationDesc, REVELATION_POOL } from '$lib/game/shidasu/revelations'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { RevelationId } from '$lib/game/shidasu/types'

  let { onExecute, pendingRevelationId, onCancelTarget }: {
    onExecute: (revelationId: RevelationId) => void
    pendingRevelationId: RevelationId | null
    onCancelTarget: () => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">天啓({REVELATION_POOL.length}種・所持数無視で直接発動)</h2>
  {#if pendingRevelationId}
    <div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
      <span>列を選択してください({params.revelations[pendingRevelationId].name})</span>
      <button type="button" onclick={onCancelTarget} class="text-amber-700 underline shrink-0">キャンセル</button>
    </div>
  {/if}
  {#each REVELATION_POOL as id (id)}
    <div class="flex items-start gap-1.5 text-xs">
      <button
        type="button"
        onclick={() => onExecute(id)}
        disabled={pendingRevelationId !== null && pendingRevelationId !== id}
        class="shrink-0 w-8 h-8 rounded border flex items-center justify-center text-base font-black {pendingRevelationId === id ? 'border-amber-400 bg-amber-100' : 'border-slate-300 bg-white hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed"
      >{params.revelations[id].name}</button>
      <span class="pt-1.5 text-slate-400">{revelationDesc(id, params)}</span>
    </div>
  {/each}
</div>
