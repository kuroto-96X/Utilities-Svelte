<!-- src/lib/components/RangeSlider.svelte -->
<script lang="ts">
  let {
    min,
    max,
    step = 1,
    low = $bindable(),
    high = $bindable(),
    formatter = (v: number) => String(v),
    showLabels = true,
  }: {
    min: number;
    max: number;
    step?: number;
    low: number;
    high: number;
    formatter?: (v: number) => string;
    showLabels?: boolean;
  } = $props();

  const range = $derived(max - min || 1);
  const lowPct  = $derived(((low  - min) / range) * 100);
  const highPct = $derived(((high - min) / range) * 100);

  // $state にしてフラグ変化時に再レンダリングを起こす（アンカー表示の同期に必要）
  let draggingHighFromLow = $state(false);
  let draggingLowFromHigh = $state(false);

  // ルーティング中はアンカー側の入力がアンカー位置を表示し続ける
  // これにより target.value スナップ不要になり、ドラッグ中の入力は自然追従できる
  const lowInputValue  = $derived(draggingLowFromHigh  ? high : low);
  const highInputValue = $derived(draggingHighFromLow  ? low  : high);

  $effect(() => {
    const reset = () => { draggingHighFromLow = false; draggingLowFromHigh = false; };
    window.addEventListener('pointerup', reset);
    return () => window.removeEventListener('pointerup', reset);
  });

  function onLowInput(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    if (draggingHighFromLow) {
      if (v <= low) {
        draggingHighFromLow = false;
        high = low;
        low = v;
      } else {
        high = v;
      }
    } else if (v >= high) {
      draggingHighFromLow = true;
      low = high;
      high = v;
    } else {
      low = v;
    }
  }

  function onHighInput(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    if (draggingLowFromHigh) {
      if (v >= high) {
        draggingLowFromHigh = false;
        low = high;
        high = v;
      } else {
        low = v;
      }
    } else if (v <= low) {
      draggingLowFromHigh = true;
      high = low;
      low = v;
    } else {
      high = v;
    }
  }
</script>

<div class="flex items-center gap-2">
  {#if showLabels}
    <span class="text-xs text-gray-300 font-mono w-10 text-right">{formatter(low)}</span>
  {/if}
  <div class="relative w-32 h-5 flex items-center">
    <div class="absolute w-full h-1.5 rounded-full bg-gray-600 pointer-events-none"></div>
    <div
      class="absolute h-1.5 rounded-full bg-teal-500 pointer-events-none"
      style="left: {lowPct}%; width: {highPct - lowPct}%"
    ></div>
    <input
      type="range" {min} {max} {step} value={lowInputValue}
      oninput={onLowInput}
      style="z-index: {low >= high ? 5 : 3}"
    />
    <input
      type="range" {min} {max} {step} value={highInputValue}
      oninput={onHighInput}
      style="z-index: 4"
    />
  </div>
  {#if showLabels}
    <span class="text-xs text-gray-300 font-mono w-10">{formatter(high)}</span>
  {/if}
</div>

<style>
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    pointer-events: none;
    margin: 0;
    padding: 0;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    background: transparent;
  }

  input[type="range"]::-moz-range-track {
    background: transparent;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 2px solid #14b8a6;
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    pointer-events: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 2px solid #14b8a6;
    cursor: pointer;
  }
</style>
