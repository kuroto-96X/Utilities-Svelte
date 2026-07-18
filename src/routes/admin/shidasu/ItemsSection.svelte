<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      護符の所持上限枚数(maxItems)
      <input type="number" min="1" step="1" bind:value={config.items.maxItems} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
