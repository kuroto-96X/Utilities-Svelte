<script lang="ts">
  import type { ExtractedCandidate } from '../types'

  let {
    candidates,
    selectedId = $bindable<string | null>(null),
  }: {
    candidates: ExtractedCandidate[]
    selectedId: string | null
  } = $props()

  let showAll = $state(false)

  const visibleCandidates = $derived(
    showAll ? candidates : candidates.filter(c => c.sqlScore > 0)
  )
  const hiddenCount = $derived(candidates.length - visibleCandidates.length)
</script>

{#if candidates.length === 0}
  <p class="text-sm text-gray-400">コードを貼り付けると SQL 候補が表示されます</p>
{:else}
  <div class="flex flex-col gap-2">
    {#each visibleCandidates as c (c.id)}
      <button
        type="button"
        class="w-full text-left border rounded-xl px-3 py-2 text-sm transition-colors"
        class:border-teal-500={selectedId === c.id}
        class:bg-teal-50={selectedId === c.id}
        class:border-gray-200={selectedId !== c.id}
        class:hover:bg-gray-50={selectedId !== c.id}
        onclick={() => { selectedId = c.id }}
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs text-gray-400">行 {c.sourceLineStart}–{c.sourceLineEnd}</span>
          {#if c.sqlScore > 0}
            <span class="text-xs text-teal-600 font-medium">スコア {c.sqlScore}</span>
          {/if}
        </div>
        <p class="font-mono text-xs text-gray-600 truncate">
          {c.rawJoined.slice(0, 80)}{c.rawJoined.length > 80 ? '…' : ''}
        </p>
      </button>
    {/each}

    {#if hiddenCount > 0}
      <button
        type="button"
        class="text-xs text-gray-400 hover:text-gray-600 text-left px-1"
        onclick={() => { showAll = !showAll }}
      >
        {showAll ? '▲ SQL 候補のみ表示' : `▼ SQL 以外の文字列も表示（${hiddenCount}件）`}
      </button>
    {/if}
  </div>
{/if}
