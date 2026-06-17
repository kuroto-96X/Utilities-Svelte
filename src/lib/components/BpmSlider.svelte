<script lang="ts">
  import { MIN_BPM, MAX_BPM, DEFAULT_BPM, clampBpm } from '$lib/noteDuration';
  let { bpm = $bindable() }: { bpm: number } = $props();

  const sliderPercent = $derived(((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100);

  function commitInput(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    bpm = clampBpm(isNaN(v) || v < 1 ? DEFAULT_BPM : v);
  }
</script>

<div class="space-y-1">
  <div class="flex items-center gap-2">
    <span class="text-xs text-gray-400 flex-shrink-0">BPM</span>
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      value={bpm}
      onchange={commitInput}
      onkeydown={(e) => { if (e.key === 'Enter') commitInput(e); }}
      class="w-16 px-2 py-1 text-sm bg-gray-700 text-gray-200 rounded text-center font-mono border border-gray-600 focus:outline-none focus:border-teal-500"
    />
  </div>
  <input
    type="range"
    min={MIN_BPM}
    max={MAX_BPM}
    value={bpm}
    oninput={(e) => (bpm = clampBpm(Number((e.target as HTMLInputElement).value)))}
    class="w-full h-2 rounded-full appearance-none cursor-pointer slider-custom"
    style="background: linear-gradient(to right, #14b8a6 0%, #14b8a6 {sliderPercent}%, #4b5563 {sliderPercent}%, #4b5563 100%)"
  />
</div>

<style>
  .slider-custom::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #14b8a6;
    cursor: pointer;
  }
  .slider-custom::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #14b8a6;
    cursor: pointer;
    border: none;
  }
</style>
