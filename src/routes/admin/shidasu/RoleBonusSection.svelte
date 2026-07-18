<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>
  <div class="grid grid-cols-2 gap-3">
    <label class="text-xs text-slate-500">
      スートコンプリート(flushBonus)
      <ScaledNumberInput value={config.scoring.flushBonus} onChange={(v) => (config.scoring.flushBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      ロイヤルセット(royalSetBonus)
      <ScaledNumberInput value={config.scoring.royalSetBonus} onChange={(v) => (config.scoring.royalSetBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      同ランク単位(sameRankBonusUnit)
      <ScaledNumberInput value={config.scoring.sameRankBonusUnit} onChange={(v) => (config.scoring.sameRankBonusUnit = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンプリートラン(completeRunBonus)
      <ScaledNumberInput value={config.scoring.completeRunBonus} onChange={(v) => (config.scoring.completeRunBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      コンプリートラン・同スート加点(completeRunSuitBonus)
      <ScaledNumberInput value={config.scoring.completeRunSuitBonus} onChange={(v) => (config.scoring.completeRunSuitBonus = v)} />
    </label>
    <label class="text-xs text-slate-500">
      列一掃(columnSweepBonus)
      <ScaledNumberInput value={config.scoring.columnSweepBonus} onChange={(v) => (config.scoring.columnSweepBonus = v)} />
    </label>
  </div>
</section>
