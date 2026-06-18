<!-- src/lib/components/RangeSlider.svelte -->
<script lang="ts">
  let {
    min,
    max,
    step = 1,
    low = $bindable(),
    high = $bindable(),
    formatter = (v: number) => String(v),
  }: {
    min: number;
    max: number;
    step?: number;
    low: number;
    high: number;
    formatter?: (v: number) => string;
  } = $props();

  const range = $derived(max - min || 1);
  const lowPct  = $derived(((low  - min) / range) * 100);
  const highPct = $derived(((high - min) / range) * 100);

  // low 入力が high を右に越えたとき、high として機能するフラグ
  let draggingHighFromLow = false;
  // high 入力が low を左に越えたとき、low として機能するフラグ
  // $state にすることで pointerup 時に再レンダリングが走り value={high} が同期される
  let draggingLowFromHigh = $state(false);

  $effect(() => {
    const reset = () => { draggingHighFromLow = false; draggingLowFromHigh = false; };
    window.addEventListener('pointerup', reset);
    return () => window.removeEventListener('pointerup', reset);
  });

  function onLowInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const v = Number(target.value);
    if (draggingHighFromLow) {
      if (v < low) {
        // high を越えて左に戻った → 役割を戻す
        draggingHighFromLow = false;
        high = low;
        low = v;
      } else {
        high = v;
      }
    } else {
      if (v >= high) {
        // high に重なった・越えた → high として動かすモードへ
        draggingHighFromLow = true;
        low = high;
        high = v;
      } else {
        low = v;
      }
    }
    target.value = String(low);
  }

  function onHighInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const v = Number(target.value);
    if (draggingLowFromHigh) {
      if (v > high) {
        // low を越えて右に戻った → 役割を戻す
        draggingLowFromHigh = false;
        low = high;
        high = v;
      } else {
        low = v;
      }
    } else {
      if (v <= low) {
        // low に重なった・越えた → low として動かすモードへ
        draggingLowFromHigh = true;
        high = low;
        low = v;
      } else {
        high = v;
      }
    }
    // high 入力はスナップしない → ポインターに追従させる
    // pointerup 時に $state 変化で再レンダリングされ value={high} が正しく同期される
  }
</script>

<div class="flex items-center gap-2">
  <span class="text-xs text-gray-300 font-mono w-10 text-right">{formatter(low)}</span>
  <div class="relative w-32 h-5 flex items-center">
    <div class="absolute w-full h-1.5 rounded-full bg-gray-600 pointer-events-none"></div>
    <div
      class="absolute h-1.5 rounded-full bg-teal-500 pointer-events-none"
      style="left: {lowPct}%; width: {highPct - lowPct}%"
    ></div>
    <input
      type="range" {min} {max} {step} value={low}
      oninput={onLowInput}
      style="z-index: {low >= high ? 5 : 3}"
    />
    <input
      type="range" {min} {max} {step} value={high}
      oninput={onHighInput}
      style="z-index: 4"
    />
  </div>
  <span class="text-xs text-gray-300 font-mono w-10">{formatter(high)}</span>
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
