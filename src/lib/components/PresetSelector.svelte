<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte'

  interface Props {
    presets: T[]
    selected: T | null
    onselect: (preset: T) => void
    children: Snippet<[T]>
  }

  let { presets, selected, onselect, children }: Props = $props()
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
  {#each presets as preset (preset.id)}
    <button
      type="button"
      class="rounded-lg border-2 p-3 text-left transition-colors {selected?.id === preset.id
        ? 'border-teal-500 bg-teal-50'
        : 'border-slate-200 hover:border-slate-300'}"
      onclick={() => onselect(preset)}
    >
      {@render children(preset)}
    </button>
  {/each}
</div>
