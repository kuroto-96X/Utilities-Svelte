<!-- src/lib/components/ProgressionPlayer.svelte -->
<script lang="ts">
  import type { DiatonicChord } from '$lib/diatonicChords';
  import { PROGRESSIONS, CHROMATIC_PROGRESSIONS, TENSION_PROGRESSIONS, NOTE_NAMES } from '$lib/scaleData';
  import type { Progression, ChromaticProgression } from '$lib/scaleData';
  import { getAudioContext, startNoteAt } from '$lib/audioEngine';

  let {
    diatonicChords,
    bpm,
    addPlayingPc,
    removePlayingPc,
    addPlayingMidi,
    removePlayingMidi,
    stopCount = 0,
  }: {
    diatonicChords: DiatonicChord[];
    bpm: number;
    addPlayingPc: (pc: number) => void;
    removePlayingPc: (pc: number) => void;
    addPlayingMidi?: (midi: number) => void;
    removePlayingMidi?: (midi: number) => void;
    stopCount?: number;
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

  function progSubLabel(prog: AnyProg): string {
    return isChromatic(prog)
      ? chromaticChordNames(prog)
      : prog.degrees.map(d => chordNameForDegree(d)).join(' → ');
  }

  // ---- 再生ロジック ----

  let activeProgId = $state<string | null>(null);
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
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    stopCurrentChord();
  }

  $effect(() => {
    stopCount;
    stopInternal();
  });

  function playStep(progId: string, prog: AnyProg, stepIndex: number) {
    if (activeProgId !== progId) return;

    const ctx = getAudioContext();
    const STEP_SPACING = (60 / bpm) * 2;

    stopCurrentChord();

    if (isChromatic(prog)) {
      const step = prog.steps[stepIndex % prog.steps.length];
      const keyRoot = ((diatonicChords[0]?.rootPc ?? 0) + 120);
      const chordRoot = (keyRoot + step.semitone) % 12;
      step.intervals.forEach(interval => {
        const midi = 60 + chordRoot + interval;
        const pc = (chordRoot + interval) % 12;
        const stopFn = startNoteAt(ctx, midi, ctx.currentTime);
        activeChordStopFns.push(stopFn);
        activeChordPcs.push(pc);
        activeChordMidis.push(midi);
        addPlayingPc(pc);
        addPlayingMidi?.(midi);
      });
    } else {
      const degree = prog.degrees[stepIndex % prog.degrees.length];
      const chord = diatonicChords[degree];
      if (chord) {
        chord.intervals.forEach(interval => {
          const midi = 60 + chord.rootPc + interval;
          const pc = (chord.rootPc + interval) % 12;
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
      stopInternal();
      activeProgId = prog.id;
      playStep(prog.id, prog, 0);
    }
  }
</script>

<div>
  <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">コード進行プリセット</p>

  <div class="flex flex-col md:flex-row gap-4">
    <!-- ダイアトニック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">ダイアトニック</p>
      <div class="space-y-1">
        {#each PROGRESSIONS as prog}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-teal-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs opacity-60 font-mono mt-0.5">{progSubLabel(prog)}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- クロマティック -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">クロマティック</p>
      <div class="space-y-1">
        {#each CHROMATIC_PROGRESSIONS as prog}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs opacity-60 font-mono mt-0.5">{progSubLabel(prog)}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- テンション解決 -->
    <div class="flex-1 min-w-0">
      <p class="text-xs text-gray-500 mb-1">テンション解決</p>
      <div class="space-y-1">
        {#each TENSION_PROGRESSIONS as prog}
          <button
            class="w-full text-left px-3 py-2 text-sm rounded
              {activeProgId === prog.id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}"
            onclick={() => toggleProgression(prog)}
          >
            <span class="block">{activeProgId === prog.id ? '⏹ ' : '▶ '}{prog.label}</span>
            <span class="block text-xs opacity-60 font-mono mt-0.5">{progSubLabel(prog)}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
