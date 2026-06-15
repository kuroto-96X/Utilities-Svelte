<script lang="ts">
  import type { SnsPreset } from '$lib/data/snsPresets'

  interface Props {
    presets: SnsPreset[]
    selected: SnsPreset | null
    onselect: (preset: SnsPreset) => void
  }

  let { presets, selected, onselect }: Props = $props()
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
      <p class="text-xs font-medium text-slate-500">{preset.service}</p>
      <p class="text-sm font-semibold text-slate-800 mt-0.5 leading-tight">{preset.label}</p>
      <p class="text-xs text-slate-400 mt-1">{preset.width} × {preset.height}</p>
    </button>
  {/each}
</div>
