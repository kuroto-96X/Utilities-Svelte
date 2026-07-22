<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">スプレッド(ラン選択)</h2>
  <div class="space-y-4">
    <div>
      <div class="text-xs font-bold text-slate-600 mb-2">愚者(fool)</div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名前
          <input type="text" bind:value={config.spreads.fool.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          説明文
          <input type="text" bind:value={config.spreads.fool.desc} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          初期行数オフセット(initialExtraTableauRows)
          <input type="number" step="1" bind:value={config.spreads.fool.initialExtraTableauRows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア基礎値(waveTargetBase)
          <input type="number" min="1" step="1" bind:value={config.spreads.fool.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア倍率(waveTargetMultiplier)
          <input type="number" min="1" step="0.01" bind:value={config.spreads.fool.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </div>
    <div>
      <div class="text-xs font-bold text-slate-600 mb-2">月(moon)</div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名前
          <input type="text" bind:value={config.spreads.moon.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          説明文
          <input type="text" bind:value={config.spreads.moon.desc} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          初期行数オフセット(initialExtraTableauRows)
          <input type="number" step="1" bind:value={config.spreads.moon.initialExtraTableauRows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア基礎値(waveTargetBase)
          <input type="number" min="1" step="1" bind:value={config.spreads.moon.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア倍率(waveTargetMultiplier)
          <input type="number" min="1" step="0.01" bind:value={config.spreads.moon.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </div>
  </div>
</section>
