<!-- src/lib/components/MelodyGenerator.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { calculateNoteDurations } from '$lib/noteDuration';
  import { NOTE_NAMES } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';
  import RangeSlider from '$lib/components/RangeSlider.svelte';
  import { pickRhythmTemplate, RHYTHM_PATTERNS } from '$lib/melodyRhythms';

  let {
    intervals,
    rootPc,
    bpm,
    scaleName = '',
    startSemitone = -3,
    octaves = 2,
    addPlayingPc,
    removePlayingPc,
    addPlayingMidi,
    removePlayingMidi,
    onplay,
    stopCount = 0,
  }: {
    intervals: number[];
    rootPc: number;
    bpm: number;
    scaleName?: string;
    startSemitone?: number;
    octaves?: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    addPlayingMidi?: (midi: number) => void;
    removePlayingMidi?: (midi: number) => void;
    onplay?: () => void;
    stopCount?: number;
  } = $props();

  $effect(() => {
    if (stopCount === 0) return;
    stopMelody();
  });

  const NOTE_LABELS = ['32分', '16分', '8分', '4分', '2分', '全'];
  const BARS_OPTIONS = [1, 2, 4];
  const CONTOUR_OPTIONS = [
    { id: 'random',     label: 'ランダム' },
    { id: 'ascending',  label: '上昇傾向' },
    { id: 'descending', label: '下降傾向' },
    { id: 'arch',       label: '山型' },
    { id: 'valley',     label: '谷型' },
  ] as const;

  type ContourPattern = 'random' | 'ascending' | 'descending' | 'arch' | 'valley';

  let bars = $state(2);
  let minNoteIdx = $state(2); // 8分音符
  let maxNoteIdx = $state(3); // 4分音符
  let useDotted = $state(false);
  let useTriplet = $state(false);
  let useMotifRepeat = $state(true);
  let rhythmPatternId = $state('random');
  let maxStep = $state(2);
  let pattern = $state<ContourPattern>('random');
  let isPlaying = $state(false);
  let currentNoteIdx = $state<number | null>(null);

  // 鍵盤の表示範囲に合わせてオクターブ展開
  const extendedIntervals = $derived.by(() => {
    const baseMidi = 57 + ((rootPc - 9 + 12) % 12);
    const minInterval = (60 + startSemitone) - baseMidi;
    const maxInterval = (60 + startSemitone + 12 * octaves - 1) - baseMidi;
    const result: number[] = [];
    const minOct = Math.floor(minInterval / 12);
    const maxOct = Math.floor(maxInterval / 12);
    for (let oct = minOct; oct <= maxOct; oct++) {
      for (const iv of intervals) {
        const shifted = iv + oct * 12;
        if (shifted >= minInterval && shifted <= maxInterval) result.push(shifted);
      }
    }
    result.sort((a, b) => a - b);
    return result;
  });

  interface MelodyNote { degreeIndex: number; interval: number; pc: number; duration: number; }

  const MELODY_HISTORY_KEY = 'melodyHistory';
  const MAX_MELODY_HISTORY = 9;

  interface MelodyHistoryEntry {
    id: string;
    rootPc: number;
    scaleName: string;
    notes: MelodyNote[];
  }

  function loadMelodyHistory(): MelodyHistoryEntry[] {
    if (!browser) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(MELODY_HISTORY_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((e: unknown) =>
        typeof (e as MelodyHistoryEntry).id === 'string' && Array.isArray((e as MelodyHistoryEntry).notes)
      ) as MelodyHistoryEntry[];
    } catch { return []; }
  }

  function saveMelodyHistory(h: MelodyHistoryEntry[]) {
    if (!browser) return;
    localStorage.setItem(MELODY_HISTORY_KEY, JSON.stringify(h));
  }

  let melodyHistory = $state<MelodyHistoryEntry[]>(loadMelodyHistory());
  let activeHistoryId = $state<string | null>(null);

  let cachedMelody = $state<MelodyNote[] | null>(null);

  interface RollNote { midi: number; pc: number; start: number; end: number; }
  const rollNotes = $derived.by((): RollNote[] | null => {
    if (!cachedMelody) return null;
    let cum = 0;
    return cachedMelody.map(note => {
      const start = cum;
      cum += note.duration;
      return {
        midi: 57 + ((rootPc - 9 + 12) % 12) + note.interval,
        pc: note.pc,
        start,
        end: cum,
      };
    });
  });

  function buildDurationPool(): { pool: number[]; tripletSet: Set<number> } {
    const noteDurations = calculateNoteDurations(bpm);
    const ascDurations = [...noteDurations].reverse(); // index0=32分, index5=全音符
    const slice = ascDurations.slice(minNoteIdx, maxNoteIdx + 1);
    const pool: number[] = [];
    const tripletSet = new Set<number>();
    slice.forEach(nv => {
      pool.push(nv.normalSec);
      if (useDotted) pool.push(nv.dottedSec);
      if (useTriplet) {
        pool.push(nv.tripletSec);
        tripletSet.add(nv.tripletSec);
      }
    });
    return {
      pool: pool.length > 0 ? pool : [ascDurations[2].normalSec],
      tripletSet,
    };
  }

  // --- メロディ構造ヘルパー ---

  const STEP_BASE_WEIGHTS = [28, 12, 6, 3, 2]; // index0=距離1, index1=距離2, ...

  // ルートと5度相当音のインデックスを収集（オクターブをまたいで対応）
  function getStableIndices(ivs: number[]): number[] {
    const pc = (iv: number) => ((iv % 12) + 12) % 12;
    const result: number[] = [];
    const octaves = [...new Set(ivs.map(iv => Math.floor(iv / 12)))].sort((a, b) => a - b);
    for (const oct of octaves) {
      const items = ivs.map((iv, i) => ({ iv, i })).filter(({ iv }) => Math.floor(iv / 12) === oct);
      const root = items.find(({ iv }) => pc(iv) === 0);
      if (root) result.push(root.i);
      const fifth = items.reduce((best, cur) =>
        Math.abs(pc(cur.iv) - 7) < Math.abs(pc(best.iv) - 7) ? cur : best, items[0]);
      if (fifth && !result.includes(fifth.i)) result.push(fifth.i);
    }
    return result.length > 0 ? result : [0];
  }

  // パターンに応じた開始インデックスを選ぶ
  function pickStartIndex(rangeSize: number, pat: ContourPattern): number {
    if (rangeSize <= 1) return 0;
    const third = Math.max(1, Math.floor(rangeSize / 3));
    switch (pat) {
      case 'ascending':
      case 'arch':
        return Math.floor(Math.random() * third);
      case 'descending':
      case 'valley':
        return rangeSize - 1 - Math.floor(Math.random() * third);
      default:
        return Math.floor(Math.random() * rangeSize);
    }
  }

  function biasRatioFor(pat: ContourPattern, progress: number): number {
    switch (pat) {
      case 'ascending':  return 0.93;
      case 'descending': return 0.07;
      case 'arch':   return progress < 0.5 ? 0.93 : 0.07;
      case 'valley': return progress < 0.5 ? 0.07 : 0.93;
      default: return 0.5;
    }
  }

  function weightedDelta(ms: number, biasRatio: number): number {
    const weights: { delta: number; weight: number }[] = [{ delta: 0, weight: 3 }];
    for (let d = 1; d <= ms; d++) {
      const base = STEP_BASE_WEIGHTS[d - 1] ?? 1;
      weights.push({ delta:  d, weight: base * (biasRatio * 2) });
      weights.push({ delta: -d, weight: base * ((1 - biasRatio) * 2) });
    }
    const total = weights.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of weights) {
      if (r < w.weight) return w.delta;
      r -= w.weight;
    }
    return 0;
  }

  function isStrongBeat(cumulative: number, secPerBeat: number): boolean {
    const beatIndex = Math.round(cumulative / secPerBeat);
    const onBoundary = Math.abs(cumulative - beatIndex * secPerBeat) < secPerBeat * 0.05;
    return onBoundary && beatIndex % 2 === 0;
  }

  function nearestStable(currentIdx: number, stableIndices: number[]): number {
    return stableIndices.reduce((best, c) =>
      Math.abs(c - currentIdx) < Math.abs(best - currentIdx) ? c : best, stableIndices[0]);
  }

  function moveTowardStable(currentIdx: number, stableIndices: number[], ms: number): number {
    const target = nearestStable(currentIdx, stableIndices);
    const diff = target - currentIdx;
    const step = Math.max(-ms, Math.min(ms, diff));
    return currentIdx + step;
  }

  function pickDuration(pool: number[], strongBeat: boolean): number {
    if (pool.length === 1) return pool[0];
    const sorted = [...pool].sort((a, b) => a - b);
    const mid = Math.ceil(sorted.length / 2);
    const shorterHalf = sorted.slice(0, mid);
    const longerHalf = sorted.slice(mid);
    const useLonger = strongBeat ? Math.random() < 0.7 : Math.random() < 0.3;
    const bucket = useLonger && longerHalf.length > 0 ? longerHalf : shorterHalf;
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  function generateStructuredPhrase(
    ivs: number[], rpc: number, secPerBeat: number, pool: number[], tripletSet: Set<number>,
    targetSeconds: number, ms: number, pat: ContourPattern
  ): MelodyNote[] {
    const stableIndices = getStableIndices(ivs);
    const seq: MelodyNote[] = [];
    let cumulative = 0;
    let currentIdx = pickStartIndex(ivs.length, pat);
    let guard = 0;
    let tripletRemaining = 0;
    let forcedTripletDur = 0;

    while (cumulative < targetSeconds && guard < 300) {
      guard++;
      const strong = isStrongBeat(cumulative, secPerBeat);
      const progress = cumulative / targetSeconds;

      if (strong && Math.random() < 0.6) {
        currentIdx = moveTowardStable(currentIdx, stableIndices, ms);
      } else {
        const biasRatio = biasRatioFor(pat, progress);
        const delta = weightedDelta(ms, biasRatio);
        const raw = currentIdx + delta;
        const last = ivs.length - 1;
        if (raw < 0) {
          currentIdx = Math.min(last, -raw);
        } else if (raw > last) {
          currentIdx = Math.max(0, 2 * last - raw);
        } else {
          currentIdx = raw;
        }
      }

      let duration: number;
      if (tripletRemaining > 0) {
        duration = forcedTripletDur;
        tripletRemaining--;
      } else {
        duration = pickDuration(pool, strong);
        if (tripletSet.has(duration)) {
          forcedTripletDur = duration;
          tripletRemaining = 2;
        }
      }

      seq.push({
        degreeIndex: currentIdx,
        interval: ivs[currentIdx],
        pc: (rpc + ivs[currentIdx]) % 12,
        duration,
      });
      cumulative += duration;
    }
    return seq;
  }

  function buildPhraseWithMotif(
    ivs: number[], rpc: number, secPerBeat: number, pool: number[], tripletSet: Set<number>,
    targetSeconds: number, ms: number, pat: ContourPattern
  ): MelodyNote[] {
    const motif = generateStructuredPhrase(ivs, rpc, secPerBeat, pool, tripletSet, targetSeconds / 2, ms, pat);
    const shift = Math.random() < 0.5 ? 1 : 0;
    const second = motif.map(n => {
      const newIdx = Math.max(0, Math.min(ivs.length - 1, n.degreeIndex + shift));
      return {
        degreeIndex: newIdx,
        interval: ivs[newIdx],
        pc: (rpc + ivs[newIdx]) % 12,
        duration: n.duration,
      };
    });
    return [...motif, ...second];
  }

  function generateWithRhythmTemplate(
    ivs: number[], rpc: number,
    durations: number[], ms: number, pat: ContourPattern,
    secPerBeat: number
  ): MelodyNote[] {
    const stableIndices = getStableIndices(ivs);
    const totalDur = durations.reduce((s, d) => s + d, 0);
    const seq: MelodyNote[] = [];
    let cumulative = 0;
    let currentIdx = pickStartIndex(ivs.length, pat);

    for (const duration of durations) {
      const strong = isStrongBeat(cumulative, secPerBeat);
      const progress = totalDur > 0 ? cumulative / totalDur : 0;

      if (strong && Math.random() < 0.6) {
        currentIdx = moveTowardStable(currentIdx, stableIndices, ms);
      } else {
        const biasRatio = biasRatioFor(pat, progress);
        const delta = weightedDelta(ms, biasRatio);
        const raw = currentIdx + delta;
        const last = ivs.length - 1;
        if (raw < 0) {
          currentIdx = Math.min(last, -raw);
        } else if (raw > last) {
          currentIdx = Math.max(0, 2 * last - raw);
        } else {
          currentIdx = raw;
        }
      }

      seq.push({
        degreeIndex: currentIdx,
        interval: ivs[currentIdx],
        pc: (rpc + ivs[currentIdx]) % 12,
        duration,
      });
      cumulative += duration;
    }
    return seq;
  }

  function generateMelody(): MelodyNote[] {
    const secPerBeat = 60 / bpm;
    const ivs = extendedIntervals;

    if (rhythmPatternId !== 'none') {
      const id = rhythmPatternId === 'random' ? undefined : rhythmPatternId;
      const durations = pickRhythmTemplate(bars, secPerBeat, id);
      return generateWithRhythmTemplate(ivs, rootPc, durations, maxStep, pattern, secPerBeat);
    }

    const { pool, tripletSet } = buildDurationPool();
    const targetSeconds = bars * 4 * secPerBeat;
    return useMotifRepeat
      ? buildPhraseWithMotif(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern)
      : generateStructuredPhrase(ivs, rootPc, secPerBeat, pool, tripletSet, targetSeconds, maxStep, pattern);
  }

  // 再生セッション管理（セッションIDが変わると進行中のコールバックが無効化される）
  let playSession = 0;
  let activeStopFn: (() => void) | null = null;
  let activePc: number | null = null;
  let activeMidi: number | null = null;

  function stopCurrentNote() {
    activeStopFn?.();
    if (activePc !== null) removePlayingPc(activePc);
    if (activeMidi !== null) removePlayingMidi?.(activeMidi);
    activeStopFn = null; activePc = null; activeMidi = null;
  }

  function stopMelody() {
    playSession++;
    stopCurrentNote();
    isPlaying = false;
    currentNoteIdx = null;
    activeHistoryId = null;
  }

  function playMelodySeq(seq: MelodyNote[]) {
    const mySession = ++playSession;
    stopCurrentNote();
    isPlaying = true;
    currentNoteIdx = null;
    const ctx = getAudioContext();
    let stepIdx = 0;

    function playNextNote() {
      if (playSession !== mySession) return;
      stopCurrentNote();

      if (stepIdx >= seq.length) {
        isPlaying = false;
        currentNoteIdx = null;
        return;
      }

      currentNoteIdx = stepIdx;
      const note = seq[stepIdx];
      const midi = 57 + ((rootPc - 9 + 12) % 12) + note.interval;
      const pc = note.pc;

      activeStopFn = startNoteAt(ctx, midi, ctx.currentTime);
      activePc = pc;
      activeMidi = midi;
      addPlayingPc(pc);
      addPlayingMidi?.(midi);

      stepIdx++;
      setTimeout(playNextNote, note.duration * 1000);
    }

    playNextNote();
  }

  function handleGenerate() {
    onplay?.();
    const seq = generateMelody();
    cachedMelody = seq;
    const entry: MelodyHistoryEntry = {
      id: `mel-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      rootPc,
      scaleName,
      notes: seq,
    };
    const h = [entry, ...melodyHistory].slice(0, MAX_MELODY_HISTORY);
    melodyHistory = h;
    saveMelodyHistory(h);
    activeHistoryId = entry.id;
    playMelodySeq(seq);
  }

  function playHistoryEntry(entry: MelodyHistoryEntry) {
    if (isPlaying && activeHistoryId === entry.id) {
      stopMelody();
    } else {
      onplay?.();
      cachedMelody = entry.notes;
      activeHistoryId = entry.id;
      playMelodySeq(entry.notes);
    }
  }

</script>

<div class="border-t border-gray-700 pt-3">
  <div class="flex flex-col md:flex-row gap-4 items-start">

    <!-- 左列: タイトル・設定・ボタン・チップ -->
    <div class="space-y-3">
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">ランダムメロディ生成</p>

      <!-- 小節数 -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">小節数</span>
          <div class="flex gap-1">
            {#each BARS_OPTIONS as b}
              <button
                class="px-3 py-1.5 text-xs rounded
                  {bars === b ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                onclick={() => (bars = b)}
              >{b}</button>
            {/each}
          </div>
        </div>
        <p class="text-xs text-gray-500 pl-[5.5rem]">再生する小節数を決めます</p>
      </div>

      <!-- 最大度数差 -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">最大度数差</span>
          <div class="flex gap-1">
            {#each [1, 2, 3, 4] as n}
              <button
                class="px-3 py-1.5 text-xs rounded
                  {maxStep === n ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                onclick={() => (maxStep = n)}
              >{n}度</button>
            {/each}
          </div>
        </div>
        <p class="text-xs text-gray-500 pl-[5.5rem]">隣の音との最大距離。小さいほどなだらかなメロディになります</p>
      </div>

      <!-- メロディの形 -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">メロディの形</span>
          <div class="flex flex-wrap gap-1">
            {#each CONTOUR_OPTIONS as opt}
              <button
                class="px-3 py-1.5 text-xs rounded
                  {pattern === opt.id ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
                onclick={() => (pattern = opt.id)}
              >{opt.label}</button>
            {/each}
          </div>
        </div>
        <p class="text-xs text-gray-500 pl-[5.5rem]">フレーズ全体の方向性を決めます</p>
      </div>

      <!-- リズム型 -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">リズム型</span>
          <select
            bind:value={rhythmPatternId}
            class="text-xs bg-gray-700 text-gray-200 rounded px-1.5 py-0.5 border border-gray-600 cursor-pointer"
          >
            <option value="none">なし</option>
            <option value="random">ランダム</option>
            {#each RHYTHM_PATTERNS as pat (pat.id)}
              <option value={pat.id}>{pat.label}  {pat.notation}</option>
            {/each}
          </select>
        </div>
        <p class="text-xs text-gray-500 pl-[5.5rem]">なし＝音符・付点・モチーフ設定を使用可能</p>
      </div>

      <!-- 音符範囲 -->
      <div class="space-y-1 {rhythmPatternId !== 'none' ? 'opacity-40' : ''}" inert={rhythmPatternId !== 'none'}>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 w-20 shrink-0">音符</span>
          <RangeSlider
            min={0} max={5}
            bind:low={minNoteIdx}
            bind:high={maxNoteIdx}
            formatter={(v) => NOTE_LABELS[v]}
            showLabels={false}
          />
          <span class="text-xs text-gray-300 font-mono whitespace-nowrap">{NOTE_LABELS[minNoteIdx]} ~ {NOTE_LABELS[maxNoteIdx]}</span>
        </div>
        <p class="text-xs text-gray-500 pl-[5.5rem]">使用する音符の種類の範囲を決めます</p>
      </div>

      <!-- チェックボックス -->
      <div class="flex gap-3 text-xs">
        <label class="flex items-center gap-1 cursor-pointer {rhythmPatternId !== 'none' ? 'opacity-40 pointer-events-none text-gray-500' : 'text-gray-300'}">
          <input type="checkbox" bind:checked={useDotted} class="accent-teal-500" disabled={rhythmPatternId !== 'none'} />
          付点
        </label>
        <label class="flex items-center gap-1 cursor-pointer {rhythmPatternId !== 'none' ? 'opacity-40 pointer-events-none text-gray-500' : 'text-gray-300'}">
          <input type="checkbox" bind:checked={useTriplet} class="accent-teal-500" disabled={rhythmPatternId !== 'none'} />
          3連符
        </label>
        <label class="flex items-center gap-1 cursor-pointer {rhythmPatternId !== 'none' ? 'opacity-40 pointer-events-none text-gray-500' : 'text-gray-300'}">
          <input type="checkbox" bind:checked={useMotifRepeat} class="accent-teal-500" disabled={rhythmPatternId !== 'none'} />
          モチーフ反復
        </label>
      </div>

      <!-- ボタン -->
      <div class="flex items-center gap-2">
        {#if isPlaying}
          <button
            class="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-500 text-white flex-shrink-0"
            onclick={stopMelody}
          >
            ⏹ 停止
          </button>
        {:else}
          <button
            class="px-3 py-1.5 text-sm rounded bg-teal-600 hover:bg-teal-500 text-white flex-shrink-0"
            onclick={handleGenerate}
          >
            🎲 生成 & 再生
          </button>
        {/if}
      </div>

      <!-- 履歴（モバイルのみ: 設定の下） -->
      {#if melodyHistory.length > 0}
        <div class="md:hidden space-y-1 border-t border-gray-700 pt-2">
          {#each melodyHistory as entry, hi}
            {@const isActive = isPlaying && activeHistoryId === entry.id}
            <button
              class="w-full text-left px-2 py-1.5 text-xs rounded
                {isActive
                  ? 'bg-indigo-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
              onclick={() => playHistoryEntry(entry)}
            >
              <span class="text-[10px] opacity-50 block mb-0.5">
                #{hi + 1} {NOTE_NAMES[entry.rootPc]}{entry.scaleName ? ` ${entry.scaleName}` : ''}
              </span>
              <span class="mr-1">{isActive ? '⏹' : '▶'}</span>
              <span class="font-mono">
                {#each entry.notes as note, ni}
                  {#if ni > 0}<span class="opacity-30"> </span>{/if}
                  <span class="{isActive && currentNoteIdx === ni ? 'text-teal-300 font-bold' : ''}">{NOTE_NAMES[note.pc]}</span>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 右列: ピアノロール（上から表示） -->
    {#if rollNotes && rollNotes.length > 0}
      {@const midiValues = rollNotes.map(n => n.midi)}
      {@const minMidi = Math.min(...midiValues)}
      {@const maxMidi = Math.max(...midiValues)}
      {@const totalDur = rollNotes[rollNotes.length - 1].end}
      {@const ROW_H = 14}
      {@const LABEL_W = 26}
      {@const rollW = Math.max(totalDur * 80, 200)}
      {@const pitchRange = maxMidi - minMidi + 1}
      <div class="overflow-x-auto flex-shrink-0">
        <svg width={rollW + LABEL_W} height={pitchRange * ROW_H} style="display: block;">
          <!-- 行背景 -->
          {#each Array.from({length: pitchRange}, (_, i) => maxMidi - i) as midi, rowIdx}
            {@const pc = ((midi % 12) + 12) % 12}
            {@const isBlack = [1,3,6,8,10].includes(pc)}
            <rect x={0} y={rowIdx * ROW_H} width={LABEL_W + rollW} height={ROW_H}
              fill={isBlack ? '#1a1f2e' : '#111827'} />
            <text x={LABEL_W - 3} y={rowIdx * ROW_H + ROW_H - 3}
              text-anchor="end" font-size="9" fill="#6b7280" font-family="monospace">
              {NOTE_NAMES[pc]}
            </text>
          {/each}
          <!-- 行境界線 -->
          {#each Array.from({length: pitchRange + 1}, (_, i) => i * ROW_H) as y}
            <line x1={LABEL_W} y1={y} x2={LABEL_W + rollW} y2={y} stroke="#1f2937" stroke-width="1" />
          {/each}
          <!-- ノート矩形 -->
          {#each rollNotes as rn, i}
            {@const rowIdx = maxMidi - rn.midi}
            {@const x = LABEL_W + (rn.start / totalDur) * rollW}
            {@const w = ((rn.end - rn.start) / totalDur) * rollW}
            <rect
              x={x + 1} y={rowIdx * ROW_H + 1}
              width={Math.max(w - 2, 1)} height={ROW_H - 2}
              fill={currentNoteIdx === i ? '#5eead4' : '#14b8a6'}
              rx={2}
              opacity={currentNoteIdx === i ? 1 : 0.8}
            />
          {/each}
        </svg>
      </div>
    {/if}

  </div>

  <!-- 履歴（デスクトップのみ: 設定・ピアノロールの下） -->
  {#if melodyHistory.length > 0}
    <div class="hidden md:block space-y-1 border-t border-gray-700 mt-3 pt-2">
      {#each melodyHistory as entry, hi}
        {@const isActive = isPlaying && activeHistoryId === entry.id}
        <button
          class="w-full text-left px-2 py-1.5 text-xs rounded
            {isActive
              ? 'bg-indigo-700 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
          onclick={() => playHistoryEntry(entry)}
        >
          <span class="text-[10px] opacity-50 block mb-0.5">
            #{hi + 1} {NOTE_NAMES[entry.rootPc]}{entry.scaleName ? ` ${entry.scaleName}` : ''}
          </span>
          <span class="mr-1">{isActive ? '⏹' : '▶'}</span>
          <span class="font-mono">
            {#each entry.notes as note, ni}
              {#if ni > 0}<span class="opacity-30"> </span>{/if}
              <span class="{isActive && currentNoteIdx === ni ? 'text-teal-300 font-bold' : ''}">{NOTE_NAMES[note.pc]}</span>
            {/each}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
