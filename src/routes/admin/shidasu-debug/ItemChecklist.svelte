<script lang="ts">
  import { itemName, itemDesc } from '$lib/game/shidasu/engine'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { ItemId } from '$lib/game/shidasu/types'
  import { ITEM_GROUPS } from '$lib/game/shidasu/itemGroups'

  let { items, onToggle }: {
    items: ItemId[]
    onToggle: (id: ItemId, checked: boolean) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">護符({items.length}/87)</h2>
  {#each ITEM_GROUPS as group (group.label)}
    <div>
      <div class="text-xs font-bold text-slate-500 mb-1">{group.label}</div>
      <div class="space-y-0.5">
        {#each group.ids as id (id)}
          <label class="flex items-start gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={items.includes(id)}
              onchange={(e) => onToggle(id, (e.currentTarget as HTMLInputElement).checked)}
              class="mt-0.5"
            />
            <span>
              <span class="font-semibold text-slate-700">{itemName(id, params)}</span>
              <span class="text-slate-400 ml-1">{itemDesc(id, params)}</span>
            </span>
          </label>
        {/each}
      </div>
    </div>
  {/each}
</div>
