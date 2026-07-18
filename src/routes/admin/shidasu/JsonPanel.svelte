<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config, onApply }: { config: ShidasuParams; onApply: (newConfig: ShidasuParams) => void } = $props()

  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function openJsonPanel() {
    jsonText = JSON.stringify(config, null, 2)
    jsonError = null
  }

  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      Array.isArray(v.stages) && v.stages.length >= 1 &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/stages/items/flow/ui)が不足しています'
        return
      }
      onApply(parsed)
      jsonError = null
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>
    <button onclick={openJsonPanel} class="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600">現在値を表示</button>
  </div>
  <textarea bind:value={jsonText} rows="10" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"></textarea>
  {#if jsonError}
    <p class="text-xs text-red-600 mt-1">{jsonError}</p>
  {/if}
  <button onclick={applyJson} class="mt-2 text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">貼り付けを適用</button>
</section>
