<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      1ステージのウェーブ数(wavesPerStage)
      <input type="number" min="1" step="1" bind:value={config.flow.wavesPerStage} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      クリア演出待ち(clearDelayMs)
      <input type="number" min="0" step="10" bind:value={config.flow.clearDelayMs} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    {#each [0, 1, 2] as ti (ti)}
      <label class="text-xs text-slate-500">
        comboTierThresholds[{ti}]
        <input type="number" min="0" step="1" bind:value={config.ui.comboTierThresholds[ti]} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>
    {/each}
    <label class="text-xs text-slate-500">
      チェーン表示: 横にずらす幅(chainCardOffsetX)
      <input type="number" min="0" step="1" bind:value={config.ui.chainCardOffsetX} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      チェーン表示: 1行に表示する枚数(chainCardsPerRow)
      <input type="number" min="1" step="1" bind:value={config.ui.chainCardsPerRow} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
