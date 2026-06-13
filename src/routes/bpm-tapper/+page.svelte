<script lang="ts">
  type TapRecord = {
    index: number;
    timestamp: Date;
    intervalMs: number | null;
    instantBpm: number | null;
  };

  let tapHistory = $state<TapRecord[]>([]);
  let sliderValue = $state(0);
  let isTapAnimating = $state(false);
  let isRippling = $state(false);
  let tapKey = $state(0);
  let rippleKey = $state(0);
  let isResetPressed = $state(false);

  const effectiveSliderValue = $derived(100 - sliderValue);
  const intervalCount = $derived(tapHistory.length - 1);
  const n = $derived(
    intervalCount > 0
      ? Math.max(1, Math.floor(intervalCount * effectiveSliderValue / 100))
      : 0
  );
  const showDivider = $derived(intervalCount > 0 && n < intervalCount);

  const mainBpm = $derived.by(() => {
    if (tapHistory.length < 2) return null;
    const intervals = tapHistory.slice(1).map(t => t.intervalMs!);
    const nVal = Math.max(1, Math.floor(intervals.length * effectiveSliderValue / 100));
    const recent = intervals.slice(-nVal);
    return 60000 / (recent.reduce((a, b) => a + b, 0) / recent.length);
  });

  const avgTapLabel = $derived.by(() => {
    if (tapHistory.length === 0) return 'Tap the button to start';
    if (intervalCount <= 0) return 'Tap again to measure BPM';
    return n === 1 ? 'Instant BPM (1 tap)' : `Averaging last ${n} taps`;
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

    const nVal = Math.max(1, Math.floor(bpmPoints.length * effectiveSliderValue / 100));
    const splitIndex = bpmPoints.length - nVal;
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
    sliderValue = 0;
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

<div class="flex flex-col items-center w-full">

  <!-- Header -->
  <div class="w-full text-center py-3 px-4 border-b border-gray-200">
    <h1 class="text-3xl font-bold tracking-tight">Tap BPM</h1>
    <p class="text-sm text-gray-500 mt-1 mb-2">Tap the button to the beat to measure your BPM</p>
  </div>

  <!-- BPM Display -->
  <div class="text-center pt-4 pb-2">
    <div class="bpm-value font-bold tabular-nums leading-none tracking-tighter">
      {mainBpm !== null ? Math.round(mainBpm) : '---'}
    </div>
    <div class="text-xl text-gray-500 font-medium mt-1">BPM</div>
  </div>

  <!-- TAP Button -->
  <div class="flex justify-center py-8">
    {#key tapKey}
      <button
        type="button"
        class="tap-button"
        class:tap-anim={isTapAnimating}
        onpointerdown={handleTap}
      >
        <span class="relative z-10 font-bold">TAP</span>
        {#key rippleKey}
          <span class="ripple" class:active={isRippling}></span>
        {/key}
      </button>
    {/key}
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

  <!-- Slider -->
  <div class="flex gap-1 px-4 pt-1 w-full max-w-sm">
    <div class="w-8 shrink-0"></div>
    <div class="flex-1 min-w-0 pl-2">
      <input
        type="range"
        aria-label="Averaging window"
        min="0" max="100" step="1"
        disabled={tapHistory.length === 0}
        bind:value={sliderValue}
        class="w-full accent-blue-600 disabled:opacity-40"
      />
    </div>
  </div>

  <!-- SVG Chart -->
  {#if chartData}
    <div class="w-full px-4 pt-2">
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
          <polyline points={chartData.inPolyline} fill="none" stroke="#0d6efd" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
    </div>
  {/if}

  <!-- History Table -->
  {#if tapHistory.length > 0}
    <div class="w-full history-section mt-2">
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

</div>

<style>
  .bpm-value {
    font-size: clamp(4rem, 20vw, 7rem);
  }

  .tap-button {
    width: min(70vw, 260px);
    height: min(70vw, 260px);
    border-radius: 50%;
    background-color: #0d6efd;
    color: #fff;
    font-size: clamp(1.5rem, 6vw, 2.5rem);
    border: none;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    box-shadow: 0 4px 20px rgba(13, 110, 253, 0.35);
    position: relative;
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
    background: rgba(13, 110, 253, 0.45);
    transform: scale(1);
    transform-origin: center;
    opacity: 0;
    pointer-events: none;
  }

  .ripple.active {
    animation: ripple-expand 0.184s ease-out 46ms forwards;
  }

  @keyframes ripple-expand {
    from { transform: scale(1); opacity: 1; }
    to   { transform: scale(1.5); opacity: 0; }
  }

  .reset-button {
    width: min(70vw, 260px);
    height: 3rem;
    border-radius: 9999px;
    border: 2px solid #6c757d;
    background: transparent;
    color: #6c757d;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
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
    background-color: #0d6efd;
    opacity: 0.5;
  }

  .out-of-range {
    opacity: 0.35;
  }
</style>
