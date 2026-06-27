<script lang="ts">
  import { onDestroy } from 'svelte'

  let {
    formatted,
    placeholders,
  }: {
    formatted: string | null
    placeholders: { name: string; originalExpr: string }[]
  } = $props()

  let copySuccess = $state(false)
  let showPlaceholders = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  onDestroy(() => { if (copyTimer) clearTimeout(copyTimer) })

  async function handleCopy() {
    if (!formatted) return
    try {
      await navigator.clipboard.writeText(formatted)
      copySuccess = true
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copySuccess = false }, 2000)
    } catch { /* clipboard API unavailable */ }
  }
</script>

{#if formatted}
  <div class="flex flex-col gap-2">
    <div class="flex justify-end gap-2">
      {#if placeholders.length > 0}
        <button
          type="button"
          class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg"
          onclick={() => { showPlaceholders = !showPlaceholders }}
        >
          {showPlaceholders ? '▲' : '▼'} パラメーター ({placeholders.length})
        </button>
      {/if}
      <button
        type="button"
        class="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
        onclick={handleCopy}
      >
        {copySuccess ? 'コピーしました ✓' : 'コピー'}
      </button>
    </div>

    <pre class="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono overflow-x-auto whitespace-pre text-gray-800">{formatted}</pre>

    {#if showPlaceholders && placeholders.length > 0}
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">プレースホルダー</th>
              <th class="px-3 py-2 text-left font-medium">元の式</th>
            </tr>
          </thead>
          <tbody>
            {#each placeholders as p, i (p.name + i)}
              <tr class="border-t border-gray-100">
                <td class="px-3 py-2 font-mono text-teal-700">:{p.name}</td>
                <td class="px-3 py-2 font-mono text-gray-600">{p.originalExpr}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{:else}
  <p class="text-sm text-gray-400">候補を選択すると整形結果が表示されます</p>
{/if}
