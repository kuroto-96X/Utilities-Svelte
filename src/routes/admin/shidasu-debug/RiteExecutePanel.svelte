<script lang="ts">
  import { riteDesc, RITE_POOL } from '$lib/game/shidasu/rites'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { RiteId } from '$lib/game/shidasu/types'

  let { onExecute }: {
    onExecute: (riteId: RiteId) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">秘儀(17種・所持数無視で直接発動)</h2>
  {#each RITE_POOL as id (id)}
    <div class="flex items-start gap-1.5 text-xs">
      <button
        type="button"
        onclick={() => onExecute(id)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="shrink-0 w-8 h-8 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-base font-black"
      >{params.rites[id].name}</button>
      <span class="pt-1.5 text-slate-400">{riteDesc(id, params)}</span>
    </div>
  {/each}
</div>
