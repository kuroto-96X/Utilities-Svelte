<script lang="ts">
  import { MIN_BPM, MAX_BPM, clampBpm } from '$lib/noteDuration'

  let {
    bpm = $bindable(),
    min = MIN_BPM,
    max = MAX_BPM,
  }: {
    bpm: number
    min?: number
    max?: number
  } = $props()

  const PRESETS = [
    { bpm: 60,  label: 'Ballad' },
    { bpm: 80,  label: 'R&B' },
    { bpm: 90,  label: 'Hip Hop' },
    { bpm: 100, label: 'J-Pop' },
    { bpm: 120, label: 'House' },
    { bpm: 128, label: 'EDM' },
    { bpm: 140, label: 'Dubstep' },
    { bpm: 160, label: 'Eurobeat' },
    { bpm: 170, label: 'D&B' },
  ]

  let inputValue = $state(String(bpm))

  $effect(() => {
    inputValue = String(bpm)
  })

  function handleInput(e: Event) {
    inputValue = (e.target as HTMLInputElement).value
  }

  function handleBlur() {
    const n = parseFloat(inputValue)
    bpm = clampBpm(Number.isNaN(n) ? bpm : n)
  }

  function step(delta: number) {
    bpm = clampBpm(bpm + delta)
  }
</script>

<div class="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
  <!-- BPMプリセット -->
  <div class="w-full">
  <p class="text-xs text-slate-500 mb-1">プリセット</p>
  <div class="flex flex-wrap gap-1">
    {#each PRESETS as preset}
      <button
        type="button"
        onclick={() => { bpm = preset.bpm }}
        class="flex flex-col items-center px-2 py-1 rounded text-center transition-colors
          {bpm === preset.bpm
            ? 'bg-teal-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'}"
      >
        <span class="text-sm font-bold tabular-nums leading-tight">{preset.bpm}</span>
        <span class="text-[10px] leading-tight">{preset.label}</span>
      </button>
    {/each}
  </div>
  </div>
  <div class="flex items-center gap-2 w-full">
    <button
      type="button"
      onclick={() => step(-1)}
      class="w-10 h-10 rounded-full border border-slate-300 text-slate-600 font-bold text-lg hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
      aria-label="BPMを1減らす"
    >−</button>
    <input
      type="number"
      value={inputValue}
      oninput={handleInput}
      onblur={handleBlur}
      min={min}
      max={max}
      class="flex-1 min-w-0 text-center text-3xl font-bold tabular-nums border border-slate-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"
      aria-label="BPM"
    />
    <button
      type="button"
      onclick={() => step(1)}
      class="w-10 h-10 rounded-full border border-slate-300 text-slate-600 font-bold text-lg hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
      aria-label="BPMを1増やす"
    >＋</button>
  </div>
  <input
    type="range"
    value={bpm}
    oninput={(e) => { bpm = clampBpm(Number((e.target as HTMLInputElement).value)) }}
    min={min}
    max={max}
    step="1"
    class="w-full accent-teal-700"
    aria-label="BPMスライダー"
  />
  <div class="text-xs text-slate-400">{min} – {max} BPM</div>
</div>
