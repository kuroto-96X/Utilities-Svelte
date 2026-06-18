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

  // 重なり状態から右ドラッグ時に high を操作するフラグ
  let draggingHighFromLow = false;
  // ドラッグ開始時点での重なり状態（開始後に重なった場合と区別するため）
  let lowStartedOverlapping = false;

  $effect(() => {
    const reset = () => { draggingHighFromLow = false; };
    window.addEventListener('pointerup', reset);
    return () => window.removeEventListener('pointerup', reset);
  });

  function onContainerPointerdown() {
    draggingHighFromLow = false;
    lowStartedOverlapping = (low >= high);
  }

  function onLowInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const v = Number(target.value);
    if (draggingHighFromLow) {
      if (v <= low) {
        // low の位置まで戻ったら転送終了
        draggingHighFromLow = false;
        high = low;
        low = v;
      } else {
        high = v;
      }
    } else if (v > high && lowStartedOverlapping) {
      // 重なり状態から右へ: high を動かすモードに入る
      draggingHighFromLow = true;
      high = v;
    } else {
      low = Math.min(v, high);
    }
    target.value = String(low); // 視覚的な位置を強制更新
  }

  function onHighInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const v = Number(target.value);
    high = Math.max(v, low);
    target.value = String(high); // 視覚的な位置を強制更新
  }
</script>

<div class="flex items-center gap-2" onpointerdown={onContainerPointerdown}>
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
