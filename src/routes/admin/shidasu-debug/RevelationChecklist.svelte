<script lang="ts">
  import { revelationDesc, REVELATION_POOL } from '$lib/game/shidasu/revelations'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { RevelationId } from '$lib/game/shidasu/types'

  let { revelations, onToggle, onSetAll }: {
    revelations: RevelationId[]
    onToggle: (id: RevelationId, checked: boolean) => void
    onSetAll: (checked: boolean) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-1">
  <div class="sticky top-0 bg-slate-50 space-y-1">
    <h2 class="text-sm font-bold text-slate-700">所持天啓({revelations.length}/{REVELATION_POOL.length})</h2>
    <div class="flex gap-2">
      <button type="button" onclick={() => onSetAll(true)} class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">全てチェック</button>
      <button type="button" onclick={() => onSetAll(false)} class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">全て解除</button>
    </div>
  </div>
  <div class="space-y-0.5">
    {#each REVELATION_POOL as id (id)}
      <label class="flex items-start gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={revelations.includes(id)}
          onchange={(e) => onToggle(id, (e.currentTarget as HTMLInputElement).checked)}
          class="mt-0.5"
        />
        <span>
          <span class="font-semibold text-slate-700">{params.revelations[id].name}</span>
          <span class="text-slate-400 ml-1">{revelationDesc(id, params)}</span>
        </span>
      </label>
    {/each}
  </div>
</div>
