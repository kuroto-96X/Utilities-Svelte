<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS, CHROMATIC_PROGRESSIONS, TENSION_PROGRESSIONS, CHORDS, NOTE_NAMES, resolveProgressionVoicing } from '$lib/scaleData';
  import type { Progression, ChromaticProgression, ChromaticStep } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    inversion = 0,
    addPlayingPc,
    removePlayingPc,
    addPlayingMidi,
    removePlayingMidi,
    setPlayingChordName,
    stopCount = 0,
    onplay,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    inversion?: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    addPlayingMidi?: (midi: number) => void;
    removePlayingMidi?: (midi: number) => void;
    setPlayingChordName?: (name: string) => void;
    stopCount?: number;
    onplay?: () => void;
  } = $props();

  type AnyProg = Progression | ChromaticProgression;

  function isChromatic(p: AnyProg): p is ChromaticProgression {
    return 'steps' in p;
  }

  // ---- コード名ヘルパー ----

  function qualitySuffix(intervals: number[]): string {
    const has = (n: number) => intervals.includes(n);
    if (has(9)  && has(6) && has(3))                              return 'dim7';
    if (has(11) && has(7) && has(4))                              return 'maj7';
    if (has(10) && has(7) && has(4))                              return '7';
    if (has(2)  && has(3) && has(7) && has(10))                   return 'm9';
    if (has(10) && has(7) && has(3))                              return 'm7';
    if (has(6)  && has(3))                                        return 'dim';
    if (has(5)  && has(7) && !has(3) && !has(4))                  return 'sus4';
    if (has(2)  && has(4) && has(7)  && !has(10))                 return 'add9';
    if (has(2)  && has(7) && !has(3) && !has(4) && !has(10))      return 'sus2';
    if (has(7)  && has(3))                                        return 'm';
    return '';
  }

  function chordNameForDegree(degree: number): string {
    const chord = diatonicChords[degree];
    if (!chord) return '?';
    const root = NOTE_NAMES[chord.rootPc];
    switch (chord.quality) {
      case 'min': return root + 'm';
      case 'dim': return root + 'dim';
      case 'aug': return root + '+';
      default:    return root;
    }
  }

  function chromaticChordNames(prog: ChromaticProgression): string {
    const keyRoot = diatonicChords[0]?.rootPc ?? 0;
    return prog.steps.map(s => {
      const rootPc = ((keyRoot + s.semitone) % 12 + 12) % 12;
      return NOTE_NAMES[rootPc] + qualitySuffix(s.intervals);
    }).join(' → ');
  }

  function progChordNames(prog: AnyProg): string[] {
    const keyRoot = diatonicChords[0]?.rootPc ?? 0;
    return isChromatic(prog)
      ? prog.steps.map(s => {
          const rootPc = ((keyRoot + s.semitone) % 12 + 12) % 12;
          return NOTE_NAMES[rootPc] + qualitySuffix(s.intervals);
        })
      : prog.degrees.map(d => chordNameForDegree(d));
  }

  // ---- ランダム進行スタイル定義 ----

  type ChordFunction = 'T' | 'S' | 'D';

  interface StyleDef {
    id: string;
    label: string;
    allowRepeat: boolean;
    rootWeights: number[]; // インデックス = 前コードからの半音数 (0-11)
    tdWeights: Record<ChordFunction, Record<ChordFunction, number>>;
  }

  const STYLES: StyleDef[] = [
    {
      id: 'random',
      label: 'ランダム',
      allowRepeat: false,
      rootWeights: new Array(12).fill(1), // 全方向均等（完全ランダム）
      tdWeights: { T: { T: 1, S: 1, D: 1 }, S: { T: 1, S: 1, D: 1 }, D: { T: 1, S: 1, D: 1 } },
    },
    {
      id: 'pop',
      label: 'ポップ',
      allowRepeat: false,
      // [同音, +m2, +M2, +m3, +M3, +P4(下5度), +TT, +P5, +m6, +M6, +m7, +M7]
      rootWeights: [0, 2, 8, 8, 6, 30, 3, 12, 5, 8, 10, 2],
      tdWeights: {
        T: { T: 0.5, S: 2.0, D: 1.0 },
        S: { T: 0.5, S: 0.5, D: 3.0 },
        D: { T: 4.0, S: 0.5, D: 0.3 },
      },
    },
    {
      id: 'blues',
      label: 'ブルース',
      allowRepeat: true,
      rootWeights: [15, 12, 5, 12, 2, 12, 0, 5, 2, 8, 3, 12],
      tdWeights: {
        T: { T: 1.0, S: 1.5, D: 1.5 },
        S: { T: 1.0, S: 1.0, D: 1.5 },
        D: { T: 2.0, S: 1.0, D: 0.5 },
      },
    },
    {
      id: 'modal',
      label: 'モーダル',
      allowRepeat: false,
      rootWeights: [0, 8, 25, 4, 2, 5, 15, 3, 2, 4, 20, 8],
      tdWeights: {
        T: { T: 1.0, S: 1.0, D: 1.0 },
        S: { T: 1.0, S: 1.0, D: 1.0 },
        D: { T: 1.0, S: 1.0, D: 1.0 },
      },
    },
    {
      id: 'folk',
      label: 'フォーク',
      allowRepeat: false,
      rootWeights: [0, 6, 22, 15, 2, 5, 0, 3, 2, 12, 20, 6],
      tdWeights: {
        T: { T: 0.8, S: 1.5, D: 0.8 },
        S: { T: 0.8, S: 0.8, D: 1.5 },
        D: { T: 2.0, S: 0.8, D: 0.5 },
      },
    },
  ];

  // スケール音のインデックス順でT/S/Dを割り当て
  function getScaleFunction(semitone: number, sortedSemitones: number[]): ChordFunction {
    const idx = sortedSemitones.indexOf(semitone);
    const map: ChordFunction[] = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];
    return map[idx] ?? 'T';
  }

  function weightedPickIdx(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return Math.floor(Math.random() * weights.length);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  // ---- ランダム進行生成・履歴 ----

  const HISTORY_KEY = 'progressionHistory2';
  const MAX_HISTORY = 9;

  // スケール内の音のみで構成できるコードのプール（スケール・ルートが変わると自動更新）
  const diatonicChordPool = $derived.by(() => {
    const keyRoot = diatonicChords[0]?.rootPc ?? 0;
    const scalePcs = new Set(diatonicChords.map(c => c.rootPc));
    return [...scalePcs].flatMap(rootPc => {
      const semitone = (rootPc - keyRoot + 12) % 12;
      return CHORDS
        .filter(ct => ct.intervals.every(iv => scalePcs.has((rootPc + iv) % 12)))
        .map(ct => ({ semitone, intervals: ct.intervals }));
    });
  });

  interface HistoryEntry {
    id: string;
    steps: Array<{ semitone: number; intervals: number[] }>;
    styleLabel: string;
  }

  function loadHistory(): HistoryEntry[] {
    if (!browser) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((e) => typeof e.id === 'string' && Array.isArray(e.steps))
        .map((e) => ({
          id: e.id as string,
          steps: e.steps as Array<{ semitone: number; intervals: number[] }>,
          styleLabel: typeof e.styleLabel === 'string' ? e.styleLabel : 'ランダム',
        }));
    } catch { return []; }
  }

  let progressionHistory = $state<HistoryEntry[]>(loadHistory());

  function saveHistory(h: HistoryEntry[]) {
    if (!browser) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  let randomProg = $state<ChromaticProgression | null>(null);

  // トライアド（3音コード）は高め、テンション（5音以上）は低めに重み付け
  function chordComplexityMul(intervals: number[]): number {
    if (intervals.length <= 3) return 2.5;
    if (intervals.length === 4) return 1.0;
    return 0.5;
  }

  function generateRandomProg(styleId?: string): ChromaticProgression {
    const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const realStyles = STYLES.filter(s => s.id !== 'random');
    // styleId未指定のときは実スタイルをランダム選択（スタイル名を履歴に表示するため）
    const style = styleId
      ? (STYLES.find(s => s.id === styleId) ?? STYLES[0])
      : realStyles[Math.floor(Math.random() * realStyles.length)];

    const pool = diatonicChordPool;
    if (pool.length === 0) {
      return { id, label: style.label, steps: [{ semitone: 0, intervals: [0, 4, 7], name: '' }], smoothVoicings: [null] };
    }

    const sortedSemitones = [...new Set(pool.map(c => c.semitone))].sort((a, b) => a - b);
    const use7Note = sortedSemitones.length === 7;
    const len = Math.random() < 0.5 ? 4 : 3;
    const steps: ChromaticStep[] = [];

    // 最初のコードはトライアド重み付きでランダム選択
    const firstWeights = pool.map(c => chordComplexityMul(c.intervals));
    const firstIdx = weightedPickIdx(firstWeights);
    steps.push({ semitone: pool[firstIdx].semitone, intervals: pool[firstIdx].intervals, name: '' });

    while (steps.length < len) {
      const prev = steps[steps.length - 1];
      const prevFn: ChordFunction = use7Note ? getScaleFunction(prev.semitone, sortedSemitones) : 'T';

      const weights = pool.map(c => {
        const interval = (c.semitone - prev.semitone + 12) % 12;
        let w = style.rootWeights[interval];

        if (use7Note) {
          const nextFn = getScaleFunction(c.semitone, sortedSemitones);
          w *= style.tdWeights[prevFn][nextFn];
        }

        // トライアドの確率を上げる
        w *= chordComplexityMul(c.intervals);

        // allowRepeat=false のとき同一コード（同ルート・同インターバル）を禁止
        if (!style.allowRepeat
          && c.semitone === prev.semitone
          && c.intervals.length === prev.intervals.length
          && c.intervals.every((v, i) => v === prev.intervals[i])) {
          w = 0;
        }

        return w;
      });

      const idx = weightedPickIdx(weights);
      steps.push({ semitone: pool[idx].semitone, intervals: pool[idx].intervals, name: '' });
    }

    return { id, label: style.label, steps, smoothVoicings: steps.map(() => null) };
  }

  function addToHistory(prog: ChromaticProgression) {
    const entry: HistoryEntry = {
      id: prog.id,
      steps: prog.steps.map(s => ({ semitone: s.semitone, intervals: s.intervals })),
      styleLabel: prog.label,
    };
    const h = [entry, ...progressionHistory].slice(0, MAX_HISTORY);
    progressionHistory = h;
    saveHistory(h);
  }

  function historyToProg(entry: HistoryEntry): ChromaticProgression {
    return {
      id: entry.id,
      label: entry.styleLabel,
      steps: entry.steps.map(s => ({ semitone: s.semitone, intervals: s.intervals, name: '' })),
      smoothVoicings: entry.steps.map(() => null),
    };
  }

  // ---- 再生ロジック ----

  let useSmoothedBass = $state(false);
  let activeProgId = $state<string | null>(null);
  let activeStepIndex = $state(-1);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let activeChordStopFns: Array<() => void> = [];
  let activeChordPcs: number[] = [];
  let activeChordMidis: number[] = [];

  function stopCurrentChord() {
    for (const fn of activeChordStopFns) fn();
    activeChordStopFns = [];
    for (const pc of activeChordPcs) removePlayingPc(pc);
    activeChordPcs = [];
    for (const midi of activeChordMidis) removePlayingMidi?.(midi);
    activeChordMidis = [];
  }

  function stopInternal() {
    activeProgId = null;
    activeStepIndex = -1;
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    stopCurrentChord();
    setPlayingChordName?.('');
  }

  $effect(() => {
    stopCount;
    stopInternal();
  });

  function playStep(progId: string, prog: AnyProg, stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const STEP_SPACING = (60 / bpm) * 2;

    const stepsLen = isChromatic(prog) ? prog.steps.length : prog.degrees.length;
    activeStepIndex = stepIndex % stepsLen;

    stopCurrentChord();

    const tonicPc = diatonicChords[0]?.rootPc ?? 0;
    const tonicMidi = 57 + ((tonicPc - 9 + 12) % 12);

    if (isChromatic(prog)) {
      const step = prog.steps[activeStepIndex];
      const keyRoot = ((diatonicChords[0]?.rootPc ?? 0) + 120);
      const chordRoot = (keyRoot + step.semitone) % 12;
      const baseRoot = 57 + ((chordRoot - 9 + 12) % 12);
      const chordRootMidi = baseRoot < tonicMidi ? baseRoot + 12 : baseRoot;
      setPlayingChordName?.(NOTE_NAMES[chordRoot] + qualitySuffix(step.intervals));
      resolveProgressionVoicing(
        step.intervals,
        prog.smoothVoicings[activeStepIndex],
        useSmoothedBass,
        inversion,
      ).forEach(interval => {
        const midi = chordRootMidi + interval;
        const pc = ((chordRoot + interval) % 12 + 12) % 12;
        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        activeChordStopFns.push(stopFn);
        activeChordPcs.push(pc);
        activeChordMidis.push(midi);
        addPlayingPc(pc);
        addPlayingMidi?.(midi);
      });
    } else {
      const degree = prog.degrees[activeStepIndex];
      setPlayingChordName?.(chordNameForDegree(degree));
      const chord = diatonicChords[degree];
      if (chord) {
        const baseRoot = 57 + ((chord.rootPc - 9 + 12) % 12);
        const chordRootMidi = baseRoot < tonicMidi ? baseRoot + 12 : baseRoot;
        resolveProgressionVoicing(
          chord.intervals,
          prog.smoothVoicings[activeStepIndex],
          useSmoothedBass,
          inversion,
        ).forEach(interval => {
          const midi = chordRootMidi + interval;
          const pc = ((chord.rootPc + interval) % 12 + 12) % 12;
          const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
          activeChordStopFns.push(stopFn);
          activeChordPcs.push(pc);
          activeChordMidis.push(midi);
          addPlayingPc(pc);
          addPlayingMidi?.(midi);
        });
      }
    }

    timeoutId = setTimeout(() => {
      playStep(progId, prog, stepIndex + 1);
    }, STEP_SPACING * 1000);
  }

  function toggleProgression(prog: AnyProg) {
    if (activeProgId === prog.id) {
      stopInternal();
    } else {
      onplay?.();
      stopInternal();
      activeProgId = prog.id;
      playStep(prog.id, prog, 0);
    }
  }

  // スムーズベース用に転回形オフセットを計算する。
  // 各コードのベース音が前コードから最も近くなる転回形 + オクターブを選択。
  function computeSmoothVoicings(
    steps: ChromaticStep[],
    keyRootPc: number,
  ): (number[] | null)[] {
    const tonicMidi = 57 + ((keyRootPc - 9 + 12) % 12);
    let prevBassMidi: number | null = null;

    return steps.map((step) => {
      const chordRoot = (keyRootPc + step.semitone) % 12;
      const baseRoot = 57 + ((chordRoot - 9 + 12) % 12);
      const chordRootMidi = baseRoot < tonicMidi ? baseRoot + 12 : baseRoot;

      if (prevBassMidi === null) {
        prevBassMidi = chordRootMidi; // 最初はルートポジション（intervals[0] = 0）
        return null;
      }

      let bestJ = 0, bestO = 0, bestDist = Infinity;
      for (let j = 0; j < step.intervals.length; j++) {
        for (const o of [-1, 0]) {
          const dist = Math.abs(chordRootMidi + step.intervals[j] + o * 12 - prevBassMidi);
          if (dist < bestDist) { bestDist = dist; bestJ = j; bestO = o; }
        }
      }

      const rawBass = chordRootMidi + step.intervals[bestJ] + bestO * 12;
      // ベース音がA3(MIDI 57)を下回る場合は全音を1オクターブ上げる
      const octaveUp = rawBass < 57 ? 1 : 0;
      const finalO = bestO + octaveUp;
      prevBassMidi = rawBass + octaveUp * 12;
      if (bestJ === 0 && finalO === 0) return null;
      return step.intervals.map((_, i) => (i < bestJ ? 12 : 0) + finalO * 12);
    });
  }

  function handleRandom() {
    const raw = generateRandomProg();
    const smoothVoicings = computeSmoothVoicings(raw.steps, diatonicChords[0]?.rootPc ?? 0);
    const prog: ChromaticProgression = { ...raw, smoothVoicings };
    randomProg = prog;
    addToHistory(prog);
    onplay?.();
    stopInternal();
    activeProgId = prog.id;
    playStep(prog.id, prog, 0);
  }

  function playHistoryItem(entry: HistoryEntry) {
    if (activeProgId === entry.id) {
      stopInternal();
    } else {
      const steps = entry.steps.map(s => ({ semitone: s.semitone, intervals: s.intervals, name: '' }));
      const smoothVoicings = computeSmoothVoicings(steps, diatonicChords[0]?.rootPc ?? 0);
      const prog: ChromaticProgression = { id: entry.id, label: entry.styleLabel, steps, smoothVoicings };
      onplay?.();
      stopInternal();
      activeProgId = entry.id;
      playStep(entry.id, prog, 0);
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">コード進行プリセット</p>
    <label class="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
      <input type="checkbox" bind:checked={useSmoothedBass} class="accent-teal-500" />
      スムーズベース（転回形）
    </label>
  </div>

  <div class="flex flex-col md:flex-row gap-4">
    <!-- ダイアトニック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">ダイアトニック</p>
      <div class="space-y-1">
        {#each PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- クロマティック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">クロマティック</p>
      <div class="space-y-1">
        {#each CHROMATIC_PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- テンション解決 -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">テンション解決</p>
      <div class="space-y-1">
        {#each TENSION_PROGRESSIONS as prog}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === prog.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- ランダム -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">ランダム</p>
      <div class="space-y-1">
        <!-- 生成ボタン（常にランダム生成・active なし） -->
        <button
          class="w-full text-left px-3 py-2 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
          onclick={handleRandom}
        >
          ▶ ランダム進行
        </button>
        <!-- 履歴 -->
        {#each progressionHistory as entry, hi}
          {@const prog = historyToProg(entry)}
          {@const names = progChordNames(prog)}
          {@const activeIdx = activeProgId === entry.id ? activeStepIndex : -1}
          <button
            class="w-full text-left px-2 py-1.5 text-xs rounded
              {activeProgId === entry.id
                ? 'bg-pink-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
            onclick={() => playHistoryItem(entry)}
          >
            <span class="block text-[10px] opacity-40 mb-0.5">#{hi + 1} {entry.styleLabel}</span>
            <span class="mr-1">{activeProgId === entry.id ? '⏹' : '▶'}</span>
            <span class="font-mono">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-300' : ''}">{name}</span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
