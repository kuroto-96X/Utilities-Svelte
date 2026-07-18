<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      基礎点(basePoint)
      <ScaledNumberInput value={config.scoring.basePoint} onChange={(v) => (config.scoring.basePoint = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同スートボーナス(suitBonus)
      <ScaledNumberInput value={config.scoring.suitBonus} onChange={(v) => (config.scoring.suitBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同色ボーナス(colorBonus)
      <ScaledNumberInput value={config.scoring.colorBonus} onChange={(v) => (config.scoring.colorBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同スート/同色の成立に必要な実カード枚数(suitColorMinLen)
      <input type="number" min="1" step="1" bind:value={config.scoring.suitColorMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      階段ボーナス(stairBonus)
      <ScaledNumberInput value={config.scoring.stairBonus} onChange={(v) => (config.scoring.stairBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      階段成立枚数(stairMinLen)
      <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      全消しボーナス(clearBonus)
      <ScaledNumberInput value={config.scoring.clearBonus} onChange={(v) => (config.scoring.clearBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      全消し・残り山札1枚あたり(clearBonusPerStock)
      <ScaledNumberInput value={config.scoring.clearBonusPerStock} onChange={(v) => (config.scoring.clearBonusPerStock = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンボ倍率のstep幅(comboMultiplierStep)
      <input type="number" min="0" step="0.1" bind:value={config.scoring.comboMultiplierStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
