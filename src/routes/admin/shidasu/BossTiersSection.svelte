<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス・目標スコア</h2>
  <div class="grid grid-cols-2 gap-3 mb-4">
    <label class="text-xs text-slate-500">
      目標スコア基礎値(waveTargetBase)
      <input type="number" min="1" step="1" bind:value={config.scoring.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      目標スコア倍率(waveTargetMultiplier)
      <input type="number" min="1" step="0.01" bind:value={config.scoring.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500 col-span-3">
      中凶: n以下のコンボで無得点(maxCombo)
      <input type="number" min="0" step="1" bind:value={config.bossTiers.chuukyou.maxCombo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
