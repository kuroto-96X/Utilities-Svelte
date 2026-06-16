<script lang="ts">
  import { DEFAULT_BPM } from '$lib/noteDuration'

  type TapRecord = {
    index: number;
    timestamp: Date;
    intervalMs: number | null;
    instantBpm: number | null;
  };

  let tapHistory = $state<TapRecord[]>([]);
  let sliderValue = $state(1); // 1 = 全件（左端）, intervalCount = 最新1件（右端）
  let isTapAnimating = $state(false);
  let isRippling = $state(false);
  let tapKey = $state(0);
  let rippleKey = $state(0);
  let isResetPressed = $state(false);

  const intervalCount = $derived(tapHistory.length - 1);
  const n = $derived(
    intervalCount > 0
      ? Math.max(1, Math.min(intervalCount, intervalCount + 1 - sliderValue))
      : 0
  );
  const showDivider = $derived(intervalCount > 0 && n < intervalCount);

  const mainBpm = $derived.by(() => {
    if (tapHistory.length < 2) return null;
    const intervals = tapHistory.slice(1).map(t => t.intervalMs!);
    const recent = intervals.slice(-n);
    return 60000 / (recent.reduce((a, b) => a + b, 0) / recent.length);
  });

  const avgTapLabel = $derived.by(() => {
    if (tapHistory.length === 0) return 'Tap the button to start';
    if (intervalCount <= 0) return 'Tap again to measure BPM';
    return n === 1 ? 'Instant BPM (1 tap)' : `Averaging last ${n} taps`;
  });

  const sliderPercent = $derived.by(() => {
    const max = Math.max(1, intervalCount);
    if (max <= 1) return 0;
    return ((sliderValue - 1) / (max - 1)) * 100;
  });

  const bpmPoints = $derived(
    tapHistory.filter(t => t.instantBpm !== null).map(t => t.instantBpm!)
  );

  const chartData = $derived.by(() => {
    if (bpmPoints.length < 2) return null;

    const minB = Math.min(...bpmPoints);
    const maxB = Math.max(...bpmPoints);
    const bpmRange = Math.max(maxB - minB, 10);
    const yMin = minB - bpmRange * 0.15;
    const yMax = maxB + bpmRange * 0.15;
    const chartMinInt = Math.round(minB);
    const chartMaxInt = Math.round(maxB);

    const svgW = 400, svgH = 80, padX = 8, padY = 8;
    const xStep = (svgW - padX * 2) / (bpmPoints.length - 1);

    const allPts = bpmPoints.map((bpm, i) => {
      const x = padX + i * xStep;
      const y = svgH - padY - (bpm - yMin) / (yMax - yMin) * (svgH - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const splitIndex = Math.max(0, bpmPoints.length - n);
    const outPolyline = splitIndex > 0 ? allPts.slice(0, splitIndex + 1).join(' ') : '';
    const inPolyline = allPts.slice(splitIndex).join(' ');

    let mainBpmPath = '';
    let mainBpmLabelTopPx = -1;
    if (mainBpm !== null) {
      const raw = svgH - padY - (mainBpm - yMin) / (yMax - yMin) * (svgH - padY * 2);
      const my = Math.max(padY, Math.min(svgH - padY, raw));
      mainBpmPath = `M${padX} ${my.toFixed(1)} L${svgW - padX} ${my.toFixed(1)}`;
      mainBpmLabelTopPx = my;
    }

    return { chartMinInt, chartMaxInt, inPolyline, outPolyline, mainBpmPath, mainBpmLabelTopPx };
  });

  function handleTap() {
    tapKey++;
    const myTapKey = tapKey;
    isTapAnimating = true;

    rippleKey++;
    const myRippleKey = rippleKey;
    isRippling = true;

    const now = new Date();
    const prev = tapHistory.length > 0 ? tapHistory[tapHistory.length - 1] : null;
    const intervalMs = prev ? now.getTime() - prev.timestamp.getTime() : null;
    const instantBpm = intervalMs !== null ? 60000 / intervalMs : null;

    tapHistory = [
      ...tapHistory,
      { index: tapHistory.length + 1, timestamp: now, intervalMs, instantBpm }
    ];

    setTimeout(() => {
      if (tapKey === myTapKey) isTapAnimating = false;
      if (rippleKey === myRippleKey) isRippling = false;
    }, 230);
  }

  function handleReset() {
    tapHistory = [];
    sliderValue = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatTime(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }
</script>

<svelte:head>
  <title>Tap BPM</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6">
<div class="bg-white rounded-xl border border-slate-200 shadow-sm">
<div class="flex flex-col items-center w-full">

  <!-- BPM Display -->
  <div class="text-center pt-4 pb-2">
    <div class="bpm-value font-bold tabular-nums leading-none tracking-tighter">
      {mainBpm !== null ? Math.round(mainBpm) : '---'}
    </div>
    <div class="text-xl text-gray-500 font-medium mt-1">BPM</div>
  </div>

  <!-- TAP Button -->
  <div class="flex justify-center py-8">
    <div class="tap-button-wrapper">
      {#key rippleKey}
        <span class="ripple" class:active={isRippling}></span>
      {/key}
      {#key tapKey}
        <button
          type="button"
          class="tap-button"
          class:tap-anim={isTapAnimating}
          onpointerdown={handleTap}
        >
          <span class="relative z-10 font-bold">TAP</span>
        </button>
      {/key}
    </div>
  </div>

  <!-- Reset Button -->
  <div class="flex justify-center pb-4">
    <button
      type="button"
      class="reset-button"
      class:pressed={isResetPressed}
      onclick={handleReset}
      onpointerdown={() => (isResetPressed = true)}
      onpointerup={() => (isResetPressed = false)}
      onpointerleave={() => (isResetPressed = false)}
      onpointercancel={() => (isResetPressed = false)}
    >Reset</button>
  </div>

  <!-- Avg Label -->
  <div class="text-center text-sm text-gray-500 px-4 min-h-5">{avgTapLabel}</div>

  <!-- Slider + SVG Chart -->
  {#if chartData}
    <div class="flex gap-1 px-4 pt-1 w-full max-w-sm">
      <div class="w-8 shrink-0"></div>
      <div class="flex-1 min-w-0 pl-2">
        <input
          type="range"
          aria-label="Averaging window"
          min="1" max={Math.max(1, intervalCount)} step="1"
          bind:value={sliderValue}
          class="w-full slider-custom"
          style="background: linear-gradient(to right, #adb5bd 0%, #adb5bd {sliderPercent}%, #0f766e {sliderPercent}%, #0f766e 100%)"
        />
      </div>
    </div>
    <div class="w-full max-w-sm px-4 pt-2">
      <div class="flex items-stretch gap-1">
        <div class="chart-y-labels">
          <span>{chartData.chartMaxInt}</span>
          {#if chartData.mainBpmLabelTopPx >= 0}
            <span class="chart-main-label" style="top: {chartData.mainBpmLabelTopPx.toFixed(1)}px">
              {mainBpm !== null ? Math.round(mainBpm) : ''}
            </span>
          {/if}
          <span>{chartData.chartMinInt}</span>
        </div>
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" class="bpm-chart" aria-label="BPM over time">
          {#if chartData.mainBpmPath}
            <path d={chartData.mainBpmPath} stroke="#dc3545" stroke-width="1.5" stroke-dasharray="4 3" fill="none" />
          {/if}
          {#if chartData.outPolyline}
            <polyline points={chartData.outPolyline} fill="none" stroke="#adb5bd" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          {/if}
          <polyline points={chartData.inPolyline} fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
    </div>
  {/if}

  <!-- History Table -->
  {#if tapHistory.length > 0}
    <div class="w-full max-w-sm history-section mt-2">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-800 text-white">
              <th scope="col" class="px-3 py-2 text-left font-semibold">#</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold">Time</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold">Interval (ms)</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold">Instant BPM</th>
            </tr>
          </thead>
          <tbody>
            {#each [...tapHistory].reverse() as tap, j}
              {#if showDivider && j === n}
                <tr class="range-divider"><td colspan="4"></td></tr>
              {/if}
              <tr class:out-of-range={showDivider && j >= n} class="odd:bg-gray-50">
                <td class="px-3 py-1">{tap.index}</td>
                <td class="px-3 py-1 font-mono text-xs">{formatTime(tap.timestamp)}</td>
                <td class="px-3 py-1">{tap.intervalMs !== null ? Math.round(tap.intervalMs) : '-'}</td>
                <td class="px-3 py-1">{tap.instantBpm !== null ? Math.round(tap.instantBpm) : '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- Description -->
  <div class="w-full max-w-sm px-4 py-5 mt-2 border-t border-slate-100">
    <h2 class="text-sm font-semibold text-slate-700 mb-2">BPM Tapperとは</h2>
    <p class="text-xs text-slate-500 leading-relaxed">
      音楽のビートに合わせてTAPボタンを叩くと、テンポ（BPM）をリアルタイムで測定します。
      タップするたびに直前との間隔から瞬間BPMを算出し、その平均値を大きく表示します。
    </p>
    <h2 class="text-sm font-semibold text-slate-700 mt-4 mb-2">スライダーについて</h2>
    <p class="text-xs text-slate-500 leading-relaxed">
      スライダーで平均を取るタップ数を調整できます。
      左端では全タップの平均、右端では直近1タップのみの瞬間BPMを表示します。
      グラフの青い折れ線が平均範囲、灰色が対象外のタップを示しています。
    </p>
    <div class="mt-4 pt-3 border-t border-slate-100 text-center">
      <a
        href="/note-duration?bpm={mainBpm !== null ? Math.round(mainBpm) : DEFAULT_BPM}"
        class="text-sm font-medium text-teal-700 hover:underline"
      >音符換算で開く →</a>
    </div>
  </div>

</div>
</div>
</div>

<style>
  .bpm-value {
    font-size: clamp(4rem, 20vw, 7rem);
  }

  .tap-button-wrapper {
    position: relative;
    width: min(52.5vw, 195px);
    height: min(52.5vw, 195px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tap-button {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, #0f766e, #0284c7);
    color: #fff;
    font-size: clamp(1.5rem, 6vw, 2.5rem);
    border: none;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 4px 20px rgba(15, 118, 110, 0.35);
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tap-button.tap-anim {
    animation: tap-bounce 0.23s ease-out;
  }

  @keyframes tap-bounce {
    0%   { transform: scale(1); }
    20%  { transform: scale(0.76); }
    100% { transform: scale(1); }
  }

  .ripple {
    position: absolute;
    border-radius: 50%;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background: rgba(15, 118, 110, 0.4);
    transform: scale(0.76);
    transform-origin: center;
    opacity: 0;
    pointer-events: none;
    z-index: 0;
  }

  .ripple.active {
    animation: ripple-expand 0.23s ease-out 46ms forwards;
  }

  @keyframes ripple-expand {
    from { transform: scale(0.76); opacity: 1; }
    to   { transform: scale(1.5); opacity: 0; }
  }

  .reset-button {
    width: min(52.5vw, 195px);
    height: 3rem;
    border-radius: 9999px;
    border: 2px solid #6c757d;
    background: transparent;
    color: #6c757d;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s, color 0.15s;
  }

  .reset-button.pressed {
    background: #6c757d;
    color: #fff;
  }

  .chart-y-labels {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 0.65rem;
    line-height: 1;
    color: #6c757d;
    text-align: right;
    min-width: 2rem;
  }

  .chart-main-label {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
    color: #dc3545;
    font-size: 0.65rem;
    line-height: 1;
  }

  .bpm-chart {
    flex: 1;
    height: 80px;
    display: block;
    min-width: 0;
  }

  .history-section {
    max-height: 40vh;
    overflow-y: auto;
  }

  .range-divider td {
    padding: 0;
    height: 2px;
    background-color: #0f766e;
    opacity: 0.5;
  }

  .out-of-range {
    opacity: 0.35;
  }

  .slider-custom {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .slider-custom:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .slider-custom::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #0f766e;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .slider-custom::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #0f766e;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
</style>
