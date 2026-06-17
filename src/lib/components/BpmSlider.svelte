<script lang="ts">
  import { MIN_BPM, MAX_BPM, clampBpm } from '$lib/noteDuration';
  let { bpm = $bindable() }: { bpm: number } = $props();

  const sliderPercent = $derived(((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100);
</script>

<div class="flex items-center gap-3">
  <span class="text-xs text-gray-400 w-8 flex-shrink-0">BPM</span>
  <input
    type="range"
    min={MIN_BPM}
    max={MAX_BPM}
    value={bpm}
    oninput={(e) => (bpm = clampBpm(Number((e.target as HTMLInputElement).value)))}
    class="flex-1 h-2 rounded-full appearance-none cursor-pointer slider-custom"
    style="background: linear-gradient(to right, #14b8a6 0%, #14b8a6 {sliderPercent}%, #4b5563 {sliderPercent}%, #4b5563 100%)"
  />
  <span class="text-sm font-mono w-10 text-right flex-shrink-0">{bpm}</span>
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
