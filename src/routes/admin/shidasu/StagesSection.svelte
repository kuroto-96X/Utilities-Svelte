<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'
  import ScaledNumberInput from './ScaledNumberInput.svelte'

  let { config }: { config: ShidasuParams } = $props()

  function addStage() {
    config.stages.push({ name: `STAGE ${config.stages.length + 1}`, modifier: 'none', targets: [100, 200, 300] })
  }

  function removeStage(index: number) {
    if (config.stages.length <= 1) return
    config.stages.splice(index, 1)
  }
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>
    <button onclick={addStage} class="text-xs px-2.5 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600">+ ステージ追加</button>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
      <thead>
        <tr class="bg-slate-50 text-slate-500">
          <th class="px-2 py-1.5 text-left">名前</th>
          <th class="px-2 py-1.5 text-left">modifier</th>
          <th class="px-2 py-1.5 text-center">target1</th>
          <th class="px-2 py-1.5 text-center">target2</th>
          <th class="px-2 py-1.5 text-center">target3</th>
          <th class="px-2 py-1.5 w-8"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each config.stages as stage, si (si)}
          <tr>
            <td class="px-2 py-1">
              <input type="text" bind:value={stage.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
            </td>
            <td class="px-2 py-1">
              <select bind:value={stage.modifier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                <option value="none">none</option>
                <option value="noLoop">noLoop</option>
                <option value="faceLock">faceLock</option>
              </select>
            </td>
            {#each [0, 1, 2] as ti (ti)}
              <td class="px-1 py-1">
                <ScaledNumberInput value={stage.targets[ti]} onChange={(v) => (stage.targets[ti] = v)} />
              </td>
            {/each}
            <td class="px-1 py-1 text-center">
              <button onclick={() => removeStage(si)} disabled={config.stages.length <= 1} class="text-slate-400 hover:text-red-500 disabled:opacity-30 px-1">×</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
