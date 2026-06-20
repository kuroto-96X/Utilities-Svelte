<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS, CHROMATIC_PROGRESSIONS, TENSION_PROGRESSIONS, NOTE_NAMES, resolveProgressionVoicing } from '$lib/scaleData';
  import type { Progression, ChromaticProgression } from '$lib/scaleData';
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

  // ---- ランダム進行生成・履歴 ----

  const HISTORY_KEY = 'progressionHistory';
  const MAX_HISTORY = 9;

  interface HistoryEntry { id: string; degrees: number[]; }

  function loadHistory(): HistoryEntry[] {
    if (!browser) return [];
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
  }

  let progressionHistory = $state<HistoryEntry[]>(loadHistory());

  function saveHistory(h: HistoryEntry[]) {
    if (!browser) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  let randomProg = $state<Progression | null>(null);

  function generateRandomProg(): Progression {
    const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const len = Math.random() < 0.5 ? 4 : 3;
    const pool = [0, 1, 2, 3, 4, 5]; // I〜vi（vii°は除外）
    const degrees = [0]; // 最初は常に I
    while (degrees.length < len) {
      degrees.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return {
      id,
      label: 'ランダム',
      degrees,
      smoothVoicings: degrees.map(() => null),
    };
  }

  function addToHistory(prog: Progression) {
    const entry: HistoryEntry = { id: prog.id, degrees: prog.degrees };
    const h = [entry, ...progressionHistory].slice(0, MAX_HISTORY);
    progressionHistory = h;
    saveHistory(h);
  }

  function historyToProg(entry: HistoryEntry): Progression {
    return {
      id: entry.id,
      label: 'ランダム',
      degrees: entry.degrees,
      smoothVoicings: entry.degrees.map(() => null),
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

  function handleRandom() {
    if (activeProgId === randomProg?.id) {
      stopInternal();
    } else {
      const prog = generateRandomProg();
      randomProg = prog;
      addToHistory(prog);
      onplay?.();
      stopInternal();
      activeProgId = prog.id;
      playStep(prog.id, prog, 0);
    }
  }

  function playHistoryItem(entry: HistoryEntry) {
    const prog = historyToProg(entry);
    if (activeProgId === entry.id) {
      stopInternal();
    } else {
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
        <!-- 生成ボタン -->
        <button
          class="w-full text-left px-3 py-2 text-sm rounded
            {activeProgId === randomProg?.id
              ? 'bg-pink-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
          onclick={handleRandom}
        >
          <span class="block">{activeProgId === randomProg?.id ? '⏹ ' : '🎲 '}ランダム進行</span>
          {#if randomProg}
            {@const names = progChordNames(randomProg)}
            {@const activeIdx = activeProgId === randomProg.id ? activeStepIndex : -1}
            <span class="block text-xs font-mono mt-0.5">
              {#each names as name, i}
                {#if i > 0}<span class="opacity-40"> → </span>{/if}
                <span class="{activeIdx === i ? 'text-orange-400' : 'opacity-60'}">{name}</span>
              {/each}
            </span>
          {/if}
        </button>
        <!-- 履歴 -->
        {#each progressionHistory as entry, hi}
          {#if entry.id !== randomProg?.id}
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
              <span class="opacity-50 mr-1">{hi + 1}.</span>
              <span class="font-mono">
                {#each names as name, i}
                  {#if i > 0}<span class="opacity-40"> → </span>{/if}
                  <span class="{activeIdx === i ? 'text-orange-300' : ''}">{name}</span>
                {/each}
              </span>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>
