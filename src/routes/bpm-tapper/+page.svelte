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
    const nVal = Math.max(1, Math.floor(intervalCount * effectiveSliderValue / 100));
    return nVal === 1 ? 'Instant BPM (1 tap)' : `Averaging last ${nVal} taps`;
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

<div>placeholder</div>
